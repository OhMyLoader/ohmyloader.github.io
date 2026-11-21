import { beforeEach, describe, expect, test } from 'bun:test';
import { emptyPack } from './model';
import { clearDraft, loadCollapsed, loadDraft, saveCollapsed, saveDraft } from './persist';

const backing = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, value),
    removeItem: (key: string) => void backing.delete(key),
  },
});

beforeEach(() => backing.clear());

describe('draft autosave', () => {
  test('stores the namespace and the pack as single-file TOML', () => {
    const pack = emptyPack('ruby_pack');
    pack.files.item.push({ id: 'ruby', maxDurability: 592 });
    saveDraft(pack);
    const draft = loadDraft();
    expect(draft?.namespace).toBe('ruby_pack');
    expect(draft?.text).toContain('[item.ruby]');
    expect(draft?.text).toContain('max_durability = 592');
  });

  test('clearDraft removes both keys', () => {
    saveDraft(emptyPack('ruby_pack'));
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  test('an empty stored pack counts as no draft', () => {
    backing.set('oml-editor:namespace', 'ruby_pack');
    backing.set('oml-editor:pack-toml', '');
    expect(loadDraft()).toBeNull();
  });
});

describe('tree state', () => {
  test('collapsed sections round-trip and ignore junk', () => {
    saveCollapsed(['block', 'item']);
    expect(loadCollapsed()).toEqual(['block', 'item']);
    backing.set('oml-editor:collapsed', '{"not":"a list"}');
    expect(loadCollapsed()).toEqual([]);
    backing.set('oml-editor:collapsed', '["block", 7, null]');
    expect(loadCollapsed()).toEqual(['block']);
  });
});
