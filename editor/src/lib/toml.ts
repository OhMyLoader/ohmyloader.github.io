import { parse, stringify } from 'smol-toml';
import { BARE_KEY } from './ids';
import type {
  BlockEntity,
  CraftingEntity,
  DamageTypeEntity,
  DimensionEntity,
  DimensionLayer,
  DimensionTypeEntity,
  Entity,
  ItemEntity,
  LootEntity,
  OreDeclaration,
  Pack,
  SmeltingEntity,
  TagEntity,
  TimelineEntity,
  TimelineMarker,
  ToolRule,
} from './model';

/**
 * Per-type TOML codecs. Shapes mirror the `content/<type>/<id>.toml` files `TomlContentLoader`
 * accepts: a bare `[<type>.<id>]` section whose keys are the loader's accepted key set. The editor
 * emits exactly what the loader parses — no extra keys, snake_case throughout.
 */

// ---------- small value helpers ----------

const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const list = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);

/** Drops undefined-valued keys so the TOML never carries empty defaults. */
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function toolRules(v: unknown): ToolRule[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const rules = v
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map((r) => ({ block: str(r.block) ?? '', speed: num(r.speed) ?? 1 }))
    .filter((r) => r.block !== '');
  return rules.length > 0 ? rules : undefined;
}

// ---------- per-type TOML ↔ entity ----------

type TomlValue = Record<string, unknown>;

export interface TypeCodec<T extends Entity> {
  toToml(entity: T): TomlValue;
  fromToml(id: string, value: TomlValue): T;
}

const blockCodec: TypeCodec<BlockEntity> = {
  toToml(e) {
    const out: TomlValue = compact({
      hardness: e.hardness,
      blast_resistance: e.blastResistance,
      drops_require_correct_tool: e.dropsRequireCorrectTool,
      light_level: e.lightLevel,
    });
    if (e.ore) {
      out.ore = compact({
        vein_size: e.ore.veinSize,
        per_chunk: e.ore.perChunk,
        min_y: e.ore.minY,
        max_y: e.ore.maxY,
        biomes: e.ore.biomes.length > 0 ? e.ore.biomes : undefined,
      });
    }
    return out;
  },
  fromToml(id, v) {
    const ore = v.ore as TomlValue | undefined;
    const entity: BlockEntity = {
      id,
      hardness: num(v.hardness),
      blastResistance: num(v.blast_resistance),
      dropsRequireCorrectTool: bool(v.drops_require_correct_tool),
      lightLevel: num(v.light_level),
    };
    if (ore) {
      entity.ore = {
        veinSize: num(ore.vein_size) ?? 9,
        perChunk: num(ore.per_chunk) ?? 8,
        minY: num(ore.min_y) ?? 16,
        maxY: num(ore.max_y) ?? 64,
        biomes: list(ore.biomes) ?? [],
      };
    }
    return entity;
  },
};

const itemCodec: TypeCodec<ItemEntity> = {
  toToml(e) {
    const out: TomlValue = compact({
      max_durability: e.maxDurability,
      attack_damage: e.attackDamage,
      attack_speed: e.attackSpeed,
      mining_speed: e.miningSpeed,
      tool_damage_per_block: e.toolDamagePerBlock,
      breaks_blocks_in_creative: e.breaksBlocksInCreative,
    });
    if (e.minesAndDrops?.length) out.mines_and_drops = e.minesAndDrops.map((r) => ({ ...r }));
    if (e.deniesDrops?.length) out.denies_drops = e.deniesDrops.map((r) => ({ ...r }));
    if (e.overrideSpeed?.length) out.override_speed = e.overrideSpeed.map((r) => ({ ...r }));
    return out;
  },
  fromToml(id, v) {
    return {
      id,
      maxDurability: num(v.max_durability),
      attackDamage: num(v.attack_damage),
      attackSpeed: num(v.attack_speed),
      miningSpeed: num(v.mining_speed),
      toolDamagePerBlock: num(v.tool_damage_per_block),
      breaksBlocksInCreative: bool(v.breaks_blocks_in_creative),
      minesAndDrops: toolRules(v.mines_and_drops),
      deniesDrops: toolRules(v.denies_drops),
      overrideSpeed: toolRules(v.override_speed),
    };
  },
};

const craftingCodec: TypeCodec<CraftingEntity> = {
  toToml(e) {
    return compact({
      type: e.type,
      count: e.count,
      pattern: e.pattern?.length ? e.pattern : undefined,
      key: e.key && Object.keys(e.key).length > 0 ? e.key : undefined,
      ingredients: e.ingredients?.length ? e.ingredients : undefined,
    });
  },
  fromToml(id, v) {
    const type = str(v.type) === 'shapeless' ? 'shapeless' : 'shaped';
    const keyRaw = v.key as TomlValue | undefined;
    return {
      id,
      type,
      count: num(v.count),
      pattern: list(v.pattern),
      key: keyRaw
        ? (Object.fromEntries(Object.entries(keyRaw).filter(([, x]) => typeof x === 'string')) as Record<string, string>)
        : undefined,
      ingredients: list(v.ingredients),
    };
  },
};

