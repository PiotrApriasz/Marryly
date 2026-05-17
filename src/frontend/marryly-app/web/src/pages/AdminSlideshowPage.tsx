import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminBackLink from '../components/AdminBackLink';
import ApiErrorAlert from '../components/ApiErrorAlert';
import Button from '../components/Button';
import Card from '../components/Card';
import Checkbox from '../components/Checkbox';
import Field from '../components/Field';
import Input from '../components/Input';
import Layout from '../components/Layout';
import Notice from '../components/Notice';
import PageHeader from '../components/PageHeader';
import PageState from '../components/PageState';
import Section from '../components/Section';
import { adminClient } from '../api/adminClient';
import { getErrorMessageForDisplay, logErrorDetails } from '../errors/apiError';
import { invalidateAdminCache } from '../hooks/admin/useAdminApiResource';
import { useAdminAlbums } from '../hooks/admin/useAdminAlbums';
import { useAdminSlideshowSettings } from '../hooks/admin/useAdminSlideshowSettings';

function SlideshowSettingsSkeleton() {
    return (
        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] animate-pulse">
            <Card className="space-y-6">
                <div className="h-6 w-40 rounded bg-sand" />
                <div className="space-y-3">
                    <div className="h-4 w-24 rounded bg-sand/80" />
                    <div className="h-12 rounded bg-sand/60" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                        <div className="h-4 w-32 rounded bg-sand/80" />
                        <div className="h-12 rounded bg-sand/60" />
                    </div>
                    <div className="space-y-3">
                        <div className="h-4 w-32 rounded bg-sand/80" />
                        <div className="h-12 rounded bg-sand/60" />
                    </div>
                </div>
            </Card>
            <Card className="space-y-4">
                <div className="h-6 w-28 rounded bg-sand" />
                <div className="h-20 rounded bg-sand/60" />
                <div className="h-20 rounded bg-sand/50" />
            </Card>
        </div>
    );
}

