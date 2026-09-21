using Azure.Storage.Queues;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Microsoft.Extensions.Configuration;

namespace Marryly.Infrastructure.Services;

public class VideoThumbnailQueue(IConfiguration configuration) : IVideoThumbnailQueue
{
    private const string DefaultQueueName = "video-thumbnail-jobs";

    public async Task EnqueueAsync(VideoThumbnailJob job, CancellationToken ct = default)
    {
        var connectionString = configuration["AzureWebJobsStorage"];
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("AzureWebJobsStorage is required to enqueue video thumbnail jobs.");
        }

        var queue = new QueueClient(connectionString, DefaultQueueName);
        await queue.CreateIfNotExistsAsync(cancellationToken: ct);
        await queue.SendMessageAsync(BinaryData.FromObjectAsJson(job), cancellationToken: ct);
    }
}
