export interface AdminSettings {
    allowGuestUploads: boolean;
    moderationEnabled: boolean;
    slideshowEnabled: boolean;
    slideshowInterval: number; // in seconds
    maxUploadSize: number; // in MB
    allowedFileTypes: string[];
}

export interface ProblemDetails {
    type?: string;
    title?: string;
    status?: number;
    detail?: string;
    traceId?: string;
    code?: string;

    message?: string;
    stackTrace?: string;
}