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
import { VoiceEntryPreview, type VoiceDraft } from '@/components/VoiceEntryPreview';
import { createSuggestedCategory, type CategorySuggestion } from '@/lib/categorySuggestion';
import type {
  OcrResult,
  TransactionSource,
  TransactionType,
  VoiceEntryItem,
  VoiceEntryResult,
} from '@/types';

const ITEM_NAME_MAX = 50;
const NOTE_MAX = 50;
const OCR_MAX_DIMENSION = 1600;
const OCR_JPEG_QUALITY = 0.7;
const LOW_CONFIDENCE_THRESHOLD = 0.7;
/** 발화를 마치고 정지 탭을 잊은 경우에만 개입하는 보조 안전장치 (PRD 5-3). 문장 중간의 자연스러운 멈춤은 이 안에 들어온다. */
const VOICE_SILENCE_TIMEOUT_MS = 9000;
const VOICE_MAX_DURATION_MS = 60_000;

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

type SpeechResultLike = ArrayLike<{ transcript: string }> & { isFinal: boolean };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<SpeechResultLike> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  webkitAudioContext?: typeof AudioContext;
};

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** 녹음이 끝났다는 사실을 소리·진동으로 알린다 (PRD 5-3). 미지원 환경에서는 조용히 넘어간다. */
function notifyRecordingEnd() {
  try {
    const Ctx = window.AudioContext ?? (window as SpeechWindow).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = 880;
      gain.gain.value = 0.12;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.onended = () => void ctx.close();
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.15);
    }
  } catch {
    // 소리 재생 실패는 기능에 영향이 없으므로 무시한다.
  }
  navigator.vibrate?.(120);
}

