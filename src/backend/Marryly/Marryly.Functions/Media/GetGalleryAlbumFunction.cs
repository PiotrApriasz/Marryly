using System.Net;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class GetGalleryAlbumFunction(
    ILogger<GetGalleryAlbumFunction> logger,
    IAuthService authService,
    IAlbumService albumService,
    IMediaService mediaService)
{
    [Function("GetGalleryAlbum")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "app/gallery/albums/{slug}")]
        HttpRequestData req,
        string slug,
        CancellationToken ct)
    {
        var authResponse = await AuthHelpers.ValidateUserAsync(req, authService);
        if (authResponse.Response is not null)
        {
            return authResponse.Response;
        }

        var eventId = authResponse.Context!.EventId;

        try
        {
            var album = await albumService.GetAlbumBySlugAsync(eventId, slug, ct);
            if (album is null || !album.IsVisible)
            {
                return await ApiResponse.ProduceErrorResponse(
                    req,
                    HttpStatusCode.NotFound,
                    "ALBUM_NOT_FOUND",
                    "Album not found",
                    "The requested album does not exist.");
            }

            var insights = await mediaService.GetAlbumInsightsAsync(eventId, publicOnly: true, ct);
            return await ApiResponse.ProduceSuccessResponse(req, GetGalleryAlbumsFunction.MapGalleryAlbum(album, insights));
        }
        catch (ApiErrorException ex)
        {
            logger.LogWarning("Failed to fetch gallery album {Slug} for event {EventId}: {Code}", slug, eventId, ex.Code);
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
        catch (CosmosException ex)
        {
            logger.LogError(ex, "Failed to fetch gallery album {Slug} from Cosmos DB for event: {EventId}", slug, eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "ALBUM_QUERY_FAILED",
                "Gallery unavailable",
                "The requested album could not be loaded right now.");
        }
    }
}
