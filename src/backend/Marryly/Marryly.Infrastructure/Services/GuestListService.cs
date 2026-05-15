using System.Net;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.GuestList;
using Marryly.Infrastructure.Database;
using Microsoft.Azure.Cosmos;

namespace Marryly.Infrastructure.Services;

public class GuestListService(
    ICosmosDbService<GuestListEntry> cosmosDbService,
    ICosmosDbService<GuestInvitationGroup> groupCosmosDbService) : IGuestListService
{
    private const int CoupleCount = 2;

    public async Task<GuestListResponse> GetGuestListAsync(string eventId, CancellationToken ct = default)
    {
        var items = await GetGuestsAsync(eventId, ct);
        var groups = await GetGroupsAsync(eventId, ct);

        return new GuestListResponse
        {
            Items = items,
            Groups = groups,
            Summary = BuildSummary(items)
        };
    }

    public async Task<GuestInvitationGroup> CreateGroupAsync(string eventId, CreateGuestInvitationGroupRequest request, CancellationToken ct = default)
    {
        return await CreateGroupInternalAsync(eventId, request.DisplayName, request.InvitationLabel, ct);
    }

    public async Task<CreateGuestFamilyResponse> CreateFamilyAsync(string eventId, CreateGuestFamilyRequest request, CancellationToken ct = default)
    {
        if (request.Members.Count == 0)
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, "GUEST_FAMILY_MEMBERS_REQUIRED", "Family members required", "At least one family member is required.");
        }

        foreach (var member in request.Members)
        {
            NormalizeRequiredText(member.FullName, "GUEST_NAME_REQUIRED", "Guest name required", "Guest full name is required.");
            NormalizeCategory(member.Category);
            NormalizeAttendanceStatus(member.AttendanceStatus);
            NormalizeRelationship(member.RelationshipToGroup);
        }

        var group = await CreateGroupInternalAsync(eventId, request.DisplayName, request.InvitationLabel, ct);
        var items = new List<GuestListEntry>();

        foreach (var member in request.Members)
        {
            var entry = await CreateGuestAsync(eventId, new CreateGuestListEntryRequest
            {
                FullName = member.FullName,
                Category = member.Category,
                AttendanceStatus = member.AttendanceStatus,
                InvitationGroupId = group.Id,
                InvitationGroupName = group.DisplayName,
                RelationshipToGroup = member.RelationshipToGroup,
                NeedsAccommodation = member.NeedsAccommodation,
                HotelName = member.HotelName,
                RoomNameOrNumber = member.RoomNameOrNumber,
                NeedsTransport = member.NeedsTransport,
                TransportNotes = member.TransportNotes,
                Notes = member.Notes
            }, ct);
            items.Add(entry);
        }

        return new CreateGuestFamilyResponse
        {
            Group = group,
            Items = items
        };
    }

    public async Task<GuestListEntry> CreateGuestAsync(string eventId, CreateGuestListEntryRequest request, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var entry = new GuestListEntry
        {
            Id = Guid.NewGuid().ToString(),
            EventId = eventId,
            FullName = NormalizeRequiredText(request.FullName, "GUEST_NAME_REQUIRED", "Guest name required", "Guest full name is required."),
            Category = NormalizeCategory(request.Category),
            AttendanceStatus = NormalizeAttendanceStatus(request.AttendanceStatus),
            InvitationGroupId = NormalizeOptionalText(request.InvitationGroupId),
            InvitationGroupName = NormalizeOptionalText(request.InvitationGroupName),
            RelationshipToGroup = NormalizeRelationship(request.RelationshipToGroup),
            NeedsAccommodation = request.NeedsAccommodation ?? false,
            HotelName = NormalizeOptionalText(request.HotelName),
            RoomNameOrNumber = NormalizeOptionalText(request.RoomNameOrNumber),
            NeedsTransport = request.NeedsTransport ?? false,
            TransportNotes = NormalizeOptionalText(request.TransportNotes),
            Notes = NormalizeOptionalText(request.Notes),
            CreatedAt = now,
            UpdatedAt = now
        };

        NormalizeAccommodation(entry);
        NormalizeTransport(entry);
        NormalizeVendorAttendance(entry);

        return await cosmosDbService.AddAsync(entry, ct);
    }

    public async Task<GuestListEntry> UpdateGuestAsync(string eventId, string guestId, UpdateGuestListEntryRequest request, CancellationToken ct = default)
    {
        var entry = await GetRequiredGuestAsync(eventId, guestId, ct);

        if (request.FullName is not null)
        {
            entry.FullName = NormalizeRequiredText(request.FullName, "GUEST_NAME_REQUIRED", "Guest name required", "Guest full name is required.");
        }

        if (request.Category is not null)
        {
            entry.Category = NormalizeCategory(request.Category);
        }

        if (request.AttendanceStatus is not null)
        {
            entry.AttendanceStatus = NormalizeAttendanceStatus(request.AttendanceStatus);
        }

        if (request.InvitationGroupId is not null)
        {
            entry.InvitationGroupId = NormalizeOptionalText(request.InvitationGroupId);
        }

        if (request.InvitationGroupName is not null)
        {
            entry.InvitationGroupName = NormalizeOptionalText(request.InvitationGroupName);
        }

        if (request.RelationshipToGroup is not null)
        {
            entry.RelationshipToGroup = NormalizeRelationship(request.RelationshipToGroup);
        }

        if (request.NeedsAccommodation.HasValue)
        {
            entry.NeedsAccommodation = request.NeedsAccommodation.Value;
        }

        if (request.HotelName is not null)
        {
            entry.HotelName = NormalizeOptionalText(request.HotelName);
        }

        if (request.RoomNameOrNumber is not null)
        {
            entry.RoomNameOrNumber = NormalizeOptionalText(request.RoomNameOrNumber);
        }

        if (request.NeedsTransport.HasValue)
        {
            entry.NeedsTransport = request.NeedsTransport.Value;
        }

        if (request.TransportNotes is not null)
        {
            entry.TransportNotes = NormalizeOptionalText(request.TransportNotes);
        }

        if (request.Notes is not null)
        {
            entry.Notes = NormalizeOptionalText(request.Notes);
        }

        NormalizeAccommodation(entry);
        NormalizeTransport(entry);
        NormalizeVendorAttendance(entry);
        entry.UpdatedAt = DateTime.UtcNow;

        return await cosmosDbService.UpsertAsync(entry, ct);
    }

    public async Task DeleteGuestAsync(string eventId, string guestId, CancellationToken ct = default)
    {
        var entry = await GetRequiredGuestAsync(eventId, guestId, ct);
        await cosmosDbService.DeleteAsync(entry.Id, PartitionKeyResolver.ForEventIdBasedData(eventId), ct);
    }

    public async Task<GuestListSummary> GetSummaryAsync(string eventId, CancellationToken ct = default)
    {
        var items = await GetGuestsAsync(eventId, ct);
        return BuildSummary(items);
    }

    private async Task<GuestInvitationGroup> CreateGroupInternalAsync(
        string eventId,
        string? displayName,
        string? invitationLabel,
        CancellationToken ct)
    {
        var normalizedDisplayName = NormalizeRequiredText(displayName, "GUEST_GROUP_NAME_REQUIRED", "Guest group name required", "Guest group display name is required.");
        var normalizedInvitationLabel = string.IsNullOrWhiteSpace(invitationLabel)
            ? normalizedDisplayName
            : NormalizeRequiredText(invitationLabel, "GUEST_GROUP_INVITATION_LABEL_REQUIRED", "Guest group invitation label required", "Guest group invitation label is required.");
        var now = DateTime.UtcNow;
        var group = new GuestInvitationGroup
        {
            Id = Guid.NewGuid().ToString(),
            EventId = eventId,
            DisplayName = normalizedDisplayName,
            InvitationLabel = normalizedInvitationLabel,
            CreatedAt = now,
            UpdatedAt = now
        };

        return await groupCosmosDbService.AddAsync(group, ct);
    }

    private async Task<IReadOnlyList<GuestListEntry>> GetGuestsAsync(string eventId, CancellationToken ct)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.eventId = @eventId")
            .WithParameter("@eventId", eventId);

        var items = new List<GuestListEntry>();
        await foreach (var item in cosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
                       }, ct))
        {
            items.Add(item);
        }

        return items
            .OrderBy(item => item.CreatedAt)
            .ToList();
    }

    private async Task<IReadOnlyList<GuestInvitationGroup>> GetGroupsAsync(string eventId, CancellationToken ct)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.eventId = @eventId")
            .WithParameter("@eventId", eventId);

        var items = new List<GuestInvitationGroup>();
        await foreach (var item in groupCosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
                       }, ct))
        {
            items.Add(item);
        }

        return items
            .OrderBy(item => item.CreatedAt)
            .ToList();
    }

    private async Task<GuestListEntry> GetRequiredGuestAsync(string eventId, string guestId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(guestId))
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, "GUEST_ID_REQUIRED", "Guest id required", "Guest id is required.");
        }

        var entry = await cosmosDbService.GetAsync(guestId, PartitionKeyResolver.ForEventIdBasedData(eventId), ct);
        if (entry is null)
        {
            throw new ApiErrorException(HttpStatusCode.NotFound, "GUEST_NOT_FOUND", "Guest not found", "The requested guest does not exist.");
        }

        return entry;
    }

    private static GuestListSummary BuildSummary(IReadOnlyList<GuestListEntry> items)
    {
        var confirmedItems = items.Where(IsConfirmed).ToList();
        var confirmedCount = confirmedItems.Count;
        var invitedCount = items.Count;

        return new GuestListSummary
        {
            InvitedCount = invitedCount,
            ConfirmedCount = confirmedCount,
            ConfirmationPercent = invitedCount == 0 ? 0 : Math.Round(confirmedCount * 100d / invitedCount, 1),
            AttendingTotalWithCouple = confirmedCount + CoupleCount,
            VendorsCount = items.Count(item => string.Equals(item.Category, GuestCategory.Vendor, StringComparison.Ordinal)),
            AdultsCount = items.Count(item =>
                string.Equals(item.Category, GuestCategory.Adult, StringComparison.Ordinal) ||
                string.Equals(item.Category, GuestCategory.ChildOver10, StringComparison.Ordinal)),
            Children3To10Count = items.Count(item => string.Equals(item.Category, GuestCategory.Child3To10, StringComparison.Ordinal)),
            ChildrenUnder3Count = items.Count(item => string.Equals(item.Category, GuestCategory.ChildUnder3, StringComparison.Ordinal)),
            AccommodationNeededCount = items.Count(item => item.NeedsAccommodation),
            TransportNeededCount = items.Count(item => item.NeedsTransport)
        };
    }

    private static bool IsConfirmed(GuestListEntry item) =>
        string.Equals(item.Category, GuestCategory.Vendor, StringComparison.Ordinal) ||
        string.Equals(item.AttendanceStatus, AttendanceStatus.Confirmed, StringComparison.Ordinal);

    private static string NormalizeRequiredText(string? value, string code, string title, string detail)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, code, title, detail);
        }

        var normalizedValue = value.Trim();
        if (normalizedValue.Length > 200)
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, code, title, "Value must be shorter than 201 characters.");
        }

        return normalizedValue;
    }

    private static string? NormalizeOptionalText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalizedValue = value.Trim();
        return normalizedValue.Length <= 500 ? normalizedValue : normalizedValue[..500];
    }

    private static string NormalizeCategory(string? value)
    {
        var normalizedValue = string.IsNullOrWhiteSpace(value)
            ? GuestCategory.Adult
            : value.Trim().ToLowerInvariant();

        if (!GuestCategory.IsSupported(normalizedValue))
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, "GUEST_CATEGORY_INVALID", "Guest category invalid", "Guest category is not supported.");
        }

        return normalizedValue;
    }

    private static string NormalizeAttendanceStatus(string? value)
    {
        var normalizedValue = string.IsNullOrWhiteSpace(value)
            ? AttendanceStatus.Pending
            : value.Trim().ToLowerInvariant();

        if (!AttendanceStatus.IsSupported(normalizedValue))
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, "GUEST_ATTENDANCE_STATUS_INVALID", "Guest attendance status invalid", "Guest attendance status is not supported.");
        }

        return normalizedValue;
    }

    private static string? NormalizeRelationship(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalizedValue = value.Trim().ToLowerInvariant();
        if (!GuestRelationship.IsSupported(normalizedValue))
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, "GUEST_RELATIONSHIP_INVALID", "Guest relationship invalid", "Guest relationship is not supported.");
        }

        return normalizedValue;
    }

    private static void NormalizeAccommodation(GuestListEntry entry)
    {
        if (entry.NeedsAccommodation)
        {
            return;
        }

        entry.HotelName = null;
        entry.RoomNameOrNumber = null;
    }

    private static void NormalizeTransport(GuestListEntry entry)
    {
        if (entry.NeedsTransport)
        {
            return;
        }

        entry.TransportNotes = null;
    }

    private static void NormalizeVendorAttendance(GuestListEntry entry)
    {
        if (string.Equals(entry.Category, GuestCategory.Vendor, StringComparison.Ordinal))
        {
            entry.AttendanceStatus = AttendanceStatus.Confirmed;
        }
    }

}
