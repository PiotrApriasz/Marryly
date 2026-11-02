using Marryly.Application.Constants;

namespace Marryly.Application.Models.Media;

public static class MediaAlbumMembership
{
    public static IReadOnlyList<string> GetAlbumIds(MediaItem item) => item.AlbumIds is not null
        ? item.AlbumIds.Distinct(StringComparer.Ordinal).ToArray()
        : [string.IsNullOrWhiteSpace(item.AlbumId) ? AlbumConstants.GuestAlbumId : item.AlbumId];

    public static bool Contains(MediaItem item, string albumId) => GetAlbumIds(item).Contains(albumId, StringComparer.Ordinal);
}
