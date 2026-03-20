import { cn } from '../../lib/utils';
import type { ComponentProps } from 'react';

interface InputProps extends ComponentProps<'input'> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all',
        className
      )}
      {...props}
    />
  );
}

interface SelectProps extends ComponentProps<'select'> {}

export function Select({ className, children, ...props }: SelectProps) {
    return (
        <select
            className={cn(
                'w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all',
                className
            )}
            {...props}
        >
            {children}
        </select>
    );
}
