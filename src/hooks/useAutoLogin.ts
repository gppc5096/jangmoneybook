'use client';

import { useEffect, useState } from 'react';
import { signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export type AutoLoginStatus = 'loading' | 'authenticated' | 'failed';

// 앱 전역(레이아웃)에서 실행되므로 router.replace 없이 조용히 로그인만 시도한다.
// Custom Token 은 1회성이라 StrictMode 이중 마운트에서 중복 발급되지 않게 막는다.
let signInAttempted = false;

export function useAutoLogin(): AutoLoginStatus {
  const [status, setStatus] = useState<AutoLoginStatus>('loading');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setStatus('authenticated');
        return;
      }
      if (signInAttempted) {
        setStatus('failed');
        return;
      }
      signInAttempted = true;
      try {
        const res = await fetch('/api/auth/custom-token', { method: 'POST' });
        if (!res.ok) throw new Error(`custom-token responded ${res.status}`);
        const { token } = await res.json();
        await signInWithCustomToken(auth, token);
      } catch (e) {
        console.error('Auto login failed:', e);
        setStatus('failed');
      }
    });
    return () => unsub();
  }, []);

  return status;
}
