using System.Runtime.CompilerServices;
using System.Net;
using Azure;
using Marryly.Application.Exceptions;
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

    [Fact]
    public async Task SelectedDeletionRemovesOnlyExplicitIdsIncludingVideoAndPreservesNewUploads()
    {
        var first = Media("first");
        var video = Media("video", kind: "video");
        var keep = Media("keep");
        var otherAlbum = Media("other-album", albumId: "other");
        var otherEvent = Media("other-event", eventId: "other");
        var store = new MediaStore([first, video, keep, otherAlbum, otherEvent]);
        var ids = new[] { first.Id, video.Id };
        var newlyUploaded = Media("uploaded-after-selection");
        store.Items.Add(newlyUploaded);
        var blobs = new BlobStore();
        var service = new MediaService(store, null!, blobs);

        Assert.Equal(2, await service.DeleteSelectedAlbumMediaAsync("event", "album", ids));
        Assert.Equal([keep, otherAlbum, otherEvent, newlyUploaded], store.Items);
        Assert.Equal(6, blobs.Calls.Count);
    }

    [Fact]
    public async Task SelectionFromAnotherAlbumRejectsWholeBatchBeforeDeletingAnyFiles()
    {
        var allowed = Media("allowed");
        var other = Media("other", albumId: "other");
        var store = new MediaStore([allowed, other]);
        var blobs = new BlobStore();
        var service = new MediaService(store, null!, blobs);

        var error = await Assert.ThrowsAsync<ApiErrorException>(() =>
            service.DeleteSelectedAlbumMediaAsync("event", "album", [allowed.Id, other.Id]));

        Assert.Equal(HttpStatusCode.BadRequest, error.StatusCode);
        Assert.Equal(2, store.Items.Count);
        Assert.Empty(blobs.Calls);
    }

    [Fact]
    public async Task SelectionNeverDeletesIdsFromAnotherEvent()
    {
        var other = Media("other", eventId: "other");
        var store = new MediaStore([other]);
        var blobs = new BlobStore();
        var service = new MediaService(store, null!, blobs);

        Assert.Equal(0, await service.DeleteSelectedAlbumMediaAsync("event", "album", [other.Id]));
        Assert.Single(store.Items);
        Assert.Empty(blobs.Calls);
    }

    [Fact]
    public async Task SelectedGuestMediaSupportsLegacyAlbumIds()
    {
        var keep = Media("keep");
        var store = new MediaStore([Media("explicit", albumId: "guest"), Media("null", albumId: null), Media("empty", albumId: ""), keep]);
        var service = new MediaService(store, null!, new BlobStore());

        Assert.Equal(3, await service.DeleteSelectedAlbumMediaAsync("event", "guest", ["explicit", "null", "empty"]));
        Assert.Equal(keep, Assert.Single(store.Items));
    }

    [Fact]
    public async Task DuplicateAndAlreadyDeletedIdsAreSafeToRetry()
    {
        var store = new MediaStore([Media("one"), Media("keep")]);
        var blobs = new BlobStore();
        var service = new MediaService(store, null!, blobs);

        Assert.Equal(1, await service.DeleteSelectedAlbumMediaAsync("event", "album", ["one", "one", "missing"]));
        Assert.Equal(0, await service.DeleteSelectedAlbumMediaAsync("event", "album", ["one", "missing"]));
        Assert.Equal("keep", Assert.Single(store.Items).Id);
        Assert.Equal(3, blobs.Calls.Count);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(26)]
    public async Task InvalidSelectionSizeDoesNotDeleteAnything(int count)
    {
        var store = new MediaStore([Media("one")]);
        var blobs = new BlobStore();
        var service = new MediaService(store, null!, blobs);

        await Assert.ThrowsAsync<ApiErrorException>(() => service.DeleteSelectedAlbumMediaAsync("event", "album",
            Enumerable.Range(0, count).Select(index => $"photo-{index}").ToList()));
        Assert.Single(store.Items);
        Assert.Empty(blobs.Calls);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public async Task EmptySelectionIdRejectsWholeBatch(string? badId)
    {
        var store = new MediaStore([Media("one")]);
        var blobs = new BlobStore();
        var service = new MediaService(store, null!, blobs);

        await Assert.ThrowsAsync<ApiErrorException>(() => service.DeleteSelectedAlbumMediaAsync("event", "album", ["one", badId!]));
        Assert.Single(store.Items);
        Assert.Empty(blobs.Calls);
    }

    [Fact]
    public async Task PartialSelectedDeletionCanBeRetriedWithoutTouchingUnselectedMedia()
    {
        var second = Media("second");
        var store = new MediaStore([Media("first"), second, Media("keep")]);
        var blobs = new BlobStore { FailBlobName = second.ThumbnailBlobName };
        var service = new MediaService(store, null!, blobs);

        await Assert.ThrowsAsync<RequestFailedException>(() => service.DeleteSelectedAlbumMediaAsync("event", "album", ["first", "second"]));
        Assert.Equal(["second", "keep"], store.Items.Select(item => item.Id));
        blobs.FailBlobName = null;

        Assert.Equal(1, await service.DeleteSelectedAlbumMediaAsync("event", "album", ["first", "second"]));
        Assert.Equal("keep", Assert.Single(store.Items).Id);
    }

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
                    && MediaAlbumMembership.Contains(item, albumId))
                .Take((int)parameters["@limit"]).ToList();
            foreach (var item in snapshot)
            {
                yield return item;
            }
            await Task.CompletedTask;
        }

        public Task<MediaItem> AddAsync(MediaItem entity, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<MediaItem> UpsertAsync(MediaItem entity, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<MediaItem?> UpdateAsync(string id, PartitionKey pk, Func<MediaItem, MediaItem> update, CancellationToken ct = default) => throw new NotSupportedException();
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
