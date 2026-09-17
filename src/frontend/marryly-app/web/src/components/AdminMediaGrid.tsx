import { useMemo, useState } from 'react';
import AdminMediaTile from './AdminMediaTile';
import MasonryGrid from './MasonryGrid';
import MediaLightbox from './MediaLightbox';
import type { AdminMediaItem } from '../types/admin.types';
import { getAdminMediaHeightRatio } from '../utils/media';

interface AdminMediaGridProps {
    items: AdminMediaItem[];
    hasMoreMedia: boolean;
    loadingMore: boolean;
    onRequestMore: () => Promise<void>;
    thumbnailAlt: string;
    getSecondaryLabel: (mediaItem: AdminMediaItem) => string;
    deletingMediaId: string | null;
    onDelete: (mediaId: string) => void | Promise<void>;
}

export default function AdminMediaGrid({
    items,
    hasMoreMedia,
    loadingMore,
    onRequestMore,
    thumbnailAlt,
    getSecondaryLabel,
    deletingMediaId,
    onDelete,
}: AdminMediaGridProps) {
    const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
    const lightboxMedia = useMemo(() => items.map((mediaItem) => ({
        id: mediaItem.id,
        kind: mediaItem.kind,
        url: mediaItem.previewBlobUrl ?? mediaItem.originalBlobUrl,
        originalUrl: mediaItem.originalUrl ?? mediaItem.originalBlobUrl,
        downloadUrl: mediaItem.downloadUrl ?? mediaItem.originalUrl ?? mediaItem.originalBlobUrl,
        contentType: mediaItem.contentType,
    })), [items]);

    return (
        <>
            <MasonryGrid
                items={items}
                getItemId={(mediaItem) => mediaItem.id}
                getItemHeightRatio={getAdminMediaHeightRatio}
                renderItem={(mediaItem) => (
                    <AdminMediaTile
                        mediaItem={mediaItem}
                        thumbnailAlt={thumbnailAlt}
                        secondaryLabel={getSecondaryLabel(mediaItem)}
                        deletingMediaId={deletingMediaId}
                        onDelete={onDelete}
                        onPreview={setSelectedMediaId}
                    />
                )}
            />
            <MediaLightbox
                media={lightboxMedia}
                selectedMediaId={selectedMediaId}
                onClose={() => setSelectedMediaId(null)}
                onSelectMedia={setSelectedMediaId}
                hasMoreMedia={hasMoreMedia}
                loadingMore={loadingMore}
                onRequestMore={onRequestMore}
            />
        </>
    );
}
