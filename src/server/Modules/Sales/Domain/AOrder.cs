using MyDms.BuildingBlocks;

namespace MyDms.Sales.Domain;

public enum AOrderStatus
{
    Draft,
    Confirmed,
    PartiallyDelivered,
    Fulfilled
}

public enum AOrderPaymentMode
{
    CashOnDelivery,
    CreditDays
}

public enum CustomerCreditPolicyStatus
{
    Unset,
    Approved
}

public sealed record ShipToSnapshot(string Recipient, string Address);

public sealed record AOrderDraftLine(
    Guid LineId,
    Guid SkuId,
    decimal OrderedBaseQuantity,
    string BaseUomCode);

/// <summary>
/// TotalPayableVnd is calculated by an external, versioned pricing/tax policy.
/// This first slice does not implement the five pricing families or VAT rules.
/// </summary>
public sealed record AOrderQuotedLine(
    Guid LineId,
    decimal TotalPayableVnd,
    string CommercialPolicyVersion,
    string TaxAndRoundingPolicyVersion);

public sealed record AOrderTermsSnapshot(
    AOrderPaymentMode PaymentMode,
    int Days,
    string PolicyVersion);

/// <summary>
/// The approved limit is a policy snapshot, NOT evidence of currently available credit.
/// Shared credit exposure/reservation must be checked atomically in the authorized runtime.
/// </summary>
public sealed record AOrderCreditPolicySnapshot(
    CustomerCreditPolicyStatus Status,
    decimal? ApprovedLimitVnd,
    string? ApprovalReference)
{
    public static AOrderCreditPolicySnapshot Unset() =>
        new(CustomerCreditPolicyStatus.Unset, null, null);

    public static AOrderCreditPolicySnapshot Approved(decimal limitVnd, string approvalReference)
    {
        if (limitVnd < 0 || string.IsNullOrWhiteSpace(approvalReference))
            throw new ArgumentException("Approved credit requires a nonnegative limit and approval reference.");

        return new(CustomerCreditPolicyStatus.Approved, limitVnd, approvalReference);
    }
}

public sealed record AOrderDeliveryLineInput(Guid SourceOrderLineId, decimal DeliveredBaseQuantity);

public sealed record AOrderDeliveryLineProjection(
    Guid SourceOrderLineId,
    decimal DeliveredBaseQuantity,
    decimal ProjectedPayableVnd);

/// <summary>
/// Projection only: not a posted delivery, an actual AR open item, or an invoice.
/// </summary>
public sealed record AOrderDeliveryProjection(
    Guid DeliveryId,
    Guid CustomerId,
    DateOnly BusinessDate,
    DateOnly DueDate,
    decimal ProjectedReceivableVnd,
    IReadOnlyList<AOrderDeliveryLineProjection> Lines);

public sealed record AOrderLineView(
    Guid LineId,
    Guid SkuId,
    decimal OrderedBaseQuantity,
    decimal SimulatedDeliveredBaseQuantity,
    decimal? ConfirmedTotalPayableVnd,
    decimal SimulatedAllocatedPayableVnd);

/// <summary>
/// In-memory Module A domain exercise for deterministic business tests only.
/// No authority, inventory reservation, financial posting, provider calls, or persistence.
/// B05/B06 and all S6-A runtime actions remain subject to Gate A/B.
/// </summary>
public sealed class AOrder
{
    private sealed class LineState(AOrderDraftLine draft)
    {
        public AOrderDraftLine Draft { get; } = draft;
        public AOrderQuotedLine? Quote { get; set; }
        public decimal DeliveredQuantity { get; set; }
        public decimal AllocatedPayableVnd { get; set; }
    }

    private readonly Dictionary<Guid, LineState> _lines;
    private readonly List<AOrderDeliveryProjection> _simulatedDeliveries = [];

    private AOrder(
        TenantId tenantId,
        Guid orderId,
        Guid customerId,
        Guid? outletId,
        ShipToSnapshot shipTo,
        Dictionary<Guid, LineState> lines)
    {
        TenantId = tenantId;
        OrderId = orderId;
        CustomerId = customerId;
        OutletId = outletId;
        ShipTo = shipTo;
        _lines = lines;
    }

