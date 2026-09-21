using Marryly.Application.Models.Media;

namespace Marryly.Application.Interfaces;

public interface IVideoThumbnailService
{
    Task<VideoThumbnailResult> StoreAsync(MediaItem mediaItem, Stream thumbnail, CancellationToken ct = default);
}
