using Newtonsoft.Json;

namespace Marryly.Application.Models.EventDetails;

public class MenuItem
{
    [JsonProperty("name")]
    public string Name { get; set; } = string.Empty;

    [JsonProperty("description")]
    public string? Description { get; set; }

    [JsonProperty("sortOrder")]
    public int SortOrder { get; set; }
}
