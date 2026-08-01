'use client';

import { useAppStore } from '@/lib/store';

/** 인증/데이터 준비 전이거나 오류일 때 안내를 보여주고, 준비되면 null 을 반환한다. */
export function DataStatus() {
  const authReady = useAppStore((s) => s.authReady);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const uid = useAppStore((s) => s.uid);

  if (error) {
    return (
      <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!authReady) return <p className="text-sm text-muted-foreground">로그인 중…</p>;
  if (!uid) return <p className="text-sm text-muted-foreground">로그인이 필요합니다.</p>;
  if (loading) return <p className="text-sm text-muted-foreground">불러오는 중…</p>;
  return null;
}
