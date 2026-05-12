using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace Marryly.Infrastructure.Services;

public class PhotoDerivativeService(IMediaStorageService mediaStorageService) : IPhotoDerivativeService
{
    private const int ThumbnailMaxPixels = 480;
    private const int PreviewMaxPixels = 2560;

    public async Task<PhotoDerivativeResult> GenerateAsync(MediaItem mediaItem, CancellationToken ct = default)
    {
        await using var originalStream = await mediaStorageService.OpenOriginalReadAsync(mediaItem.OriginalBlobName, ct);

        using var image = await Image.LoadAsync(originalStream, ct);
        image.Mutate(context => context.AutoOrient());

        var originalWidth = image.Width;
        var originalHeight = image.Height;

        var thumbnailBlobName = BuildDerivedBlobName(mediaItem, "thumbnails");
        var previewBlobName = BuildDerivedBlobName(mediaItem, "previews");

        await using var thumbnailStream = new MemoryStream();
        using (var thumbnailImage = image.Clone(context => context.Resize(new ResizeOptions
                 {
                     Mode = ResizeMode.Max,
                     Size = new Size(ThumbnailMaxPixels, ThumbnailMaxPixels)
                 })))
        {
            await thumbnailImage.SaveAsJpegAsync(thumbnailStream, new JpegEncoder
            {
                Quality = 75
            }, ct);
        }

        thumbnailStream.Position = 0;
        await mediaStorageService.UploadDerivedAsync(thumbnailBlobName, thumbnailStream, "image/jpeg", ct);

        await using var previewStream = new MemoryStream();
        using (var previewImage = image.Clone(context => context.Resize(new ResizeOptions
                 {
                     Mode = ResizeMode.Max,
                     Size = new Size(PreviewMaxPixels, PreviewMaxPixels)
                 })))
        {
            await previewImage.SaveAsJpegAsync(previewStream, new JpegEncoder
            {
                Quality = 92
            }, ct);
        }

        previewStream.Position = 0;
        await mediaStorageService.UploadDerivedAsync(previewBlobName, previewStream, "image/jpeg", ct);

        return new PhotoDerivativeResult
        {
            ThumbnailBlobName = thumbnailBlobName,
            ThumbnailBlobUrl = mediaStorageService.GetDerivedBlobUrl(thumbnailBlobName),
            PreviewBlobName = previewBlobName,
            PreviewBlobUrl = mediaStorageService.GetDerivedBlobUrl(previewBlobName),
            Width = originalWidth,
            Height = originalHeight,
            ProcessedAt = DateTime.UtcNow
        };
    }

    private static string BuildDerivedBlobName(MediaItem mediaItem, string variant)
    {
        var uploadDate = mediaItem.UploadedAt == default ? DateTime.UtcNow : mediaItem.UploadedAt;
        return $"events/{mediaItem.EventId}/photos/{variant}/{uploadDate:yyyy}/{uploadDate:MM}/{uploadDate:dd}/{mediaItem.Id}.jpg";
    }
}
