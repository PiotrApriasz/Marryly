using System.Net;
using Marryly.Application.Constants;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Overview;

public class GetOverviewFunction(
    ILogger<GetOverviewFunction> logger,
    IConfiguration configuration,
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
                "Admin token is missing."
            );
        }

        if (!authService.TryValidateToken(token, out _))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "SESSION_INVALID",
                "Unauthorized",
                "Session is invalid or expired."
            );
        }

        var eventId = ResolveEventId(req);
        if (string.IsNullOrWhiteSpace(eventId))
        {
            logger.LogError("Overview requested without event id. Set EVENT_ID or pass ?eventId=...");
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "EVENT_ID_MISSING",
                "Configuration error",
                "Overview event id is not configured."
            );
        }

        var overview = await overviewService.GetOverviewAsync(eventId, ct);
        return await ApiResponse.ProduceSuccessResponse(req, overview);
    }

    private string? ResolveEventId(HttpRequestData req)
    {
        var query = QueryHelpers.ParseQuery(req.Url.Query);
        return query.TryGetValue("eventId", out var eventId) ? eventId.ToString() : configuration["EVENT_ID"];
    }
}
