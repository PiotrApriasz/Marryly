using System.Net;
using System.Text.Json;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Functions.Media;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.GuestBook;

public class CompleteGuestBookMediaUploadFunction(
    ILogger<CompleteGuestBookMediaUploadFunction> logger,
    IAuthService authService,
    IPhotoUploadService photoUploadService)
{
    private const string GuestBookMediaAlbumId = "guestbook-media-wishes";
    private const string GuestBookSourceType = "guestbook";

    [Function("CompleteGuestBookMediaUpload")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "app/guestbook/media/uploads/{mediaId}/complete")]
        HttpRequestData req,
        string mediaId,
        CancellationToken ct)
    {
        var authResponse = await AuthHelpers.ValidateUserAsync(req, authService);
        if (authResponse.Response is not null)
        {
            return authResponse.Response;
        }

        var eventId = authResponse.Context!.EventId;
        CompletePhotoUploadRequest? request;

        try
        {
            request = await JsonSerializer.DeserializeAsync<CompletePhotoUploadRequest>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }, ct);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Invalid guestbook media completion payload for event: {EventId}, media: {MediaId}", eventId, mediaId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_GUESTBOOK_MEDIA_COMPLETION_PAYLOAD",
                "Invalid guestbook media completion payload",
                "Request body must contain valid guestbook media completion data.");
        }

        var normalizedKind = request?.Kind?.Trim().ToLowerInvariant();
        if (request is null ||
            !(string.Equals(normalizedKind, "photo", StringComparison.Ordinal) ||
              string.Equals(normalizedKind, "video", StringComparison.Ordinal)))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_GUESTBOOK_MEDIA_COMPLETION_PAYLOAD",
                "Invalid guestbook media completion payload",
                "Media kind must be photo or video.");
        }

        request.Kind = normalizedKind;

        try
        {
            var savedItem = await photoUploadService.CompleteMediaUploadAsync(
                eventId,
                mediaId,
                GuestBookMediaAlbumId,
                GuestBookSourceType,
                request,
                ct);

            var response = req.CreateResponse(HttpStatusCode.Created);
            await response.WriteAsJsonAsync(savedItem, ct);
            return response;
        }
        catch (ApiErrorException ex)
        {
            logger.LogWarning("Guestbook media upload completion failed for event {EventId}, media {MediaId}: {Code}", eventId, mediaId, ex.Code);
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "Media container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "MEDIA_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Media storage container is not available.");
        }
    }
}
