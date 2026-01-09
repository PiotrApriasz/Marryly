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
    const backgroundStyle = backgroundImage
        ? { backgroundImage: `url(${backgroundImage})` }
        : {
              background: 'linear-gradient(135deg, #F5EFE6 0%, #E9E4DC 50%, #F5EFE6 100%)',
          };

    return (
        <section className="relative h-[85vh] min-h-[600px] w-full overflow-hidden">
            {/* Background Image/Gradient */}
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 blur-[2px] scale-100"
                style={backgroundStyle}>
            </div>

            {/* Content */}
            <div className="relative z-10 flex h-full items-center justify-center px-4">
                <div className="animate-scaleIn text-center">
                    {/* Names */}
                    <h1 className="font-script text-6xl tracking-tight text-ink sm:text-7xl md:text-8xl lg:text-9xl">
                        {names.first}
                        <span className="mx-3 text-5xl font-light text-ink/70 sm:mx-4 sm:text-6xl md:mx-6 md:text-7xl lg:text-8xl">
                            {' '}
                            oraz{' '}
                        </span>
                        {names.second}
                    </h1>

                    {/* Divider */}
                    <div className="mx-auto mt-8 h-[2px] w-64 bg-gold md:w-96" />

                    {/* Date */}
                    <p className="mt-8 font-serif text-xl tracking-wide text-ink sm:text-2xl md:text-3xl">
                        {date}
                    </p>

                    {/* Location */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-lg text-ink sm:text-xl">
                        <svg className="h-5 w-5 text-gold sm:h-6 sm:w-6"
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
