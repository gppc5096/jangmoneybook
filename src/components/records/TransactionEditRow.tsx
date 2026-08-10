'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CategoryPicker } from '@/components/CategoryPicker';
import { cn } from '@/lib/utils';
import type { EditDraft } from '@/hooks/useTransactionEdit';
import type { Category, TransactionType } from '@/types';

export function TransactionEditRow({
  draft,
  categories,
  editError,
  saving,
  onTypeChange,
  onDateChange,
  onAmountChange,
  onCategoryChange,
  onSubCategoryChange,
  onItemNameChange,
  onNoteChange,
  onCancel,
  onSave,
}: {
  draft: EditDraft;
  categories: Category[];
  editError: string | null;
  saving: boolean;
  onTypeChange: (type: TransactionType) => void;
  onDateChange: (date: string) => void;
  onAmountChange: (raw: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onSubCategoryChange: (subCategoryId: string | null) => void;
  onItemNameChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <li className="space-y-3 bg-accent/40 p-3">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="수입 지출 구분">
        {(['income', 'expense'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={draft.type === value}
            onClick={() => onTypeChange(value)}
            className={cn(
              'h-12 rounded-md border text-sm font-semibold transition-colors',
              draft.type === value
                ? value === 'income'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-red-600 bg-red-600 text-white'
                : 'border-input',
            )}
          >
            {value === 'income' ? '수입' : '지출'}
          </button>
        ))}
      </div>

      <Input
        type="date"
        aria-label="거래 날짜"
        value={draft.date}
        onChange={(e) => onDateChange(e.target.value)}
        className="h-12 text-base"
      />

      <div className="relative">
        <Input
          inputMode="numeric"
          aria-label="금액"
          placeholder="0"
          value={draft.amountText}
          onChange={(e) => onAmountChange(e.target.value)}
          className="h-12 pr-10 text-right text-lg font-semibold tabular-nums"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          원
        </span>
      </div>

      <CategoryPicker
        categories={categories}
        type={draft.type}
        categoryId={draft.categoryId || null}
        subCategoryId={draft.subCategoryId}
        onCategoryChange={onCategoryChange}
        onSubCategoryChange={onSubCategoryChange}
      />

      <Input
        aria-label="구입 항목명"
        placeholder="구입 항목명"
        value={draft.itemName}
        maxLength={50}
        onChange={(e) => onItemNameChange(e.target.value)}
        className="h-12 text-base"
      />

      <Input
        aria-label="비고"
        placeholder="비고"
        value={draft.note}
        maxLength={50}
        onChange={(e) => onNoteChange(e.target.value)}
        className="h-12 text-base"
      />

      {editError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {editError}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 flex-1"
          onClick={onCancel}
          disabled={saving}
        >
          <X className="size-4" aria-hidden />
          취소
        </Button>
        <Button type="button" className="h-12 flex-1" onClick={onSave} disabled={saving}>
          <Check className="size-4" aria-hidden />
          {saving ? '저장 중…' : '저장'}
        </Button>
      </div>
    </li>
  );
}
