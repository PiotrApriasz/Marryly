using Marryly.Application.Models.Media;

namespace Marryly.Application.Interfaces;

public interface IPhotoDerivativeService
{
    Task<PhotoDerivativeResult> GenerateAsync(MediaItem mediaItem, CancellationToken ct = default);
}
