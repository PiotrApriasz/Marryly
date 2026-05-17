using Newtonsoft.Json;

namespace Marryly.Application.Models.EventDetails;

public class WeddingMenu : EventDetail
{
    [JsonProperty("title")]
    public string Title { get; set; } = "Menu weselne";

    [JsonProperty("blocks")]
    public List<MenuBlock> Blocks { get; set; } = [];

    [JsonProperty("sections")]
    public List<MenuSection>? Sections { get; set; }
}
