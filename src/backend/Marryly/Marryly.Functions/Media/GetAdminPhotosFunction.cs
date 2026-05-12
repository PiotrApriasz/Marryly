using System.Net;
using Marryly.Application.Constants;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class GetAdminPhotosFunction(
    ILogger<GetAdminPhotosFunction> logger,
    IAuthService authService,
    IMediaService mediaService)
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 20;

    [Function("GetAdminPhotos")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/photos")]
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
        logger.LogInformation("Downloading admin photos for event: {EventId}", eventId);

        try
        {
            var query = QueryHelpers.ParseQuery(req.Url.Query);
            var page = ParsePositiveInt(query, "page", DefaultPage);
            var pageSize = ParsePositiveInt(query, "pageSize", DefaultPageSize);
            var response = await mediaService.GetAdminPhotosPageAsync(eventId, page, pageSize, ct);
            return await ApiResponse.ProduceSuccessResponse(req, response);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "Media container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "MEDIA_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Media storage container is not available."
            );
        }
    }

    private static int ParsePositiveInt(Dictionary<string, Microsoft.Extensions.Primitives.StringValues> query, string key, int fallbackValue)
    {
        if (!query.TryGetValue(key, out var value))
        {
            return fallbackValue;
        }

        return int.TryParse(value.ToString(), out var parsedValue) && parsedValue > 0
            ? parsedValue
            : fallbackValue;
    }
}
