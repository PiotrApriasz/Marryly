import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { adminClient } from '../api/adminClient';
import { appText } from '../content/appText';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import type { AdminSlideshowPhoto, AdminSlideshowSettings } from '../types/admin.types';

type ImagePreloadState = 'loading' | 'loaded' | 'failed';

interface ImagePreloadEntry {
    status: ImagePreloadState;
    promise?: Promise<boolean>;
}

function getPhotoIndex(photos: AdminSlideshowPhoto[], photoId: string | null): number {
    if (!photoId) {
        return -1;
    }

    return photos.findIndex((photo) => photo.id === photoId);
}

function getLatestUploadedAt(photos: AdminSlideshowPhoto[]): string | null {
    if (photos.length === 0) {
        return null;
    }

    return photos[photos.length - 1]?.uploadedAt ?? null;
}

function mergePhotos(current: AdminSlideshowPhoto[], incoming: AdminSlideshowPhoto[]): AdminSlideshowPhoto[] {
    if (incoming.length === 0) {
        return current;
    }

    const byId = new Map(current.map((photo) => [photo.id, photo]));
    for (const photo of incoming) {
        byId.set(photo.id, photo);
    }

    return [...byId.values()].sort((left, right) => left.uploadedAt.localeCompare(right.uploadedAt));
}

function PlayerMessage({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="mx-auto max-w-xl px-8 text-center text-white">
            <p className="font-serif text-4xl md:text-5xl">{title}</p>
            <p className="mt-4 text-base text-white/70 md:text-lg">{description}</p>
        </div>
    );
}

