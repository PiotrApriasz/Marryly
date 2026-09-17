import mainPagePhoto from '../assets/mainPagePhoto.jpeg';
import type { Photo, PhotosPage } from '../types/wedding.types';

const MOCK_PHOTO_COUNT = 120;
const MOCK_BATCH_DELAY_MS = 250;
const MOCK_DIMENSIONS = [
    { width: 2048, height: 1365 },
    { width: 1365, height: 2048 },
    { width: 1800, height: 1800 },
    { width: 2400, height: 1350 },
];

const mockPhotos: Photo[] = Array.from({ length: MOCK_PHOTO_COUNT }, (_, index) => {
    const uploadedAt = new Date(Date.now() - index * 1000 * 60 * 7).toISOString();
    const dimensions = MOCK_DIMENSIONS[index % MOCK_DIMENSIONS.length];

    return {
        id: `mock-photo-${index + 1}`,
        url: mainPagePhoto,
        thumbnailUrl: mainPagePhoto,
        uploadedAt,
        approved: true,
        width: dimensions.width,
        height: dimensions.height,
    };
});

function decodeContinuationToken(token?: string | null): number {
    if (!token) {
        return 0;
    }

    const parsedValue = Number.parseInt(token, 10);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
}

export async function getMockPhotosPage(limit: number, continuationToken?: string | null): Promise<PhotosPage> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const startIndex = decodeContinuationToken(continuationToken);
    const endIndex = Math.min(startIndex + safeLimit, mockPhotos.length);
    const items = mockPhotos.slice(startIndex, endIndex);
    const nextToken = endIndex < mockPhotos.length ? String(endIndex) : null;

    await new Promise((resolve) => window.setTimeout(resolve, MOCK_BATCH_DELAY_MS));

    return {
        items,
        continuationToken: nextToken,
        hasMore: nextToken !== null,
    };
}
