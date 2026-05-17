export interface WeddingInfo {
    bride: string;
    groom: string;
    date: string;
    venue: string;
    location: {
        address: string;
        city: string;
        coordinates?: {
            lat: number;
            lng: number;
        };
    };
}

export type MenuSectionType =
    | 'przystawka'
    | 'zupa'
    | 'danie_glowne'
    | 'deser'
    | 'kolacja'
    | 'zimna_plyta'
    | 'bufet'
    | 'napoje'
    | 'alkohol'
    | 'slodki_stol'
    | 'inne';

export interface MenuItem {
    name: string;
    description?: string | null;
    sortOrder: number;
}

export interface MenuSection {
    sectionType: MenuSectionType;
    name: string;
    choicesCount?: number | null;
    sortOrder: number;
    items: MenuItem[];
}

export interface MenuBlock {
    title: string;
    sortOrder: number;
    sections: MenuSection[];
}

export interface Menu {
    id: string;
    eventId: string;
    type: 'menu';
    title: string;
    blocks: MenuBlock[];
}

export interface Event {
    id: string;
    eventId: string;
    type: 'event';
    title: string;
    startsAt: string;
    endsAt: string;
    location: string;
}

export interface Attraction {
    id: string;
    title: string;
    description: string;
    icon?: string;
    available: boolean;
}

export interface GuestbookEntry {
    id: string;
    eventId: string;
    authorName: string;
    message: string;
    createdAt: string;
}

export interface Photo {
    id: string;
    url: string;
    thumbnailUrl: string;
    uploadedBy?: string;
    uploadedAt: string;
    approved: boolean;
    width: number;
    height: number;
}

export interface PhotosPage {
    items: Photo[];
    continuationToken: string | null;
    hasMore: boolean;
}

export interface GalleryAlbum {
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    coverUrl?: string | null;
    itemCount: number;
}

export interface GalleryAlbumsResponse {
    items: GalleryAlbum[];
}

export interface AlbumMediaPage {
    items: Photo[];
    continuationToken: string | null;
    hasMore: boolean;
}

export interface Video {
    id: string;
    url: string;
    thumbnailUrl: string;
    uploadedBy?: string;
    uploadedAt: Date;
    approved: boolean;
    duration: number;
}

export type MediaItem = Photo | Video;
