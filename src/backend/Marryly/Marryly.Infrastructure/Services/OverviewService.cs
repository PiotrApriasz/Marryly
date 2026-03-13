using Marryly.Application.Interfaces;
using Marryly.Application.Models.Overview;

namespace Marryly.Infrastructure.Services;

public class OverviewService(IEventDetailsService eventDetailsService) : IOverviewService
{
    public async Task<OverviewResponse> GetOverviewAsync(string eventId, CancellationToken ct = default)
    {
        var menu = await eventDetailsService.GetMenuAsync(eventId, ct);
        var isMenuPublished = menu is not null && menu.Sections.Count > 0;

        return new OverviewResponse
        {
            PhotosCount = 0,
            GuestsCount = 0,
            WishesCount = 0,
            MenuPublished = isMenuPublished,
            AttractionsCount = 0,
            SettingsCount = 0
        };
    }
}
