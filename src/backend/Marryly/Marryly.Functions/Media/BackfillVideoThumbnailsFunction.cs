using System.Net;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Functions.Result;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class BackfillVideoThumbnailsFunction(
    ILogger<BackfillVideoThumbnailsFunction> logger,
    IAuthService authService,
    IMediaService mediaService,
    IVideoThumbnailQueue videoThumbnailQueue)
{
    [Function("BackfillVideoThumbnails")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/media/video-thumbnails/backfill")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null || auth.Context is null)
        {
            return auth.Response!;
        }

        var videos = await mediaService.GetVideosMissingThumbnailsAsync(auth.Context.EventId, ct);
        foreach (var video in videos)
        {
            await videoThumbnailQueue.EnqueueAsync(new VideoThumbnailJob
            {
                EventId = auth.Context.EventId,
                MediaId = video.Id
            }, ct);
        }

        logger.LogInformation("Queued {Count} existing video thumbnail jobs for event {EventId}", videos.Count, auth.Context.EventId);
        return await ApiResponse.ProduceSuccessResponse(req, new { queuedCount = videos.Count });
    }
}
