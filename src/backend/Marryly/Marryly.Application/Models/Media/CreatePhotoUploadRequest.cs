using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class CreatePhotoUploadRequest
{
    [JsonProperty("kind")]
    public string? Kind { get; set; }

    [JsonProperty("fileName")]
    public required string FileName { get; set; }

    [JsonProperty("fileSizeBytes")]
    public long FileSizeBytes { get; set; }

    [JsonProperty("contentType")]
    public required string ContentType { get; set; }

    [JsonProperty("lastModifiedAt")]
    public DateTimeOffset? LastModifiedAt { get; set; }
}
