using Marryly.Application.Models.Media;

namespace Marryly.Application.Interfaces;

public interface IVideoThumbnailQueue
{
    Task EnqueueAsync(VideoThumbnailJob job, CancellationToken ct = default);
}
