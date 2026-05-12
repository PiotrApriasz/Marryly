using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class GalleryMediaItemResponse
{
    [JsonProperty("id")]
    public required string Id { get; set; }

    [JsonProperty("eventId")]
    public required string EventId { get; set; }

    [JsonProperty("url")]
    public string? Url { get; set; }

    [JsonProperty("thumbnailUrl")]
    public string? ThumbnailUrl { get; set; }

    [JsonProperty("uploadedAt")]
    public DateTime UploadedAt { get; set; }

    [JsonProperty("approved")]
    public bool Approved { get; set; }

    [JsonProperty("width")]
    public int Width { get; set; }

    [JsonProperty("height")]
    public int Height { get; set; }
}
