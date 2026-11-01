using System.Net;
using System.Runtime.CompilerServices;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Infrastructure.Database;
using Marryly.Infrastructure.Services;
using Microsoft.Azure.Cosmos;
using Xunit;

namespace Marryly.Tests;

public class AlbumMediaOrderingTests
{
    private static readonly DateTime Start = new(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task PublicAndAdminPagesFollowGlobalCaptureDateRegardlessOfUploadOrder()
    {
        var store = new MediaStore(Enumerable.Range(0, 151).Select(index => Media($"photo-{index:D3}",
            Start.AddMinutes(index), Start.AddYears(1).AddMinutes(151 - index))).Reverse().ToList());
        var service = new MediaService(store, null!, new BlobUrls());
        var expected = Enumerable.Range(0, 151).Select(index => $"photo-{index:D3}").ToList();
        var publicIds = new List<string>();
        string? token = null;
        var requests = 0;
        do
        {
            var response = await service.GetAlbumMediaPageAsync("event", "album", 50, token);
            publicIds.AddRange(response.Items.Select(item => item.Id));
            Assert.Equal(response.HasMore, response.ContinuationToken is not null);
            token = response.ContinuationToken;
            Assert.True(++requests <= 4);
        } while (token is not null);

        Assert.Equal(expected, publicIds);
        var adminIds = new List<string>();
        for (var page = 1; page <= 4; page += 1)
        {
            var response = await service.GetAdminAlbumMediaPageAsync("event", "album", page, 50);
            Assert.Equal(151, response.TotalCount);
            Assert.Equal(4, response.TotalPages);
            adminIds.AddRange(response.Items.Select(item => item.Id));
        }
        Assert.Equal(expected, adminIds);
    }

    [Fact]
    public async Task MissingCaptureDateFallsBackToUploadDateInTheGlobalTimeline()
    {
        var store = new MediaStore([
            Media("captured-new", Start.AddDays(2), Start.AddYears(1)),
            Media("fallback-new", null, Start.AddDays(3)),
            Media("captured-old", Start, Start.AddYears(2)),
            Media("fallback-old", null, Start.AddDays(1))
        ]);
        var service = new MediaService(store, null!, new BlobUrls());

        var response = await service.GetAlbumMediaPageAsync("event", "album", 50, null);

        Assert.Equal(["captured-old", "fallback-old", "captured-new", "fallback-new"], response.Items.Select(item => item.Id));
    }

    [Fact]
    public async Task EqualDatesUseUploadDateThenIdAndDoNotSkipItemsAcrossPages()
    {
        var store = new MediaStore(Enumerable.Range(0, 120).Select(index => Media($"photo-{index:D3}", Start, Start.AddDays(1))).ToList());
        store.Items.Add(Media("uploaded-earlier", Start, Start));
        var service = new MediaService(store, null!, new BlobUrls());
        var ids = new List<string>();
        string? token = null;
        do
        {
            var response = await service.GetAlbumMediaPageAsync("event", "album", 7, token);
            ids.AddRange(response.Items.Select(item => item.Id));
            token = response.ContinuationToken;
            Assert.True(ids.Count <= 121);
        } while (token is not null);

        Assert.Equal(["uploaded-earlier", .. Enumerable.Range(0, 120).Select(index => $"photo-{index:D3}")], ids);
    }

    [Fact]
    public async Task CursorContinuesAfterDeletedItemsWithoutSkippingTheNextPhoto()
    {
        var store = new MediaStore(Enumerable.Range(0, 4).Select(index => Media($"photo-{index}", Start.AddDays(index), Start)).ToList());
        var service = new MediaService(store, null!, new BlobUrls());
        var first = await service.GetAlbumMediaPageAsync("event", "album", 2, null);
        store.Items.RemoveAll(item => item.Id is "photo-0" or "photo-1");

        var second = await service.GetAlbumMediaPageAsync("event", "album", 2, first.ContinuationToken);

        Assert.Equal(["photo-2", "photo-3"], second.Items.Select(item => item.Id));
        Assert.False(second.HasMore);
    }

    [Fact]
    public async Task PublicTimelinePreservesVisibilityAndAlbumAndEventBoundaries()
    {
        var visible = Media("visible", Start, Start);
        var hidden = Media("hidden", Start.AddDays(-1), Start);
        hidden.Approved = false;
        var failed = Media("failed", Start.AddDays(-2), Start);
        failed.Status = "failed";
        var otherAlbum = Media("other-album", Start, Start);
        otherAlbum.AlbumId = "other";
        var otherEvent = Media("other-event", Start, Start);
        otherEvent.EventId = "other";
        var store = new MediaStore([visible, hidden, failed, otherAlbum, otherEvent]);
        var service = new MediaService(store, null!, new BlobUrls());

        var publicPage = await service.GetAlbumMediaPageAsync("event", "album", 50, null);
        var adminPage = await service.GetAdminAlbumMediaPageAsync("event", "album", 1, 50);

        Assert.Equal("visible", Assert.Single(publicPage.Items).Id);
        Assert.Equal(["failed", "hidden", "visible"], adminPage.Items.Select(item => item.Id));
    }

    [Fact]
    public async Task GuestAlbumTimelineIncludesLegacyRecordsWithoutAlbumId()
    {
        var explicitGuest = Media("explicit", Start.AddDays(2), Start);
        explicitGuest.AlbumId = "guest";
        var legacy = Media("legacy", null, Start);
        legacy.AlbumId = null;
        var emptyAlbum = Media("empty", Start.AddDays(1), Start);
        emptyAlbum.AlbumId = "";
        var service = new MediaService(new MediaStore([explicitGuest, legacy, emptyAlbum, Media("other", Start, Start)]), null!, new BlobUrls());

        var response = await service.GetAlbumMediaPageAsync("event", "guest", 50, null);

        Assert.Equal(["legacy", "empty", "explicit"], response.Items.Select(item => item.Id));
    }

    [Theory]
    [InlineData("not-a-token")]
    [InlineData("bnVsbA")]
    [InlineData("e30")]
    public async Task RejectsInvalidContinuationTokens(string token)
    {
        var service = new MediaService(new MediaStore([]), null!, new BlobUrls());
        var error = await Assert.ThrowsAsync<ApiErrorException>(() => service.GetAlbumMediaPageAsync("event", "album", 50, token));
        Assert.Equal(HttpStatusCode.BadRequest, error.StatusCode);
    }

    [Fact]
    public async Task RejectsOversizedAndCrossAlbumOrCrossEventTokens()
    {
        var store = new MediaStore([Media("a", Start, Start), Media("b", Start.AddDays(1), Start)]);
        var service = new MediaService(store, null!, new BlobUrls());
        var first = await service.GetAlbumMediaPageAsync("event", "album", 1, null);

        await Assert.ThrowsAsync<ApiErrorException>(() => service.GetAlbumMediaPageAsync("event", "other", 50, first.ContinuationToken));
        await Assert.ThrowsAsync<ApiErrorException>(() => service.GetAlbumMediaPageAsync("other", "album", 50, first.ContinuationToken));
        await Assert.ThrowsAsync<ApiErrorException>(() => service.GetAlbumMediaPageAsync("event", "album", 50, new string('A', 4097)));
    }

    [Fact]
    public async Task EmptyAlbumAndOutOfRangeAdminPageHaveConsistentPagination()
    {
        var store = new MediaStore([]);
        var service = new MediaService(store, null!, new BlobUrls());
        var emptyPublic = await service.GetAlbumMediaPageAsync("event", "album", 0, null);
        var emptyAdmin = await service.GetAdminAlbumMediaPageAsync("event", "album", int.MaxValue, 0);
        Assert.Empty(emptyPublic.Items);
        Assert.False(emptyPublic.HasMore);
        Assert.Null(emptyPublic.ContinuationToken);
        Assert.Equal(1, emptyAdmin.Page);
        Assert.Equal(1, emptyAdmin.TotalPages);
        Assert.Equal(1, emptyAdmin.PageSize);

        store.Items.AddRange([Media("old", Start, Start), Media("new", Start.AddDays(1), Start)]);
        var lastPage = await service.GetAdminAlbumMediaPageAsync("event", "album", int.MaxValue, 1);
        Assert.Equal(2, lastPage.Page);
        Assert.Equal("new", Assert.Single(lastPage.Items).Id);
    }

    private static MediaItem Media(string id, DateTime? capturedAt, DateTime uploadedAt) => new()
    {
        Id = id, EventId = "event", AlbumId = "album", Kind = "photo", Status = "ready", Approved = true,
        CapturedAt = capturedAt, UploadedAt = uploadedAt, OriginalBlobName = $"{id}/original",
        OriginalBlobUrl = "https://example.invalid/original", ContentType = "image/jpeg"
    };

    private sealed class MediaStore(List<MediaItem> items) : ICosmosDbService<MediaItem>
    {
        public List<MediaItem> Items { get; } = items;
        private int _queries;

        public async IAsyncEnumerable<MediaItem> QueryAsync(QueryDefinition query,
            QueryRequestOptions? opts = null, [EnumeratorCancellation] CancellationToken ct = default)
        {
            ct.ThrowIfCancellationRequested();
            var parameters = query.GetQueryParameters().ToDictionary(parameter => parameter.Name, parameter => parameter.Value);
            var eventId = (string)parameters["@eventId"];
            var albumId = (string)parameters["@albumId"];
            Assert.Equal(PartitionKeyResolver.ForEventIdBasedData(eventId), opts!.PartitionKey);
            Assert.Contains("c.eventId = @eventId", query.QueryText);
            Assert.Contains("c.albumId = @albumId", query.QueryText);
            var publicOnly = query.QueryText.Contains("c.approved = true", StringComparison.Ordinal);
            if (publicOnly)
            {
                Assert.Contains("c.status = @status", query.QueryText);
                Assert.Equal("ready", parameters["@status"]);
            }
            if (albumId == "guest")
            {
                Assert.Contains("NOT IS_DEFINED(c.albumId) OR IS_NULL(c.albumId) OR c.albumId = ''", query.QueryText);
            }

            var matching = Items.Where(item => item.EventId == eventId
                && (item.AlbumId == albumId || (albumId == "guest" && string.IsNullOrEmpty(item.AlbumId)))
                && (!publicOnly || (item.Approved && item.Status == "ready"))).ToList();
            if (++_queries % 2 == 0)
            {
                matching.Reverse();
            }
            foreach (var item in matching)
            {
                yield return item;
            }
            await Task.CompletedTask;
        }

        public Task<MediaItem?> GetAsync(string id, PartitionKey pk, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<MediaItem> AddAsync(MediaItem entity, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<MediaItem> UpsertAsync(MediaItem entity, CancellationToken ct = default) => throw new NotSupportedException();
        public Task DeleteAsync(string id, PartitionKey pk, CancellationToken ct = default) => throw new NotSupportedException();
        public IAsyncEnumerable<MediaItem> QueryAsync(string? query = null, QueryRequestOptions? opts = null,
            CancellationToken ct = default) => throw new NotSupportedException();
    }

    private sealed class BlobUrls : IMediaStorageService
    {
        public string GetOriginalReadUrl(string name) => $"https://example.invalid/read/{name}";
        public string GetOriginalDownloadUrl(string name) => $"https://example.invalid/download/{name}";
        public Task<Stream> OpenOriginalReadAsync(string name, CancellationToken ct = default) => throw new NotSupportedException();
        public Task UploadDerivedAsync(string name, Stream content, string contentType, CancellationToken ct = default) => throw new NotSupportedException();
        public string GetDerivedBlobUrl(string name) => throw new NotSupportedException();
        public Task DeleteOriginalIfExistsAsync(string? name, CancellationToken ct = default) => throw new NotSupportedException();
        public Task DeleteDerivedIfExistsAsync(string? name, CancellationToken ct = default) => throw new NotSupportedException();
    }
}