    public TenantId TenantId { get; }
    public Guid OrderId { get; }
    public Guid CustomerId { get; }
    public Guid? OutletId { get; }
    public ShipToSnapshot ShipTo { get; }
    public AOrderTermsSnapshot? TermsSnapshot { get; private set; }
    public AOrderCreditPolicySnapshot? CreditPolicySnapshot { get; private set; }

    public AOrderStatus Status =>
        TermsSnapshot is null ? AOrderStatus.Draft :
        _lines.Values.All(x => x.DeliveredQuantity == x.Draft.OrderedBaseQuantity) ? AOrderStatus.Fulfilled :
        _lines.Values.Any(x => x.DeliveredQuantity > 0) ? AOrderStatus.PartiallyDelivered :
        AOrderStatus.Confirmed;

    public IReadOnlyList<AOrderLineView> Lines =>
        _lines.Values.Select(x => new AOrderLineView(
            x.Draft.LineId, x.Draft.SkuId, x.Draft.OrderedBaseQuantity,
            x.DeliveredQuantity, x.Quote?.TotalPayableVnd, x.AllocatedPayableVnd)).ToArray();

    public IReadOnlyList<AOrderDeliveryProjection> SimulatedDeliveries => _simulatedDeliveries.ToArray();

    public static AOrder CreateDraft(
        TenantId tenantId,
        Guid orderId,
        Guid customerId,
        Guid? outletId,
        ShipToSnapshot shipTo,
        IEnumerable<AOrderDraftLine> lines)
    {
        if (!tenantId.IsSet || orderId == Guid.Empty || customerId == Guid.Empty ||
            outletId == Guid.Empty)
            throw new ArgumentException("Tenant, order, customer and optional outlet IDs must be valid.");
        if (shipTo is null || string.IsNullOrWhiteSpace(shipTo.Recipient) ||
            string.IsNullOrWhiteSpace(shipTo.Address))
            throw new ArgumentException("A snapshot of the delivery recipient and address is required.");
        if (lines is null)
            throw new ArgumentNullException(nameof(lines));

        var snapshots = lines.ToArray();
        if (snapshots.Length == 0 ||
            snapshots.Any(x => x.LineId == Guid.Empty || x.SkuId == Guid.Empty ||
                x.OrderedBaseQuantity <= 0 || string.IsNullOrWhiteSpace(x.BaseUomCode)) ||
            snapshots.Select(x => x.LineId).Distinct().Count() != snapshots.Length)
            throw new ArgumentException("Order lines need valid, unique source IDs, SKUs, UoMs and positive quantities.");

        return new AOrder(tenantId, orderId, customerId, outletId, shipTo,
            snapshots.ToDictionary(x => x.LineId, x => new LineState(x)));
    }

    /// <summary>
    /// Freezes commercial/terms inputs. This does NOT confirm stock hold or credit headroom.
    /// A real ConfirmAOrder command must verify both within reviewed SQL transactions.
    /// </summary>
    public void Confirm(
        AOrderTermsSnapshot terms,
        AOrderCreditPolicySnapshot credit,
        IEnumerable<AOrderQuotedLine> quotedLines)
    {
        if (Status != AOrderStatus.Draft)
            throw new InvalidOperationException("An order can only be confirmed once.");
        if (terms is null || string.IsNullOrWhiteSpace(terms.PolicyVersion) ||
            terms.Days < 0 || !Enum.IsDefined(terms.PaymentMode) ||
            (terms.PaymentMode == AOrderPaymentMode.CashOnDelivery && terms.Days != 0) ||
            (terms.PaymentMode == AOrderPaymentMode.CreditDays && terms.Days == 0))
            throw new ArgumentException("Invalid versioned payment terms.");
        if (credit is null ||
            (credit.Status == CustomerCreditPolicyStatus.Unset &&
             (credit.ApprovedLimitVnd is not null || credit.ApprovalReference is not null)) ||
            (credit.Status == CustomerCreditPolicyStatus.Approved &&
             (credit.ApprovedLimitVnd is null || credit.ApprovedLimitVnd < 0 ||
              string.IsNullOrWhiteSpace(credit.ApprovalReference))) ||
            !Enum.IsDefined(credit.Status))
            throw new ArgumentException("UNSET and APPROVED credit must not be conflated.");
        if (terms.PaymentMode == AOrderPaymentMode.CreditDays &&
            (credit.Status != CustomerCreditPolicyStatus.Approved ||
             credit.ApprovedLimitVnd is null or <= 0))
            throw new InvalidOperationException("Credit-days terms require an approved positive policy; real exposure is checked later.");
        if (quotedLines is null)
            throw new ArgumentNullException(nameof(quotedLines));

        var quotes = quotedLines.ToArray();
        if (quotes.Length != _lines.Count ||
            quotes.Select(x => x.LineId).Distinct().Count() != quotes.Length ||
            quotes.Any(x => !_lines.ContainsKey(x.LineId) ||
                x.TotalPayableVnd < 0 ||
                string.IsNullOrWhiteSpace(x.CommercialPolicyVersion) ||
                string.IsNullOrWhiteSpace(x.TaxAndRoundingPolicyVersion)))
            throw new ArgumentException("A versioned nonnegative commercial quote is required for every order line.");

        // Validate all inputs before changing the aggregate.
        _ = quotes.Sum(x => x.TotalPayableVnd);
        foreach (var quote in quotes)
            _lines[quote.LineId].Quote = quote;
        TermsSnapshot = terms;
        CreditPolicySnapshot = credit;
    }

