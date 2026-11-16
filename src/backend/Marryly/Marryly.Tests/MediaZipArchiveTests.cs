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
        Assert.Equal(0, output.Length);
    }

    [Theory]
    [InlineData(CompressionLevel.Optimal, false)]
    [InlineData(CompressionLevel.NoCompression, false)]
    [InlineData(CompressionLevel.Optimal, true)]
    public async Task ZipCanBeWrittenToHttpStreamThatRejectsSynchronousIO(CompressionLevel compression, bool empty)
    {
        var item = Item("photo", "photo.jpg", "photo");
        var bytes = new byte[200_000];
        new Random(42).NextBytes(bytes);
        var storage = new Storage(new Dictionary<string, byte[]> { [item.OriginalBlobName] = bytes });
        await using var output = new AsyncOnlyOutputStream();

        await MediaZipArchive.WriteAsync(output, empty ? [] : [item], storage, compression: compression);

        Assert.True(output.CanWrite);
        await using var contents = new MemoryStream(output.ToArray());
        using var archive = new ZipArchive(contents, ZipArchiveMode.Read);
        if (empty)
        {
            Assert.Empty(archive.Entries);
        }
        else
        {
            var entry = Assert.Single(archive.Entries);
            await using var original = entry.Open();
            await using var restored = new MemoryStream();
            await original.CopyToAsync(restored);
            Assert.Equal(bytes, restored.ToArray());
        }
    }

    [Fact]
    public async Task MissingOriginalDoesNotWritePartialArchiveToHttpResponse()
    {
        var photo = Item("photo", "photo.jpg", "photo");
        var missing = Item("missing", "missing.jpg", "photo");
        var storage = new Storage(new Dictionary<string, byte[]> { [photo.OriginalBlobName] = [1, 2, 3] });
        await using var output = new AsyncOnlyOutputStream();

        await Assert.ThrowsAsync<FileNotFoundException>(() => MediaZipArchive.WriteAsync(output, [photo, missing], storage));

        Assert.Empty(output.ToArray());
        Assert.True(storage.LastStream!.WasDisposed);
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

    // Kestrel's response body is non-seekable and disallows synchronous writes and flushes.
    private sealed class AsyncOnlyOutputStream : Stream
    {
        private readonly MemoryStream contents = new();
        public byte[] ToArray() => contents.ToArray();
        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => contents.CanWrite;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Flush() => throw new InvalidOperationException("Synchronous operations are disallowed.");
        public override void Write(byte[] buffer, int offset, int count) => throw new InvalidOperationException("Synchronous operations are disallowed.");
        public override void Write(ReadOnlySpan<byte> buffer) => throw new InvalidOperationException("Synchronous operations are disallowed.");
        public override Task FlushAsync(CancellationToken ct) => contents.FlushAsync(ct);
        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken ct) => contents.WriteAsync(buffer, offset, count, ct);
        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken ct = default) => contents.WriteAsync(buffer, ct);
        protected override void Dispose(bool disposing) { if (disposing) contents.Dispose(); base.Dispose(disposing); }
    }

    private sealed class Storage(Dictionary<string, byte[]> bytes) : IMediaStorageService
    {
        public Dictionary<string, byte[]> Bytes { get; } = bytes;
        public TrackedStream? LastStream { get; private set; }
        public Task<Stream> OpenOriginalReadAsync(string name, CancellationToken ct = default)
        {
            Assert.True(LastStream is null || LastStream.WasDisposed);
            if (!Bytes.TryGetValue(name, out var contents)) throw new FileNotFoundException("Original is missing.", name);
            LastStream = new TrackedStream(contents);
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
