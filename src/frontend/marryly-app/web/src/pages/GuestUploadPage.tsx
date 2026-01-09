import Layout from '../components/Layout';
import Section from '../components/Section';
import Button from '../components/Button';

export default function GuestUploadPage() {
    return (
        <Layout>
            <div className="pt-20">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-5xl text-ink md:text-6xl">
                            Dodaj zdjęcie lub film
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                        <p className="mx-auto mt-8 max-w-2xl font-sans text-lg text-muted">
                            Podziel się swoimi wspomnieniami z tego wyjątkowego dnia
                        </p>
                    </div>

                    <div className="mx-auto mt-12 max-w-2xl">
                        <div className="rounded-2xl border-2 border-dashed border-sand bg-white p-12 text-center transition-colors hover:border-gold">
                            <svg className="mx-auto h-16 w-16 text-muted"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                            </svg>
                            <p className="mt-4 font-sans text-lg text-ink">
                                Funkcja uploadu zostanie wkrótce dodana
                            </p>
                            <p className="mt-2 text-sm text-muted">
                                Przeciągnij i upuść pliki lub kliknij aby wybrać
                            </p>
                            <Button variant="primary" size="lg" className="mt-6">
                                Wybierz pliki
                            </Button>
                        </div>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}