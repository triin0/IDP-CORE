import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

const Card = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <motion.div
    whileHover={{ y: -2 }}
    className={cn(
      'rounded-xl border bg-slate-800/50 p-6 backdrop-blur-lg',
      'border-[var(--glass-border)] transition-colors hover:border-slate-700',
      className
    )} {...(props as any)}
  >
    {children}
  </motion.div>
);

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 pb-4', className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-lg font-semibold leading-none tracking-tight text-slate-100', className)} {...props} />
);

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-slate-400', className)} {...props} />
);

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('text-sm text-slate-300', className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
