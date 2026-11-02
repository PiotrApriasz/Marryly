using System.Net;
using System.Runtime.CompilerServices;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Infrastructure.Database;
using Marryly.Infrastructure.Services;
using Microsoft.Azure.Cosmos;
using Newtonsoft.Json;
using Xunit;

namespace Marryly.Tests;

public class AlbumMediaMembershipTests
{
    [Fact]
    public async Task AddKeepsOneMediaAndAllFilesAndIsIdempotentIncludingVideoAndLegacyGuest()
    {
        var photo = Media("photo", null);
        var video = Media("video", "guest", "video");
        var store = new Store([photo, video, Media("keep", "guest")]);
        var blobs = new Blobs();
        var service = new MediaService(store, null!, blobs);
        Assert.Equal(2, await service.AddSelectedMediaToAlbumAsync("event", "guest", "selected", ["photo", "video", "photo", "missing"]));
        await service.AddSelectedMediaToAlbumAsync("event", "selected", "selected", ["photo", "video"]);
        Assert.Equal(3, store.Items.Count);
        foreach (var id in new[] { "photo", "video" })
        {
            var item = store.Items.Single(item => item.Id == id);
            Assert.Equal(["guest", "selected"], item.AlbumIds);
            Assert.Equal($"{id}/original", item.OriginalBlobName);
            Assert.Equal($"{id}/preview", item.PreviewBlobName);
            Assert.Equal($"{id}/thumbnail", item.ThumbnailBlobName);
        }
        Assert.Empty(blobs.Deleted);
    }

    [Fact]
    public async Task AdditionValidatesWholeBatchAndDoesNotCrossAlbumOrEvent()
    {
        var store = new Store([Media("ok"), Media("other", "other"), Media("foreign", eventId: "foreign")]);
        var service = new MediaService(store, null!, new Blobs());
        await Assert.ThrowsAsync<ApiErrorException>(() => service.AddSelectedMediaToAlbumAsync("event", "source", "target", ["ok", "other"]));
        Assert.Null(store.Items[0].AlbumIds);
        Assert.Equal(0, await service.AddSelectedMediaToAlbumAsync("event", "source", "target", ["foreign"]));
    }

    [Fact]
    public async Task GalleriesHeroZipInsightsAndSlideshowUseMembershipWithoutRepeatingSharedMedia()
    {
        var first = Media("first"); first.AlbumIds = ["source", "selected"];
        var second = Media("second"); second.AlbumIds = ["selected"]; second.UploadedAt = first.UploadedAt.AddMinutes(1);
        var video = Media("video", kind: "video"); video.AlbumIds = ["selected"];
        var hidden = Media("hidden"); hidden.AlbumIds = ["selected"]; hidden.Approved = false;
        var failed = Media("failed"); failed.AlbumIds = ["selected"]; failed.Status = "failed";
        var store = new Store([first, second, video, hidden, failed, Media("outside")]);
        var service = new MediaService(store, null!, new Blobs());
        var admin = await service.GetAdminAlbumMediaPageAsync("event", "selected", 1, 50);
        Assert.Equal(5, admin.TotalCount);
        Assert.All(admin.Items, item => Assert.Contains("selected", item.AlbumIds));
        var publicPage = await service.GetAlbumMediaPageAsync("event", "selected", 50, null);
        Assert.Equal(3, publicPage.Items.Count);
        Assert.DoesNotContain(publicPage.Items, item => item.Id is "hidden" or "failed");
        var downloadable = await service.GetDownloadableAlbumPhotosAsync("event", "selected", ["first", "second", "video", "outside", "hidden", "failed"]);
        Assert.Equal(2, downloadable.Count);
        Assert.NotNull(await service.GetRandomAlbumPhotoUrlAsync("event", "selected"));
        var insights = await service.GetAlbumInsightsAsync("event", publicOnly: true);
        Assert.Equal(3, insights["selected"].ItemCount);
        Assert.Equal(2, insights["selected"].PhotoCount);
        Assert.Equal(2, insights["source"].ItemCount); // first and outside; explicit arrays override origin
        var slideshow = await service.GetSlideshowPhotosAsync("event", ["source", "selected"], null);
        Assert.Equal(3, slideshow.Count);
        Assert.Equal(3, slideshow.Select(item => item.Id).Distinct().Count());
        Assert.True(await service.HasAnyMediaInAlbumAsync("event", "selected"));
        Assert.False(await service.HasAnyMediaInAlbumAsync("event", "empty"));
    }

