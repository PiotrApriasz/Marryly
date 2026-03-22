using Azure.Storage;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Microsoft.Extensions.Configuration;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace Marryly.Infrastructure.Services;

public class PhotoDerivativeService(IConfiguration configuration) : IPhotoDerivativeService
{
    private const int ThumbnailMaxPixels = 480;
    private const int PreviewMaxPixels = 2560;

    public async Task<PhotoDerivativeResult> GenerateAsync(MediaItem mediaItem, CancellationToken ct = default)
    {
        var blobServiceClient = CreateBlobServiceClient();
        var originalsContainerName = configuration["BLOB_CONTAINER_FULL"] ?? "media-originals";
        var derivedContainerName = configuration["BLOB_CONTAINER_DERIVED"] ?? configuration["BLOB_CONTAINER_THUMB"] ?? "media-derived";

        var originalBlobClient = blobServiceClient
            .GetBlobContainerClient(originalsContainerName)
            .GetBlobClient(mediaItem.OriginalBlobName);

        await using var originalStream = new MemoryStream();
        await originalBlobClient.DownloadToAsync(originalStream, ct);
        originalStream.Position = 0;

        using var image = await Image.LoadAsync(originalStream, ct);
        image.Mutate(context => context.AutoOrient());

        var originalWidth = image.Width;
        var originalHeight = image.Height;

        var thumbnailBlobName = BuildDerivedBlobName(mediaItem, "thumbnails");
        var previewBlobName = BuildDerivedBlobName(mediaItem, "previews");

        var derivedContainerClient = blobServiceClient.GetBlobContainerClient(derivedContainerName);
        var thumbnailBlobClient = derivedContainerClient.GetBlobClient(thumbnailBlobName);
        var previewBlobClient = derivedContainerClient.GetBlobClient(previewBlobName);

        await using var thumbnailStream = new MemoryStream();
        using (var thumbnailImage = image.Clone(context => context.Resize(new ResizeOptions
                 {
                     Mode = ResizeMode.Max,
                     Size = new Size(ThumbnailMaxPixels, ThumbnailMaxPixels)
                 })))
        {
            await thumbnailImage.SaveAsJpegAsync(thumbnailStream, new JpegEncoder
            {
                Quality = 75
            }, ct);
        }

        thumbnailStream.Position = 0;
        await thumbnailBlobClient.UploadAsync(thumbnailStream, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders
            {
                ContentType = "image/jpeg"
            }
        }, ct);

        await using var previewStream = new MemoryStream();
        using (var previewImage = image.Clone(context => context.Resize(new ResizeOptions
                 {
                     Mode = ResizeMode.Max,
                     Size = new Size(PreviewMaxPixels, PreviewMaxPixels)
                 })))
        {
            await previewImage.SaveAsJpegAsync(previewStream, new JpegEncoder
            {
                Quality = 92
            }, ct);
        }

        previewStream.Position = 0;
        await previewBlobClient.UploadAsync(previewStream, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders
            {
                ContentType = "image/jpeg"
            }
        }, ct);

        return new PhotoDerivativeResult
        {
            ThumbnailBlobName = thumbnailBlobName,
            ThumbnailBlobUrl = thumbnailBlobClient.Uri.ToString(),
            PreviewBlobName = previewBlobName,
            PreviewBlobUrl = previewBlobClient.Uri.ToString(),
            Width = originalWidth,
            Height = originalHeight,
            ProcessedAt = DateTime.UtcNow
        };
    }

    private BlobServiceClient CreateBlobServiceClient()
    {
        var storageAccountName = configuration["STORAGE_ACCOUNT_NAME"];
        var storageAccountKey = configuration["STORAGE_ACCOUNT_KEY"];

        if (string.IsNullOrWhiteSpace(storageAccountName) || string.IsNullOrWhiteSpace(storageAccountKey))
        {
            throw new InvalidOperationException("Storage account configuration is missing.");
        }

        var credential = new StorageSharedKeyCredential(storageAccountName, storageAccountKey);
        var serviceUri = new Uri($"https://{storageAccountName}.blob.core.windows.net");
        return new BlobServiceClient(serviceUri, credential);
    }

    private static string BuildDerivedBlobName(MediaItem mediaItem, string variant)
    {
        var uploadDate = mediaItem.UploadedAt == default ? DateTime.UtcNow : mediaItem.UploadedAt;
        return $"events/{mediaItem.EventId}/photos/{variant}/{uploadDate:yyyy}/{uploadDate:MM}/{uploadDate:dd}/{mediaItem.Id}.jpg";
    }
}
