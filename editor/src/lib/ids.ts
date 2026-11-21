/**
 * Resource-id rules shared by the editor, its validators and the export path. Mirrors
 * `TomlContentLoader`: a declared id is `/`-separated segments of `[a-z0-9_.-]+`; referenced ids
 * may add one `namespace:` prefix, and some fields accept a `#` tag reference.
 */

import { t } from './i18n';

/** One `/`-separated segment of a declared id (the loader's `ID` regex). */
const SEGMENT = /^[a-z0-9_.-]+$/;

/** The archive stem rule the header enforces (stricter: must start with a letter or digit). */
const NAMESPACE = /^[a-z0-9][a-z0-9_.-]*$/;

export function namespaceError(namespace: string): string | null {
  if (!NAMESPACE.test(namespace)) return t('ids.namespace', namespace);
  return null;
}

/** A declared entity id: `content/<type>/<id>.toml` path segments. */
export function entityIdError(id: string): string | null {
  if (id === '') return t('ids.entityIdEmpty');
  for (const segment of id.split('/')) {
    if (!SEGMENT.test(segment)) return t('ids.entityIdSegment', id);
  }
  return null;
}

/** A referenced id: optional `namespace:` prefix, optional `#` tag marker where the loader allows one. */
export function resourceIdError(value: string, opts: { tag?: boolean } = {}): string | null {
  let rest = value;
  if (rest.startsWith('#')) {
    if (!opts.tag) return t('ids.resourceNotTag', value);
    rest = rest.slice(1);
  }
  if (rest.includes('#')) return t('ids.misplacedHash', value);
  const colon = rest.indexOf(':');
  if (colon !== -1) {
    if (rest.indexOf(':', colon + 1) !== -1) return t('ids.multipleColons', value);
    const ns = rest.slice(0, colon);
    if (!SEGMENT.test(ns)) return t('ids.invalidNamespace', value);
    rest = rest.slice(colon + 1);
  }
  if (rest === '') return t('ids.emptyPath', value);
  for (const segment of rest.split('/')) {
    if (!SEGMENT.test(segment)) return t('ids.invalidPath', value);
  }
  return null;
}

/** A `#namespace:tag` reference, the only form the loader accepts for `infiniburn`. */
export function tagRefError(value: string): string | null {
  if (!value.startsWith('#')) return t('ids.tagPrefix', value);
  return resourceIdError(value.slice(1));
}

/**
 * The loader's TOML parser reads bare keys only, so a crafted key symbol or a marker name that is
 * not `[A-Za-z0-9_-]+` cannot be written into the inline table at all.
 */
export const BARE_KEY = /^[A-Za-z0-9_-]+$/;

export function keyCharError(ch: string): string | null {
  return ch.length === 1 && BARE_KEY.test(ch) ? null : t('ids.keyChar', ch);
}
