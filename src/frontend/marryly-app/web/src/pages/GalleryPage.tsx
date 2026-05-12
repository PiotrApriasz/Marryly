import { Link, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Card from '../components/Card';
import PageHeader from '../components/PageHeader';
import Section from '../components/Section';
import PageState from '../components/PageState';
import { useGalleryAlbums } from '../hooks/useGalleryAlbums';

function GalleryLoadingFallback() {
    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => index + 1).map((item) => (
                <div
                    key={item}
                    className="animate-pulse overflow-hidden rounded-2xl border border-sand bg-white/50"
                />
            ))}
        </div>
    );
}

export default function GalleryPage() {
    const { albumsResponse, loading, error } = useGalleryAlbums();
    const { items: albums } = albumsResponse;

    if (!loading && !error && albums.length === 1) {
        return <Navigate to={`/gallery/${albums[0].slug}`} replace />;
    }

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title="Galeria"
                        description="Wybierz album, który chcesz obejrzeć."
                    />

                    <div className="mt-12">
                        <PageState
                            loading={loading}
                            error={error}
                            isEmpty={albums.length === 0}
                            emptyMessage="Galeria będzie widoczna, gdy pojawi się pierwszy album."
                            loadingFallback={<GalleryLoadingFallback />}
                        >
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {albums.map((album) => (
                                    <Link key={album.id} to={`/gallery/${album.slug}`} className="block">
                                        <Card padding="none" interactive className="h-full overflow-hidden">
                                            <div className="aspect-[4/3] overflow-hidden bg-sand/40">
                                                {album.coverUrl ? (
                                                    <img
                                                        src={album.coverUrl}
                                                        alt={`Okładka albumu ${album.title}`}
                                                        loading="lazy"
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-sm text-muted">
                                                        Album bez okładki
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-3 p-6">
                                                <div className="flex items-center justify-between gap-3">
                                                    <h2 className="font-serif text-2xl text-ink">{album.title}</h2>
                                                    <span className="font-sans text-xs text-muted">
                                                        {album.itemCount} zdjęć
                                                    </span>
                                                </div>
                                                <p className="text-sm leading-6 text-muted">
                                                    {album.description || 'Otwórz album, aby zobaczyć zawartość.'}
                                                </p>
                                            </div>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        </PageState>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
