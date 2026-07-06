using System.Net;
using System.Text.Json;
using Marryly.Application.Constants;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class CompleteMediaUploadFunction(
    ILogger<CompleteMediaUploadFunction> logger,
    IAuthService authService,
    IAlbumService albumService,
    IPhotoUploadService photoUploadService)
{
    [Function("CompleteMediaUpload")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "app/media/uploads/{mediaId}/complete")]
        HttpRequestData req,
        string mediaId,
        CancellationToken ct)
    {
        var authResponse = await AuthHelpers.ValidateUserAsync(req, authService);
        if (authResponse.Response is not null)
        {
            return authResponse.Response;
        }

        var eventId = authResponse.Context!.EventId;
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
            logger.LogWarning(ex, "Invalid media upload completion payload for event: {EventId}, media: {MediaId}", eventId, mediaId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_MEDIA_UPLOAD_COMPLETION_PAYLOAD",
                "Invalid media upload completion payload",
                "Request body must contain valid media upload completion data.");
        }

        if (request is null)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_MEDIA_UPLOAD_COMPLETION_PAYLOAD",
                "Invalid media upload completion payload",
                "Request body is required.");
        }

        try
        {
            var guestAlbum = await albumService.EnsureGuestAlbumAsync(eventId, ct);
            var savedItem = await photoUploadService.CompleteMediaUploadAsync(
                eventId,
                mediaId,
                guestAlbum.Id,
                AlbumConstants.GuestSourceType,
                request,
                ct);

            var response = req.CreateResponse(HttpStatusCode.Created);
            await response.WriteAsJsonAsync(savedItem, ct);
            return response;
        }
        catch (ApiErrorException ex)
        {
            logger.LogWarning("Guest media upload completion failed for event {EventId}, media {MediaId}: {Code}", eventId, mediaId, ex.Code);
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "Media container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "MEDIA_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Media storage container is not available.");
        }
    }
}
