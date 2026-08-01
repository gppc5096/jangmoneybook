import type { TransactionType } from '@/types';

/** 12색 팔레트 — 모두 흰 글씨 대비 4.5:1 이상 (PRD 5-1 WCAG AA) */
export const CATEGORY_COLORS = [
  '#B91C1C',
  '#BE185D',
  '#C2410C',
  '#6D28D9',
  '#A16207',
  '#78350F',
  '#1D4ED8',
  '#0369A1',
  '#0F766E',
  '#15803D',
  '#475569',
  '#9D174D',
] as const;

export interface DefaultCategory {
  name: string;
  type: TransactionType;
  color: string;
  order: number;
  subCategories: string[];
}

/** 아직 쓰이지 않은 팔레트 색을 우선으로, 전부 쓰였다면 순환해서 고른다. */
export function pickCategoryColor(existing: { color: string }[]): string {
  const used = new Set(existing.map((c) => c.color));
  const unused = CATEGORY_COLORS.find((c) => !used.has(c));
  return unused ?? CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length];
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: '식비', type: 'expense', color: '#B91C1C', order: 1, subCategories: ['식재료', '외식', '배달'] },
  { name: '의료비', type: 'expense', color: '#BE185D', order: 2, subCategories: ['병원', '약국', '건강보조식품'] },
  { name: '교통비', type: 'expense', color: '#C2410C', order: 3, subCategories: ['버스·지하철', '주유', '택시'] },
  { name: '공과금·관리비', type: 'expense', color: '#6D28D9', order: 4, subCategories: ['전기', '수도', '가스', '관리비'] },
  { name: '용돈·경조사', type: 'expense', color: '#A16207', order: 5, subCategories: ['용돈', '경조사비', '기부'] },
  { name: '저축·보험', type: 'expense', color: '#78350F', order: 6, subCategories: ['저축', '보험료'] },
  { name: '연금·배당', type: 'income', color: '#1D4ED8', order: 7, subCategories: ['국민연금', '배당수입'] },
  { name: '주식 매도 수입', type: 'income', color: '#0369A1', order: 8, subCategories: ['주식매도', 'ETF 매도'] },
  { name: '기타 수입', type: 'income', color: '#0F766E', order: 9, subCategories: ['환급금', '부수입'] },
];
