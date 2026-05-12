using System.Net;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class GetGalleryAlbumMediaFunction(
    ILogger<GetGalleryAlbumMediaFunction> logger,
    IAuthService authService,
    IAlbumService albumService,
    IMediaService mediaService)
{
    private const int DefaultLimit = 50;

    [Function("GetGalleryAlbumMedia")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "app/gallery/albums/{slug}/media")]
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

            var query = QueryHelpers.ParseQuery(req.Url.Query);
            var limit = AuthHelpers.ParsePositiveInt(query, "limit", DefaultLimit);
            var continuationToken = query.TryGetValue("continuationToken", out var tokenValue)
                ? tokenValue.ToString()
                : null;

            var response = await mediaService.GetAlbumMediaPageAsync(eventId, album.Id, limit, continuationToken, ct);
            return await ApiResponse.ProduceSuccessResponse(req, response);
        }
        catch (ApiErrorException ex)
        {
            logger.LogWarning("Failed to fetch gallery album media {Slug} for event {EventId}: {Code}", slug, eventId, ex.Code);
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
            logger.LogError(ex, "Failed to fetch gallery album media {Slug} from Cosmos DB for event: {EventId}", slug, eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "ALBUM_MEDIA_QUERY_FAILED",
                "Gallery unavailable",
                "Album media could not be loaded right now.");
        }
    }
}
