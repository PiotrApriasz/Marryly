using System.Net;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.GuestBook;

public class GetGuestBookEntriesFunction(
    ILogger<GetGuestBookEntriesFunction> logger,
    IConfiguration configuration,
    IAuthService authService,
    IGuestBookService guestBookService)
{
    [Function("GetGuestBookEntries")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/guestbook")]
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
            logger.LogError("Guestbook entries requested without event id. Set EVENT_ID or pass ?eventId=...");
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "EVENT_ID_MISSING",
                "Configuration error",
                "Guestbook event id is not configured."
            );
        }

        logger.LogInformation("Downloading guestbook entries for event: {EventId}", eventId);

        try
        {
            var entries = await guestBookService.GetAllGuestBookEntriesAsync(eventId, ct);
            return await ApiResponse.ProduceSuccessResponse(req, entries);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "Guestbook container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "GUESTBOOK_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Guestbook storage container is not available."
            );
        }
    }

    private string? ResolveEventId(HttpRequestData req)
    {
        var query = QueryHelpers.ParseQuery(req.Url.Query);
        return query.TryGetValue("eventId", out var eventId) ? eventId.ToString() : configuration["EVENT_ID"];
    }
}
