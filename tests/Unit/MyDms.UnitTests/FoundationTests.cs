using MyDms.BuildingBlocks;
using MyDms.Inventory.Domain;
using MyDms.Sales.Domain;
using MyDms.Settlement.Domain;
using Xunit;

namespace MyDms.UnitTests;

public sealed class FoundationTests
{
    [Fact]
    public void Empty_tenant_identifier_is_rejected()
    {
        Assert.False(TenantId.TryCreate(Guid.Empty, out var result));
        Assert.False(result.IsSet);
    }

    [Fact]
    public void Nonempty_tenant_identifier_can_be_created()
    {
        var candidate = Guid.Parse("11111111-1111-4111-8111-111111111111");
        Assert.True(TenantId.TryCreate(candidate, out var result));
        Assert.Equal(candidate, result.Value);
    }

    [Fact]
    public void Module_markers_are_distinct()
    {
        Assert.NotEqual(InventoryModule.Name, SalesModule.Name);
        Assert.NotEqual(SalesModule.Name, SettlementModule.Name);
    }
}
