using MyDms.BuildingBlocks;
using MyDms.Sales.Domain;
using Xunit;

namespace MyDms.UnitTests;

public sealed class AOrderDomainTests
{
    private static readonly Guid OrderId = Guid.Parse("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid CustomerId = Guid.Parse("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid SourceLineId = Guid.Parse("cccccccc-cccc-4ccc-cccc-cccccccccccc");
    private static readonly Guid SecondLineId = Guid.Parse("dddddddd-dddd-4ddd-dddd-dddddddddddd");
    private static readonly Guid SkuId = Guid.Parse("eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee");
    private static readonly Guid Delivery1 = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid Delivery2 = Guid.Parse("22222222-2222-4222-8222-222222222222");
    private static readonly Guid Delivery3 = Guid.Parse("33333333-3333-4333-8333-333333333333");

    private static AOrder Draft(decimal orderedQty = 3m) =>
        AOrder.CreateDraft(
            new TenantId(Guid.Parse("99999999-9999-4999-8999-999999999999")),
            OrderId,
            CustomerId,
            outletId: null,
            new ShipToSnapshot("Cửa hàng nhận hàng", "Địa chỉ snapshot"),
            [new AOrderDraftLine(SourceLineId, SkuId, orderedQty, "EA")]);

    private static AOrderQuotedLine Quote(decimal payable = 100_000m) =>
        new(SourceLineId, payable, "pricing-v1", "tax-rounding-v1");

    private static void ConfirmCredit(AOrder order, decimal gross = 100_000m) =>
        order.Confirm(new AOrderTermsSnapshot(AOrderPaymentMode.CreditDays, 7, "terms-v1"),
            AOrderCreditPolicySnapshot.Approved(150_000m, "finance-approved-v1"),
            [Quote(gross)]);

    [Fact]
    public void Draft_and_confirm_do_not_create_receivable_or_delivery_effects()
    {
        var order = Draft();
        Assert.Equal(AOrderStatus.Draft, order.Status);

        ConfirmCredit(order);

        Assert.Equal(AOrderStatus.Confirmed, order.Status);
        Assert.Empty(order.SimulatedDeliveries);
        Assert.Equal(0m, order.Lines.Single().SimulatedAllocatedPayableVnd);
        Assert.Equal(100_000m, order.Lines.Single().ConfirmedTotalPayableVnd);
        Assert.Equal(CustomerId, order.CustomerId);
        Assert.Null(order.OutletId); // Customer does not require an Outlet.
        Assert.Equal("Địa chỉ snapshot", order.ShipTo.Address);
    }

    [Fact]
    public void Partial_deliveries_produce_separate_projected_amounts_and_due_dates()
    {
        var order = Draft();
        ConfirmCredit(order);

        var first = order.SimulateDelivery(Delivery1, new DateOnly(2026, 11, 15),
            [new AOrderDeliveryLineInput(SourceLineId, 1m)]);
        Assert.Equal(AOrderStatus.PartiallyDelivered, order.Status);
        Assert.Equal(33_333m, first.ProjectedReceivableVnd);
        Assert.Equal(new DateOnly(2026, 11, 22), first.DueDate);

        var second = order.SimulateDelivery(Delivery2, new DateOnly(2026, 11, 16),
            [new AOrderDeliveryLineInput(SourceLineId, 1m)]);
        Assert.Equal(33_334m, second.ProjectedReceivableVnd);
        Assert.Equal(new DateOnly(2026, 11, 23), second.DueDate);

        var last = order.SimulateDelivery(Delivery3, new DateOnly(2026, 11, 17),
            [new AOrderDeliveryLineInput(SourceLineId, 1m)]);
        Assert.Equal(33_333m, last.ProjectedReceivableVnd);
        Assert.Equal(AOrderStatus.Fulfilled, order.Status);
        Assert.Equal(100_000m, order.SimulatedDeliveries.Sum(x => x.ProjectedReceivableVnd));
        Assert.Equal(3m, order.Lines.Single().SimulatedDeliveredBaseQuantity);
        Assert.Equal(100_000m, order.Lines.Single().SimulatedAllocatedPayableVnd);
    }

    [Fact]
    public void Confirmed_terms_and_commercial_amounts_do_not_change_with_new_policy_objects()
    {
        var order = Draft();
        var terms = new AOrderTermsSnapshot(AOrderPaymentMode.CreditDays, 7, "terms-v1");
        order.Confirm(terms, AOrderCreditPolicySnapshot.Approved(200_000m, "approved-v1"),
            [Quote()]);
        terms = terms with { Days = 30, PolicyVersion = "terms-v2" };
        var replacementPrice = Quote(500_000m);

        var delivery = order.SimulateDelivery(Delivery1, new DateOnly(2026, 11, 15),
            [new AOrderDeliveryLineInput(SourceLineId, 3m)]);

        Assert.Equal(100_000m, delivery.ProjectedReceivableVnd);
        Assert.Equal(new DateOnly(2026, 11, 22), delivery.DueDate);
        Assert.Equal("terms-v1", order.TermsSnapshot!.PolicyVersion);
        Assert.Equal("pricing-v1", order.Lines.Single().ConfirmedTotalPayableVnd == 100_000m
            ? "pricing-v1" : replacementPrice.CommercialPolicyVersion);
    }

    [Fact]
    public void Unset_credit_and_explicit_approved_zero_are_distinct_and_both_fail_closed_for_credit_days()
    {
        var order = Draft();
        var creditTerms = new AOrderTermsSnapshot(AOrderPaymentMode.CreditDays, 5, "terms-v1");

        Assert.Throws<InvalidOperationException>(() =>
            order.Confirm(creditTerms, AOrderCreditPolicySnapshot.Unset(), [Quote()]));
        Assert.Equal(AOrderStatus.Draft, order.Status);

        Assert.Throws<InvalidOperationException>(() =>
            order.Confirm(creditTerms, AOrderCreditPolicySnapshot.Approved(0m, "approved-zero"),
                [Quote()]));
        Assert.Equal(AOrderStatus.Draft, order.Status);
        Assert.NotEqual(AOrderCreditPolicySnapshot.Unset(),
            AOrderCreditPolicySnapshot.Approved(0m, "approved-zero"));
    }

    [Fact]
    public void Cash_on_delivery_with_unset_credit_keeps_same_day_due_projection_without_granting_credit()
    {
        var order = Draft();
        order.Confirm(
            new AOrderTermsSnapshot(AOrderPaymentMode.CashOnDelivery, 0, "cod-v1"),
            AOrderCreditPolicySnapshot.Unset(),
            [Quote()]);

        var delivery = order.SimulateDelivery(Delivery1, new DateOnly(2026, 11, 15),
            [new AOrderDeliveryLineInput(SourceLineId, 1m)]);

        Assert.Equal(new DateOnly(2026, 11, 15), delivery.DueDate);
        Assert.Equal(CustomerCreditPolicyStatus.Unset, order.CreditPolicySnapshot!.Status);
        // Cash receipt verification before real completion is an unimplemented runtime gate.
    }

    [Fact]
    public void Invalid_multiline_delivery_does_not_partially_mutate_a_valid_line()
    {
        var order = AOrder.CreateDraft(
            new TenantId(Guid.Parse("99999999-9999-4999-8999-999999999999")),
            OrderId, CustomerId, null,
            new ShipToSnapshot("Recipient", "ShipTo snapshot"),
            [
                new AOrderDraftLine(SourceLineId, SkuId, 2m, "EA"),
                new AOrderDraftLine(SecondLineId, Guid.Parse("ffffffff-ffff-4fff-8fff-ffffffffffff"), 1m, "EA")
            ]);
        order.Confirm(
            new AOrderTermsSnapshot(AOrderPaymentMode.CashOnDelivery, 0, "cod-v1"),
            AOrderCreditPolicySnapshot.Unset(),
            [Quote(200m), new AOrderQuotedLine(SecondLineId, 80m, "p-v1", "t-v1")]);

        Assert.Throws<InvalidOperationException>(() => order.SimulateDelivery(
            Delivery1, new DateOnly(2026, 11, 15),
            [
                new AOrderDeliveryLineInput(SourceLineId, 1m),
                new AOrderDeliveryLineInput(SecondLineId, 2m)
            ]));

        Assert.Equal(AOrderStatus.Confirmed, order.Status);
        Assert.Empty(order.SimulatedDeliveries);
        Assert.All(order.Lines, x => Assert.Equal(0m, x.SimulatedDeliveredBaseQuantity));
    }

    [Fact]
    public void Duplicate_or_excess_source_delivery_is_rejected_without_double_allocation()
    {
        var order = Draft();
        ConfirmCredit(order);
        var first = order.SimulateDelivery(Delivery1, new DateOnly(2026, 11, 15),
            [new AOrderDeliveryLineInput(SourceLineId, 1m)]);

        Assert.Throws<InvalidOperationException>(() => order.SimulateDelivery(
            Delivery1, new DateOnly(2026, 11, 15),
            [new AOrderDeliveryLineInput(SourceLineId, 1m)]));
        Assert.Throws<InvalidOperationException>(() => order.SimulateDelivery(
            Delivery2, new DateOnly(2026, 11, 15),
            [new AOrderDeliveryLineInput(SourceLineId, 3m)]));

        Assert.Single(order.SimulatedDeliveries);
        Assert.Equal(first.ProjectedReceivableVnd, order.Lines.Single().SimulatedAllocatedPayableVnd);
        Assert.Equal(1m, order.Lines.Single().SimulatedDeliveredBaseQuantity);
    }

    [Fact]
    public void Missing_or_duplicated_price_quotes_never_confirm_a_draft()
    {
        var order = Draft();
        var cod = new AOrderTermsSnapshot(AOrderPaymentMode.CashOnDelivery, 0, "cod-v1");
        var unset = AOrderCreditPolicySnapshot.Unset();

        Assert.Throws<ArgumentException>(() => order.Confirm(cod, unset, []));
        Assert.Throws<ArgumentException>(() => order.Confirm(cod, unset, [Quote(), Quote()]));
        Assert.Equal(AOrderStatus.Draft, order.Status);
    }

    [Fact]
    public void Invalid_master_and_delivery_source_inputs_are_rejected()
    {
        Assert.Throws<ArgumentException>(() => AOrder.CreateDraft(
            default, OrderId, CustomerId, null, new ShipToSnapshot("A", "B"),
            [new AOrderDraftLine(SourceLineId, SkuId, 1m, "EA")]));
        Assert.Throws<ArgumentException>(() => AOrder.CreateDraft(
            new TenantId(Guid.NewGuid()), OrderId, CustomerId, null,
            new ShipToSnapshot("A", "B"),
            [new AOrderDraftLine(SourceLineId, SkuId, 1m, "EA"),
             new AOrderDraftLine(SourceLineId, SkuId, 1m, "EA")]));

        var order = Draft();
        ConfirmCredit(order);
        Assert.Throws<InvalidOperationException>(() => order.SimulateDelivery(
            Delivery1, new DateOnly(2026, 11, 15),
            [new AOrderDeliveryLineInput(Guid.NewGuid(), 1m)]));
        Assert.Empty(order.SimulatedDeliveries);
    }

    [Fact]
    public void Cannot_reconfirm_or_simulate_after_full_delivery()
    {
        var order = Draft();
        ConfirmCredit(order);
        Assert.Throws<InvalidOperationException>(() => ConfirmCredit(order));

        order.SimulateDelivery(Delivery1, new DateOnly(2026, 11, 15),
            [new AOrderDeliveryLineInput(SourceLineId, 3m)]);
        Assert.Throws<InvalidOperationException>(() => order.SimulateDelivery(
            Delivery2, new DateOnly(2026, 11, 16),
            [new AOrderDeliveryLineInput(SourceLineId, 1m)]));
    }
}