type VoiceStage = 'idle' | 'recording' | 'confirm' | 'parsing' | 'preview';

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

  const [date, setDate] = useState(todayISO);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [note, setNote] = useState('');
  const [listening, setListening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [source, setSource] = useState<TransactionSource>('manual');
  const [newCategorySuggestion, setNewCategorySuggestion] = useState<CategorySuggestion | null>(
    null,
  );
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [voiceStage, setVoiceStage] = useState<VoiceStage>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceInterim, setVoiceInterim] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceDrafts, setVoiceDrafts] = useState<VoiceDraft[]>([]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const voiceRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceSilenceTimerRef = useRef<number | null>(null);
  const voiceMaxTimerRef = useRef<number | null>(null);
  const voiceFinalRef = useRef('');
  const voiceInterimRef = useRef('');
  const voiceSessionFinalRef = useRef('');
  const voiceStoppingRef = useRef(false);
  const voiceErrorRef = useRef<string | null>(null);

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
    setItemName('');
    setNote('');
    setError(null);
    setOcrError(null);
    setLowConfidence(false);
    setSource('manual');
    setNewCategorySuggestion(null);
    setVoiceError(null);
    setVoiceDrafts([]);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      recognitionRef.current?.stop();
      closeVoiceMode();
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

  function clearVoiceTimers() {
    if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
    if (voiceMaxTimerRef.current !== null) window.clearTimeout(voiceMaxTimerRef.current);
    voiceSilenceTimerRef.current = null;
    voiceMaxTimerRef.current = null;
  }

  function stopVoiceRecording() {
    clearVoiceTimers();
    voiceStoppingRef.current = true;
    voiceRecognitionRef.current?.stop();
  }

  /** 음성 입력 모드를 닫고 폼으로 돌아간다. 진행 중이던 인식 결과는 버린다. */
  function closeVoiceMode() {
    clearVoiceTimers();
    voiceStoppingRef.current = true;
    const recognition = voiceRecognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      voiceRecognitionRef.current = null;
    }
    voiceFinalRef.current = '';
    voiceInterimRef.current = '';
    voiceSessionFinalRef.current = '';
    setVoiceTranscript('');
    setVoiceInterim('');
    setVoiceDrafts([]);
    setVoiceStage('idle');
  }

  function startVoiceRecording() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    closeVoiceMode();
    voiceStoppingRef.current = false;
    voiceErrorRef.current = null;
    setVoiceError(null);
    setOcrError(null);
    setVoiceStage('recording');

    const recognition = new Ctor();
    recognition.lang = 'ko-KR';
    // Android Chrome은 continuous:true 상태에서 짧은 무음마다 인식 세션을 몰래 재시작하며
    // 이미 나온 앞부분을 매번 새 최종 결과로 다시 내보내 "오늘오늘오늘..." 처럼 중복된다.
    // continuous:false로 짧게 끊어 듣고, 세션이 자연 종료될 때마다 직접 재시작해 이어붙인다.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) final += text;
        else interim += text;
      }
      if (final) voiceSessionFinalRef.current = final;
      voiceInterimRef.current = interim;
      setVoiceInterim(interim);

      // 말이 시작된 뒤부터만 무음 타임아웃을 건다. 문장 중간의 멈춤이 아니라 '종료 탭을 잊은 경우'를 잡기 위한 장치다.
      if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
      voiceSilenceTimerRef.current = window.setTimeout(
        stopVoiceRecording,
        VOICE_SILENCE_TIMEOUT_MS,
      );
    };

    recognition.onerror = (event) => {
      // 'no-speech'는 세션이 잠깐 끊긴 것뿐이라 onend 에서 조용히 재시작된다.
      if (event?.error === 'no-speech') return;
      voiceErrorRef.current = '음성 인식에 실패했어요. 마이크 권한을 확인해 주세요.';
    };

    recognition.onend = () => {
      if (voiceSessionFinalRef.current) {
        voiceFinalRef.current = `${voiceFinalRef.current}${
          voiceFinalRef.current ? ' ' : ''
        }${voiceSessionFinalRef.current}`.trim();
        voiceSessionFinalRef.current = '';
        setVoiceTranscript(voiceFinalRef.current);
      }

      if (!voiceStoppingRef.current) {
        // 사용자가 아직 멈추지 않았다면, continuous:false 로 인해 자연 종료된 세션을 이어서 듣는다.
        try {
          recognition.start();
          return;
        } catch {
          // 재시작 실패 시 아래 종료 처리로 넘어간다.
        }
      }

      clearVoiceTimers();
      voiceRecognitionRef.current = null;
      notifyRecordingEnd();

      const transcript = (voiceFinalRef.current || voiceInterimRef.current).trim();
      setVoiceInterim('');
      if (!transcript) {
        setVoiceStage('idle');
        setVoiceError(voiceErrorRef.current ?? '음성을 인식하지 못했어요. 다시 시도해 주세요.');
        return;
      }
      setVoiceTranscript(transcript);
      setVoiceStage('confirm');
    };

    voiceRecognitionRef.current = recognition;
    recognition.start();
    voiceMaxTimerRef.current = window.setTimeout(stopVoiceRecording, VOICE_MAX_DURATION_MS);
  }

  function toVoiceDraft(date: string | null, entry: VoiceEntryItem): VoiceDraft {
    const match = entry.categoryMatch;
    const type: TransactionType = match?.type ?? 'expense';
    const matchedName = match?.matchedName ?? null;
    const matched = matchedName
      ? categories.find((c) => c.type === type && c.name === matchedName)
      : undefined;

    return {
      itemName: entry.itemName,
      date: date ?? todayISO(),
      type,
      amount: Math.max(0, Math.round(entry.amount)),
      categoryId: matched?.id ?? null,
      subCategoryId: null,
      confidence: entry.confidence,
      suggestion:
        !matched && match?.suggestedName
          ? {
              name: match.suggestedName,
              type,
              subCategories: match.suggestedSubCategories ?? [],
            }
          : null,
    };
  }

  function applyVoiceEntryToForm(date: string | null, entry: VoiceEntryItem) {
    const draft = toVoiceDraft(date, entry);
    setDate(draft.date);
    setType(draft.type);
    setAmountText(draft.amount > 0 ? formatAmount(draft.amount) : '');
    setCategoryId(draft.categoryId);
    setSubCategoryId(null);
    setItemName(draft.itemName.slice(0, ITEM_NAME_MAX));
    // 비고는 음성 자동 채움 대상이 아니다 (PRD 원칙 3).
    setNote('');
    setSource('voice');
    setLowConfidence(draft.confidence < LOW_CONFIDENCE_THRESHOLD);
    setNewCategorySuggestion(draft.suggestion);
  }

  async function handleVoiceConfirm() {
    setVoiceStage('parsing');
    setVoiceError(null);

    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new Error('오프라인 상태입니다. 직접 입력해 주세요.');
      }

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('로그인 후 이용할 수 있습니다.');
      }

      const res = await fetch('/api/voice-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          transcript: voiceTranscript,
          categories: categories.map((c) => ({ name: c.name, type: c.type })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `음성 분석에 실패했습니다. (오류 코드: ${res.status})`);
      }

      const result: VoiceEntryResult = await res.json();
      const entries = result.entries ?? [];
      if (entries.length === 0) {
        throw new Error('말씀하신 내용에서 거래를 찾지 못했어요. 다시 말씀해 주세요.');
      }

      if (entries.length === 1) {
        applyVoiceEntryToForm(result.date, entries[0]);
        setVoiceStage('idle');
        return;
      }

      setVoiceDrafts(entries.map((entry) => toVoiceDraft(result.date, entry)));
      setVoiceStage('preview');
    } catch (err) {
      setVoiceStage('idle');
      setVoiceError(
        err instanceof Error ? err.message : '음성 분석에 실패했습니다. 직접 입력해 주세요.',
      );
    }
  }

  async function handleReceiptSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setOcrError(null);
    setVoiceError(null);
    setLowConfidence(false);
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
        throw new Error(body?.error ?? `영수증 분석에 실패했습니다. (오류 코드: ${res.status})`);
      }

      const result: OcrResult = await res.json();
      if (result.date) setDate(result.date);
      if (result.totalAmount) setAmountText(formatAmount(result.totalAmount));
      if (result.merchant) setItemName(result.merchant.slice(0, ITEM_NAME_MAX));
      setSource('ocr');
      setLowConfidence(result.confidence < LOW_CONFIDENCE_THRESHOLD);

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
      const created = await createSuggestedCategory(newCategorySuggestion);
      if (created) {
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
        itemName: itemName.trim() || null,
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

  if (voiceStage !== 'idle') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="gap-4">
          <DialogTitle>음성 입력</DialogTitle>
          <DialogDescription className="sr-only">
            말씀하신 내용을 인식해 거래 항목을 자동으로 채웁니다.
          </DialogDescription>

          {voiceStage === 'recording' && (
            <div className="space-y-4">
              <button
                type="button"
                aria-label="녹음 종료"
                onClick={stopVoiceRecording}
                className="mx-auto flex size-32 animate-pulse flex-col items-center justify-center gap-1 rounded-full bg-red-600 text-white"
              >
                <MicOff className="size-10" aria-hidden />
                <span className="text-sm font-semibold">탭하면 종료</span>
              </button>
              <p className="text-center text-lg font-semibold">듣고 있어요…</p>
              <div className="min-h-24 rounded-md border bg-muted/40 p-3 text-lg leading-relaxed">
                {voiceTranscript || voiceInterim ? (
                  <p>
                    {voiceTranscript}
                    <span className="text-muted-foreground">{voiceInterim}</span>
                  </p>
                ) : (
                  <p className="text-muted-foreground">예: 오늘 지출 장보기 3만원</p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full text-base"
                onClick={closeVoiceMode}
              >
                취소
              </Button>
            </div>
          )}

          {voiceStage === 'confirm' && (
            <div className="space-y-4">
              <p className="text-center text-lg font-semibold">이렇게 들었어요, 맞나요?</p>
              <p className="rounded-md border bg-muted/40 p-4 text-xl leading-relaxed">
                {voiceTranscript}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 text-base"
                  onClick={startVoiceRecording}
                >
                  다시 말할게요
                </Button>
                <Button type="button" className="h-14 text-base" onClick={handleVoiceConfirm}>
                  네, 맞아요
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full text-base"
                onClick={closeVoiceMode}
              >
                취소
              </Button>
            </div>
          )}

          {voiceStage === 'parsing' && (
            <p className="py-12 text-center text-base text-muted-foreground">
              말씀하신 내용을 분석하는 중…
            </p>
          )}

          {voiceStage === 'preview' && (
            <VoiceEntryPreview
              drafts={voiceDrafts}
              onDraftsChange={setVoiceDrafts}
              onCancel={closeVoiceMode}
              onDone={() => handleOpenChange(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-4">
        <DialogTitle>거래 입력</DialogTitle>
        <DialogDescription className="sr-only">
          날짜, 수입/지출, 금액, 분류, 구입 항목명, 비고를 입력해 거래를 기록합니다.
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
            <div className={cn('grid gap-2', speechSupported ? 'grid-cols-3' : 'grid-cols-2')}>
              <Button
                type="button"
                variant="outline"
                className="h-12 text-base"
                disabled={ocrLoading}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="size-5" aria-hidden />
                카메라 촬영
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 text-base"
                disabled={ocrLoading}
                onClick={() => receiptInputRef.current?.click()}
              >
                <ImagePlus className="size-5" aria-hidden />
                갤러리 선택
              </Button>
              {speechSupported && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 text-base"
                  disabled={ocrLoading}
                  onClick={startVoiceRecording}
                >
                  <Mic className="size-5" aria-hidden />
                  음성 입력
                </Button>
              )}
            </div>
            {ocrLoading && (
              <p className="text-sm text-muted-foreground">영수증을 분석하는 중…</p>
            )}
            {(ocrError || voiceError) && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {ocrError ?? voiceError}
              </p>
            )}
            {lowConfidence && (
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
            <label htmlFor="tx-item-name" className="text-sm font-medium">
              구입 항목명
            </label>
            <Input
              id="tx-item-name"
              value={itemName}
              maxLength={ITEM_NAME_MAX}
              placeholder="예: 돼지고기"
              onChange={(e) => setItemName(e.target.value)}
              className="h-12 text-base"
            />
          </section>

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
