'use client';

import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories';
import type {
  Category,
  CategoryInput,
  Transaction,
  TransactionInput,
} from '@/types';

const txCol = (uid: string) => collection(db, 'users', uid, 'transactions');
const catCol = (uid: string) => collection(db, 'users', uid, 'categories');

interface AppState {
  uid: string | null;
  email: string | null;
  authReady: boolean;
  loading: boolean;
  error: string | null;
  transactions: Transaction[];
  categories: Category[];
  init: () => void;
  addTransaction: (input: TransactionInput) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<TransactionInput>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (input: Omit<CategoryInput, 'isDefault'>) => Promise<void>;
  updateCategory: (id: string, patch: Partial<CategoryInput>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

let authUnsub: (() => void) | null = null;
let txUnsub: (() => void) | null = null;

function toMessage(e: unknown) {
  return e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
}

/** 최초 로그인 시 categories 가 비어 있으면 기본 분류를 batch 로 심는다. */
async function loadCategories(uid: string): Promise<Category[]> {
  const snap = await getDocs(catCol(uid));

  if (!snap.empty) {
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Category)
      .sort((a, b) => a.order - b.order);
  }

  const batch = writeBatch(db);
  const seeded: Category[] = DEFAULT_CATEGORIES.map((preset) => {
    const ref = doc(catCol(uid));
    const subCategories = preset.subCategories.map((name, i) => ({
      id: `${ref.id}-${i}`,
      name,
    }));
    batch.set(ref, {
      name: preset.name,
      type: preset.type,
      color: preset.color,
      order: preset.order,
      isDefault: true,
      subCategories,
      createdAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      name: preset.name,
      type: preset.type,
      color: preset.color,
      order: preset.order,
      isDefault: true,
      subCategories,
      createdAt: null,
    };
  });
  await batch.commit();
  return seeded;
}

export const useAppStore = create<AppState>((set, get) => {
  const requireUid = () => {
    const { uid } = get();
    if (!uid) throw new Error('로그인 후 이용할 수 있습니다.');
    return uid;
  };

  return {
    uid: null,
    email: null,
    authReady: false,
    loading: false,
    error: null,
    transactions: [],
    categories: [],

    // 앱 수명 동안 한 번만 구독한다 (StrictMode 이중 마운트 방어).
    init: () => {
      if (authUnsub) return;

      authUnsub = onAuthStateChanged(auth, async (user) => {
        txUnsub?.();
        txUnsub = null;

        if (!user) {
          set({
            uid: null,
            email: null,
            authReady: true,
            loading: false,
            transactions: [],
            categories: [],
          });
          return;
        }

        set({
          uid: user.uid,
          email: user.email,
          authReady: true,
          loading: true,
          error: null,
        });

        try {
          set({ categories: await loadCategories(user.uid) });
        } catch (e) {
          set({ error: toMessage(e), loading: false });
          return;
        }

        // 거래 내역은 기기 간 즉시 반영이 필요해 realtime 구독 (PRD 3-5).
        txUnsub = onSnapshot(
          query(txCol(user.uid), orderBy('date', 'desc')),
          (snap) => {
            set({
              transactions: snap.docs.map(
                (d) => ({ id: d.id, ...d.data() }) as Transaction,
              ),
              loading: false,
              error: null,
            });
          },
          (e) => set({ error: toMessage(e), loading: false }),
        );
      });
    },

    addTransaction: async (input) => {
      const uid = requireUid();
      await addDoc(txCol(uid), {
        ...input,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },

    updateTransaction: async (id, patch) => {
      const uid = requireUid();
      await updateDoc(doc(txCol(uid), id), { ...patch, updatedAt: serverTimestamp() });
    },

    deleteTransaction: async (id) => {
      const uid = requireUid();
      await deleteDoc(doc(txCol(uid), id));
    },

    addCategory: async (input) => {
      const uid = requireUid();
      const ref = await addDoc(catCol(uid), {
        ...input,
        isDefault: false,
        createdAt: serverTimestamp(),
      });
      set({
        categories: [
          ...get().categories,
          { id: ref.id, ...input, isDefault: false, createdAt: null },
        ].sort((a, b) => a.order - b.order),
      });
    },

    updateCategory: async (id, patch) => {
      const uid = requireUid();
      await updateDoc(doc(catCol(uid), id), patch);
      set({
        categories: get()
          .categories.map((c) => (c.id === id ? { ...c, ...patch } : c))
          .sort((a, b) => a.order - b.order),
      });
    },

    // 기존 거래는 지우지 않는다. 참조가 끊긴 거래는 '(삭제된 분류)'로 표시된다 (PRD 4-2).
    deleteCategory: async (id) => {
      const uid = requireUid();
      const target = get().categories.find((c) => c.id === id);
      if (!target) throw new Error('분류를 찾을 수 없습니다.');
      if (target.isDefault) throw new Error('기본 분류는 삭제할 수 없습니다.');

      await deleteDoc(doc(catCol(uid), id));
      set({ categories: get().categories.filter((c) => c.id !== id) });
    },
  };
});
