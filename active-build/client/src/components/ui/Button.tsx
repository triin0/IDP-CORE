import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { ComponentProps, ReactNode } from 'react';

interface ButtonProps extends ComponentProps<typeof motion.button> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}

export function Button({ children, variant = 'primary', className, ...props }: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 ease-in-out';

  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-500 shadow-[0_0_16px_var(--glow-indigo)] hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]',
    secondary: 'bg-transparent border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white focus:ring-slate-500',
    danger: 'bg-red-600/10 text-red-400 border border-red-500/20 hover:bg-red-600/20 focus:ring-red-500',
  };

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      className={cn(baseClasses, variantClasses[variant], className)} {...(props as any)}
    >
      {children}
    </motion.button>
  );
}
