using System.Net;
using System.Text.Json;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.EventDetails;
using Marryly.Functions.Media;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.EventDetails;

public class AdminMenuFunctions(
    ILogger<AdminMenuFunctions> logger,
    IAuthService authService,
    IEventDetailsService eventDetailsService)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Function("GetPanelMenu")]
    public async Task<HttpResponseData> GetMenu(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/menu")]
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
            var menu = await eventDetailsService.GetAdminMenuAsync(eventId, ct);
            return await ApiResponse.ProduceSuccessResponse(req, menu);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "EventData container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "EVENT_DATA_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Event details storage container is not available.");
        }
    }

    [Function("SavePanelMenu")]
    public async Task<HttpResponseData> SaveMenu(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "panel/menu")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        var eventId = auth.Context!.EventId;
        var request = await ReadPayloadAsync(req, ct);
        if (request.Response is not null)
        {
            return request.Response;
        }

        try
        {
            var menu = await eventDetailsService.SaveMenuAsync(eventId, request.Value!, ct);
            return await ApiResponse.ProduceSuccessResponse(req, menu);
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "EventData container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "EVENT_DATA_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Event details storage container is not available.");
        }
    }

    private async Task<(HttpResponseData? Response, SaveWeddingMenuRequest? Value)> ReadPayloadAsync(
        HttpRequestData req,
        CancellationToken ct)
    {
        try
        {
            var value = await JsonSerializer.DeserializeAsync<SaveWeddingMenuRequest>(req.Body, JsonOptions, ct);
            if (value is not null)
            {
                return (null, value);
            }
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Invalid menu payload.");
        }

        var response = await ApiResponse.ProduceErrorResponse(
            req,
            HttpStatusCode.BadRequest,
            "INVALID_MENU_PAYLOAD",
            "Invalid menu payload",
            "Request body must contain valid menu data.");
        return (response, null);
    }
}
