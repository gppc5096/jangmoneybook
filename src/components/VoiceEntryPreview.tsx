'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CategoryPicker } from '@/components/CategoryPicker';
import { useAppStore } from '@/lib/store';
import { createSuggestedCategory, type CategorySuggestion } from '@/lib/categorySuggestion';
import { formatAmount } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TransactionType } from '@/types';

const LOW_CONFIDENCE_THRESHOLD = 0.7;

export interface VoiceDraft {
  itemName: string;
  date: string;
  type: TransactionType;
  amount: number;
  categoryId: string | null;
  subCategoryId: string | null;
  confidence: number;
  suggestion: CategorySuggestion | null;
}

export function VoiceEntryPreview({
  drafts,
  onDraftsChange,
  onCancel,
  onDone,
}: {
  drafts: VoiceDraft[];
  onDraftsChange: (drafts: VoiceDraft[]) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const categories = useAppStore((s) => s.categories);
  const addTransaction = useAppStore((s) => s.addTransaction);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [creatingIndex, setCreatingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savable = drafts.flatMap((draft) =>
    draft.categoryId && draft.amount > 0 ? [{ ...draft, categoryId: draft.categoryId }] : [],
  );

  function patchDraft(index: number, patch: Partial<VoiceDraft>) {
    onDraftsChange(drafts.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  async function handleCreateCategory(index: number) {
    const suggestion = drafts[index].suggestion;
    if (!suggestion) return;

    setCreatingIndex(index);
    setError(null);
    try {
      const created = await createSuggestedCategory(suggestion);
      if (!created) throw new Error('분류 추가에 실패했습니다.');
      patchDraft(index, {
        type: created.type,
        categoryId: created.id,
        subCategoryId: null,
        suggestion: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '분류 추가에 실패했습니다.');
    } finally {
      setCreatingIndex(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      for (const draft of savable) {
        await addTransaction({
          date: draft.date,
          type: draft.type,
          categoryId: draft.categoryId,
          subCategoryId: draft.subCategoryId,
          amount: draft.amount,
          itemName: draft.itemName || null,
          note: null,
          source: 'voice',
        });
      }
      setSavedCount(savable.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (savedCount !== null) {
    return (
      <div className="space-y-4 py-6 text-center">
        <p className="text-lg font-semibold">{savedCount}건 저장했습니다.</p>
        <Button type="button" className="h-14 w-full text-base" onClick={onDone}>
          닫기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {drafts.length}건을 들었어요. 확인하고 수정한 뒤 저장해 주세요.
      </p>

      <ul className="space-y-2">
        {drafts.map((draft, index) => {
          const category = categories.find((c) => c.id === draft.categoryId) ?? null;
          const needsCheck = !category || draft.confidence < LOW_CONFIDENCE_THRESHOLD;
          const editing = editingIndex === index;

          return (
            <li key={index} className="rounded-md border">
              <button
                type="button"
                aria-expanded={editing}
                onClick={() => setEditingIndex(editing ? null : index)}
                className="flex w-full items-center justify-between gap-2 p-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">{draft.itemName}</span>
                  <span className="block text-xs text-muted-foreground">
                    {draft.date} · {draft.type === 'income' ? '수입' : '지출'} ·{' '}
                    {category?.name ?? '분류 미지정'}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {needsCheck && (
                    <AlertTriangle
                      className="size-4 text-amber-600 dark:text-amber-400"
                      aria-label="확인이 필요한 항목"
                    />
                  )}
                  <span
                    className={cn(
                      'text-base font-semibold tabular-nums',
                      draft.type === 'income' ? 'text-blue-600' : 'text-red-600',
                    )}
                  >
                    {formatAmount(draft.amount)}원
                  </span>
                </span>
              </button>

              {editing && (
                <div className="space-y-3 border-t p-3">
                  <Input
                    value={draft.itemName}
                    maxLength={50}
                    placeholder="구입 항목명"
                    onChange={(e) => patchDraft(index, { itemName: e.target.value })}
                    className="h-12 text-base"
                    aria-label="구입 항목명"
                  />

                  <Input
                    type="date"
                    value={draft.date}
                    onChange={(e) => patchDraft(index, { date: e.target.value })}
                    className="h-12 text-center text-base"
                    aria-label="거래 날짜"
                  />

                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="수입 지출 구분">
                    {(['income', 'expense'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={draft.type === option}
                        onClick={() =>
                          patchDraft(index, {
                            type: option,
                            categoryId: null,
                            subCategoryId: null,
                          })
                        }
                        className={cn(
                          'h-12 rounded-md border text-base font-semibold transition-colors',
                          draft.type === option
                            ? option === 'income'
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-red-600 bg-red-600 text-white'
                            : cn(
                                'border-input',
                                option === 'income'
                                  ? 'text-blue-700 dark:text-blue-300'
                                  : 'text-red-700 dark:text-red-300',
                              ),
                        )}
                      >
                        {option === 'income' ? '수입' : '지출'}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Input
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      value={draft.amount ? formatAmount(draft.amount) : ''}
                      onChange={(e) =>
                        patchDraft(index, {
                          amount: Number(e.target.value.replace(/\D/g, '').slice(0, 12)) || 0,
                        })
                      }
                      className={cn(
                        'h-14 pr-10 text-right text-2xl font-semibold tabular-nums',
                        draft.type === 'income' ? 'text-blue-600' : 'text-red-600',
                      )}
                      aria-label="금액"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground">
                      원
                    </span>
                  </div>

                  {draft.suggestion && !draft.categoryId && (
                    <div className="space-y-2 rounded-md border border-dashed p-3 text-sm">
                      <p>
                        기존 분류에 맞는 항목이 없어요. 새 분류{' '}
                        <span className="font-semibold">
                          &lsquo;{draft.suggestion.name}&rsquo;
                        </span>
                        을(를) 추가할까요?
                        {draft.suggestion.subCategories.length > 0 && (
                          <> ({draft.suggestion.subCategories.join(' · ')})</>
                        )}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9"
                        disabled={creatingIndex === index}
                        onClick={() => handleCreateCategory(index)}
                      >
                        {creatingIndex === index ? '추가하는 중…' : '추가'}
                      </Button>
                    </div>
                  )}

                  <CategoryPicker
                    categories={categories}
                    type={draft.type}
                    categoryId={draft.categoryId}
                    subCategoryId={draft.subCategoryId}
                    onCategoryChange={(id) =>
                      patchDraft(index, { categoryId: id, subCategoryId: null })
                    }
                    onSubCategoryChange={(id) => patchDraft(index, { subCategoryId: id })}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full"
                    onClick={() => setEditingIndex(null)}
                  >
                    확인
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {savable.length < drafts.length && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          분류나 금액이 비어 있는 항목은 저장되지 않습니다.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-14 flex-1 text-base"
          disabled={saving}
          onClick={onCancel}
        >
          취소
        </Button>
        <Button
          type="button"
          className="h-14 flex-1 text-base"
          disabled={saving || savable.length === 0}
          onClick={handleSave}
        >
          {saving ? '저장 중…' : `${savable.length}건 저장`}
        </Button>
      </div>
    </div>
  );
}
