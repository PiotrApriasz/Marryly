import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import galleryMainPhoto from '../assets/gallery-main-photo.jpg';
import Card from '../components/Card';
import Layout from '../components/Layout';
import PageState from '../components/PageState';
import { useSharedGalleryAlbums } from '../hooks/useSharedGalleryAlbums';

export default function SharedGalleryPage() {
    const [searchParams] = useSearchParams();
    const view = searchParams.get('view') ?? '';
    const { data, loading, error } = useSharedGalleryAlbums(view);
    const albums = data.items;
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const albumsSectionRef = useRef<HTMLElement>(null);
    const [isAlbumsView, setIsAlbumsView] = useState(false);

    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer) {
            return;
        }

        const syncActiveView = () => {
            setIsAlbumsView(scrollContainer.scrollTop >= scrollContainer.clientHeight * 0.35);
        };

        syncActiveView();
        scrollContainer.addEventListener('scroll', syncActiveView, { passive: true });
        return () => scrollContainer.removeEventListener('scroll', syncActiveView);
    }, []);

    const showAlbums = () => {
        albumsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (!loading && !error && albums.length === 1 && albums[0].shareCode) {
        return <Navigate to={`/shared-gallery/${albums[0].shareCode}?view=${encodeURIComponent(view)}`} replace />;
    }

    return (
        <Layout showNavigation={false} showFooter={false}>
            <div ref={scrollContainerRef} className={`shared-gallery-shell ${isAlbumsView ? 'shared-gallery-shell-albums-active' : ''}`}>
                <img src={galleryMainPhoto} alt="" aria-hidden="true" className="shared-gallery-background-photo" />
                <img src={galleryMainPhoto} alt="" aria-hidden="true" className="shared-gallery-main-photo" />

                <section className="shared-gallery-welcome" aria-labelledby="shared-gallery-title">
                    <div className="shared-gallery-wordmark">
                        <h1 id="shared-gallery-title">Alicja <span>&amp;</span> Piotr</h1>
                    </div>
                    <button type="button" className="shared-gallery-scroll-cue" onClick={showAlbums}>
                        <span>Zobacz albumy</span>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                </section>

                <section ref={albumsSectionRef} className="shared-gallery-albums" aria-labelledby="shared-gallery-albums-title">
                    <div className="shared-gallery-albums-panel">
                        <div className="shared-gallery-albums-heading">
                            <p>Wasze wspomnienia</p>
                            <h2 id="shared-gallery-albums-title">Dostępne albumy</h2>
                        </div>

                        <PageState loading={loading} error={error} isEmpty={albums.length === 0} emptyMessage="Ten link nie udostępnia żadnych albumów.">
                            <div className="shared-gallery-albums-grid">
                                {albums.map((album) => (
                                    <Link key={album.id} to={`/shared-gallery/${album.shareCode}?view=${encodeURIComponent(view)}`} className="block">
                                        <Card padding="none" interactive className="shared-gallery-album-card h-full overflow-hidden">
                                            <div className="shared-gallery-album-cover">
                                                {album.coverUrl ? <img src={album.coverUrl} alt={`Okładka albumu ${album.title}`} loading="lazy" /> : <span>Album zdjęć</span>}
                                            </div>
                                            <div className="space-y-3 p-6">
                                                <div className="flex items-center justify-between gap-3">
                                                    <h3 className="font-serif text-2xl text-ink">{album.title}</h3>
                                                    <span className="font-sans text-xs text-muted">{album.itemCount} mediów</span>
                                                </div>
                                                <p className="text-sm leading-6 text-muted">{album.description || 'Album zdjęć'}</p>
                                            </div>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        </PageState>
                    </div>
                </section>
            </div>
        </Layout>
    );
}
