import { cn } from '../utils/cn';

interface HeroSectionProps {
    names: {
        first: string;
        second: string;
    };
    date: string;
    location: string;
    backgroundImage?: string;
}

export default function HeroSection({
    names,
    date,
    location,
    backgroundImage,
}: HeroSectionProps) {
    const backgroundStyle = backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined;

    return (
        <section className="hero-shell">
            {/* Background Image/Gradient */}
            <div className={cn('hero-backdrop', !backgroundImage && 'hero-backdrop-default')}
                style={backgroundStyle}>
            </div>

            {/* Content */}
            <div className="relative z-10 flex h-full items-center justify-center px-4">
                <div className="animate-scaleIn text-center">
                    {/* Names */}
                    <h1 className="hero-name">
                        {names.first}
                        <span className="hero-name-joiner">
                            {' '}
                            oraz{' '}
                        </span>
                        {names.second}
                    </h1>

                    {/* Divider */}
                    <div className="hero-divider" />

                    {/* Date */}
                    <p className="hero-meta">
                        {date}
                    </p>

                    {/* Location */}
                    <div className="hero-location">
                        <svg className={cn('h-5 w-5 text-gold sm:h-6 sm:w-6')}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                            <path strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        <span className="font-sans tracking-wide">{location}</span>
                    </div>

                    {/* Scroll indicator */}
                    <div className="mt-16 animate-bounce">
                        <svg className="mx-auto h-6 w-6 text-ink/50"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
                        </svg>
                    </div>
                </div>
            </div>
        </section>
    );
}
