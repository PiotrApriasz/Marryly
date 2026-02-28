using Marryly.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.EventDetails;

public class GetEventsFunction(ILogger<GetEventsFunction> logger, IEventDetailsService eventDetailsService)
{
    [Function("GetEvents")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "events/{eventId}/schedule")] 
        HttpRequest req,
        string eventId)
    {
        logger.LogInformation("Downloading wedding events: {EventId}", eventId);

        try
        {
            var events = await eventDetailsService.GetEventsAsync(eventId);

            if (events.Count == 0)
            {
                logger.LogWarning("No events for: {EventId}", eventId);
                return new OkObjectResult(new List<object>());
            }

            return new OkObjectResult(events);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error while downloading events: {EventId}", eventId);
            return new StatusCodeResult(StatusCodes.Status500InternalServerError);
        }
    }
}
