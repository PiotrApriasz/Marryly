import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminClient } from '../api/adminClient';
import AdminBulkPhotoUploadPanel from '../components/AdminBulkPhotoUploadPanel';
import ApiErrorAlert from '../components/ApiErrorAlert';
import AdminBackLink from '../components/AdminBackLink';
import AdminMediaGrid from '../components/AdminMediaGrid';
import AdminMediaSkeleton from '../components/AdminMediaSkeleton';
import InfiniteLoadMore from '../components/InfiniteLoadMore';
import Layout from '../components/Layout';
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

const PAGE_SIZE = 12;

export default function AdminAlbumPage() {
    const { albumId } = useParams();
    const [pageError, setPageError] = useState<string | null>(null);
    const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
    const { albumsResponse, loading: albumsLoading, error: albumsError, reload: reloadAlbums } = useAdminAlbums();
    const { items, loading, loadingMore, error, hasMore, totalCount, loadMore, reload } = useAdminAlbumMedia(albumId, PAGE_SIZE);
    const album = albumsResponse.items.find((item) => item.id === albumId) ?? null;
    const { completedAlbumIds, completionVersion } = useAdminUploadQueue();

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
    };

    const handleDeleteMedia = async (mediaId: string) => {
        setPageError(null);
        setDeletingMediaId(mediaId);

        try {
            await adminClient.deleteMedia(mediaId);
            invalidateAfterChange();
            reloadAlbums();

            reload();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, appText.admin.media.deleteFailed));
            logErrorDetails(err, 'Failed to delete album media');
        } finally {
            setDeletingMediaId(null);
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
                            <AdminBulkPhotoUploadPanel albumId={album.id} />
                        </div>
                    ) : null}

                    <PageState
                        loading={albumsLoading || (album !== null && loading)}
                        error={album ? error : null}
                        isEmpty={album !== null && items.length === 0}
                        emptyMessage={appText.admin.album.empty}
                        loadingFallback={<AdminMediaSkeleton />}
                    >
                        {album ? (
                            <div className="mt-12">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="font-sans text-sm text-muted">
                                        {totalCount} {appText.admin.album.totalSuffix}
                                    </p>
                                </div>

                                <div className="mt-6">
                                    <AdminMediaGrid
                                        items={items}
                                        hasMoreMedia={hasMore}
                                        loadingMore={loadingMore}
                                        onRequestMore={loadMore}
                                        thumbnailAlt={appText.admin.common.albumPhotoThumbnailAlt}
                                        getSecondaryLabel={(mediaItem) => mediaItem.sourceType === 'admin'
                                            ? appText.admin.common.addedByAdmin
                                            : appText.admin.common.addedByGuest}
                                        deletingMediaId={deletingMediaId}
                                        onDelete={handleDeleteMedia}
                                    />
                                </div>

                                <InfiniteLoadMore
                                    hasMore={hasMore}
                                    loading={loadingMore}
                                    onLoadMore={loadMore}
                                    label={appText.public.gallery.loadMore}
                                />
                            </div>
                        ) : null}
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
