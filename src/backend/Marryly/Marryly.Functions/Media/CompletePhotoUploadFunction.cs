using System.Net;
using System.Text.Json;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class CompletePhotoUploadFunction(
    ILogger<CompletePhotoUploadFunction> logger,
    IAuthService authService,
    IMediaService mediaService,
    IPhotoDerivativeService photoDerivativeService)
{
    [Function("CompletePhotoUpload")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "app/photos/uploads/{photoId}/complete")]
        HttpRequestData req,
        string photoId,
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
        CompletePhotoUploadRequest? request;

        try
        {
            request = await JsonSerializer.DeserializeAsync<CompletePhotoUploadRequest>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }, ct);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Invalid photo upload completion payload for event: {EventId}, photo: {PhotoId}", eventId, photoId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_UPLOAD_COMPLETION_PAYLOAD",
                "Invalid photo upload completion payload",
                "Request body must contain valid photo upload completion data."
            );
        }

        if (request is null ||
            string.IsNullOrWhiteSpace(photoId) ||
            string.IsNullOrWhiteSpace(request.BlobName) ||
            string.IsNullOrWhiteSpace(request.BlobUrl) ||
            string.IsNullOrWhiteSpace(request.ContentType) ||
            request.SizeBytes <= 0)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_UPLOAD_COMPLETION_PAYLOAD",
                "Invalid photo upload completion payload",
                "Photo upload completion requires photo id, blob name, blob url, content type and size."
            );
        }

        var mediaItem = new MediaItem
        {
            Id = photoId,
            EventId = eventId,
            Kind = "photo",
            Status = "processing",
            OriginalBlobName = request.BlobName.Trim(),
            OriginalBlobUrl = request.BlobUrl.Trim(),
            ContentType = request.ContentType.Trim().ToLowerInvariant(),
            SizeBytes = request.SizeBytes,
            UploadedAt = DateTime.UtcNow,
            Approved = true
        };

        try
        {
            var savedItem = await mediaService.UpsertPhotoAsync(eventId, mediaItem, ct);
            try
            {
                var derivativeResult = await photoDerivativeService.GenerateAsync(savedItem, ct);

                savedItem.Status = "ready";
                savedItem.ThumbnailBlobName = derivativeResult.ThumbnailBlobName;
                savedItem.ThumbnailBlobUrl = derivativeResult.ThumbnailBlobUrl;
                savedItem.PreviewBlobName = derivativeResult.PreviewBlobName;
                savedItem.PreviewBlobUrl = derivativeResult.PreviewBlobUrl;
                savedItem.Width = derivativeResult.Width;
                savedItem.Height = derivativeResult.Height;
                savedItem.ProcessedAt = derivativeResult.ProcessedAt;
                savedItem.ProcessingError = null;

                var readyItem = await mediaService.UpsertPhotoAsync(eventId, savedItem, ct);
                var response = req.CreateResponse(HttpStatusCode.Created);
                await response.WriteAsJsonAsync(readyItem, ct);
                return response;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to generate photo derivatives for event: {EventId}, photo: {PhotoId}", eventId, photoId);

                savedItem.Status = "failed";
                savedItem.ProcessingError = TruncateErrorMessage(ex.Message);
                savedItem.ProcessedAt = DateTime.UtcNow;
                await mediaService.UpsertPhotoAsync(eventId, savedItem, ct);

                return await ApiResponse.ProduceErrorResponse(
                    req,
                    HttpStatusCode.InternalServerError,
                    "PHOTO_PROCESSING_FAILED",
                    "Photo processing failed",
                    "The original photo was uploaded, but thumbnail generation failed."
                );
            }
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

    private static string TruncateErrorMessage(string message)
    {
        return message.Length <= 500 ? message : message[..500];
    }
}
