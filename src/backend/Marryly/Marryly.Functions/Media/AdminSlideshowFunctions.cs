using System.Globalization;
using System.Net;
using System.Text.Json;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Slideshow;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class AdminSlideshowFunctions(
    ILogger<AdminSlideshowFunctions> logger,
    IAuthService authService,
    ISlideshowService slideshowService)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Function("GetAdminSlideshowSettings")]
    public async Task<HttpResponseData> GetSettings(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/slideshow")]
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
            var settings = await slideshowService.GetSettingsAsync(eventId, ct);
            return await ApiResponse.ProduceSuccessResponse(req, MapSettings(settings));
        }
        catch (ApiErrorException ex)
        {
            logger.LogWarning("Failed to fetch slideshow settings for event {EventId}: {Code}", eventId, ex.Code);
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex)
        {
            logger.LogError(ex, "Failed to fetch slideshow settings from Cosmos DB for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "SLIDESHOW_SETTINGS_UNAVAILABLE",
                "Slideshow unavailable",
                "Slideshow settings could not be loaded right now.");
        }
    }

    [Function("SaveAdminSlideshowSettings")]
    public async Task<HttpResponseData> SaveSettings(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "panel/slideshow")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;
        var request = await ReadPayloadAsync(req, ct);
        if (request.Response is not null)
        {
            return request.Response;
        }

        try
        {
            var settings = await slideshowService.SaveSettingsAsync(eventId, request.Value!, ct);
            return await ApiResponse.ProduceSuccessResponse(req, MapSettings(settings));
        }
        catch (ApiErrorException ex)
        {
            logger.LogWarning("Failed to save slideshow settings for event {EventId}: {Code}", eventId, ex.Code);
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex)
        {
            logger.LogError(ex, "Failed to save slideshow settings to Cosmos DB for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "SLIDESHOW_SETTINGS_SAVE_FAILED",
                "Slideshow unavailable",
                "Slideshow settings could not be saved right now.");
        }
    }

    [Function("GetAdminSlideshowPhotos")]
    public async Task<HttpResponseData> GetPhotos(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/slideshow/photos")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;
        var afterUploadedAt = ParseAfterUploadedAt(req);

        try
        {
            var photos = await slideshowService.GetPhotosAsync(eventId, afterUploadedAt, ct);
            return await ApiResponse.ProduceSuccessResponse(req, photos);
        }
        catch (ApiErrorException ex)
        {
            logger.LogWarning("Failed to fetch slideshow photos for event {EventId}: {Code}", eventId, ex.Code);
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex)
        {
            logger.LogError(ex, "Failed to fetch slideshow photos from Cosmos DB for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "SLIDESHOW_PHOTOS_UNAVAILABLE",
                "Slideshow unavailable",
                "Slideshow photos could not be loaded right now.");
        }
    }

    private async Task<(HttpResponseData? Response, UpdateSlideshowSettingsRequest? Value)> ReadPayloadAsync(
        HttpRequestData req,
        CancellationToken ct)
    {
        try
        {
            var value = await JsonSerializer.DeserializeAsync<UpdateSlideshowSettingsRequest>(req.Body, JsonOptions, ct);
            if (value is not null)
            {
                return (null, value);
            }
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Invalid slideshow settings payload.");
        }

        var response = await ApiResponse.ProduceErrorResponse(
            req,
            HttpStatusCode.BadRequest,
            "INVALID_SLIDESHOW_PAYLOAD",
            "Invalid slideshow payload",
            "Request body must contain valid slideshow settings.");
        return (response, null);
    }

    private static DateTime? ParseAfterUploadedAt(HttpRequestData req)
    {
        var rawQuery = req.Url.Query;
        if (string.IsNullOrWhiteSpace(rawQuery))
        {
            return null;
        }

        var rawValue = rawQuery.TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(part => part.Split('=', 2))
            .FirstOrDefault(part => string.Equals(part[0], "afterUploadedAt", StringComparison.OrdinalIgnoreCase))?
            .ElementAtOrDefault(1);

        if (string.IsNullOrWhiteSpace(rawValue))
        {
            return null;
        }

        return DateTime.TryParse(
            Uri.UnescapeDataString(rawValue),
            CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal,
            out var parsedValue)
            ? parsedValue
            : null;
    }

    private static AdminSlideshowSettingsResponse MapSettings(SlideshowSettings settings)
    {
        return new AdminSlideshowSettingsResponse
        {
            AlbumIds = settings.AlbumIds,
            SlideDurationSeconds = settings.SlideDurationSeconds,
            RefreshIntervalSeconds = settings.RefreshIntervalSeconds,
            UpdatedAt = settings.UpdatedAt
        };
    }
}
