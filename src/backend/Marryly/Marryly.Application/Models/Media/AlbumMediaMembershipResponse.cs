using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class AlbumMediaMembershipResponse
{
    [JsonProperty("processedCount")]
    public int ProcessedCount { get; set; }
}
