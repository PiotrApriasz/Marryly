using Newtonsoft.Json;

namespace Marryly.Application.Models.EventDetails;

public class MenuBlock
{
    [JsonProperty("title")]
    public string Title { get; set; } = "Główne menu weselne";

    [JsonProperty("sortOrder")]
    public int SortOrder { get; set; }

    [JsonProperty("sections")]
    public List<MenuSection> Sections { get; set; } = [];
}
