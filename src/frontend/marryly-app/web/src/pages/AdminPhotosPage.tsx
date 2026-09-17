import { useState } from 'react';
import { adminClient } from '../api/adminClient';
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
import { useAdminPhotos } from '../hooks/admin/useAdminPhotos';
import { invalidateAdminCache, invalidateAdminCacheByPrefix } from '../hooks/admin/useAdminApiResource';
import { invalidateCachedApiResourcesByPrefix } from '../hooks/useCachedApiResource';

const PAGE_SIZE = 12;

export default function AdminPhotosPage() {
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
    const { items, loading, loadingMore, error, hasMore, totalCount, loadMore, reload } = useAdminPhotos(PAGE_SIZE);

    const handleDelete = async (photoId: string) => {
        setDeleteError(null);
        setDeletingPhotoId(photoId);

        try {
            await adminClient.deletePhoto(photoId);
            invalidateAdminCacheByPrefix('photos_');
            invalidateAdminCache('albums');
            invalidateAdminCacheByPrefix('album_media_');
            invalidateAdminCache('overview');
            invalidateCachedApiResourcesByPrefix('gallery_');

            reload();
        } catch (err: unknown) {
            setDeleteError(getErrorMessageForDisplay(err, appText.admin.media.deleteFailed));
            logErrorDetails(err, 'Failed to delete media');
        } finally {
            setDeletingPhotoId(null);
        }
    };

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <AdminBackLink />
                    <PageHeader
                        title={appText.admin.media.title}
                        helpText={appText.admin.media.helpText}
                    />

                    {deleteError ? (
                        <div className="mt-8">
                            <ApiErrorAlert message={deleteError} />
                        </div>
                    ) : null}

                    <PageState
                        loading={loading}
                        error={error}
                        isEmpty={items.length === 0}
                        emptyMessage={appText.admin.media.empty}
                        loadingFallback={<AdminMediaSkeleton />}
                    >
                        <div className="mt-12">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="font-sans text-sm text-muted">
                                    {totalCount} {appText.admin.media.totalSuffix}
                                </p>
                            </div>

                            <div className="mt-6">
                                <AdminMediaGrid
                                    items={items}
                                    hasMoreMedia={hasMore}
                                    loadingMore={loadingMore}
                                    onRequestMore={loadMore}
                                    thumbnailAlt={appText.admin.common.photoThumbnailAlt}
                                    getSecondaryLabel={(photo) => photo.approved
                                        ? appText.common.status.visibleForGuests
                                        : appText.common.status.hidden}
                                    deletingMediaId={deletingPhotoId}
                                    onDelete={handleDelete}
                                />
                            </div>

                            <InfiniteLoadMore
                                hasMore={hasMore}
                                loading={loadingMore}
                                onLoadMore={loadMore}
                                label={appText.public.gallery.loadMore}
                            />
                        </div>
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
