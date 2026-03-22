using Marryly.Application.Models.GuestBook;

namespace Marryly.Application.Interfaces;

public interface IGuestBookService
{
    Task<GuestBookEntry> AddGuestBookEntryAsync(string eventId, GuestBookEntry guestBookEntry, CancellationToken ct = default);
    Task<List<GuestBookEntry>> GetAllGuestBookEntriesAsync(string eventId, CancellationToken ct = default);
    Task<PagedGuestBookEntriesResponse> GetGuestBookEntriesPageAsync(string eventId, int page, int pageSize, CancellationToken ct = default);
}
