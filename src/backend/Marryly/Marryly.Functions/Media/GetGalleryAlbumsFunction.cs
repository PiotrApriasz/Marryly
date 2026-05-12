using System.Net;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class GetGalleryAlbumsFunction(
    ILogger<GetGalleryAlbumsFunction> logger,
    IAuthService authService,
    IAlbumService albumService,
    IMediaService mediaService)
{
    [Function("GetGalleryAlbums")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "app/gallery/albums")]
        HttpRequestData req,
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
            var albums = await albumService.GetVisibleAlbumsAsync(eventId, ct);
            var insights = await mediaService.GetAlbumInsightsAsync(eventId, publicOnly: true, ct);

            var response = new GalleryAlbumsResponse
            {
                Items = albums.Select(album => MapGalleryAlbum(album, insights)).ToList()
            };

            return await ApiResponse.ProduceSuccessResponse(req, response);
        }
        catch (ApiErrorException ex)
        {
            logger.LogWarning("Failed to fetch gallery albums for event {EventId}: {Code}", eventId, ex.Code);
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
            logger.LogError(ex, "Failed to fetch gallery albums from Cosmos DB for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "ALBUMS_QUERY_FAILED",
                "Gallery unavailable",
                "Gallery albums could not be loaded right now.");
        }
    }

    internal static GalleryAlbumResponse MapGalleryAlbum(Album album, IReadOnlyDictionary<string, AlbumMediaInsight> insights)
    {
        insights.TryGetValue(album.Id, out var insight);

        return new GalleryAlbumResponse
        {
            Id = album.Id,
            Title = album.Title,
            Slug = album.Slug,
            Description = album.Description,
            CoverUrl = insight?.CoverUrl,
            ItemCount = insight?.ItemCount ?? 0
        };
    }
}
