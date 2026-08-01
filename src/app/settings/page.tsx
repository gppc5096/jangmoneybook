'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryManager } from '@/components/CategoryManager';
import { DataStatus } from '@/components/DataStatus';
import { ExcelTools } from '@/components/ExcelTools';
import { useAppStore } from '@/lib/store';

export default function SettingsPage() {
  const email = useAppStore((s) => s.email);
  const transactionCount = useAppStore((s) => s.transactions.length);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">설정</h1>

      <DataStatus />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">계정 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">이메일</span>
            <span className="truncate">{email ?? '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">저장된 거래</span>
            <span className="tabular-nums">{transactionCount}건</span>
          </div>
        </CardContent>
      </Card>

      <CategoryManager />
      <ExcelTools />
    </div>
  );
}
