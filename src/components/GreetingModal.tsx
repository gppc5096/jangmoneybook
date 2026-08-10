'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildGreetingLine, pickFaithMessage } from '@/lib/faithMessages';
import { getDisplayName, subscribeDisplayName } from '@/lib/userProfile';

/** 앱 실행(세션)당 1회만 인삿말을 보여 주기 위한 키. 닫을 때 기록한다. */
const GREETING_SHOWN_KEY = 'greeting-modal-shown';

/** 모바일에서 오픈 직후 focus/outside 이벤트로 바로 닫히는 것을 무시하는 보호 구간. */
const OPEN_GUARD_MS = 600;

export function GreetingModal() {
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState('');
  const openRef = useRef(false);
  const openedAtRef = useRef(0);

  const tryShow = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(GREETING_SHOWN_KEY) === '1') return;
    if (openRef.current) return;

    const name = getDisplayName();
    if (!name) return;

    openRef.current = true;
    openedAtRef.current = Date.now();
    setLine(buildGreetingLine(name, pickFaithMessage()));
    setOpen(true);
  }, []);

  useEffect(() => {
    // 실기기 자동 로그인이 끝난 뒤 레이아웃이 안정될 시간을 조금 더 준다.
    const timerId = window.setTimeout(tryShow, 500);
    // 느린 기기에서 localStorage/레이아웃 지연 대비 1회 재시도.
    const retryId = window.setTimeout(tryShow, 1500);
    const unsub = subscribeDisplayName(() => {
      window.setTimeout(tryShow, 100);
    });
    return () => {
      window.clearTimeout(timerId);
      window.clearTimeout(retryId);
      unsub();
    };
  }, [tryShow]);

  function markShownAndClose() {
    window.sessionStorage.setItem(GREETING_SHOWN_KEY, '1');
    openRef.current = false;
    setOpen(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setOpen(true);
      return;
    }
    // iOS/Android에서 오픈 직후 onOpenChange(false)가 튀는 경우가 있어 짧게 무시한다.
    if (Date.now() - openedAtRef.current < OPEN_GUARD_MS) {
      setOpen(true);
      openRef.current = true;
      return;
    }
    markShownAndClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        variant="center"
        className="gap-4"
        // 인삿말은 의도적으로 버튼으로만 닫는다 (모바일 바깥 탭/포커스 경합 방지).
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="pr-8 text-center text-xl leading-snug">
          오늘의 인사
        </DialogTitle>
        <DialogDescription className="text-center text-base leading-relaxed text-foreground">
          {line}
        </DialogDescription>
        <Button type="button" className="h-11 w-full" onClick={markShownAndClose}>
          아멘
        </Button>
      </DialogContent>
    </Dialog>
  );
}
