using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class CompletePhotoUploadRequest
{
    [JsonProperty("blobName")]
    public required string BlobName { get; set; }

    [JsonProperty("blobUrl")]
    public required string BlobUrl { get; set; }

    [JsonProperty("contentType")]
    public required string ContentType { get; set; }

    [JsonProperty("sizeBytes")]
    public long SizeBytes { get; set; }
}
