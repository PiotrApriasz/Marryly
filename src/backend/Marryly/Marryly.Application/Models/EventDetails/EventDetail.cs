using Newtonsoft.Json;

namespace Marryly.Application.Models.EventDetails;

public class EventDetail
{
    [JsonProperty("id")]
    public required string Id { get; set; }
    
    [JsonProperty("eventId")]
    public required string EventId { get; set; }
    
    [JsonProperty("type")]
    public required string Type { get; set; }
}