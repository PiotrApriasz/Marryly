using System.Net;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.EventDetails;

public class GetMenuFunction(
    ILogger<GetMenuFunction> logger,
    IAuthService authService,
    IEventDetailsService eventDetailsService)
{
    [Function("GetMenu")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "app/menu")]
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
        logger.LogInformation("Downloading menu for event: {EventId}", eventId);

        var menu = await eventDetailsService.GetMenuAsync(eventId);

        if (menu == null)
        {
            logger.LogWarning("Menu not found for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(req, HttpStatusCode.NotFound, "MENU_NOT_FOUND", "Menu not found", "Menu for this event does not exist.");
        }

        return await ApiResponse.ProduceSuccessResponse(req, menu);
    }
}
