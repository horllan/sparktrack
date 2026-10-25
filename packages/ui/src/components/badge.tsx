import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-spark-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-spark-600 text-white',
        secondary: 'border-transparent bg-slate-100 text-slate-900',
        destructive: 'border-transparent bg-red-500 text-white',
        outline: 'text-foreground',
        beginner: 'border-transparent bg-slate-200 text-slate-700',
        developing: 'border-transparent bg-sky-100 text-sky-900',
        competent: 'border-transparent bg-emerald-100 text-emerald-900',
        advanced: 'border-transparent bg-violet-100 text-violet-900',
        success: 'border-transparent bg-emerald-100 text-emerald-900',
        warning: 'border-transparent bg-amber-100 text-amber-950',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
