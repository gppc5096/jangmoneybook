'use client';

import { TransactionEditRow } from '@/components/records/TransactionEditRow';
import { TransactionRow } from '@/components/records/TransactionRow';
import type { EditDraft } from '@/hooks/useTransactionEdit';
import type { Category, Transaction, TransactionType } from '@/types';

export function TransactionList({
  transactions,
  categories,
  editingId,
  draft,
  editError,
  saving,
  onStartEdit,
  onDelete,
  onTypeChange,
  onDateChange,
  onAmountChange,
  onCategoryChange,
  onSubCategoryChange,
  onItemNameChange,
  onNoteChange,
  onCancelEdit,
  onSaveEdit,
}: {
  transactions: Transaction[];
  categories: Category[];
  editingId: string | null;
  draft: EditDraft | null;
  editError: string | null;
  saving: boolean;
  onStartEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onTypeChange: (type: TransactionType) => void;
  onDateChange: (date: string) => void;
  onAmountChange: (raw: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onSubCategoryChange: (subCategoryId: string | null) => void;
  onItemNameChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
}) {
  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        조건에 맞는 거래가 없습니다.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-xl border">
      {transactions.map((tx) => {
        if (editingId === tx.id && draft) {
          return (
            <TransactionEditRow
              key={tx.id}
              draft={draft}
              categories={categories}
              editError={editError}
              saving={saving}
              onTypeChange={onTypeChange}
              onDateChange={onDateChange}
              onAmountChange={onAmountChange}
              onCategoryChange={onCategoryChange}
              onSubCategoryChange={onSubCategoryChange}
              onItemNameChange={onItemNameChange}
              onNoteChange={onNoteChange}
              onCancel={onCancelEdit}
              onSave={onSaveEdit}
            />
          );
        }

        return (
          <TransactionRow
            key={tx.id}
            tx={tx}
            categories={categories}
            onEdit={onStartEdit}
            onDelete={onDelete}
          />
        );
      })}
    </ul>
  );
}
