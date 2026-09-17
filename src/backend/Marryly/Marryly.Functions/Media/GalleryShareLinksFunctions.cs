using System.Net;
using System.Text.Json;
using Marryly.Application.Exceptions;
using Marryly.Application.Interfaces;
using Marryly.Application.Models.Media;
using Marryly.Functions.Result;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace Marryly.Functions.Media;

public class GalleryShareLinksFunctions(
    IAuthService authService,
    IGalleryShareLinkService galleryShareLinkService)
{
    [Function("GetGalleryShareLinks")]
    public async Task<HttpResponseData> GetLinks(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "panel/gallery-share-links")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        try
        {
            var links = await galleryShareLinkService.GetLinksAsync(auth.Context!.EventId, ct);
            return await ApiResponse.ProduceSuccessResponse(req, new
            {
                items = links.Select(MapLink).ToList()
            });
        }
        catch (CosmosException)
        {
            return await ProduceStorageError(req);
        }
    }

    [Function("CreateGalleryShareLink")]
    public async Task<HttpResponseData> CreateLink(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "panel/gallery-share-links")]
        HttpRequestData req,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        CreateGalleryShareLinkRequest? request;
        try
        {
            request = await JsonSerializer.DeserializeAsync<CreateGalleryShareLinkRequest>(req.Body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }, ct);
        }
        catch (JsonException)
        {
            request = null;
        }

        if (request is null)
        {
            return await ApiResponse.ProduceErrorResponse(req, HttpStatusCode.BadRequest, "INVALID_SHARE_LINK_PAYLOAD", "Invalid link payload", "Request body must contain valid link data.");
        }

        try
        {
            var link = await galleryShareLinkService.CreateLinkAsync(auth.Context!.EventId, request, ct);
            return await ApiResponse.ProduceSuccessResponse(req, MapLink(link));
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException)
        {
            return await ProduceStorageError(req);
        }
    }

    [Function("DeleteGalleryShareLink")]
    public async Task<HttpResponseData> DeleteLink(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "panel/gallery-share-links/{linkId}")]
        HttpRequestData req,
        string linkId,
        CancellationToken ct)
    {
        var auth = await AuthHelpers.ValidateAdminAsync(req, authService);
        if (auth.Response is not null)
        {
            return auth.Response;
        }

        try
        {
            await galleryShareLinkService.DeleteLinkAsync(auth.Context!.EventId, linkId, ct);
            return req.CreateResponse(HttpStatusCode.NoContent);
        }
        catch (ApiErrorException ex)
        {
            return await ApiResponse.ProduceErrorResponse(req, ex.StatusCode, ex.Code, ex.Title, ex.Detail);
        }
        catch (CosmosException)
        {
            return await ProduceStorageError(req);
        }
    }

    private static GalleryShareLinkResponse MapLink(GalleryShareLink link) => new()
    {
        Id = link.Id,
        Description = link.Description,
        AlbumIds = link.AlbumIds,
        Url = link.Url,
        CreatedAt = link.CreatedAt
    };

    private static Task<HttpResponseData> ProduceStorageError(HttpRequestData req) =>
        ApiResponse.ProduceErrorResponse(req, HttpStatusCode.InternalServerError, "SHARE_LINKS_STORAGE_FAILED", "Links unavailable", "Saved links could not be loaded right now.");
}
