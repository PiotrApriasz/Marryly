using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class GalleryAlbumResponse
{
    [JsonProperty("id")]
    public required string Id { get; set; }

    [JsonProperty("title")]
    public required string Title { get; set; }

    [JsonProperty("slug")]
    public required string Slug { get; set; }

    [JsonProperty("description")]
    public string? Description { get; set; }

    [JsonProperty("coverUrl")]
    public string? CoverUrl { get; set; }

    [JsonProperty("itemCount")]
    public int ItemCount { get; set; }
}
