import Layout from '../components/Layout';
import Section from '../components/Section';
import Button from '../components/Button';

export default function AdminLoginPage() {
    return (
        <Layout showNavigation={false}>
            <div className="flex min-h-full items-center justify-center">
                <div className="w-full max-w-md px-4">
                <Section background="white">
                    <div className="text-center">
                        <h1 className="font-script text-4xl text-ink md:text-5xl">
                            Panel Admina
                        </h1>
                        <div className="mx-auto mt-6 h-[1px] w-24 bg-gold" />
                    </div>

                    <form className="mt-8 space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-left font-sans text-sm font-medium text-ink">
                                Email
                            </label>
                            <input type="email"
                                id="email"
                                className="mt-2 w-full rounded-lg border border-sand bg-white px-4 py-3 font-sans text-ink transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                                placeholder="admin@marryly.pl"/>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-left font-sans text-sm font-medium text-ink">
                                Hasło
                            </label>
                            <input type="password"
                                id="password"
                                className="mt-2 w-full rounded-lg border border-sand bg-white px-4 py-3 font-sans text-ink transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                                placeholder="••••••••"/>
                        </div>

                        <Button type="submit" variant="primary" size="lg" className="w-full">
                            Zaloguj się
                        </Button>
                    </form>
                </Section>
                </div>
            </div>
        </Layout>
    );
}