/** 앱 사용자 표시 이름 — 단일 사용자 앱이므로 기기 로컬에 저장한다. */

const DISPLAY_NAME_KEY = 'app-user-display-name';
const NAME_CHANGED_EVENT = 'app-user-display-name-changed';

export function getDisplayName(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(DISPLAY_NAME_KEY)?.trim() ?? '';
}

export function setDisplayName(name: string): void {
  const trimmed = name.trim().slice(0, 20);
  if (trimmed) {
    window.localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
  } else {
    window.localStorage.removeItem(DISPLAY_NAME_KEY);
  }
  window.dispatchEvent(new Event(NAME_CHANGED_EVENT));
}

export function subscribeDisplayName(onChange: () => void): () => void {
  const handler = () => onChange();
  window.addEventListener(NAME_CHANGED_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(NAME_CHANGED_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
