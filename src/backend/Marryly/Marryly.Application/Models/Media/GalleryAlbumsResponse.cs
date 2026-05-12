using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class GalleryAlbumsResponse
{
    [JsonProperty("items")]
    public required IReadOnlyList<GalleryAlbumResponse> Items { get; set; }
}
