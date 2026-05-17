using System.Net;
using Marryly.Application.Constants;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Slideshow;
using Marryly.Infrastructure.Database;

namespace Marryly.Infrastructure.Services;

public class SlideshowService(
    ICosmosDbService<SlideshowSettings> cosmosDbService,
    IAlbumService albumService,
    IMediaService mediaService) : ISlideshowService
{
    public async Task<SlideshowSettings> GetSettingsAsync(string eventId, CancellationToken ct = default)
    {
        var partitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId);
        var settings = await cosmosDbService.GetAsync(GetSettingsId(eventId), partitionKey, ct);

        if (settings is null)
        {
            var guestAlbum = await albumService.EnsureGuestAlbumAsync(eventId, ct);
            return CreateDefaultSettings(eventId, guestAlbum.Id);
        }

        var normalizedAlbumIds = await GetValidAlbumIdsAsync(eventId, settings, ct);
        if (normalizedAlbumIds.Count > 0)
        {
            settings.AlbumIds = normalizedAlbumIds.ToList();
            return NormalizeSettings(settings);
        }

        var guestAlbumFallback = await albumService.EnsureGuestAlbumAsync(eventId, ct);
        settings.AlbumIds = [guestAlbumFallback.Id];
        settings.LegacyAlbumId = null;
        settings.UpdatedAt = DateTime.UtcNow;
        return await cosmosDbService.UpsertAsync(NormalizeSettings(settings), ct);
    }

    public async Task<SlideshowSettings> SaveSettingsAsync(string eventId, UpdateSlideshowSettingsRequest request, CancellationToken ct = default)
    {
        var normalizedAlbumIds = request.AlbumIds?
            .Select(albumId => albumId?.Trim() ?? string.Empty)
            .Where(albumId => albumId.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList()
            ?? [];

        if (normalizedAlbumIds.Count == 0 && !string.IsNullOrWhiteSpace(request.LegacyAlbumId))
        {
            normalizedAlbumIds.Add(request.LegacyAlbumId.Trim());
        }

        if (normalizedAlbumIds.Count == 0)
        {
            throw new ApiErrorException(
                HttpStatusCode.BadRequest,
                "SLIDESHOW_ALBUM_REQUIRED",
                "Albums required",
                "Choose at least one album for the slideshow.");
        }

        foreach (var albumId in normalizedAlbumIds)
        {
            var album = await albumService.GetAlbumByIdAsync(eventId, albumId, ct);
            if (album is null)
            {
                throw new ApiErrorException(
                    HttpStatusCode.BadRequest,
                    "SLIDESHOW_ALBUM_INVALID",
                    "Album not found",
                    "One of the selected albums does not exist.");
            }
        }

        if (!request.SlideDurationSeconds.HasValue)
        {
            throw new ApiErrorException(
                HttpStatusCode.BadRequest,
                "SLIDESHOW_DURATION_REQUIRED",
                "Slide duration required",
                "Slide duration is required.");
        }

        if (!request.RefreshIntervalSeconds.HasValue)
        {
            throw new ApiErrorException(
                HttpStatusCode.BadRequest,
                "SLIDESHOW_REFRESH_REQUIRED",
                "Refresh interval required",
                "Refresh interval is required.");
        }

        var now = DateTime.UtcNow;
        var partitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId);
        var existing = await cosmosDbService.GetAsync(GetSettingsId(eventId), partitionKey, ct);

        var settings = NormalizeSettings(new SlideshowSettings
        {
            Id = GetSettingsId(eventId),
            EventId = eventId,
            AlbumIds = normalizedAlbumIds,
            LegacyAlbumId = null,
            SlideDurationSeconds = request.SlideDurationSeconds.Value,
            RefreshIntervalSeconds = request.RefreshIntervalSeconds.Value,
            CreatedAt = existing?.CreatedAt ?? now,
            UpdatedAt = now
        });

        return await cosmosDbService.UpsertAsync(settings, ct);
    }

    public async Task<AdminSlideshowPhotosResponse> GetPhotosAsync(string eventId, DateTime? afterUploadedAt, CancellationToken ct = default)
    {
        var settings = await GetSettingsAsync(eventId, ct);
        var items = await mediaService.GetSlideshowPhotosAsync(eventId, settings.AlbumIds, afterUploadedAt, ct);

        return new AdminSlideshowPhotosResponse
        {
            Items = items
        };
    }

    private static SlideshowSettings CreateDefaultSettings(string eventId, string albumId)
    {
        var now = DateTime.UtcNow;
        return new SlideshowSettings
        {
            Id = GetSettingsId(eventId),
            EventId = eventId,
            AlbumIds = [albumId],
            LegacyAlbumId = null,
            SlideDurationSeconds = SlideshowConstants.DefaultSlideDurationSeconds,
            RefreshIntervalSeconds = SlideshowConstants.DefaultRefreshIntervalSeconds,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static SlideshowSettings NormalizeSettings(SlideshowSettings settings)
    {
        settings.AlbumIds = (settings.AlbumIds ?? [])
            .Select(albumId => albumId?.Trim() ?? string.Empty)
            .Where(albumId => albumId.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        settings.SlideDurationSeconds = Math.Clamp(
            settings.SlideDurationSeconds,
            SlideshowConstants.MinSlideDurationSeconds,
            SlideshowConstants.MaxSlideDurationSeconds);
        settings.RefreshIntervalSeconds = Math.Clamp(
            settings.RefreshIntervalSeconds,
            SlideshowConstants.MinRefreshIntervalSeconds,
            SlideshowConstants.MaxRefreshIntervalSeconds);
        return settings;
    }

    private async Task<IReadOnlyList<string>> GetValidAlbumIdsAsync(string eventId, SlideshowSettings settings, CancellationToken ct)
    {
        var candidateAlbumIds = (settings.AlbumIds ?? [])
            .Concat(string.IsNullOrWhiteSpace(settings.LegacyAlbumId) ? [] : [settings.LegacyAlbumId])
            .Select(albumId => albumId?.Trim() ?? string.Empty)
            .Where(albumId => albumId.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var validAlbumIds = new List<string>(candidateAlbumIds.Count);
        foreach (var albumId in candidateAlbumIds)
        {
            if (await albumService.GetAlbumByIdAsync(eventId, albumId, ct) is not null)
            {
                validAlbumIds.Add(albumId);
            }
        }

        return validAlbumIds;
    }

    private static string GetSettingsId(string eventId) => $"{eventId}:{SlideshowConstants.SettingsDocumentSuffix}";
}
