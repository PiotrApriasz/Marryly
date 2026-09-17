import Card from './Card';

export default function AdminMediaSkeleton() {
    return (
        <div className="mt-12 masonry-grid animate-pulse">
            {Array.from({ length: 6 }, (_, index) => (
                <Card key={index} padding="none" className="overflow-hidden">
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
