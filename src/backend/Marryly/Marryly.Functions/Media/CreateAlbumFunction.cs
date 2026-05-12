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

public class CreateAlbumFunction(
    ILogger<CreateAlbumFunction> logger,
    IAuthService authService,
    IAlbumService albumService)
{
    [Function("CreateAlbum")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/albums")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;
        CreateAlbumRequest? request;

        try
        {
            request = await JsonSerializer.DeserializeAsync<CreateAlbumRequest>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }, ct);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Invalid album payload for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_ALBUM_PAYLOAD",
                "Invalid album payload",
                "Request body must contain valid album data.");
        }

        if (request is null)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_ALBUM_PAYLOAD",
                "Invalid album payload",
                "Request body is required.");
        }

        try
        {
            var album = await albumService.CreateAlbumAsync(eventId, request, ct);
            return await ApiResponse.ProduceSuccessResponse(req, album);
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
