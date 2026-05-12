using Marryly.Application.Models.Media;

namespace Marryly.Application.Interfaces;

public interface IAlbumService
{
    Task<Album> EnsureGuestAlbumAsync(string eventId, CancellationToken ct = default);
    Task<IReadOnlyList<Album>> GetVisibleAlbumsAsync(string eventId, CancellationToken ct = default);
    Task<IReadOnlyList<Album>> GetAdminAlbumsAsync(string eventId, CancellationToken ct = default);
    Task<Album?> GetAlbumByIdAsync(string eventId, string albumId, CancellationToken ct = default);
    Task<Album?> GetAlbumBySlugAsync(string eventId, string slug, CancellationToken ct = default);
    Task<Album> CreateAlbumAsync(string eventId, CreateAlbumRequest request, CancellationToken ct = default);
    Task<Album> UpdateAlbumAsync(string eventId, string albumId, UpdateAlbumRequest request, CancellationToken ct = default);
    Task ReorderAlbumsAsync(string eventId, IReadOnlyList<string> orderedAlbumIds, CancellationToken ct = default);
    Task DeleteAlbumAsync(string eventId, string albumId, CancellationToken ct = default);
}
