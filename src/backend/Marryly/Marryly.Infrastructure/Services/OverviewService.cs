using Marryly.Application.Interfaces;
using Marryly.Application.Models.Overview;
using Microsoft.Azure.Cosmos;

namespace Marryly.Infrastructure.Services;

public class OverviewService(
    IEventDetailsService eventDetailsService,
    IGuestBookService guestBookService,
    IGuestListService guestListService,
    IMediaService mediaService) : IOverviewService
{
    public async Task<OverviewResponse> GetOverviewAsync(string eventId, CancellationToken ct = default)
    {
        var menu = await eventDetailsService.GetMenuAsync(eventId, ct);
        var guestBookEntries = await guestBookService.GetAllGuestBookEntriesAsync(eventId, ct);
        var guestsCount = 0;
        try
        {
            var guestListSummary = await guestListService.GetSummaryAsync(eventId, ct);
            guestsCount = guestListSummary.InvitedCount;
        }
        catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            guestsCount = 0;
        }

        var photosCount = await mediaService.GetPhotosCountAsync(eventId, ct);
        var isMenuPublished = eventDetailsService.HasPublishedMenu(menu);

        return new OverviewResponse
        {
            PhotosCount = photosCount,
            GuestsCount = guestsCount,
            WishesCount = guestBookEntries.Count,
            MenuPublished = isMenuPublished,
            AttractionsCount = 0,
            SettingsCount = 0
        };
    }
}
