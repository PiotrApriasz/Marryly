using Newtonsoft.Json;

namespace Marryly.Application.Models.EventDetails;

public class MenuSection
{
    [JsonProperty("name")]
    public required string Name { get; set; }
    
    [JsonProperty("items")]
    public required List<MenuItem> Items { get; set; }
}
