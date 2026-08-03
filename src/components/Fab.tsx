'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Plus } from 'lucide-react';
import { TransactionSheet } from '@/components/TransactionSheet';

const FAB_SIZE = 56;
const EDGE_MARGIN = 16;
const BOTTOM_DEFAULT_OFFSET = 80;
const DRAG_THRESHOLD = 6;
const POSITION_KEY = 'fab-position';

interface Position {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function defaultPosition(): Position {
  return {
    x: window.innerWidth - FAB_SIZE - EDGE_MARGIN,
    y: window.innerHeight - FAB_SIZE - BOTTOM_DEFAULT_OFFSET,
  };
}

function clampPosition(pos: Position): Position {
  return {
    x: clamp(pos.x, EDGE_MARGIN, Math.max(EDGE_MARGIN, window.innerWidth - FAB_SIZE - EDGE_MARGIN)),
    y: clamp(pos.y, EDGE_MARGIN, Math.max(EDGE_MARGIN, window.innerHeight - FAB_SIZE - EDGE_MARGIN)),
  };
}

export function Fab() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  useEffect(() => {
    let initial: Position;
    try {
      const saved = window.localStorage.getItem(POSITION_KEY);
      initial = saved ? clampPosition(JSON.parse(saved)) : defaultPosition();
    } catch {
      initial = defaultPosition();
    }
    setPosition(initial);

    function handleResize() {
      setPosition((prev) => (prev ? clampPosition(prev) : prev));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handlePointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (!position) return;
    draggingRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!position) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!draggingRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      draggingRef.current = true;
    }
    if (draggingRef.current) {
      setPosition(
        clampPosition({ x: startRef.current.posX + dx, y: startRef.current.posY + dy }),
      );
    }
  }

  function handlePointerUp(e: PointerEvent<HTMLButtonElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (draggingRef.current) {
      draggingRef.current = false;
      if (position) window.localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    } else {
      setOpen(true);
    }
  }

  return (
    <>
      {position && (
        <button
          type="button"
          aria-label="거래 추가 (드래그로 위치 이동 가능)"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ left: position.x, top: position.y }}
          className="fixed z-40 flex size-14 touch-none select-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="size-6" aria-hidden />
        </button>
      )}

      <TransactionSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
