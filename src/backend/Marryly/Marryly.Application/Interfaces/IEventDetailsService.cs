using Marryly.Application.Models.EventDetails;

namespace Marryly.Application.Interfaces;

public interface IEventDetailsService
{
    Task<WeddingMenu?> GetMenuAsync(string eventId, CancellationToken ct = default);
    Task<WeddingMenu> GetAdminMenuAsync(string eventId, CancellationToken ct = default);
    Task<WeddingMenu> SaveMenuAsync(string eventId, SaveWeddingMenuRequest request, CancellationToken ct = default);
    bool HasPublishedMenu(WeddingMenu? menu);
    Task<List<WeddingEvent>> GetEventsAsync(string eventId, CancellationToken ct = default);
}
