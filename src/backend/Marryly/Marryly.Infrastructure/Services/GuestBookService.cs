using Marryly.Application.Interfaces;
using Marryly.Application.Models.GuestBook;
using Marryly.Infrastructure.Database;
using Microsoft.Azure.Cosmos;

namespace Marryly.Infrastructure.Services;

public class GuestBookService(
    ICosmosDbService<GuestBookEntry> cosmosDbService,
    ICosmosContainerProvider cosmosContainerProvider,
    IMediaStorageService mediaStorageService) : IGuestBookService
{
    public async Task<GuestBookEntry> AddGuestBookEntryAsync(string eventId, GuestBookEntry guestBookEntry, CancellationToken ct = default)
    {
        guestBookEntry.EventId = eventId;
        var createdEntry = await cosmosDbService.AddAsync(guestBookEntry, ct);
        return DecorateMediaUrl(createdEntry);
    }

    public async Task<List<GuestBookEntry>> GetAllGuestBookEntriesAsync(string eventId, CancellationToken ct = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.eventId = @eventId ORDER BY c.createdAt DESC")
            .WithParameter("@eventId", eventId);
        
        var options = new QueryRequestOptions
        {
            PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
        };

        var entries = new List<GuestBookEntry>();
        await foreach (var entry in cosmosDbService.QueryAsync(query, options, ct))
        {
            entries.Add(DecorateMediaUrl(entry));
        }

        return entries;
    }

    public async Task<PagedGuestBookEntriesResponse> GetGuestBookEntriesPageAsync(
        string eventId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        var normalizedPage = Math.Max(1, page);
        var normalizedPageSize = Math.Clamp(pageSize, 1, 100);
        var offset = (normalizedPage - 1) * normalizedPageSize;
        var partitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId);

        var container = cosmosContainerProvider.GetContainer("GuestbookEntry");

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

        var entriesQuery = new QueryDefinition(
                "SELECT * FROM c WHERE c.eventId = @eventId ORDER BY c.createdAt DESC OFFSET @offset LIMIT @pageSize")
            .WithParameter("@eventId", eventId)
            .WithParameter("@offset", offset)
            .WithParameter("@pageSize", normalizedPageSize);

        var entries = new List<GuestBookEntry>();
        await foreach (var entry in cosmosDbService.QueryAsync(entriesQuery, new QueryRequestOptions
                       {
                           PartitionKey = partitionKey
                       }, ct))
        {
            entries.Add(DecorateMediaUrl(entry));
        }

        var totalPages = totalCount == 0
            ? 1
            : (int)Math.Ceiling(totalCount / (double)normalizedPageSize);

        return new PagedGuestBookEntriesResponse
        {
            Entries = entries,
            Page = Math.Min(normalizedPage, totalPages),
            PageSize = normalizedPageSize,
            TotalCount = totalCount,
            TotalPages = totalPages
        };
    }

    private GuestBookEntry DecorateMediaUrl(GuestBookEntry entry)
    {
        if (string.Equals(entry.MediaKind, "video", StringComparison.Ordinal) &&
            !string.IsNullOrWhiteSpace(entry.MediaBlobName))
        {
            entry.MediaUrl = mediaStorageService.GetOriginalReadUrl(entry.MediaBlobName);
        }

        if (!string.IsNullOrWhiteSpace(entry.VideoBlobName))
        {
            entry.VideoUrl = mediaStorageService.GetOriginalReadUrl(entry.VideoBlobName);
        }

        return entry;
    }
}
