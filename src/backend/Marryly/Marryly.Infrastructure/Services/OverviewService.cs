using Marryly.Application.Interfaces;
using Marryly.Application.Models.Overview;

namespace Marryly.Infrastructure.Services;

public class OverviewService(IEventDetailsService eventDetailsService, IGuestBookService guestBookService) : IOverviewService
{
    public async Task<OverviewResponse> GetOverviewAsync(string eventId, CancellationToken ct = default)
    {
        var menu = await eventDetailsService.GetMenuAsync(eventId, ct);
        var guestBookEntries = await guestBookService.GetAllGuestBookEntriesAsync(eventId, ct);
        var isMenuPublished = menu is not null && menu.Sections.Count > 0;

        return new OverviewResponse
        {
            PhotosCount = 0,
            GuestsCount = 0,
            WishesCount = guestBookEntries.Count,
            MenuPublished = isMenuPublished,
            AttractionsCount = 0,
            SettingsCount = 0
        };
    }
}
