import { useMemo, useState } from 'react';
import AdminBackLink from '../components/AdminBackLink';
import ApiErrorAlert from '../components/ApiErrorAlert';
import Button from '../components/Button';
import Card from '../components/Card';
import ConfirmActionButton from '../components/ConfirmActionButton';
import Field from '../components/Field';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import Textarea from '../components/Textarea';
import { adminClient } from '../api/adminClient';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { useAdminAlbums } from '../hooks/admin/useAdminAlbums';
import { invalidateAdminCache } from '../hooks/admin/useAdminApiResource';
import { useAdminGalleryShareLinks } from '../hooks/admin/useAdminGalleryShareLinks';

function buildShareUrl(albums: { shareCode?: string | null }[]): string {
    const view = albums.map((album) => album.shareCode).filter((code): code is string => Boolean(code)).join('x');
    return `${window.location.origin}/?view=${view}`;
}

export default function AdminGalleryShareLinksPage() {
    const { albumsResponse, loading: albumsLoading } = useAdminAlbums();
    const { data: linksResponse, loading, error, reload } = useAdminGalleryShareLinks();
    const [selectedAlbumIds, setSelectedAlbumIds] = useState<string[]>([]);
    const [description, setDescription] = useState('');
    const [pageError, setPageError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const availableAlbums = useMemo(
        () => albumsResponse.items.filter((album) => album.isLinkAccessible && album.shareCode),
        [albumsResponse.items]
    );
    const selectedAlbums = availableAlbums.filter((album) => selectedAlbumIds.includes(album.id));
    const generatedUrl = buildShareUrl(selectedAlbums);

    const toggleAlbum = (albumId: string) => {
        setSelectedAlbumIds((current) => current.includes(albumId)
            ? current.filter((id) => id !== albumId)
            : [...current, albumId]);
    };

    const handleCreate = async () => {
        if (selectedAlbums.length === 0) {
            return;
        }

        setPageError(null);
        setIsSaving(true);
        try {
            await adminClient.createGalleryShareLink({
                albumIds: selectedAlbums.map((album) => album.id),
                description: description.trim() || undefined,
                url: generatedUrl,
            });
            setSelectedAlbumIds([]);
            setDescription('');
            invalidateAdminCache('gallery_share_links');
            reload();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, 'Nie udało się zapisać linku.'));
            logErrorDetails(err, 'Failed to create gallery share link');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopy = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
        } catch (err) {
            setPageError('Nie udało się skopiować linku. Skopiuj go ręcznie z pola poniżej.');
            logErrorDetails(err, 'Failed to copy gallery share link');
        }
    };

    const handleDelete = async (linkId: string) => {
        setPageError(null);
        setDeletingId(linkId);
        try {
            await adminClient.deleteGalleryShareLink(linkId);
            invalidateAdminCache('gallery_share_links');
            reload();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, 'Nie udało się usunąć zapisanego linku.'));
            logErrorDetails(err, 'Failed to delete gallery share link');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <AdminBackLink to="/admin/albums" label="Wróć do albumów" shortLabel="Albumy" />
                    <PageHeader
                        title="Linki do albumów"
                        helpText="Wybierz albumy dostępne przez link. Osoba z tym adresem zobaczy tylko wybrane albumy."
                    />

                    {pageError ? <div className="mt-8"><ApiErrorAlert message={pageError} /></div> : null}

                    <div className="mx-auto mt-12 max-w-4xl">
                        <Card className="p-6">
                            <h2 className="font-serif text-2xl text-ink">Nowy link</h2>
                            {albumsLoading ? <p className="mt-5 text-sm text-muted">Ładowanie albumów…</p> : null}
                            {!albumsLoading && availableAlbums.length === 0 ? (
                                <p className="mt-5 text-sm text-muted">Najpierw włącz „Dostępny przez link” przy co najmniej jednym albumie.</p>
                            ) : null}
                            <div className="mt-5 space-y-3">
                                {availableAlbums.map((album) => (
                                    <label key={album.id} className="flex items-center gap-3 rounded-xl border border-sand px-4 py-3 text-sm text-ink">
                                        <input
                                            type="checkbox"
                                            checked={selectedAlbumIds.includes(album.id)}
                                            onChange={() => toggleAlbum(album.id)}
                                        />
                                        <span className="flex-1">{album.title}</span>
                                        <span className="text-xs text-muted">{album.itemCount} mediów</span>
                                    </label>
                                ))}
                            </div>
                            <div className="mt-5">
                                <Field label="Opis (opcjonalnie)" htmlFor="gallery-share-link-description">
                                    <Textarea
                                        id="gallery-share-link-description"
                                        rows={3}
                                        value={description}
                                        onChange={(event) => setDescription(event.target.value)}
                                        placeholder="Np. Zdjęcia dla rodziny"
                                    />
                                </Field>
                            </div>
                            {selectedAlbums.length > 0 ? (
                                <div className="mt-5 rounded-xl bg-sand/40 p-4">
                                    <p className="break-all font-mono text-xs text-ink">{generatedUrl}</p>
                                </div>
                            ) : null}
                            <div className="mt-5 flex flex-wrap gap-3">
                                <Button type="button" variant="primary" loading={isSaving} disabled={selectedAlbums.length === 0} onClick={() => void handleCreate()}>
                                    Zapisz link
                                </Button>
                                <Button type="button" variant="secondary" disabled={selectedAlbums.length === 0} onClick={() => void handleCopy(generatedUrl)}>
                                    Kopiuj link
                                </Button>
                            </div>
                        </Card>
                    </div>

                    <div className="mx-auto mt-8 max-w-4xl">
                        <h2 className="font-serif text-2xl text-ink">Zapisane linki</h2>
                        <PageState loading={loading} error={error} isEmpty={linksResponse.items.length === 0} emptyMessage="Nie zapisano jeszcze żadnych linków.">
                            <div className="mt-5 space-y-4">
                                {linksResponse.items.map((link) => {
                                    const albumNames = link.albumIds.map((id) => albumsResponse.items.find((album) => album.id === id)?.title ?? 'Usunięty album');
                                    return (
                                        <Card key={link.id} className="p-5">
                                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-serif text-xl text-ink">{link.description || 'Link bez opisu'}</p>
                                                    <p className="mt-2 text-sm text-muted">{albumNames.join(', ')}</p>
                                                    <p className="mt-3 break-all font-mono text-xs text-muted">{link.url}</p>
                                                </div>
                                                <div className="flex shrink-0 flex-wrap gap-3">
                                                    <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopy(link.url)}>Kopiuj</Button>
                                                    <ConfirmActionButton
                                                        confirmMessage="Usunięcie tej pozycji nie unieważni wcześniej skopiowanego adresu. Czy usunąć zapis z panelu?"
                                                        loading={deletingId === link.id}
                                                        onConfirm={() => handleDelete(link.id)}
                                                    >
                                                        Usuń zapis
                                                    </ConfirmActionButton>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </PageState>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
