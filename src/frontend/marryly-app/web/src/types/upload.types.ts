export interface CreatePhotoUploadRequest {
    fileName: string;
    fileSizeBytes: number;
    contentType: string;
    lastModifiedAt?: string;
}

export interface PhotoUploadTarget {
    photoId: string;
    blobName: string;
    blobUrl: string;
    uploadUrl: string;
    expiresAt: string;
    requiredHeaders?: Record<string, string>;
}

export interface CompletePhotoUploadRequest {
    photoId: string;
    blobName: string;
    blobUrl: string;
    contentType: string;
    sizeBytes: number;
}
