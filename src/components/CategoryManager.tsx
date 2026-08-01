'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppStore } from '@/lib/store';
import { CATEGORY_COLORS } from '@/lib/defaultCategories';
import { cn } from '@/lib/utils';
import type { Category, TransactionType } from '@/types';

interface EditorState {
  id: string | null;
  name: string;
  type: TransactionType;
  color: string;
  subText: string;
}

function toEditorState(category: Category): EditorState {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    color: category.color,
    subText: category.subCategories.map((s) => s.name).join(', '),
  };
}

export function CategoryManager() {
  const categories = useAppStore((s) => s.categories);
  const addCategory = useAppStore((s) => s.addCategory);
  const updateCategory = useAppStore((s) => s.updateCategory);
  const deleteCategory = useAppStore((s) => s.deleteCategory);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openNew(type: TransactionType) {
    setError(null);
    setEditor({ id: null, name: '', type, color: CATEGORY_COLORS[0], subText: '' });
  }

  async function handleSave() {
    if (!editor) return;
    const name = editor.name.trim();
    if (!name) {
      setError('분류명을 입력해 주세요.');
      return;
    }

    const subNames = editor.subText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    setError(null);
    try {
      if (editor.id) {
        const existing = categories.find((c) => c.id === editor.id);
        await updateCategory(editor.id, {
          name,
          color: editor.color,
          subCategories: subNames.map((subName, i) => ({
            id: existing?.subCategories[i]?.id ?? `${editor.id}-${i}`,
            name: subName,
          })),
        });
      } else {
        const maxOrder = categories.reduce((max, c) => Math.max(max, c.order), 0);
        await addCategory({
          name,
          type: editor.type,
          color: editor.color,
          order: maxOrder + 1,
          subCategories: subNames.map((subName, i) => ({
            id: `${Date.now()}-${i}`,
            name: subName,
          })),
        });
      }
      setEditor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`'${category.name}' 분류를 삭제할까요? 기존 거래는 유지됩니다.`)) return;
    try {
      await deleteCategory(category.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">분류 관리</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {(['expense', 'income'] as const).map((type) => (
          <section key={type} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{type === 'expense' ? '지출' : '수입'}</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => openNew(type)}
              >
                <Plus className="size-4" aria-hidden />
                추가
              </Button>
            </div>
            <ul className="divide-y rounded-md border">
              {categories
                .filter((c) => c.type === type)
                .map((category) => (
                  <li key={category.id} className="flex items-center gap-2 p-2">
                    <span
                      aria-hidden
                      className="size-4 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{category.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {category.subCategories.map((s) => s.name).join(' · ') || '소분류 없음'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${category.name} 수정`}
                      className="size-11 shrink-0"
                      onClick={() => {
                        setError(null);
                        setEditor(toEditorState(category));
                      }}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${category.name} 삭제`}
                      className="size-11 shrink-0"
                      disabled={category.isDefault}
                      title={category.isDefault ? '기본 분류는 삭제할 수 없습니다.' : undefined}
                      onClick={() => handleDelete(category)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              {categories.filter((c) => c.type === type).length === 0 && (
                <li className="p-3 text-sm text-muted-foreground">분류가 없습니다.</li>
              )}
            </ul>
          </section>
        ))}
      </CardContent>

      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="gap-4">
          <DialogTitle>{editor?.id ? '분류 수정' : '분류 추가'}</DialogTitle>
          <DialogDescription className="sr-only">
            분류명, 색상, 소분류를 입력합니다.
          </DialogDescription>

          {editor && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="cat-name" className="text-sm font-medium">
                  분류명
                </label>
                <Input
                  id="cat-name"
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">색상</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`색상 ${color}`}
                      aria-pressed={editor.color === color}
                      onClick={() => setEditor({ ...editor, color })}
                      className={cn(
                        'size-11 rounded-full border-2',
                        editor.color === color ? 'border-foreground' : 'border-transparent',
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="cat-subs" className="text-sm font-medium">
                  소분류 (쉼표로 구분)
                </label>
                <Input
                  id="cat-subs"
                  value={editor.subText}
                  placeholder="식재료, 외식, 배달"
                  onChange={(e) => setEditor({ ...editor, subText: e.target.value })}
                  className="h-12 text-base"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="button"
                className="h-12 w-full text-base"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? '저장 중…' : '저장'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
