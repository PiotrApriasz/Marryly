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

public class GetAdminAlbumsFunction(
    ILogger<GetAdminAlbumsFunction> logger,
    IAuthService authService,
    IAlbumService albumService,
    IMediaService mediaService)
{
    [Function("GetAdminAlbums")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/albums")]
        HttpRequestData req,
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
            var albums = await albumService.GetAdminAlbumsAsync(eventId, ct);
            var insights = await mediaService.GetAlbumInsightsAsync(eventId, publicOnly: false, ct);
            var response = new AdminAlbumsResponse
            {
                Items = albums.Select(album =>
                {
                    insights.TryGetValue(album.Id, out var insight);
                    return new AdminAlbumResponse
                    {
                        Id = album.Id,
                        Title = album.Title,
                        Slug = album.Slug,
                        Description = album.Description,
                        IsSystem = album.IsSystem,
                        IsVisible = album.IsVisible,
                        SortOrder = album.SortOrder,
                        CoverUrl = insight?.CoverUrl,
                        ItemCount = insight?.ItemCount ?? 0
                    };
                }).ToList()
            };

            return await ApiResponse.ProduceSuccessResponse(req, response);
        }
        catch (ApiErrorException ex)
        {
            logger.LogWarning("Failed to fetch admin albums for event {EventId}: {Code}", eventId, ex.Code);
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
            logger.LogError(ex, "Failed to fetch admin albums from Cosmos DB for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "ADMIN_ALBUMS_QUERY_FAILED",
                "Albums unavailable",
                "Admin albums could not be loaded right now.");
        }
    }
}
