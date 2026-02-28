using Newtonsoft.Json;

namespace Marryly.Application.Models.EventDetails;

public class WeddingMenu : EventDetail
{
    [JsonProperty("title")]
    public required string Title { get; set; }
    
    [JsonProperty("sections")]
    public required List<MenuSection> Sections { get; set; }
}
