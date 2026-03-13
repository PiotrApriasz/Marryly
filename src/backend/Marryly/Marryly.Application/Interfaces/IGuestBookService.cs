using Marryly.Application.Models.Wishes;

namespace Marryly.Application.Interfaces;

public interface IGuestBookService
{
    Task<bool> AddWishAsync(string eventId, GuestBookEntry guestBookEntry, CancellationToken ct = default);
    Task<bool> GetAllWishesAsync(string eventId, CancellationToken ct = default);
}