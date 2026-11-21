import { describe, expect, test } from 'bun:test';

const backing = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, value),
    removeItem: (key: string) => void backing.delete(key),
  },
});

const i18n = await import('./i18n');

describe('i18n', () => {
  test('resolves English messages and type labels', () => {
    i18n.setLocale('en');
    expect(i18n.t('preview.title')).toBe('Pack files');
    expect(i18n.t('preview.files', 1)).toBe('1 file');
    expect(i18n.t('preview.binary', 4)).toBe('Binary asset · 4 bytes');
    expect(i18n.typeLabel('block')).toBe('Blocks');
    expect(i18n.t('validation.required', 'input')).toBe('input is required');
    expect(i18n.t('validation.min', 'light_level', 0)).toBe('light_level must be at least 0');
  });

  test('resolves Chinese messages and type labels', () => {
    const englishTitle = i18n.t('preview.title');
    i18n.setLocale('zh');
    expect(i18n.t('preview.title')).toBe('整包文件');
    expect(i18n.t('preview.files', 2)).toBe('2 个文件');
    expect(i18n.t('preview.binary', 4)).toBe('二进制资源 · 4 字节');
    expect(i18n.typeLabel('dimension_type')).toBe('维度类型');
    expect(i18n.t('validation.required', 'input')).toBe('input 为必填项');
    expect(i18n.t('preview.title')).not.toBe(englishTitle);
    i18n.setLocale('en');
  });

  test('persists the chosen locale', () => {
    i18n.setLocale('zh');
    expect(backing.get('oml-editor:locale')).toBe('zh');
    i18n.setLocale('en');
    expect(backing.get('oml-editor:locale')).toBe('en');
  });
});
