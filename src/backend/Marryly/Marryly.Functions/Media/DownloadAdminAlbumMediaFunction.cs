using System.IO.Compression;
using System.Net;
using System.Text.Json;
using Azure;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Functions.Result;
using Marryly.Infrastructure.Services;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class DownloadAdminAlbumMediaFunction(
    ILogger<DownloadAdminAlbumMediaFunction> logger,
    IAuthService authService, IAlbumService albumService, IMediaService mediaService, IMediaStorageService mediaStorageService)
{
    [Function("DownloadAdminAlbumMedia")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/albums/{albumId}/media/download")]
        HttpRequestData req, string albumId, CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null) return auth.Response;
        var eventId = auth.Context!.EventId;
        try
        {
            var album = await albumService.GetAlbumByIdAsync(eventId, albumId, ct);
            if (album is null)
            {
                throw new ApiErrorException(HttpStatusCode.NotFound, "ALBUM_NOT_FOUND", "Album not found", "The requested album does not exist.");
            }
            var request = await JsonSerializer.DeserializeAsync<DownloadAdminAlbumMediaRequest>(req.Body,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);
            var media = await mediaService.GetDownloadableAdminAlbumMediaAsync(eventId, albumId, request?.MediaIds ?? [], ct);
            var slug = string.Concat((album.Slug ?? string.Empty).Select(character =>
                character is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9' or '-' or '_' ? character : '-')).Trim('-');
            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/zip");
            response.Headers.Add("Content-Disposition", $"attachment; filename=\"{(slug.Length > 0 ? slug : "album")}-wybrane-media.zip\"");
            // Photos and video are already compressed; store their original bytes directly.
            await MediaZipArchive.WriteAsync(response.Body, media, mediaStorageService, ct, CompressionLevel.NoCompression);
            return response;
        }
        catch (JsonException)
        {
            return await ApiResponse.ProduceErrorResponse(req, HttpStatusCode.BadRequest,
                "DOWNLOAD_MEDIA_INVALID", "Invalid media selection", "Request body must contain a mediaIds array.");
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (Exception ex) when (ex is CosmosException or RequestFailedException or IOException)
        {
            logger.LogError(ex, "Failed to download selected media from album {AlbumId} for event {EventId}", albumId, eventId);
            return await ApiResponse.ProduceErrorResponse(req, HttpStatusCode.InternalServerError,
                "MEDIA_DOWNLOAD_FAILED", "Download failed", "The archive could not be prepared. Please retry.");
        }
    }
}
