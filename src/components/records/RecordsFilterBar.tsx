'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { TypeFilter } from '@/hooks/useRecordsFilters';
import type { Category } from '@/types';

export function RecordsFilterBar({
  typeFilter,
  onTypeFilterChange,
  keyword,
  onKeywordChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
}: {
  typeFilter: TypeFilter;
  onTypeFilterChange: (value: TypeFilter) => void;
  keyword: string;
  onKeywordChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: Category[];
}) {
  return (
    <>
      <div className="flex gap-2">
        {(['all', 'income', 'expense'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={typeFilter === value}
            onClick={() => onTypeFilterChange(value)}
            className={cn(
              'h-11 flex-1 rounded-md border text-sm font-medium transition-colors',
              typeFilter === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input',
            )}
          >
            {value === 'all' ? '전체' : value === 'income' ? '수입' : '지출'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="항목명 검색"
          aria-label="항목명 검색"
          className="h-11"
        />
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          aria-label="분류 검색"
          className={cn(
            'h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm',
            categoryFilter === 'all' ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          <option value="all">모든 분류 검색</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
