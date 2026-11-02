using System.IO.Compression;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Infrastructure.Services;
using Xunit;

namespace Marryly.Tests;

public class MediaZipArchiveTests
{
    [Fact]
    public async Task ZipContainsOriginalBytesWithUniqueSafeNamesAndReadsOneFileAtATime()
    {
        var media = new[] { Item("photo", "folder-a/photo.jpg", "photo"), Item("copy-name", "folder-b/photo.jpg", "photo"), Item("video", "folder/video.mov", "video") };
        var storage = new Storage(new Dictionary<string, byte[]>
        {
            [media[0].OriginalBlobName] = [255, 216, 1, 2, 255, 217],
            [media[1].OriginalBlobName] = [5, 6, 7],
            [media[2].OriginalBlobName] = [0, 0, 0, 1, 2, 3, 4]
        });
        await using var output = new MemoryStream();
        await MediaZipArchive.WriteAsync(output, media, storage, compression: CompressionLevel.NoCompression);
        Assert.True(output.CanWrite);
        Assert.True(storage.LastStream!.WasDisposed);
        output.Position = 0;
        using var archive = new ZipArchive(output, ZipArchiveMode.Read, leaveOpen: true);
        Assert.Equal(["0001-photo.jpg", "0002-photo.jpg", "0003-video.mov"], archive.Entries.Select(entry => entry.FullName));
        for (var index = 0; index < media.Length; index++)
        {
            await using var entry = archive.Entries[index].Open();
            await using var contents = new MemoryStream();
            await entry.CopyToAsync(contents);
            Assert.Equal(storage.Bytes[media[index].OriginalBlobName], contents.ToArray());
        }
    }

    [Fact]
    public async Task CancellationStopsArchiveBeforeOpeningOriginals()
    {
        var storage = new Storage([]);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await using var output = new MemoryStream();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => MediaZipArchive.WriteAsync(output, [Item("photo", "photo.jpg", "photo")], storage, cancellation.Token));
        Assert.Null(storage.LastStream);
    }

    private static MediaItem Item(string id, string path, string kind) => new()
    {
        Id = id, EventId = "event", Kind = kind, Status = "ready", ContentType = "application/octet-stream",
        OriginalBlobName = path, OriginalBlobUrl = "https://example.invalid/original"
    };

    private sealed class TrackedStream(byte[] bytes) : MemoryStream(bytes)
    {
        public bool WasDisposed { get; private set; }
        protected override void Dispose(bool disposing) { WasDisposed = true; base.Dispose(disposing); }
    }

    private sealed class Storage(Dictionary<string, byte[]> bytes) : IMediaStorageService
    {
        public Dictionary<string, byte[]> Bytes { get; } = bytes;
        public TrackedStream? LastStream { get; private set; }
        public Task<Stream> OpenOriginalReadAsync(string name, CancellationToken ct = default)
        {
            Assert.True(LastStream is null || LastStream.WasDisposed);
            LastStream = new TrackedStream(Bytes[name]);
            return Task.FromResult<Stream>(LastStream);
        }
        public string GetOriginalReadUrl(string name) => throw new NotSupportedException();
        public string GetOriginalDownloadUrl(string name) => throw new NotSupportedException();
        public Task DeleteOriginalIfExistsAsync(string? name, CancellationToken ct = default) => throw new NotSupportedException();
        public Task DeleteDerivedIfExistsAsync(string? name, CancellationToken ct = default) => throw new NotSupportedException();
        public Task UploadDerivedAsync(string name, Stream contents, string contentType, CancellationToken ct = default) => throw new NotSupportedException();
        public string GetDerivedBlobUrl(string name) => throw new NotSupportedException();
    }
}
