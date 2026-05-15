namespace Marryly.Application.Models.GuestList;

public class CreateGuestFamilyRequest
{
    public string? DisplayName { get; set; }
    public string? InvitationLabel { get; set; }
    public IReadOnlyList<CreateGuestFamilyMemberRequest> Members { get; set; } = [];
}