    /// <summary>
    /// Updates an in-memory projection, not stock/AR/cash. The external command must
    /// validate delivered facts, availability, authorization, idempotency and posting.
    /// </summary>
    public AOrderDeliveryProjection SimulateDelivery(
        Guid deliveryId,
        DateOnly businessDate,
        IEnumerable<AOrderDeliveryLineInput> deliveryLines)
    {
        if (Status is AOrderStatus.Draft or AOrderStatus.Fulfilled)
            throw new InvalidOperationException("A confirmed order with remaining quantity is required.");
        if (deliveryId == Guid.Empty || _simulatedDeliveries.Any(x => x.DeliveryId == deliveryId))
            throw new InvalidOperationException("Delivery source ID is empty or already used.");
        if (deliveryLines is null)
            throw new ArgumentNullException(nameof(deliveryLines));

        var requests = deliveryLines.ToArray();
        if (requests.Length == 0 ||
            requests.Select(x => x.SourceOrderLineId).Distinct().Count() != requests.Length)
            throw new ArgumentException("A delivery needs unique nonempty source lines.");

        var projected = new List<AOrderDeliveryLineProjection>();
        foreach (var request in requests)
        {
            if (!_lines.TryGetValue(request.SourceOrderLineId, out var line) ||
                request.DeliveredBaseQuantity <= 0 ||
                request.DeliveredBaseQuantity > line.Draft.OrderedBaseQuantity - line.DeliveredQuantity)
                throw new InvalidOperationException("Delivery exceeds its source order line or has an invalid quantity.");

            var deliveredAfter = line.DeliveredQuantity + request.DeliveredBaseQuantity;
            // Cumulative allocation avoids a residual being lost after multiple partial deliveries.
            // This VND rounding rule is a DOMAIN CANDIDATE, not an approved pricing/ledger algorithm.
            var cumulativeVnd = deliveredAfter == line.Draft.OrderedBaseQuantity
                ? line.Quote!.TotalPayableVnd
                : decimal.Round(line.Quote!.TotalPayableVnd * deliveredAfter /
                                line.Draft.OrderedBaseQuantity, 0, MidpointRounding.AwayFromZero);
            var deltaVnd = cumulativeVnd - line.AllocatedPayableVnd;
            if (deltaVnd < 0)
                throw new InvalidOperationException("Projected source-line allocation must not go negative.");
            projected.Add(new AOrderDeliveryLineProjection(request.SourceOrderLineId,
                request.DeliveredBaseQuantity, deltaVnd));
        }

        // All calculations complete before any in-memory state change.
        var total = projected.Sum(x => x.ProjectedPayableVnd);
        var dueDate = businessDate.AddDays(TermsSnapshot!.Days);
        var result = new AOrderDeliveryProjection(deliveryId, CustomerId, businessDate,
            dueDate, total, Array.AsReadOnly(projected.ToArray()));

        foreach (var line in projected)
        {
            var state = _lines[line.SourceOrderLineId];
            state.DeliveredQuantity += line.DeliveredBaseQuantity;
            state.AllocatedPayableVnd += line.ProjectedPayableVnd;
        }
        _simulatedDeliveries.Add(result);
        return result;
    }
}
