import { createSignal } from 'solid-js';
import type { ContentType, Entity, Pack } from './model';
import { CONTENT_TYPES, emptyPack } from './model';
import { saveDraft, loadDraft, clearDraft } from './persist';
import { codecs, packFromToml } from './toml';

/**
 * The app's global pack state. One pack is open at a time (the editor edits the pack that the
 * loader would load); entity identity within a type is the id — renaming is remove + add.
 */

const saved = loadDraft();
let restored: Pack | null = null;
if (saved) {
  try {
    restored = packFromToml(saved.text, saved.namespace);
  } catch {
    // A corrupt draft must not brick the editor on boot; drop it and start empty.
    clearDraft();
  }
}
const [pack, setPack] = createSignal<Pack>(restored ?? emptyPack());
const [selected, setSelected] = createSignal<{ type: ContentType; id: string } | null>(null);
const [dirty, setDirty] = createSignal(false);

/** Best-effort autosave: every mutation marks dirty and re-serializes the draft. */
function touch() {
  setDirty(true);
  saveDraft(pack());
}
/** Passthrough archive members (assets/<namespace>/…): textures, lang files, data. Bytes survive import/export but not page reload. */
const [assets, setAssets] = createSignal<Record<string, Uint8Array>>({});

export { pack, selected, dirty, assets, setSelected };

export function replacePack(next: Pack, nextAssets: Record<string, Uint8Array> = {}) {
  setPack(next);
  setAssets(nextAssets);
  touch();
}

export function putAsset(path: string, bytes: Uint8Array) {
  setAssets((a) => ({ ...a, [path]: bytes }));
  touch();
}

export function removeAsset(path: string) {
  setAssets((a) => {
    const next = { ...a };
    delete next[path];
    return next;
  });
  touch();
}

export function assetPaths(): string[] {
  return Object.keys(assets()).sort();
}

export function markClean() {
  setDirty(false);
}

function entities(type: ContentType): Entity[] {
  return pack().files[type] as Entity[];
}

/** Unique id per type (the loader requires ids; duplicates within a type are rejections). */
export function idsOf(type: ContentType): string[] {
  return entities(type).map((e) => e.id);
}

export function findEntity(type: ContentType, id: string): Entity | undefined {
  return entities(type).find((e) => e.id === id);
}

export function addEntity(type: ContentType, entity: Entity): boolean {
  if (findEntity(type, entity.id)) return false;
  setPack((p) => ({ ...p, files: { ...p.files, [type]: [...(p.files[type] as Entity[]), entity] } }));
  touch();
  setSelected({ type, id: entity.id });
  return true;
}

export function updateEntity(type: ContentType, id: string, next: Entity) {
  setPack((p) => ({
    ...p,
    files: {
      ...p.files,
      [type]: (p.files[type] as Entity[]).map((e) => (e.id === id ? next : e)),
    },
  }));
  touch();
  if (next.id !== id) setSelected({ type, id: next.id });
}

export function removeEntity(type: ContentType, id: string) {
  setPack((p) => ({
    ...p,
    files: { ...p.files, [type]: (p.files[type] as Entity[]).filter((e) => e.id !== id) },
  }));
  touch();
  if (selected()?.type === type && selected()?.id === id) setSelected(null);
}

export function renameNamespace(namespace: string) {
  setPack((p) => ({ ...p, namespace }));
  touch();
}

/** Adds an entity with a fresh default payload, returning the assigned id. */
export function addDefault(type: ContentType, baseId: string): string {
  let id = baseId;
  let n = 2;
  while (findEntity(type, id)) id = `${baseId}_${n++}`;
  const entity = defaultEntity(type, id);
  addEntity(type, entity);
  return id;
}

function defaultEntity(type: ContentType, id: string): Entity {
  switch (type) {
    case 'block':
      return { id, hardness: 1.5 };
    case 'item':
      return { id };
    case 'crafting':
      return { id, type: 'shaped', pattern: ['RRR', 'RRR', 'RRR'], key: { R: 'minecraft:stone' }, count: 1 };
    case 'smelting':
      return { id, input: 'minecraft:stone', furnace: 'smelting', experience: 0.1, cookingTime: 200 };
    case 'loot':
      return { id, drop: 'minecraft:stick', dropCountMin: 1, dropCountMax: 2 };
    case 'damage_type':
      return { id, messageId: `appleskin_unknown.${id}`, scaling: 'when_caused_by_living_non_player', exhaustion: 0.1 };
    case 'clock':
      return { id };
    case 'timeline':
      return { id, clock: id, periodTicks: 24000, markers: [] };
    case 'dimension_type':
      return { id, minY: 0, height: 384, logicalHeight: 384, skybox: 'none' };
    case 'dimension':
      return { id, type: 'minecraft:overworld', biome: 'minecraft:plains' };
    case 'tag':
      return { id, registry: 'minecraft:block', tag: `my_tag`, values: [] };
  }
}

/** Replaces the open pack from a TOML text (import path). */
export function loadFromToml(text: string, namespace: string, nextAssets?: Record<string, Uint8Array>) {
  replacePack(packFromToml(text, namespace), nextAssets);
}

export { codecs, CONTENT_TYPES, emptyPack };
