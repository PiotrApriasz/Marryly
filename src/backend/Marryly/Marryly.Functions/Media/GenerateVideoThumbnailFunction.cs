using System.Text.Json;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class GenerateVideoThumbnailFunction(
    ILogger<GenerateVideoThumbnailFunction> logger,
    IMediaService mediaService,
    IVideoThumbnailService videoThumbnailService)
{
    [Function("GenerateVideoThumbnail")]
    public async Task Run(
        [QueueTrigger("video-thumbnail-jobs", Connection = "AzureWebJobsStorage")] string queueMessage,
        CancellationToken ct)
    {
        var job = JsonSerializer.Deserialize<VideoThumbnailJob>(queueMessage)
            ?? throw new InvalidOperationException("Video thumbnail queue message is invalid.");
        var mediaItem = await mediaService.GetMediaByIdAsync(job.EventId, job.MediaId, ct);

        if (mediaItem is null || !string.Equals(mediaItem.Kind, "video", StringComparison.Ordinal))
        {
            return;
        }

        if (!string.IsNullOrWhiteSpace(mediaItem.ThumbnailBlobUrl) && string.Equals(mediaItem.Status, "ready", StringComparison.Ordinal))
        {
            return;
        }

        try
        {
            mediaItem.Status = "processing";
            mediaItem.ProcessingError = null;
            await mediaService.UpsertMediaAsync(job.EventId, mediaItem, ct);

            var result = await videoThumbnailService.GenerateAsync(mediaItem, ct);
            mediaItem.ThumbnailBlobName = result.ThumbnailBlobName;
            mediaItem.ThumbnailBlobUrl = result.ThumbnailBlobUrl;
            mediaItem.Width = result.Width;
            mediaItem.Height = result.Height;
            mediaItem.Status = "ready";
            mediaItem.ProcessedAt = result.ProcessedAt;
            mediaItem.ProcessingError = null;
            await mediaService.UpsertMediaAsync(job.EventId, mediaItem, ct);

            logger.LogInformation("Generated thumbnail for video {MediaId} in event {EventId}", job.MediaId, job.EventId);
        }
        catch (Exception ex)
        {
            mediaItem.Status = "failed";
            mediaItem.ProcessedAt = DateTime.UtcNow;
            mediaItem.ProcessingError = TruncateErrorMessage(ex.Message);
            await mediaService.UpsertMediaAsync(job.EventId, mediaItem, ct);
            logger.LogError(ex, "Video thumbnail generation failed for video {MediaId} in event {EventId}", job.MediaId, job.EventId);
            throw;
        }
    }

    private static string TruncateErrorMessage(string message)
    {
        const int maxLength = 1000;
        return message.Length <= maxLength ? message : message[..maxLength];
    }
}
