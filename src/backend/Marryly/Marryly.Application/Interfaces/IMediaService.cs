using Marryly.Application.Models.Media;

namespace Marryly.Application.Interfaces;

public interface IMediaService
{
    Task<MediaItem> UpsertPhotoAsync(string eventId, MediaItem mediaItem, CancellationToken ct = default);
    Task<List<MediaItem>> GetApprovedPhotosAsync(string eventId, CancellationToken ct = default);
    Task<PagedPhotosResponse> GetApprovedPhotosPageAsync(string eventId, int limit, string? continuationToken, CancellationToken ct = default);
}
