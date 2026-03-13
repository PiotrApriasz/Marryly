namespace Marryly.Application.Models.GuestBook;

public class AddGuestBookEntryRequest
{
    public required string AuthorName { get; set; }

    public required string Message { get; set; }
}
