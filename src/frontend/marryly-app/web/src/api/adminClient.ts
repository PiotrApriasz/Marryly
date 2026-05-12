import { adminApiClient } from './adminApiClient';
import type {
    AdminAlbum,
    AdminAlbumMediaPage,
    AdminAlbumsResponse,
    AdminGuestBookEntriesPage,
    AdminOverview,
    AdminPhotosPage,
} from '../types/admin.types';
import type { CompletePhotoUploadRequest, CreatePhotoUploadRequest, PhotoUploadTarget } from '../types/upload.types';

export class AdminClient {
    async getOverview(): Promise<AdminOverview> {
        return adminApiClient.get<AdminOverview>('/panel/overview');
    }

    async getGuestBookEntries(page: number, pageSize: number): Promise<AdminGuestBookEntriesPage> {
        return adminApiClient.get<AdminGuestBookEntriesPage>(`/panel/guestbook?page=${page}&pageSize=${pageSize}`);
    }

    async getPhotos(page: number, pageSize: number): Promise<AdminPhotosPage> {
        return adminApiClient.get<AdminPhotosPage>(`/panel/photos?page=${page}&pageSize=${pageSize}`);
    }

    async deletePhoto(photoId: string): Promise<void> {
        await adminApiClient.delete<void>(`/panel/media/${photoId}`);
    }

    async getAlbums(): Promise<AdminAlbumsResponse> {
        return adminApiClient.get<AdminAlbumsResponse>('/panel/albums');
    }

    async createAlbum(payload: { title: string; description?: string; isVisible?: boolean }): Promise<AdminAlbum> {
        return adminApiClient.post<AdminAlbum>('/panel/albums', payload);
    }

    async updateAlbum(albumId: string, payload: { title?: string; description?: string; isVisible?: boolean }): Promise<AdminAlbum> {
        return adminApiClient.patch<AdminAlbum>(`/panel/albums/${albumId}`, payload);
    }

    async deleteAlbum(albumId: string): Promise<void> {
        await adminApiClient.delete<void>(`/panel/albums/${albumId}`);
    }

    async reorderAlbums(albumIds: string[]): Promise<void> {
        await adminApiClient.post<void>('/panel/albums/reorder', { albumIds });
    }

    async getAlbumMedia(albumId: string, page: number, pageSize: number): Promise<AdminAlbumMediaPage> {
        return adminApiClient.get<AdminAlbumMediaPage>(`/panel/albums/${albumId}/media?page=${page}&pageSize=${pageSize}`);
    }

    async createAlbumPhotoUpload(albumId: string, payload: CreatePhotoUploadRequest): Promise<PhotoUploadTarget> {
        return adminApiClient.post<PhotoUploadTarget>(`/panel/albums/${albumId}/photos/uploads`, payload);
    }

    async completeAlbumPhotoUpload(albumId: string, payload: CompletePhotoUploadRequest): Promise<void> {
        await adminApiClient.post<Record<string, unknown>>(`/panel/albums/${albumId}/photos/uploads/${payload.photoId}/complete`, {
            blobName: payload.blobName,
            blobUrl: payload.blobUrl,
            contentType: payload.contentType,
            sizeBytes: payload.sizeBytes,
        });
    }

    async deleteMedia(mediaId: string): Promise<void> {
        await adminApiClient.delete<void>(`/panel/media/${mediaId}`);
    }
}

export const adminClient = new AdminClient();
