using Newtonsoft.Json;

namespace Marryly.Application.Models.EventDetails;

public class WeddingEvent : EventDetail
{
    [JsonProperty("title")]
    public required string Title { get; set; }
    
    [JsonProperty("startsAt")]
    public DateTime StartsAt { get; set; }
    
    [JsonProperty("endsAt")]
    public DateTime EndsAt { get; set; }
    
    [JsonProperty("location")]
    public required string Location { get; set; }
}
