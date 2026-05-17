using Newtonsoft.Json;

namespace Marryly.Application.Models.Slideshow;

public class AdminSlideshowPhotoResponse
{
    [JsonProperty("id")]
    public required string Id { get; set; }

    [JsonProperty("uploadedAt")]
    public DateTime UploadedAt { get; set; }

    [JsonProperty("displayUrl")]
    public required string DisplayUrl { get; set; }

    [JsonProperty("width")]
    public int Width { get; set; }

    [JsonProperty("height")]
    public int Height { get; set; }
}
