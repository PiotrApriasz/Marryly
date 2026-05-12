import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminClient } from '../api/adminClient';
import ApiErrorAlert from '../components/ApiErrorAlert';
import AdminPagination from '../components/AdminPagination';
import Card from '../components/Card';
import ConfirmActionButton from '../components/ConfirmActionButton';
import Layout from '../components/Layout';
import Notice from '../components/Notice';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import StatusBadge from '../components/StatusBadge';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { useAdminPhotos } from '../hooks/admin/useAdminPhotos';
import { invalidateAdminCache, invalidateAdminCacheByPrefix } from '../hooks/admin/useAdminApiResource';

const PAGE_SIZE = 12;

function PhotosSkeleton() {
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

export default function AdminPhotosPage() {
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
    const { photosPage, loading, error, reload } = useAdminPhotos(currentPage, PAGE_SIZE);
    const { items, totalPages, totalCount, page } = photosPage;

    useEffect(() => {
        if (page !== currentPage) {
            setCurrentPage(page);
        }
    }, [currentPage, page]);

    const summaryLabel = useMemo(() => {
        return `Strona ${page} z ${totalPages} • ${totalCount} zdjęć łącznie`;
    }, [page, totalCount, totalPages]);

    const handleDelete = async (photoId: string) => {
        setDeleteError(null);
        setDeletingPhotoId(photoId);

        try {
            await adminClient.deletePhoto(photoId);
            invalidateAdminCacheByPrefix('photos_');
            invalidateAdminCache('overview');

            if (items.length === 1 && currentPage > 1) {
                setCurrentPage((value) => value - 1);
            } else {
                reload();
            }
        } catch (err: unknown) {
            setDeleteError(getErrorMessageForDisplay(err, 'Nie udało się usunąć zdjęcia.'));
            logErrorDetails(err, 'Failed to delete photo');
        } finally {
            setDeletingPhotoId(null);
        }
    };

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title="Zdjęcia Gości"
                        description="Wszystkie zdjęcia zapisane dla wydarzenia, także te w trakcie przetwarzania lub z błędem."
                        actions={(
                            <Link to="/admin/dashboard" className="inline-link">
                                Powrót do panelu
                            </Link>
                        )}
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
                        emptyMessage="Brak zdjęć do wyświetlenia."
                        loadingFallback={<PhotosSkeleton />}
                    >
                        <div className="mt-12">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="font-sans text-sm text-muted">
                                    {summaryLabel}
                                </p>
                            </div>

                            <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                                {items.map((photo) => {
                                    const previewUrl = photo.thumbnailBlobUrl ?? photo.previewBlobUrl ?? photo.originalBlobUrl;
                                    const status = getStatusMetadata(photo.status);

                                    return (
                                        <article key={photo.id}>
                                            <Card padding="none" className="overflow-hidden">
                                                <div className="aspect-[4/3] overflow-hidden bg-sand/40">
                                                    <img
                                                        src={previewUrl}
                                                        alt="Miniatura zdjęcia gościa"
                                                        loading="lazy"
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                                <div className="space-y-4 p-5">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <StatusBadge label={status.label} tone={status.tone} />
                                                        <span className="font-sans text-xs text-muted">
                                                            {photo.approved ? 'Widoczne dla gości' : 'Ukryte'}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-2 text-sm text-muted">
                                                        <p>Dodano: {formatDate(photo.uploadedAt)}</p>
                                                        <p>Rozmiar: {formatBytes(photo.sizeBytes)}</p>
                                                        <p>Typ: {photo.contentType}</p>
                                                        {photo.width > 0 && photo.height > 0 ? (
                                                            <p>Wymiary: {photo.width} × {photo.height}</p>
                                                        ) : null}
                                                    </div>

                                                    {photo.processingError ? (
                                                        <Notice tone="error" className="p-4">
                                                            <p className="text-sm">{photo.processingError}</p>
                                                        </Notice>
                                                    ) : null}

                                                    <div className="flex items-center justify-end">
                                                        <ConfirmActionButton
                                                            confirmMessage="Czy na pewno chcesz usunąć to zdjęcie? Ta operacja usunie oryginał, preview, thumbnail i wpis w bazie."
                                                            onConfirm={() => handleDelete(photo.id)}
                                                            loading={deletingPhotoId === photo.id}
                                                            disabled={deletingPhotoId !== null && deletingPhotoId !== photo.id}
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
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
