using Newtonsoft.Json;

namespace Marryly.Application.Models.Slideshow;

public class AdminSlideshowSettingsResponse
{
    [JsonProperty("albumIds")]
    public required IReadOnlyList<string> AlbumIds { get; set; }

    [JsonProperty("slideDurationSeconds")]
    public int SlideDurationSeconds { get; set; }

    [JsonProperty("refreshIntervalSeconds")]
    public int RefreshIntervalSeconds { get; set; }

    [JsonProperty("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
