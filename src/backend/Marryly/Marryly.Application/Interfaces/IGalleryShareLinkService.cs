using Marryly.Application.Models.Media;

namespace Marryly.Application.Interfaces;

public interface IGalleryShareLinkService
{
    Task<IReadOnlyList<GalleryShareLink>> GetLinksAsync(string eventId, CancellationToken ct = default);
    Task<GalleryShareLink> CreateLinkAsync(string eventId, CreateGalleryShareLinkRequest request, CancellationToken ct = default);
    Task DeleteLinkAsync(string eventId, string linkId, CancellationToken ct = default);
}
