namespace Marryly.Application.Models.GuestList;

public class CreateGuestFamilyMemberRequest
{
    public string? FullName { get; set; }
    public string? Category { get; set; }
    public string? AttendanceStatus { get; set; }
    public string? RelationshipToGroup { get; set; }
    public bool? NeedsAccommodation { get; set; }
    public string? HotelName { get; set; }
    public string? RoomNameOrNumber { get; set; }
    public bool? NeedsTransport { get; set; }
    public string? TransportNotes { get; set; }
    public string? Notes { get; set; }
}
