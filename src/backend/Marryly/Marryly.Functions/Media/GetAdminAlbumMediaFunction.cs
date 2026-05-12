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

public class GetAdminAlbumMediaFunction(
    ILogger<GetAdminAlbumMediaFunction> logger,
    IAuthService authService,
    IAlbumService albumService,
    IMediaService mediaService)
{
    private const int DefaultPage = 1;
    private const int DefaultPageSize = 12;

    [Function("GetAdminAlbumMedia")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/albums/{albumId}/media")]
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
                return await ApiResponse.ProduceErrorResponse(
                    req,
                    HttpStatusCode.NotFound,
                    "ALBUM_NOT_FOUND",
                    "Album not found",
                    "The requested album does not exist.");
            }

            var query = QueryHelpers.ParseQuery(req.Url.Query);
            var page = AuthHelpers.ParsePositiveInt(query, "page", DefaultPage);
            var pageSize = AuthHelpers.ParsePositiveInt(query, "pageSize", DefaultPageSize);
            var response = await mediaService.GetAdminAlbumMediaPageAsync(eventId, albumId, page, pageSize, ct);
            return await ApiResponse.ProduceSuccessResponse(req, response);
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "Albums or media container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "ALBUMS_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Albums storage container is not available.");
        }
        catch (CosmosException ex)
        {
            logger.LogError(ex, "Failed to fetch admin album media {AlbumId} from Cosmos DB for event: {EventId}", albumId, eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "ADMIN_ALBUM_MEDIA_QUERY_FAILED",
                "Album unavailable",
                "Admin album media could not be loaded right now.");
        }
    }
}
