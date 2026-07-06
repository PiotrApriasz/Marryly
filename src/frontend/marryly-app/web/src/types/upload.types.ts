export type UploadMediaKind = 'photo' | 'video';

export interface CreatePhotoUploadRequest {
    kind?: UploadMediaKind;
    fileName: string;
    fileSizeBytes: number;
    contentType: string;
    lastModifiedAt?: string;
}

export interface PhotoUploadTarget {
    mediaId?: string;
    photoId: string;
    kind?: UploadMediaKind;
    blobName: string;
    blobUrl: string;
    uploadUrl: string;
    expiresAt: string;
    requiredHeaders?: Record<string, string>;
}

export interface CompletePhotoUploadRequest {
    mediaId?: string;
    photoId: string;
    kind?: UploadMediaKind;
    blobName: string;
    blobUrl: string;
    contentType: string;
    sizeBytes: number;
}
