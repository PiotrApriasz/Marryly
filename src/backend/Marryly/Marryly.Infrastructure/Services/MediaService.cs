using Marryly.Application.Constants;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Infrastructure.Database;
using Microsoft.Azure.Cosmos;

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
        return await cosmosDbService.UpsertAsync(mediaItem, ct);
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

        var countQuery = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.eventId = @eventId AND c.kind = @kind")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo");

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
                "SELECT * FROM c WHERE c.eventId = @eventId AND c.kind = @kind ORDER BY c.uploadedAt DESC OFFSET @offset LIMIT @pageSize")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo")
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
        var query = new QueryDefinition(
                $"SELECT * FROM c WHERE c.eventId = @eventId AND c.kind = @kind AND c.approved = true AND c.status = @status AND {BuildAlbumFilterClause(albumId)} ORDER BY c.uploadedAt DESC")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo")
            .WithParameter("@status", "ready")
            .WithParameter("@albumId", albumId);

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
            return new AlbumMediaPageResponse
            {
                Items = [],
                ContinuationToken = null,
                HasMore = false
            };
        }

        var page = await iterator.ReadNextAsync(ct);

        return new AlbumMediaPageResponse
        {
            Items = page.Resource.Select(MapGalleryMedia).ToList(),
            ContinuationToken = page.ContinuationToken,
            HasMore = !string.IsNullOrWhiteSpace(page.ContinuationToken)
        };
    }

    public async Task<PagedAdminPhotosResponse> GetAdminAlbumMediaPageAsync(
        string eventId,
        string albumId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var normalizedPage = Math.Max(1, page);
        var normalizedPageSize = Math.Clamp(pageSize, 1, 100);
        var offset = (normalizedPage - 1) * normalizedPageSize;
        var partitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId);
        var container = cosmosContainerProvider.GetContainer("MediaItems");

        var countQuery = new QueryDefinition(
                $"SELECT VALUE COUNT(1) FROM c WHERE c.eventId = @eventId AND c.kind = @kind AND {BuildAlbumFilterClause(albumId)}")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo")
            .WithParameter("@albumId", albumId);

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
                $"SELECT * FROM c WHERE c.eventId = @eventId AND c.kind = @kind AND {BuildAlbumFilterClause(albumId)} ORDER BY c.uploadedAt DESC OFFSET @offset LIMIT @pageSize")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo")
            .WithParameter("@albumId", albumId)
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

    public async Task<Dictionary<string, AlbumMediaInsight>> GetAlbumInsightsAsync(string eventId, bool publicOnly, CancellationToken ct = default)
    {
        var partitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId);
        var publicCondition = publicOnly
            ? " AND c.approved = true AND c.status = @status"
            : string.Empty;

        var query = new QueryDefinition(
                $"SELECT * FROM c WHERE c.eventId = @eventId AND c.kind = @kind{publicCondition} ORDER BY c.uploadedAt DESC")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo");

        if (publicOnly)
        {
            query.WithParameter("@status", "ready");
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
                    CoverUrl = group.Select(GetBestCoverUrl).FirstOrDefault(url => !string.IsNullOrWhiteSpace(url))
                },
                StringComparer.Ordinal);
    }

    public async Task<bool> HasAnyMediaInAlbumAsync(string eventId, string albumId, CancellationToken ct = default)
    {
        var query = new QueryDefinition(
                $"SELECT VALUE COUNT(1) FROM c WHERE c.eventId = @eventId AND c.kind = @kind AND {BuildAlbumFilterClause(albumId)}")
            .WithParameter("@eventId", eventId)
            .WithParameter("@kind", "photo")
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
        if (mediaItem is null || !string.Equals(mediaItem.Kind, "photo", StringComparison.Ordinal))
        {
            return false;
        }

        await mediaStorageService.DeleteOriginalIfExistsAsync(mediaItem.OriginalBlobName, ct);
        await mediaStorageService.DeleteDerivedIfExistsAsync(mediaItem.PreviewBlobName, ct);
        await mediaStorageService.DeleteDerivedIfExistsAsync(mediaItem.ThumbnailBlobName, ct);
        await cosmosDbService.DeleteAsync(photoId, partitionKey, ct);

        return true;
    }

    private static AdminPhotoItemResponse MapAdminPhoto(MediaItem item)
    {
        return new AdminPhotoItemResponse
        {
            Id = item.Id,
            EventId = item.EventId,
            Status = item.Status,
            Approved = item.Approved,
            AlbumId = item.AlbumId,
            SourceType = item.SourceType,
            UploadedAt = item.UploadedAt,
            ContentType = item.ContentType,
            SizeBytes = item.SizeBytes,
            Width = item.Width,
            Height = item.Height,
            OriginalBlobName = item.OriginalBlobName,
            OriginalBlobUrl = item.OriginalBlobUrl,
            PreviewBlobName = item.PreviewBlobName,
            PreviewBlobUrl = item.PreviewBlobUrl,
            ThumbnailBlobName = item.ThumbnailBlobName,
            ThumbnailBlobUrl = item.ThumbnailBlobUrl,
            ProcessingError = item.ProcessingError
        };
    }

    private static GalleryMediaItemResponse MapGalleryMedia(MediaItem item)
    {
        return new GalleryMediaItemResponse
        {
            Id = item.Id,
            EventId = item.EventId,
            Url = item.PreviewBlobUrl ?? item.OriginalBlobUrl,
            ThumbnailUrl = item.ThumbnailBlobUrl ?? item.PreviewBlobUrl ?? item.OriginalBlobUrl,
            UploadedAt = item.UploadedAt,
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

    private static string GetEffectiveAlbumId(MediaItem item)
    {
        return string.IsNullOrWhiteSpace(item.AlbumId)
            ? AlbumConstants.GuestAlbumId
            : item.AlbumId;
    }

    private static string? GetBestCoverUrl(MediaItem item)
    {
        return item.ThumbnailBlobUrl ?? item.PreviewBlobUrl ?? item.OriginalBlobUrl;
    }
}
