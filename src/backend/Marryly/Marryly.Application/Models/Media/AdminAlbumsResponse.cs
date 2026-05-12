using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class AdminAlbumsResponse
{
    [JsonProperty("items")]
    public required IReadOnlyList<AdminAlbumResponse> Items { get; set; }
}
