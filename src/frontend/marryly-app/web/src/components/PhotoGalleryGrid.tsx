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
    selectionMode?: boolean;
    selectedPhotoIds?: ReadonlySet<string>;
    onTogglePhotoSelection?: (photoId: string) => void;
    variant?: 'default' | 'masonry';
}

export default function PhotoGalleryGrid({
    photos,
    hasMoreMedia,
    loadingMore,
    onRequestMore,
    selectionMode = false,
    selectedPhotoIds,
    onTogglePhotoSelection,
    variant = 'default',
}: PhotoGalleryGridProps) {
    const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

    return (
        <>
            <MasonryGrid
                items={photos}
                getItemId={(photo) => photo.id}
                getItemHeightRatio={getMediaHeightRatio}
                layout={variant === 'masonry' ? 'masonry' : 'columns'}
                renderItem={(photo) => (
                    <button
                        type="button"
                        className={`photo-gallery-tile group text-left transition-transform hover:-translate-y-1 ${
                            selectionMode && photo.kind === 'photo' && selectedPhotoIds?.has(photo.id)
                                ? 'photo-gallery-tile-selected'
                                : ''
                        }`}
                        aria-pressed={selectionMode && photo.kind === 'photo' ? selectedPhotoIds?.has(photo.id) : undefined}
                        onClick={() => {
                            if (selectionMode && photo.kind === 'photo' && onTogglePhotoSelection) {
                                onTogglePhotoSelection(photo.id);
                                return;
                            }

                            setSelectedPhotoId(photo.id);
                        }}
                    >
                        <div
                            className="masonry-media relative"
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
                                    src={variant === 'masonry' ? photo.url : photo.thumbnailUrl ?? photo.url}
                                    alt={appText.common.media.weddingPhotoAlt}
                                    loading="lazy"
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                            )}
                            {selectionMode && photo.kind === 'photo' ? (
                                <span className="photo-gallery-selection-indicator" aria-hidden="true">
                                    {selectedPhotoIds?.has(photo.id) ? (
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <path d="m5 12 4 4L19 6" />
                                        </svg>
                                    ) : null}
                                </span>
                            ) : null}
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
