'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CONTENT_WIDTH_CLASS } from '@/lib/layout';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const RELOAD_FALLBACK_MS = 4000;
// 이 값 자체에 의미는 없고, 세션 안에서 "닫음" 여부만 표시한다.
const DISMISSED_KEY = 'update-toast-dismissed';

export function UpdateToast() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [activating, setActivating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const reloadedRef = useRef(false);

  function reloadOnce() {
    if (reloadedRef.current) return;
    reloadedRef.current = true;
    window.location.reload();
  }

  // 새로 감지된 업데이트는 이전에 닫았던 것과 무관하게 다시 알린다.
  function announceUpdate(worker: ServiceWorker) {
    window.sessionStorage.removeItem(DISMISSED_KEY);
    setDismissed(false);
    setWaitingWorker(worker);
  }

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (window.sessionStorage.getItem(DISMISSED_KEY) === '1') setDismissed(true);

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
          announceUpdate(installing);
        }
      });
    }

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration || cancelled) return;
      registrationRef = registration;

      if (registration.waiting && navigator.serviceWorker.controller) {
        announceUpdate(registration.waiting);
      }
      registration.addEventListener('updatefound', () => watchInstalling(registration));

      // PWA를 오래 켜둔 채 방치할 수 있어, 주기적으로 + 화면 복귀 시 새 버전을 확인한다.
      intervalId = window.setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', handleVisibility);
    });

    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce);
    };
  }, []);

  function handleUpdateClick() {
    if (!waitingWorker) return;
    setActivating(true);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    // iOS Safari(홈 화면 PWA)는 controllerchange가 지연되거나 아예 안 오는 경우가 있어,
    // 일정 시간 안에 새로고침이 안 되면 강제로 새로고침해 탭이 먹통처럼 보이지 않게 한다.
    window.setTimeout(reloadOnce, RELOAD_FALLBACK_MS);
  }

  // 업데이트가 이런저런 이유로 끝까지 진행되지 않아도 사용자가 직접 닫을 수 있어야 한다.
  function handleDismiss() {
    window.sessionStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  if (!waitingWorker || dismissed) return null;

  return (
    <div className={`pointer-events-none fixed inset-x-0 bottom-20 z-50 ${CONTENT_WIDTH_CLASS}`}>
      <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-lg">
        <p className="text-sm font-medium">새 버전이 있어요.</p>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label="나중에"
            disabled={activating}
            onClick={handleDismiss}
          >
            <X className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0"
            disabled={activating}
            onClick={handleUpdateClick}
          >
            <RefreshCw className={activating ? 'size-4 animate-spin' : 'size-4'} aria-hidden />
            {activating ? '업데이트하는 중…' : '업데이트'}
          </Button>
        </div>
      </div>
    </div>
  );
}
