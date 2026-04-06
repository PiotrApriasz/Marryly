using System.Net;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.EventDetails;

public class GetEventsFunction(
    ILogger<GetEventsFunction> logger,
    IAuthService authService,
    IEventDetailsService eventDetailsService)
{
    [Function("GetEvents")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "app/schedule")]
        HttpRequestData req)
    {
        var token = authService.ReadAccessToken(req);
        if (string.IsNullOrWhiteSpace(token))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "SESSION_NOT_FOUND",
                "Unauthorized",
                "Access token is missing."
            );
        }

        if (!authService.TryValidateToken(token, out var context))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Unauthorized,
                "SESSION_INVALID",
                "Unauthorized",
                "Session is invalid or expired."
            );
        }

        var eventId = context.EventId;
        logger.LogInformation("Downloading wedding events: {EventId}", eventId);

        try
        {
            var events = await eventDetailsService.GetEventsAsync(eventId);

            if (events.Count == 0)
            {
                logger.LogWarning("No events for: {EventId}", eventId);
                return await ApiResponse.ProduceSuccessResponse(req, new List<object>());
            }

            return await ApiResponse.ProduceSuccessResponse(req, events);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error while downloading events: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "SCHEDULE_FETCH_FAILED",
                "Schedule fetch failed",
                "Unable to download the wedding schedule."
            );
        }
    }
}
