using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class CreatePhotoUploadRequest
{
    [JsonProperty("fileName")]
    public required string FileName { get; set; }

    [JsonProperty("fileSizeBytes")]
    public long FileSizeBytes { get; set; }

    [JsonProperty("contentType")]
    public required string ContentType { get; set; }

    [JsonProperty("lastModifiedAt")]
    public DateTimeOffset? LastModifiedAt { get; set; }
}
