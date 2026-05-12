export interface AdminOverview {
    photosCount: number;
    guestsCount: number;
    wishesCount: number;
    menuPublished: boolean;
    attractionsCount: number;
    settingsCount: number;
}

export interface AdminGuestBookEntry {
    id: string;
    eventId: string;
    authorName: string;
    message: string;
    createdAt: string;
}

export interface AdminGuestBookEntriesPage {
    entries: AdminGuestBookEntry[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}

export interface AdminPhoto {
    id: string;
    eventId: string;
    status: 'ready' | 'processing' | 'failed' | string;
    approved: boolean;
    uploadedAt: string;
    contentType: string;
    sizeBytes: number;
    width: number;
    height: number;
    originalBlobName: string;
    originalBlobUrl: string;
    previewBlobName?: string | null;
    previewBlobUrl?: string | null;
    thumbnailBlobName?: string | null;
    thumbnailBlobUrl?: string | null;
    processingError?: string | null;
}

export interface AdminPhotosPage {
    items: AdminPhoto[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}

export interface AdminAlbum {
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    isSystem: boolean;
    isVisible: boolean;
    sortOrder: number;
    coverUrl?: string | null;
    itemCount: number;
}

export interface AdminAlbumsResponse {
    items: AdminAlbum[];
}

export interface AdminAlbumMediaItem {
    id: string;
    eventId: string;
    albumId?: string | null;
    sourceType?: string | null;
    status: string;
    approved: boolean;
    uploadedAt: string;
    contentType: string;
    sizeBytes: number;
    width: number;
    height: number;
    originalBlobName: string;
    originalBlobUrl: string;
    previewBlobName?: string | null;
    previewBlobUrl?: string | null;
    thumbnailBlobName?: string | null;
    thumbnailBlobUrl?: string | null;
    processingError?: string | null;
}

export interface AdminAlbumMediaPage {
    items: AdminAlbumMediaItem[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}
