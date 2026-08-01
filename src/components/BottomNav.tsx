'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListOrdered, PieChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTENT_WIDTH_CLASS } from '@/lib/layout';

const TABS = [
  { href: '/', label: '홈', Icon: Home },
  { href: '/records', label: '기록', Icon: ListOrdered },
  { href: '/stats', label: '통계', Icon: PieChart },
  { href: '/settings', label: '설정', Icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <ul className={`flex ${CONTENT_WIDTH_CLASS}`}>
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 text-xs transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
