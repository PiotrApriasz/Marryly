import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../auth/AdminAuthContext';
import Button from './Button';

interface NavLink {
    label: string;
    path: string;
}

const navLinks: NavLink[] = [
    { label: 'Menu wesela', path: '/menu' },
    { label: 'Atrakcje', path: '/attractions' },
    { label: 'Wydarzenia', path: '/events' },
    { label: 'Aktualne zdjęcia', path: '/current' },
    { label: 'Dodaj zdjęcie/film', path: '/guestupload' },
    { label: 'Album', path: '/gallery' },
    { label: 'Księga gości', path: '/guestbook' },
];

export default function Navigation() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, user, logout } = useAdminAuth();
    const isMainPage = location.pathname === '/';
    const isAdminArea = location.pathname.startsWith('/admin');
    const showAdminSessionControls = isAdminArea && isAuthenticated;
    const adminDisplayName = user?.displayName?.trim() || 'Państwo Młodzi';

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLinkClick = () => {
        setIsMobileMenuOpen(false);
    };

    const handleAdminLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Failed to logout admin session', error);
        } finally {
            setIsMobileMenuOpen(false);
            navigate('/admin', { replace: true });
        }
    };

    const adminLinkClassName = `
        group flex h-10 w-10 items-center justify-center rounded-full border border-gold bg-gold text-white
        shadow-sm transition-all duration-300 hover:scale-105 hover:bg-gold/90
    `;

    return (
        <nav
            className={`
                fixed top-0 z-50 w-full transition-all duration-300
                ${
                    isScrolled
                        ? 'bg-white/95 shadow-md backdrop-blur-sm'
                        : 'bg-transparent'
                }
            `}
        >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between md:h-20">
                    {/* Logo / Initials */}
                    <Link to="/"
                        onClick={handleLinkClick}
                        className="group flex items-center gap-2 transition-transform duration-300 hover:scale-105">
                        <div className="flex items-center">
                            <span className="font-script text-3xl text-ink transition-colors duration-300 group-hover:text-gold md:text-4xl">
                                A
                            </span>
                            <span className="mx-2 font-serif text-2xl text-muted md:text-3xl">
                                &
                            </span>
                            <span className="font-script text-3xl text-ink transition-colors duration-300 group-hover:text-gold md:text-4xl">
                                P
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden items-center gap-2 lg:flex">
                        {!showAdminSessionControls && navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`
                                    group relative px-4 py-2 font-sans text-base font-medium transition-all duration-300
                                    hover:scale-110
                                    ${
                                        location.pathname === link.path
                                            ? 'text-gold'
                                            : 'text-ink hover:text-gold'
                                    }
                                `}
                            >
                                <span className="relative z-10">{link.label}</span>
                                <span
                                    className={`
                                        absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 bg-gold transition-all duration-300
                                        group-hover:w-3/4
                                        ${location.pathname === link.path ? 'w-3/4' : ''}
                                    `}
                                />
                            </Link>
                        ))}

                        {isMainPage && !showAdminSessionControls && (
                            <Link
                                to="/admin"
                                onClick={handleLinkClick}
                                aria-label="Panel Młodej Pary"
                                title="Panel Młodej Pary"
                                className={`${adminLinkClassName} ml-4`}
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <circle cx="8.5" cy="13.5" r="4.5" />
                                    <circle cx="15.5" cy="13.5" r="4.5" />
                                    <path strokeLinecap="round" d="M11 13.5h2" />
                                    <path strokeLinecap="round" d="M18.5 7.5l1 1 2-2" />
                                </svg>
                            </Link>
                        )}

                        {showAdminSessionControls && (
                            <div className="ml-4 flex items-center gap-3">
                                <span className="font-sans text-base font-medium text-ink transition-colors duration-300 hover:text-gold">
                                    {adminDisplayName}
                                </span>
                                <Button type="button" variant="secondary" size="sm" onClick={handleAdminLogout}>
                                    Wyloguj się
                                </Button>
                            </div>
                        )}
                    </div>

                    {!showAdminSessionControls && (
                        <div className="flex items-center gap-2 lg:hidden">
                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="group p-2 text-ink transition-colors duration-300 hover:text-gold"
                                aria-label="Toggle menu"
                            >
                                <div className="flex h-6 w-6 flex-col justify-center gap-1.5">
                                    <span
                                        className={`
                                            h-0.5 w-full bg-current transition-all duration-300
                                            ${isMobileMenuOpen ? 'translate-y-2 rotate-45' : ''}
                                        `}
                                    />
                                    <span
                                        className={`
                                            h-0.5 w-full bg-current transition-all duration-300
                                            ${isMobileMenuOpen ? 'opacity-0' : ''}
                                        `}
                                    />
                                    <span
                                        className={`
                                            h-0.5 w-full bg-current transition-all duration-300
                                            ${isMobileMenuOpen ? '-translate-y-2 -rotate-45' : ''}
                                        `}
                                    />
                                </div>
                            </button>

                            {isMainPage && (
                                <Link
                                    to="/admin"
                                    onClick={handleLinkClick}
                                    aria-label="Panel Młodej Pary"
                                    title="Panel Młodej Pary"
                                    className={`${adminLinkClassName} ml-1`}
                                >
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                        <circle cx="8.5" cy="13.5" r="4.5" />
                                        <circle cx="15.5" cy="13.5" r="4.5" />
                                        <path strokeLinecap="round" d="M11 13.5h2" />
                                        <path strokeLinecap="round" d="M18.5 7.5l1 1 2-2" />
                                    </svg>
                                </Link>
                            )}
                        </div>
                    )}

                    {showAdminSessionControls && (
                        <div className="flex items-center gap-3 lg:hidden">
                            <span className="font-sans text-base font-medium text-ink">
                                {adminDisplayName}
                            </span>
                            <Button type="button" variant="secondary" size="sm" onClick={handleAdminLogout}>
                                Wyloguj
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Menu */}
            <div
                className={`
                    overflow-hidden transition-all duration-300 lg:hidden
                    ${isMobileMenuOpen ? 'max-h-screen' : 'max-h-0'}
                `}
            >
                <div className="border-t border-sand bg-white/95 px-4 py-4 backdrop-blur-sm">
                    {navLinks.map((link, index) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            onClick={handleLinkClick}
                            className={`
                                block animate-slideDown px-4 py-3 font-sans text-base transition-colors duration-300
                                ${
                                    location.pathname === link.path
                                        ? 'text-gold'
                                        : 'text-ink hover:text-gold'
                                }
                            `}
                            style={{
                                animationDelay: `${index * 50}ms`,
                            }}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}
