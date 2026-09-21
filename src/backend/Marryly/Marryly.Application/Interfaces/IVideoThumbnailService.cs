using Marryly.Application.Models.Media;

namespace Marryly.Application.Interfaces;

public interface IVideoThumbnailService
{
    Task<VideoThumbnailResult> GenerateAsync(MediaItem mediaItem, CancellationToken ct = default);
}
