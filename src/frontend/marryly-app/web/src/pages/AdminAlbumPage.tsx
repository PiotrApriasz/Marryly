import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminClient } from '../api/adminClient';
import AdminBulkPhotoUploadPanel from '../components/AdminBulkPhotoUploadPanel';
import ApiErrorAlert from '../components/ApiErrorAlert';
import AdminBackLink from '../components/AdminBackLink';
import AdminMediaGrid from '../components/AdminMediaGrid';
import Button from '../components/Button';
import AdminMediaSelectionActions from '../components/AdminMediaSelectionActions';
import InfiniteLoadMore from '../components/InfiniteLoadMore';
import Layout from '../components/Layout';
import Notice from '../components/Notice';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { appText } from '../content/appText';
import { triggerBlobDownload } from '../utils/download';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { invalidateAdminCache, invalidateAdminCacheByPrefix } from '../hooks/admin/useAdminApiResource';
import { useAdminAlbumMedia } from '../hooks/admin/useAdminAlbumMedia';
import { useAdminAlbums } from '../hooks/admin/useAdminAlbums';
import { useAdminUploadQueue } from '../hooks/admin/useAdminUploadQueue';
import { invalidateCachedApiResourcesByPrefix } from '../hooks/useCachedApiResource';

const PAGE_SIZE = 50;

export default function AdminAlbumPage() {
    const { albumId } = useParams();
    return <AdminAlbumContent key={albumId} albumId={albumId} />;
}

