'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { CategoryBadge } from '@/components/CategoryBadge';
import { CategoryPicker } from '@/components/CategoryPicker';
import { DataStatus } from '@/components/DataStatus';
import { useAppStore } from '@/lib/store';
import {
  categoryLabel,
  currentMonthKey,
  formatAmount,
  formatSigned,
  monthKey,
  monthLabel,
  shiftMonth,
  subCategoryName,
  summarize,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Transaction, TransactionType } from '@/types';

type TypeFilter = 'all' | TransactionType;

interface EditDraft {
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

export default function RecordsPage() {
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);

  const [month, setMonth] = useState(currentMonthKey);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => Number(currentMonthKey().slice(0, 4)));
  const [yearSelectOpen, setYearSelectOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openMonthPicker() {
    setPickerYear(Number(month.slice(0, 4)));
    setYearSelectOpen(false);
    setPickerOpen(true);
  }

  const yearOptions = useMemo(() => {
    const years = transactions.map((t) => Number(monthKey(t.date).slice(0, 4)));
    years.push(Number(currentMonthKey().slice(0, 4)), pickerYear);
    const min = Math.min(...years);
    const max = Math.max(...years);
    const list: number[] = [];
    for (let y = max; y >= min; y--) list.push(y);
    return list;
  }, [transactions, pickerYear]);

  const monthTransactions = useMemo(
    () => transactions.filter((t) => monthKey(t.date) === month),
    [transactions, month],
  );

  const summary = useMemo(() => summarize(monthTransactions), [monthTransactions]);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return monthTransactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
      if (q && !`${t.itemName ?? ''} ${t.note ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [monthTransactions, keyword, typeFilter, categoryFilter]);

  const deleteTarget = useMemo(
    () => transactions.find((t) => t.id === deleteTargetId) ?? null,
    [transactions, deleteTargetId],
  );

  function handleDelete(id: string) {
    setDeleteTargetId(id);
  }

  async function confirmDelete() {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await deleteTransaction(deleteTargetId);
      setDeleteTargetId(null);
    } finally {
      setDeleting(false);
    }
  }

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
    setDraft((prev) => (prev ? { ...prev, amountText: digits ? formatAmount(Number(digits)) : '' } : prev));
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">기록</h1>

      <DataStatus />

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label="이전 달"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <button
          type="button"
          onClick={openMonthPicker}
          className="h-11 flex-1 rounded-full border border-input text-base font-semibold transition-colors hover:bg-accent"
        >
          {monthLabel(month)}
        </button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label="다음 달"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent variant="center" className="gap-4">
          <DialogTitle>년/월 선택</DialogTitle>
          <DialogDescription className="sr-only">
            조회할 연도와 월을 선택합니다.
          </DialogDescription>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="이전 연도"
              onClick={() => setPickerYear((y) => y - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <button
              type="button"
              onClick={() => setYearSelectOpen((v) => !v)}
              aria-pressed={yearSelectOpen}
              className="rounded-md px-2 text-lg font-semibold underline decoration-dotted underline-offset-4"
            >
              {pickerYear}년
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="다음 연도"
              onClick={() => setPickerYear((y) => y + 1)}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>

          {yearSelectOpen ? (
            <select
              aria-label="연도 선택"
              value={pickerYear}
              onChange={(e) => {
                setPickerYear(Number(e.target.value));
                setYearSelectOpen(false);
              }}
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          ) : (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 12 }, (_, i) => {
              const key = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
              const active = key === month;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setMonth(key);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    'h-12 rounded-md border text-sm font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input',
                  )}
                >
                  {i + 1}월
                </button>
              );
            })}
          </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <DialogContent variant="center" className="gap-4">
          <DialogTitle>거래 삭제</DialogTitle>
          <DialogDescription>
            {deleteTarget
              ? `"${deleteTarget.itemName || categoryLabel(categories, deleteTarget.categoryId).name}" (${formatSigned(deleteTarget.type, deleteTarget.amount)}) 거래를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`
              : '이 거래를 삭제할까요? 이 작업은 되돌릴 수 없습니다.'}
          </DialogDescription>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              disabled={deleting}
              onClick={() => setDeleteTargetId(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 flex-1"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? '삭제하는 중…' : '삭제'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="sticky top-0 z-10">
        <CardContent className="grid grid-cols-3 gap-2 p-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">수입</p>
            <p className="text-base font-semibold tabular-nums text-blue-600">
              {formatAmount(summary.income)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">지출</p>
            <p className="text-base font-semibold tabular-nums text-red-600">
              {formatAmount(summary.expense)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">잔액</p>
            <p className="text-base font-semibold tabular-nums">
              {formatAmount(summary.balance)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="항목명 검색"
          aria-label="항목명 검색"
          className="h-11"
        />
        <div className="flex gap-2">
          {(['all', 'income', 'expense'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={typeFilter === value}
              onClick={() => setTypeFilter(value)}
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
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="분류 필터"
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">모든 분류</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          조건에 맞는 거래가 없습니다.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {visible.map((tx) => {
            const label = categoryLabel(categories, tx.categoryId);
            const sub = subCategoryName(categories, tx.categoryId, tx.subCategoryId);

            if (editingId === tx.id && draft) {
              return (
                <li key={tx.id} className="space-y-3 bg-accent/40 p-3">
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="수입 지출 구분">
                    {(['income', 'expense'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={draft.type === value}
                        onClick={() => handleDraftTypeChange(value)}
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
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, date: e.target.value } : prev))}
                    className="h-12 text-base"
                  />

                  <div className="relative">
                    <Input
                      inputMode="numeric"
                      aria-label="금액"
                      placeholder="0"
                      value={draft.amountText}
                      onChange={(e) => handleDraftAmountChange(e.target.value)}
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
                    onCategoryChange={(id) =>
                      setDraft((prev) => (prev ? { ...prev, categoryId: id, subCategoryId: null } : prev))
                    }
                    onSubCategoryChange={(id) =>
                      setDraft((prev) => (prev ? { ...prev, subCategoryId: id } : prev))
                    }
                  />

                  <Input
                    aria-label="구입 항목명"
                    placeholder="구입 항목명"
                    value={draft.itemName}
                    maxLength={50}
                    onChange={(e) =>
                      setDraft((prev) => (prev ? { ...prev, itemName: e.target.value } : prev))
                    }
                    className="h-12 text-base"
                  />

                  <Input
                    aria-label="비고"
                    placeholder="비고"
                    value={draft.note}
                    maxLength={50}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
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
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      <X className="size-4" aria-hidden />
                      취소
                    </Button>
                    <Button
                      type="button"
                      className="h-12 flex-1"
                      onClick={handleSaveEdit}
                      disabled={saving}
                    >
                      <Check className="size-4" aria-hidden />
                      {saving ? '저장 중…' : '저장'}
                    </Button>
                  </div>
                </li>
              );
            }

            return (
              <li key={tx.id} className="flex items-center gap-3 p-3">
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {tx.date}
                </span>
                <CategoryBadge name={label.name} color={label.color} />
                {sub && (
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {sub}
                  </span>
                )}
                <p className="min-w-0 flex-1 truncate text-sm">{tx.itemName}</p>
                <p
                  className={cn(
                    'shrink-0 text-base font-semibold tabular-nums',
                    tx.type === 'income' ? 'text-blue-600' : 'text-red-600',
                  )}
                >
                  {formatSigned(tx.type, tx.amount)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="거래 수정"
                  className="size-12 shrink-0 text-muted-foreground"
                  onClick={() => startEdit(tx)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="거래 삭제"
                  className="size-12 shrink-0 text-muted-foreground"
                  onClick={() => handleDelete(tx.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
