import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { adminClient } from '../api/adminClient';
import ApiErrorAlert from '../components/ApiErrorAlert';
import AdminBackLink from '../components/AdminBackLink';
import AdminPagination from '../components/AdminPagination';
import Card from '../components/Card';
import ConfirmActionButton from '../components/ConfirmActionButton';
import Layout from '../components/Layout';
import Notice from '../components/Notice';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import PhotoUploadPanel from '../components/PhotoUploadPanel';
import Section from '../components/Section';
import StatusBadge from '../components/StatusBadge';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { invalidateAdminCache, invalidateAdminCacheByPrefix } from '../hooks/admin/useAdminApiResource';
import { useAdminAlbumMedia } from '../hooks/admin/useAdminAlbumMedia';
import { useAdminAlbums } from '../hooks/admin/useAdminAlbums';
import { invalidateCachedApiResourcesByPrefix } from '../hooks/useCachedApiResource';

const PAGE_SIZE = 12;

function AlbumMediaSkeleton() {
    return (
        <div className="mt-12 grid gap-6 animate-pulse sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
                <Card key={item} padding="none" className="overflow-hidden">
                    <div className="aspect-[4/3] bg-sand/60" />
                    <div className="space-y-3 p-5">
                        <div className="h-5 w-24 rounded bg-sand" />
                        <div className="h-4 w-40 rounded bg-sand/70" />
                        <div className="h-4 w-28 rounded bg-sand/60" />
                    </div>
                </Card>
            ))}
        </div>
    );
}

function formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatBytes(size: number): string {
    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusMetadata(status: string): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
    switch (status) {
        case 'ready':
            return { label: 'Gotowe', tone: 'success' };
        case 'processing':
            return { label: 'Przetwarzanie', tone: 'warning' };
        case 'failed':
            return { label: 'Błąd', tone: 'danger' };
        default:
            return { label: status, tone: 'neutral' };
    }
}

export default function AdminAlbumPage() {
    const { albumId } = useParams();
    const [currentPage, setCurrentPage] = useState(1);
    const [pageError, setPageError] = useState<string | null>(null);
    const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
    const { albumsResponse, loading: albumsLoading, error: albumsError, reload: reloadAlbums } = useAdminAlbums();
    const { mediaPage, loading, error, reload } = useAdminAlbumMedia(albumId, currentPage, PAGE_SIZE);
    const album = albumsResponse.items.find((item) => item.id === albumId) ?? null;
    const { items, totalPages, totalCount, page } = mediaPage;

    useEffect(() => {
        if (page !== currentPage) {
            setCurrentPage(page);
        }
    }, [currentPage, page]);

    const summaryLabel = useMemo(() => {
        return `Strona ${page} z ${totalPages} • ${totalCount} zdjęć w albumie`;
    }, [page, totalCount, totalPages]);

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

            if (items.length === 1 && currentPage > 1) {
                setCurrentPage((value) => value - 1);
            } else {
                reload();
            }
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, 'Nie udało się usunąć zdjęcia.'));
            logErrorDetails(err, 'Failed to delete album media');
        } finally {
            setDeletingMediaId(null);
        }
    };

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <AdminBackLink to="/admin/albums" label="Powrót do albumów" shortLabel="Albumy" />
                    <PageHeader
                        title={album?.title ?? 'Album'}
                        helpText={album?.description ?? 'Zarządzaj zdjęciami przypisanymi do tego albumu.'}
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
                            <ApiErrorAlert message="Nie znaleziono wybranego albumu." />
                        </div>
                    ) : null}

                    {album ? (
                        <div className="mt-12">
                            <PhotoUploadPanel
                                addButtonLabel="Dodaj zdjęcia do albumu"
                                addButtonDescription="Wybierz zdjęcia, a po przetworzeniu trafią bezpośrednio do tego albumu."
                                successTitle="Zdjęcia dodane do albumu"
                                onCreateUpload={(payload) => adminClient.createAlbumPhotoUpload(album.id, payload)}
                                onCompleteUpload={(payload) => adminClient.completeAlbumPhotoUpload(album.id, payload)}
                                onAfterUpload={() => {
                                    invalidateAfterChange();
                                    reloadAlbums();
                                    reload();
                                }}
                            />
                        </div>
                    ) : null}

                    <PageState
                        loading={albumsLoading || (album !== null && loading)}
                        error={album ? error : null}
                        isEmpty={album !== null && items.length === 0}
                        emptyMessage="Ten album nie ma jeszcze żadnych zdjęć."
                        loadingFallback={<AlbumMediaSkeleton />}
                    >
                        {album ? (
                            <div className="mt-12">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="font-sans text-sm text-muted">
                                        {summaryLabel}
                                    </p>
                                </div>

                                <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                                    {items.map((mediaItem) => {
                                        const previewUrl = mediaItem.thumbnailBlobUrl ?? mediaItem.previewBlobUrl ?? mediaItem.originalBlobUrl;
                                        const status = getStatusMetadata(mediaItem.status);

                                        return (
                                            <article key={mediaItem.id}>
                                                <Card padding="none" className="overflow-hidden">
                                                    <div className="aspect-[4/3] overflow-hidden bg-sand/40">
                                                        <img
                                                            src={previewUrl}
                                                            alt="Miniatura zdjęcia z albumu"
                                                            loading="lazy"
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="space-y-4 p-5">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <StatusBadge label={status.label} tone={status.tone} />
                                                            <span className="font-sans text-xs text-muted">
                                                                {mediaItem.sourceType === 'admin' ? 'Dodane przez admina' : 'Dodane przez gościa'}
                                                            </span>
                                                        </div>

                                                        <div className="space-y-2 text-sm text-muted">
                                                            <p>Dodano: {formatDate(mediaItem.uploadedAt)}</p>
                                                            <p>Rozmiar: {formatBytes(mediaItem.sizeBytes)}</p>
                                                            <p>Typ: {mediaItem.contentType}</p>
                                                            {mediaItem.width > 0 && mediaItem.height > 0 ? (
                                                                <p>Wymiary: {mediaItem.width} × {mediaItem.height}</p>
                                                            ) : null}
                                                        </div>

                                                        {mediaItem.processingError ? (
                                                            <Notice tone="error" className="p-4">
                                                                <p className="text-sm">{mediaItem.processingError}</p>
                                                            </Notice>
                                                        ) : null}

                                                        <div className="flex items-center justify-end">
                                                            <ConfirmActionButton
                                                                confirmMessage="Czy na pewno chcesz usunąć to zdjęcie? Ta operacja usunie oryginał, preview, thumbnail i wpis w bazie."
                                                                onConfirm={() => handleDeleteMedia(mediaItem.id)}
                                                                loading={deletingMediaId === mediaItem.id}
                                                                disabled={deletingMediaId !== null && deletingMediaId !== mediaItem.id}
                                                            >
                                                                Usuń
                                                            </ConfirmActionButton>
                                                        </div>
                                                    </div>
                                                </Card>
                                            </article>
                                        );
                                    })}
                                </div>

                                <AdminPagination
                                    currentPage={page}
                                    totalPages={totalPages}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        ) : null}
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
