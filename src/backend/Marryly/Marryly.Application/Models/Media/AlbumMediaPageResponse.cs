using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class AlbumMediaPageResponse
{
    [JsonProperty("items")]
    public required IReadOnlyList<GalleryMediaItemResponse> Items { get; set; }

    [JsonProperty("continuationToken")]
    public string? ContinuationToken { get; set; }

    [JsonProperty("hasMore")]
    public bool HasMore { get; set; }
}
