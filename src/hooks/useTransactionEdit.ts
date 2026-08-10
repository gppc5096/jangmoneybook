'use client';

import { useState } from 'react';
import { formatAmount } from '@/lib/format';
import type { Category, Transaction, TransactionInput, TransactionType } from '@/types';

export interface EditDraft {
  date: string;
  type: TransactionType;
  categoryId: string;
  subCategoryId: string | null;
  amountText: string;
  itemName: string;
  note: string;
}

function toDraft(tx: Transaction): EditDraft {
  return {
    date: tx.date,
    type: tx.type,
    categoryId: tx.categoryId,
    subCategoryId: tx.subCategoryId,
    amountText: formatAmount(tx.amount),
    itemName: tx.itemName ?? '',
    note: tx.note ?? '',
  };
}

export function useTransactionEdit(
  categories: Category[],
  updateTransaction: (id: string, patch: Partial<TransactionInput>) => Promise<void>,
) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit(tx: Transaction) {
    setEditingId(tx.id);
    setDraft(toDraft(tx));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setEditError(null);
  }

  function handleDraftAmountChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 12);
    setDraft((prev) =>
      prev ? { ...prev, amountText: digits ? formatAmount(Number(digits)) : '' } : prev,
    );
  }

  function handleDraftTypeChange(next: TransactionType) {
    setDraft((prev) => {
      if (!prev) return prev;
      const stillValid = categories.some((c) => c.type === next && c.id === prev.categoryId);
      return {
        ...prev,
        type: next,
        categoryId: stillValid ? prev.categoryId : '',
        subCategoryId: stillValid ? prev.subCategoryId : null,
      };
    });
  }

  function setDraftDate(date: string) {
    setDraft((prev) => (prev ? { ...prev, date } : prev));
  }

  function setDraftCategoryId(categoryId: string) {
    setDraft((prev) => (prev ? { ...prev, categoryId, subCategoryId: null } : prev));
  }

  function setDraftSubCategoryId(subCategoryId: string | null) {
    setDraft((prev) => (prev ? { ...prev, subCategoryId } : prev));
  }

  function setDraftItemName(itemName: string) {
    setDraft((prev) => (prev ? { ...prev, itemName } : prev));
  }

  function setDraftNote(note: string) {
    setDraft((prev) => (prev ? { ...prev, note } : prev));
  }

  async function handleSaveEdit() {
    if (!editingId || !draft) return;
    const amount = Number(draft.amountText.replace(/\D/g, '')) || 0;

    if (!draft.categoryId) {
      setEditError('대분류를 선택해 주세요.');
      return;
    }
    if (amount <= 0) {
      setEditError('금액을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      await updateTransaction(editingId, {
        date: draft.date,
        type: draft.type,
        categoryId: draft.categoryId,
        subCategoryId: draft.subCategoryId,
        amount,
        itemName: draft.itemName.trim() || null,
        note: draft.note.trim() || null,
      });
      cancelEdit();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return {
    editingId,
    draft,
    editError,
    saving,
    startEdit,
    cancelEdit,
    handleDraftAmountChange,
    handleDraftTypeChange,
    setDraftDate,
    setDraftCategoryId,
    setDraftSubCategoryId,
    setDraftItemName,
    setDraftNote,
    handleSaveEdit,
  };
}
