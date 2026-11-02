using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class DeleteSelectedAlbumMediaResponse
{
    [JsonProperty("deletedCount")]
    public int DeletedCount { get; set; }
}
