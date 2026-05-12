using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class UpdateAlbumRequest
{
    [JsonProperty("title")]
    public string? Title { get; set; }

    [JsonProperty("description")]
    public string? Description { get; set; }

    [JsonProperty("isVisible")]
    public bool? IsVisible { get; set; }
}
