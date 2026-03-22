import { useState } from 'react';
import type { Photo } from '../types/wedding.types';

interface PhotoGalleryGridProps {
    photos: Photo[];
    showUploadedAt?: boolean;
}

function formatUploadedAt(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString('pl-PL', {
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
    const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

    return (
        <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {photos.map((photo) => (
                    <button
                        key={photo.id}
                        type="button"
                        className="group overflow-hidden rounded-2xl border border-sand bg-white text-left shadow-sm transition-transform hover:-translate-y-1"
                        onClick={() => setSelectedPhoto(photo)}
                    >
                        <div className="aspect-square overflow-hidden bg-sand/40">
                            <img
                                src={photo.thumbnailUrl}
                                alt="Zdjęcie z wesela"
                                loading="lazy"
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
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

            {selectedPhoto ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 px-4 py-6"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => setSelectedPhoto(null)}
                >
                    <div
                        className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="absolute right-4 top-4 z-10 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-ink shadow"
                            onClick={() => setSelectedPhoto(null)}
                        >
                            Zamknij
                        </button>

                        <div className="bg-paper">
                            <img
                                src={selectedPhoto.url}
                                alt="Podgląd zdjęcia"
                                className="max-h-[90vh] w-full object-contain"
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
