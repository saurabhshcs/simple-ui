import { clsx } from 'clsx';

interface Props { size?: 'sm' | 'md' | 'lg'; className?: string; }

export function Spinner({ size = 'md', className }: Props) {
  return (
    <div className={clsx(
      'animate-spin rounded-full border-2 border-border-color border-t-accent',
      size === 'sm' && 'w-4 h-4',
      size === 'md' && 'w-6 h-6',
      size === 'lg' && 'w-10 h-10',
      className,
    )} />
  );
}
