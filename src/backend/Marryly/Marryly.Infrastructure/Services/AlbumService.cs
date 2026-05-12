using System.Net;
using System.Globalization;
using System.Text;
using Marryly.Application.Constants;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Infrastructure.Database;
using Microsoft.Azure.Cosmos;

namespace Marryly.Infrastructure.Services;

public class AlbumService(
    ICosmosDbService<Album> cosmosDbService,
    IMediaService mediaService) : IAlbumService
{
    public async Task<Album> EnsureGuestAlbumAsync(string eventId, CancellationToken ct = default)
    {
        var existing = await cosmosDbService.GetAsync(AlbumConstants.GuestAlbumId, PartitionKeyResolver.ForEventIdBasedData(eventId), ct);
        if (existing is not null)
        {
            return existing;
        }

        var now = DateTime.UtcNow;
        var album = new Album
        {
            Id = AlbumConstants.GuestAlbumId,
            EventId = eventId,
            Title = AlbumConstants.GuestAlbumTitle,
            Slug = AlbumConstants.GuestAlbumSlug,
            Description = "Zdjęcia dodane przez gości.",
            IsSystem = true,
            IsVisible = true,
            SortOrder = 0,
            CreatedAt = now,
            UpdatedAt = now
        };

        return await cosmosDbService.UpsertAsync(album, ct);
    }

    public async Task<IReadOnlyList<Album>> GetVisibleAlbumsAsync(string eventId, CancellationToken ct = default)
    {
        await EnsureGuestAlbumAsync(eventId, ct);
        return await GetAlbumsAsync(
            new QueryDefinition("SELECT * FROM c WHERE c.eventId = @eventId AND c.isVisible = true")
                .WithParameter("@eventId", eventId),
            eventId,
            ct);
    }

    public async Task<IReadOnlyList<Album>> GetAdminAlbumsAsync(string eventId, CancellationToken ct = default)
    {
        await EnsureGuestAlbumAsync(eventId, ct);
        return await GetAlbumsAsync(
            new QueryDefinition("SELECT * FROM c WHERE c.eventId = @eventId")
                .WithParameter("@eventId", eventId),
            eventId,
            ct);
    }

    public async Task<Album?> GetAlbumByIdAsync(string eventId, string albumId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(albumId))
        {
            return null;
        }

        await EnsureGuestAlbumAsync(eventId, ct);
        return await cosmosDbService.GetAsync(albumId, PartitionKeyResolver.ForEventIdBasedData(eventId), ct);
    }

    public async Task<Album?> GetAlbumBySlugAsync(string eventId, string slug, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            return null;
        }

        await EnsureGuestAlbumAsync(eventId, ct);
        var query = new QueryDefinition("SELECT * FROM c WHERE c.eventId = @eventId AND c.slug = @slug")
            .WithParameter("@eventId", eventId)
            .WithParameter("@slug", slug.Trim().ToLowerInvariant());

        await foreach (var album in cosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
                       }, ct))
        {
            return album;
        }

        return null;
    }

    public async Task<Album> CreateAlbumAsync(string eventId, CreateAlbumRequest request, CancellationToken ct = default)
    {
        await EnsureGuestAlbumAsync(eventId, ct);

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, "ALBUM_TITLE_REQUIRED", "Album title required", "Album title is required.");
        }

        var albums = await GetAdminAlbumsAsync(eventId, ct);
        var now = DateTime.UtcNow;
        var album = new Album
        {
            Id = Guid.NewGuid().ToString(),
            EventId = eventId,
            Title = request.Title.Trim(),
            Slug = await CreateUniqueSlugAsync(eventId, request.Title, null, ct),
            Description = request.Description?.Trim(),
            IsSystem = false,
            IsVisible = request.IsVisible ?? true,
            SortOrder = albums.Count == 0 ? 0 : albums.Max(item => item.SortOrder) + 1,
            CreatedAt = now,
            UpdatedAt = now
        };

        return await cosmosDbService.AddAsync(album, ct);
    }

    public async Task<Album> UpdateAlbumAsync(string eventId, string albumId, UpdateAlbumRequest request, CancellationToken ct = default)
    {
        var album = await GetRequiredAlbumAsync(eventId, albumId, ct);

        if (!album.IsSystem && !string.IsNullOrWhiteSpace(request.Title))
        {
            album.Title = request.Title.Trim();
            album.Slug = await CreateUniqueSlugAsync(eventId, album.Title, album.Id, ct);
        }

        album.Description = request.Description?.Trim();

        if (!album.IsSystem && request.IsVisible.HasValue)
        {
            album.IsVisible = request.IsVisible.Value;
        }

        album.UpdatedAt = DateTime.UtcNow;
        return await cosmosDbService.UpsertAsync(album, ct);
    }

    public async Task ReorderAlbumsAsync(string eventId, IReadOnlyList<string> orderedAlbumIds, CancellationToken ct = default)
    {
        if (orderedAlbumIds.Count == 0)
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, "ALBUM_ORDER_REQUIRED", "Album order required", "At least one album id is required.");
        }

        var albums = (await GetAdminAlbumsAsync(eventId, ct)).ToList();
        var byId = albums.ToDictionary(item => item.Id, StringComparer.Ordinal);

        foreach (var albumId in orderedAlbumIds)
        {
            if (!byId.ContainsKey(albumId))
            {
                throw new ApiErrorException(HttpStatusCode.BadRequest, "ALBUM_ORDER_INVALID", "Album order invalid", "Album order contains an unknown album id.");
            }
        }

        var ordered = orderedAlbumIds
            .Select(id => byId[id])
            .Concat(albums.Where(album => !orderedAlbumIds.Contains(album.Id, StringComparer.Ordinal)))
            .ToList();

        for (var index = 0; index < ordered.Count; index += 1)
        {
            ordered[index].SortOrder = index;
            ordered[index].UpdatedAt = DateTime.UtcNow;
            await cosmosDbService.UpsertAsync(ordered[index], ct);
        }
    }

    public async Task DeleteAlbumAsync(string eventId, string albumId, CancellationToken ct = default)
    {
        var album = await GetRequiredAlbumAsync(eventId, albumId, ct);
        if (album.IsSystem)
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, "ALBUM_DELETE_FORBIDDEN", "Album cannot be deleted", "System album cannot be deleted.");
        }

        if (await mediaService.HasAnyMediaInAlbumAsync(eventId, albumId, ct))
        {
            throw new ApiErrorException(HttpStatusCode.Conflict, "ALBUM_NOT_EMPTY", "Album is not empty", "Remove all media from this album before deleting it.");
        }

        await cosmosDbService.DeleteAsync(album.Id, PartitionKeyResolver.ForEventIdBasedData(eventId), ct);
    }

    private async Task<Album> GetRequiredAlbumAsync(string eventId, string albumId, CancellationToken ct)
    {
        var album = await GetAlbumByIdAsync(eventId, albumId, ct);
        if (album is null)
        {
            throw new ApiErrorException(HttpStatusCode.NotFound, "ALBUM_NOT_FOUND", "Album not found", "The requested album does not exist.");
        }

        return album;
    }

    private async Task<IReadOnlyList<Album>> GetAlbumsAsync(QueryDefinition query, string eventId, CancellationToken ct)
    {
        var items = new List<Album>();
        await foreach (var item in cosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
                       }, ct))
        {
            items.Add(item);
        }

        return items
            .OrderBy(item => item.SortOrder)
            .ThenBy(item => item.CreatedAt)
            .ToList();
    }

    private async Task<string> CreateUniqueSlugAsync(string eventId, string title, string? currentAlbumId, CancellationToken ct)
    {
        var baseSlug = Slugify(title);
        var candidate = baseSlug;
        var suffix = 2;

        while (true)
        {
            var existing = await GetAlbumBySlugAsync(eventId, candidate, ct);
            if (existing is null || string.Equals(existing.Id, currentAlbumId, StringComparison.Ordinal))
            {
                return candidate;
            }

            candidate = $"{baseSlug}-{suffix}";
            suffix += 1;
        }
    }

    private static string Slugify(string value)
    {
        var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder();
        var previousWasSeparator = false;

        foreach (var character in normalized)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(character);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
                previousWasSeparator = false;
                continue;
            }

            if (previousWasSeparator)
            {
                continue;
            }

            builder.Append('-');
            previousWasSeparator = true;
        }

        var slug = builder.ToString().Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? "album" : slug;
    }
}
