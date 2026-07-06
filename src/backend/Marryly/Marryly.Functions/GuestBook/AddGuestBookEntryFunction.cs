using System.Net;
using System.Text.Json;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.GuestBook;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.GuestBook;

public class AddGuestBookEntryFunction(
    ILogger<AddGuestBookEntryFunction> logger,
    IAuthService authService,
    IGuestBookService guestBookService,
    IMediaService mediaService)
{
    private const string GuestBookSourceType = "guestbook";

    [Function("AddGuestBookEntry")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "app/guestbook")]
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

        var eventId = context.EventId;
        AddGuestBookEntryRequest? request;

        try
        {
            request = await JsonSerializer.DeserializeAsync<AddGuestBookEntryRequest>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }, ct);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Invalid guestbook payload for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_GUESTBOOK_PAYLOAD",
                "Invalid guestbook payload",
                "Request body must contain valid guestbook entry data."
            );
        }

        if (request is null ||
            string.IsNullOrWhiteSpace(request.AuthorName) ||
            (string.IsNullOrWhiteSpace(request.Message) &&
             string.IsNullOrWhiteSpace(request.MediaId) &&
             string.IsNullOrWhiteSpace(request.VideoMediaId)))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_GUESTBOOK_PAYLOAD",
                "Invalid guestbook payload",
                "Author name and message or media are required."
            );
        }

        var attachedMediaId = !string.IsNullOrWhiteSpace(request.MediaId)
            ? request.MediaId.Trim()
            : request.VideoMediaId?.Trim();
        var mediaKind = default(string);
        var mediaBlobName = default(string);
        var mediaUrl = default(string);
        var mediaThumbnailUrl = default(string);
        var mediaContentType = default(string);
        long? mediaSizeBytes = null;
        var videoMediaId = string.IsNullOrWhiteSpace(request.MediaId) ? request.VideoMediaId?.Trim() : null;
        var videoBlobName = default(string);
        var videoContentType = default(string);
        long? videoSizeBytes = null;

        if (!string.IsNullOrWhiteSpace(attachedMediaId))
        {
            var attachedMedia = await mediaService.GetMediaByIdAsync(eventId, attachedMediaId, ct);
            if (attachedMedia is null ||
                !(string.Equals(attachedMedia.Kind, "photo", StringComparison.Ordinal) ||
                  string.Equals(attachedMedia.Kind, "video", StringComparison.Ordinal)) ||
                !string.Equals(attachedMedia.SourceType, GuestBookSourceType, StringComparison.Ordinal))
            {
                return await ApiResponse.ProduceErrorResponse(
                    req,
                    HttpStatusCode.BadRequest,
                    "INVALID_GUESTBOOK_MEDIA",
                    "Invalid guestbook media",
                    "The selected media could not be attached to this guestbook entry."
                );
            }

            attachedMediaId = attachedMedia.Id;
            mediaKind = attachedMedia.Kind;
            mediaBlobName = attachedMedia.OriginalBlobName;
            mediaUrl = string.Equals(attachedMedia.Kind, "photo", StringComparison.Ordinal)
                ? attachedMedia.PreviewBlobUrl ?? attachedMedia.OriginalBlobUrl
                : null;
            mediaThumbnailUrl = string.Equals(attachedMedia.Kind, "photo", StringComparison.Ordinal)
                ? attachedMedia.ThumbnailBlobUrl ?? attachedMedia.PreviewBlobUrl
                : null;
            mediaContentType = attachedMedia.ContentType;
            mediaSizeBytes = attachedMedia.SizeBytes;

            if (string.Equals(attachedMedia.Kind, "video", StringComparison.Ordinal))
            {
                videoMediaId = attachedMedia.Id;
                videoBlobName = attachedMedia.OriginalBlobName;
                videoContentType = attachedMedia.ContentType;
                videoSizeBytes = attachedMedia.SizeBytes;
            }
        }

        var guestBookEntry = new GuestBookEntry
        {
            Id = Guid.NewGuid().ToString("N"),
            EventId = eventId,
            AuthorName = request.AuthorName.Trim(),
            Message = request.Message?.Trim() ?? string.Empty,
            MediaId = attachedMediaId,
            MediaKind = mediaKind,
            MediaBlobName = mediaBlobName,
            MediaUrl = mediaUrl,
            MediaThumbnailUrl = mediaThumbnailUrl,
            MediaContentType = mediaContentType,
            MediaSizeBytes = mediaSizeBytes,
            VideoMediaId = videoMediaId,
            VideoBlobName = videoBlobName,
            VideoContentType = videoContentType,
            VideoSizeBytes = videoSizeBytes,
            CreatedAt = DateTime.UtcNow
        };

        try
        {
            var createdEntry = await guestBookService.AddGuestBookEntryAsync(eventId, guestBookEntry, ct);
            var response = req.CreateResponse(HttpStatusCode.Created);
            await response.WriteAsJsonAsync(createdEntry, ct);
            return response;
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
}
