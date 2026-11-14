var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

// S6-0 FOUNDATION ONLY. Liveness is not readiness, authorization, or Product Verification.
app.MapGet("/health/live", () => Results.Ok(new { status = "LIVE", scope = "PROCESS_ONLY" }));
app.MapGet("/health/ready", () => Results.Json(
    new { status = "NOT_READY", reason = "TENANT_AUTHORITY_AND_SQL_NOT_CONFIGURED" },
    statusCode: StatusCodes.Status503ServiceUnavailable));

// No tenant, business, invoice, stock or money endpoints until Gate B/TADR review.
app.Run();

public partial class Program { }
