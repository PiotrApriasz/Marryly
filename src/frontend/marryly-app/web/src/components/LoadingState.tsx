import LoadingSpinner from './LoadingSpinner';
import { cn } from '../utils/cn';

interface LoadingStateProps {
    fullscreen?: boolean;
    className?: string;
    spinnerClassName?: string;
}

export default function LoadingState({
    fullscreen = false,
    className,
    spinnerClassName,
}: LoadingStateProps) {
    return (
        <div
            className={cn(
                'flex items-center justify-center px-4',
                fullscreen ? 'min-h-screen' : 'min-h-[12rem]',
                className
            )}
            aria-busy="true"
            aria-live="polite"
        >
            <LoadingSpinner
                size={fullscreen ? 'lg' : 'md'}
                className={cn('text-gold', spinnerClassName)}
            />
        </div>
    );
}
