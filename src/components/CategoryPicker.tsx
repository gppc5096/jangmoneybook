'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Category, TransactionType } from '@/types';

export function CategoryPicker({
  categories,
  type,
  categoryId,
  subCategoryId,
  onCategoryChange,
  onSubCategoryChange,
}: {
  categories: Category[];
  type: TransactionType;
  categoryId: string | null;
  subCategoryId: string | null;
  onCategoryChange: (categoryId: string) => void;
  onSubCategoryChange: (subCategoryId: string | null) => void;
}) {
  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type],
  );

  const selectedCategory = useMemo(
    () => visibleCategories.find((c) => c.id === categoryId) ?? null,
    [visibleCategories, categoryId],
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-sm font-medium">대분류</p>
        {visibleCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            사용할 수 있는 분류가 없습니다. 설정에서 분류를 추가해 주세요.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {visibleCategories.map((category) => {
              const active = category.id === categoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onCategoryChange(category.id)}
                  className={cn(
                    'flex min-h-12 items-center justify-center rounded-md border px-2 py-2 text-center text-sm font-medium transition-colors',
                    active ? 'border-transparent text-white' : 'border-input',
                  )}
                  style={active ? { backgroundColor: category.color } : undefined}
                >
                  {!active && (
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                  )}
                  {category.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedCategory && selectedCategory.subCategories.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">소분류</p>
          <div className="flex flex-wrap gap-2">
            {selectedCategory.subCategories.map((sub) => {
              const active = sub.id === subCategoryId;
              return (
                <button
                  key={sub.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSubCategoryChange(active ? null : sub.id)}
                  className={cn(
                    'min-h-11 rounded-full border px-4 text-sm transition-colors',
                    active ? 'border-transparent text-white' : 'border-input text-foreground',
                  )}
                  style={active ? { backgroundColor: selectedCategory.color } : undefined}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
