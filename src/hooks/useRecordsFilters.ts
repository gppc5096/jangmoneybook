'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  currentMonthKey,
  monthKey,
  shiftMonth,
  summarize,
} from '@/lib/format';
import type { Transaction, TransactionType } from '@/types';

export type TypeFilter = 'all' | TransactionType;

export function useRecordsFilters(transactions: Transaction[]) {
  const [month, setMonth] = useState(currentMonthKey);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const monthTransactions = useMemo(
    () => transactions.filter((t) => monthKey(t.date) === month),
    [transactions, month],
  );

  const summary = useMemo(() => summarize(monthTransactions), [monthTransactions]);

  const visible = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return monthTransactions.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
      if (q && !`${t.itemName ?? ''} ${t.note ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [monthTransactions, keyword, typeFilter, categoryFilter]);

  // 필터·페이지 크기가 바뀌면 이전 페이지에 머물러 빈 화면이 뜨지 않도록 1페이지로 되돌린다.
  useEffect(() => {
    setPage(1);
  }, [month, keyword, typeFilter, categoryFilter, pageSize]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginated = useMemo(
    () => visible.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [visible, currentPage, pageSize],
  );

  function goPrevMonth() {
    setMonth((m) => shiftMonth(m, -1));
  }

  function goNextMonth() {
    setMonth((m) => shiftMonth(m, 1));
  }

  function goPrevPage() {
    setPage((p) => Math.max(1, p - 1));
  }

  function goNextPage() {
    setPage((p) => Math.min(pageCount, p + 1));
  }

  return {
    month,
    setMonth,
    goPrevMonth,
    goNextMonth,
    keyword,
    setKeyword,
    typeFilter,
    setTypeFilter,
    categoryFilter,
    setCategoryFilter,
    pageSize,
    setPageSize,
    page,
    setPage,
    goPrevPage,
    goNextPage,
    monthTransactions,
    summary,
    visible,
    paginated,
    pageCount,
    currentPage,
  };
}
