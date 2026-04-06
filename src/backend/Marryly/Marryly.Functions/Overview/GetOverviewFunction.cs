using System.Net;
using Marryly.Application.Constants;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Overview;

public class GetOverviewFunction(
    ILogger<GetOverviewFunction> logger,
    IAuthService authService,
    IOverviewService overviewService)
{
    [Function("PanelOverview")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/overview")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var token = authService.ReadAccessToken(req);
        if (string.IsNullOrWhiteSpace(token))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "SESSION_NOT_FOUND",
                "Unauthorized",
                "Access token is missing."
            );
        }

        if (!authService.TryValidateToken(token, out var context))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "SESSION_INVALID",
                "Unauthorized",
                "Session is invalid or expired."
            );
        }

        if (!string.Equals(context.Role, AuthConstants.AdminRole, StringComparison.Ordinal))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Forbidden,
                "ACCESS_FORBIDDEN",
                "Forbidden",
                "Admin access is required."
            );
        }

        var eventId = context.EventId;
        var overview = await overviewService.GetOverviewAsync(eventId, ct);
        return await ApiResponse.ProduceSuccessResponse(req, overview);
    }
}
