import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminClient } from '../api/adminClient';
import AdminBulkPhotoUploadPanel from '../components/AdminBulkPhotoUploadPanel';
import ApiErrorAlert from '../components/ApiErrorAlert';
import AdminBackLink from '../components/AdminBackLink';
import AdminMediaGrid from '../components/AdminMediaGrid';
import ConfirmActionButton from '../components/ConfirmActionButton';
import InfiniteLoadMore from '../components/InfiniteLoadMore';
import Layout from '../components/Layout';
import Notice from '../components/Notice';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { appText } from '../content/appText';
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
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const [deletedCount, setDeletedCount] = useState(0);
    const [deleteAllSuccess, setDeleteAllSuccess] = useState(false);
    const deletionControllerRef = useRef<AbortController | null>(null);
    const { albumsResponse, loading: albumsLoading, error: albumsError, reload: reloadAlbums } = useAdminAlbums();
    const { items, loading, loadingMore, error, hasMore, totalCount, loadMore, reload } = useAdminAlbumMedia(albumId, PAGE_SIZE);
    const album = albumsResponse.items.find((item) => item.id === albumId) ?? null;
    const { items: uploadItems, isHydrating, completedAlbumIds, completionVersion } = useAdminUploadQueue();
    const hasPendingUploads = uploadItems.some((item) => item.albumId === albumId
        && (item.status === 'queued' || item.status === 'preparing' || item.status === 'uploading'));

    useEffect(() => () => {
        deletionControllerRef.current?.abort();
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

    const handleDeleteAllMedia = async () => {
        if (!album || deletionControllerRef.current || hasPendingUploads || isHydrating) {
            return;
        }

        const controller = new AbortController();
        deletionControllerRef.current = controller;
        setPageError(null);
        setDeleteAllSuccess(false);
        setDeletedCount(0);
        setIsDeletingAll(true);

        try {
            let hasMore = true;
            while (hasMore && !controller.signal.aborted) {
                const response = await adminClient.deleteAlbumMediaBatch(album.id, controller.signal);
                if (controller.signal.aborted) {
                    return;
                }

                setDeletedCount((count) => count + response.deletedCount);
                hasMore = response.hasMore;
                if (hasMore && response.deletedCount === 0) {
                    throw new Error('Album media deletion made no progress.');
                }
            }

            if (!controller.signal.aborted) {
                setDeleteAllSuccess(true);
            }
        } catch (err: unknown) {
            if (!controller.signal.aborted) {
                setPageError(`${appText.admin.album.deleteAllFailed} ${getErrorMessageForDisplay(err, '')}`.trim());
                logErrorDetails(err, 'Failed to delete all album media');
            }
        } finally {
            deletionControllerRef.current = null;
            setIsDeletingAll(false);
            invalidateAfterChange();
            reloadAlbums();
            reload();
        }
    };

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
                            <AdminBulkPhotoUploadPanel albumId={album.id} disabled={isDeletingAll} />
                        </div>
                    ) : null}

                    {album ? (
                        <div className="mt-8 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="font-sans text-sm text-muted">
                                    {totalCount} {appText.admin.album.totalSuffix}
                                </p>
                                <ConfirmActionButton
                                    confirmMessage={appText.admin.album.deleteAllConfirm.replace('{album}', album.title)}
                                    onConfirm={handleDeleteAllMedia}
                                    loading={isDeletingAll}
                                    disabled={loading || albumsLoading || Boolean(error) || totalCount === 0
                                        || hasPendingUploads || isHydrating}
                                >
                                    {appText.admin.album.deleteAll}
                                </ConfirmActionButton>
                            </div>
                            {hasPendingUploads ? (
                                <p className="text-sm text-muted">{appText.admin.album.deleteAllUploadPending}</p>
                            ) : null}
                            {isDeletingAll ? (
                                <Notice tone="info" role="status">
                                    {appText.admin.album.deleteAllProgress.replace('{count}', String(deletedCount))}
                                </Notice>
                            ) : deleteAllSuccess ? (
                                <Notice tone="success" role="status">{appText.admin.album.deleteAllSuccess}</Notice>
                            ) : null}
                        </div>
                    ) : null}
                </Section>

                <section className="shared-gallery-album-photos-screen" aria-label={appText.public.gallery.sharedAlbum.photosTitle}>
                    <div className="shared-gallery-album-photos-content">
                        <PageState
                            loading={albumsLoading || (album !== null && loading)}
                            error={album ? error : null}
                            isEmpty={!album || items.length === 0}
                            emptyMessage={appText.admin.album.empty}
                        >
                            <>
                                <AdminMediaGrid
                                    items={items}
                                    hasMoreMedia={hasMore}
                                    loadingMore={loadingMore}
                                    onRequestMore={loadMore}
                                />

                                <InfiniteLoadMore
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
        </Layout>
    );
}
