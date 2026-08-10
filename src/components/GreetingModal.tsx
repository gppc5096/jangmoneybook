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

export function GreetingModal() {
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState('');
  const openRef = useRef(false);

  const tryShow = useCallback(() => {
    if (typeof window === 'undefined') return;
    // 이미 이번 세션에서 닫았으면 다시 띄우지 않는다.
    if (window.sessionStorage.getItem(GREETING_SHOWN_KEY) === '1') return;
    // 이미 열려 있으면 중복 오픈하지 않는다.
    if (openRef.current) return;

    const name = getDisplayName();
    if (!name) return;

    openRef.current = true;
    setLine(buildGreetingLine(name, pickFaithMessage()));
    setOpen(true);
  }, []);

  useEffect(() => {
    // 로그인 직후 레이아웃이 안정된 뒤 한 틱 늦게 열어 포털 마운트 경쟁을 피한다.
    const timerId = window.setTimeout(tryShow, 300);
    const unsub = subscribeDisplayName(() => {
      // 설정에서 이름을 처음 저장한 경우에도 같은 세션에서 1회 표시.
      window.setTimeout(tryShow, 100);
    });
    return () => {
      window.clearTimeout(timerId);
      unsub();
    };
  }, [tryShow]);

  function handleClose() {
    window.sessionStorage.setItem(GREETING_SHOWN_KEY, '1');
    openRef.current = false;
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <DialogContent variant="center" className="gap-4">
        <DialogTitle className="pr-8 text-center text-xl leading-snug">
          오늘의 인사
        </DialogTitle>
        <DialogDescription className="text-center text-base leading-relaxed text-foreground">
          {line}
        </DialogDescription>
        <Button type="button" className="h-11 w-full" onClick={handleClose}>
          아멘
        </Button>
      </DialogContent>
    </Dialog>
  );
}
