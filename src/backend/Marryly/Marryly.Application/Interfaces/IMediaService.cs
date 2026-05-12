using Marryly.Application.Models.Media;

namespace Marryly.Application.Interfaces;

public interface IMediaService
{
    Task<MediaItem> UpsertPhotoAsync(string eventId, MediaItem mediaItem, CancellationToken ct = default);
    Task<List<MediaItem>> GetApprovedPhotosAsync(string eventId, CancellationToken ct = default);
    Task<PagedPhotosResponse> GetApprovedPhotosPageAsync(string eventId, int limit, string? continuationToken, CancellationToken ct = default);
    Task<PagedAdminPhotosResponse> GetAdminPhotosPageAsync(string eventId, int page, int pageSize, CancellationToken ct = default);
    Task<AlbumMediaPageResponse> GetAlbumMediaPageAsync(string eventId, string albumId, int limit, string? continuationToken, CancellationToken ct = default);
    Task<PagedAdminPhotosResponse> GetAdminAlbumMediaPageAsync(string eventId, string albumId, int page, int pageSize, CancellationToken ct = default);
    Task<Dictionary<string, AlbumMediaInsight>> GetAlbumInsightsAsync(string eventId, bool publicOnly, CancellationToken ct = default);
    Task<bool> HasAnyMediaInAlbumAsync(string eventId, string albumId, CancellationToken ct = default);
    Task<int> GetPhotosCountAsync(string eventId, CancellationToken ct = default);
    Task<bool> DeletePhotoAsync(string eventId, string photoId, CancellationToken ct = default);
}
