using System.Net;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class GetPhotosFunction(
    ILogger<GetPhotosFunction> logger,
    IConfiguration configuration,
    IMediaService mediaService)
{
    private const int DefaultLimit = 50;

    [Function("GetPhotos")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "events/{eventId}/photos")]
        HttpRequestData req,
        string eventId,
        CancellationToken ct)
    {
        var expectedEventId = configuration["EVENT_ID"];
        if (!string.IsNullOrWhiteSpace(expectedEventId) &&
            !string.Equals(expectedEventId, eventId, StringComparison.Ordinal))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.NotFound,
                "EVENT_NOT_FOUND",
                "Event not found",
                "Photos are not enabled for this event."
            );
        }

        try
        {
            var query = QueryHelpers.ParseQuery(req.Url.Query);
            var limit = ParsePositiveInt(query, "limit", DefaultLimit);
            var continuationToken = query.TryGetValue("continuationToken", out var tokenValue)
                ? tokenValue.ToString()
                : null;

            var photosPage = await mediaService.GetApprovedPhotosPageAsync(eventId, limit, continuationToken, ct);
            var response = new
            {
                items = photosPage.Items.Select(photo => new
                {
                    id = photo.Id,
                    eventId = photo.EventId,
                    url = photo.PreviewBlobUrl,
                    thumbnailUrl = photo.ThumbnailBlobUrl,
                    uploadedAt = photo.UploadedAt,
                    approved = photo.Approved,
                    width = photo.Width,
                    height = photo.Height
                }),
                continuationToken = photosPage.ContinuationToken,
                hasMore = photosPage.HasMore
            };

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
