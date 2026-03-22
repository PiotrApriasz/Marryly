export interface UploadToSignedUrlOptions {
    file: File;
    uploadUrl: string;
    headers?: Record<string, string>;
    onProgress?: (progressPercent: number) => void;
}

function normalizeProgress(percent: number): number {
    if (!Number.isFinite(percent)) {
        return 0;
    }

    return Math.min(100, Math.max(0, Math.round(percent)));
}

export function uploadFileToSignedUrl({
    file,
    uploadUrl,
    headers = {},
    onProgress,
}: UploadToSignedUrlOptions): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open('PUT', uploadUrl, true);

        Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
        });

        xhr.upload.onprogress = (event) => {
            if (!onProgress || !event.lengthComputable) {
                return;
            }

            onProgress(normalizeProgress((event.loaded / event.total) * 100));
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress?.(100);
                resolve();
                return;
            }

            reject(new Error(`Upload failed with status ${xhr.status}.`));
        };

        xhr.onerror = () => reject(new Error('Upload failed because of a network error.'));
        xhr.onabort = () => reject(new Error('Upload was cancelled.'));
        xhr.send(file);
    });
}
