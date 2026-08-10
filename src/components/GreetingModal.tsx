'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildGreetingLine, pickFaithMessage } from '@/lib/faithMessages';
import { getDisplayName } from '@/lib/userProfile';

/** 앱 실행(세션)당 1회만 인삿말을 보여 주기 위한 키. */
const GREETING_SHOWN_KEY = 'greeting-modal-shown';

export function GreetingModal() {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayNameState] = useState('');

  const message = useMemo(() => pickFaithMessage(), []);
  const line = displayName ? buildGreetingLine(displayName, message) : '';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(GREETING_SHOWN_KEY) === '1') return;

    const name = getDisplayName();
    if (!name) return;

    setDisplayNameState(name);
    setOpen(true);
    window.sessionStorage.setItem(GREETING_SHOWN_KEY, '1');
  }, []);

  function handleClose() {
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
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
