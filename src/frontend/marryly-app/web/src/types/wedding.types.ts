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

export interface MenuItem {
    name: string;
    description?: string;
}

export interface MenuSection {
    name: string;
    items: MenuItem[];
}

export interface Menu {
    id: string;
    eventId: string;
    type: 'menu';
    title: string;
    sections: MenuSection[];
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
    author: string;
    message: string;
    createdAt: Date;
    approved: boolean;
}

export interface Photo {
    id: string;
    url: string;
    thumbnailUrl: string;
    uploadedBy?: string;
    uploadedAt: Date;
    approved: boolean;
    width: number;
    height: number;
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
