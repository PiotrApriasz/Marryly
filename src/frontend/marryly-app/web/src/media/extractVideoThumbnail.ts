const MAX_THUMBNAIL_EDGE = 1280;
const JPEG_QUALITY = 0.84;

function waitForEvent(element: HTMLMediaElement, eventName: 'loadeddata' | 'loadedmetadata' | 'seeked'): Promise<void> {
    return new Promise((resolve, reject) => {
        const onSuccess = () => {
            cleanup();
            resolve();
        };
        const onError = () => {
            cleanup();
            reject(new Error('Nie udało się odczytać obrazu z filmu.'));
        };
        const cleanup = () => {
            element.removeEventListener(eventName, onSuccess);
            element.removeEventListener('error', onError);
        };

        element.addEventListener(eventName, onSuccess, { once: true });
        element.addEventListener('error', onError, { once: true });
    });
}

export async function extractVideoThumbnail(file: Blob, fileName = 'video'): Promise<File> {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    try {
        video.src = objectUrl;
        await waitForEvent(video, 'loadedmetadata');

        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const seekTime = duration > 0 ? Math.min(1, Math.max(0, duration * 0.1)) : 0;
        if (seekTime > 0) {
            video.currentTime = seekTime;
            await waitForEvent(video, 'seeked');
        } else {
            await waitForEvent(video, 'loadeddata');
        }

        if (!video.videoWidth || !video.videoHeight) {
            throw new Error('Film nie zawiera klatki możliwej do użycia jako miniatura.');
        }

        const scale = Math.min(1, MAX_THUMBNAIL_EDGE / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Przeglądarka nie obsługuje generowania miniatur filmów.');
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Nie udało się zapisać miniatury filmu.')), 'image/jpeg', JPEG_QUALITY);
        });
        const safeName = fileName.replace(/\.[^.]+$/, '') || 'video';
        return new File([thumbnail], `${safeName}-thumbnail.jpg`, { type: 'image/jpeg' });
    } finally {
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectUrl);
    }
}
