using System.Text.Json.Serialization;

namespace Marryly.Application.Models.Media;

public class DownloadSharedGalleryPhotosRequest
{
    [JsonPropertyName("mediaIds")]
    public IReadOnlyList<string> MediaIds { get; set; } = [];
}
