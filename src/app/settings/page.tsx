'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CategoryManager } from '@/components/CategoryManager';
import { DataStatus } from '@/components/DataStatus';
import { ExcelTools } from '@/components/ExcelTools';
import { useAppStore } from '@/lib/store';
import { getDisplayName, setDisplayName, subscribeDisplayName } from '@/lib/userProfile';

export default function SettingsPage() {
  const email = useAppStore((s) => s.email);
  const transactionCount = useAppStore((s) => s.transactions.length);

  const [nameDraft, setNameDraft] = useState('');
  const [savedName, setSavedName] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const name = getDisplayName();
      setSavedName(name);
      setNameDraft(name);
    };
    sync();
    return subscribeDisplayName(sync);
  }, []);

  function handleSaveName() {
    const next = nameDraft.trim().slice(0, 20);
    setDisplayName(next);
    setSavedName(next);
    setNameDraft(next);
    setSaveMessage(next ? '이름을 저장했습니다.' : '이름을 비웠습니다.');
  }

  const dirty = nameDraft.trim() !== savedName;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">설정</h1>

      <DataStatus />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">계정 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">이메일</span>
            <span className="truncate">{email ?? '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">저장된 거래</span>
            <span className="tabular-nums">{transactionCount}건</span>
          </div>

          <div className="space-y-2 border-t pt-4">
            <label htmlFor="display-name" className="text-sm font-medium">
              앱 사용자 이름
            </label>
            <p className="text-xs text-muted-foreground">
              앱을 열 때 드리는 인삿말에 사용됩니다.
            </p>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value.slice(0, 20));
                  setSaveMessage(null);
                }}
                placeholder="예: 어머니"
                maxLength={20}
                className="h-11 flex-1 text-base"
                autoComplete="name"
              />
              <Button
                type="button"
                className="h-11 shrink-0 px-4"
                disabled={!dirty}
                onClick={handleSaveName}
              >
                저장
              </Button>
            </div>
            {saveMessage && (
              <p className="text-xs text-muted-foreground" role="status">
                {saveMessage}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <CategoryManager />
      <ExcelTools />
    </div>
  );
}
