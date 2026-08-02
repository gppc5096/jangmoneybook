'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryBadge } from '@/components/CategoryBadge';
import { DataStatus } from '@/components/DataStatus';
import { useAppStore } from '@/lib/store';
import {
  categoryLabel,
  currentMonthKey,
  formatAmount,
  formatSigned,
  monthKey,
  monthLabel,
  summarize,
} from '@/lib/format';

export default function Home() {
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);

  const thisMonth = currentMonthKey();
  const summary = useMemo(
    () => summarize(transactions.filter((t) => monthKey(t.date) === thisMonth)),
    [transactions, thisMonth],
  );
  const recent = useMemo(() => transactions.slice(0, 5), [transactions]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">간편 가계부</h1>

      <DataStatus />

      <Card>
        <CardHeader>
          <CardTitle>{monthLabel(thisMonth)} 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">수입</p>
              <p className="text-xl font-semibold tabular-nums text-blue-600">
                {formatAmount(summary.income)}원
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">지출</p>
              <p className="text-xl font-semibold tabular-nums text-red-600">
                {formatAmount(summary.expense)}원
              </p>
            </div>
          </div>
          <div className="border-t pt-3">
            <p className="text-sm text-muted-foreground">잔액</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatAmount(summary.balance)}원
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>최근 기록</CardTitle>
          <Link href="/records" className="text-sm text-primary underline-offset-4 hover:underline">
            전체 보기
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              아직 기록이 없습니다. 오른쪽 아래 + 버튼으로 첫 거래를 남겨 보세요.
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((tx) => {
                const label = categoryLabel(categories, tx.categoryId);
                return (
                  <li key={tx.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CategoryBadge name={label.name} color={label.color} />
                        <span className="truncate text-sm text-muted-foreground">
                          {tx.itemName ?? ''}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{tx.date}</p>
                    </div>
                    <p
                      className={`shrink-0 text-base font-semibold tabular-nums ${
                        tx.type === 'income' ? 'text-blue-600' : 'text-red-600'
                      }`}
                    >
                      {formatSigned(tx.type, tx.amount)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
