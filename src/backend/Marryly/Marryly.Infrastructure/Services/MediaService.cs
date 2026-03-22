using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Infrastructure.Database;
using Microsoft.Azure.Cosmos;

namespace Marryly.Infrastructure.Services;

public class MediaService(
    ICosmosDbService<MediaItem> cosmosDbService,
    ICosmosContainerProvider cosmosContainerProvider) : IMediaService
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
}