export default function SlideshowPage() {
    const [settings, setSettings] = useState<AdminSlideshowSettings | null>(null);
    const [photos, setPhotos] = useState<AdminSlideshowPhoto[]>([]);
    const [currentPhotoId, setCurrentPhotoId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [initialError, setInitialError] = useState<string | null>(null);
    const [backgroundError, setBackgroundError] = useState<string | null>(null);
    const photosRef = useRef<AdminSlideshowPhoto[]>([]);
    const currentPhotoIdRef = useRef<string | null>(null);
    const settingsRef = useRef<AdminSlideshowSettings | null>(null);
    const timerRef = useRef<number | null>(null);
    const preloadCacheRef = useRef<Map<string, ImagePreloadEntry>>(new Map());
    const isMountedRef = useRef(true);

    const currentPhoto = useMemo(
        () => photos.find((photo) => photo.id === currentPhotoId) ?? null,
        [currentPhotoId, photos],
    );

    const clearAdvanceTimer = () => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const preloadPhoto = useEffectEvent(async (photo: AdminSlideshowPhoto): Promise<boolean> => {
        const cached = preloadCacheRef.current.get(photo.displayUrl);
        if (cached?.status === 'loaded') {
            return true;
        }

        if (cached?.status === 'failed') {
            return false;
        }

        if (cached?.status === 'loading' && cached.promise) {
            return cached.promise;
        }

        const promise = new Promise<boolean>((resolve) => {
            const image = new Image();
            image.onload = () => {
                preloadCacheRef.current.set(photo.displayUrl, { status: 'loaded' });
                resolve(true);
            };
            image.onerror = () => {
                preloadCacheRef.current.set(photo.displayUrl, { status: 'failed' });
                resolve(false);
            };
            image.src = photo.displayUrl;
        });

        preloadCacheRef.current.set(photo.displayUrl, { status: 'loading', promise });
        return promise;
    });

    const findNextRenderablePhoto = useEffectEvent(async (startIndex: number): Promise<{
        photo: AdminSlideshowPhoto;
        index: number;
    } | null> => {
        const queue = photosRef.current;
        if (queue.length === 0) {
            return null;
        }

        for (let step = 1; step <= queue.length; step += 1) {
            const nextIndex = (startIndex + step + queue.length) % queue.length;
            const candidate = queue[nextIndex];
            if (!candidate) {
                continue;
            }

            const isReady = await preloadPhoto(candidate);
            if (isReady) {
                return { photo: candidate, index: nextIndex };
            }
        }

        return null;
    });

    const preloadFollowingPhoto = useEffectEvent((currentIndex: number) => {
        const queue = photosRef.current;
        if (queue.length <= 1) {
            return;
        }

        const nextPhoto = queue[(currentIndex + 1) % queue.length];
        if (nextPhoto) {
            void preloadPhoto(nextPhoto);
        }
    });

    const scheduleAdvance = useEffectEvent((delaySeconds?: number) => {
        clearAdvanceTimer();
        const effectiveDelay = Math.max(1, delaySeconds ?? settingsRef.current?.slideDurationSeconds ?? 8);
        timerRef.current = window.setTimeout(() => {
            void advanceToNextPhoto();
        }, effectiveDelay * 1000);
    });

    const advanceToNextPhoto = useEffectEvent(async () => {
        const queue = photosRef.current;
        if (queue.length === 0) {
            clearAdvanceTimer();
            return;
        }

        const currentIndex = getPhotoIndex(queue, currentPhotoIdRef.current);
        const nextRenderable = await findNextRenderablePhoto(currentIndex);
        if (!nextRenderable) {
            scheduleAdvance(2);
            return;
        }

        if (!isMountedRef.current) {
            return;
        }

        currentPhotoIdRef.current = nextRenderable.photo.id;
        setCurrentPhotoId(nextRenderable.photo.id);
        preloadFollowingPhoto(nextRenderable.index);
        scheduleAdvance();
    });

    const syncLatestPhotos = useEffectEvent(async () => {
        try {
            const latestUploadedAt = getLatestUploadedAt(photosRef.current) ?? undefined;
            const response = await adminClient.getSlideshowPhotos(latestUploadedAt);
            if (!isMountedRef.current || response.items.length === 0) {
                return;
            }

            setPhotos((current) => mergePhotos(current, response.items));
            setBackgroundError(null);
        } catch (error: unknown) {
            if (!currentPhotoIdRef.current) {
                setBackgroundError(getErrorMessageForDisplay(error, appText.public.slideshow.refreshFailed));
            }
            logErrorDetails(error, 'Failed to refresh slideshow photos');
        }
    });

    useEffect(() => {
        photosRef.current = photos;
    }, [photos]);

    useEffect(() => {
        currentPhotoIdRef.current = currentPhotoId;
    }, [currentPhotoId]);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        isMountedRef.current = true;
        const originalOverflow = document.body.style.overflow;
        const rootElement = document.documentElement;

        document.body.style.overflow = 'hidden';
        void rootElement.requestFullscreen?.().catch(() => undefined);

        return () => {
            isMountedRef.current = false;
            clearAdvanceTimer();
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadInitialState = async () => {
            setIsLoading(true);
            setInitialError(null);

            try {
                const [loadedSettings, initialPhotosResponse] = await Promise.all([
                    adminClient.getSlideshowSettings(),
                    adminClient.getSlideshowPhotos(),
                ]);

                if (cancelled || !isMountedRef.current) {
                    return;
                }

                setSettings(loadedSettings);
                setPhotos(mergePhotos([], initialPhotosResponse.items));
                setBackgroundError(null);
            } catch (error: unknown) {
                if (!cancelled) {
                    setInitialError(getErrorMessageForDisplay(error, appText.public.slideshow.startFailed));
                    logErrorDetails(error, 'Failed to load slideshow');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void loadInitialState();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (isLoading || photos.length === 0 || currentPhotoId) {
            return;
        }

        void advanceToNextPhoto();
    }, [currentPhotoId, isLoading, photos.length]);

    useEffect(() => {
        if (!settings) {
            return;
        }

        const intervalId = window.setInterval(() => {
            void syncLatestPhotos();
        }, Math.max(10, settings.refreshIntervalSeconds) * 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [settings]);

    if (isLoading) {
        return (
            <div className="fixed inset-0 flex cursor-none items-center justify-center bg-neutral-950">
                <PlayerMessage
                    title={appText.public.slideshow.loadingTitle}
                    description={appText.public.slideshow.loadingDescription}
                />
            </div>
        );
    }

    if (initialError) {
        return (
            <div className="fixed inset-0 flex cursor-none items-center justify-center bg-neutral-950">
                <PlayerMessage
                    title={appText.public.slideshow.unavailableTitle}
                    description={initialError}
                />
            </div>
        );
    }

    if (!currentPhoto) {
        return (
            <div className="fixed inset-0 flex cursor-none items-center justify-center bg-neutral-950">
                <PlayerMessage
                    title={appText.public.slideshow.waitingTitle}
                    description={backgroundError ?? appText.public.slideshow.waitingDescription}
                />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 cursor-none overflow-hidden bg-black">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_55%)]" />
            <img
                key={currentPhoto.id}
                src={currentPhoto.displayUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
                draggable={false}
            />
        </div>
    );
}
