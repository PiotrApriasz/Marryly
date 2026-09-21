using System.Net;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class UploadVideoThumbnailFunction(
    ILogger<UploadVideoThumbnailFunction> logger,
    IAuthService authService,
    IAlbumService albumService,
    IMediaService mediaService,
    IVideoThumbnailService videoThumbnailService)
{
    private const long MaxThumbnailSizeBytes = 2 * 1024 * 1024;

    [Function("UploadGuestVideoThumbnail")]
    public async Task<HttpResponseData> UploadGuest(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "app/media/{mediaId}/thumbnail")]
        HttpRequestData req,
        string mediaId,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateUserAsync(req, authService);
        if (auth.Response is not null || auth.Context is null)
        {
            return auth.Response!;
        }

        var guestAlbum = await albumService.EnsureGuestAlbumAsync(auth.Context.EventId, ct);
        return await StoreAsync(req, auth.Context.EventId, mediaId, guestAlbum.Id, ct);
    }

    [Function("UploadAdminVideoThumbnail")]
    public async Task<HttpResponseData> UploadAdmin(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/media/{mediaId}/thumbnail")]
        HttpRequestData req,
        string mediaId,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null || auth.Context is null)
        {
            return auth.Response!;
        }

        return await StoreAsync(req, auth.Context.EventId, mediaId, null, ct);
    }

    private async Task<HttpResponseData> StoreAsync(
        HttpRequestData req,
        string eventId,
        string mediaId,
        string? requiredAlbumId,
        CancellationToken ct)
    {
        if (!req.Headers.TryGetValues("Content-Type", out var contentTypes) ||
            !contentTypes.Any(value => value.StartsWith("image/jpeg", StringComparison.OrdinalIgnoreCase)))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.UnsupportedMediaType,
                "INVALID_VIDEO_THUMBNAIL_TYPE",
                "Invalid video thumbnail",
                "Video thumbnail must be a JPEG image.");
        }

        var mediaItem = await mediaService.GetMediaByIdAsync(eventId, mediaId, ct);
        if (mediaItem is null || !string.Equals(mediaItem.Kind, "video", StringComparison.Ordinal) ||
            (requiredAlbumId is not null && !string.Equals(mediaItem.AlbumId, requiredAlbumId, StringComparison.Ordinal)))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.NotFound,
                "VIDEO_NOT_FOUND",
                "Video not found",
                "The requested video is not available for thumbnail upload.");
        }

        try
        {
            await using var thumbnail = await ReadThumbnailAsync(req.Body, ct);
            var result = await videoThumbnailService.StoreAsync(mediaItem, thumbnail, ct);
            mediaItem.ThumbnailBlobName = result.ThumbnailBlobName;
            mediaItem.ThumbnailBlobUrl = result.ThumbnailBlobUrl;
            mediaItem.Width = result.Width;
            mediaItem.Height = result.Height;
            mediaItem.Status = "ready";
            mediaItem.ProcessedAt = result.ProcessedAt;
            mediaItem.ProcessingError = null;
            var savedItem = await mediaService.UpsertMediaAsync(eventId, mediaItem, ct);

            return await ApiResponse.ProduceSuccessResponse(req, savedItem);
        }
        catch (InvalidOperationException ex)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_VIDEO_THUMBNAIL",
                "Invalid video thumbnail",
                ex.Message);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to store thumbnail for video {MediaId} in event {EventId}", mediaId, eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "VIDEO_THUMBNAIL_UPLOAD_FAILED",
                "Video thumbnail upload failed",
                "The video was uploaded, but its thumbnail could not be saved.");
        }
    }

    private static async Task<MemoryStream> ReadThumbnailAsync(Stream body, CancellationToken ct)
    {
        var result = new MemoryStream();
        var buffer = new byte[81920];
        long totalRead = 0;

        while (true)
        {
            var read = await body.ReadAsync(buffer, ct);
            if (read == 0)
            {
                break;
            }

            totalRead += read;
            if (totalRead > MaxThumbnailSizeBytes)
            {
                await result.DisposeAsync();
                throw new InvalidOperationException("Video thumbnail must be smaller than 2 MB.");
            }

            await result.WriteAsync(buffer.AsMemory(0, read), ct);
        }

        if (result.Length == 0)
        {
            await result.DisposeAsync();
            throw new InvalidOperationException("Video thumbnail is empty.");
        }

        result.Position = 0;
        return result;
    }
}
