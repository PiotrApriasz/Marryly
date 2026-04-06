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
