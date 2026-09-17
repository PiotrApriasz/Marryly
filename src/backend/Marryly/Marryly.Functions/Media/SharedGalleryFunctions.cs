using System.IO.Compression;
using System.Net;
using System.Text.Json;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Functions.Result;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class SharedGalleryFunctions(
    ILogger<SharedGalleryFunctions> logger,
    IConfiguration configuration,
    IAlbumService albumService,
    IMediaService mediaService,
    IMediaStorageService mediaStorageService)
{
    private const int DefaultLimit = 50;

    [Function("GetSharedGalleryAlbums")]
    public async Task<HttpResponseData> GetAlbums(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "app/gallery/shared")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var access = await GetAccessAsync(req);
        if (access.Response is not null)
        {
            return access.Response;
        }

        try
        {
            var albums = await albumService.GetLinkAccessibleAlbumsAsync(access.EventId!, access.ShareCodes!, ct);
            var insights = await mediaService.GetAlbumInsightsAsync(access.EventId!, publicOnly: true, ct);
            return await ApiResponse.ProduceSuccessResponse(req, new GalleryAlbumsResponse
            {
                Items = albums.Select(album => MapSharedGalleryAlbum(album, insights)).ToList()
            });
        }
        catch (CosmosException ex)
        {
            logger.LogError(ex, "Failed to fetch shared gallery albums.");
            return await ProduceStorageError(req);
        }
    }

    [Function("GetSharedGalleryAlbum")]
    public async Task<HttpResponseData> GetAlbum(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "app/gallery/shared/{shareCode}")]
        HttpRequestData req,
        string shareCode,
        CancellationToken ct)
    {
        var access = await GetAccessAsync(req);
        if (access.Response is not null)
        {
            return access.Response;
        }

        var album = await GetRequestedAlbumAsync(req, access.EventId!, access.ShareCodes!, shareCode, ct);
        if (album is null)
        {
            return await ProduceAlbumNotFound(req);
        }

        try
        {
            var insights = await mediaService.GetAlbumInsightsAsync(access.EventId!, publicOnly: true, ct);
            var response = MapSharedGalleryAlbum(album, insights);
            response.HeroUrl = await mediaService.GetRandomAlbumPhotoUrlAsync(access.EventId!, album.Id, ct);
            return await ApiResponse.ProduceSuccessResponse(req, response);
        }
        catch (CosmosException ex)
        {
            logger.LogError(ex, "Failed to fetch shared gallery album {ShareCode}.", shareCode);
            return await ProduceStorageError(req);
        }
    }

    [Function("DownloadSharedGalleryAlbumPhotos")]
    public async Task<HttpResponseData> DownloadPhotos(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "app/gallery/shared/{shareCode}/download")]
        HttpRequestData req,
        string shareCode,
        CancellationToken ct)
    {
        var access = await GetAccessAsync(req);
        if (access.Response is not null)
        {
            return access.Response;
        }

        var album = await GetRequestedAlbumAsync(req, access.EventId!, access.ShareCodes!, shareCode, ct);
        if (album is null)
        {
            return await ProduceAlbumNotFound(req);
        }

        IReadOnlyCollection<string>? requestedMediaIds = null;
        if (string.Equals(req.Method, "POST", StringComparison.OrdinalIgnoreCase))
        {
            DownloadSharedGalleryPhotosRequest? request;
            try
            {
                request = await JsonSerializer.DeserializeAsync<DownloadSharedGalleryPhotosRequest>(req.Body, cancellationToken: ct);
            }
            catch (JsonException)
            {
                return await ApiResponse.ProduceErrorResponse(
                    req,
                    HttpStatusCode.BadRequest,
                    "DOWNLOAD_MEDIA_INVALID",
                    "Invalid media selection",
                    "The selected photos could not be downloaded.");
            }

            var normalizedMediaIds = (request?.MediaIds ?? [])
                .Select(mediaId => mediaId?.Trim() ?? string.Empty)
                .Where(mediaId => mediaId.Length > 0)
                .Distinct(StringComparer.Ordinal)
                .ToArray() ?? [];

            if (normalizedMediaIds.Length == 0)
            {
                return await ApiResponse.ProduceErrorResponse(
                    req,
                    HttpStatusCode.BadRequest,
                    "DOWNLOAD_MEDIA_REQUIRED",
                    "No photos selected",
                    "Select at least one photo to download.");
            }

            requestedMediaIds = normalizedMediaIds;
        }

        try
        {
            var photos = await mediaService.GetDownloadableAlbumPhotosAsync(
                access.EventId!,
                album.Id,
                requestedMediaIds,
                ct);

            if (photos.Count == 0)
            {
                return await ProduceNoDownloadablePhotos(req);
            }

            if (requestedMediaIds is not null && photos.Count != requestedMediaIds.Count)
            {
                return await ApiResponse.ProduceErrorResponse(
                    req,
                    HttpStatusCode.BadRequest,
                    "DOWNLOAD_MEDIA_INVALID",
                    "Invalid media selection",
                    "The selected photos could not be downloaded.");
            }

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/zip");
            response.Headers.Add(
                "Content-Disposition",
                $"attachment; filename=\"{BuildZipFileName(album, requestedMediaIds is not null)}\"");

            using (var archive = new ZipArchive(response.Body, ZipArchiveMode.Create, leaveOpen: true))
            {
                for (var index = 0; index < photos.Count; index += 1)
                {
                    var photo = photos[index];
                    var entry = archive.CreateEntry(BuildZipEntryName(photo, index));
                    await using var source = await mediaStorageService.OpenOriginalReadAsync(photo.OriginalBlobName, ct);
                    await using var destination = entry.Open();
                    await source.CopyToAsync(destination, ct);
                }
            }

            return response;
        }
        catch (CosmosException ex)
        {
            logger.LogError(ex, "Failed to prepare shared gallery download for {ShareCode}.", shareCode);
            return await ProduceStorageError(req);
        }
    }

    [Function("GetSharedGalleryAlbumMedia")]
    public async Task<HttpResponseData> GetAlbumMedia(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "app/gallery/shared/{shareCode}/media")]
        HttpRequestData req,
        string shareCode,
        CancellationToken ct)
    {
        var access = await GetAccessAsync(req);
        if (access.Response is not null)
        {
            return access.Response;
        }

        var album = await GetRequestedAlbumAsync(req, access.EventId!, access.ShareCodes!, shareCode, ct);
        if (album is null)
        {
            return await ProduceAlbumNotFound(req);
        }

        try
        {
            var query = QueryHelpers.ParseQuery(req.Url.Query);
            var limit = AuthHelpers.ParsePositiveInt(query, "limit", DefaultLimit);
            var continuationToken = query.TryGetValue("continuationToken", out var token) ? token.ToString() : null;
            var response = await mediaService.GetAlbumMediaPageAsync(access.EventId!, album.Id, limit, continuationToken, ct);
            return await ApiResponse.ProduceSuccessResponse(req, response);
        }
        catch (CosmosException ex)
        {
            logger.LogError(ex, "Failed to fetch shared gallery media for {ShareCode}.", shareCode);
            return await ProduceStorageError(req);
        }
    }

    private async Task<(HttpResponseData? Response, string? EventId, IReadOnlyList<string>? ShareCodes)> GetAccessAsync(HttpRequestData req)
    {
        var query = QueryHelpers.ParseQuery(req.Url.Query);
        if (!query.TryGetValue("view", out var view) || !SharedGalleryAccess.TryParse(view.ToString(), out var shareCodes))
        {
            return (await ApiResponse.ProduceErrorResponse(req, HttpStatusCode.BadRequest, "INVALID_SHARE_VIEW", "Invalid shared gallery link", "The gallery link is invalid."), null, null);
        }

        var eventId = configuration["EVENT_ID"]?.Trim();
        if (string.IsNullOrWhiteSpace(eventId))
        {
            logger.LogError("Shared gallery cannot be loaded because EVENT_ID is not configured.");
            return (await ApiResponse.ProduceErrorResponse(req, HttpStatusCode.InternalServerError, "AUTH_CONFIG_INVALID", "Configuration error", "Gallery configuration is missing."), null, null);
        }

        return (null, eventId, shareCodes);
    }

    private async Task<Album?> GetRequestedAlbumAsync(
        HttpRequestData req,
        string eventId,
        IReadOnlyList<string> shareCodes,
        string shareCode,
        CancellationToken ct)
    {
        if (!SharedGalleryAccess.IsValidShareCode(shareCode) || !shareCodes.Contains(shareCode, StringComparer.Ordinal))
        {
            return null;
        }

        return (await albumService.GetLinkAccessibleAlbumsAsync(eventId, [shareCode], ct)).SingleOrDefault();
    }

    private static Task<HttpResponseData> ProduceAlbumNotFound(HttpRequestData req) =>
        ApiResponse.ProduceErrorResponse(req, HttpStatusCode.NotFound, "ALBUM_NOT_FOUND", "Album not found", "The requested album does not exist.");

    private static Task<HttpResponseData> ProduceStorageError(HttpRequestData req) =>
        ApiResponse.ProduceErrorResponse(req, HttpStatusCode.InternalServerError, "ALBUMS_QUERY_FAILED", "Gallery unavailable", "Gallery could not be loaded right now.");

    private static Task<HttpResponseData> ProduceNoDownloadablePhotos(HttpRequestData req) =>
        ApiResponse.ProduceErrorResponse(req, HttpStatusCode.NotFound, "DOWNLOAD_MEDIA_NOT_FOUND", "No photos available", "This album has no downloadable photos.");

    private static string BuildZipFileName(Album album, bool selectedOnly)
    {
        var safeSlug = string.Concat((album.Slug ?? string.Empty).Select(character =>
            IsAsciiLetterOrDigit(character) || character is '-' or '_' ? character : '-'))
            .Trim('-');
        var suffix = selectedOnly ? "wybrane-zdjecia" : "zdjecia";
        return $"{(string.IsNullOrWhiteSpace(safeSlug) ? "album" : safeSlug)}-{suffix}.zip";
    }

    private static bool IsAsciiLetterOrDigit(char character) =>
        character is >= 'a' and <= 'z' or >= 'A' and <= 'Z' or >= '0' and <= '9';

    private static string BuildZipEntryName(MediaItem photo, int index)
    {
        var originalName = (photo.OriginalBlobName ?? string.Empty).Replace('\\', '/');
        var fileName = Path.GetFileName(originalName);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            fileName = $"{photo.Id}.jpg";
        }

        var safeFileName = string.Concat(fileName.Select(character =>
            char.IsLetterOrDigit(character) || character is '.' or '-' or '_' ? character : '-'))
            .Trim('.');
        if (string.IsNullOrWhiteSpace(safeFileName))
        {
            safeFileName = $"{photo.Id}.jpg";
        }

        return $"{index + 1:D4}-{safeFileName}";
    }

    private static GalleryAlbumResponse MapSharedGalleryAlbum(Album album, IReadOnlyDictionary<string, AlbumMediaInsight> insights)
    {
        var response = GetGalleryAlbumsFunction.MapGalleryAlbum(album, insights);
        response.ShareCode = album.ShareCode;
        return response;
    }
}
