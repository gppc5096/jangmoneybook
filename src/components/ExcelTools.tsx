'use client';

import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/lib/store';
import {
  categoryLabel,
  currentMonthKey,
  formatAmount,
  monthKey,
  subCategoryName,
  summarize,
} from '@/lib/format';
import type { TransactionInput } from '@/types';

interface ParsedRow {
  status: 'ok' | 'duplicate';
  row: number;
  input: TransactionInput;
  categoryName: string;
}

type PreviewRow = ParsedRow | { status: 'error'; row: number; reason: string };

const COLUMN_ALIASES = {
  date: ['날짜', 'date'],
  type: ['구분', 'type'],
  category: ['대분류', 'category'],
  subCategory: ['소분류', 'subcategory', 'sub'],
  itemName: ['항목명', '품목', '품목명', 'itemname', 'item'],
  amount: ['금액', 'amount'],
  note: ['비고', 'note', 'memo'],
} as const;

function pick(row: Record<string, unknown>, keys: readonly string[]) {
  const normalized = new Map(
    Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]),
  );
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase());
    if (value !== undefined && value !== null && `${value}`.trim() !== '') return value;
  }
  return undefined;
}

function toISODate(value: unknown): string | null {
  if (value instanceof Date) {
    const offset = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 10);
  }
  const text = `${value}`.trim().replace(/[./]/g, '-');
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(text)
    ? text.replace(/-(\d)(?=-|$)/g, '-0$1')
    : null;
}

export function ExcelTools() {
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);
  const addTransaction = useAppStore((s) => s.addTransaction);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      const XLSX = await import('xlsx');
      const book = XLSX.utils.book_new();

      const txRows = transactions.map((t) => ({
        날짜: t.date,
        구분: t.type === 'income' ? '수입' : '지출',
        대분류: categoryLabel(categories, t.categoryId).name,
        소분류: subCategoryName(categories, t.categoryId, t.subCategoryId) ?? '',
        항목명: t.itemName ?? '',
        금액: t.amount,
        비고: t.note ?? '',
      }));
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(txRows), '거래내역');

      const months = [...new Set(transactions.map((t) => monthKey(t.date)))].sort().reverse();
      const statRows = months.map((m) => {
        const totals = summarize(transactions.filter((t) => monthKey(t.date) === m));
        return { 월: m, 수입: totals.income, 지출: totals.expense, 잔액: totals.balance };
      });
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(statRows), '월별통계');

      XLSX.writeFile(book, `가계부_${currentMonthKey()}.xlsx`);
      setMessage(`${transactions.length}건을 내보냈습니다.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '내보내기에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const XLSX = await import('xlsx');
      const book = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const sheet = book.Sheets[book.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const parsed = rows.map<PreviewRow>((row, i) => {
        const rowNumber = i + 2;
        const date = toISODate(pick(row, COLUMN_ALIASES.date));
        if (!date) return { status: 'error', row: rowNumber, reason: '날짜 형식 오류' };

        const amount = Number(`${pick(row, COLUMN_ALIASES.amount) ?? ''}`.replace(/[^\d.-]/g, ''));
        if (!Number.isFinite(amount) || amount <= 0) {
          return { status: 'error', row: rowNumber, reason: '금액 오류' };
        }

        const typeText = `${pick(row, COLUMN_ALIASES.type) ?? ''}`.trim();
        const type = typeText.includes('수입') || typeText.toLowerCase() === 'income'
          ? 'income'
          : 'expense';

        const categoryName = `${pick(row, COLUMN_ALIASES.category) ?? ''}`.trim();
        const category = categories.find((c) => c.name === categoryName && c.type === type);
        if (!category) {
          return { status: 'error', row: rowNumber, reason: `'${categoryName}' 분류 없음` };
        }

        const subName = `${pick(row, COLUMN_ALIASES.subCategory) ?? ''}`.trim();
        const sub = category.subCategories.find((s) => s.name === subName);
        const itemName =
          `${pick(row, COLUMN_ALIASES.itemName) ?? ''}`.trim().slice(0, 50) || null;
        const note = `${pick(row, COLUMN_ALIASES.note) ?? ''}`.trim().slice(0, 50) || null;

        const duplicate = transactions.some(
          (t) =>
            t.date === date && t.amount === amount && (t.itemName ?? '') === (itemName ?? ''),
        );

        return {
          status: duplicate ? 'duplicate' : 'ok',
          row: rowNumber,
          categoryName: category.name,
          input: {
            date,
            type,
            categoryId: category.id,
            subCategoryId: sub?.id ?? null,
            amount,
            itemName,
            note,
            source: 'import',
          },
        };
      });

      setPreview(parsed);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '파일을 읽지 못했습니다.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;
    const importable = preview.filter((p): p is ParsedRow => p.status === 'ok');

    setBusy(true);
    setMessage(null);
    try {
      for (const item of importable) {
        await addTransaction(item.input);
      }
      setMessage(`${importable.length}건을 가져왔습니다.`);
      setPreview(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '가져오기에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const importableCount = preview?.filter((p) => p.status === 'ok').length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">엑셀 내보내기 / 가져오기</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full text-base"
          disabled={busy || transactions.length === 0}
          onClick={handleExport}
        >
          <Download className="size-5" aria-hidden />
          엑셀로 내보내기 ({transactions.length}건)
        </Button>

        <div>
          <input
            ref={fileInputRef}
            id="excel-import"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full text-base"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-5" aria-hidden />
            엑셀 파일 선택
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            열 이름: 날짜 / 구분 / 대분류 / 소분류 / 항목명 / 금액 / 비고
          </p>
        </div>

        {preview && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">
              미리보기 — 가져올 {importableCount}건 / 전체 {preview.length}건
            </p>
            <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
              {preview.map((item) => (
                <li key={item.row} className="flex items-center justify-between gap-2">
                  {item.status === 'error' ? (
                    <span className="text-destructive">
                      {item.row}행 · {item.reason}
                    </span>
                  ) : (
                    <>
                      <span className="truncate">
                        {item.input.date} · {item.categoryName} · {item.input.itemName ?? ''}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatAmount(item.input.amount)}
                        {item.status === 'duplicate' && (
                          <span className="ml-1 text-amber-600">중복</span>
                        )}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => setPreview(null)}
              >
                취소
              </Button>
              <Button
                type="button"
                className="h-11 flex-1"
                disabled={busy || importableCount === 0}
                onClick={handleConfirmImport}
              >
                {busy ? '가져오는 중…' : `${importableCount}건 가져오기`}
              </Button>
            </div>
          </div>
        )}

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
