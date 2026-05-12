namespace Marryly.Application.Interfaces;

public interface IMediaStorageService
{
    Task<Stream> OpenOriginalReadAsync(string blobName, CancellationToken ct = default);
    Task UploadDerivedAsync(string blobName, Stream content, string contentType, CancellationToken ct = default);
    string GetDerivedBlobUrl(string blobName);
    Task DeleteOriginalIfExistsAsync(string? blobName, CancellationToken ct = default);
    Task DeleteDerivedIfExistsAsync(string? blobName, CancellationToken ct = default);
}
