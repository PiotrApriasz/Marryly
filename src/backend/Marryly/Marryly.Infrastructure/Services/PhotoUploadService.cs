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
    private const string PhotoKind = "photo";
    private const string VideoKind = "video";

    private static readonly HashSet<string> AllowedPhotoContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/png",
        "image/webp"
    };

    private static readonly HashSet<string> AllowedPhotoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    };

    private static readonly HashSet<string> AllowedVideoContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "video/3gpp",
        "video/3gpp2",
        "video/x-m4v"
    };

    private static readonly HashSet<string> AllowedVideoExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".mp4",
        ".mov",
        ".m4v",
        ".webm",
        ".3gp",
        ".3gpp"
    };

    public Task<PhotoUploadTargetResponse> CreatePhotoUploadAsync(string eventId, CreatePhotoUploadRequest request, CancellationToken ct = default)
    {
        request.Kind = PhotoKind;
        return CreateMediaUploadAsync(eventId, request, ct);
    }

    public Task<PhotoUploadTargetResponse> CreateMediaUploadAsync(string eventId, CreatePhotoUploadRequest request, CancellationToken ct = default)
    {
        var kind = NormalizeMediaKind(request.Kind, request.ContentType, request.FileName);
        var validationError = ValidateCreateRequest(request, kind, GetMaxAllowedFileSizeBytes(kind));
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
                "MEDIA_UPLOAD_CONFIG_INVALID",
                "Storage configuration error",
                "Media upload storage configuration is missing.");
        }

        var mediaId = Guid.NewGuid().ToString();
        var fileExtension = GetSafeExtension(request.FileName, kind);
        var now = DateTimeOffset.UtcNow;
        var blobFolder = kind == VideoKind ? "videos" : "photos";
        var blobName = $"events/{eventId}/{blobFolder}/{now:yyyy}/{now:MM}/{now:dd}/{mediaId}{fileExtension}";

        var credential = new StorageSharedKeyCredential(storageAccountName, storageAccountKey);
        var serviceUri = new Uri($"https://{storageAccountName}.blob.core.windows.net");
        var blobServiceClient = new BlobServiceClient(serviceUri, credential);
        var blobClient = blobServiceClient.GetBlobContainerClient(containerName).GetBlobClient(blobName);

        var expiresAt = now.AddMinutes(GetUploadExpiryMinutes(kind));
        var contentType = NormalizeContentType(request.ContentType, request.FileName, kind);
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
            MediaId = mediaId,
            PhotoId = mediaId,
            Kind = kind,
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

    public Task<MediaItem> CompletePhotoUploadAsync(
        string eventId,
        string photoId,
        string albumId,
        string sourceType,
        CompletePhotoUploadRequest request,
        CancellationToken ct = default)
    {
        request.Kind = PhotoKind;
        return CompleteMediaUploadAsync(eventId, photoId, albumId, sourceType, request, ct);
    }

    public async Task<MediaItem> CompleteMediaUploadAsync(
        string eventId,
        string mediaId,
        string albumId,
        string sourceType,
        CompletePhotoUploadRequest request,
        CancellationToken ct = default)
    {
        var kind = NormalizeMediaKind(request.Kind, request.ContentType, request.BlobName);
        var validationError = ValidateCompleteRequest(mediaId, albumId, request, kind, GetMaxAllowedFileSizeBytes(kind));
        if (validationError is not null)
        {
            throw validationError;
        }

        var mediaItem = new MediaItem
        {
            Id = mediaId,
            EventId = eventId,
            Kind = kind,
            Status = kind == VideoKind ? "ready" : "processing",
            AlbumId = albumId,
            SourceType = sourceType,
            OriginalBlobName = request.BlobName.Trim(),
            OriginalBlobUrl = request.BlobUrl.Trim(),
            ContentType = NormalizeContentType(request.ContentType, request.BlobName, kind),
            SizeBytes = request.SizeBytes,
            UploadedAt = DateTime.UtcNow,
            Approved = true,
            ProcessedAt = kind == VideoKind ? DateTime.UtcNow : null
        };

        var savedItem = await mediaService.UpsertMediaAsync(eventId, mediaItem, ct);

        if (kind == VideoKind)
        {
            return savedItem;
        }

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

            return await mediaService.UpsertMediaAsync(eventId, savedItem, ct);
        }
        catch (Exception ex)
        {
            savedItem.Status = "failed";
            savedItem.ProcessingError = TruncateErrorMessage(ex.Message);
            savedItem.ProcessedAt = DateTime.UtcNow;
            await mediaService.UpsertMediaAsync(eventId, savedItem, ct);

            throw new ApiErrorException(
                HttpStatusCode.InternalServerError,
                "PHOTO_PROCESSING_FAILED",
                "Photo processing failed",
                "The original photo was uploaded, but thumbnail generation failed.");
        }
    }

    private int GetUploadExpiryMinutes(string kind)
    {
        var configKey = kind == VideoKind
            ? "VIDEO_UPLOAD_SAS_EXPIRY_MINUTES"
            : "PHOTO_UPLOAD_SAS_EXPIRY_MINUTES";
        var defaultValue = kind == VideoKind ? 60 : 15;
        var configuredValue = configuration[configKey];

        return int.TryParse(configuredValue, out var parsedValue) && parsedValue > 0
            ? parsedValue
            : defaultValue;
    }

    private long GetMaxAllowedFileSizeBytes(string kind)
    {
        var configKey = kind == VideoKind
            ? "VIDEO_UPLOAD_MAX_FILE_SIZE_BYTES"
            : "PHOTO_UPLOAD_MAX_FILE_SIZE_BYTES";
        var defaultValue = kind == VideoKind
            ? 500L * 1024 * 1024
            : 25L * 1024 * 1024;
        var configuredValue = configuration[configKey];

        return long.TryParse(configuredValue, out var parsedValue) && parsedValue > 0
            ? parsedValue
            : defaultValue;
    }

    private static ApiErrorException? ValidateCreateRequest(CreatePhotoUploadRequest request, string kind, long maxAllowedFileSizeBytes)
    {
        if (string.IsNullOrWhiteSpace(request.FileName) || request.FileName.Length > 255)
        {
            return new ApiErrorException(
                HttpStatusCode.BadRequest,
                "INVALID_MEDIA_FILE_NAME",
                "Invalid media file name",
                "File name is required and must be shorter than 256 characters.");
        }

        return ValidateFileMetadata(request.FileName, request.ContentType, request.FileSizeBytes, kind, maxAllowedFileSizeBytes);
    }

    private static ApiErrorException? ValidateCompleteRequest(
        string mediaId,
        string albumId,
        CompletePhotoUploadRequest request,
        string kind,
        long maxAllowedFileSizeBytes)
    {
        if (string.IsNullOrWhiteSpace(mediaId) ||
            string.IsNullOrWhiteSpace(albumId) ||
            string.IsNullOrWhiteSpace(request.BlobName) ||
            string.IsNullOrWhiteSpace(request.BlobUrl) ||
            string.IsNullOrWhiteSpace(request.ContentType))
        {
            return new ApiErrorException(
                HttpStatusCode.BadRequest,
                "INVALID_MEDIA_UPLOAD_COMPLETION_PAYLOAD",
                "Invalid media upload completion payload",
                "Media upload completion requires media id, album id, blob name, blob url, content type and size.");
        }

        return ValidateFileMetadata(request.BlobName, request.ContentType, request.SizeBytes, kind, maxAllowedFileSizeBytes);
    }

    private static ApiErrorException? ValidateFileMetadata(
        string fileName,
        string? contentType,
        long fileSizeBytes,
        string kind,
        long maxAllowedFileSizeBytes)
    {
        if (fileSizeBytes <= 0)
        {
            return new ApiErrorException(
                HttpStatusCode.BadRequest,
                "INVALID_MEDIA_FILE_SIZE",
                "Invalid media file size",
                "File size must be greater than zero.");
        }

        if (fileSizeBytes > maxAllowedFileSizeBytes)
        {
            return new ApiErrorException(
                HttpStatusCode.BadRequest,
                "MEDIA_FILE_TOO_LARGE",
                "Media file too large",
                $"Media file exceeds the maximum allowed size of {maxAllowedFileSizeBytes} bytes.");
        }

        var extension = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(extension) || !GetAllowedExtensions(kind).Contains(extension))
        {
            return new ApiErrorException(
                HttpStatusCode.BadRequest,
                "MEDIA_FILE_EXTENSION_NOT_ALLOWED",
                "Media file extension not allowed",
                kind == VideoKind
                    ? "Only MP4, MOV, M4V, WEBM and 3GP video files are supported."
                    : "Only JPG, PNG and WEBP files are supported after client-side conversion.");
        }

        var normalizedContentType = NormalizeContentType(contentType, fileName, kind);
        if (!GetAllowedContentTypes(kind).Contains(normalizedContentType))
        {
            return new ApiErrorException(
                HttpStatusCode.BadRequest,
                "MEDIA_CONTENT_TYPE_NOT_ALLOWED",
                "Media content type not allowed",
                kind == VideoKind
                    ? "Only MP4, MOV, M4V, WEBM and 3GP video files are supported."
                    : "Only JPG, PNG and WEBP files are supported after client-side conversion.");
        }

        return null;
    }

    private static string NormalizeMediaKind(string? requestedKind, string? contentType, string? fileName)
    {
        if (string.Equals(requestedKind, PhotoKind, StringComparison.OrdinalIgnoreCase))
        {
            return PhotoKind;
        }

        if (string.Equals(requestedKind, VideoKind, StringComparison.OrdinalIgnoreCase))
        {
            return VideoKind;
        }

        var normalizedContentType = contentType?.Trim().ToLowerInvariant() ?? string.Empty;
        if (normalizedContentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase))
        {
            return VideoKind;
        }

        var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
        return extension is not null && AllowedVideoExtensions.Contains(extension)
            ? VideoKind
            : PhotoKind;
    }

    private static string NormalizeContentType(string? contentType, string fileName, string kind)
    {
        var normalizedContentType = contentType?.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(normalizedContentType) &&
            normalizedContentType != "application/octet-stream")
        {
            return normalizedContentType;
        }

        var extension = Path.GetExtension(fileName)?.ToLowerInvariant();

        return extension switch
        {
            ".jpg" => "image/jpeg",
            ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".mp4" => "video/mp4",
            ".mov" => "video/quicktime",
            ".m4v" => "video/x-m4v",
            ".webm" => "video/webm",
            ".3gp" => "video/3gpp",
            ".3gpp" => "video/3gpp",
            _ => kind == VideoKind ? "video/mp4" : "application/octet-stream"
        };
    }

    private static string GetSafeExtension(string fileName, string kind)
    {
        var extension = Path.GetExtension(fileName)?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(extension) || !GetAllowedExtensions(kind).Contains(extension))
        {
            return ".bin";
        }

        return extension;
    }

    private static HashSet<string> GetAllowedExtensions(string kind)
    {
        return kind == VideoKind ? AllowedVideoExtensions : AllowedPhotoExtensions;
    }

    private static HashSet<string> GetAllowedContentTypes(string kind)
    {
        return kind == VideoKind ? AllowedVideoContentTypes : AllowedPhotoContentTypes;
    }

    private static string TruncateErrorMessage(string message)
    {
        return message.Length <= 500 ? message : message[..500];
    }
}
