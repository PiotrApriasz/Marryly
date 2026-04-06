using System.Net;
using Marryly.Application.Interfaces;
using Marryly.Application.Constants;
using Marryly.Functions.Result;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.GuestBook;

public class GetGuestBookEntriesFunction(
    ILogger<GetGuestBookEntriesFunction> logger,
    IAuthService authService,
    IGuestBookService guestBookService)
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 10;

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
        logger.LogInformation("Downloading guestbook entries for event: {EventId}", eventId);

        try
        {
            var query = QueryHelpers.ParseQuery(req.Url.Query);
            var page = ParsePositiveInt(query, "page", DefaultPage);
            var pageSize = ParsePositiveInt(query, "pageSize", DefaultPageSize);

            var response = await guestBookService.GetGuestBookEntriesPageAsync(eventId, page, pageSize, ct);
            return await ApiResponse.ProduceSuccessResponse(req, response);
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

    private static int ParsePositiveInt(Dictionary<string, Microsoft.Extensions.Primitives.StringValues> query, string key, int fallbackValue)
    {
        if (!query.TryGetValue(key, out var value)) {
            return fallbackValue;
        }

        return int.TryParse(value.ToString(), out var parsedValue) && parsedValue > 0
            ? parsedValue
            : fallbackValue;
    }
}
