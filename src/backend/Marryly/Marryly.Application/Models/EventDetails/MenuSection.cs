using Newtonsoft.Json;

namespace Marryly.Application.Models.EventDetails;

public class MenuSection
{
    [JsonProperty("sectionType")]
    public string SectionType { get; set; } = WeddingMenuSectionTypes.Inne;

    [JsonProperty("name")]
    public string Name { get; set; } = string.Empty;

    [JsonProperty("choicesCount")]
    public int? ChoicesCount { get; set; }

    [JsonProperty("sortOrder")]
    public int SortOrder { get; set; }

    [JsonProperty("items")]
    public List<MenuItem> Items { get; set; } = [];
}
