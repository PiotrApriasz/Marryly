using System.Net;
using System.Text.Json;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class CreateAdminAlbumPhotoUploadFunction(
    ILogger<CreateAdminAlbumPhotoUploadFunction> logger,
    IAuthService authService,
    IAlbumService albumService,
    IPhotoUploadService photoUploadService)
{
    [Function("CreateAdminAlbumPhotoUpload")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/albums/{albumId}/photos/uploads")]
        HttpRequestData req,
        string albumId,
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

        CreatePhotoUploadRequest? request;

        try
        {
            request = await JsonSerializer.DeserializeAsync<CreatePhotoUploadRequest>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }, ct);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Invalid admin photo upload payload for event: {EventId}, album: {AlbumId}", eventId, albumId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_UPLOAD_PAYLOAD",
                "Invalid photo upload payload",
                "Request body must contain valid photo upload data.");
        }

        if (request is null)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_UPLOAD_PAYLOAD",
                "Invalid photo upload payload",
                "Request body is required.");
        }

        try
        {
            var target = await photoUploadService.CreatePhotoUploadAsync(eventId, request, ct);
            return await ApiResponse.ProduceSuccessResponse(req, target);
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
