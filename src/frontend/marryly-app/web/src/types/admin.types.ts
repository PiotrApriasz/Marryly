export interface AdminOverview {
    photosCount: number;
    guestsCount: number;
    wishesCount: number;
    menuPublished: boolean;
    attractionsCount: number;
    settingsCount: number;
}

export type GuestCategory = 'vendor' | 'adult' | 'child_3_10' | 'child_over_10' | 'child_under_3';
export type GuestAttendanceStatus = 'pending' | 'confirmed' | 'declined';
export type GuestRelationshipToGroup = 'primary' | 'partner' | 'child' | 'other';

export interface AdminGuestInvitationGroup {
    id: string;
    eventId: string;
    displayName: string;
    invitationLabel: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminGuestListEntry {
    id: string;
    eventId: string;
    fullName: string;
    category: GuestCategory;
    attendanceStatus: GuestAttendanceStatus;
    invitationGroupId?: string | null;
    invitationGroupName?: string | null;
    relationshipToGroup?: GuestRelationshipToGroup | null;
    needsAccommodation: boolean;
    hotelName?: string | null;
    roomNameOrNumber?: string | null;
    needsTransport: boolean;
    transportNotes?: string | null;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface AdminGuestListSummary {
    invitedCount: number;
    confirmedCount: number;
    confirmationPercent: number;
    attendingTotalWithCouple: number;
    vendorsCount: number;
    adultsCount: number;
    children3To10Count: number;
    childrenUnder3Count: number;
    accommodationNeededCount: number;
    transportNeededCount: number;
}

export interface AdminGuestListResponse {
    items: AdminGuestListEntry[];
    groups: AdminGuestInvitationGroup[];
    summary: AdminGuestListSummary;
}

export interface AdminGuestListEntryPayload {
    fullName?: string;
    category?: GuestCategory;
    attendanceStatus?: GuestAttendanceStatus;
    invitationGroupId?: string;
    invitationGroupName?: string;
    relationshipToGroup?: GuestRelationshipToGroup;
    needsAccommodation?: boolean;
    hotelName?: string;
    roomNameOrNumber?: string;
    needsTransport?: boolean;
    transportNotes?: string;
    notes?: string;
}

export interface AdminGuestInvitationGroupPayload {
    displayName?: string;
    invitationLabel?: string;
}

export interface AdminGuestFamilyMemberPayload {
    fullName?: string;
    category?: GuestCategory;
    attendanceStatus?: GuestAttendanceStatus;
    relationshipToGroup?: GuestRelationshipToGroup;
    needsAccommodation?: boolean;
    hotelName?: string;
    roomNameOrNumber?: string;
    needsTransport?: boolean;
    transportNotes?: string;
    notes?: string;
}

export interface AdminGuestFamilyPayload {
    displayName?: string;
    invitationLabel?: string;
    members: AdminGuestFamilyMemberPayload[];
}

export interface AdminGuestFamilyResponse {
    group: AdminGuestInvitationGroup;
    items: AdminGuestListEntry[];
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
