import { config } from '../app/config';
import type { Menu, Event, GuestbookEntry, PhotosPage } from '../types/wedding.types';
import type { CompletePhotoUploadRequest, CreatePhotoUploadRequest, PhotoUploadTarget } from '../types/upload.types';
import {responseProcessor} from "./responseProcessor.ts";

export class ApiClient {
    private readonly baseUrl: string;
    private readonly eventId: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl;
        this.eventId = config.eventId;
    }

    private async fetchJson<T>(path: string): Promise<T> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            headers: {
                Accept: 'application/json, application/problem+json',
            },
        });

        return responseProcessor.parseResponse<T>(response);
    }

    async getMenu(): Promise<Menu> {
        return this.fetchJson<Menu>(`/events/${this.eventId}/menu`);
    }

    async getEvents(): Promise<Event[]> {
        return this.fetchJson<Event[]>(`/events/${this.eventId}/schedule`);
    }

    async addGuestBookEntry(payload: { authorName: string; message: string }): Promise<GuestbookEntry> {
        const response = await fetch(`${this.baseUrl}/events/${this.eventId}/guestbook`, {
            method: 'POST',
            headers: {
                Accept: 'application/json, application/problem+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        return responseProcessor.parseResponse<GuestbookEntry>(response);
    }

    async createPhotoUpload(payload: CreatePhotoUploadRequest): Promise<PhotoUploadTarget> {
        const response = await fetch(`${this.baseUrl}/events/${this.eventId}/photos/uploads`, {
            method: 'POST',
            headers: {
                Accept: 'application/json, application/problem+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        return responseProcessor.parseResponse<PhotoUploadTarget>(response);
    }

    async completePhotoUpload(payload: CompletePhotoUploadRequest): Promise<void> {
        const response = await fetch(`${this.baseUrl}/events/${this.eventId}/photos/uploads/${payload.photoId}/complete`, {
            method: 'POST',
            headers: {
                Accept: 'application/json, application/problem+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                blobName: payload.blobName,
                blobUrl: payload.blobUrl,
                contentType: payload.contentType,
                sizeBytes: payload.sizeBytes,
            }),
        });

        await responseProcessor.parseResponse<Record<string, unknown>>(response);
    }

    async getPhotos(limit = 50, continuationToken?: string | null): Promise<PhotosPage> {
        const params = new URLSearchParams({
            limit: String(limit),
        });

        if (continuationToken) {
            params.set('continuationToken', continuationToken);
        }

        return this.fetchJson<PhotosPage>(`/events/${this.eventId}/photos?${params.toString()}`);
    }
}

export const apiClient = new ApiClient();
