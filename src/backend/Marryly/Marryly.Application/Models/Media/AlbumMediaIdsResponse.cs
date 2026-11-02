using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class AlbumMediaIdsResponse
{
    [JsonProperty("mediaIds")]
    public required IReadOnlyList<string> MediaIds { get; set; }
}
