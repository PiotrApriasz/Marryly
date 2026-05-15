using Newtonsoft.Json;

namespace Marryly.Application.Models.GuestList;

public class GuestInvitationGroup : BaseModel
{
    [JsonProperty("displayName")]
    public required string DisplayName { get; set; }

    [JsonProperty("invitationLabel")]
    public required string InvitationLabel { get; set; }

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; }

    [JsonProperty("updatedAt")]
    public DateTime UpdatedAt { get; set; }
}
