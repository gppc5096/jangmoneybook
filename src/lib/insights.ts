import { categoryLabel, shiftDay, todayISO } from '@/lib/format';
import type { Category, Transaction } from '@/types';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function weekdayOf(dateISO: string) {
  return WEEKDAY_LABELS[new Date(`${dateISO}T00:00:00`).getDay()];
}

export interface WeekComparison {
  thisWeekExpense: number;
  lastWeekExpense: number;
  /** lastWeek 지출이 0이면 비교 기준이 없어 null. */
  percentChange: number | null;
}

/** 최근 7일과 그 이전 7일의 지출을 비교한다 (달력 주 대신 오늘 기준 이동 구간). */
export function compareWeeklyExpense(transactions: Transaction[]): WeekComparison {
  const today = todayISO();
  const thisWeekStart = shiftDay(today, -6);
  const lastWeekStart = shiftDay(today, -13);
  const lastWeekEnd = shiftDay(today, -7);

  const sumExpense = (from: string, to: string) =>
    transactions
      .filter((t) => t.type === 'expense' && t.date >= from && t.date <= to)
      .reduce((sum, t) => sum + t.amount, 0);

  const thisWeekExpense = sumExpense(thisWeekStart, today);
  const lastWeekExpense = sumExpense(lastWeekStart, lastWeekEnd);
  const percentChange =
    lastWeekExpense === 0
      ? null
      : Math.round(((thisWeekExpense - lastWeekExpense) / lastWeekExpense) * 100);

  return { thisWeekExpense, lastWeekExpense, percentChange };
}

export interface DailyTrendDatum {
  label: string;
  date: string;
  지출: number;
}

/** 오늘을 포함한 최근 7일의 요일별 지출 합계. */
export function weeklyDailyTrend(transactions: Transaction[]): DailyTrendDatum[] {
  const today = todayISO();
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDay(today, i - 6);
    const 지출 = transactions
      .filter((t) => t.type === 'expense' && t.date === date)
      .reduce((sum, t) => sum + t.amount, 0);
    return { label: weekdayOf(date), date, 지출 };
  });
}

export interface TopCategory {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
  /** 이번 주 전체 지출 대비 비중 (0~100). */
  share: number;
}

/** 최근 7일 중 가장 지출이 큰 분류. 이번 주 지출이 없으면 null. */
export function topCategoryThisWeek(
  transactions: Transaction[],
  categories: Category[],
): TopCategory | null {
  const today = todayISO();
  const weekStart = shiftDay(today, -6);
  const weekExpenses = transactions.filter(
    (t) => t.type === 'expense' && t.date >= weekStart && t.date <= today,
  );
  if (weekExpenses.length === 0) return null;

  const totals = new Map<string, number>();
  for (const t of weekExpenses) {
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  const totalExpense = weekExpenses.reduce((sum, t) => sum + t.amount, 0);

  let topId: string | null = null;
  let topAmount = 0;
  for (const [id, amount] of totals) {
    if (amount > topAmount) {
      topAmount = amount;
      topId = id;
    }
  }
  if (!topId) return null;

  const label = categoryLabel(categories, topId);
  return {
    categoryId: topId,
    name: label.name,
    color: label.color,
    amount: topAmount,
    share: totalExpense === 0 ? 0 : Math.round((topAmount / totalExpense) * 100),
  };
}

export interface SpendingForecast {
  weekday: string;
  averageAmount: number;
}

/** 요일별 패턴을 판단하기에 충분하다고 볼 기록일 수 (약 2주치). */
const MIN_DISTINCT_DATES_FOR_FORECAST = 14;

/** 요일별 지출 이력에서 평균 지출이 가장 큰 요일을 찾는다. 기록이 부족하면 null. */
export function forecastBusiestWeekday(transactions: Transaction[]): SpendingForecast | null {
  const expenseTx = transactions.filter((t) => t.type === 'expense');
  const distinctDates = new Set(expenseTx.map((t) => t.date));
  if (distinctDates.size < MIN_DISTINCT_DATES_FOR_FORECAST) return null;

  const totalsByWeekday = new Map<number, number>();
  const datesByWeekday = new Map<number, Set<string>>();

  for (const t of expenseTx) {
    const weekday = new Date(`${t.date}T00:00:00`).getDay();
    totalsByWeekday.set(weekday, (totalsByWeekday.get(weekday) ?? 0) + t.amount);
    const dates = datesByWeekday.get(weekday) ?? new Set<string>();
    dates.add(t.date);
    datesByWeekday.set(weekday, dates);
  }

  let bestWeekday: number | null = null;
  let bestAverage = 0;
  for (const [weekday, total] of totalsByWeekday) {
    const average = total / (datesByWeekday.get(weekday)?.size ?? 1);
    if (average > bestAverage) {
      bestAverage = average;
      bestWeekday = weekday;
    }
  }
  if (bestWeekday === null) return null;

  return { weekday: WEEKDAY_LABELS[bestWeekday], averageAmount: Math.round(bestAverage) };
}
