'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { DataStatus } from '@/components/DataStatus';
import { useAppStore } from '@/lib/store';
import {
  categoryLabel,
  currentMonthKey,
  formatAmount,
  monthKey,
  monthLabel,
  shiftMonth,
  shortMonthLabel,
  summarize,
} from '@/lib/format';
import type { MonthlyBarDatum } from '@/components/MonthlyBarChart';
import type { Transaction } from '@/types';

// recharts 는 무거워서 초기 번들에서 제외한다.
const MonthlyBarChart = dynamic(
  () => import('@/components/MonthlyBarChart').then((m) => m.MonthlyBarChart),
  { ssr: false, loading: () => <div className="h-[260px]" /> },
);

function totalsByCategory(transactions: Transaction[]) {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  return totals;
}

export default function StatsPage() {
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);
  const [month, setMonth] = useState(currentMonthKey);

  const prevMonth = shiftMonth(month, -1);

  const { rows, summary } = useMemo(() => {
    const current = transactions.filter((t) => monthKey(t.date) === month);
    const previous = transactions.filter((t) => monthKey(t.date) === prevMonth);
    const currentTotals = totalsByCategory(current);
    const previousTotals = totalsByCategory(previous);

    const ids = new Set([...currentTotals.keys(), ...previousTotals.keys()]);
    const built = [...ids]
      .map((categoryId) => {
        const amount = currentTotals.get(categoryId) ?? 0;
        const prev = previousTotals.get(categoryId) ?? 0;
        return { categoryId, amount, delta: amount - prev, ...categoryLabel(categories, categoryId) };
      })
      .sort((a, b) => b.amount - a.amount);

    return { rows: built, summary: summarize(current) };
  }, [transactions, categories, month, prevMonth]);

  const chartData = useMemo<MonthlyBarDatum[]>(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const key = shiftMonth(month, i - 5);
      const totals = summarize(transactions.filter((t) => monthKey(t.date) === key));
      return { label: shortMonthLabel(key), 수입: totals.income, 지출: totals.expense };
    });
  }, [transactions, month]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">통계</h1>

      <DataStatus />

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="이전 달"
          className="size-11"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <p className="text-lg font-semibold">{monthLabel(month)}</p>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="다음 달"
          className="size-11"
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>

      <Card>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">분류별 집계 (전월 대비)</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">이 달의 거래가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium">분류</th>
                    <th className="py-2 text-right font-medium">합계</th>
                    <th className="py-2 text-right font-medium">전월 대비</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.categoryId} className="border-b last:border-0">
                      <td className="py-2">
                        <CategoryBadge name={row.name} color={row.color} />
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatAmount(row.amount)}</td>
                      <td
                        className={`py-2 text-right tabular-nums ${
                          row.delta > 0
                            ? 'text-red-600'
                            : row.delta < 0
                              ? 'text-blue-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {row.delta > 0 ? '+' : ''}
                        {formatAmount(row.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 6개월 추이</CardTitle>
        </CardHeader>
        <CardContent className="pl-0">
          <MonthlyBarChart data={chartData} />
        </CardContent>
      </Card>
    </div>
  );
}
