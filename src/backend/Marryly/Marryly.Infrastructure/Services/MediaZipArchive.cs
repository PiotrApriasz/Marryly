using System.IO.Compression;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;

namespace Marryly.Infrastructure.Services;

public static class MediaZipArchive
{
    public static async Task WriteAsync(Stream output, IReadOnlyList<MediaItem> media,
        IMediaStorageService storage, CancellationToken ct = default, CompressionLevel compression = CompressionLevel.Optimal)
    {
        ct.ThrowIfCancellationRequested();
        // .NET 9 writes ZIP headers synchronously, including during Dispose. Complete
        // the archive on disk before copying it asynchronously to Kestrel's response.
        var path = Path.Combine(Path.GetTempPath(), $"marryly-download-{Guid.NewGuid():N}.zip");
        await using var buffer = new FileStream(path, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None,
            bufferSize: 81920, FileOptions.Asynchronous | FileOptions.SequentialScan | FileOptions.DeleteOnClose);
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            for (var index = 0; index < media.Count; index++)
            {
                ct.ThrowIfCancellationRequested();
                var item = media[index];
                var entry = archive.CreateEntry(BuildEntryName(item, index), compression);
                await using var source = await storage.OpenOriginalReadAsync(item.OriginalBlobName, ct);
                await using var destination = entry.Open();
                await source.CopyToAsync(destination, ct);
            }
        }

        ct.ThrowIfCancellationRequested();
        buffer.Position = 0;
        await buffer.CopyToAsync(output, ct);
    }

    private static string BuildEntryName(MediaItem item, int index)
    {
        var extension = item.Kind == "video" ? ".mp4" : ".jpg";
        var fileName = Path.GetFileName(item.OriginalBlobName.Replace('\\', '/'));
        if (string.IsNullOrWhiteSpace(fileName)) fileName = $"{item.Id}{extension}";
        var safeName = string.Concat(fileName.Select(character =>
            char.IsLetterOrDigit(character) || character is '.' or '-' or '_' ? character : '-')).Trim('.');
        if (string.IsNullOrWhiteSpace(safeName)) safeName = $"medium{extension}";
        return $"{index + 1:D4}-{safeName}";
    }
}