    [Fact]
    public async Task RemovalKeepsFilesAndOtherMembershipAndDoesNotFallBackToUploadOrigin()
    {
        var media = Media("one", "guest"); media.AlbumIds = ["guest", "selected"];
        var store = new Store([media]);
        var blobs = new Blobs();
        var service = new MediaService(store, null!, blobs);
        await service.RemoveSelectedMediaFromAlbumAsync("event", "guest", ["one"]);
        await service.RemoveSelectedMediaFromAlbumAsync("event", "guest", ["one", "missing"]);
        Assert.Equal(["selected"], store.Items[0].AlbumIds);
        Assert.Equal("guest", store.Items[0].AlbumId);
        Assert.Empty((await service.GetAdminAlbumMediaPageAsync("event", "guest", 1, 50)).Items);
        Assert.Single((await service.GetAlbumMediaPageAsync("event", "selected", 50, null)).Items);
        Assert.Empty(blobs.Deleted);
    }

    [Fact]
    public async Task RemovingLastMembershipRejectsEntireBatchBeforeChanges()
    {
        var shared = Media("shared"); shared.AlbumIds = ["source", "selected"];
        var store = new Store([shared, Media("only")]);
        var service = new MediaService(store, null!, new Blobs());
        var error = await Assert.ThrowsAsync<ApiErrorException>(() => service.RemoveSelectedMediaFromAlbumAsync("event", "source", ["shared", "only"]));
        Assert.Equal(HttpStatusCode.Conflict, error.StatusCode);
        Assert.Equal("MEDIA_LAST_ALBUM", error.Code);
        Assert.Equal(["source", "selected"], store.Items[0].AlbumIds);
    }

    [Fact]
    public async Task PermanentDeletionFromSecondaryAlbumDeletesOneSetOfFilesAndAllMemberships()
    {
        var media = Media("one"); media.AlbumIds = ["source", "selected"];
        var store = new Store([media]); var blobs = new Blobs();
        var service = new MediaService(store, null!, blobs);
        Assert.Equal(1, await service.DeleteSelectedAlbumMediaAsync("event", "selected", ["one"]));
        Assert.Empty(store.Items);
        Assert.Equal(["one/original", "one/preview", "one/thumbnail"], blobs.Deleted);
    }

    [Fact]
    public async Task DerivativeSavePreservesMembershipChangesMadeAfterItsInitialRead()
    {
        var store = new Store([Media("one")]);
        var service = new MediaService(store, null!, new Blobs());
        var stale = await service.GetMediaByIdAsync("event", "one");
        await service.AddSelectedMediaToAlbumAsync("event", "source", "selected", ["one"]);
        await service.RemoveSelectedMediaFromAlbumAsync("event", "source", ["one"]);
        stale!.Width = 2560;
        var saved = await service.UpsertMediaAsync("event", stale);
        Assert.Equal(2560, saved.Width);
        Assert.Equal(["selected"], saved.AlbumIds);
        Assert.Equal("source", saved.AlbumId);
    }

    [Theory]
    [InlineData(0)] [InlineData(26)]
    public async Task MembershipOperationsRejectInvalidBatchSizes(int size)
    {
        var service = new MediaService(new Store([]), null!, new Blobs());
        var ids = Enumerable.Repeat("one", size).ToArray();
        await Assert.ThrowsAsync<ApiErrorException>(() => service.AddSelectedMediaToAlbumAsync("event", "source", "selected", ids));
        await Assert.ThrowsAsync<ApiErrorException>(() => service.RemoveSelectedMediaFromAlbumAsync("event", "source", ids));
    }

    [Fact]
    public async Task RetryAfterPartialAdditionDoesNotDuplicateMembershipOrLoseOtherAlbums()
    {
        var store = new Store([Media("first"), Media("second")]) { FailUpdateId = "second" };
        var service = new MediaService(store, null!, new Blobs());
        await Assert.ThrowsAsync<CosmosException>(() => service.AddSelectedMediaToAlbumAsync("event", "source", "selected", ["first", "second"]));
        Assert.Equal(["source", "selected"], store.Items[0].AlbumIds);
        Assert.Null(store.Items[1].AlbumIds);
        store.FailUpdateId = null;
        await service.AddSelectedMediaToAlbumAsync("event", "source", "private", ["first"]);
        await service.AddSelectedMediaToAlbumAsync("event", "source", "selected", ["first", "second"]);
        Assert.Equal(["source", "selected", "private"], store.Items[0].AlbumIds);
        Assert.Equal(["source", "selected"], store.Items[1].AlbumIds);
    }

