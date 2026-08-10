'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { currentMonthKey, monthKey, monthLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types';

export function MonthNav({
  month,
  transactions,
  onMonthChange,
  onPrevMonth,
  onNextMonth,
}: {
  month: string;
  transactions: Transaction[];
  onMonthChange: (month: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => Number(currentMonthKey().slice(0, 4)));
  const [yearSelectOpen, setYearSelectOpen] = useState(false);

  function openMonthPicker() {
    setPickerYear(Number(month.slice(0, 4)));
    setYearSelectOpen(false);
    setPickerOpen(true);
  }

  const yearOptions = useMemo(() => {
    const years = transactions.map((t) => Number(monthKey(t.date).slice(0, 4)));
    years.push(Number(currentMonthKey().slice(0, 4)), pickerYear);
    const min = Math.min(...years);
    const max = Math.max(...years);
    const list: number[] = [];
    for (let y = max; y >= min; y--) list.push(y);
    return list;
  }, [transactions, pickerYear]);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label="이전 달"
          onClick={onPrevMonth}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <button
          type="button"
          onClick={openMonthPicker}
          className="h-11 flex-1 rounded-full border border-input text-base font-semibold transition-colors hover:bg-accent"
        >
          {monthLabel(month)}
        </button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label="다음 달"
          onClick={onNextMonth}
        >
          <ChevronRight className="size-5" aria-hidden />
        </Button>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent variant="center" className="gap-4">
          <DialogTitle>년/월 선택</DialogTitle>
          <DialogDescription className="sr-only">
            조회할 연도와 월을 선택합니다.
          </DialogDescription>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="이전 연도"
              onClick={() => setPickerYear((y) => y - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <button
              type="button"
              onClick={() => setYearSelectOpen((v) => !v)}
              aria-pressed={yearSelectOpen}
              className="rounded-md px-2 text-lg font-semibold underline decoration-dotted underline-offset-4"
            >
              {pickerYear}년
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="다음 연도"
              onClick={() => setPickerYear((y) => y + 1)}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>

          {yearSelectOpen ? (
            <select
              aria-label="연도 선택"
              value={pickerYear}
              onChange={(e) => {
                setPickerYear(Number(e.target.value));
                setYearSelectOpen(false);
              }}
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }, (_, i) => {
                const key = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
                const active = key === month;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onMonthChange(key);
                      setPickerOpen(false);
                    }}
                    className={cn(
                      'h-12 rounded-md border text-sm font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input',
                    )}
                  >
                    {i + 1}월
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