const smeltingCodec: TypeCodec<SmeltingEntity> = {
  toToml(e) {
    return compact({
      input: e.input,
      furnace: e.furnace !== 'smelting' ? e.furnace : undefined,
      experience: e.experience,
      cooking_time: e.cookingTime,
    });
  },
  fromToml(id, v) {
    const furnace = str(v.furnace);
    return {
      id,
      input: str(v.input) ?? '',
      furnace: furnace === 'blasting' || furnace === 'smoking' ? furnace : 'smelting',
      experience: num(v.experience),
      cookingTime: num(v.cooking_time),
    };
  },
};

const lootCodec: TypeCodec<LootEntity> = {
  toToml(e) {
    return compact({ drop: e.drop, drop_count_min: e.dropCountMin, drop_count_max: e.dropCountMax });
  },
  fromToml(id, v) {
    return { id, drop: str(v.drop) ?? '', dropCountMin: num(v.drop_count_min), dropCountMax: num(v.drop_count_max) };
  },
};

const damageTypeCodec: TypeCodec<DamageTypeEntity> = {
  toToml(e) {
    return compact({
      message_id: e.messageId,
      scaling: e.scaling && e.scaling !== 'when_caused_by_living_non_player' ? e.scaling : undefined,
      effects: e.effects,
      exhaustion: e.exhaustion,
      death_message_type: e.deathMessageType,
    });
  },
  fromToml(id, v) {
    return {
      id,
      messageId: str(v.message_id) ?? '',
      scaling: str(v.scaling) as DamageTypeEntity['scaling'],
      effects: str(v.effects) as DamageTypeEntity['effects'],
      exhaustion: num(v.exhaustion),
      deathMessageType: str(v.death_message_type) as DamageTypeEntity['deathMessageType'],
    };
  },
};

const clockCodec: TypeCodec<import('./model').ClockEntity> = {
  toToml() {
    return {};
  },
  fromToml(id) {
    return { id };
  },
};

function markerTable(markers: TimelineMarker[] | undefined): Record<string, unknown> | undefined {
  if (!markers?.length) return undefined;
  const out: Record<string, unknown> = {};
  for (const marker of markers) {
    out[marker.name] = marker.inCommands
      ? { ticks: marker.ticks, in_commands: true }
      : marker.ticks;
  }
  return out;
}

function markersFromToml(v: unknown): TimelineMarker[] | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: TimelineMarker[] = [];
  for (const [name, value] of Object.entries(v as TomlValue)) {
    if (typeof value === 'number') out.push({ name, ticks: value });
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const ticks = num((value as TomlValue).ticks);
      if (ticks !== undefined) out.push({ name, ticks, inCommands: bool((value as TomlValue).in_commands) });
    }
  }
  return out.length > 0 ? out : undefined;
}

const timelineCodec: TypeCodec<TimelineEntity> = {
  toToml(e) {
    return compact({
      clock: e.clock,
      period_ticks: e.periodTicks,
      markers: markerTable(e.markers),
    });
  },
  fromToml(id, v) {
    return {
      id,
      clock: str(v.clock) ?? '',
      periodTicks: num(v.period_ticks),
      markers: markersFromToml(v.markers),
    };
  },
};

const dimensionTypeCodec: TypeCodec<DimensionTypeEntity> = {
  toToml(e) {
    return compact({
      sky_light: e.skyLight,
      ceiling: e.ceiling,
      dragon_fight: e.dragonFight,
      coordinate_scale: e.coordinateScale,
      min_y: e.minY,
      height: e.height,
      logical_height: e.logicalHeight,
      infiniburn: e.infiniburn,
      ambient_light: e.ambientLight,
      monster_spawn_light_level: e.monsterSpawnLightLevel,
      monster_spawn_block_light_limit: e.monsterSpawnBlockLightLimit,
      fixed_time: e.fixedTime,
      skybox: e.skybox,
      clock: e.clock,
      timelines: e.timelines?.length ? e.timelines : undefined,
    });
  },
  fromToml(id, v) {
    return {
      id,
      skyLight: bool(v.sky_light),
      ceiling: bool(v.ceiling),
      dragonFight: bool(v.dragon_fight),
      coordinateScale: num(v.coordinate_scale),
      minY: num(v.min_y),
      height: num(v.height),
      logicalHeight: num(v.logical_height),
      infiniburn: str(v.infiniburn),
      ambientLight: num(v.ambient_light),
      monsterSpawnLightLevel: num(v.monster_spawn_light_level),
      monsterSpawnBlockLightLimit: num(v.monster_spawn_block_light_limit),
      fixedTime: bool(v.fixed_time),
      skybox: str(v.skybox),
      clock: str(v.clock),
      timelines: list(v.timelines),
    };
  },
};

