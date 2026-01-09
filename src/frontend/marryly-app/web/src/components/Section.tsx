import {type ReactNode, useEffect, useRef, useState } from 'react';

type SectionBackground = 'white' | 'paper' | 'transparent';

interface SectionProps {
    children: ReactNode;
    background?: SectionBackground;
    className?: string;
    animate?: boolean;
}

const backgroundStyles: Record<SectionBackground, string> = {
    white: 'bg-white',
    paper: 'bg-paper',
    transparent: 'bg-transparent',
};

export default function Section({
    children,
    background = 'transparent',
    className = '',
    animate = true,
}: SectionProps) {
    const [isVisible, setIsVisible] = useState(!animate);
    const sectionRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!animate) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.1 }
        );

        const currentRef = sectionRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [animate]);

    return (
        <section
            ref={sectionRef}
            className={`
                w-full px-4 py-12 md:py-16 lg:py-20
                ${backgroundStyles[background]}
                ${isVisible ? 'animate-fadeIn' : 'opacity-0'}
                ${className}
            `}
        >
            <div className="mx-auto max-w-7xl">
                {children}
            </div>
        </section>
    );
}
