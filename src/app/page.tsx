'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { CalendarClock, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { DataStatus } from '@/components/DataStatus';
import { useAppStore } from '@/lib/store';
import { formatAmount } from '@/lib/format';
import {
  compareWeeklyExpense,
  forecastBusiestWeekday,
  topCategoryThisWeek,
  weeklyDailyTrend,
  type WeekComparison,
} from '@/lib/insights';
import { cn } from '@/lib/utils';

// recharts 는 무거워서 초기 번들에서 제외한다.
const WeeklyTrendChart = dynamic(
  () => import('@/components/WeeklyTrendChart').then((m) => m.WeeklyTrendChart),
  { ssr: false, loading: () => <div className="h-[180px]" /> },
);

type MessageTone = 'good' | 'caution' | 'neutral';

function weeklyMessage({ thisWeekExpense, lastWeekExpense, percentChange }: WeekComparison): {
  text: string;
  tone: MessageTone;
} {
  if (thisWeekExpense === 0 && lastWeekExpense === 0) {
    return { text: '아직 이번 주 기록이 없어요. 첫 거래를 남겨볼까요?', tone: 'neutral' };
  }
  if (percentChange === null) {
    return { text: `이번 주 지출은 ${formatAmount(thisWeekExpense)}원이에요.`, tone: 'neutral' };
  }
  if (percentChange < 0) {
    return { text: `지난주보다 지출이 ${Math.abs(percentChange)}% 줄었어요! 👏`, tone: 'good' };
  }
  if (percentChange > 0) {
    return { text: `지난주보다 지출이 ${percentChange}% 늘었어요.`, tone: 'caution' };
  }
  return { text: '지난주와 비슷한 수준으로 쓰고 있어요.', tone: 'neutral' };
}

export default function Home() {
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);

  const comparison = useMemo(() => compareWeeklyExpense(transactions), [transactions]);
  const message = useMemo(() => weeklyMessage(comparison), [comparison]);
  const trend = useMemo(() => weeklyDailyTrend(transactions), [transactions]);
  const topCategory = useMemo(
    () => topCategoryThisWeek(transactions, categories),
    [transactions, categories],
  );
  const forecast = useMemo(() => forecastBusiestWeekday(transactions), [transactions]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">간편 가계부</h1>

      <DataStatus />

      <Card
        className={cn(
          'border-l-4',
          message.tone === 'good' && 'border-l-blue-500',
          message.tone === 'caution' && 'border-l-amber-500',
          message.tone === 'neutral' && 'border-l-muted-foreground/30',
        )}
      >
        <CardContent className="flex items-center gap-3 p-4">
          {message.tone === 'good' && (
            <TrendingDown className="size-6 shrink-0 text-blue-600" aria-hidden />
          )}
          {message.tone === 'caution' && (
            <TrendingUp className="size-6 shrink-0 text-amber-600" aria-hidden />
          )}
          <p className="text-base font-medium">{message.text}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">이번 주 소비 흐름</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pl-0">
          <WeeklyTrendChart data={trend} />
          {topCategory && (
            <div className="mx-6 flex items-center justify-between rounded-lg bg-accent/40 p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">가장 많이 쓴 분류</span>
                <CategoryBadge name={topCategory.name} color={topCategory.color} />
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {formatAmount(topCategory.amount)}원 ({topCategory.share}%)
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <CalendarClock className="size-6 shrink-0 text-muted-foreground" aria-hidden />
          {forecast ? (
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">{forecast.weekday}요일</span>에 지출이 몰리는
              편이에요. 평균 {formatAmount(forecast.averageAmount)}원 — 다가오는{' '}
              {forecast.weekday}요일엔 미리 계획해보는 건 어때요?
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              아직 소비 패턴을 분석하기엔 기록이 부족해요. 계속 기록해주시면 다음에
              알려드릴게요.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
