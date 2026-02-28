using Marryly.Application.Interfaces;
using Marryly.Application.Models.EventDetails;
using Marryly.Infrastructure.Database;
using Microsoft.Azure.Cosmos;

namespace Marryly.Infrastructure.Services;

public class EventDetailsService(ICosmosDbService<EventDetail> cosmosDbService) : IEventDetailsService
{
    public async Task<WeddingMenu?> GetMenuAsync(string eventId, CancellationToken ct = default)
    {
        var menuId = $"{eventId}:menu";
        var partitionKey = PartitionKeyResolver.ForEventDetail(eventId);
        
        var result = await cosmosDbService.GetAsync(menuId, partitionKey, ct);
        
        return result as WeddingMenu;
    }

    public async Task<List<WeddingEvent>> GetEventsAsync(string eventId, CancellationToken ct = default)
    {
        var query = $"SELECT * FROM c WHERE c.eventId = '{eventId}' AND c.type = 'event'";
        var queryOptions = new QueryRequestOptions
        {
            PartitionKey = PartitionKeyResolver.ForEventDetail(eventId)
        };

        var events = new List<WeddingEvent>();
        
        await foreach (var item in cosmosDbService.QueryAsync(query, queryOptions, ct))
        {
            if (item is WeddingEvent weddingEvent)
            {
                events.Add(weddingEvent);
            }
        }

        return events;
    }
}
