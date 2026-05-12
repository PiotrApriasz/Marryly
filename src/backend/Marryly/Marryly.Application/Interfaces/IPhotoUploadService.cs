using Marryly.Application.Models.Media;

namespace Marryly.Application.Interfaces;

public interface IPhotoUploadService
{
    Task<PhotoUploadTargetResponse> CreatePhotoUploadAsync(string eventId, CreatePhotoUploadRequest request, CancellationToken ct = default);
    Task<MediaItem> CompletePhotoUploadAsync(
        string eventId,
        string photoId,
        string albumId,
        string sourceType,
        CompletePhotoUploadRequest request,
        CancellationToken ct = default);
}
