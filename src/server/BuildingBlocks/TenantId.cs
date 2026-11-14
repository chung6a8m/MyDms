namespace MyDms.BuildingBlocks;

/// <summary>Validated tenant identifier; never use a request-supplied database name.</summary>
public readonly record struct TenantId(Guid Value)
{
    public bool IsSet => Value != Guid.Empty;

    public static bool TryCreate(Guid value, out TenantId tenant)
    {
        tenant = value == Guid.Empty ? default : new TenantId(value);
        return tenant.IsSet;
    }
}
