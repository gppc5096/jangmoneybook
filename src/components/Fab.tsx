'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { TransactionSheet } from '@/components/TransactionSheet';
import { CONTENT_WIDTH_CLASS } from '@/lib/layout';

export function Fab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* 콘텐츠 열과 같은 폭의 투명 래퍼 안에 버튼을 절대 배치해, 화면이 넓어져도 콘텐츠 오른쪽 끝에 맞춘다. */}
      <div className={`pointer-events-none fixed inset-x-0 bottom-20 z-40 ${CONTENT_WIDTH_CLASS}`}>
        <button
          type="button"
          aria-label="거래 추가"
          onClick={() => setOpen(true)}
          className="pointer-events-auto absolute bottom-0 right-0 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="size-6" aria-hidden />
        </button>
      </div>

      <TransactionSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
