'use client';

import { useMemo, useState } from 'react';
import { DataStatus } from '@/components/DataStatus';
import { MonthNav } from '@/components/records/MonthNav';
import { MonthSummaryCard } from '@/components/records/MonthSummaryCard';
import { RecordsFilterBar } from '@/components/records/RecordsFilterBar';
import { RecordsPagination } from '@/components/records/RecordsPagination';
import { TransactionDeleteDialog } from '@/components/records/TransactionDeleteDialog';
import { TransactionList } from '@/components/records/TransactionList';
import { useRecordsFilters } from '@/hooks/useRecordsFilters';
import { useTransactionEdit } from '@/hooks/useTransactionEdit';
import { useAppStore } from '@/lib/store';

export default function RecordsPage() {
  const transactions = useAppStore((s) => s.transactions);
  const categories = useAppStore((s) => s.categories);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const deleteTransaction = useAppStore((s) => s.deleteTransaction);

  const filters = useRecordsFilters(transactions);
  const edit = useTransactionEdit(categories, updateTransaction);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const deleteTarget = useMemo(
    () => transactions.find((t) => t.id === deleteTargetId) ?? null,
    [transactions, deleteTargetId],
  );

  async function confirmDelete() {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await deleteTransaction(deleteTargetId);
      setDeleteTargetId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">기록</h1>

      <DataStatus />

      <MonthNav
        month={filters.month}
        transactions={transactions}
        onMonthChange={filters.setMonth}
        onPrevMonth={filters.goPrevMonth}
        onNextMonth={filters.goNextMonth}
      />

      <TransactionDeleteDialog
        target={deleteTarget}
        categories={categories}
        deleting={deleting}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        onConfirm={confirmDelete}
      />

      <MonthSummaryCard
        income={filters.summary.income}
        expense={filters.summary.expense}
        balance={filters.summary.balance}
      />

      <RecordsFilterBar
        typeFilter={filters.typeFilter}
        onTypeFilterChange={filters.setTypeFilter}
        keyword={filters.keyword}
        onKeywordChange={filters.setKeyword}
        categoryFilter={filters.categoryFilter}
        onCategoryFilterChange={filters.setCategoryFilter}
        categories={categories}
      />

      <TransactionList
        transactions={filters.paginated}
        categories={categories}
        editingId={edit.editingId}
        draft={edit.draft}
        editError={edit.editError}
        saving={edit.saving}
        onStartEdit={edit.startEdit}
        onDelete={setDeleteTargetId}
        onTypeChange={edit.handleDraftTypeChange}
        onDateChange={edit.setDraftDate}
        onAmountChange={edit.handleDraftAmountChange}
        onCategoryChange={edit.setDraftCategoryId}
        onSubCategoryChange={edit.setDraftSubCategoryId}
        onItemNameChange={edit.setDraftItemName}
        onNoteChange={edit.setDraftNote}
        onCancelEdit={edit.cancelEdit}
        onSaveEdit={edit.handleSaveEdit}
      />

      {filters.visible.length > 0 && (
        <RecordsPagination
          pageSize={filters.pageSize}
          onPageSizeChange={filters.setPageSize}
          currentPage={filters.currentPage}
          pageCount={filters.pageCount}
          onPrevPage={filters.goPrevPage}
          onNextPage={filters.goNextPage}
        />
      )}
    </div>
  );
}
