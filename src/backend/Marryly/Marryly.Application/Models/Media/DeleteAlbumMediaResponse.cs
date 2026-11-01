using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class DeleteAlbumMediaResponse
{
    [JsonProperty("deletedCount")]
    public int DeletedCount { get; set; }

    [JsonProperty("hasMore")]
    public bool HasMore { get; set; }
}
