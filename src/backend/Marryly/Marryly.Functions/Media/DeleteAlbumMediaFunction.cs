using System.Net;
using Azure;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class DeleteAlbumMediaFunction(
    ILogger<DeleteAlbumMediaFunction> logger,
    IAuthService authService,
    IAlbumService albumService,
    IMediaService mediaService)
{
    [Function("DeleteAlbumMedia")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "panel/albums/{albumId}/media")]
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

        try
        {
            var album = await albumService.GetAlbumByIdAsync(eventId, albumId, ct);
            if (album is null)
            {
                return await ApiResponse.ProduceErrorResponse(req, HttpStatusCode.NotFound,
                    "ALBUM_NOT_FOUND", "Album not found", "The requested album does not exist.");
            }

            var response = await mediaService.DeleteAlbumMediaBatchAsync(eventId, albumId, ct);
            logger.LogInformation("Deleted {Count} media from album {AlbumId} for event {EventId}",
                response.DeletedCount, albumId, eventId);
            return await ApiResponse.ProduceSuccessResponse(req, response);
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (Exception ex) when (ex is CosmosException or RequestFailedException)
        {
            logger.LogError(ex, "Failed to delete media from album {AlbumId} for event {EventId}", albumId, eventId);
            return await ApiResponse.ProduceErrorResponse(req, HttpStatusCode.InternalServerError,
                "ALBUM_MEDIA_DELETE_FAILED", "Album media deletion failed",
                "Some media may have been deleted. Reload the album and retry to delete the remaining media.");
        }
    }
}
