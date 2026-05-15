using System.Net;
using System.Text.Json;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.GuestList;
using Marryly.Functions.Media;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.GuestList;

public class GuestListFunctions(
    ILogger<GuestListFunctions> logger,
    IAuthService authService,
    IGuestListService guestListService)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Function("GetPanelGuests")]
    public async Task<HttpResponseData> GetGuests(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/guests")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;

        try
        {
            var response = await guestListService.GetGuestListAsync(eventId, ct);
            return await ApiResponse.ProduceSuccessResponse(req, response);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "GuestList container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "GUEST_LIST_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Guest list storage container is not available.");
        }
    }

    [Function("CreatePanelGuest")]
    public async Task<HttpResponseData> CreateGuest(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/guests")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;
        var request = await ReadPayloadAsync<CreateGuestListEntryRequest>(req, "INVALID_GUEST_PAYLOAD", "Invalid guest payload", ct);
        if (request.Response is not null)
        {
            return request.Response;
        }

        try
        {
            var entry = await guestListService.CreateGuestAsync(eventId, request.Value!, ct);
            return await ApiResponse.ProduceSuccessResponse(req, entry);
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "GuestList container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "GUEST_LIST_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Guest list storage container is not available.");
        }
    }

    [Function("CreatePanelGuestGroup")]
    public async Task<HttpResponseData> CreateGuestGroup(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/guest-groups")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;
        var request = await ReadPayloadAsync<CreateGuestInvitationGroupRequest>(req, "INVALID_GUEST_GROUP_PAYLOAD", "Invalid guest group payload", ct);
        if (request.Response is not null)
        {
            return request.Response;
        }

        try
        {
            var group = await guestListService.CreateGroupAsync(eventId, request.Value!, ct);
            return await ApiResponse.ProduceSuccessResponse(req, group);
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "GuestInvitationGroups container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "GUEST_GROUPS_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Guest groups storage container is not available.");
        }
    }

    [Function("CreatePanelGuestFamily")]
    public async Task<HttpResponseData> CreateGuestFamily(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/guest-families")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;
        var request = await ReadPayloadAsync<CreateGuestFamilyRequest>(req, "INVALID_GUEST_FAMILY_PAYLOAD", "Invalid guest family payload", ct);
        if (request.Response is not null)
        {
            return request.Response;
        }

        try
        {
            var family = await guestListService.CreateFamilyAsync(eventId, request.Value!, ct);
            return await ApiResponse.ProduceSuccessResponse(req, family);
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "Guest list family storage is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "GUEST_FAMILY_STORAGE_NOT_FOUND",
                "Storage configuration error",
                "Guest list family storage is not available.");
        }
    }

    [Function("UpdatePanelGuest")]
    public async Task<HttpResponseData> UpdateGuest(
        [HttpTrigger(AuthorizationLevel.Anonymous, "patch", Route = "panel/guests/{guestId}")]
        HttpRequestData req,
        string guestId,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;
        var request = await ReadPayloadAsync<UpdateGuestListEntryRequest>(req, "INVALID_GUEST_PAYLOAD", "Invalid guest payload", ct);
        if (request.Response is not null)
        {
            return request.Response;
        }

        try
        {
            var entry = await guestListService.UpdateGuestAsync(eventId, guestId, request.Value!, ct);
            return await ApiResponse.ProduceSuccessResponse(req, entry);
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "GuestList container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "GUEST_LIST_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Guest list storage container is not available.");
        }
    }

    [Function("DeletePanelGuest")]
    public async Task<HttpResponseData> DeleteGuest(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "panel/guests/{guestId}")]
        HttpRequestData req,
        string guestId,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;

        try
        {
            await guestListService.DeleteGuestAsync(eventId, guestId, ct);
            return req.CreateResponse(HttpStatusCode.NoContent);
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "GuestList container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "GUEST_LIST_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Guest list storage container is not available.");
        }
    }

    private async Task<(HttpResponseData? Response, T? Value)> ReadPayloadAsync<T>(
        HttpRequestData req,
        string code,
        string title,
        CancellationToken ct)
        where T : class
    {
        try
        {
            var value = await JsonSerializer.DeserializeAsync<T>(req.Body, JsonOptions, ct);
            if (value is not null)
            {
                return (null, value);
            }
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Invalid guest list payload.");
        }

        var response = await ApiResponse.ProduceErrorResponse(
            req,
            HttpStatusCode.BadRequest,
            code,
            title,
            "Request body must contain valid guest data.");
        return (response, null);
    }
}
