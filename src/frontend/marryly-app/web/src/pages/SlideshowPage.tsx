import PageHeader from '../components/PageHeader';

export default function SlideshowPage() {
    return (
        <div className="fixed inset-0 bg-ink">
            {/* Fullscreen slideshow mode */}
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <PageHeader
                        title="Slideshow"
                        description="Tryb pełnoekranowego pokazu slajdów"
                        titleClassName="font-script text-6xl text-paper md:text-8xl"
                        descriptionClassName="text-xl text-paper/70"
                    />
                    <p className="mt-4 text-sm text-paper/50">
                        Funkcja zostanie wkrótce dodana
                    </p>
                </div>
            </div>

            {/* Exit button */}
            <a href="/" className="glass-link fixed right-8 top-8">
                Wyjdź
            </a>
        </div>
    );
}
