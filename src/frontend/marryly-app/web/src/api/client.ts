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

    private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
        const accessToken = readAccessToken();
        const response = await fetch(`${this.baseUrl}${path}`, {
            ...init,
            headers: {
                Accept: 'application/json, application/problem+json',
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

        return responseProcessor.parseResponse<T>(response);
    }

    async getMenu(): Promise<Menu> {
        return this.fetchJson<Menu>('/app/menu');
    }

    async getEvents(): Promise<Event[]> {
        return this.fetchJson<Event[]>('/app/schedule');
    }

    async addGuestBookEntry(payload: { authorName: string; message: string }): Promise<GuestbookEntry> {
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
}

export const apiClient = new ApiClient();
