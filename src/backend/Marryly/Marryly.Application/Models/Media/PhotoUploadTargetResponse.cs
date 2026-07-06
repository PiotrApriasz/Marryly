using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class PhotoUploadTargetResponse
{
    [JsonProperty("mediaId")]
    public required string MediaId { get; set; }

    [JsonProperty("photoId")]
    public required string PhotoId { get; set; }

    [JsonProperty("kind")]
    public required string Kind { get; set; }

    [JsonProperty("blobName")]
    public required string BlobName { get; set; }

    [JsonProperty("blobUrl")]
    public required string BlobUrl { get; set; }

    [JsonProperty("uploadUrl")]
    public required string UploadUrl { get; set; }

    [JsonProperty("expiresAt")]
    public DateTime ExpiresAt { get; set; }

    [JsonProperty("requiredHeaders")]
    public required IReadOnlyDictionary<string, string> RequiredHeaders { get; set; }
}