    [Fact]
    public async Task NewUploadsStartWithOneMembershipAndExplicitEmptyArrayDoesNotRestoreLegacyAlbum()
    {
        var service = new MediaService(new Store([]), null!, new Blobs());
        var saved = await service.UpsertMediaAsync("event", Media("new", "guest"));
        Assert.Equal(["guest"], saved.AlbumIds);
        saved.AlbumIds = [];
        Assert.False(MediaAlbumMembership.Contains(saved, "guest"));
    }

    [Fact]
    public async Task AdminDownloadIncludesWholeSelectedSnapshotInChronologyIncludingVideosAndNonPublicOriginals()
    {
        var media = Enumerable.Range(0, 151).Select(index => {
            var item = Media($"media-{index:D3}", kind: index % 2 == 0 ? "photo" : "video");
            item.CapturedAt = item.UploadedAt.AddMinutes(index);
            item.Approved = false;
            item.Status = "failed";
            return item;
        }).ToList();
        var store = new Store([.. media.AsEnumerable().Reverse(), Media("new-upload"), Media("other", "other")]);
        var service = new MediaService(store, null!, new Blobs());
        var selectedIds = media.Select(item => item.Id).Append(media[0].Id).ToArray();
        var result = await service.GetDownloadableAdminAlbumMediaAsync("event", "source", selectedIds);
        Assert.Equal(media.Select(item => item.Id), result.Select(item => item.Id));
        Assert.Equal(151, result.Count);
        Assert.Contains(result, item => item.Kind == "video");
        Assert.All(result, item => Assert.EndsWith("/original", item.OriginalBlobName));
    }

    [Fact]
    public async Task AdminDownloadHonorsSharedMembershipAndRejectsMissingOrForeignSelection()
    {
        var shared = Media("shared", "guest"); shared.AlbumIds = ["guest", "selected"];
        var otherEvent = Media("other-event", eventId: "other");
        var store = new Store([shared, Media("outside"), otherEvent, Media("unsupported", "selected", "attachment")]);
        var service = new MediaService(store, null!, new Blobs());
        Assert.Single(await service.GetDownloadableAdminAlbumMediaAsync("event", "selected", ["shared"]));
        foreach (var invalid in new[] { "missing", "outside", "other-event", "unsupported" })
        {
            var error = await Assert.ThrowsAsync<ApiErrorException>(() => service.GetDownloadableAdminAlbumMediaAsync("event", "selected", ["shared", invalid]));
            Assert.Equal("DOWNLOAD_MEDIA_INVALID", error.Code);
            Assert.Equal(HttpStatusCode.BadRequest, error.StatusCode);
        }
    }

    [Fact]
    public async Task AdminDownloadValidatesEmptySelectionAndIncludesLegacyGuestRecords()
    {
        var service = new MediaService(new Store([Media("legacy", null)]), null!, new Blobs());
        Assert.Single(await service.GetDownloadableAdminAlbumMediaAsync("event", "guest", ["legacy"]));
        foreach (var ids in new string[][] { [], [""], [" "], [null!] })
        {
            var error = await Assert.ThrowsAsync<ApiErrorException>(() => service.GetDownloadableAdminAlbumMediaAsync("event", "guest", ids));
            Assert.Equal("DOWNLOAD_MEDIA_REQUIRED", error.Code);
        }
    }

    private static MediaItem Media(string id, string? albumId = "source", string kind = "photo", string eventId = "event") => new()
    {
        Id = id, EventId = eventId, AlbumId = albumId, Kind = kind, Status = "ready", Approved = true,
        UploadedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        OriginalBlobName = $"{id}/original", OriginalBlobUrl = $"https://example.invalid/{id}",
        PreviewBlobName = $"{id}/preview", PreviewBlobUrl = $"https://example.invalid/{id}/preview",
        ThumbnailBlobName = $"{id}/thumbnail", ContentType = "image/jpeg"
    };

