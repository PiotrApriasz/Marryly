using System.Net;
using Marryly.Application.Constants;
using Marryly.Application.Interfaces;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class DeletePhotoFunction(
    ILogger<DeletePhotoFunction> logger,
    IAuthService authService,
    IMediaService mediaService)
{
    [Function("DeletePhoto")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "panel/media/{photoId}")]
        HttpRequestData req,
        string photoId,
        CancellationToken ct)
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

        if (!string.Equals(context.Role, AuthConstants.AdminRole, StringComparison.Ordinal))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.Forbidden,
                "ACCESS_FORBIDDEN",
                "Forbidden",
                "Admin access is required."
            );
        }

        if (string.IsNullOrWhiteSpace(photoId))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_ID",
                "Invalid photo id",
                "Photo id is required."
            );
        }

        var eventId = context.EventId;

        try
        {
            var wasDeleted = await mediaService.DeletePhotoAsync(eventId, photoId, ct);
            if (!wasDeleted)
            {
                return await ApiResponse.ProduceErrorResponse(
                    req,
                    HttpStatusCode.NotFound,
                    "PHOTO_NOT_FOUND",
                    "Photo not found",
                    "The requested photo does not exist."
                );
            }

            logger.LogInformation("Deleted photo {PhotoId} for event: {EventId}", photoId, eventId);
            return req.CreateResponse(HttpStatusCode.NoContent);
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogError(ex, "Media container is not available for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "MEDIA_CONTAINER_NOT_FOUND",
                "Storage configuration error",
                "Media storage container is not available."
            );
        }
    }
}
