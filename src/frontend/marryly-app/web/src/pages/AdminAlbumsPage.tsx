import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminClient } from '../api/adminClient';
import AdminBackLink from '../components/AdminBackLink';
import ApiErrorAlert from '../components/ApiErrorAlert';
import Button from '../components/Button';
import Card from '../components/Card';
import ConfirmActionButton from '../components/ConfirmActionButton';
import Field from '../components/Field';
import Input from '../components/Input';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import Textarea from '../components/Textarea';
import { appText } from '../content/appText';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { invalidateAdminCache, invalidateAdminCacheByPrefix } from '../hooks/admin/useAdminApiResource';
import { useAdminAlbums } from '../hooks/admin/useAdminAlbums';
import { invalidateCachedApiResourcesByPrefix } from '../hooks/useCachedApiResource';
import type { AdminAlbum } from '../types/admin.types';

function AlbumsSkeleton() {
    return (
        <div className="mt-12 space-y-4 animate-pulse">
            {[1, 2, 3].map((item) => (
                <Card key={item}>
                    <div className="h-6 w-52 rounded bg-sand" />
                    <div className="mt-3 h-4 w-full rounded bg-sand/70" />
                    <div className="mt-2 h-4 w-3/4 rounded bg-sand/60" />
                </Card>
            ))}
        </div>
    );
}

function AlbumEditForm({
    album,
    onCancel,
    onSave,
    saving,
}: {
    album: AdminAlbum;
    onCancel: () => void;
    onSave: (payload: { title?: string; description?: string; isVisible?: boolean }) => Promise<void>;
    saving: boolean;
}) {
    const [title, setTitle] = useState(album.title);
    const [description, setDescription] = useState(album.description ?? '');
    const [isVisible, setIsVisible] = useState(album.isVisible);

    return (
        <div className="space-y-4">
            <Field label={appText.admin.albums.fields.albumTitle} htmlFor={`album-title-${album.id}`}>
                <Input
                    id={`album-title-${album.id}`}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    disabled={album.isSystem}
                />
            </Field>
            <Field label={appText.admin.albums.fields.description} htmlFor={`album-description-${album.id}`}>
                <Textarea
                    id={`album-description-${album.id}`}
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                />
            </Field>
            <label className="flex items-center gap-3 font-sans text-sm text-ink">
                <input
                    type="checkbox"
                    checked={isVisible}
                    disabled={album.isSystem}
                    onChange={(event) => setIsVisible(event.target.checked)}
                />
                {appText.admin.albums.visiblePublicly}
            </label>
            <div className="flex flex-wrap gap-3">
                <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    loading={saving}
                    onClick={() => void onSave({
                        title,
                        description,
                        isVisible,
                    })}
                >
                    {appText.common.actions.save}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
                    {appText.common.actions.cancel}
                </Button>
            </div>
        </div>
    );
}

