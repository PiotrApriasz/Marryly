using Newtonsoft.Json;

namespace Marryly.Application.Models.GuestBook;

public class GuestBookEntry : BaseModel
{
    [JsonProperty("authorName")]
    public required string AuthorName { get; set; }
    
    [JsonProperty("message")]
    public required string Message { get; set; }

    [JsonProperty("mediaId")]
    public string? MediaId { get; set; }

    [JsonProperty("mediaKind")]
    public string? MediaKind { get; set; }

    [JsonProperty("mediaBlobName")]
    public string? MediaBlobName { get; set; }

    [JsonProperty("mediaUrl")]
    public string? MediaUrl { get; set; }

    [JsonProperty("mediaThumbnailUrl")]
    public string? MediaThumbnailUrl { get; set; }

    [JsonProperty("mediaContentType")]
    public string? MediaContentType { get; set; }

    [JsonProperty("mediaSizeBytes")]
    public long? MediaSizeBytes { get; set; }

    [JsonProperty("videoMediaId")]
    public string? VideoMediaId { get; set; }

    [JsonProperty("videoBlobName")]
    public string? VideoBlobName { get; set; }

    [JsonProperty("videoUrl")]
    public string? VideoUrl { get; set; }

    [JsonProperty("videoContentType")]
    public string? VideoContentType { get; set; }

    [JsonProperty("videoSizeBytes")]
    public long? VideoSizeBytes { get; set; }

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; }
}
