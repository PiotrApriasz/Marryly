import { adminApiClient } from './adminApiClient';
import type {
    AdminAlbum,
    AdminAlbumMediaPage,
    AdminAlbumsResponse,
    AdminGuestFamilyPayload,
    AdminGuestFamilyResponse,
    AdminGuestInvitationGroup,
    AdminGuestInvitationGroupPayload,
    AdminGuestListEntry,
    AdminGuestListEntryPayload,
    AdminGuestListResponse,
    AdminGuestBookEntriesPage,
    AdminOverview,
    AdminMenu,
    AdminMenuPayload,
    AdminPhotosPage,
    AdminSlideshowPhotosResponse,
    AdminSlideshowSettings,
    AdminSlideshowSettingsPayload,
} from '../types/admin.types';
import type { CompletePhotoUploadRequest, CreatePhotoUploadRequest, PhotoUploadTarget } from '../types/upload.types';

export class AdminClient {
    async getOverview(): Promise<AdminOverview> {
        return adminApiClient.get<AdminOverview>('/panel/overview');
    }

    async getMenu(): Promise<AdminMenu> {
        return adminApiClient.get<AdminMenu>('/panel/menu');
    }

    async saveMenu(payload: AdminMenuPayload): Promise<AdminMenu> {
        return adminApiClient.put<AdminMenu>('/panel/menu', payload);
    }

    async getGuestBookEntries(page: number, pageSize: number): Promise<AdminGuestBookEntriesPage> {
        return adminApiClient.get<AdminGuestBookEntriesPage>(`/panel/guestbook?page=${page}&pageSize=${pageSize}`);
    }

    async getGuests(): Promise<AdminGuestListResponse> {
        return adminApiClient.get<AdminGuestListResponse>('/panel/guests');
    }

    async createGuest(payload: AdminGuestListEntryPayload): Promise<AdminGuestListEntry> {
        return adminApiClient.post<AdminGuestListEntry>('/panel/guests', payload);
    }

    async createGuestGroup(payload: AdminGuestInvitationGroupPayload): Promise<AdminGuestInvitationGroup> {
        return adminApiClient.post<AdminGuestInvitationGroup>('/panel/guest-groups', payload);
    }

    async createGuestFamily(payload: AdminGuestFamilyPayload): Promise<AdminGuestFamilyResponse> {
        return adminApiClient.post<AdminGuestFamilyResponse>('/panel/guest-families', payload);
    }

    async updateGuest(guestId: string, payload: AdminGuestListEntryPayload): Promise<AdminGuestListEntry> {
        return adminApiClient.patch<AdminGuestListEntry>(`/panel/guests/${guestId}`, payload);
    }

    async deleteGuest(guestId: string): Promise<void> {
        await adminApiClient.delete<void>(`/panel/guests/${guestId}`);
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

    async getSlideshowSettings(): Promise<AdminSlideshowSettings> {
        return adminApiClient.get<AdminSlideshowSettings>('/panel/slideshow');
    }

    async saveSlideshowSettings(payload: AdminSlideshowSettingsPayload): Promise<AdminSlideshowSettings> {
        return adminApiClient.put<AdminSlideshowSettings>('/panel/slideshow', payload);
    }

    async getSlideshowPhotos(afterUploadedAt?: string): Promise<AdminSlideshowPhotosResponse> {
        const query = afterUploadedAt
            ? `?afterUploadedAt=${encodeURIComponent(afterUploadedAt)}`
            : '';
        return adminApiClient.get<AdminSlideshowPhotosResponse>(`/panel/slideshow/photos${query}`);
    }
}

export const adminClient = new AdminClient();
