using System.Net;
using Azure.Storage;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Microsoft.Extensions.Configuration;

namespace Marryly.Infrastructure.Services;

public class PhotoUploadService(
    IConfiguration configuration,
    IMediaService mediaService,
    IPhotoDerivativeService photoDerivativeService) : IPhotoUploadService
{
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp"
    };

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    };

    public Task<PhotoUploadTargetResponse> CreatePhotoUploadAsync(string eventId, CreatePhotoUploadRequest request, CancellationToken ct = default)
    {
        var validationError = ValidateRequest(request, GetMaxAllowedFileSizeBytes());
        if (validationError is not null)
        {
            throw validationError;
        }

        var storageAccountName = configuration["STORAGE_ACCOUNT_NAME"];
        var storageAccountKey = configuration["STORAGE_ACCOUNT_KEY"];
        var containerName = configuration["BLOB_CONTAINER_FULL"] ?? "media-originals";

        if (string.IsNullOrWhiteSpace(storageAccountName) ||
            string.IsNullOrWhiteSpace(storageAccountKey) ||
            string.IsNullOrWhiteSpace(containerName))
        {
            throw new ApiErrorException(
                HttpStatusCode.InternalServerError,
                "PHOTO_UPLOAD_CONFIG_INVALID",
                "Storage configuration error",
                "Photo upload storage configuration is missing.");
        }

        var photoId = Guid.NewGuid().ToString();
        var fileExtension = GetSafeExtension(request.FileName);
        var now = DateTimeOffset.UtcNow;
        var blobName = $"events/{eventId}/photos/{now:yyyy}/{now:MM}/{now:dd}/{photoId}{fileExtension}";

        var credential = new StorageSharedKeyCredential(storageAccountName, storageAccountKey);
        var serviceUri = new Uri($"https://{storageAccountName}.blob.core.windows.net");
        var blobServiceClient = new BlobServiceClient(serviceUri, credential);
        var blobClient = blobServiceClient.GetBlobContainerClient(containerName).GetBlobClient(blobName);

        var expiresAt = now.AddMinutes(GetUploadExpiryMinutes());
        var contentType = NormalizeContentType(request);
        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = containerName,
            BlobName = blobName,
            Resource = "b",
            StartsOn = now.AddMinutes(-5),
            ExpiresOn = expiresAt,
            ContentType = contentType
        };

        sasBuilder.SetPermissions(BlobSasPermissions.Create | BlobSasPermissions.Write);

        var sasQuery = sasBuilder.ToSasQueryParameters(credential).ToString();
        var uploadUrlBuilder = new UriBuilder(blobClient.Uri)
        {
            Query = sasQuery
        };

        return Task.FromResult(new PhotoUploadTargetResponse
        {
            PhotoId = photoId,
            BlobName = blobName,
            BlobUrl = blobClient.Uri.ToString(),
            UploadUrl = uploadUrlBuilder.Uri.ToString(),
            ExpiresAt = expiresAt.UtcDateTime,
            RequiredHeaders = new Dictionary<string, string>
            {
                ["x-ms-blob-type"] = "BlockBlob",
                ["Content-Type"] = contentType
            }
        });
    }

    public async Task<MediaItem> CompletePhotoUploadAsync(
        string eventId,
        string photoId,
        string albumId,
        string sourceType,
        CompletePhotoUploadRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(photoId) ||
            string.IsNullOrWhiteSpace(albumId) ||
            string.IsNullOrWhiteSpace(request.BlobName) ||
            string.IsNullOrWhiteSpace(request.BlobUrl) ||
            string.IsNullOrWhiteSpace(request.ContentType) ||
            request.SizeBytes <= 0)
        {
            throw new ApiErrorException(
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_UPLOAD_COMPLETION_PAYLOAD",
                "Invalid photo upload completion payload",
                "Photo upload completion requires photo id, album id, blob name, blob url, content type and size.");
        }

        var mediaItem = new MediaItem
        {
            Id = photoId,
            EventId = eventId,
            Kind = "photo",
            Status = "processing",
            AlbumId = albumId,
            SourceType = sourceType,
            OriginalBlobName = request.BlobName.Trim(),
            OriginalBlobUrl = request.BlobUrl.Trim(),
            ContentType = request.ContentType.Trim().ToLowerInvariant(),
            SizeBytes = request.SizeBytes,
            UploadedAt = DateTime.UtcNow,
            Approved = true
        };

        var savedItem = await mediaService.UpsertPhotoAsync(eventId, mediaItem, ct);

        try
        {
            var derivativeResult = await photoDerivativeService.GenerateAsync(savedItem, ct);

            savedItem.Status = "ready";
            savedItem.ThumbnailBlobName = derivativeResult.ThumbnailBlobName;
            savedItem.ThumbnailBlobUrl = derivativeResult.ThumbnailBlobUrl;
            savedItem.PreviewBlobName = derivativeResult.PreviewBlobName;
            savedItem.PreviewBlobUrl = derivativeResult.PreviewBlobUrl;
            savedItem.Width = derivativeResult.Width;
            savedItem.Height = derivativeResult.Height;
            savedItem.ProcessedAt = derivativeResult.ProcessedAt;
            savedItem.ProcessingError = null;

            return await mediaService.UpsertPhotoAsync(eventId, savedItem, ct);
        }
        catch (Exception ex)
        {
            savedItem.Status = "failed";
            savedItem.ProcessingError = TruncateErrorMessage(ex.Message);
            savedItem.ProcessedAt = DateTime.UtcNow;
            await mediaService.UpsertPhotoAsync(eventId, savedItem, ct);

            throw new ApiErrorException(
                HttpStatusCode.InternalServerError,
                "PHOTO_PROCESSING_FAILED",
                "Photo processing failed",
                "The original photo was uploaded, but thumbnail generation failed.");
        }
    }

    private int GetUploadExpiryMinutes()
    {
        const int defaultValue = 15;
        var configuredValue = configuration["PHOTO_UPLOAD_SAS_EXPIRY_MINUTES"];

        return int.TryParse(configuredValue, out var parsedValue) && parsedValue > 0
            ? parsedValue
            : defaultValue;
    }

    private long GetMaxAllowedFileSizeBytes()
    {
        const long defaultValue = 25 * 1024 * 1024;
        var configuredValue = configuration["PHOTO_UPLOAD_MAX_FILE_SIZE_BYTES"];

        return long.TryParse(configuredValue, out var parsedValue) && parsedValue > 0
            ? parsedValue
            : defaultValue;
    }

    private static ApiErrorException? ValidateRequest(CreatePhotoUploadRequest request, long maxAllowedFileSizeBytes)
    {
        if (string.IsNullOrWhiteSpace(request.FileName) || request.FileName.Length > 255)
        {
            return new ApiErrorException(
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_FILE_NAME",
                "Invalid photo file name",
                "File name is required and must be shorter than 256 characters.");
        }

        if (request.FileSizeBytes <= 0)
        {
            return new ApiErrorException(
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_FILE_SIZE",
                "Invalid photo file size",
                "File size must be greater than zero.");
        }

        if (request.FileSizeBytes > maxAllowedFileSizeBytes)
        {
            return new ApiErrorException(
                HttpStatusCode.BadRequest,
                "PHOTO_FILE_TOO_LARGE",
                "Photo file too large",
                $"Photo exceeds the maximum allowed size of {maxAllowedFileSizeBytes} bytes.");
        }

        var extension = Path.GetExtension(request.FileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
        {
            return new ApiErrorException(
                HttpStatusCode.BadRequest,
                "PHOTO_FILE_EXTENSION_NOT_ALLOWED",
                "Photo file extension not allowed",
                "Only JPG, PNG and WEBP files are supported after client-side conversion.");
        }

        if (!AllowedContentTypes.Contains(NormalizeContentType(request)))
        {
            return new ApiErrorException(
                HttpStatusCode.BadRequest,
                "PHOTO_CONTENT_TYPE_NOT_ALLOWED",
                "Photo content type not allowed",
                "Only JPG, PNG and WEBP files are supported after client-side conversion.");
        }

        return null;
    }

    private static string NormalizeContentType(CreatePhotoUploadRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.ContentType))
        {
            return request.ContentType.Trim().ToLowerInvariant();
        }

        var extension = Path.GetExtension(request.FileName)?.ToLowerInvariant();

        return extension switch
        {
            ".jpg" => "image/jpeg",
            ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
    }

    private static string GetSafeExtension(string fileName)
    {
        var extension = Path.GetExtension(fileName)?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
        {
            return ".bin";
        }

        return extension;
    }

    private static string TruncateErrorMessage(string message)
    {
        return message.Length <= 500 ? message : message[..500];
    }
}
