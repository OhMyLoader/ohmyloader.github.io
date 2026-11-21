/**
 * The in-editor content pack model. Field names mirror `TomlContentLoader`'s accepted key sets
 * verbatim (snake_case), so serialization is a structural walk — a key here is a key the loader
 * accepts there, and anything the loader would reject never gets a field in the first place.
 */

/** The 11 content types the loader accepts, in tree order. */
export const CONTENT_TYPES = [
  'block',
  'item',
  'crafting',
  'smelting',
  'loot',
  'damage_type',
  'clock',
  'timeline',
  'dimension_type',
  'dimension',
  'tag',
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/** `[block.<id>]` — keys mirror BLOCK_KEYS + the ore sub-table. Drops are a separate loot entity. */
export interface BlockEntity {
  id: string;
  hardness?: number;
  blastResistance?: number;
  dropsRequireCorrectTool?: boolean;
  lightLevel?: number;
  ore?: OreDeclaration;
}

export interface OreDeclaration {
  veinSize: number;
  perChunk: number;
  minY: number;
  maxY: number;
  biomes: string[];
}

/** `[item.<id>]` — keys mirror ITEM_KEYS. */
export interface ItemEntity {
  id: string;
  maxDurability?: number;
  attackDamage?: number;
  attackSpeed?: number;
  miningSpeed?: number;
  toolDamagePerBlock?: number;
  breaksBlocksInCreative?: boolean;
  minesAndDrops?: ToolRule[];
  deniesDrops?: ToolRule[];
  overrideSpeed?: ToolRule[];
}

export interface ToolRule {
  block: string;
  speed: number;
}

/** `[crafting.<id>]` — type selects shaped / shapeless. */
export interface CraftingEntity {
  id: string;
  type: 'shaped' | 'shapeless';
  count?: number;
  pattern?: string[];
  key?: Record<string, string>;
  ingredients?: string[];
}

/** `[smelting.<id>]` — furnace selects the furnace kind. */
export interface SmeltingEntity {
  id: string;
  input: string;
  furnace: 'smelting' | 'blasting' | 'smoking';
  experience?: number;
  cookingTime?: number;
}

/** `[loot.<blockId>]` — the id is the BLOCK whose drop is replaced. */
export interface LootEntity {
  id: string;
  drop: string;
  dropCountMin?: number;
  dropCountMax?: number;
}

/** `[damage_type.<id>]` */
export interface DamageTypeEntity {
  id: string;
  messageId: string;
  scaling?: 'never' | 'when_caused_by_living_non_player' | 'always';
  effects?: 'hurt' | 'thorns' | 'drowning' | 'burning' | 'poking' | 'freezing';
  exhaustion?: number;
  deathMessageType?: 'default' | 'fall_variants' | 'intentional_game_design';
}

/** `[clock.<id>]` — a clock has no fields; the section only names it. */
export interface ClockEntity {
  id: string;
}

/** One `markers` entry: a named tick, optionally offered by `/time set`. */
export interface TimelineMarker {
  name: string;
  ticks: number;
  inCommands?: boolean;
}

/** `[timeline.<id>]` — keys mirror TIMELINE_KEYS. */
export interface TimelineEntity {
  id: string;
  clock: string;
  periodTicks?: number;
  markers?: TimelineMarker[];
}

/** `[dimension_type.<id>]` — every field optional, defaults to vanilla's overworld. */
export interface DimensionTypeEntity {
  id: string;
  skyLight?: boolean;
  ceiling?: boolean;
  dragonFight?: boolean;
  coordinateScale?: number;
  minY?: number;
  height?: number;
  logicalHeight?: number;
  infiniburn?: string;
  ambientLight?: number;
  monsterSpawnLightLevel?: number;
  monsterSpawnBlockLightLimit?: number;
  fixedTime?: boolean;
  skybox?: string;
  clock?: string;
  timelines?: string[];
}

/** `[dimension.<id>]` */
export interface DimensionEntity {
  id: string;
  type?: string;
  layers?: DimensionLayer[];
  noiseSettings?: string;
  biome?: string;
}

export interface DimensionLayer {
  block: string;
  height: number;
}

/** `[tag.<key>]` — the key is "registry:tag-path" split two ways by the loader. */
export interface TagEntity {
  id: string;
  registry: string;
  tag: string;
  values: string[];
  replace?: boolean;
}

export type Entity =
  | BlockEntity
  | ItemEntity
  | CraftingEntity
  | SmeltingEntity
  | LootEntity
  | DamageTypeEntity
  | ClockEntity
  | TimelineEntity
  | DimensionTypeEntity
  | DimensionEntity
  | TagEntity;

/** Entities of one type, keyed by id. */
export type EntityMap = {
  block: BlockEntity[];
  item: ItemEntity[];
  crafting: CraftingEntity[];
  smelting: SmeltingEntity[];
  loot: LootEntity[];
  damage_type: DamageTypeEntity[];
  clock: ClockEntity[];
  timeline: TimelineEntity[];
  dimension_type: DimensionTypeEntity[];
  dimension: DimensionEntity[];
  tag: TagEntity[];
};

export type PackFile = { [K in keyof EntityMap]: EntityMap[K] };

/** One open pack: its namespace is the archive stem (lowercase, `TomlContentLoader.namespaceOf`). */
export interface Pack {
  /** Archive stem: `ruby_pack.oml` loads as `ruby_pack`. */
  namespace: string;
  files: PackFile;
}

export function emptyPack(namespace = 'my_pack'): Pack {
  return {
    namespace,
    files: {
      block: [],
      item: [],
      crafting: [],
      smelting: [],
      loot: [],
      damage_type: [],
      clock: [],
      timeline: [],
      dimension_type: [],
      dimension: [],
      tag: [],
    },
  };
}

export function entityCount(pack: Pack): number {
  return CONTENT_TYPES.reduce((n, t) => n + pack.files[t].length, 0);
}
