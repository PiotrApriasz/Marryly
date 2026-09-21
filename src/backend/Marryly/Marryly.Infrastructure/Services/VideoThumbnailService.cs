using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using SixLabors.ImageSharp;

namespace Marryly.Infrastructure.Services;

public class VideoThumbnailService(IMediaStorageService mediaStorageService) : IVideoThumbnailService
{
    public async Task<VideoThumbnailResult> StoreAsync(MediaItem mediaItem, Stream thumbnail, CancellationToken ct = default)
    {
        if (!string.Equals(mediaItem.Kind, "video", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Video thumbnails can only be generated for video media.");
        }

        if (!thumbnail.CanSeek)
        {
            throw new InvalidOperationException("Video thumbnail stream must support seeking.");
        }

        thumbnail.Position = 0;
        var imageInfo = await Image.IdentifyAsync(thumbnail, ct)
            ?? throw new InvalidOperationException("The video thumbnail is not a readable image.");
        thumbnail.Position = 0;

        var thumbnailBlobName = BuildThumbnailBlobName(mediaItem);
        await mediaStorageService.UploadDerivedAsync(thumbnailBlobName, thumbnail, "image/jpeg", ct);

        return new VideoThumbnailResult
        {
            ThumbnailBlobName = thumbnailBlobName,
            ThumbnailBlobUrl = mediaStorageService.GetDerivedBlobUrl(thumbnailBlobName),
            Width = imageInfo.Width,
            Height = imageInfo.Height,
            ProcessedAt = DateTime.UtcNow
        };
    }

    private static string BuildThumbnailBlobName(MediaItem mediaItem)
    {
        return $"events/{mediaItem.EventId}/videos/thumbnails/{mediaItem.Id}.jpg";
    }
}
