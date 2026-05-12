using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class CreateAlbumRequest
{
    [JsonProperty("title")]
    public required string Title { get; set; }

    [JsonProperty("description")]
    public string? Description { get; set; }

    [JsonProperty("isVisible")]
    public bool? IsVisible { get; set; }
}
