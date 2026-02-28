using Newtonsoft.Json;

namespace Marryly.Application.Models.EventDetails;

public class MenuItem
{
    [JsonProperty("name")]
    public required string Name { get; set; }
}
