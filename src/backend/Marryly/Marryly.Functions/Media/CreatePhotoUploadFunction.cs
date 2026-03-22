using System.Net;
using System.Text.Json;
using Azure.Storage;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using Marryly.Functions.Result;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Marryly.Functions.Media;

public class CreatePhotoUploadFunction(
    ILogger<CreatePhotoUploadFunction> logger,
    IConfiguration configuration)
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

    [Function("CreatePhotoUpload")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "events/{eventId}/photos/uploads")]
        HttpRequestData req,
        string eventId,
        CancellationToken ct)
    {
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
            logger.LogWarning(ex, "Invalid photo upload payload for event: {EventId}", eventId);
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_UPLOAD_PAYLOAD",
                "Invalid photo upload payload",
                "Request body must contain valid photo upload data."
            );
        }

        var expectedEventId = configuration["EVENT_ID"];
        if (!string.IsNullOrWhiteSpace(expectedEventId) &&
            !string.Equals(expectedEventId, eventId, StringComparison.Ordinal))
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.NotFound,
                "EVENT_NOT_FOUND",
                "Event not found",
                "Photo uploads are not enabled for this event."
            );
        }

        if (request is null)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                "INVALID_PHOTO_UPLOAD_PAYLOAD",
                "Invalid photo upload payload",
                "Request body is required."
            );
        }

        var validationError = ValidateRequest(request, GetMaxAllowedFileSizeBytes());
        if (validationError is not null)
        {
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.BadRequest,
                validationError.Code,
                validationError.Title,
                validationError.Detail
            );
        }

        var storageAccountName = configuration["STORAGE_ACCOUNT_NAME"];
        var storageAccountKey = configuration["STORAGE_ACCOUNT_KEY"];
        var containerName = configuration["BLOB_CONTAINER_FULL"] ?? "media-originals";

        if (string.IsNullOrWhiteSpace(storageAccountName) ||
            string.IsNullOrWhiteSpace(storageAccountKey) ||
            string.IsNullOrWhiteSpace(containerName))
        {
            logger.LogError("Photo upload storage configuration is missing.");
            return await ApiResponse.ProduceErrorResponse(
                req,
                HttpStatusCode.InternalServerError,
                "PHOTO_UPLOAD_CONFIG_INVALID",
                "Storage configuration error",
                "Photo upload storage configuration is missing."
            );
        }

        var photoId = Guid.NewGuid().ToString();
        var fileExtension = GetSafeExtension(request.FileName);
        var now = DateTimeOffset.UtcNow;
        var blobName =
            $"events/{eventId}/photos/{now:yyyy}/{now:MM}/{now:dd}/{photoId}{fileExtension}";

        var credential = new StorageSharedKeyCredential(storageAccountName, storageAccountKey);
        var serviceUri = new Uri($"https://{storageAccountName}.blob.core.windows.net");
        var blobServiceClient = new BlobServiceClient(serviceUri, credential);
        var blobClient = blobServiceClient.GetBlobContainerClient(containerName).GetBlobClient(blobName);

        var expiresAt = now.AddMinutes(GetUploadExpiryMinutes());
        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = containerName,
            BlobName = blobName,
            Resource = "b",
            StartsOn = now.AddMinutes(-5),
            ExpiresOn = expiresAt,
            ContentType = NormalizeContentType(request)
        };

        sasBuilder.SetPermissions(BlobSasPermissions.Create | BlobSasPermissions.Write);

        var sasQuery = sasBuilder.ToSasQueryParameters(credential).ToString();
        var uploadUrlBuilder = new UriBuilder(blobClient.Uri)
        {
            Query = sasQuery
        };
        var uploadUrl = uploadUrlBuilder.Uri;

        return await ApiResponse.ProduceSuccessResponse(req, new
        {
            photoId,
            blobName,
            blobUrl = blobClient.Uri.ToString(),
            uploadUrl = uploadUrl.ToString(),
            expiresAt = expiresAt.UtcDateTime,
            requiredHeaders = new Dictionary<string, string>
            {
                ["x-ms-blob-type"] = "BlockBlob",
                ["Content-Type"] = NormalizeContentType(request)
            }
        });
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

    private static ValidationError? ValidateRequest(CreatePhotoUploadRequest request, long maxAllowedFileSizeBytes)
    {
        if (string.IsNullOrWhiteSpace(request.FileName) || request.FileName.Length > 255)
        {
            return new ValidationError(
                "INVALID_PHOTO_FILE_NAME",
                "Invalid photo file name",
                "File name is required and must be shorter than 256 characters."
            );
        }

        if (request.FileSizeBytes <= 0)
        {
            return new ValidationError(
                "INVALID_PHOTO_FILE_SIZE",
                "Invalid photo file size",
                "File size must be greater than zero."
            );
        }

        if (request.FileSizeBytes > maxAllowedFileSizeBytes)
        {
            return new ValidationError(
                "PHOTO_FILE_TOO_LARGE",
                "Photo file too large",
                $"Photo exceeds the maximum allowed size of {maxAllowedFileSizeBytes} bytes."
            );
        }

        var extension = Path.GetExtension(request.FileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
        {
            return new ValidationError(
                "PHOTO_FILE_EXTENSION_NOT_ALLOWED",
                "Photo file extension not allowed",
                "Only JPG, PNG and WEBP files are supported after client-side conversion."
            );
        }

        if (!AllowedContentTypes.Contains(NormalizeContentType(request)))
        {
            return new ValidationError(
                "PHOTO_CONTENT_TYPE_NOT_ALLOWED",
                "Photo content type not allowed",
                "Only JPG, PNG and WEBP files are supported after client-side conversion."
            );
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

    private sealed record CreatePhotoUploadRequest(
        string FileName,
        long FileSizeBytes,
        string ContentType,
        DateTimeOffset? LastModifiedAt);

    private sealed record ValidationError(string Code, string Title, string Detail);
}
