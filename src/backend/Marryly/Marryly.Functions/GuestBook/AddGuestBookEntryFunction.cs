using System.Net;
using System.Text.Json;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.GuestBook;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.GuestBook;

public class AddGuestBookEntryFunction(ILogger<AddGuestBookEntryFunction> logger, IGuestBookService guestBookService)
{
    [Function("AddGuestBookEntry")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "events/{eventId}/guestbook")]
        HttpRequestData req,
        string eventId,
        CancellationToken ct)
    {
        AddGuestBookEntryRequest? request;

        try
        {
            request = await JsonSerializer.DeserializeAsync<AddGuestBookEntryRequest>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }, ct);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Invalid guestbook payload for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_GUESTBOOK_PAYLOAD",
                "Invalid guestbook payload",
                "Request body must contain valid guestbook entry data."
            );
        }

        if (request is null ||
            string.IsNullOrWhiteSpace(request.AuthorName) ||
            string.IsNullOrWhiteSpace(request.Message))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_GUESTBOOK_PAYLOAD",
                "Invalid guestbook payload",
                "Author name and message are required."
            );
        }

        var guestBookEntry = new GuestBookEntry
        {
            Id = Guid.NewGuid().ToString("N"),
            EventId = eventId,
            AuthorName = request.AuthorName.Trim(),
            Message = request.Message.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        try
        {
            var createdEntry = await guestBookService.AddGuestBookEntryAsync(eventId, guestBookEntry, ct);
            var response = req.CreateResponse(HttpStatusCode.Created);
            await response.WriteAsJsonAsync(createdEntry, ct);
            return response;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "Guestbook container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "GUESTBOOK_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Guestbook storage container is not available."
            );
        }
    }
}
