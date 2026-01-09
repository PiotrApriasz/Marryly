export default function SlideshowPage() {
    return (
        <div className="fixed inset-0 bg-ink">
            {/* Fullscreen slideshow mode */}
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <h1 className="font-script text-6xl text-paper md:text-8xl">
                        Slideshow
                    </h1>
                    <div className="mx-auto mt-8 h-[2px] w-32 bg-gold" />
                    <p className="mt-8 font-sans text-xl text-paper/70">
                        Tryb pełnoekranowego pokazu slajdów
                    </p>
                    <p className="mt-4 text-sm text-paper/50">
                        Funkcja zostanie wkrótce dodana
                    </p>
                </div>
            </div>

            {/* Exit button */}
            <a href="/"
                className="fixed right-8 top-8 rounded-lg bg-paper/10 px-4 py-2 font-sans text-paper backdrop-blur-sm transition-colors hover:bg-paper/20">
                Wyjdź
            </a>
        </div>
    );
}