using System.Text.RegularExpressions;
using Marryly.Application.Models.EventDetails;
using Marryly.Application.Models.GuestBook;
using Marryly.Application.Models.Media;
using Microsoft.Azure.Cosmos;

namespace Marryly.Infrastructure.Database;

public static class PartitionKeyResolver
{
    public static PartitionKey ForEntity(object entity) => entity switch
    {
        EventDetail g => new PartitionKeyBuilder()
            .Add(g.EventId)
            .Build(),
        GuestBookEntry g => new PartitionKeyBuilder()
            .Add(g.EventId)
            .Build(),
        Album g => new PartitionKeyBuilder()
            .Add(g.EventId)
            .Build(),
        MediaItem g => new PartitionKeyBuilder()
            .Add(g.EventId)
            .Build(),
        _ => throw new InvalidOperationException("No partition key definition for this entity type.")
    };
    
    public static PartitionKey ForEventIdBasedData(string eventId) =>
        new PartitionKeyBuilder().Add(eventId).Build();
}