function AdminAlbumContent({ albumId }: { albumId: string | undefined }) {
    const [pageError, setPageError] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
    const [isSelectingAll, setIsSelectingAll] = useState(false);
    const [operation, setOperation] = useState<'add' | 'remove' | 'delete' | 'download' | null>(null);
    const isOperating = operation !== null;
    const [processedCount, setProcessedCount] = useState(0);
    const [operationTotal, setOperationTotal] = useState(0);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const operationControllerRef = useRef<AbortController | null>(null);
    const { albumsResponse, loading: albumsLoading, error: albumsError, reload: reloadAlbums } = useAdminAlbums();
    const { items, loading, loadingMore, error, hasMore, totalCount, loadMore, reload } = useAdminAlbumMedia(albumId, PAGE_SIZE);
    const album = albumsResponse.items.find((item) => item.id === albumId) ?? null;
    const { items: uploadItems, isHydrating, completedAlbumIds, completionVersion } = useAdminUploadQueue();
    const hasPendingUploads = uploadItems.some((item) => item.albumId === albumId
        && (item.status === 'queued' || item.status === 'preparing' || item.status === 'uploading'));
    const allSelected = totalCount > 0 && selectedMediaIds.size === totalCount;
    const selectionDisabled = isSelectingAll || isOperating;

    useEffect(() => () => {
        operationControllerRef.current?.abort();
    }, [albumId]);

    useEffect(() => {
        if (!albumId || !completedAlbumIds.includes(albumId)) {
            return;
        }

        reloadAlbums();
        reload();
    }, [albumId, completedAlbumIds, completionVersion, reload, reloadAlbums]);

    const invalidateAfterChange = () => {
        invalidateAdminCache('albums');
        invalidateAdminCacheByPrefix('album_media_');
        invalidateAdminCache('overview');
        invalidateCachedApiResourcesByPrefix('gallery_');
        invalidateCachedApiResourcesByPrefix('shared_gallery_');
    };

    const toggleMediaSelection = (mediaId: string) => {
        if (operationControllerRef.current) {
            return;
        }
        setSuccessMessage(null);
        setDownloadError(null);
        setSelectedMediaIds((current) => {
            const next = new Set(current);
            if (next.has(mediaId)) {
                next.delete(mediaId);
            } else {
                next.add(mediaId);
            }
            return next;
        });
    };

    const handleSelectAll = async () => {
        if (!album || operationControllerRef.current) {
            return;
        }
        setDownloadError(null);
        if (allSelected) {
            setSelectedMediaIds(new Set());
            return;
        }

        const controller = new AbortController();
        operationControllerRef.current = controller;
        setPageError(null);
        setSuccessMessage(null);
        setIsSelectingAll(true);
        try {
            const response = await adminClient.getAlbumMediaIds(album.id, controller.signal);
            if (!controller.signal.aborted) {
                setSelectedMediaIds(new Set(response.mediaIds));
            }
        } catch (err) {
            if (!controller.signal.aborted) {
                setPageError(getErrorMessageForDisplay(err, appText.admin.album.selectionFailed));
                logErrorDetails(err, 'Failed to select album media');
            }
        } finally {
            operationControllerRef.current = null;
            setIsSelectingAll(false);
        }
    };

    const handleSelectionAction = async (mode: 'add' | 'remove' | 'delete', targetAlbumId?: string): Promise<boolean> => {
        if (!album || operationControllerRef.current || (mode !== 'add' && (hasPendingUploads || isHydrating))) {
            return false;
        }
        const mediaIds = [...selectedMediaIds];
        if (mediaIds.length === 0) return false;
        const controller = new AbortController();
        operationControllerRef.current = controller;
        setPageError(null);
        setSuccessMessage(null);
        setProcessedCount(0);
        setOperationTotal(mediaIds.length);
        setOperation(mode);
        let missingCount = 0;
        try {
            for (let offset = 0; offset < mediaIds.length && !controller.signal.aborted; offset += 25) {
                const batchIds = mediaIds.slice(offset, offset + 25);
                if (mode === 'add') {
                    const response = await adminClient.addSelectedMediaToAlbum(album.id, targetAlbumId!, batchIds, controller.signal);
                    missingCount += batchIds.length - response.processedCount;
                } else if (mode === 'remove') {
                    await adminClient.removeSelectedMediaFromAlbum(album.id, batchIds, controller.signal);
                } else {
                    await adminClient.deleteSelectedAlbumMedia(album.id, batchIds, controller.signal);
                }
                if (controller.signal.aborted) return false;
                setProcessedCount((count) => count + batchIds.length);
                if (mode !== 'add') {
                    setSelectedMediaIds((current) => {
                        const next = new Set(current);
                        batchIds.forEach((id) => next.delete(id));
                        return next;
                    });
                }
            }
            if (controller.signal.aborted) return false;
            const text = appText.admin.album.selectionActions;
            setSuccessMessage(mode === 'add'
                ? `${text.addSuccess.replace('{album}', albumsResponse.items.find((item) => item.id === targetAlbumId)?.title ?? '')}${missingCount > 0 ? ` ${text.addMissing}` : ''}`
                : mode === 'remove' ? text.removeSuccess : appText.admin.album.deleteSelectedSuccess);
            return true;
        } catch (err: unknown) {
            if (!controller.signal.aborted) {
                setPageError(`${appText.admin.album.selectionActions.failed} ${getErrorMessageForDisplay(err, '')}`.trim());
                logErrorDetails(err, 'Failed to update selected album media');
                try {
                    const response = await adminClient.getAlbumMediaIds(album.id, controller.signal);
                    if (!controller.signal.aborted) {
                        const remaining = new Set(response.mediaIds);
                        setSelectedMediaIds((current) => new Set([...current].filter((id) => remaining.has(id))));
                    }
                } catch {
                    // Keep the selection if offline; membership and deletion are safe to retry.
                }
            }
            return false;
        } finally {
            operationControllerRef.current = null;
            setOperation(null);
            invalidateAfterChange();
            reloadAlbums();
            if (mode !== 'add') reload();
        }
    };

    const handleDownloadSelected = async () => {
        if (!album || operationControllerRef.current || selectedMediaIds.size === 0) return;
        const controller = new AbortController();
        operationControllerRef.current = controller;
        setDownloadError(null);
        setOperation('download');
        try {
            const blob = await adminClient.downloadSelectedAlbumMedia(album.id, [...selectedMediaIds], controller.signal);
            if (!controller.signal.aborted) {
                const slug = (album.slug ?? 'album').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'album';
                triggerBlobDownload(blob, `${slug}-wybrane-media.zip`);
            }
        } catch (err) {
            if (!controller.signal.aborted) {
                setDownloadError(getErrorMessageForDisplay(err, appText.admin.album.selectionActions.downloadFailed));
                logErrorDetails(err, 'Failed to download selected album media');
            }
        } finally {
            operationControllerRef.current = null;
            setOperation(null);
        }
    };

    const progressMessage = isOperating && operation !== 'download'
        ? appText.admin.album.selectionActions.progress.replace('{count}', String(processedCount)).replace('{total}', String(operationTotal))
        : null;
    const selectionActions = (compact = false) => album ? (
        <AdminMediaSelectionActions
            count={selectedMediaIds.size}
            album={album}
            albums={albumsResponse.items}
            busy={selectionDisabled}
            deleteDisabled={hasPendingUploads || isHydrating}
            error={pageError}
            progress={progressMessage}
            compact={compact}
            onOpen={() => { setPageError(null); setSuccessMessage(null); setDownloadError(null); }}
            onAdd={(targetId) => handleSelectionAction('add', targetId)}
            onRemove={() => handleSelectionAction('remove')}
            onDelete={() => handleSelectionAction('delete')}
            onDownload={handleDownloadSelected}
            downloading={operation === 'download'}
            downloadError={downloadError}
        />
    ) : null;

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <AdminBackLink to="/admin/albums" label={appText.admin.common.backToAlbums} shortLabel={appText.admin.common.albumsShortLabel} />
                    <PageHeader
                        title={album?.title ?? appText.admin.album.fallbackTitle}
                        helpText={album?.description ?? appText.admin.album.helpText}
                    />

                    {pageError ? (
                        <div className="mt-8">
                            <ApiErrorAlert message={pageError} />
                        </div>
                    ) : null}

                    {albumsError ? (
                        <div className="mt-8">
                            <ApiErrorAlert message={albumsError} />
                        </div>
                    ) : null}

                    {!albumsLoading && !album ? (
                        <div className="mt-8">
                            <ApiErrorAlert message={appText.admin.album.notFound} />
                        </div>
                    ) : null}

                    {album ? (
                        <div className="mt-12">
                            <AdminBulkPhotoUploadPanel albumId={album.id} disabled={isOperating} />
                        </div>
                    ) : null}

                    {album ? (
                        <div className="mt-8 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="font-sans text-sm text-muted">
                                    {totalCount} {appText.admin.album.totalSuffix}
                                </p>
                                <div className="flex flex-wrap items-center gap-3">
                                    {selectedMediaIds.size > 0 ? (
                                        <>
                                            <span className="text-sm text-muted">
                                                {appText.admin.album.selectedCount.replace('{count}', String(selectedMediaIds.size))}
                                            </span>
                                            {!allSelected ? (
                                                <Button variant="ghost" size="sm" disabled={selectionDisabled} onClick={() => setSelectedMediaIds(new Set())}>
                                                    {appText.admin.album.clearSelection}
                                                </Button>
                                            ) : null}
                                        </>
                                    ) : null}
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => void handleSelectAll()}
                                        loading={isSelectingAll}
                                        disabled={loading || albumsLoading || Boolean(error) || totalCount === 0 || isOperating}
                                    >
                                        {allSelected ? appText.admin.album.deselectAll : appText.admin.album.selectAll}
                                    </Button>
                                </div>
                            </div>
                            {hasPendingUploads && selectedMediaIds.size > 0 ? (
                                <p className="text-sm text-muted">{appText.admin.album.deleteUploadPending}</p>
                            ) : null}
                            {progressMessage ? (
                                <Notice tone="info" role="status">
                                    {progressMessage}
                                </Notice>
                            ) : successMessage ? (
                                <Notice tone="success" role="status">{successMessage}</Notice>
                            ) : null}
                        </div>
                    ) : null}
                </Section>

                <section className="shared-gallery-album-photos-screen" aria-label={appText.public.gallery.sharedAlbum.photosTitle}>
                    <div className="shared-gallery-album-photos-content">
                        <PageState
                            loading={(!album && albumsLoading) || (album !== null && loading)}
                            error={album && items.length === 0 ? error : null}
                            isEmpty={!album || items.length === 0}
                            emptyMessage={appText.admin.album.empty}
                        >
                            <>
                                <AdminMediaGrid
                                    items={items}
                                    hasMoreMedia={hasMore}
                                    loadingMore={loadingMore}
                                    onRequestMore={loadMore}
                                    selectedMediaIds={selectedMediaIds}
                                    onToggleMediaSelection={toggleMediaSelection}
                                    selectionDisabled={selectionDisabled}
                                    lightboxSelectionActions={selectionActions(true)}
                                />

                                <InfiniteLoadMore
                                    itemCount={items.length}
                                    error={error}
                                    hasMore={hasMore}
                                    loading={loadingMore}
                                    onLoadMore={loadMore}
                                    label={appText.public.gallery.loadMore}
                                />
                            </>
                        </PageState>
                    </div>
                </section>
            </div>
            {album && selectedMediaIds.size > 0 ? (
                <div className="fixed bottom-6 left-1/2 z-[60] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2">
                    {selectionActions()}
                </div>
            ) : null}
        </Layout>
    );
}
