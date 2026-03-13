export interface AdminUser {
    id: string;
    email: string;
    displayName?: string;
}

export interface AdminSessionResponse {
    authenticated: boolean;
    user?: AdminUser;
}

export interface AdminLoginResponse {
    authenticated: boolean;
    user: AdminUser;
}

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
