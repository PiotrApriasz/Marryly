using System.Net;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.EventDetails;

public class GetMenuFunction(ILogger<GetMenuFunction> logger, IEventDetailsService eventDetailsService)
{
    [Function("GetMenu")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "events/{eventId}/menu")] 
        HttpRequestData req,
        string eventId)
    {
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
