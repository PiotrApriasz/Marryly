import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label: ReactNode;
}

export default function Checkbox({
    label,
    className,
    ...props
}: CheckboxProps) {
    return (
        <label className={cn('checkbox-field', className)}>
            <input type="checkbox" className="checkbox-control" {...props} />
            <span className="checkbox-label">{label}</span>
        </label>
    );
}
