'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { categoryLabel, formatSigned } from '@/lib/format';
import type { Category, Transaction } from '@/types';

export function TransactionDeleteDialog({
  target,
  categories,
  deleting,
  onOpenChange,
  onConfirm,
}: {
  target: Transaction | null;
  categories: Category[];
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent variant="center" className="gap-4">
        <DialogTitle>거래 삭제</DialogTitle>
        <DialogDescription>
          {target
            ? `"${target.itemName || categoryLabel(categories, target.categoryId).name}" (${formatSigned(target.type, target.amount)}) 거래를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`
            : '이 거래를 삭제할까요? 이 작업은 되돌릴 수 없습니다.'}
        </DialogDescription>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1"
            disabled={deleting}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11 flex-1"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? '삭제하는 중…' : '삭제'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
