using Marryly.Application.Models.EventDetails;

namespace Marryly.Application.Interfaces;

public interface IEventDetailsService
{
    Task<WeddingMenu?> GetMenuAsync(string eventId, CancellationToken ct = default);
    Task<List<WeddingEvent>> GetEventsAsync(string eventId, CancellationToken ct = default);
}
