'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Mic,
  MicOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';
import { formatAmount, shiftDay, todayISO } from '@/lib/format';
import { auth } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { CategoryPicker } from '@/components/CategoryPicker';
import { pickCategoryColor } from '@/lib/defaultCategories';
import type { OcrResult, TransactionType } from '@/types';

const NOTE_MAX = 50;
const OCR_MAX_DIMENSION = 1600;
const OCR_JPEG_QUALITY = 0.7;
const OCR_CONFIDENCE_THRESHOLD = 0.7;

/** 업로드 용량을 줄이기 위해 canvas 로 리사이즈 후 JPEG base64 로 변환한다. */
async function resizeImageToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, OCR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 처리할 수 없습니다.');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', OCR_JPEG_QUALITY);
  return { base64: dataUrl.split(',')[1] ?? '', mediaType: 'image/jpeg' };
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function TransactionSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const categories = useAppStore((s) => s.categories);
  const transactions = useAppStore((s) => s.transactions);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const addCategory = useAppStore((s) => s.addCategory);
  const updateCategory = useAppStore((s) => s.updateCategory);

  const [date, setDate] = useState(todayISO);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrLowConfidence, setOcrLowConfidence] = useState(false);
  const [source, setSource] = useState<'manual' | 'ocr'>('manual');
  const [newCategorySuggestion, setNewCategorySuggestion] = useState<{
    name: string;
    type: TransactionType;
    subCategories: string[];
  } | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSpeechSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  // 같은 대분류로 최근에 쓴 비고 중 서로 다른 값 최대 3개를 빠른 선택으로 제안한다 (PRD 4-1).
  const noteSuggestions = useMemo(() => {
    if (!categoryId) return [];
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const t of transactions) {
      if (t.categoryId !== categoryId) continue;
      const value = t.note?.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      suggestions.push(value);
      if (suggestions.length >= 3) break;
    }
    return suggestions;
  }, [transactions, categoryId]);

  const amount = Number(amountText.replace(/\D/g, '')) || 0;

  function resetForm() {
    setDate(todayISO());
    setType('expense');
    setAmountText('');
    setCategoryId(null);
    setSubCategoryId(null);
    setNote('');
    setError(null);
    setOcrError(null);
    setOcrLowConfidence(false);
    setSource('manual');
    setNewCategorySuggestion(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      recognitionRef.current?.stop();
      resetForm();
    }
    onOpenChange(next);
  }

  function handleTypeChange(next: TransactionType) {
    setType(next);
    setCategoryId(null);
    setSubCategoryId(null);
  }

  function handleAmountChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 12);
    setAmountText(digits ? formatAmount(Number(digits)) : '');
  }

  function toggleVoiceInput() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      setNote((prev) => `${prev}${transcript}`.slice(0, NOTE_MAX));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  async function handleReceiptSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setOcrError(null);
    setOcrLowConfidence(false);
    setNewCategorySuggestion(null);
    setOcrLoading(true);

    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error('오프라인 상태입니다. 직접 입력해 주세요.');
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('로그인 후 이용할 수 있습니다.');
      }

      const { base64, mediaType } = await resizeImageToBase64(file);
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          image: base64,
          mediaType,
          categories: categories.map((c) => ({ name: c.name, type: c.type })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? '영수증 분석에 실패했습니다.');
      }

      const result: OcrResult = await res.json();
      if (result.date) setDate(result.date);
      if (result.totalAmount) setAmountText(formatAmount(result.totalAmount));
      if (result.merchant) setNote(result.merchant.slice(0, NOTE_MAX));
      setSource('ocr');
      setOcrLowConfidence(result.confidence < OCR_CONFIDENCE_THRESHOLD);

      const match = result.categoryMatch;
      if (match) {
        setType(match.type);
        if (match.matchedName) {
          const found = categories.find(
            (c) => c.type === match.type && c.name === match.matchedName,
          );
          if (found) {
            setCategoryId(found.id);
            setSubCategoryId(null);
          }
        } else if (match.suggestedName) {
          setCategoryId(null);
          setSubCategoryId(null);
          setNewCategorySuggestion({
            name: match.suggestedName,
            type: match.type,
            subCategories: match.suggestedSubCategories,
          });
        }
      }
    } catch (err) {
      setOcrError(
        err instanceof Error ? err.message : '영수증 분석에 실패했습니다. 직접 입력해 주세요.',
      );
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleCreateSuggestedCategory() {
    if (!newCategorySuggestion) return;
    setCreatingCategory(true);
    setError(null);
    try {
      const order = categories.reduce((max, c) => Math.max(max, c.order), 0) + 1;
      await addCategory({
        name: newCategorySuggestion.name,
        type: newCategorySuggestion.type,
        color: pickCategoryColor(categories),
        order,
        subCategories: newCategorySuggestion.subCategories.map((name, i) => ({
          id: `sub-${Date.now()}-${i}`,
          name,
        })),
      });
      const created = useAppStore
        .getState()
        .categories.find(
          (c) => c.type === newCategorySuggestion.type && c.name === newCategorySuggestion.name,
        );
      if (created) {
        // AI 가 제안하고 사용자가 한 번 확인해 만든 분류는 실수로 지워지지 않도록 기본 분류와 동일하게 삭제 보호한다.
        await updateCategory(created.id, { isDefault: true });
        setType(created.type);
        setCategoryId(created.id);
      }
      setNewCategorySuggestion(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '분류 추가에 실패했습니다.');
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleSubmit() {
    if (!categoryId) {
      setError('대분류를 선택해 주세요.');
      return;
    }
    if (amount <= 0) {
      setError('금액을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await addTransaction({
        date,
        type,
        categoryId,
        subCategoryId,
        amount,
        note: note.trim() || null,
        source,
      });
      handleOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-4">
        <DialogTitle>거래 입력</DialogTitle>
        <DialogDescription className="sr-only">
          날짜, 수입/지출, 금액, 분류, 비고를 입력해 거래를 기록합니다.
        </DialogDescription>

        <div className="space-y-4">
          <section className="space-y-2">
            {/* capture="environment" 속성이 있는 입력은 모바일 브라우저에서 갤러리 대신 카메라 앱을 바로 연다. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleReceiptSelect}
            />
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReceiptSelect}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 text-base"
                disabled={ocrLoading}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="size-5" aria-hidden />
                카메라로 촬영
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 text-base"
                disabled={ocrLoading}
                onClick={() => receiptInputRef.current?.click()}
              >
                <ImagePlus className="size-5" aria-hidden />
                갤러리에서 선택
              </Button>
            </div>
            {ocrLoading && (
              <p className="text-sm text-muted-foreground">영수증을 분석하는 중…</p>
            )}
            {ocrError && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {ocrError}
              </p>
            )}
            {ocrLowConfidence && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                인식 결과의 신뢰도가 낮습니다. 자동 입력된 값을 확인해 주세요.
              </p>
            )}
            {newCategorySuggestion && (
              <div className="space-y-2 rounded-md border border-dashed p-3 text-sm">
                <p>
                  기존 분류에 맞는 항목이 없어요. 새 분류{' '}
                  <span className="font-semibold">&lsquo;{newCategorySuggestion.name}&rsquo;</span>
                  을(를) 추가할까요?
                  {newCategorySuggestion.subCategories.length > 0 && (
                    <> ({newCategorySuggestion.subCategories.join(' · ')})</>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-9"
                    disabled={creatingCategory}
                    onClick={handleCreateSuggestedCategory}
                  >
                    {creatingCategory ? '추가하는 중…' : '추가'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9"
                    disabled={creatingCategory}
                    onClick={() => setNewCategorySuggestion(null)}
                  >
                    기존 분류에서 선택
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium">날짜</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="이전 날짜"
                className="size-12 shrink-0"
                onClick={() => setDate(shiftDay(date, -1))}
              >
                <ChevronLeft className="size-5" aria-hidden />
              </Button>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 text-center text-base"
                aria-label="거래 날짜"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="다음 날짜"
                className="size-12 shrink-0"
                onClick={() => setDate(shiftDay(date, 1))}
              >
                <ChevronRight className="size-5" aria-hidden />
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-sm font-medium">구분</p>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="수입 지출 구분">
              <button
                type="button"
                aria-pressed={type === 'income'}
                onClick={() => handleTypeChange('income')}
                className={cn(
                  'h-12 rounded-md border text-base font-semibold transition-colors',
                  type === 'income'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-input text-blue-700 dark:text-blue-300',
                )}
              >
                수입
              </button>
              <button
                type="button"
                aria-pressed={type === 'expense'}
                onClick={() => handleTypeChange('expense')}
                className={cn(
                  'h-12 rounded-md border text-base font-semibold transition-colors',
                  type === 'expense'
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-input text-red-700 dark:text-red-300',
                )}
              >
                지출
              </button>
            </div>
          </section>

          <section className="space-y-2">
            <label htmlFor="tx-amount" className="text-sm font-medium">
              금액
            </label>
            <div className="relative">
              <Input
                id="tx-amount"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={amountText}
                onChange={(e) => handleAmountChange(e.target.value)}
                className={cn(
                  'h-14 pr-10 text-right text-2xl font-semibold tabular-nums',
                  type === 'income' ? 'text-blue-600' : 'text-red-600',
                )}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground">
                원
              </span>
            </div>
          </section>

          <CategoryPicker
            categories={categories}
            type={type}
            categoryId={categoryId}
            subCategoryId={subCategoryId}
            onCategoryChange={(id) => {
              setCategoryId(id);
              setSubCategoryId(null);
            }}
            onSubCategoryChange={setSubCategoryId}
          />

          <section className="space-y-2">
            <label htmlFor="tx-note" className="text-sm font-medium">
              비고
            </label>
            {noteSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {noteSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setNote(suggestion)}
                    className="h-9 rounded-full border border-input px-3 text-xs text-muted-foreground transition-colors hover:bg-accent"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                id="tx-note"
                value={note}
                maxLength={NOTE_MAX}
                placeholder="예: 마트 장보기"
                onChange={(e) => setNote(e.target.value)}
                className="h-12 text-base"
              />
              {speechSupported && (
                <Button
                  type="button"
                  variant={listening ? 'default' : 'outline'}
                  size="icon"
                  aria-label={listening ? '음성 입력 중지' : '음성 입력 시작'}
                  className="size-12 shrink-0"
                  onClick={toggleVoiceInput}
                >
                  {listening ? (
                    <MicOff className="size-5" aria-hidden />
                  ) : (
                    <Mic className="size-5" aria-hidden />
                  )}
                </Button>
              )}
            </div>
            <p className="text-right text-xs text-muted-foreground">
              {note.length} / {NOTE_MAX}
            </p>
          </section>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button
            type="button"
            className="h-14 w-full text-base"
            disabled={saving}
            onClick={handleSubmit}
          >
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