const dimensionCodec: TypeCodec<DimensionEntity> = {
  toToml(e) {
    return compact({
      type: e.type,
      layers: e.layers?.length
        ? e.layers.map((l) => compact({ block: l.block, height: l.height }))
        : undefined,
      noise_settings: e.noiseSettings,
      biome: e.biome,
    });
  },
  fromToml(id, v) {
    const layers = Array.isArray(v.layers)
      ? (v.layers as TomlValue[])
          .map((l) => ({ block: str(l.block) ?? '', height: num(l.height) ?? 0 }) as DimensionLayer)
          .filter((l) => l.block !== '')
      : undefined;
    return {
      id,
      type: str(v.type),
      layers: layers?.length ? layers : undefined,
      noiseSettings: str(v.noise_settings),
      biome: str(v.biome),
    };
  },
};

const tagCodec: TypeCodec<TagEntity> = {
  toToml(e) {
    return compact({
      registry: e.registry,
      tag: e.tag,
      values: e.values.length > 0 ? e.values : undefined,
      replace: e.replace,
    });
  },
  fromToml(id, v) {
    return {
      id,
      registry: str(v.registry) ?? '',
      tag: str(v.tag) ?? '',
      values: list(v.values) ?? [],
      replace: bool(v.replace),
    };
  },
};

// ---------- codec registry ----------

export const codecs: { readonly [K in keyof Pack['files']]: TypeCodec<Entity> } = {
  block: blockCodec,
  item: itemCodec,
  crafting: craftingCodec,
  smelting: smeltingCodec,
  loot: lootCodec,
  damage_type: damageTypeCodec,
  clock: clockCodec,
  timeline: timelineCodec,
  dimension_type: dimensionTypeCodec,
  dimension: dimensionCodec,
  tag: tagCodec,
};

// ---------- whole-pack TOML (single-file preview / raw editing) ----------

/**
 * Serializes the whole pack into the single-file preview form: one `[<type>.<id>]` section per
 * entity, grouped by type. (The loader's canonical on-disk form is one file per entity under
 * `content/` — the export path re-shards this preview into those files.)
 */
export function packToToml(pack: Pack): string {
  const doc: Record<string, Record<string, unknown>> = {};
  for (const type of Object.keys(pack.files) as (keyof Pack['files'])[]) {
    const byId: Record<string, unknown> = {};
    const codec = codecs[type] as TypeCodec<Entity>;
    for (const entity of pack.files[type]) {
      byId[entity.id] = (codec.toToml(entity) as { type?: string }) ?? {};
    }
    if (Object.keys(byId).length > 0) doc[type] = byId;
  }
  return stringify(doc);
}

export function packFromToml(text: string, namespace: string): Pack {
  const doc = parse(text) as Record<string, TomlValue>;
  const pack: Pack = { namespace, files: {
    block: [], item: [], crafting: [], smelting: [], loot: [], damage_type: [],
    clock: [], timeline: [], dimension_type: [], dimension: [], tag: [],
  } };
  for (const [key, value] of Object.entries(doc)) {
    // Canonical form: `[<type>.<id>]` parses as { type: { id: fields } }. A quoted flat key
    // (`["<type>.<id>"]`, the form older drafts stored) still splits on its first dot.
    const nested = codecs[key as keyof Pack['files']];
    if (nested && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [id, fields] of Object.entries(value as Record<string, TomlValue>)) {
        (pack.files[key as keyof Pack['files']] as unknown[]).push(nested.fromToml(id, fields));
      }
      continue;
    }
    const dot = key.indexOf('.');
    if (dot < 0) continue;
    const type = key.slice(0, dot) as keyof Pack['files'];
    const id = key.slice(dot + 1);
    const codec = codecs[type];
    if (!codec) continue;
    (pack.files[type] as unknown[]).push(codec.fromToml(id, value));
  }
  return pack;
}

// ---------- one entity file (the loader's on-disk shape) ----------

/**
 * Serializes one entity's root fields for `content/<type>/<id>.toml`. `smol-toml` writes nested
 * objects as `[sections]`, but the loader parses one file as one entity and rejects any real
 * section, so nested values must go out as inline tables — this writer covers exactly the
 * vocabulary the codecs emit (scalars, single-line arrays, arrays of inline tables, inline tables).
 */
export function entityToml(fields: Record<string, unknown>): string {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${bareKey(key)} = ${renderTomlValue(value)}`);
  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

function renderTomlValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`cannot serialize non-finite number ${value}`);
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(renderTomlValue).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    const fields = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${bareKey(k)} = ${renderTomlValue(v)}`);
    return fields.length > 0 ? `{ ${fields.join(', ')} }` : '{}';
  }
  throw new Error(`cannot serialize ${typeof value}`);
}

function bareKey(key: string): string {
  if (!BARE_KEY.test(key)) throw new Error(`'${key}' cannot be written as a TOML bare key`);
  return key;
}

// ---------- ore sub-shape re-exports (used by the block editor) ----------

export type { OreDeclaration };
