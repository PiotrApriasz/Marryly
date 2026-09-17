import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type MouseEvent, type RefObject } from 'react';
import { appText } from '../content/appText';

export interface LightboxMediaItem {
    id: string;
    kind: string;
    url: string;
    originalUrl?: string | null;
    downloadUrl?: string | null;
    contentType?: string | null;
}

interface MediaLightboxProps {
    media: LightboxMediaItem[];
    selectedMediaId: string | null;
    onClose: () => void;
    onSelectMedia: (mediaId: string) => void;
    hasMoreMedia?: boolean;
    loadingMore?: boolean;
    onRequestMore?: () => Promise<void> | void;
}

type LightboxIconName = 'previous' | 'next' | 'close' | 'download';

interface LightboxControlProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
    icon: LightboxIconName;
    label: string;
    buttonRef?: RefObject<HTMLButtonElement | null>;
    href?: string;
    onClick?: () => void;
}

const PRELOAD_AHEAD_COUNT = 4;
const RETAIN_BEHIND_COUNT = 4;

interface PreloadCacheEntry {
    url: string;
    element: HTMLImageElement | HTMLVideoElement;
}

function LightboxIcon({ icon }: { icon: LightboxIconName }) {
    if (icon === 'close') {
        return (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
            </svg>
        );
    }

    if (icon === 'download') {
        return (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v12m0 0l-5-5m5 5l5-5M5 21h14" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d={icon === 'previous' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
        </svg>
    );
}

function LightboxControl({
    icon,
    label,
    buttonRef,
    href,
    onClick,
    ...props
}: LightboxControlProps) {
    const handleClick = (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
        event.stopPropagation();
        onClick?.();
    };
    const className = `lightbox-control ${props.className ?? ''}`.trim();

    if (href) {
        return (
            <a
                href={href}
                download
                className={className}
                aria-label={label}
                title={label}
                onClick={handleClick}
            >
                <LightboxIcon icon={icon} />
            </a>
        );
    }

    return (
        <button
            {...props}
            ref={buttonRef}
            type="button"
            className={className}
            aria-label={label}
            title={label}
            onClick={handleClick}
        >
            <LightboxIcon icon={icon} />
        </button>
    );
}

export default function MediaLightbox({
    media,
    selectedMediaId,
    onClose,
    onSelectMedia,
    hasMoreMedia = false,
    loadingMore = false,
    onRequestMore,
}: MediaLightboxProps) {
    const selectedMediaIndex = selectedMediaId === null
        ? -1
        : media.findIndex((item) => item.id === selectedMediaId);
    const selectedMedia = selectedMediaIndex < 0 ? null : media[selectedMediaIndex] ?? null;
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const stageRef = useRef<HTMLDivElement | null>(null);
    const preloadCacheRef = useRef<Map<string, PreloadCacheEntry>>(new Map());
    const lastFocusedElementRef = useRef<HTMLElement | null>(null);
    const wasOpenRef = useRef(false);
    const pendingNextNavigationRef = useRef(false);
    const moreRequestInFlightRef = useRef(false);
    const [loadedMediaId, setLoadedMediaId] = useState<string | null>(null);
    const [loadingIndicatorMediaId, setLoadingIndicatorMediaId] = useState<string | null>(null);
    const [mediaWaitingForMoreId, setMediaWaitingForMoreId] = useState<string | null>(null);

    useEffect(() => {
        const isOpen = selectedMediaId !== null && selectedMedia !== null;

        if (isOpen && !wasOpenRef.current) {
            lastFocusedElementRef.current = document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            closeButtonRef.current?.focus();
        }

        if (!isOpen && wasOpenRef.current) {
            lastFocusedElementRef.current?.focus();
            lastFocusedElementRef.current = null;
        }

        wasOpenRef.current = isOpen;
    }, [selectedMedia, selectedMediaId]);

    useEffect(() => {
        if (selectedMediaId !== null && selectedMedia === null) {
            onClose();
        }
    }, [onClose, selectedMedia, selectedMediaId]);

    useEffect(() => {
        if (selectedMediaIndex < 0) {
            return;
        }

        const retainedMedia = media.slice(
            Math.max(0, selectedMediaIndex - RETAIN_BEHIND_COUNT),
            selectedMediaIndex + PRELOAD_AHEAD_COUNT + 1
        );
        const retainedIds = new Set(retainedMedia.map((mediaItem) => mediaItem.id));

        for (const [mediaId] of preloadCacheRef.current) {
            if (!retainedIds.has(mediaId)) {
                preloadCacheRef.current.delete(mediaId);
            }
        }

        const upcomingMedia = media.slice(
            selectedMediaIndex + 1,
            selectedMediaIndex + 1 + PRELOAD_AHEAD_COUNT
        );

        upcomingMedia.forEach((mediaItem) => {
            const mediaUrl = mediaItem.originalUrl ?? mediaItem.url;
            const cachedMedia = preloadCacheRef.current.get(mediaItem.id);

            if (cachedMedia?.url === mediaUrl) {
                return;
            }

            if (mediaItem.kind === 'video') {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.src = mediaUrl;
                video.load();
                preloadCacheRef.current.set(mediaItem.id, { url: mediaUrl, element: video });
                return;
            }

            const image = new Image();
            image.decoding = 'async';
            image.src = mediaUrl;
            void image.decode().catch(() => undefined);
            preloadCacheRef.current.set(mediaItem.id, { url: mediaUrl, element: image });
        });
    }, [media, selectedMediaIndex]);

    useEffect(() => {
        if (selectedMediaId === null) {
            pendingNextNavigationRef.current = false;
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setLoadingIndicatorMediaId(selectedMediaId);
        }, 150);

        return () => window.clearTimeout(timeoutId);
    }, [selectedMediaId]);

    const focusStage = useCallback(() => {
        stageRef.current?.focus({ preventScroll: true });
    }, []);

    const selectMedia = useCallback((mediaItem: LightboxMediaItem | undefined) => {
        if (!mediaItem) {
            return;
        }

        pendingNextNavigationRef.current = false;
        setMediaWaitingForMoreId(null);
        focusStage();
        onSelectMedia(mediaItem.id);
    }, [focusStage, onSelectMedia]);

    const requestMoreMedia = useCallback(() => {
        if (!hasMoreMedia || !onRequestMore) {
            return;
        }

        pendingNextNavigationRef.current = true;
        setLoadingIndicatorMediaId(selectedMediaId);
        setMediaWaitingForMoreId(selectedMediaId);

        if (loadingMore || moreRequestInFlightRef.current) {
            return;
        }

        moreRequestInFlightRef.current = true;
        void Promise.resolve()
            .then(() => onRequestMore())
            .catch(() => undefined)
            .finally(() => {
                moreRequestInFlightRef.current = false;
            });
    }, [hasMoreMedia, loadingMore, onRequestMore, selectedMediaId]);

    const selectNextMedia = useCallback(() => {
        const nextMedia = media[selectedMediaIndex + 1];

        if (nextMedia) {
            selectMedia(nextMedia);
            return;
        }

        requestMoreMedia();
    }, [media, requestMoreMedia, selectMedia, selectedMediaIndex]);

    useEffect(() => {
        if (!pendingNextNavigationRef.current || selectedMediaIndex < 0) {
            return;
        }

        const nextMedia = media[selectedMediaIndex + 1];

        if (nextMedia) {
            const timeoutId = window.setTimeout(() => {
                if (!pendingNextNavigationRef.current) {
                    return;
                }

                const latestNextMedia = media[selectedMediaIndex + 1];
                if (latestNextMedia) {
                    pendingNextNavigationRef.current = false;
                    selectMedia(latestNextMedia);
                }
            }, 0);

            return () => window.clearTimeout(timeoutId);
        }

        if (!hasMoreMedia && !loadingMore) {
            pendingNextNavigationRef.current = false;
        }
    }, [hasMoreMedia, loadingMore, media, selectMedia, selectedMediaIndex]);

    const markMediaAsLoaded = useCallback((mediaId: string) => {
        setLoadedMediaId(mediaId);
        setLoadingIndicatorMediaId((currentMediaId) => currentMediaId === mediaId ? null : currentMediaId);
    }, []);

    useEffect(() => {
        if (selectedMedia === null) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
                return;
            }

            event.preventDefault();
            if (event.key === 'ArrowRight') {
                selectNextMedia();
                return;
            }

            selectMedia(media[selectedMediaIndex - 1]);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [media, onClose, selectMedia, selectNextMedia, selectedMedia, selectedMediaId, selectedMediaIndex]);

    if (selectedMedia === null) {
        return null;
    }

    const displayUrl = selectedMedia.originalUrl ?? selectedMedia.url;
    const downloadUrl = selectedMedia.downloadUrl ?? selectedMedia.originalUrl ?? selectedMedia.url;
    const hasPreviousMedia = selectedMediaIndex > 0;
    const hasNextMedia = selectedMediaIndex < media.length - 1;
    const isMediaLoading = loadedMediaId !== selectedMedia.id;
    const isLoadingMoreForNavigation = loadingMore && mediaWaitingForMoreId === selectedMedia.id;
    const shouldShowLoadingIndicator = loadingIndicatorMediaId === selectedMedia.id
        && (isMediaLoading || isLoadingMoreForNavigation);

    return (
        <div
            className="lightbox-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={appText.components.galleryGrid.dialogAriaLabel}
            onClick={onClose}
        >
            <div
                className="lightbox-stage"
                ref={stageRef}
                tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
            >
                {selectedMedia.kind === 'video' ? (
                    <video
                        src={displayUrl}
                        controls
                        autoPlay
                        playsInline
                        className="lightbox-media"
                        onLoadedData={() => {
                            markMediaAsLoaded(selectedMedia.id);
                        }}
                        onError={() => {
                            markMediaAsLoaded(selectedMedia.id);
                        }}
                    >
                        <a href={displayUrl} target="_blank" rel="noreferrer" className="text-white underline">
                            {appText.common.media.openOrDownloadVideo}
                        </a>
                    </video>
                ) : (
                    <img
                        key={selectedMedia.id}
                        src={displayUrl}
                        alt={appText.common.media.photoPreviewAlt}
                        className="lightbox-media"
                        fetchPriority="high"
                        loading="eager"
                        onLoad={(event) => {
                            markMediaAsLoaded(selectedMedia.id);
                            preloadCacheRef.current.set(selectedMedia.id, {
                                url: displayUrl,
                                element: event.currentTarget,
                            });
                        }}
                        onError={() => {
                            markMediaAsLoaded(selectedMedia.id);
                        }}
                    />
                )}
            </div>

            {shouldShowLoadingIndicator ? (
                <div
                    className="lightbox-loading-indicator"
                    role="status"
                    aria-label={appText.components.galleryGrid.loadingAriaLabel}
                >
                    <span className="lightbox-spinner" aria-hidden="true" />
                </div>
            ) : null}

            <LightboxControl
                icon="previous"
                label={appText.components.galleryGrid.previousAriaLabel}
                className="lightbox-control-previous"
                onClick={() => selectMedia(media[selectedMediaIndex - 1])}
                disabled={!hasPreviousMedia}
            />
            <LightboxControl
                icon="next"
                label={appText.components.galleryGrid.nextAriaLabel}
                className="lightbox-control-next"
                onClick={selectNextMedia}
                disabled={!hasNextMedia && (!hasMoreMedia || !onRequestMore || loadingMore)}
                aria-busy={loadingMore && !hasNextMedia}
            />
            <LightboxControl
                icon="download"
                label={appText.components.galleryGrid.downloadAriaLabel}
                className="lightbox-control-download"
                href={downloadUrl}
            />
            <LightboxControl
                icon="close"
                label={appText.components.galleryGrid.closeAriaLabel}
                className="lightbox-control-close"
                buttonRef={closeButtonRef}
                onClick={onClose}
            />
        </div>
    );
}
