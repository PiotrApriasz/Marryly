using Newtonsoft.Json;

namespace Marryly.Application.Models;

public class BaseModel
{
    [JsonProperty("id")]
    public required string Id { get; set; }
}