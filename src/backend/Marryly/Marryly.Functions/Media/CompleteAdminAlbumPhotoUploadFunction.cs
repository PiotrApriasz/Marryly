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

public class CompleteAdminAlbumPhotoUploadFunction(
    ILogger<CompleteAdminAlbumPhotoUploadFunction> logger,
    IAuthService authService,
    IAlbumService albumService,
    IPhotoUploadService photoUploadService)
{
    [Function("CompleteAdminAlbumPhotoUpload")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/albums/{albumId}/photos/uploads/{photoId}/complete")]
        HttpRequestData req,
        string albumId,
        string photoId,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;
        var album = await albumService.GetAlbumByIdAsync(eventId, albumId, ct);
        if (album is null)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.NotFound,
                "ALBUM_NOT_FOUND",
                "Album not found",
                "The requested album does not exist.");
        }

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
            logger.LogWarning(ex, "Invalid admin photo completion payload for event: {EventId}, album: {AlbumId}, photo: {PhotoId}", eventId, albumId, photoId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_UPLOAD_COMPLETION_PAYLOAD",
                "Invalid photo upload completion payload",
                "Request body must contain valid photo upload completion data.");
        }

        if (request is null)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_UPLOAD_COMPLETION_PAYLOAD",
                "Invalid photo upload completion payload",
                "Request body is required.");
        }

        try
        {
            var savedItem = await photoUploadService.CompletePhotoUploadAsync(
                eventId,
                photoId,
                albumId,
                AlbumConstants.AdminSourceType,
                request,
                ct);

            var response = req.CreateResponse(HttpStatusCode.Created);
            await response.WriteAsJsonAsync(savedItem, ct);
            return response;
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "Album or media container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "ALBUMS_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Albums storage container is not available.");
        }
    }
}
