import { strFromU8, strToU8, unzip, zip } from 'fflate';
import { parse } from 'smol-toml';
import type { ContentType, Entity, Pack } from './model';
import { CONTENT_TYPES, emptyPack } from './model';
import { namespaceError } from './ids';
import { codecs, entityToml, packFromToml, packToToml } from './toml';

/**
 * `.oml` archive I/O. The archive is a zip: `content/<type>/<id>.toml` (one file per entity) plus
 * `assets/<namespace>/…` passthrough. The namespace binds every entity id and is the archive stem,
 * lowercased (`TomlContentLoader.namespaceOf`).
 */

export { namespaceError };

/**
 * Export the pack as an `.oml` archive: every entity becomes `content/<type>/<id>.toml`, and the
 * assets map (path → bytes) rides along as `assets/…`. Returns the zip bytes.
 */
export async function exportPack(
  pack: Pack,
  assets: Record<string, Uint8Array> = {},
): Promise<Uint8Array> {
  const err = namespaceError(pack.namespace);
  if (err) throw new Error(err);
  const files: Record<string, Uint8Array> = {};
  for (const type of CONTENT_TYPES) {
    const codec = codecs[type];
    for (const entity of pack.files[type]) {
      const toml = entityToml(codec.toToml(entity as Entity) as Record<string, unknown>);
      files[`content/${type}/${entity.id}.toml`] = strToU8(toml);
    }
  }
  for (const [path, bytes] of Object.entries(assets)) {
    // Normalize to assets/… if the caller passed a bare pack-relative path.
    const key = path.startsWith('assets/') ? path : `assets/${pack.namespace}/${path}`;
    files[key] = bytes;
  }
  return new Promise((resolve, reject) => {
    zip(files, (err2, data) => (err2 ? reject(err2) : resolve(new Uint8Array(data))));
  });
}

/** Triggers a browser download of the pack archive. */
export async function downloadPack(pack: Pack, assets: Record<string, Uint8Array> = {}): Promise<void> {
  const bytes = await exportPack(pack, assets);
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pack.namespace}.oml`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import from raw archive bytes (the File-based path delegates here). */
export async function importPackFromBytes(
  bytes: Uint8Array,
  fileName: string,
): Promise<{ pack: Pack; assets: Record<string, Uint8Array> }> {
  const namespace = fileName.replace(/.oml$/i, '').toLowerCase();
  const err = namespaceError(namespace);
  if (err) throw new Error(err);
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, (e, data) => (e ? reject(e) : resolve(data)));
  });
  const pack = emptyPack(namespace);
  const assets: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(entries)) {
    const match = /^content\/([a-z_]+)\/(.+)\.toml$/i.exec(path);
    if (match) {
      const type = match[1] as ContentType;
      const id = match[2];
      const codec = codecs[type];
      if (!codec) continue;
      const value = parse(strFromU8(data)) as Record<string, unknown>;
      (pack.files[type] as Entity[]).push(codec.fromToml(id, value));
      continue;
    }
    if (path.endsWith('/')) continue;
    assets[path] = data;
  }
  return { pack, assets };
}

/**
 * Import an `.oml` archive: parse every `content/<type>/<id>.toml` into entities; other entries
 * (assets/) are collected as passthrough bytes keyed by their archive path.
 */
export async function importPack(file: File): Promise<{ pack: Pack; assets: Record<string, Uint8Array> }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const namespace = file.name.replace(/\.oml$/i, '').toLowerCase();
  if (namespaceError(namespace)) {
    throw new Error(`archive name '${file.name}' must derive a valid namespace (lowercase letters, digits, . - _)`);
  }
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)));
  });

  const pack = emptyPack(namespace);
  const assets: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(entries)) {
    const match = /^content\/([a-z_]+)\/(.+)\.toml$/.exec(path);
    if (match) {
      const type = match[1] as ContentType;
      const id = match[2];
      const codec = codecs[type];
      if (!codec) continue; // unknown type: not a key the loader accepts
      const value = parse(strFromU8(data)) as Record<string, unknown>;
      (pack.files[type] as Entity[]).push(codec.fromToml(id, value));
      continue;
    }
    if (path.endsWith('/')) continue;
    assets[path] = data;
  }
  return { pack, assets };
}

export { packFromToml, packToToml };

// ---------- whole-pack single-file round trip (share packs as one TOML text) ----------

export function packToText(pack: Pack): string {
  return packToToml(pack);
}

export function packFromText(text: string, namespace: string): Pack {
  return packFromToml(text, namespace);
}
