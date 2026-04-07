import { type FormEvent, useState } from 'react';
import { apiClient } from '../api/client';
import ApiErrorAlert from '../components/ApiErrorAlert';
import Field from '../components/Field';
import Input from '../components/Input';
import Layout from '../components/Layout';
import Notice from '../components/Notice';
import PageHeader from '../components/PageHeader';
import Section from '../components/Section';
import Button from '../components/Button';
import Textarea from '../components/Textarea';
import { getErrorMessageForDisplay } from '../errors/apiError';

export default function GuestbookPage() {
    const [authorName, setAuthorName] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await apiClient.addGuestBookEntry({
                authorName: authorName.trim(),
                message: message.trim(),
            });

            setIsSubmitted(true);
            setAuthorName('');
            setMessage('');
        } catch (err: unknown) {
            setError(getErrorMessageForDisplay(err, 'Nie udało się wysłać życzeń. Spróbuj ponownie.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="page-offset">
                <Section background="white">
                    <PageHeader
                        title="Księga gości"
                        description="Zostaw nam swoje życzenia i wspomnienia z tego wyjątkowego dnia"
                    />

                    <div className="mx-auto mt-12 max-w-2xl">
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {isSubmitted && !error && (
                                <Notice tone="success" className="rounded-lg p-4 text-left">
                                    <p className="font-sans text-sm">
                                        Dziękujemy! Twoje życzenia zostały zapisane.
                                    </p>
                                </Notice>
                            )}
                            {error && <ApiErrorAlert message={error} />}

                            <Field label="Twoje imię" htmlFor="name" labelTone="strong">
                                <Input
                                    type="text"
                                    id="name"
                                    value={authorName}
                                    onChange={(event) => setAuthorName(event.target.value)}
                                    required
                                    placeholder="Jan Kowalski"
                                />
                            </Field>

                            <Field label="Twoja wiadomość" htmlFor="message" labelTone="strong">
                                <Textarea
                                    id="message"
                                    rows={6}
                                    value={message}
                                    onChange={(event) => setMessage(event.target.value)}
                                    required
                                    placeholder="Podziel się z nami czymkolwiek chcesz..."
                                />
                            </Field>

                            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
                                Wyślij życzenia
                            </Button>
                        </form>
                    </div>
                </Section>
            </div>
        </Layout>
    );
}
