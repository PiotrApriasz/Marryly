namespace Marryly.Application.Models.EventDetails;

public class SaveWeddingMenuRequest
{
    public string? Title { get; set; }
    public List<SaveWeddingMenuBlockRequest>? Blocks { get; set; }
}

public class SaveWeddingMenuBlockRequest
{
    public string? Title { get; set; }
    public int? SortOrder { get; set; }
    public List<SaveWeddingMenuSectionRequest>? Sections { get; set; }
}

public class SaveWeddingMenuSectionRequest
{
    public string? SectionType { get; set; }
    public string? Name { get; set; }
    public int? ChoicesCount { get; set; }
    public int? SortOrder { get; set; }
    public List<SaveWeddingMenuItemRequest>? Items { get; set; }
}

public class SaveWeddingMenuItemRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int? SortOrder { get; set; }
}
