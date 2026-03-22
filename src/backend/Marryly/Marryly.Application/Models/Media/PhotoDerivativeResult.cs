namespace Marryly.Application.Models.Media;

public sealed class PhotoDerivativeResult
{
    public required string ThumbnailBlobName { get; init; }
    public required string ThumbnailBlobUrl { get; init; }
    public required string PreviewBlobName { get; init; }
    public required string PreviewBlobUrl { get; init; }
    public required int Width { get; init; }
    public required int Height { get; init; }
    public DateTime ProcessedAt { get; init; }
}
