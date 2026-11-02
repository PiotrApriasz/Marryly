using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class DeleteSelectedAlbumMediaRequest
{
    [JsonProperty("mediaIds")]
    public IReadOnlyList<string>? MediaIds { get; set; }
}
