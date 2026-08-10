'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoryBadge } from '@/components/CategoryBadge';
import { categoryLabel, formatSigned, subCategoryName } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Category, Transaction } from '@/types';

export function TransactionRow({
  tx,
  categories,
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  categories: Category[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  const label = categoryLabel(categories, tx.categoryId);
  const sub = subCategoryName(categories, tx.categoryId, tx.subCategoryId);
  const itemName = tx.itemName?.trim() || null;

  return (
    <li className="flex items-center gap-3 p-3">
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{tx.date}</span>
      <CategoryBadge name={label.name} color={label.color} />
      {sub && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{sub}</span>
      )}

      {/* PC/Tablet: 구입 항목명 열 */}
      <p className="hidden min-w-0 flex-1 truncate text-sm sm:block">{itemName}</p>

      {/* 모바일: 금액 위에 항목명 툴팁 / PC·Tablet: 금액만 */}
      <div className="ml-auto flex min-w-0 shrink-0 flex-col items-end sm:ml-0">
        {itemName && (
          <span
            className="mb-0.5 max-w-[9.5rem] truncate rounded-md bg-foreground px-2 py-0.5 text-xs font-normal text-background shadow-md sm:hidden"
            title={itemName}
          >
            {itemName}
          </span>
        )}
        <p
          className={cn(
            'text-base font-semibold tabular-nums',
            tx.type === 'income' ? 'text-blue-600' : 'text-red-600',
          )}
        >
          {formatSigned(tx.type, tx.amount)}
        </p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="거래 수정"
        className="size-12 shrink-0 text-muted-foreground"
        onClick={() => onEdit(tx)}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="거래 삭제"
        className="size-12 shrink-0 text-muted-foreground"
        onClick={() => onDelete(tx.id)}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </li>
  );
}
