using Newtonsoft.Json;

namespace Marryly.Application.Models.Slideshow;

public class AdminSlideshowPhotosResponse
{
    [JsonProperty("items")]
    public required IReadOnlyList<AdminSlideshowPhotoResponse> Items { get; set; }
}
