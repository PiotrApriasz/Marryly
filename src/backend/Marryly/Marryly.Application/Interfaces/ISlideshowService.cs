using Marryly.Application.Models.Slideshow;

namespace Marryly.Application.Interfaces;

public interface ISlideshowService
{
    Task<SlideshowSettings> GetSettingsAsync(string eventId, CancellationToken ct = default);
    Task<SlideshowSettings> SaveSettingsAsync(string eventId, UpdateSlideshowSettingsRequest request, CancellationToken ct = default);
    Task<AdminSlideshowPhotosResponse> GetPhotosAsync(string eventId, DateTime? afterUploadedAt, CancellationToken ct = default);
}
