import { useAppStore } from '@/lib/store';
import { pickCategoryColor } from '@/lib/defaultCategories';
import type { Category, TransactionType } from '@/types';

export interface CategorySuggestion {
  name: string;
  type: TransactionType;
  subCategories: string[];
}

/** AI 가 제안한 분류를 실제로 만든다. 사용자가 한 번 확인하고 만든 분류이므로 기본 분류와 동일하게 삭제 보호한다. */
export async function createSuggestedCategory(
  suggestion: CategorySuggestion,
): Promise<Category | null> {
  const { categories, addCategory, updateCategory } = useAppStore.getState();
  const order = categories.reduce((max, c) => Math.max(max, c.order), 0) + 1;

  await addCategory({
    name: suggestion.name,
    type: suggestion.type,
    color: pickCategoryColor(categories),
    order,
    subCategories: suggestion.subCategories.map((name, i) => ({
      id: `sub-${Date.now()}-${i}`,
      name,
    })),
  });

  const created = useAppStore
    .getState()
    .categories.find((c) => c.type === suggestion.type && c.name === suggestion.name);
  if (!created) return null;

  await updateCategory(created.id, { isDefault: true });
  return created;
}
