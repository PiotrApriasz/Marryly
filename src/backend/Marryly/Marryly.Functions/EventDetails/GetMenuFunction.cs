using Marryly.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.EventDetails;

public class GetMenuFunction(ILogger<GetMenuFunction> logger, IEventDetailsService eventDetailsService)
{
    [Function("GetMenu")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "events/{eventId}/menu")] 
        HttpRequest req,
        string eventId)
    {
        logger.LogInformation("Downloading menu for event: {EventId}", eventId);

        try
        {
            var menu = await eventDetailsService.GetMenuAsync(eventId);

            if (menu == null)
            {
                logger.LogWarning("Menu not found for event: {EventId}", eventId);
                return new NotFoundObjectResult(new { message = "Menu hasn't been found" });
            }

            return new OkObjectResult(menu);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error while downloading menu for event: {EventId}", eventId);
            return new StatusCodeResult(StatusCodes.Status500InternalServerError);
        }
    }
}