export default function AdminAlbumsPage() {
    const { albumsResponse, loading, error, reload } = useAdminAlbums();
    const albums = albumsResponse.items;
    const [createTitle, setCreateTitle] = useState('');
    const [createDescription, setCreateDescription] = useState('');
    const [createVisible, setCreateVisible] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
    const [savingAlbumId, setSavingAlbumId] = useState<string | null>(null);
    const [actionAlbumId, setActionAlbumId] = useState<string | null>(null);
    const isCreateTitleValid = createTitle.trim().length > 0;

    const orderedIds = useMemo(() => albums.map((album) => album.id), [albums]);

    const invalidateAfterAlbumChange = () => {
        invalidateAdminCache('albums');
        invalidateAdminCacheByPrefix('album_media_');
        invalidateAdminCache('overview');
        invalidateCachedApiResourcesByPrefix('gallery_');
    };

    const handleCreateAlbum = async () => {
        setPageError(null);
        setIsCreating(true);

        try {
            await adminClient.createAlbum({
                title: createTitle.trim(),
                description: createDescription.trim() || undefined,
                isVisible: createVisible,
            });
            setCreateTitle('');
            setCreateDescription('');
            setCreateVisible(true);
            invalidateAfterAlbumChange();
            reload();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, appText.admin.albums.errors.create));
            logErrorDetails(err, 'Failed to create album');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSaveAlbum = async (albumId: string, payload: { title?: string; description?: string; isVisible?: boolean }) => {
        setPageError(null);
        setSavingAlbumId(albumId);

        try {
            await adminClient.updateAlbum(albumId, payload);
            setEditingAlbumId(null);
            invalidateAfterAlbumChange();
            reload();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, appText.admin.albums.errors.save));
            logErrorDetails(err, 'Failed to update album');
        } finally {
            setSavingAlbumId(null);
        }
    };

    const handleDeleteAlbum = async (albumId: string) => {
        setPageError(null);
        setActionAlbumId(albumId);

        try {
            await adminClient.deleteAlbum(albumId);
            invalidateAfterAlbumChange();
            reload();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, appText.admin.albums.errors.delete));
            logErrorDetails(err, 'Failed to delete album');
        } finally {
            setActionAlbumId(null);
        }
    };

    const handleMoveAlbum = async (albumId: string, direction: 'up' | 'down') => {
        const currentIndex = orderedIds.indexOf(albumId);
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedIds.length) {
            return;
        }

        const nextIds = [...orderedIds];
        [nextIds[currentIndex], nextIds[targetIndex]] = [nextIds[targetIndex], nextIds[currentIndex]];

        setPageError(null);
        setActionAlbumId(albumId);

        try {
            await adminClient.reorderAlbums(nextIds);
            invalidateAfterAlbumChange();
            reload();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, appText.admin.albums.errors.reorder));
            logErrorDetails(err, 'Failed to reorder albums');
        } finally {
            setActionAlbumId(null);
        }
    };

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <AdminBackLink />
                    <PageHeader
                        title={appText.admin.albums.title}
                        helpText={appText.admin.albums.helpText}
                    />

                    {pageError ? (
                        <div className="mt-8">
                            <ApiErrorAlert message={pageError} />
                        </div>
                    ) : null}

                    <div className="mx-auto mt-12 max-w-4xl">
                        <Card className="p-6">
                            <h2 className="font-serif text-2xl text-ink">{appText.admin.albums.newAlbum}</h2>
                            <div className="mt-6 grid gap-4">
                                <Field label={appText.admin.albums.fields.title} htmlFor="new-album-title">
                                    <Input
                                        id="new-album-title"
                                        value={createTitle}
                                        onChange={(event) => setCreateTitle(event.target.value)}
                                        placeholder={appText.admin.albums.placeholders.title}
                                    />
                                </Field>
                                <Field label={appText.admin.albums.fields.description} htmlFor="new-album-description">
                                    <Textarea
                                        id="new-album-description"
                                        rows={3}
                                        value={createDescription}
                                        onChange={(event) => setCreateDescription(event.target.value)}
                                        placeholder={appText.admin.albums.placeholders.description}
                                    />
                                </Field>
                                <label className="flex items-center gap-3 font-sans text-sm text-ink">
                                    <input
                                        type="checkbox"
                                        checked={createVisible}
                                        onChange={(event) => setCreateVisible(event.target.checked)}
                                    />
                                    {appText.admin.albums.visiblePublicly}
                                </label>
                                <div>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        loading={isCreating}
                                        disabled={!isCreateTitleValid}
                                        onClick={() => void handleCreateAlbum()}
                                    >
                                        {appText.admin.albums.create}
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <PageState
                        loading={loading}
                        error={error}
                        isEmpty={albums.length === 0}
                        emptyMessage={appText.admin.albums.empty}
                        loadingFallback={<AlbumsSkeleton />}
                    >
                        <div className="mx-auto mt-8 max-w-4xl space-y-4">
                            {albums.map((album, index) => (
                                <Card key={album.id} className="p-6">
                                    {editingAlbumId === album.id ? (
                                        <AlbumEditForm
                                            album={album}
                                            saving={savingAlbumId === album.id}
                                            onCancel={() => setEditingAlbumId(null)}
                                            onSave={(payload) => handleSaveAlbum(album.id, payload)}
                                        />
                                    ) : (
                                        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <h2 className="font-serif text-2xl text-ink">{album.title}</h2>
                                                    <span className="status-badge border-sand bg-sand/50 text-ink">
                                                        {album.isSystem ? appText.admin.albums.system : appText.admin.albums.custom}
                                                    </span>
                                                    <span className={`status-badge ${album.isVisible ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                                                        {album.isVisible ? appText.common.status.visible : appText.common.status.hidden}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm text-muted">{appText.admin.albums.slug}: {album.slug}</p>
                                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
                                                    {album.description || appText.admin.albums.noDescription}
                                                </p>
                                                <p className="mt-3 text-sm text-muted">
                                                    {album.itemCount} {appText.common.media.mediaPlural}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap gap-3">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => void handleMoveAlbum(album.id, 'up')}
                                                    disabled={index === 0 || actionAlbumId !== null}
                                                >
                                                    {appText.admin.albums.moveUp}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => void handleMoveAlbum(album.id, 'down')}
                                                    disabled={index === albums.length - 1 || actionAlbumId !== null}
                                                >
                                                    {appText.admin.albums.moveDown}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => setEditingAlbumId(album.id)}
                                                >
                                                    {appText.admin.albums.edit}
                                                </Button>
                                                <Link to={`/admin/albums/${album.id}`}>
                                                    <Button type="button" variant="primary" size="sm">
                                                        {appText.admin.albums.manageMedia}
                                                    </Button>
                                                </Link>
                                                {!album.isSystem ? (
                                                    <ConfirmActionButton
                                                        confirmMessage={appText.admin.albums.deleteConfirm}
                                                        onConfirm={() => handleDeleteAlbum(album.id)}
                                                        loading={actionAlbumId === album.id}
                                                    >
                                                        {appText.admin.albums.deleteAlbum}
                                                    </ConfirmActionButton>
                                                ) : null}
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
