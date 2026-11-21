import type { Pack } from './model';
import { packToToml } from './toml';

/**
 * localStorage autosave: the pack rides as its single-file TOML form (the same text the preview
 * pane shows), the namespace next to it. Assets (bytes) do **not** persist — localStorage caps
 * around 5 MB of strings and textures blow past it; they stay session-only, and the export/import
 * `.oml` path is the durable route for them.
 */

const KEY_NAMESPACE = 'oml-editor:namespace';
const KEY_PACK = 'oml-editor:pack-toml';
const KEY_COLLAPSED = 'oml-editor:collapsed';

export function saveDraft(pack: Pack): void {
  try {
    localStorage.setItem(KEY_NAMESPACE, pack.namespace);
    localStorage.setItem(KEY_PACK, packToToml(pack));
  } catch {
    // Quota/private-mode failures must not take the editor down — autosave is best-effort.
  }
}

export interface Draft {
  namespace: string;
  text: string;
}

/** Returns the saved draft, or null when nothing (or nothing readable) is stored. */
export function loadDraft(): Draft | null {
  try {
    const namespace = localStorage.getItem(KEY_NAMESPACE);
    const text = localStorage.getItem(KEY_PACK);
    if (namespace === null || text === null || text === '') return null;
    return { namespace, text };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY_NAMESPACE);
    localStorage.removeItem(KEY_PACK);
  } catch {
    // ignore
  }
}

/** Which tree sections the user folded away; a UI preference, stored beside the draft. */
export function saveCollapsed(types: string[]): void {
  try {
    localStorage.setItem(KEY_COLLAPSED, JSON.stringify(types));
  } catch {
    // best-effort, like the draft
  }
}

export function loadCollapsed(): string[] {
  try {
    const stored = localStorage.getItem(KEY_COLLAPSED);
    if (stored === null) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
