using System.Runtime.CompilerServices;
using Azure;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Infrastructure.Database;
using Marryly.Infrastructure.Services;
using Microsoft.Azure.Cosmos;
using Xunit;

namespace Marryly.Tests;

public class AlbumMediaDeletionTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(25)]
    [InlineData(26)]
    [InlineData(800)]
    public async Task DeletesEntireAlbumAcrossBatchesAndPreservesOtherAlbumsAndEvents(int count)
    {
        var target = Enumerable.Range(0, count).Select(index => Media($"target-{index}",
            kind: index % 2 == 0 ? "photo" : "video", status: index % 3 == 0 ? "failed" : "ready")).ToList();
        var otherAlbum = Media("other-album", albumId: "other");
        var otherEvent = Media("other-event", eventId: "other-event");
        var unsupported = Media("other-kind", kind: "attachment");
        var store = new MediaStore([.. target, otherAlbum, otherEvent, unsupported]);
        var blobs = new BlobStore();
        var service = new MediaService(store, null!, blobs);
        var deleted = 0;
        var batches = 0;

        DeleteAlbumMediaResponse response;
        do
        {
            response = await service.DeleteAlbumMediaBatchAsync("event", "album");
            Assert.InRange(response.DeletedCount, 0, 25);
            deleted += response.DeletedCount;
            Assert.True(++batches <= Math.Max(1, (int)Math.Ceiling(count / 25.0)));
        } while (response.HasMore);

        Assert.Equal(count, deleted);
        Assert.Equal([otherAlbum, otherEvent, unsupported], store.Items);
        Assert.Equal(count * 3, blobs.Calls.Count);
        Assert.All(target, item => Assert.Contains($"original:{item.OriginalBlobName}", blobs.Calls));
        Assert.All(target, item => Assert.Contains($"derived:{item.PreviewBlobName}", blobs.Calls));
        Assert.All(target, item => Assert.Contains($"derived:{item.ThumbnailBlobName}", blobs.Calls));
    }

    [Fact]
    public async Task GuestAlbumIncludesLegacyMediaWithoutAlbumId()
    {
        var other = Media("other");
        var store = new MediaStore([Media("guest", albumId: "guest"), Media("legacy-null", albumId: null),
            Media("legacy-empty", albumId: ""), other]);
        var service = new MediaService(store, null!, new BlobStore());

        var response = await service.DeleteAlbumMediaBatchAsync("event", "guest");

        Assert.Equal(3, response.DeletedCount);
        Assert.False(response.HasMore);
        Assert.Equal(other, Assert.Single(store.Items));
    }

    [Fact]
    public async Task BlobFailureKeepsMediaRecordAndRetryFinishesRemainingDeletion()
    {
        var first = Media("first");
        var second = Media("second");
        var store = new MediaStore([first, second]);
        var blobs = new BlobStore { FailBlobName = second.ThumbnailBlobName };
        var service = new MediaService(store, null!, blobs);

        await Assert.ThrowsAsync<RequestFailedException>(() => service.DeleteAlbumMediaBatchAsync("event", "album"));

        Assert.Equal(second, Assert.Single(store.Items));
        blobs.FailBlobName = null;
        var response = await service.DeleteAlbumMediaBatchAsync("event", "album");

        Assert.Equal(1, response.DeletedCount);
        Assert.False(response.HasMore);
        Assert.Empty(store.Items);
    }

    [Fact]
    public async Task CancellationStopsBeforeDeletingFiles()
    {
        var store = new MediaStore([Media("one")]);
        var blobs = new BlobStore();
        var service = new MediaService(store, null!, blobs);
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            service.DeleteAlbumMediaBatchAsync("event", "album", cancellation.Token));

        Assert.Single(store.Items);
        Assert.Empty(blobs.Calls);
    }

    [Fact]
    public async Task IndividualDeletionStillRemovesAllFilesAndRecord()
    {
        var store = new MediaStore([Media("one")]);
        var blobs = new BlobStore();
        var service = new MediaService(store, null!, blobs);

        Assert.True(await service.DeletePhotoAsync("event", "one"));
        Assert.Empty(store.Items);
        Assert.Equal(["original:one/original", "derived:one/preview", "derived:one/thumbnail"], blobs.Calls);
        Assert.False(await service.DeletePhotoAsync("event", "one"));
    }

    private static MediaItem Media(string id, string? albumId = "album", string eventId = "event",
        string kind = "photo", string status = "ready") => new()
    {
        Id = id, EventId = eventId, AlbumId = albumId, Kind = kind, Status = status,
        OriginalBlobName = $"{id}/original", OriginalBlobUrl = "https://example.invalid/original",
        PreviewBlobName = $"{id}/preview", ThumbnailBlobName = $"{id}/thumbnail", ContentType = "image/jpeg",
        Approved = false
    };

    private sealed class MediaStore(List<MediaItem> items) : ICosmosDbService<MediaItem>
    {
        public List<MediaItem> Items { get; } = items;

        public Task<MediaItem?> GetAsync(string id, PartitionKey pk, CancellationToken ct = default) =>
            Task.FromResult(Items.Find(item => item.Id == id && PartitionKeyResolver.ForEventIdBasedData(item.EventId).Equals(pk)));

        public Task DeleteAsync(string id, PartitionKey pk, CancellationToken ct = default)
        {
            ct.ThrowIfCancellationRequested();
            Items.RemoveAll(item => item.Id == id && PartitionKeyResolver.ForEventIdBasedData(item.EventId).Equals(pk));
            return Task.CompletedTask;
        }

        public async IAsyncEnumerable<MediaItem> QueryAsync(QueryDefinition queryDefinition,
            QueryRequestOptions? opts = null, [EnumeratorCancellation] CancellationToken ct = default)
        {
            ct.ThrowIfCancellationRequested();
            var parameters = queryDefinition.GetQueryParameters().ToDictionary(parameter => parameter.Name, parameter => parameter.Value);
            var eventId = (string)parameters["@eventId"];
            var albumId = (string)parameters["@albumId"];
            Assert.Equal(PartitionKeyResolver.ForEventIdBasedData(eventId), opts!.PartitionKey);
            Assert.Contains("c.eventId = @eventId", queryDefinition.QueryText);
            Assert.Contains("c.kind IN ('photo', 'video')", queryDefinition.QueryText);
            Assert.Contains("c.albumId = @albumId", queryDefinition.QueryText);
            Assert.DoesNotContain("OFFSET", queryDefinition.QueryText);
            Assert.DoesNotContain("c.status", queryDefinition.QueryText);
            Assert.DoesNotContain("c.approved", queryDefinition.QueryText);
            if (albumId == "guest")
            {
                Assert.Contains("NOT IS_DEFINED(c.albumId) OR IS_NULL(c.albumId) OR c.albumId = ''", queryDefinition.QueryText);
            }

            var snapshot = Items.Where(item => item.EventId == eventId && item.Kind is "photo" or "video"
                    && (item.AlbumId == albumId || (albumId == "guest" && string.IsNullOrEmpty(item.AlbumId))))
                .Take((int)parameters["@limit"]).ToList();
            foreach (var item in snapshot)
            {
                yield return item;
            }
            await Task.CompletedTask;
        }

        public Task<MediaItem> AddAsync(MediaItem entity, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<MediaItem> UpsertAsync(MediaItem entity, CancellationToken ct = default) => throw new NotSupportedException();
        public IAsyncEnumerable<MediaItem> QueryAsync(string? query = null, QueryRequestOptions? opts = null,
            CancellationToken ct = default) => throw new NotSupportedException();
    }

    private sealed class BlobStore : IMediaStorageService
    {
        public List<string> Calls { get; } = [];
        public string? FailBlobName { get; set; }

        public Task DeleteOriginalIfExistsAsync(string? blobName, CancellationToken ct = default) => Delete("original", blobName, ct);
        public Task DeleteDerivedIfExistsAsync(string? blobName, CancellationToken ct = default) => Delete("derived", blobName, ct);

        private Task Delete(string type, string? name, CancellationToken ct)
        {
            ct.ThrowIfCancellationRequested();
            if (name == FailBlobName)
            {
                throw new RequestFailedException(503, "Simulated storage failure.");
            }
            Calls.Add($"{type}:{name}");
            return Task.CompletedTask;
        }

        public Task<Stream> OpenOriginalReadAsync(string blobName, CancellationToken ct = default) => throw new NotSupportedException();
        public Task UploadDerivedAsync(string blobName, Stream content, string contentType, CancellationToken ct = default) => throw new NotSupportedException();
        public string GetDerivedBlobUrl(string blobName) => throw new NotSupportedException();
        public string GetOriginalReadUrl(string blobName) => throw new NotSupportedException();
        public string GetOriginalDownloadUrl(string blobName) => throw new NotSupportedException();
    }
}
