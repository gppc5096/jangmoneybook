import { cn } from '@/lib/utils';

export function CategoryBadge({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white',
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}
