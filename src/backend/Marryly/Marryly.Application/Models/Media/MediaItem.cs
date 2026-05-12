using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class MediaItem : BaseModel
{
    [JsonProperty("kind")]
    public required string Kind { get; set; }

    [JsonProperty("status")]
    public required string Status { get; set; }

    [JsonProperty("albumId")]
    public string? AlbumId { get; set; }

    [JsonProperty("sourceType")]
    public string? SourceType { get; set; }

    [JsonProperty("originalBlobName")]
    public required string OriginalBlobName { get; set; }

    [JsonProperty("originalBlobUrl")]
    public required string OriginalBlobUrl { get; set; }

    [JsonProperty("thumbnailBlobName")]
    public string? ThumbnailBlobName { get; set; }

    [JsonProperty("thumbnailBlobUrl")]
    public string? ThumbnailBlobUrl { get; set; }

    [JsonProperty("previewBlobName")]
    public string? PreviewBlobName { get; set; }

    [JsonProperty("previewBlobUrl")]
    public string? PreviewBlobUrl { get; set; }

    [JsonProperty("contentType")]
    public required string ContentType { get; set; }

    [JsonProperty("sizeBytes")]
    public long SizeBytes { get; set; }

    [JsonProperty("uploadedAt")]
    public DateTime UploadedAt { get; set; }

    [JsonProperty("width")]
    public int Width { get; set; }

    [JsonProperty("height")]
    public int Height { get; set; }

    [JsonProperty("approved")]
    public bool Approved { get; set; }

    [JsonProperty("processedAt")]
    public DateTime? ProcessedAt { get; set; }

    [JsonProperty("processingError")]
    public string? ProcessingError { get; set; }
}
