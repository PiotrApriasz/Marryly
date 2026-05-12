using Marryly.Application.Models;
using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class Album : BaseModel
{
    [JsonProperty("title")]
    public required string Title { get; set; }

    [JsonProperty("slug")]
    public required string Slug { get; set; }

    [JsonProperty("description")]
    public string? Description { get; set; }

    [JsonProperty("isSystem")]
    public bool IsSystem { get; set; }

    [JsonProperty("isVisible")]
    public bool IsVisible { get; set; }

    [JsonProperty("sortOrder")]
    public int SortOrder { get; set; }

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; }

    [JsonProperty("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
