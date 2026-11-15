import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Lightbox, { type Slide } from 'yet-another-react-lightbox';
import Video from 'yet-another-react-lightbox/plugins/video';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import { appText } from '../content/appText';

declare module 'yet-another-react-lightbox' {
    interface SlideTypes {
        'load-more': { type: 'load-more' };
    }
}

export interface LightboxMediaItem {
    id: string;
    kind: string;
    url: string;
    originalUrl?: string | null;
    downloadUrl?: string | null;
    thumbnailUrl?: string | null;
    contentType?: string | null;
    width?: number;
    height?: number;
}

interface MediaLightboxProps {
    media: LightboxMediaItem[];
    selectedMediaId: string | null;
    onClose: () => void;
    onSelectMedia: (mediaId: string) => void;
    hasMoreMedia?: boolean;
    loadingMore?: boolean;
    onRequestMore?: () => Promise<void> | void;
    renderMediaActions?: (media: LightboxMediaItem) => ReactNode;
}

export default function MediaLightbox({
    media,
    selectedMediaId,
    onClose,
    onSelectMedia,
    hasMoreMedia = false,
    loadingMore = false,
    onRequestMore,
    renderMediaActions,
}: MediaLightboxProps) {
    const selectedMediaIndex = selectedMediaId === null
        ? -1
        : media.findIndex((item) => item.id === selectedMediaId);
    const selectedMedia = media[selectedMediaIndex];
    const [waitingAfterId, setWaitingAfterId] = useState<string | null>(null);
    const [requestingMore, setRequestingMore] = useState(false);
    const moreRequestInFlightRef = useRef(false);
    const canRequestMore = hasMoreMedia && Boolean(onRequestMore);
    const text = appText.components.galleryGrid;

    const slides = useMemo<Slide[]>(() => {
        const items: Slide[] = media.map((item) => {
            const src = item.originalUrl ?? item.url;
            const dimensions = item.width && item.width > 0 && item.height && item.height > 0
                ? { width: item.width, height: item.height }
                : {};

            return item.kind === 'video'
                ? {
                    type: 'video',
                    sources: [{ src, type: item.contentType ?? '' }],
                    poster: item.thumbnailUrl ?? undefined,
                    ...dimensions,
                }
                : { src, alt: appText.common.media.photoPreviewAlt, ...dimensions };
        });

        // A real final slide lets swipe and keyboard navigation cross page boundaries.
        if (canRequestMore) items.push({ type: 'load-more' });
        return items;
    }, [canRequestMore, media]);

    const requestMore = useCallback(() => {
        if (!canRequestMore || !onRequestMore || loadingMore || moreRequestInFlightRef.current) return;

        moreRequestInFlightRef.current = true;
        setRequestingMore(true);
        void Promise.resolve()
            .then(onRequestMore)
            .catch(() => undefined)
            .finally(() => {
                moreRequestInFlightRef.current = false;
                setRequestingMore(false);
            });
    }, [canRequestMore, loadingMore, onRequestMore]);

    useEffect(() => {
        if (selectedMediaId !== null && !selectedMedia) onClose();
    }, [onClose, selectedMedia, selectedMediaId]);

    // Keep the next index while a page arrives, so the first new photo replaces
    // the loading slide without jumping back to the previous photo.
    const index = Math.min(
        selectedMediaIndex + (waitingAfterId !== null && waitingAfterId === selectedMediaId ? 1 : 0),
        slides.length - 1
    );
    const activeMedia = media[index];

    return (
        <Lightbox
            open={Boolean(selectedMedia)}
            close={() => {
                setWaitingAfterId(null);
                onClose();
            }}
            index={Math.max(0, index)}
            slides={slides}
            plugins={[Zoom, Video]}
            className="lightbox-overlay"
            carousel={{ finite: true, padding: 0, spacing: '8%', preload: 2 }}
            controller={{ closeOnPullDown: true, closeOnBackdropClick: true }}
            video={{ autoPlay: true, playsInline: true, controls: true, preload: 'metadata' }}
            zoom={{ doubleClickMaxStops: 1 }}
            labels={{
                Lightbox: text.dialogAriaLabel,
                Next: text.nextAriaLabel,
                Previous: text.previousAriaLabel,
                Close: text.closeAriaLabel,
                'Zoom in': text.zoomInAriaLabel,
                'Zoom out': text.zoomOutAriaLabel,
                'Photo gallery': text.dialogAriaLabel,
                Carousel: text.carouselAriaLabel,
                Slide: text.slideAriaLabel,
                '{index} of {total}': text.slideCounter,
            }}
            on={{
                view: ({ index: nextIndex }) => {
                    const nextMedia = media[nextIndex];
                    if (nextMedia) {
                        setWaitingAfterId(null);
                        if (nextMedia.id !== selectedMediaId) onSelectMedia(nextMedia.id);
                    } else if (selectedMedia && canRequestMore) {
                        setWaitingAfterId(selectedMedia.id);
                        requestMore();
                    }
                },
            }}
            toolbar={{
                buttons: [
                    'zoom',
                    activeMedia ? (
                        <a
                            key="download"
                            href={activeMedia.downloadUrl ?? activeMedia.originalUrl ?? activeMedia.url}
                            download
                            className="yarl__button"
                            aria-label={text.downloadAriaLabel}
                            title={text.downloadAriaLabel}
                        >
                            <svg className="yarl__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M12 3v12m0 0l-5-5m5 5l5-5M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </a>
                    ) : null,
                    'close',
                ],
            }}
            render={{
                iconLoading: () => <span className="lightbox-spinner" role="status" aria-label={text.loadingAriaLabel} />,
                iconError: () => <span role="alert">{text.imageLoadFailed}</span>,
                slide: ({ slide }) => slide.type === 'load-more' ? (
                    <div className="lightbox-pagination" role="status">
                        {loadingMore || requestingMore ? (
                            <><span className="lightbox-spinner" aria-hidden="true" /><span>{text.loadingAriaLabel}</span></>
                        ) : (
                            <><span>{text.loadMoreFailed}</span><button type="button" className="yarl__button" onClick={requestMore}>{text.retryLoading}</button></>
                        )}
                    </div>
                ) : undefined,
                controls: () => activeMedia && renderMediaActions ? (
                    <div className="lightbox-media-actions">
                        {renderMediaActions(activeMedia)}
                    </div>
                ) : null,
            }}
        />
    );
}
