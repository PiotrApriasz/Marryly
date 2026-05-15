using Newtonsoft.Json;

namespace Marryly.Application.Models.GuestList;

public class GuestListEntry : BaseModel
{
    [JsonProperty("fullName")]
    public required string FullName { get; set; }

    [JsonProperty("category")]
    public required string Category { get; set; }

    [JsonProperty("attendanceStatus")]
    public required string AttendanceStatus { get; set; }

    [JsonProperty("invitationGroupId")]
    public string? InvitationGroupId { get; set; }

    [JsonProperty("invitationGroupName")]
    public string? InvitationGroupName { get; set; }

    [JsonProperty("relationshipToGroup")]
    public string? RelationshipToGroup { get; set; }

    [JsonProperty("needsAccommodation")]
    public bool NeedsAccommodation { get; set; }

    [JsonProperty("hotelName")]
    public string? HotelName { get; set; }

    [JsonProperty("roomNameOrNumber")]
    public string? RoomNameOrNumber { get; set; }

    [JsonProperty("needsTransport")]
    public bool NeedsTransport { get; set; }

    [JsonProperty("transportNotes")]
    public string? TransportNotes { get; set; }

    [JsonProperty("notes")]
    public string? Notes { get; set; }

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; }

    [JsonProperty("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
