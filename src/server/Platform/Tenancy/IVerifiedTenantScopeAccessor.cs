using MyDms.BuildingBlocks;

namespace MyDms.Platform.Tenancy;

/// <summary>Contract only. An authenticated platform authority must supply this scope.
/// Never select a tenant DB from request body/header/query values without authorization.
/// No runtime adapter is implemented in S6-0.</summary>
public interface IVerifiedTenantScopeAccessor
{
    TenantId CurrentTenantId { get; }
}
