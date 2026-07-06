import { Link } from 'react-router-dom';
import { appText } from '../content/appText';
import { cn } from '../utils/cn';

interface AdminBackLinkProps {
    to?: string;
    label?: string;
    shortLabel?: string;
    className?: string;
}

export default function AdminBackLink({
    to = '/admin/dashboard',
    label = appText.components.adminBackLink.label,
    shortLabel = appText.components.adminBackLink.shortLabel,
    className,
}: AdminBackLinkProps) {
    return (
        <Link to={to} className={cn('admin-back-link', className)} aria-label={label} title={label}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                <path
                    d="M15 18l-6-6 6-6"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                />
                <path
                    d="M9 12h11"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                />
            </svg>
            <span>{shortLabel}</span>
        </Link>
    );
}
