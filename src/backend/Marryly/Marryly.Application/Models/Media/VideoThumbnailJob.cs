namespace Marryly.Application.Models.Media;

public sealed class VideoThumbnailJob
{
    public required string EventId { get; init; }
    public required string MediaId { get; init; }
}
