using Azure.Storage;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Marryly.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Marryly.Infrastructure.Services;

public class MediaStorageService(IConfiguration configuration) : IMediaStorageService
{
    public async Task<Stream> OpenOriginalReadAsync(string blobName, CancellationToken ct = default)
    {
        var blobClient = GetOriginalsContainerClient().GetBlobClient(blobName);
        var stream = new MemoryStream();
        await blobClient.DownloadToAsync(stream, ct);
        stream.Position = 0;
        return stream;
    }

    public async Task UploadDerivedAsync(string blobName, Stream content, string contentType, CancellationToken ct = default)
    {
        var blobClient = GetDerivedContainerClient().GetBlobClient(blobName);
        await blobClient.UploadAsync(content, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders
            {
                ContentType = contentType
            }
        }, ct);
    }

    public string GetDerivedBlobUrl(string blobName)
    {
        return GetDerivedContainerClient().GetBlobClient(blobName).Uri.ToString();
    }

    public async Task DeleteOriginalIfExistsAsync(string? blobName, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(blobName))
        {
            return;
        }

        await GetOriginalsContainerClient().GetBlobClient(blobName).DeleteIfExistsAsync(cancellationToken: ct);
    }

    public async Task DeleteDerivedIfExistsAsync(string? blobName, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(blobName))
        {
            return;
        }

        await GetDerivedContainerClient().GetBlobClient(blobName).DeleteIfExistsAsync(cancellationToken: ct);
    }

    private BlobContainerClient GetOriginalsContainerClient()
    {
        return CreateBlobServiceClient().GetBlobContainerClient(GetOriginalsContainerName());
    }

    private BlobContainerClient GetDerivedContainerClient()
    {
        return CreateBlobServiceClient().GetBlobContainerClient(GetDerivedContainerName());
    }

    private string GetOriginalsContainerName()
    {
        return configuration["BLOB_CONTAINER_FULL"] ?? "media-originals";
    }

    private string GetDerivedContainerName()
    {
        return configuration["BLOB_CONTAINER_DERIVED"] ?? configuration["BLOB_CONTAINER_THUMB"] ?? "media-derived";
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
}
