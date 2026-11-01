import { useMemo } from 'react';
import PhotoGalleryGrid from './PhotoGalleryGrid';
import type { AdminMediaItem } from '../types/admin.types';
import type { GalleryMediaItem } from '../types/wedding.types';

interface AdminMediaGridProps {
    items: AdminMediaItem[];
    hasMoreMedia: boolean;
    loadingMore: boolean;
    onRequestMore: () => Promise<void>;
}

export default function AdminMediaGrid({
    items,
    hasMoreMedia,
    loadingMore,
    onRequestMore,
}: AdminMediaGridProps) {
    const photos = useMemo(() => items.map<GalleryMediaItem>((mediaItem) => ({
        id: mediaItem.id,
        kind: mediaItem.kind === 'video' ? 'video' : 'photo',
        url: mediaItem.previewBlobUrl ?? mediaItem.originalBlobUrl,
        originalUrl: mediaItem.originalUrl ?? mediaItem.originalBlobUrl,
        downloadUrl: mediaItem.downloadUrl ?? mediaItem.originalUrl ?? mediaItem.originalBlobUrl,
        thumbnailUrl: mediaItem.thumbnailBlobUrl,
        contentType: mediaItem.contentType,
        uploadedAt: mediaItem.uploadedAt,
        capturedAt: mediaItem.capturedAt,
        approved: mediaItem.approved,
        width: mediaItem.width,
        height: mediaItem.height,
    })), [items]);

    return (
        <PhotoGalleryGrid
            variant="masonry"
            photos={photos}
            hasMoreMedia={hasMoreMedia}
            loadingMore={loadingMore}
            onRequestMore={onRequestMore}
        />
    );
}
