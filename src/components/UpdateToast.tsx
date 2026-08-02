'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CONTENT_WIDTH_CLASS } from '@/lib/layout';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function UpdateToast() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    let intervalId: number | undefined;
    let registrationRef: ServiceWorkerRegistration | null = null;

    function handleVisibility() {
      if (document.visibilityState === 'visible') registrationRef?.update();
    }

    function watchInstalling(registration: ServiceWorkerRegistration) {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        // controller가 이미 있다는 건 최초 설치가 아니라 실행 중인 앱 위에 새 버전이 깔렸다는 뜻이다.
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          setWaitingWorker(installing);
        }
      });
    }

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration || cancelled) return;
      registrationRef = registration;

      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
      }
      registration.addEventListener('updatefound', () => watchInstalling(registration));

      // PWA를 오래 켜둔 채 방치할 수 있어, 주기적으로 + 화면 복귀 시 새 버전을 확인한다.
      intervalId = window.setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', handleVisibility);
    });

    let reloaded = false;
    function handleControllerChange() {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <div className={`pointer-events-none fixed inset-x-0 bottom-20 z-50 ${CONTENT_WIDTH_CLASS}`}>
      <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-lg">
        <p className="text-sm font-medium">새 버전이 있어요.</p>
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0"
          onClick={() => waitingWorker.postMessage({ type: 'SKIP_WAITING' })}
        >
          <RefreshCw className="size-4" aria-hidden />
          업데이트
        </Button>
      </div>
    </div>
  );
}
