using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class GalleryShareLinkResponse
{
    [JsonProperty("id")]
    public required string Id { get; set; }

    [JsonProperty("description")]
    public string? Description { get; set; }

    [JsonProperty("albumIds")]
    public required IReadOnlyList<string> AlbumIds { get; set; }

    [JsonProperty("url")]
    public required string Url { get; set; }

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; }
}
