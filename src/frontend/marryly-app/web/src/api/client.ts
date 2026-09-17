import { config } from '../app/config';
import type { Menu, Event, GuestbookEntry, PhotosPage, GalleryAlbum, GalleryAlbumsResponse, AlbumMediaPage } from '../types/wedding.types';
import type { CompletePhotoUploadRequest, CreatePhotoUploadRequest, PhotoUploadTarget } from '../types/upload.types';
import { ApiError } from '../errors/apiError';
import { notifyAuthFailure } from './authEvents';
import { ACCESS_TOKEN_HEADER, readAccessToken } from './accessTokenStorage';
import { responseProcessor } from './responseProcessor.ts';

export class ApiClient {
    private readonly baseUrl: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl;
    }

    private async fetchResponse(path: string, init?: RequestInit, accept = 'application/json, application/problem+json'): Promise<Response> {
        const accessToken = readAccessToken();
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers: {
                Accept: accept,
                ...(accessToken ? { [ACCESS_TOKEN_HEADER]: accessToken } : {}),
                ...(init?.headers ?? {}),
            },
        });

        if (!response.ok) {
            const apiError = await responseProcessor.parseError(response);

            if (apiError instanceof ApiError) {
                if (apiError.status === 401) {
                    notifyAuthFailure({
                        reason: 'unauthorized',
                        status: 401,
                        code: apiError.code,
                        message: apiError.message,
                        detail: apiError.detail,
                    });
                } else if (apiError.status === 403) {
                    notifyAuthFailure({
                        reason: 'forbidden',
                        status: 403,
                        code: apiError.code,
                        message: apiError.message,
                        detail: apiError.detail,
                    });
                }
            }

            throw apiError;
        }

        return response;
    }

    private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
        const response = await this.fetchResponse(path, init);
        return responseProcessor.parseResponse<T>(response);
    }

    private async fetchBlob(path: string, init?: RequestInit): Promise<Blob> {
        const response = await this.fetchResponse(path, init, 'application/zip, application/json, application/problem+json');
        return response.blob();
    }

    async getMenu(): Promise<Menu> {
        return this.fetchJson<Menu>('/app/menu');
    }

    async getEvents(): Promise<Event[]> {
        return this.fetchJson<Event[]>('/app/schedule');
    }

    async addGuestBookEntry(payload: { authorName: string; message?: string; mediaId?: string; videoMediaId?: string }): Promise<GuestbookEntry> {
        return this.fetchJson<GuestbookEntry>('/app/guestbook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
    }

    async createPhotoUpload(payload: CreatePhotoUploadRequest): Promise<PhotoUploadTarget> {
        return this.fetchJson<PhotoUploadTarget>('/app/photos/uploads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
    }

    async completePhotoUpload(payload: CompletePhotoUploadRequest): Promise<void> {
        await this.fetchJson<Record<string, unknown>>(`/app/photos/uploads/${payload.photoId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                blobName: payload.blobName,
                blobUrl: payload.blobUrl,
                contentType: payload.contentType,
                sizeBytes: payload.sizeBytes,
                capturedAt: payload.capturedAt,
                lastModifiedAt: payload.lastModifiedAt,
            }),
        });
    }

    async createMediaUpload(payload: CreatePhotoUploadRequest): Promise<PhotoUploadTarget> {
        return this.fetchJson<PhotoUploadTarget>('/app/media/uploads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
    }

    async completeMediaUpload(payload: CompletePhotoUploadRequest): Promise<void> {
        const mediaId = payload.mediaId ?? payload.photoId;
        await this.fetchJson<Record<string, unknown>>(`/app/media/uploads/${mediaId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                kind: payload.kind,
                blobName: payload.blobName,
                blobUrl: payload.blobUrl,
                contentType: payload.contentType,
                sizeBytes: payload.sizeBytes,
                capturedAt: payload.capturedAt,
                lastModifiedAt: payload.lastModifiedAt,
            }),
        });
    }

    async completeGuestBookVideoUpload(payload: CompletePhotoUploadRequest): Promise<void> {
        const mediaId = payload.mediaId ?? payload.photoId;
        await this.fetchJson<Record<string, unknown>>(`/app/guestbook/videos/uploads/${mediaId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                kind: 'video',
                blobName: payload.blobName,
                blobUrl: payload.blobUrl,
                contentType: payload.contentType,
                sizeBytes: payload.sizeBytes,
                capturedAt: payload.capturedAt,
                lastModifiedAt: payload.lastModifiedAt,
            }),
        });
    }

    async completeGuestBookMediaUpload(payload: CompletePhotoUploadRequest): Promise<void> {
        const mediaId = payload.mediaId ?? payload.photoId;
        await this.fetchJson<Record<string, unknown>>(`/app/guestbook/media/uploads/${mediaId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                kind: payload.kind,
                blobName: payload.blobName,
                blobUrl: payload.blobUrl,
                contentType: payload.contentType,
                sizeBytes: payload.sizeBytes,
                capturedAt: payload.capturedAt,
                lastModifiedAt: payload.lastModifiedAt,
            }),
        });
    }

    async getPhotos(limit = 50, continuationToken?: string | null): Promise<PhotosPage> {
        const params = new URLSearchParams({
            limit: String(limit),
        });

        if (continuationToken) {
            params.set('continuationToken', continuationToken);
        }

        return this.fetchJson<PhotosPage>(`/app/photos?${params.toString()}`);
    }

    async getGalleryAlbums(): Promise<GalleryAlbumsResponse> {
        return this.fetchJson<GalleryAlbumsResponse>('/app/gallery/albums');
    }

    async getGalleryAlbum(slug: string): Promise<GalleryAlbum> {
        return this.fetchJson<GalleryAlbum>(`/app/gallery/albums/${slug}`);
    }

    async getGalleryAlbumMedia(slug: string, limit = 50, continuationToken?: string | null): Promise<AlbumMediaPage> {
        const params = new URLSearchParams({
            limit: String(limit),
        });

        if (continuationToken) {
            params.set('continuationToken', continuationToken);
        }

        return this.fetchJson<AlbumMediaPage>(`/app/gallery/albums/${slug}/media?${params.toString()}`);
    }

    async getSharedGalleryAlbums(view: string): Promise<GalleryAlbumsResponse> {
        return this.fetchJson<GalleryAlbumsResponse>(`/app/gallery/shared?${new URLSearchParams({ view }).toString()}`);
    }

    async getSharedGalleryAlbum(shareCode: string, view: string): Promise<GalleryAlbum> {
        return this.fetchJson<GalleryAlbum>(`/app/gallery/shared/${shareCode}?${new URLSearchParams({ view }).toString()}`);
    }

    async getSharedGalleryAlbumMedia(shareCode: string, view: string, limit = 50, continuationToken?: string | null): Promise<AlbumMediaPage> {
        const params = new URLSearchParams({ view, limit: String(limit) });
        if (continuationToken) {
            params.set('continuationToken', continuationToken);
        }

        return this.fetchJson<AlbumMediaPage>(`/app/gallery/shared/${shareCode}/media?${params.toString()}`);
    }

    async downloadSharedGalleryAlbumPhotos(shareCode: string, view: string, mediaIds?: string[]): Promise<Blob> {
        const params = new URLSearchParams({ view });
        const isSelectionDownload = mediaIds !== undefined;

        return this.fetchBlob(`/app/gallery/shared/${shareCode}/download?${params.toString()}`, {
            method: isSelectionDownload ? 'POST' : 'GET',
            ...(isSelectionDownload ? {
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mediaIds }),
            } : {}),
        });
    }
}

export const apiClient = new ApiClient();
