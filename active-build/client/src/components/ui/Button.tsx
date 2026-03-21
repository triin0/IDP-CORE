import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary:
        'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-indigo-500 shadow-[0_0_16px_var(--glow-indigo)]',
      secondary:
        'bg-transparent border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white focus-visible:ring-slate-500',
      danger:
        'bg-red-600/10 text-red-400 border border-red-500/20 hover:bg-red-600/20 focus-visible:ring-red-500',
    };

    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.1 }}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
          'disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          className
        )}
        ref={ref} {...(props as any)}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
