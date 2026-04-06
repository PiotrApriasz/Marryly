export default function RouteLoadingScreen() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-paper px-4">
            <div className="text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gold/20 border-t-gold" />
                <p className="mt-4 font-sans text-sm text-muted">
                    Ładowanie widoku...
                </p>
            </div>
        </div>
    );
}
