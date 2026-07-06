using System.Net;
using System.Text.Json;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Functions.Result;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class CreateMediaUploadFunction(
    ILogger<CreateMediaUploadFunction> logger,
    IAuthService authService,
    IPhotoUploadService photoUploadService)
{
    [Function("CreateMediaUpload")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "app/media/uploads")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var authResponse = await AuthHelpers.ValidateUserAsync(req, authService);
        if (authResponse.Response is not null)
        {
            return authResponse.Response;
        }

        var eventId = authResponse.Context!.EventId;
        CreatePhotoUploadRequest? request;

        try
        {
            request = await JsonSerializer.DeserializeAsync<CreatePhotoUploadRequest>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }, ct);
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Invalid media upload payload for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_MEDIA_UPLOAD_PAYLOAD",
                "Invalid media upload payload",
                "Request body must contain valid media upload data.");
        }

        if (request is null)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_MEDIA_UPLOAD_PAYLOAD",
                "Invalid media upload payload",
                "Request body is required.");
        }

        try
        {
            var target = await photoUploadService.CreateMediaUploadAsync(eventId, request, ct);
            return await ApiResponse.ProduceSuccessResponse(req, target);
        }
        catch (ApiErrorException ex)
        {
            logger.LogWarning("Media upload init failed for event {EventId}: {Code}", eventId, ex.Code);
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
    }
}
