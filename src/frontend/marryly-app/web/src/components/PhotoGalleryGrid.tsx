import { useState } from 'react';
import { appText } from '../content/appText';
import type { GalleryMediaItem } from '../types/wedding.types';
import { getMediaAspectRatio, getMediaHeightRatio } from '../utils/media';
import MasonryGrid from './MasonryGrid';
import MediaLightbox from './MediaLightbox';

interface PhotoGalleryGridProps {
    photos: GalleryMediaItem[];
    hasMoreMedia: boolean;
    loadingMore: boolean;
    onRequestMore: () => Promise<void>;
}

export default function PhotoGalleryGrid({
    photos,
    hasMoreMedia,
    loadingMore,
    onRequestMore,
}: PhotoGalleryGridProps) {
    const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

    return (
        <>
            <MasonryGrid
                items={photos}
                getItemId={(photo) => photo.id}
                getItemHeightRatio={getMediaHeightRatio}
                renderItem={(photo) => (
                    <button
                        type="button"
                        className="photo-gallery-tile group text-left transition-transform hover:-translate-y-1"
                        onClick={() => setSelectedPhotoId(photo.id)}
                    >
                        <div
                            className="masonry-media"
                            style={{ aspectRatio: getMediaAspectRatio(photo) }}
                        >
                            {photo.kind === 'video' ? (
                                <div className="relative h-full w-full">
                                    <video
                                        src={photo.url}
                                        preload="metadata"
                                        muted
                                        playsInline
                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-ink/20 text-white">
                                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink/70 shadow">
                                            <span className="ml-1 h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-white" />
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <img
                                    src={photo.thumbnailUrl ?? photo.url}
                                    alt={appText.common.media.weddingPhotoAlt}
                                    loading="lazy"
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                            )}
                        </div>
                    </button>
                )}
            />
            <MediaLightbox
                media={photos}
                selectedMediaId={selectedPhotoId}
                onClose={() => setSelectedPhotoId(null)}
                onSelectMedia={(mediaId) => setSelectedPhotoId(mediaId)}
                hasMoreMedia={hasMoreMedia}
                loadingMore={loadingMore}
                onRequestMore={onRequestMore}
            />
        </>
    );
}
