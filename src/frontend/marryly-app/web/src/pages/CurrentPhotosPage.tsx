import Layout from '../components/Layout';
import Section from '../components/Section';

export default function CurrentPhotosPage() {
    return (
        <Layout>
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Aktualne zdjęcia
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                        <p className="mx-auto mt-8 max-w-2xl font-sans text-lg text-muted">
                            Zobacz najnowsze zdjęcia dodane przez gości - na żywo!
                        </p>
                    </div>

                    {/* Live feed placeholder */}
                    <div className="mt-12">
                        <div className="mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 animate-pulse rounded-full bg-gold"></div>
                                <span className="font-sans text-sm font-medium text-ink">
                                    Transmisja na żywo
                                </span>
                            </div>
                            <span className="font-sans text-sm text-muted">
                                0 nowych zdjęć
                            </span>
                        </div>

                        {/* Grid placeholder */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div
                                    key={i}
                                    className="aspect-square rounded-2xl border border-sand bg-white/50 animate-pulse"
                                />
                            ))}
                        </div>

                        <p className="mt-8 text-center text-sm text-muted">
                            Zdjęcia pojawią się tutaj automatycznie, gdy goście zaczną je dodawać
                        </p>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
