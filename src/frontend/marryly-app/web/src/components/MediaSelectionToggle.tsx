import { appText } from '../content/appText';

interface MediaSelectionToggleProps {
    selected: boolean;
    onToggle: () => void;
    disabled?: boolean;
    className?: string;
}

export default function MediaSelectionToggle({ selected, onToggle, disabled, className = '' }: MediaSelectionToggleProps) {
    const label = selected ? appText.components.galleryGrid.deselectMedia : appText.components.galleryGrid.selectMedia;
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={label}
            title={label}
            disabled={disabled}
            className={`media-selection-toggle ${selected ? 'media-selection-toggle-checked' : ''} ${className}`}
            onClick={(event) => {
                event.stopPropagation();
                onToggle();
            }}
        >
            {selected ? (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                </svg>
            ) : null}
        </button>
    );
}
