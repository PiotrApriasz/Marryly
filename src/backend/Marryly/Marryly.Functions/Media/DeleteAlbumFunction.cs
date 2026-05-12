using System.Net;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class DeleteAlbumFunction(
    ILogger<DeleteAlbumFunction> logger,
    IAuthService authService,
    IAlbumService albumService)
{
    [Function("DeleteAlbum")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "panel/albums/{albumId}")]
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
            await albumService.DeleteAlbumAsync(eventId, albumId, ct);
            logger.LogInformation("Deleted album {AlbumId} for event {EventId}", albumId, eventId);
            return req.CreateResponse(HttpStatusCode.NoContent);
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "Albums container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "ALBUMS_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Albums storage container is not available.");
        }
    }
}
