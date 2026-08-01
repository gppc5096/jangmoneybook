import type { Timestamp } from 'firebase/firestore';

export type TransactionType = 'income' | 'expense';
export type TransactionSource = 'manual' | 'ocr' | 'import';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  categoryId: string;
  subCategoryId: string | null;
  amount: number;
  note: string | null;
  source: TransactionSource;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

export interface SubCategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  subCategories: SubCategory[];
  order: number;
  isDefault: boolean;
  createdAt: Timestamp | null;
}

export type CategoryInput = Omit<Category, 'id' | 'createdAt'>;

export interface OcrReceiptItem {
  name: string;
  amount: number;
}

export interface OcrCategoryMatch {
  /** 클라이언트가 보낸 기존 분류 이름 중 정확히 일치하는 것. 없으면 null. */
  matchedName: string | null;
  type: TransactionType;
  /** matchedName 이 없을 때 AI 가 제안하는 새 대분류(관) 이름. */
  suggestedName: string | null;
  /** suggestedName 이 있을 때 그 아래 소분류(항) 제안 (1~3개). */
  suggestedSubCategories: string[];
}

export interface OcrResult {
  date: string | null;
  totalAmount: number | null;
  merchant: string | null;
  items: OcrReceiptItem[];
  confidence: number;
  categoryMatch: OcrCategoryMatch;
}
