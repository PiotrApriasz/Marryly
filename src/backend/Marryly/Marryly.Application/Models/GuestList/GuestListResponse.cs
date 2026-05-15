namespace Marryly.Application.Models.GuestList;

public class GuestListResponse
{
    public required IReadOnlyList<GuestListEntry> Items { get; set; }
    public required IReadOnlyList<GuestInvitationGroup> Groups { get; set; }
    public required GuestListSummary Summary { get; set; }
}
