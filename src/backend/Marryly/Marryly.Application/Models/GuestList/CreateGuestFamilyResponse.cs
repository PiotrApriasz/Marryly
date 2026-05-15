namespace Marryly.Application.Models.GuestList;

public class CreateGuestFamilyResponse
{
    public required GuestInvitationGroup Group { get; set; }
    public required IReadOnlyList<GuestListEntry> Items { get; set; }
}