function formatDateTime(value: string): string {
    if (!value) {
        return 'Jeszcze nie zapisano';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Jeszcze nie zapisano';
    }

    return date.toLocaleString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function AdminSlideshowPage() {
    const navigate = useNavigate();
    const { albumsResponse, loading: albumsLoading, error: albumsError } = useAdminAlbums();
    const { settings, loading, error, reload } = useAdminSlideshowSettings();
    const [albumIds, setAlbumIds] = useState<string[]>([]);
    const [slideDurationSeconds, setSlideDurationSeconds] = useState('8');
    const [refreshIntervalSeconds, setRefreshIntervalSeconds] = useState('20');
    const [pageError, setPageError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (settings.albumIds.length === 0) {
            return;
        }

        setAlbumIds(settings.albumIds);
        setSlideDurationSeconds(String(settings.slideDurationSeconds));
        setRefreshIntervalSeconds(String(settings.refreshIntervalSeconds));
    }, [settings]);

    const selectedAlbums = useMemo(
        () => albumsResponse.items.filter((item) => albumIds.includes(item.id)),
        [albumIds, albumsResponse.items],
    );
    const selectedAlbumsCount = selectedAlbums.length;
    const selectedPhotosCount = selectedAlbums.reduce((sum, album) => sum + album.itemCount, 0);

    const parsedSlideDuration = Number.parseInt(slideDurationSeconds, 10);
    const parsedRefreshInterval = Number.parseInt(refreshIntervalSeconds, 10);
    const hasValidNumericValues = Number.isFinite(parsedSlideDuration) && Number.isFinite(parsedRefreshInterval);
    const normalizedCurrentAlbumIds = [...albumIds].sort();
    const normalizedSavedAlbumIds = [...settings.albumIds].sort();
    const hasUnsavedChanges = normalizedCurrentAlbumIds.join('|') !== normalizedSavedAlbumIds.join('|')
        || settings.slideDurationSeconds !== parsedSlideDuration
        || settings.refreshIntervalSeconds !== parsedRefreshInterval;
    const canSave = albumIds.length > 0 && hasValidNumericValues;

    const toggleAlbum = (albumId: string) => {
        setAlbumIds((current) => current.includes(albumId)
            ? current.filter((id) => id !== albumId)
            : [...current, albumId]);
    };

    const handleSave = async () => {
        if (!canSave) {
            setPageError('Wybierz przynajmniej jeden album i uzupełnij poprawnie czasy pokazu.');
            return;
        }

        setPageError(null);
        setIsSaving(true);

        try {
            await adminClient.saveSlideshowSettings({
                albumIds,
                slideDurationSeconds: parsedSlideDuration,
                refreshIntervalSeconds: parsedRefreshInterval,
            });
            invalidateAdminCache('slideshow_settings');
            reload();
        } catch (err: unknown) {
            setPageError(getErrorMessageForDisplay(err, 'Nie udało się zapisać ustawień pokazu slajdów.'));
            logErrorDetails(err, 'Failed to save slideshow settings');
        } finally {
            setIsSaving(false);
        }
    };

    const openSlideshow = async () => {
        try {
            await document.documentElement.requestFullscreen?.();
        } catch {
            // Ignore and continue to slideshow route even if the browser blocks fullscreen.
        }

        navigate('/slideshow');
    };

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <AdminBackLink />
                    <PageHeader
                        title="Pokaz slajdów"
                        helpText="Pełnoekranowy pokaz działa bez widocznych kontrolek, korzysta z wybranych albumów i sam dopina nowe zdjęcia podczas wesela."
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

                    <PageState
                        loading={loading || albumsLoading}
                        error={error}
                        isEmpty={false}
                        emptyMessage=""
                        loadingFallback={<SlideshowSettingsSkeleton />}
                    >
                        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                            <Card className="p-6 md:p-8">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <h2 className="font-serif text-2xl text-ink">Konfiguracja odtwarzania</h2>
                                        <p className="mt-2 text-sm text-muted">
                                            Pokaz przestawia zdjęcia dopiero po wczytaniu następnego kadru, więc ekran nie gaśnie między slajdami.
                                        </p>
                                    </div>
                                    <div className="text-right text-sm text-muted">
                                        Ostatni zapis
                                        <div className="mt-1 font-medium text-ink">{formatDateTime(settings.updatedAt)}</div>
                                    </div>
                                </div>

                                <div className="mt-8 grid gap-5">
                                    <Field label="Albumy źródłowe" htmlFor="slideshow-albums" labelTone="strong">
                                        <div id="slideshow-albums" className="grid gap-3">
                                            {albumsResponse.items.map((album) => (
                                                <div key={album.id} className="rounded-2xl border border-sand/80 bg-sand/35 p-4">
                                                    <Checkbox
                                                        checked={albumIds.includes(album.id)}
                                                        onChange={() => toggleAlbum(album.id)}
                                                        label={(
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <span className="font-medium text-ink">{album.title}</span>
                                                                <span className="text-xs text-muted">{album.itemCount} zdjęć</span>
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </Field>

                                    <div className="grid gap-5 md:grid-cols-2">
                                        <Field label="Czas jednego zdjęcia (sekundy)" htmlFor="slideshow-duration" labelTone="strong">
                                            <Input
                                                id="slideshow-duration"
                                                type="number"
                                                min={3}
                                                max={60}
                                                value={slideDurationSeconds}
                                                onChange={(event) => setSlideDurationSeconds(event.target.value)}
                                            />
                                        </Field>

                                        <Field label="Sprawdzanie nowych zdjęć (sekundy)" htmlFor="slideshow-refresh" labelTone="strong">
                                            <Input
                                                id="slideshow-refresh"
                                                type="number"
                                                min={10}
                                                max={300}
                                                value={refreshIntervalSeconds}
                                                onChange={(event) => setRefreshIntervalSeconds(event.target.value)}
                                            />
                                        </Field>
                                    </div>
                                </div>

                                <div className="mt-8 flex flex-wrap gap-3">
                                    <Button type="button" onClick={() => void handleSave()} loading={isSaving}>
                                        Zapisz ustawienia
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => void openSlideshow()}
                                        disabled={isSaving || hasUnsavedChanges || settings.albumIds.length === 0}
                                    >
                                        Uruchom pełny ekran
                                    </Button>
                                </div>

                                {hasUnsavedChanges ? (
                                    <p className="mt-4 text-sm text-muted">
                                        Zapisz zmiany, zanim uruchomisz pokaz z nową konfiguracją.
                                    </p>
                                ) : null}
                            </Card>

                            <div className="space-y-6">
                                <Card className="p-6">
                                    <h2 className="font-serif text-2xl text-ink">Podgląd ustawień</h2>
                                    <div className="mt-6 space-y-4 text-sm text-muted">
                                        <div className="rounded-2xl bg-sand/45 p-4">
                                            <p className="text-xs uppercase tracking-[0.18em] text-muted">Albumy</p>
                                            <p className="mt-2 text-lg font-semibold text-ink">
                                                {selectedAlbumsCount > 0 ? `${selectedAlbumsCount} wybrane` : 'Nie wybrano albumów'}
                                            </p>
                                            <p className="mt-1">
                                                {selectedAlbumsCount > 0 ? `${selectedPhotosCount} zdjęć łącznie w źródłach` : 'Wybierz albumy do pokazu'}
                                            </p>
                                            {selectedAlbumsCount > 0 ? (
                                                <p className="mt-2 text-xs leading-5">
                                                    {selectedAlbums.map((album) => album.title).join(', ')}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="rounded-2xl bg-sand/45 p-4">
                                            <p className="text-xs uppercase tracking-[0.18em] text-muted">Tempo</p>
                                            <p className="mt-2 text-lg font-semibold text-ink">
                                                {hasValidNumericValues ? `${parsedSlideDuration}s na zdjęcie` : 'Brak poprawnej wartości'}
                                            </p>
                                            <p className="mt-1">
                                                {hasValidNumericValues ? `Odświeżanie nowych zdjęć co ${parsedRefreshInterval}s` : 'Uzupełnij oba pola liczbowe'}
                                            </p>
                                        </div>
                                    </div>
                                </Card>

                                <Notice tone="info" className="p-5">
                                    <p className="text-sm">
                                        Pokaz będzie cyklicznie sprawdzał, czy w wybranych albumach pojawiły się nowe zdjęcia, i dopnie je na koniec kolejki bez zatrzymywania odtwarzania.
                                    </p>
                                </Notice>
                            </div>
                        </div>
                    </PageState>
                </Section>
            </div>
        </Layout>
    );
}
