using System.Net;
using System.Text.Json;
using Marryly.Application.Exceptions;
using Marryly.Application.Models.Media;

namespace Marryly.Infrastructure.Services;

internal static class AlbumMediaPagination
{
    internal sealed record Cursor(int Version, string EventId, string AlbumId, long DateTicks, long UploadedTicks, string MediaId);

    internal static List<MediaItem> Order(IEnumerable<MediaItem> items) => items
        .OrderBy(item => item.CapturedAt ?? item.UploadedAt)
        .ThenBy(item => item.UploadedAt)
        .ThenBy(item => item.Id, StringComparer.Ordinal)
        .ToList();

    internal static bool IsAfter(MediaItem item, Cursor cursor)
    {
        var comparison = (item.CapturedAt ?? item.UploadedAt).Ticks.CompareTo(cursor.DateTicks);
        if (comparison == 0)
        {
            comparison = item.UploadedAt.Ticks.CompareTo(cursor.UploadedTicks);
        }

        return comparison > 0 || (comparison == 0 && StringComparer.Ordinal.Compare(item.Id, cursor.MediaId) > 0);
    }

    internal static string Encode(string eventId, string albumId, MediaItem item)
    {
        var cursor = new Cursor(1, eventId, albumId, (item.CapturedAt ?? item.UploadedAt).Ticks, item.UploadedAt.Ticks, item.Id);
        return Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(cursor))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    internal static Cursor? Decode(string? token, string eventId, string albumId)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        try
        {
            if (token.Length > 4096)
            {
                throw InvalidToken();
            }

            var base64 = token.Replace('-', '+').Replace('_', '/');
            base64 = base64.PadRight(base64.Length + (4 - base64.Length % 4) % 4, '=');
            var cursor = JsonSerializer.Deserialize<Cursor>(Convert.FromBase64String(base64));
            if (cursor is null || cursor.Version != 1 || cursor.EventId != eventId || cursor.AlbumId != albumId
                || string.IsNullOrWhiteSpace(cursor.MediaId)
                || cursor.DateTicks < DateTime.MinValue.Ticks || cursor.DateTicks > DateTime.MaxValue.Ticks
                || cursor.UploadedTicks < DateTime.MinValue.Ticks || cursor.UploadedTicks > DateTime.MaxValue.Ticks)
            {
                throw InvalidToken();
            }

            return cursor;
        }
        catch (Exception ex) when (ex is FormatException or JsonException)
        {
            throw InvalidToken();
        }
    }

    private static ApiErrorException InvalidToken() => new(HttpStatusCode.BadRequest,
        "ALBUM_MEDIA_CONTINUATION_INVALID", "Invalid pagination token", "Reload the album to restart chronological pagination.");
}
