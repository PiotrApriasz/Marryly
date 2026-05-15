import type { ReactNode } from 'react';

interface HelpTooltipProps {
    content: ReactNode;
    label?: string;
}

export default function HelpTooltip({
    content,
    label = 'Opis strony',
}: HelpTooltipProps) {
    return (
        <span className="help-tooltip">
            <button type="button" className="help-tooltip-trigger" aria-label={label}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                    <path
                        d="M12 17v-5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                    />
                    <path
                        d="M12 8h.01"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                    />
                    <circle
                        cx="12"
                        cy="12"
                        r="9"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                    />
                </svg>
            </button>
            <span className="help-tooltip-content" role="tooltip">
                {content}
            </span>
        </span>
    );
}
