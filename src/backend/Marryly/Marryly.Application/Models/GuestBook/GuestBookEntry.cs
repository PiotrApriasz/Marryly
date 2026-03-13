using Newtonsoft.Json;

namespace Marryly.Application.Models.GuestBook;

public class GuestBookEntry : BaseModel
{
    [JsonProperty("authorName")]
    public required string AuthorName { get; set; }
    
    [JsonProperty("message")]
    public required string Message { get; set; }

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; }
}