import { useEffect, useState } from 'react';
import { appText } from '../content/appText';
import { cn } from '../utils/cn';
import type { GalleryMediaItem } from '../types/wedding.types';

interface PhotoGalleryGridProps {
    photos: GalleryMediaItem[];
    showUploadedAt?: boolean;
}

function formatUploadedAt(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString(appText.common.locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function PhotoGalleryGrid({
    photos,
    showUploadedAt = false,
}: PhotoGalleryGridProps) {
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
    const selectedMedia = selectedPhotoIndex === null ? null : photos[selectedPhotoIndex] ?? null;
    const hasPreviousPhoto = selectedPhotoIndex !== null && selectedPhotoIndex > 0;
    const hasNextPhoto = selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1;
    const galleryNavigationButtonClassName = cn(
        'pointer-events-auto rounded-full bg-white/90 px-4 py-3 text-sm font-medium text-ink shadow transition',
        'disabled:cursor-not-allowed disabled:opacity-40'
    );

    useEffect(() => {
        if (selectedPhotoIndex === null) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSelectedPhotoIndex(null);
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setSelectedPhotoIndex((currentIndex) => {
                    if (currentIndex === null) {
                        return null;
                    }

                    return Math.max(currentIndex - 1, 0);
                });
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                setSelectedPhotoIndex((currentIndex) => {
                    if (currentIndex === null) {
                        return null;
                    }

                    return Math.min(currentIndex + 1, photos.length - 1);
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [photos.length, selectedPhotoIndex]);

    return (
        <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {photos.map((photo, index) => (
                    <button
                        key={photo.id}
                        type="button"
                        className="surface-card group overflow-hidden text-left transition-transform hover:-translate-y-1"
                        onClick={() => setSelectedPhotoIndex(index)}
                    >
                        <div className="aspect-square overflow-hidden bg-sand/40">
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
                        {showUploadedAt ? (
                            <div className="px-4 py-3">
                                <p className="text-sm text-muted">
                                    {formatUploadedAt(photo.uploadedAt)}
                                </p>
                            </div>
                        ) : null}
                    </button>
                ))}
            </div>

            {selectedMedia ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 px-4 py-6"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setSelectedPhotoIndex(null)}
                >
                    <div
                        className="dialog-surface"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 flex items-center justify-between px-3">
                            <button
                                type="button"
                                className={galleryNavigationButtonClassName}
                                onClick={() => setSelectedPhotoIndex((currentIndex) => currentIndex === null ? null : Math.max(currentIndex - 1, 0))}
                                disabled={!hasPreviousPhoto}
                                aria-label="Poprzednie medium"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                className={galleryNavigationButtonClassName}
                                onClick={() => setSelectedPhotoIndex((currentIndex) => currentIndex === null ? null : Math.min(currentIndex + 1, photos.length - 1))}
                                disabled={!hasNextPhoto}
                                aria-label={appText.components.galleryGrid.nextAriaLabel}
                            >
                                ›
                            </button>
                        </div>

                        <button
                            type="button"
                            className="absolute right-4 top-4 z-10 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-ink shadow"
                            onClick={() => setSelectedPhotoIndex(null)}
                        >
                            Zamknij
                        </button>

                        <div className="bg-paper">
                            {selectedMedia.kind === 'video' ? (
                                <div className="flex max-h-[90vh] min-h-[240px] w-full flex-col items-center justify-center bg-ink">
                                    <video
                                        src={selectedMedia.url}
                                        controls
                                        playsInline
                                        className="max-h-[86vh] w-full object-contain"
                                    >
                                        <a
                                            href={selectedMedia.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-white underline"
                                        >
                                            {appText.common.media.openOrDownloadVideo}
                                        </a>
                                    </video>
                                    <a
                                        href={selectedMedia.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-4 py-3 text-sm font-medium text-white underline"
                                    >
                                        {appText.common.media.openOrDownloadVideo}
                                    </a>
                                </div>
                            ) : (
                                <img
                                    src={selectedMedia.url}
                                    alt={appText.common.media.photoPreviewAlt}
                                    className="max-h-[90vh] w-full object-contain"
                                />
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
