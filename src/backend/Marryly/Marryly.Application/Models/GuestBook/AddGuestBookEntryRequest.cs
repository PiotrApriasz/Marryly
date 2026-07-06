namespace Marryly.Application.Models.GuestBook;

public class AddGuestBookEntryRequest
{
    public required string AuthorName { get; set; }

    public string? Message { get; set; }

    public string? MediaId { get; set; }

    public string? VideoMediaId { get; set; }
}
