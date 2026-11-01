using Marryly.Application.Constants;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Application.Models.Slideshow;
using Marryly.Infrastructure.Database;
using Microsoft.Azure.Cosmos;
using System.Security.Cryptography;

namespace Marryly.Infrastructure.Services;

public class MediaService(
    ICosmosDbService<MediaItem> cosmosDbService,
    ICosmosContainerProvider cosmosContainerProvider,
    IMediaStorageService mediaStorageService) : IMediaService
{
    public async Task<MediaItem> UpsertPhotoAsync(string eventId, MediaItem mediaItem, CancellationToken ct = default)
    {
        mediaItem.EventId = eventId;
        mediaItem.Kind = "photo";
        return await UpsertMediaAsync(eventId, mediaItem, ct);
    }

    public async Task<MediaItem> UpsertMediaAsync(string eventId, MediaItem mediaItem, CancellationToken ct = default)
    {
        mediaItem.EventId = eventId;
        return await cosmosDbService.UpsertAsync(mediaItem, ct);
    }

    public async Task<MediaItem?> GetMediaByIdAsync(string eventId, string mediaId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(mediaId))
        {
            return null;
        }

        return await cosmosDbService.GetAsync(mediaId, PartitionKeyResolver.ForEventIdBasedData(eventId), ct);
    }

    public async Task<List<MediaItem>> GetApprovedPhotosAsync(string eventId, CancellationToken ct = default)
    {
        var query = new QueryDefinition(
                "SELECT * FROM c WHERE c.eventId = @eventId AND c.kind = @kind AND c.approved = true AND c.status = @status ORDER BY c.uploadedAt DESC")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo")
            .WithParameter("@status", "ready");

        var options = new QueryRequestOptions
        {
            PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
        };

        var items = new List<MediaItem>();
        await foreach (var item in cosmosDbService.QueryAsync(query, options, ct))
        {
            items.Add(item);
        }

        return items;
    }

    public async Task<PagedPhotosResponse> GetApprovedPhotosPageAsync(
        string eventId,
        int limit,
        string? continuationToken,
        CancellationToken ct = default)
    {
        var normalizedLimit = Math.Clamp(limit, 1, 100);
        var query = new QueryDefinition(
                "SELECT * FROM c WHERE c.eventId = @eventId AND c.kind = @kind AND c.approved = true AND c.status = @status ORDER BY c.uploadedAt DESC")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo")
            .WithParameter("@status", "ready");

        var container = cosmosContainerProvider.GetContainer("MediaItems");
        using var iterator = container.GetItemQueryIterator<MediaItem>(
            query,
            continuationToken,
            new QueryRequestOptions
            {
                PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId),
                MaxItemCount = normalizedLimit
            });

        if (!iterator.HasMoreResults)
        {
            return new PagedPhotosResponse
            {
                Items = [],
                ContinuationToken = null,
                HasMore = false
            };
        }

        var page = await iterator.ReadNextAsync(ct);

        return new PagedPhotosResponse
        {
            Items = page.Resource.ToList(),
            ContinuationToken = page.ContinuationToken,
            HasMore = !string.IsNullOrWhiteSpace(page.ContinuationToken)
        };
    }

    public async Task<PagedAdminPhotosResponse> GetAdminPhotosPageAsync(
        string eventId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var normalizedPage = Math.Max(1, page);
        var normalizedPageSize = Math.Clamp(pageSize, 1, 100);
        var offset = (normalizedPage - 1) * normalizedPageSize;
        var partitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId);
        var container = cosmosContainerProvider.GetContainer("MediaItems");

        var countQuery = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.eventId = @eventId")
            .WithParameter("@eventId", eventId);

        using var countIterator = container.GetItemQueryIterator<int>(
            countQuery,
            requestOptions: new QueryRequestOptions
            {
                PartitionKey = partitionKey
            });

        var totalCount = 0;
        while (countIterator.HasMoreResults)
        {
            var countPage = await countIterator.ReadNextAsync(ct);
            totalCount = countPage.Resource.FirstOrDefault();
        }

        var query = new QueryDefinition(
                "SELECT * FROM c WHERE c.eventId = @eventId ORDER BY c.uploadedAt DESC OFFSET @offset LIMIT @pageSize")
            .WithParameter("@eventId", eventId)
            .WithParameter("@offset", offset)
            .WithParameter("@pageSize", normalizedPageSize);

        var items = new List<AdminPhotoItemResponse>();
        await foreach (var item in cosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = partitionKey
                       }, ct))
        {
            items.Add(MapAdminPhoto(item));
        }

        var totalPages = totalCount == 0
            ? 1
            : (int)Math.Ceiling(totalCount / (double)normalizedPageSize);

        return new PagedAdminPhotosResponse
        {
            Items = items,
            Page = Math.Min(normalizedPage, totalPages),
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            TotalPages = totalPages
        };
    }

    public async Task<AlbumMediaPageResponse> GetAlbumMediaPageAsync(
        string eventId,
        string albumId,
        int limit,
        string? continuationToken,
        CancellationToken ct = default)
    {
        var normalizedLimit = Math.Clamp(limit, 1, 100);
        var cursor = AlbumMediaPagination.Decode(continuationToken, eventId, albumId);
        var items = await GetChronologicalAlbumMediaAsync(eventId, albumId, publicOnly: true, ct);
        var remaining = cursor is null ? items : items.Where(item => AlbumMediaPagination.IsAfter(item, cursor));
        var page = remaining.Take(normalizedLimit + 1).ToList();
        var hasMore = page.Count > normalizedLimit;
        var pageItems = page.Take(normalizedLimit).ToList();

        return new AlbumMediaPageResponse
        {
            Items = pageItems.Select(MapGalleryMedia).ToList(),
            ContinuationToken = hasMore ? AlbumMediaPagination.Encode(eventId, albumId, pageItems[^1]) : null,
            HasMore = hasMore
        };
    }

    public async Task<string?> GetRandomAlbumPhotoUrlAsync(
        string eventId,
        string albumId,
        CancellationToken ct = default)
    {
        var query = new QueryDefinition(
                $"SELECT * FROM c WHERE c.eventId = @eventId AND c.kind = @kind AND c.approved = true AND c.status = @status AND {BuildAlbumFilterClause(albumId)} ORDER BY c.uploadedAt DESC")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo")
            .WithParameter("@status", "ready")
            .WithParameter("@albumId", albumId);

        var photos = new List<MediaItem>();
        await foreach (var item in cosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
                       }, ct))
        {
            photos.Add(item);
        }

        if (photos.Count == 0)
        {
            return null;
        }

        var selectedPhoto = photos[RandomNumberGenerator.GetInt32(photos.Count)];
        return GetHeroUrl(selectedPhoto);
    }

    public async Task<IReadOnlyList<MediaItem>> GetDownloadableAlbumPhotosAsync(
        string eventId,
        string albumId,
        IReadOnlyCollection<string>? mediaIds = null,
        CancellationToken ct = default)
    {
        var normalizedMediaIds = mediaIds?
            .Select(mediaId => mediaId?.Trim() ?? string.Empty)
            .Where(mediaId => mediaId.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (normalizedMediaIds is not null && normalizedMediaIds.Count == 0)
        {
            return [];
        }

        var mediaFilter = normalizedMediaIds is null
            ? string.Empty
            : " AND ARRAY_CONTAINS(@mediaIds, c.id)";
        var query = new QueryDefinition(
                $"SELECT * FROM c WHERE c.eventId = @eventId AND c.kind = @kind AND c.approved = true AND c.status = @status AND {BuildAlbumFilterClause(albumId)}{mediaFilter} ORDER BY c.uploadedAt DESC")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo")
            .WithParameter("@status", "ready")
            .WithParameter("@albumId", albumId);

        if (normalizedMediaIds is not null)
        {
            query = query.WithParameter("@mediaIds", normalizedMediaIds);
        }

        var photos = new List<MediaItem>();
        await foreach (var item in cosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
                       }, ct))
        {
            photos.Add(item);
        }

        return photos;
    }

    public async Task<PagedAdminPhotosResponse> GetAdminAlbumMediaPageAsync(
        string eventId,
        string albumId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var normalizedPageSize = Math.Clamp(pageSize, 1, 100);
        var items = await GetChronologicalAlbumMediaAsync(eventId, albumId, publicOnly: false, ct);
        var totalCount = items.Count;
        var totalPages = totalCount == 0
            ? 1
            : (int)Math.Ceiling(totalCount / (double)normalizedPageSize);
        var normalizedPage = Math.Clamp(page, 1, totalPages);

        return new PagedAdminPhotosResponse
        {
            Items = items.Skip((normalizedPage - 1) * normalizedPageSize).Take(normalizedPageSize).Select(MapAdminPhoto).ToList(),
            Page = normalizedPage,
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            TotalPages = totalPages
        };
    }

    private async Task<List<MediaItem>> GetChronologicalAlbumMediaAsync(
        string eventId, string albumId, bool publicOnly, CancellationToken ct)
    {
        var visibilityFilter = publicOnly ? " AND c.approved = true AND c.status = @status" : string.Empty;
        var query = new QueryDefinition(
                $"SELECT * FROM c WHERE c.eventId = @eventId AND {BuildAlbumFilterClause(albumId)}{visibilityFilter}")
            .WithParameter("@eventId", eventId)
            .WithParameter("@albumId", albumId);
        if (publicOnly)
        {
            query.WithParameter("@status", "ready");
        }

        // Sort all album metadata before paging, including legacy records without capturedAt.
        // Blob contents are loaded separately by the browser, only for the returned page.
        var items = new List<MediaItem>();
        await foreach (var item in cosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
                       }, ct))
        {
            items.Add(item);
        }

        return AlbumMediaPagination.Order(items);
    }

    public async Task<IReadOnlyList<AdminSlideshowPhotoResponse>> GetSlideshowPhotosAsync(
        string eventId,
        IReadOnlyList<string> albumIds,
        DateTime? afterUploadedAt,
        CancellationToken ct = default)
    {
        if (albumIds.Count == 0)
        {
            return [];
        }

        var normalizedAlbumIds = albumIds
            .Select(albumId => albumId?.Trim() ?? string.Empty)
            .Where(albumId => albumId.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (normalizedAlbumIds.Count == 0)
        {
            return [];
        }

        var albumFilterClause = BuildSlideshowAlbumFilterClause(normalizedAlbumIds);
        var queryText =
            $"SELECT * FROM c WHERE c.eventId = @eventId AND c.kind = @kind AND c.approved = true AND c.status = @status AND ({albumFilterClause})";

        QueryDefinition query;

        if (afterUploadedAt.HasValue)
        {
            queryText += " AND c.uploadedAt > @afterUploadedAt";
        }

        query = new QueryDefinition($"{queryText} ORDER BY c.uploadedAt ASC")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo")
            .WithParameter("@status", "ready");

        for (var index = 0; index < normalizedAlbumIds.Count; index += 1)
        {
            query = query.WithParameter($"@albumId{index}", normalizedAlbumIds[index]);
        }

        if (afterUploadedAt.HasValue)
        {
            query = query.WithParameter("@afterUploadedAt", afterUploadedAt.Value);
        }

        var items = new List<AdminSlideshowPhotoResponse>();
        await foreach (var item in cosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
                       }, ct))
        {
            items.Add(new AdminSlideshowPhotoResponse
            {
                Id = item.Id,
                UploadedAt = item.UploadedAt,
                DisplayUrl = item.PreviewBlobUrl ?? item.OriginalBlobUrl,
                Width = item.Width,
                Height = item.Height
            });
        }

        return items;
    }

    public async Task<Dictionary<string, AlbumMediaInsight>> GetAlbumInsightsAsync(string eventId, bool publicOnly, CancellationToken ct = default)
    {
        var partitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId);
        var publicCondition = publicOnly
            ? " AND c.approved = true AND c.status = @status"
            : string.Empty;

        var query = new QueryDefinition(
                $"SELECT * FROM c WHERE c.eventId = @eventId{publicCondition} ORDER BY c.uploadedAt DESC")
            .WithParameter("@eventId", eventId);

        if (publicOnly)
        {
            query = query.WithParameter("@status", "ready");
        }

        var items = new List<MediaItem>();
        await foreach (var item in cosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = partitionKey
                       }, ct))
        {
            items.Add(item);
        }

        return items
            .GroupBy(GetEffectiveAlbumId)
            .ToDictionary(
                group => group.Key,
                group => new AlbumMediaInsight
                {
                    ItemCount = group.Count(),
                    PhotoCount = group.Count(item => string.Equals(item.Kind, "photo", StringComparison.Ordinal)),
                    CoverUrl = group.Select(GetBestCoverUrl).FirstOrDefault(url => !string.IsNullOrWhiteSpace(url))
                },
                StringComparer.Ordinal);
    }

    public async Task<bool> HasAnyMediaInAlbumAsync(string eventId, string albumId, CancellationToken ct = default)
    {
        var query = new QueryDefinition(
                $"SELECT VALUE COUNT(1) FROM c WHERE c.eventId = @eventId AND {BuildAlbumFilterClause(albumId)}")
            .WithParameter("@eventId", eventId)
            .WithParameter("@albumId", albumId);

        var container = cosmosContainerProvider.GetContainer("MediaItems");
        using var iterator = container.GetItemQueryIterator<int>(
            query,
            requestOptions: new QueryRequestOptions
            {
                PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
            });

        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            if (page.Resource.FirstOrDefault() > 0)
            {
                return true;
            }
        }

        return false;
    }

    public async Task<int> GetPhotosCountAsync(string eventId, CancellationToken ct = default)
    {
        var partitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId);
        var container = cosmosContainerProvider.GetContainer("MediaItems");
        var countQuery = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.eventId = @eventId AND c.kind = @kind")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo");

        using var iterator = container.GetItemQueryIterator<int>(
            countQuery,
            requestOptions: new QueryRequestOptions
            {
                PartitionKey = partitionKey
            });

        var totalCount = 0;
        while (iterator.HasMoreResults)
        {
            var page = await iterator.ReadNextAsync(ct);
            totalCount = page.Resource.FirstOrDefault();
        }

        return totalCount;
    }

    public async Task<bool> DeletePhotoAsync(string eventId, string photoId, CancellationToken ct = default)
    {
        var partitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId);
        var mediaItem = await cosmosDbService.GetAsync(photoId, partitionKey, ct);
        if (mediaItem is null || !IsSupportedMediaKind(mediaItem.Kind))
        {
            return false;
        }

        await DeleteMediaItemAsync(mediaItem, partitionKey, ct);

        return true;
    }

    public async Task<DeleteAlbumMediaResponse> DeleteAlbumMediaBatchAsync(
        string eventId,
        string albumId,
        CancellationToken ct = default)
    {
        const int batchSize = 25;
        var partitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId);
        var query = new QueryDefinition(
                $"SELECT TOP @limit * FROM c WHERE c.eventId = @eventId AND c.kind IN ('photo', 'video') AND {BuildAlbumFilterClause(albumId)}")
            .WithParameter("@limit", batchSize + 1)
            .WithParameter("@eventId", eventId)
            .WithParameter("@albumId", albumId);

        // Read the batch before deleting; OFFSET pagination would skip items as the album shrinks.
        var items = new List<MediaItem>();
        await foreach (var item in cosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = partitionKey
                       }, ct))
        {
            items.Add(item);
        }

        var deletedCount = 0;
        foreach (var item in items.Take(batchSize))
        {
            await DeleteMediaItemAsync(item, partitionKey, ct);
            deletedCount += 1;
        }

        return new DeleteAlbumMediaResponse
        {
            DeletedCount = deletedCount,
            HasMore = items.Count > batchSize
        };
    }

    private async Task DeleteMediaItemAsync(MediaItem mediaItem, PartitionKey partitionKey, CancellationToken ct)
    {
        await mediaStorageService.DeleteOriginalIfExistsAsync(mediaItem.OriginalBlobName, ct);
        await mediaStorageService.DeleteDerivedIfExistsAsync(mediaItem.PreviewBlobName, ct);
        await mediaStorageService.DeleteDerivedIfExistsAsync(mediaItem.ThumbnailBlobName, ct);
        await cosmosDbService.DeleteAsync(mediaItem.Id, partitionKey, ct);
    }

    private AdminPhotoItemResponse MapAdminPhoto(MediaItem item)
    {
        var originalUrl = GetOriginalUrlForResponse(item);

        return new AdminPhotoItemResponse
        {
            Id = item.Id,
            EventId = item.EventId,
            Kind = item.Kind,
            Status = item.Status,
            Approved = item.Approved,
            AlbumId = item.AlbumId,
            SourceType = item.SourceType,
            UploadedAt = item.UploadedAt,
            CapturedAt = item.CapturedAt,
            ContentType = item.ContentType,
            SizeBytes = item.SizeBytes,
            Width = item.Width,
            Height = item.Height,
            OriginalBlobName = item.OriginalBlobName,
            OriginalBlobUrl = originalUrl,
            OriginalUrl = originalUrl,
            DownloadUrl = mediaStorageService.GetOriginalDownloadUrl(item.OriginalBlobName),
            PreviewBlobName = item.PreviewBlobName,
            PreviewBlobUrl = item.PreviewBlobUrl,
            ThumbnailBlobName = item.ThumbnailBlobName,
            ThumbnailBlobUrl = item.ThumbnailBlobUrl,
            ProcessingError = item.ProcessingError
        };
    }

    private GalleryMediaItemResponse MapGalleryMedia(MediaItem item)
    {
        var originalUrl = GetOriginalUrlForResponse(item);

        return new GalleryMediaItemResponse
        {
            Id = item.Id,
            EventId = item.EventId,
            Kind = item.Kind,
            Url = item.PreviewBlobUrl ?? originalUrl,
            OriginalUrl = originalUrl,
            DownloadUrl = mediaStorageService.GetOriginalDownloadUrl(item.OriginalBlobName),
            ThumbnailUrl = item.ThumbnailBlobUrl ?? (string.Equals(item.Kind, "photo", StringComparison.Ordinal)
                ? item.PreviewBlobUrl ?? item.OriginalBlobUrl
                : null),
            ContentType = item.ContentType,
            UploadedAt = item.UploadedAt,
            CapturedAt = item.CapturedAt,
            Approved = item.Approved,
            Width = item.Width,
            Height = item.Height
        };
    }

    private static string BuildAlbumFilterClause(string albumId)
    {
        return string.Equals(albumId, AlbumConstants.GuestAlbumId, StringComparison.Ordinal)
            ? "((IS_DEFINED(c.albumId) AND c.albumId = @albumId) OR NOT IS_DEFINED(c.albumId) OR IS_NULL(c.albumId) OR c.albumId = '')"
            : "(IS_DEFINED(c.albumId) AND c.albumId = @albumId)";
    }

    private static string BuildSlideshowAlbumFilterClause(IReadOnlyList<string> albumIds)
    {
        return string.Join(
            " OR ",
            albumIds.Select((albumId, index) => BuildAlbumFilterClauseForParameter(albumId, $"@albumId{index}")));
    }

    private static string BuildAlbumFilterClauseForParameter(string albumId, string parameterName)
    {
        return string.Equals(albumId, AlbumConstants.GuestAlbumId, StringComparison.Ordinal)
            ? $"((IS_DEFINED(c.albumId) AND c.albumId = {parameterName}) OR NOT IS_DEFINED(c.albumId) OR IS_NULL(c.albumId) OR c.albumId = '')"
            : $"(IS_DEFINED(c.albumId) AND c.albumId = {parameterName})";
    }

    private static string GetEffectiveAlbumId(MediaItem item)
    {
        return string.IsNullOrWhiteSpace(item.AlbumId)
            ? AlbumConstants.GuestAlbumId
            : item.AlbumId;
    }

    private static string? GetBestCoverUrl(MediaItem item)
    {
        if (!string.Equals(item.Kind, "photo", StringComparison.Ordinal))
        {
            return null;
        }

        return item.ThumbnailBlobUrl ?? item.PreviewBlobUrl ?? item.OriginalBlobUrl;
    }

    private string GetHeroUrl(MediaItem item)
    {
        return item.PreviewBlobUrl ?? item.ThumbnailBlobUrl ?? GetOriginalUrlForResponse(item);
    }

    private string GetOriginalUrlForResponse(MediaItem item)
    {
        return mediaStorageService.GetOriginalReadUrl(item.OriginalBlobName);
    }

    private static bool IsSupportedMediaKind(string kind)
    {
        return string.Equals(kind, "photo", StringComparison.Ordinal) ||
               string.Equals(kind, "video", StringComparison.Ordinal);
    }
}
