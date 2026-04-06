import type { InputHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    surface?: 'white' | 'muted';
}

export default function Input({
    className,
    surface = 'white',
    ...props
}: InputProps) {
    return (
        <input
            className={cn('field-control', surface === 'muted' && 'field-control-muted', className)}
            {...props}
        />
    );
}
