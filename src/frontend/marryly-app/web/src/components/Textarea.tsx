import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    surface?: 'white' | 'muted';
}

export default function Textarea({
    className,
    surface = 'white',
    ...props
}: TextareaProps) {
    return (
        <textarea
            className={cn('field-control', surface === 'muted' && 'field-control-muted', className)}
            {...props}
        />
    );
}
