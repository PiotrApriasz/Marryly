using System.Net;
using System.Text.Json;
using Azure;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class AlbumMediaSelectionFunctions(
    ILogger<AlbumMediaSelectionFunctions> logger,
    IAuthService authService,
    IAlbumService albumService,
    IMediaService mediaService)
{
    [Function("GetAdminAlbumMediaIds")]
    public Task<HttpResponseData> GetIds(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/albums/{albumId}/media/ids")]
        HttpRequestData req, string albumId, CancellationToken ct) =>
        WithAlbumAsync(req, albumId, async eventId =>
        {
            var ids = await mediaService.GetAlbumMediaIdsAsync(eventId, albumId, ct);
            return await ApiResponse.ProduceSuccessResponse(req, new AlbumMediaIdsResponse { MediaIds = ids });
        }, ct);

    [Function("DeleteSelectedAlbumMedia")]
    public Task<HttpResponseData> DeleteSelected(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/albums/{albumId}/media/delete")]
        HttpRequestData req, string albumId, CancellationToken ct) =>
        WithAlbumAsync(req, albumId, async eventId =>
        {
            var request = await JsonSerializer.DeserializeAsync<DeleteSelectedAlbumMediaRequest>(req.Body,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);
            if (request?.MediaIds is null)
            {
                throw new ApiErrorException(HttpStatusCode.BadRequest, "MEDIA_SELECTION_INVALID",
                    "Invalid media selection", "Selected media ids are required.");
            }

            var deletedCount = await mediaService.DeleteSelectedAlbumMediaAsync(eventId, albumId, request.MediaIds, ct);
            logger.LogInformation("Deleted {Count} selected media from album {AlbumId} for event {EventId}",
                deletedCount, albumId, eventId);
            return await ApiResponse.ProduceSuccessResponse(req, new DeleteSelectedAlbumMediaResponse { DeletedCount = deletedCount });
        }, ct);

    [Function("AddSelectedMediaToAlbum")]
    public Task<HttpResponseData> AddToAlbum(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/albums/{albumId}/media/add-to-album")]
        HttpRequestData req, string albumId, CancellationToken ct) =>
        WithAlbumAsync(req, albumId, async eventId =>
        {
            var request = await JsonSerializer.DeserializeAsync<AddSelectedAlbumMediaRequest>(req.Body,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);
            if (request?.MediaIds is null || string.IsNullOrWhiteSpace(request.TargetAlbumId))
            {
                throw new ApiErrorException(HttpStatusCode.BadRequest, "MEDIA_SELECTION_INVALID",
                    "Invalid media selection", "Selected media and a target album are required.");
            }
            if (request.TargetAlbumId == albumId)
            {
                throw new ApiErrorException(HttpStatusCode.BadRequest, "MEDIA_TARGET_ALBUM_INVALID",
                    "Invalid target album", "Choose a different album.");
            }
            if (await albumService.GetAlbumByIdAsync(eventId, request.TargetAlbumId, ct) is null)
            {
                throw new ApiErrorException(HttpStatusCode.NotFound, "ALBUM_NOT_FOUND",
                    "Album not found", "The target album does not exist.");
            }

            var count = await mediaService.AddSelectedMediaToAlbumAsync(eventId, albumId, request.TargetAlbumId, request.MediaIds, ct);
            logger.LogInformation("Added {Count} selected media from {SourceAlbum} to {TargetAlbum} for event {EventId}",
                count, albumId, request.TargetAlbumId, eventId);
            return await ApiResponse.ProduceSuccessResponse(req, new AlbumMediaMembershipResponse { ProcessedCount = count });
        }, ct);

    [Function("RemoveSelectedMediaFromAlbum")]
    public Task<HttpResponseData> RemoveFromAlbum(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/albums/{albumId}/media/remove")]
        HttpRequestData req, string albumId, CancellationToken ct) =>
        WithAlbumAsync(req, albumId, async eventId =>
        {
            var request = await JsonSerializer.DeserializeAsync<DeleteSelectedAlbumMediaRequest>(req.Body,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);
            if (request?.MediaIds is null)
            {
                throw new ApiErrorException(HttpStatusCode.BadRequest, "MEDIA_SELECTION_INVALID",
                    "Invalid media selection", "Selected media ids are required.");
            }
            var count = await mediaService.RemoveSelectedMediaFromAlbumAsync(eventId, albumId, request.MediaIds, ct);
            return await ApiResponse.ProduceSuccessResponse(req, new AlbumMediaMembershipResponse { ProcessedCount = count });
        }, ct);

    private async Task<HttpResponseData> WithAlbumAsync(HttpRequestData req, string albumId,
        Func<string, Task<HttpResponseData>> action, CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;
        try
        {
            if (await albumService.GetAlbumByIdAsync(eventId, albumId, ct) is null)
            {
                throw new ApiErrorException(HttpStatusCode.NotFound, "ALBUM_NOT_FOUND",
                    "Album not found", "The requested album does not exist.");
            }

            return await action(eventId);
        }
        catch (JsonException)
        {
            return await ApiResponse.ProduceErrorResponse(req, HttpStatusCode.BadRequest,
                "MEDIA_SELECTION_INVALID", "Invalid media selection", "Request body must contain a mediaIds array.");
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (Exception ex) when (ex is CosmosException or RequestFailedException)
        {
            logger.LogError(ex, "Failed to manage selected media in album {AlbumId} for event {EventId}", albumId, eventId);
            return await ApiResponse.ProduceErrorResponse(req, HttpStatusCode.InternalServerError,
                "ALBUM_MEDIA_SELECTION_FAILED", "Media selection failed",
                "Reload the album and retry. Some selected media may already have been processed.");
        }
    }
}
