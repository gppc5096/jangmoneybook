'use client';

import { useEffect } from 'react';
import { useAutoLogin } from '@/hooks/useAutoLogin';
import { useAppStore } from '@/lib/store';
import { GreetingModal } from '@/components/GreetingModal';
import { LoginForm } from '@/components/LoginForm';

/** 앱 전역에서 자동 로그인과 Firestore 구독을 한 번만 시작하고, 자동 로그인 실패 시 수동 로그인 화면을 보여준다. */
export function AppInit({ children }: { children: React.ReactNode }) {
  const status = useAutoLogin();
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </div>
    );
  }

  if (status === 'failed') {
    return <LoginForm />;
  }

  return (
    <>
      {children}
      <GreetingModal />
    </>
  );
}
