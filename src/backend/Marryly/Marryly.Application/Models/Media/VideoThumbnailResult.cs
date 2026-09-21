namespace Marryly.Application.Models.Media;

public sealed class VideoThumbnailResult
{
    public required string ThumbnailBlobName { get; init; }
    public required string ThumbnailBlobUrl { get; init; }
    public required int Width { get; init; }
    public required int Height { get; init; }
    public required DateTime ProcessedAt { get; init; }
}
