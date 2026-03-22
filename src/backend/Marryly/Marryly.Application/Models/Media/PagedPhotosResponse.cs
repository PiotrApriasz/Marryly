using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class PagedPhotosResponse
{
    [JsonProperty("items")]
    public required IReadOnlyList<MediaItem> Items { get; set; }

    [JsonProperty("continuationToken")]
    public string? ContinuationToken { get; set; }

    [JsonProperty("hasMore")]
    public required bool HasMore { get; set; }
}
