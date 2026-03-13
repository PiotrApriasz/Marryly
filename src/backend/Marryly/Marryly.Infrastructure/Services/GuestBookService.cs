using Marryly.Application.Interfaces;
using Marryly.Application.Models.GuestBook;
using Marryly.Infrastructure.Database;
using Microsoft.Azure.Cosmos;

namespace Marryly.Infrastructure.Services;

public class GuestBookService(ICosmosDbService<GuestBookEntry> cosmosDbService) : IGuestBookService
{
    public async Task<GuestBookEntry> AddGuestBookEntryAsync(string eventId, GuestBookEntry guestBookEntry, CancellationToken ct = default)
    {
        guestBookEntry.EventId = eventId;
        return await cosmosDbService.AddAsync(guestBookEntry, ct);
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
            entries.Add(entry);
        }

        return entries;
    }
}