    private sealed class Store(List<MediaItem> items) : ICosmosDbService<MediaItem>
    {
        public List<MediaItem> Items { get; } = items;
        public string? FailUpdateId { get; set; }
        private static MediaItem Clone(MediaItem item) => JsonConvert.DeserializeObject<MediaItem>(JsonConvert.SerializeObject(item))!;
        public Task<MediaItem?> GetAsync(string id, PartitionKey pk, CancellationToken ct = default) => Task.FromResult(
            Items.FirstOrDefault(item => item.Id == id && PartitionKeyResolver.ForEventIdBasedData(item.EventId).Equals(pk)) is { } item ? Clone(item) : null);
        public Task<MediaItem> AddAsync(MediaItem item, CancellationToken ct = default) { Items.Add(Clone(item)); return Task.FromResult(item); }
        public Task<MediaItem> UpsertAsync(MediaItem item, CancellationToken ct = default) => throw new NotSupportedException();
        public async Task<MediaItem?> UpdateAsync(string id, PartitionKey pk, Func<MediaItem, MediaItem> update, CancellationToken ct = default)
        {
            ct.ThrowIfCancellationRequested();
            if (id == FailUpdateId) throw new CosmosException("Simulated throttling", HttpStatusCode.TooManyRequests, 0, "test", 0);
            var item = await GetAsync(id, pk, ct);
            if (item is null) return null;
            var saved = update(item);
            Items[Items.FindIndex(current => current.Id == id && current.EventId == item.EventId)] = Clone(saved);
            return saved;
        }
        public Task DeleteAsync(string id, PartitionKey pk, CancellationToken ct = default) { Items.RemoveAll(item => item.Id == id && PartitionKeyResolver.ForEventIdBasedData(item.EventId).Equals(pk)); return Task.CompletedTask; }
        public IAsyncEnumerable<MediaItem> QueryAsync(string? query = null, QueryRequestOptions? opts = null, CancellationToken ct = default) => throw new NotSupportedException();
        public async IAsyncEnumerable<MediaItem> QueryAsync(QueryDefinition query, QueryRequestOptions? opts = null, [EnumeratorCancellation] CancellationToken ct = default)
        {
            var parameters = query.GetQueryParameters().ToDictionary(p => p.Name, p => p.Value);
            var eventId = (string)parameters["@eventId"];
            Assert.Equal(PartitionKeyResolver.ForEventIdBasedData(eventId), opts!.PartitionKey);
            var albums = parameters.Where(p => p.Key.StartsWith("@albumId", StringComparison.Ordinal)).Select(p => (string)p.Value).ToList();
            if (albums.Count > 0)
            {
                Assert.Contains("IS_ARRAY(c.albumIds)", query.QueryText);
                Assert.Contains("ARRAY_CONTAINS(c.albumIds, @albumId", query.QueryText);
                Assert.Contains("NOT IS_ARRAY(c.albumIds)", query.QueryText);
            }
            var matching = Items.Where(item => item.EventId == eventId
                && (albums.Count == 0 || albums.Any(album => MediaAlbumMembership.Contains(item, album)))
                && (!parameters.TryGetValue("@kind", out var kind) || item.Kind == (string)kind)
                && (!query.QueryText.Contains("c.approved = true") || item.Approved)
                && (!parameters.TryGetValue("@status", out var status) || item.Status == (string)status)
                && (!parameters.TryGetValue("@mediaIds", out var ids) || ((IEnumerable<string>)ids).Contains(item.Id)))
                .OrderByDescending(item => item.UploadedAt).ToList();
            foreach (var item in matching) { ct.ThrowIfCancellationRequested(); yield return Clone(item); }
            await Task.CompletedTask;
        }
    }
    private sealed class Blobs : IMediaStorageService
    {
        public List<string> Deleted { get; } = [];
        public string GetOriginalReadUrl(string name) => $"https://example.invalid/{name}";
        public string GetOriginalDownloadUrl(string name) => $"https://example.invalid/{name}/download";
        public Task DeleteOriginalIfExistsAsync(string? name, CancellationToken ct = default) { Deleted.Add(name!); return Task.CompletedTask; }
        public Task DeleteDerivedIfExistsAsync(string? name, CancellationToken ct = default) { Deleted.Add(name!); return Task.CompletedTask; }
        public Task<Stream> OpenOriginalReadAsync(string name, CancellationToken ct = default) => throw new NotSupportedException();
        public Task UploadDerivedAsync(string name, Stream content, string contentType, CancellationToken ct = default) => throw new NotSupportedException();
        public string GetDerivedBlobUrl(string name) => throw new NotSupportedException();
    }
}
