using Newtonsoft.Json;

namespace Marryly.Application.Models.Slideshow;

public class SlideshowSettings : BaseModel
{
    [JsonProperty("albumIds")]
    public required List<string> AlbumIds { get; set; }

    [JsonProperty("albumId")]
    public string? LegacyAlbumId { get; set; }

    [JsonProperty("slideDurationSeconds")]
    public int SlideDurationSeconds { get; set; }

    [JsonProperty("refreshIntervalSeconds")]
    public int RefreshIntervalSeconds { get; set; }

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; }

    [JsonProperty("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
