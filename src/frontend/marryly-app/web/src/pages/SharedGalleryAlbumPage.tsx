import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import Layout from '../components/Layout';
import InfiniteLoadMore from '../components/InfiniteLoadMore';
import Notice from '../components/Notice';
import PageState from '../components/PageState';
import PhotoGalleryGrid from '../components/PhotoGalleryGrid';
import { appText } from '../content/appText';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { useInfiniteAlbumMedia } from '../hooks/useInfiniteAlbumMedia';
import { useSharedGalleryAlbum } from '../hooks/useSharedGalleryAlbum';

type AlbumActionIconName = 'back' | 'select' | 'download' | 'check';

function AlbumActionIcon({ icon }: { icon: AlbumActionIconName }) {
    if (icon === 'back') {
        return (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M19 12H5m7-7-7 7 7 7" />
            </svg>
        );
    }

    if (icon === 'select') {
        return (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="m8 12 2.5 2.5L16 9" />
            </svg>
        );
    }

    if (icon === 'check') {
        return (
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12m0 0-5-5m5 5 5-5M5 21h14" />
        </svg>
    );
}

function triggerBlobDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildDownloadFileName(slug: string | undefined, selectedOnly: boolean): string {
    const safeSlug = (slug ?? 'album').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'album';
    return `${safeSlug}-${selectedOnly ? 'wybrane-zdjecia' : 'zdjecia'}.zip`;
}

export default function SharedGalleryAlbumPage() {
    const { shareCode } = useParams();
    const [searchParams] = useSearchParams();
    const view = searchParams.get('view') ?? '';
    const { data: album, loading: albumLoading, error: albumError } = useSharedGalleryAlbum(shareCode, view);
    const { photos, loading, error, hasMore, loadingMore, loadMore } = useInfiniteAlbumMedia({
        shareCode,
        sharedView: view,
        pageSize: 50,
    });
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const photosSectionRef = useRef<HTMLElement | null>(null);
    const [isPhotosView, setIsPhotosView] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const [isDownloadingSelected, setIsDownloadingSelected] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const hasPhotos = (album?.photoCount ?? (photos.some((photo) => photo.kind === 'photo') ? 1 : 0)) > 0;
    const isDownloading = isDownloadingAll || isDownloadingSelected;

    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) {
            return;
        }

        const syncActiveView = () => {
            setIsPhotosView(scrollContainer.scrollTop >= scrollContainer.clientHeight * 0.35);
        };

        syncActiveView();
        scrollContainer.addEventListener('scroll', syncActiveView, { passive: true });
        return () => scrollContainer.removeEventListener('scroll', syncActiveView);
    }, []);

    useEffect(() => {
        setSelectedPhotoIds(new Set());
        setIsSelectionMode(false);
    }, [shareCode]);

    const showPhotos = () => {
        photosSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const toggleSelectionMode = () => {
        setIsSelectionMode((current) => {
            if (current) {
                setSelectedPhotoIds(new Set());
            }

            return !current;
        });
        setDownloadError(null);
    };

    const togglePhotoSelection = (photoId: string) => {
        setSelectedPhotoIds((current) => {
            const next = new Set(current);
            if (next.has(photoId)) {
                next.delete(photoId);
            } else {
                next.add(photoId);
            }
            return next;
        });
    };

    const downloadPhotos = async (mediaIds?: string[]) => {
        if (!shareCode || !hasPhotos || (mediaIds !== undefined && mediaIds.length === 0) || isDownloading) {
            return;
        }

        const selectedOnly = mediaIds !== undefined;
        setDownloadError(null);
        if (selectedOnly) {
            setIsDownloadingSelected(true);
        } else {
            setIsDownloadingAll(true);
        }

        try {
            const blob = await apiClient.downloadSharedGalleryAlbumPhotos(shareCode, view, mediaIds);
            triggerBlobDownload(blob, buildDownloadFileName(album?.slug, selectedOnly));

            if (selectedOnly) {
                setSelectedPhotoIds(new Set());
                setIsSelectionMode(false);
            }
        } catch (downloadRequestError) {
            setDownloadError(getErrorMessageForDisplay(downloadRequestError, appText.public.gallery.sharedAlbum.downloadFailed));
            logErrorDetails(downloadRequestError, 'Failed to download shared gallery photos');
        } finally {
            setIsDownloadingAll(false);
            setIsDownloadingSelected(false);
        }
    };

    return (
        <Layout showNavigation={false} showFooter={false}>
            <div
                ref={scrollContainerRef}
                className={`shared-gallery-shell shared-gallery-album-shell ${isPhotosView ? 'shared-gallery-album-shell-photos-active' : ''}`}
            >
                {album?.heroUrl ? (
                    <img
                        src={album.heroUrl}
                        alt={appText.public.gallery.sharedAlbum.heroAlt}
                        className="shared-gallery-album-hero-photo"
                    />
                ) : (
                    <div className="shared-gallery-album-hero-placeholder" aria-hidden="true" />
                )}

                <section className="shared-gallery-album-welcome" aria-labelledby="shared-gallery-album-title">
                    <div className="shared-gallery-album-wordmark">
                        <h1 id="shared-gallery-album-title">{album?.title ?? 'Album'}</h1>
                    </div>
                    <button type="button" className="shared-gallery-scroll-cue" onClick={showPhotos}>
                        <span>{appText.public.gallery.sharedAlbum.welcomeCue}</span>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                </section>

                <section
                    ref={photosSectionRef}
                    className="shared-gallery-album-photos-screen"
                    aria-labelledby="shared-gallery-album-photos-title"
                >
                    <div className="shared-gallery-album-photos-content">
                        <div className="shared-gallery-album-toolbar">
                            <Link
                                to={`/?view=${encodeURIComponent(view)}`}
                                className="shared-gallery-album-control"
                                aria-label={appText.public.gallery.sharedAlbum.backToAlbums}
                                title={appText.public.gallery.sharedAlbum.backToAlbums}
                            >
                                <AlbumActionIcon icon="back" />
                            </Link>
                            <div className="shared-gallery-album-toolbar-actions">
                                <button
                                    type="button"
                                    className={`shared-gallery-album-control ${isSelectionMode ? 'shared-gallery-album-control-active' : ''}`}
                                    aria-label={isSelectionMode ? appText.public.gallery.sharedAlbum.finishSelection : appText.public.gallery.sharedAlbum.selectPhotos}
                                    aria-pressed={isSelectionMode}
                                    title={isSelectionMode ? appText.public.gallery.sharedAlbum.finishSelection : appText.public.gallery.sharedAlbum.selectPhotos}
                                    disabled={!hasPhotos || isDownloading}
                                    onClick={toggleSelectionMode}
                                >
                                    <AlbumActionIcon icon={isSelectionMode ? 'check' : 'select'} />
                                </button>
                                <button
                                    type="button"
                                    className="shared-gallery-album-control"
                                    aria-label={appText.public.gallery.sharedAlbum.downloadAll}
                                    title={appText.public.gallery.sharedAlbum.downloadAll}
                                    disabled={!hasPhotos || isDownloading}
                                    onClick={() => void downloadPhotos()}
                                >
                                    <AlbumActionIcon icon="download" />
                                </button>
                            </div>
                        </div>

                        <div className="shared-gallery-album-photos-heading">
                            <p>{album?.title ?? 'Album'}</p>
                            <h2 id="shared-gallery-album-photos-title">{appText.public.gallery.sharedAlbum.photosTitle}</h2>
                        </div>

                        {downloadError ? (
                            <Notice tone="error" className="shared-gallery-download-error" role="alert">
                                <p>{downloadError}</p>
                            </Notice>
                        ) : null}

                        <PageState
                            loading={albumLoading || loading}
                            error={albumError ?? error}
                            isEmpty={photos.length === 0}
                            emptyMessage={appText.public.gallery.sharedAlbum.noPhotos}
                        >
                            <>
                                <PhotoGalleryGrid
                                    photos={photos}
                                    hasMoreMedia={hasMore}
                                    loadingMore={loadingMore}
                                    onRequestMore={loadMore}
                                    variant="masonry"
                                    selectionMode={isSelectionMode}
                                    selectedPhotoIds={selectedPhotoIds}
                                    onTogglePhotoSelection={togglePhotoSelection}
                                />
                                <InfiniteLoadMore
                                    hasMore={hasMore}
                                    loading={loadingMore}
                                    onLoadMore={loadMore}
                                    label={appText.public.gallery.loadMore}
                                />
                            </>
                        </PageState>

                        <footer className="shared-gallery-credit-footer">
                            <div className="shared-gallery-credit-footer-rule" aria-hidden="true" />
                            <p>{appText.public.gallery.sharedAlbum.credits}</p>
                        </footer>
                    </div>

                    {isSelectionMode && selectedPhotoIds.size > 0 ? (
                        <button
                            type="button"
                            className="shared-gallery-selection-download"
                            disabled={isDownloading}
                            onClick={() => void downloadPhotos([...selectedPhotoIds])}
                        >
                            <AlbumActionIcon icon="download" />
                            <span>
                                {appText.public.gallery.sharedAlbum.downloadSelected}
                                <small>{selectedPhotoIds.size} {appText.public.gallery.sharedAlbum.selectedCount}</small>
                            </span>
                        </button>
                    ) : null}
                </section>
            </div>
        </Layout>
    );
}
