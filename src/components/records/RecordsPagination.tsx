'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RecordsPagination({
  pageSize,
  onPageSizeChange,
  currentPage,
  pageCount,
  onPrevPage,
  onNextPage,
}: {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  currentPage: number;
  pageCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        aria-label="페이지당 표시 개수"
        className="h-10 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value={10}>10개</option>
        <option value={20}>20개</option>
        <option value={30}>30개</option>
      </select>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          aria-label="이전 페이지"
          disabled={currentPage <= 1}
          onClick={onPrevPage}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          {currentPage} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          aria-label="다음 페이지"
          disabled={currentPage >= pageCount}
          onClick={onNextPage}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
