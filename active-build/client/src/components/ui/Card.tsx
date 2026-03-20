import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        'bg-slate-800/50 backdrop-blur-lg border border-slate-700/50 rounded-xl p-6 transition-colors duration-300 hover:border-slate-600',
        className
      )}
    >
      {children}
    </motion.div>
  );
}
