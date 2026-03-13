using Marryly.Application.Interfaces;
using Marryly.Application.Models.Wishes;

namespace Marryly.Infrastructure.Services;

public class GuestBookService : IGuestBookService
{
    public Task<bool> AddWishAsync(string eventId, GuestBookEntry guestBookEntry, CancellationToken ct = default)
    {
        throw new NotImplementedException();
    }

    public Task<bool> GetAllWishesAsync(string eventId, CancellationToken ct = default)
    {
        throw new NotImplementedException();
    }
}