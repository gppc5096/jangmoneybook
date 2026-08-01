import type { Category, Transaction } from '@/types';

export const DELETED_CATEGORY_NAME = '(삭제된 분류)';
export const DELETED_CATEGORY_COLOR = '#64748B';

export function formatAmount(value: number) {
  return value.toLocaleString('ko-KR');
}

export function formatSigned(type: Transaction['type'], amount: number) {
  return `${type === 'income' ? '+' : '-'}${formatAmount(amount)}원`;
}

export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function shiftDay(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' -> 'YYYY-MM' */
export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

export function currentMonthKey() {
  return monthKey(todayISO());
}

export function monthLabel(key: string) {
  const [year, month] = key.split('-');
  return `${year}년 ${Number(month)}월`;
}

export function shortMonthLabel(key: string) {
  return `${Number(key.split('-')[1])}월`;
}

/** 기준 월에서 n개월 이동한 'YYYY-MM' */
export function shiftMonth(key: string, months: number) {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(year, month - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function categoryLabel(categories: Category[], categoryId: string) {
  const found = categories.find((c) => c.id === categoryId);
  return {
    name: found?.name ?? DELETED_CATEGORY_NAME,
    color: found?.color ?? DELETED_CATEGORY_COLOR,
  };
}

export function subCategoryName(
  categories: Category[],
  categoryId: string,
  subCategoryId: string | null,
) {
  if (!subCategoryId) return null;
  const found = categories.find((c) => c.id === categoryId);
  return found?.subCategories.find((s) => s.id === subCategoryId)?.name ?? null;
}

export function summarize(transactions: Transaction[]) {
  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  return { income, expense, balance: income - expense };
}
