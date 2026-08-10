'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatAmount } from '@/lib/format';

export function MonthSummaryCard({
  income,
  expense,
  balance,
}: {
  income: number;
  expense: number;
  balance: number;
}) {
  return (
    <Card className="sticky top-0 z-10">
      <CardContent className="grid grid-cols-3 gap-2 p-4 text-center">
        <div>
          <p className="text-xs text-muted-foreground">수입</p>
          <p className="text-base font-semibold tabular-nums text-blue-600">
            {formatAmount(income)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">지출</p>
          <p className="text-base font-semibold tabular-nums text-red-600">
            {formatAmount(expense)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">잔액</p>
          <p className="text-base font-semibold tabular-nums">{formatAmount(balance)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
