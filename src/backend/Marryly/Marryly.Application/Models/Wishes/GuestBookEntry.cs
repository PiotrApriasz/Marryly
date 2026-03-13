using Newtonsoft.Json;

namespace Marryly.Application.Models.Wishes;

public class GuestBookEntry : BaseModel
{
    [JsonProperty("name")]
    public required string Name { get; set; }
    
    [JsonProperty("message")]
    public required string Message { get; set; }
}