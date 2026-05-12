using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class ReorderAlbumsRequest
{
    [JsonProperty("albumIds")]
    public required IReadOnlyList<string> AlbumIds { get; set; }
}
