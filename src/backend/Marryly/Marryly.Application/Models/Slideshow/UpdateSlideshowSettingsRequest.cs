using Newtonsoft.Json;

namespace Marryly.Application.Models.Slideshow;

public class UpdateSlideshowSettingsRequest
{
    [JsonProperty("albumIds")]
    public IReadOnlyList<string>? AlbumIds { get; set; }

    [JsonProperty("albumId")]
    public string? LegacyAlbumId { get; set; }

    [JsonProperty("slideDurationSeconds")]
    public int? SlideDurationSeconds { get; set; }

    [JsonProperty("refreshIntervalSeconds")]
    public int? RefreshIntervalSeconds { get; set; }
}
