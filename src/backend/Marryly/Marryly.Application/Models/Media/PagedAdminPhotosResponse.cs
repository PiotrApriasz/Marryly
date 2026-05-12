using Newtonsoft.Json;

namespace Marryly.Application.Models.Media;

public class PagedAdminPhotosResponse
{
    [JsonProperty("items")]
    public required IReadOnlyList<AdminPhotoItemResponse> Items { get; set; }

    [JsonProperty("page")]
    public required int Page { get; set; }

    [JsonProperty("pageSize")]
    public required int PageSize { get; set; }

    [JsonProperty("totalCount")]
    public required int TotalCount { get; set; }

    [JsonProperty("totalPages")]
    public required int TotalPages { get; set; }
}
