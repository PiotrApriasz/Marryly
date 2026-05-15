using Marryly.Application.Models.GuestList;

namespace Marryly.Application.Interfaces;

public interface IGuestListService
{
    Task<GuestListResponse> GetGuestListAsync(string eventId, CancellationToken ct = default);
    Task<GuestInvitationGroup> CreateGroupAsync(string eventId, CreateGuestInvitationGroupRequest request, CancellationToken ct = default);
    Task<CreateGuestFamilyResponse> CreateFamilyAsync(string eventId, CreateGuestFamilyRequest request, CancellationToken ct = default);
    Task<GuestListEntry> CreateGuestAsync(string eventId, CreateGuestListEntryRequest request, CancellationToken ct = default);
    Task<GuestListEntry> UpdateGuestAsync(string eventId, string guestId, UpdateGuestListEntryRequest request, CancellationToken ct = default);
    Task DeleteGuestAsync(string eventId, string guestId, CancellationToken ct = default);
    Task<GuestListSummary> GetSummaryAsync(string eventId, CancellationToken ct = default);
}
