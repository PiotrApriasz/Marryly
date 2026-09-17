using System.Net;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Infrastructure.Database;
using Microsoft.Azure.Cosmos;

namespace Marryly.Infrastructure.Services;

public class GalleryShareLinkService(
    ICosmosDbService<GalleryShareLink> cosmosDbService,
    IAlbumService albumService) : IGalleryShareLinkService
{
    private const string GalleryShareLinkType = "galleryShareLink";

    public async Task<IReadOnlyList<GalleryShareLink>> GetLinksAsync(string eventId, CancellationToken ct = default)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.eventId = @eventId AND c.type = @type ORDER BY c.createdAt DESC")
            .WithParameter("@eventId", eventId)
            .WithParameter("@type", GalleryShareLinkType);
        var links = new List<GalleryShareLink>();

        await foreach (var link in cosmosDbService.QueryAsync(query, new QueryRequestOptions
                       {
                           PartitionKey = PartitionKeyResolver.ForEventIdBasedData(eventId)
                       }, ct))
        {
            links.Add(link);
        }

        return links;
    }

    public async Task<GalleryShareLink> CreateLinkAsync(
        string eventId,
        CreateGalleryShareLinkRequest request,
        CancellationToken ct = default)
    {
        var requestedAlbumIds = request.AlbumIds ?? [];
        var albumIds = requestedAlbumIds
            .Select(id => id?.Trim() ?? string.Empty)
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList() ?? [];

        if (albumIds.Count == 0 || albumIds.Count != requestedAlbumIds.Count)
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, "SHARE_LINK_ALBUMS_INVALID", "Invalid albums", "Choose at least one distinct album.");
        }

        if (string.IsNullOrWhiteSpace(request.Url))
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, "SHARE_LINK_URL_REQUIRED", "Link URL required", "A generated link URL is required.");
        }

        var albums = await Task.WhenAll(albumIds.Select(id => albumService.GetAlbumByIdAsync(eventId, id, ct)));
        if (albums.Any(album => album is null || !album.IsLinkAccessible || string.IsNullOrWhiteSpace(album.ShareCode)))
        {
            throw new ApiErrorException(HttpStatusCode.BadRequest, "SHARE_LINK_ALBUMS_INVALID", "Invalid albums", "Every selected album must be available through a link.");
        }

        var link = new GalleryShareLink
        {
            Id = $"{eventId}:gallery-share-link:{Guid.NewGuid():N}",
            EventId = eventId,
            Type = GalleryShareLinkType,
            Description = request.Description?.Trim(),
            AlbumIds = albumIds,
            Url = request.Url.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        return await cosmosDbService.AddAsync(link, ct);
    }

    public async Task DeleteLinkAsync(string eventId, string linkId, CancellationToken ct = default)
    {
        var link = await cosmosDbService.GetAsync(linkId, PartitionKeyResolver.ForEventIdBasedData(eventId), ct);
        if (link is null || !string.Equals(link.Type, GalleryShareLinkType, StringComparison.Ordinal))
        {
            throw new ApiErrorException(HttpStatusCode.NotFound, "SHARE_LINK_NOT_FOUND", "Link not found", "The saved link does not exist.");
        }

        await cosmosDbService.DeleteAsync(link.Id, PartitionKeyResolver.ForEventIdBasedData(eventId), ct);
    }
}
