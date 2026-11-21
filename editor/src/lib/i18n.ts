import { createSignal } from 'solid-js';
import { flatten, resolveTemplate, translator } from '@solid-primitives/i18n';
import type { ContentType } from './model';

/**
 * UI localization. Dictionaries are nested for readability and flattened once so the translator
 * can resolve dot paths. Dynamic messages are functions; `resolveTemplate` handles `{{name}}`
 * templates. Locale choice persists beside the draft in localStorage.
 */

const en = {
  app: {
    title: 'OhMyLoader Editor',
    subtitle: 'Pack editor',
  },
  header: {
    namespace: 'namespace',
    unsaved: 'unsaved',
    language: 'language',
    import: 'import .oml',
    importTitle: 'import an .oml archive',
    export: 'export .oml',
    exportTitle: 'export the pack as an .oml archive',
    exportBlocked: (count: number) =>
      `${count} problem${count === 1 ? '' : 's'} — fix them before exporting`,
    importFailed: (reason: string) => `import failed: ${reason}`,
  },
  problems: {
    summary: (count: number) =>
      `${count} problem${count === 1 ? '' : 's'} — fix them to enable export`,
    count: (count: number) => `${count} problem${count === 1 ? '' : 's'}`,
    valid: 'valid',
  },
  tree: {
    assets: 'Assets',
    addType: (type: string) => `add a ${type}`,
    addAssetsTitle: 'add files under assets/<namespace>/…',
    removeAsset: 'remove asset',
    collapse: 'collapse',
    expand: 'expand',
  },
  types: {
    block: 'Blocks',
    item: 'Items',
    crafting: 'Crafting',
    smelting: 'Smelting',
    loot: 'Loot',
    damage_type: 'Damage Types',
    clock: 'Clocks',
    timeline: 'Timelines',
    dimension_type: 'Dimension Types',
    dimension: 'Dimensions',
    tag: 'Tags',
  },
  empty: {
    title: 'Nothing selected',
    hint: 'Pick an entity in the tree, or create one with the + next to a content type.',
  },
  editor: {
    delete: 'delete',
    deleteConfirm: (type: string, id: string) => `Delete ${type} '${id}'?`,
  },
  preview: {
    title: 'Pack files',
    files: (count: number) => `${count} file${count === 1 ? '' : 's'}`,
    select: 'Select a file to view its contents.',
    binary: (size: number) => `Binary asset · ${size} bytes`,
    empty: 'The archive has no files yet.',
    copy: 'copy',
    copied: 'copied',
    hint: 'Files mirror the exported archive; assets pass through unchanged.',
  },
  footer: {
    entities: (count: number) => `${count} ${count === 1 ? 'entity' : 'entities'}`,
  },
  sections: {
    blockProperties: 'block',
    blockWorldgen: 'world generation (ore)',
    item: 'item',
    itemToolRules: 'tool rules',
    crafting: 'crafting (shaped / shapeless)',
    smelting: 'smelting (the id is the result item)',
    loot: 'loot (the id is the block whose drop is replaced)',
    damageType: 'damage_type',
    clock: 'clock (a clock has no fields; the section only names it)',
    timeline: 'timeline',
    markers: 'markers',
    dimensionType: 'dimension_type (every field optional; defaults = overworld)',
    dimension: 'dimension',
    tag: 'tag (the key is "registry:tag-path", split two ways by the loader)',
    blockLoot: 'drop (loot)',
  },
  form: {
    onePerLine: 'one per line',
    rule: 'rule',
    toolRulesHint: 'block id + speed; removing every rule drops the key',
    markersLabel: 'Named ticks inside the period',
    marker: 'marker',
    markerHint: 'name + tick; "/time" writes the marker into the /time set suggestions',
    shaped: 'shaped',
    shapeless: 'shapeless',
    count: 'count',
    shapelessHint: 'ingredients, one item id per line (shapeless)',
    craftingHint:
      'fill the grid with A-Z, a-z, 0-9, _ or - (the loader reads keys as TOML bare keys), map each to an item id',
    oreBiomesHint: 'biomes, one per line; empty = every biome',
    attackSpeedHint: 'modifier amount; vanilla fists are 4.0',
    timelinesHint: 'one timeline id per line',
    tagValuesHint: 'one entry per line; # prefix = reference',
    dropNone: 'No loot override: breaking the block drops the block itself.',
    drops: (drop: string) => `drops ${drop}`,
    dropHint: 'edited under Loot in the tree (one [loot.<block>] per block)',
    addDrop: 'add drop',
    generateOre: 'generate as ore',
    removeRule: 'remove rule',
    removeMarker: 'remove marker',
  },
  ids: {
    namespace: (value: string) =>
      `'${value}' is not a valid resource domain (lowercase letters, digits, . - _ only)`,
    entityIdEmpty: 'id is empty',
    entityIdSegment: (id: string) =>
      `'${id}' is not a valid id (each /-separated segment must match [a-z0-9_.-]+)`,
    resourceNotTag: (value: string) => `'${value}' must be an id, not a tag reference`,
    misplacedHash: (value: string) => `'${value}' has a misplaced '#'`,
    multipleColons: (value: string) => `'${value}' has more than one ':'`,
    invalidNamespace: (value: string) => `'${value}' has an invalid namespace`,
    emptyPath: (value: string) => `'${value}' has an empty path`,
    invalidPath: (value: string) =>
      `'${value}' is not a valid id (each path segment must match [a-z0-9_.-]+)`,
    tagPrefix: (value: string) => `'${value}' must start with '#'`,
    keyChar: (char: string) =>
      `key '${char}' must be one character the loader can spell as a bare key (A-Z, a-z, 0-9, _ or -)`,
  },
  validation: {
    required: (label: string) => `${label} is required`,
    number: (label: string) => `${label} must be a number`,
    finite: (label: string) => `${label} must be finite`,
    whole: (label: string) => `${label} must be a whole number`,
    min: (label: string, min: number) => `${label} must be at least ${min}`,
    max: (label: string, max: number) => `${label} must be at most ${max}`,
    oneOf: (label: string, options: string) => `${label} must be one of ${options}`,
    list: (label: string) => `${label} must be a list`,
    listEntry: (label: string) => `${label} entries must be strings`,
    entry: (label: string, error: string) => `${label} entry ${error}`,
    idString: 'must be an id string',
    oreWhole: (key: string) => `ore.${key} must be a whole number`,
    oreMin: (key: string) => `ore.${key} must be at least 1`,
    oreMinMax: 'ore.min_y must not exceed ore.max_y',
    oreBiome: (error: string) => `ore.biomes entry ${error}`,
    ruleList: (label: string) => `${label} must be a list`,
    ruleBlock: (label: string, error: string) => `${label} entry ${error}`,
    ruleSpeed: (label: string, block: string) =>
      `${label} entry for '${block}' needs a numeric speed`,
    count: 'count must be a whole number >= 1',
    shapelessNeed: 'shapeless recipes need 1-9 ingredients',
    shapelessMax: 'shapeless recipes take at most 9 ingredients',
    ingredient: (error: string) => `ingredient ${error}`,
    patternNeed: 'shaped recipes need a 1-3 row pattern',
    patternRows: (count: number) => `pattern takes at most 3 rows (got ${count})`,
    patternWidth: (widths: string) => `pattern rows must be 1-3 cells wide (got ${widths})`,
    patternRect: 'pattern rows must all be the same width',
    keyMissing: (char: string) => `pattern character '${char}' has no key entry`,
    keyItem: (char: string, error: string) => `key '${char}' item ${error}`,
    markerList: 'markers must be a list',
    markerName: (name: string) =>
      `marker name '${name}' must match [a-z0-9_-]+ (a bare TOML key)`,
    markerDuplicate: (name: string) => `marker '${name}' is declared twice`,
    markerTicks: (name: string) => `marker '${name}' needs a whole tick number`,
    heightMultiple: (height: number) => `height ${height} is not a multiple of 16`,
    minYMultiple: (minY: number) => `min_y ${minY} is not a multiple of 16`,
    logicalExceeds: (logical: number, height: number) =>
      `logical_height ${logical} exceeds height ${height}`,
    ceiling: (minY: number, height: number) =>
      `min_y ${minY} + height ${height} passes the build ceiling of 2032`,
    dropCountOrder: 'drop_count_max must be at least drop_count_min',
    duplicateId: 'id is declared twice',
    dimensionTypeMissing: (type: string) => `'${type}' is not declared in this pack`,
    clockMissing: (clock: string) => `clock '${clock}' is not declared in this pack`,
  },
};

type Dict = typeof en;

const zh: Dict = {
  app: {
    title: 'OhMyLoader 编辑器',
    subtitle: '内容包编辑器',
  },
  header: {
    namespace: '命名空间',
    unsaved: '未保存',
    language: '语言',
    import: '导入 .oml',
    importTitle: '导入 .oml 归档',
    export: '导出 .oml',
    exportTitle: '将内容包导出为 .oml 归档',
    exportBlocked: (count) => `${count} 个问题，修复后才能导出`,
    importFailed: (reason) => `导入失败：${reason}`,
  },
  problems: {
    summary: (count) => `${count} 个问题，修复后才能导出`,
    count: (count) => `${count} 个问题`,
    valid: '正常',
  },
  tree: {
    assets: '资源文件',
    addType: (type) => `添加${type}`,
    addAssetsTitle: '添加 assets/<namespace>/ 下的文件',
    removeAsset: '移除资源',
    collapse: '折叠',
    expand: '展开',
  },
  types: {
    block: '方块',
    item: '物品',
    crafting: '合成',
    smelting: '熔炼',
    loot: '掉落',
    damage_type: '伤害类型',
    clock: '时钟',
    timeline: '时间线',
    dimension_type: '维度类型',
    dimension: '维度',
    tag: '标签',
  },
  empty: {
    title: '未选择实体',
    hint: '在左侧树中选择一个实体，或点内容类型旁的 + 新建。',
  },
  editor: {
    delete: '删除',
    deleteConfirm: (type, id) => `删除 ${type} '${id}'？`,
  },
  preview: {
    title: '整包文件',
    files: (count) => `${count} 个文件`,
    select: '选择一个文件查看内容。',
    binary: (size) => `二进制资源 · ${size} 字节`,
    empty: '归档里还没有文件。',
    copy: '复制',
    copied: '已复制',
    hint: '文件就是导出归档的结构；资源文件原样保留。',
  },
  footer: {
    entities: (count) => `${count} 个实体`,
  },
  sections: {
    blockProperties: '方块属性',
    blockWorldgen: '世界生成（矿石）',
    item: '物品属性',
    itemToolRules: '工具规则',
    crafting: '合成（有序 / 无序）',
    smelting: '熔炼（id 是产物物品）',
    loot: '掉落（id 是替换掉落的方块）',
    damageType: '伤害类型',
    clock: '时钟（无字段，段名即声明）',
    timeline: '时间线',
    markers: '时间标记',
    dimensionType: '维度类型（全部可选，默认值 = 主世界）',
    dimension: '维度',
    tag: '标签（键为 "registry:tag-path"，加载器按两段解析）',
    blockLoot: '掉落（loot）',
  },
  form: {
    onePerLine: '每行一项',
    rule: '规则',
    toolRulesHint: '方块 id + speed；删光规则会移除该键',
    markersLabel: '周期内的命名 tick',
    marker: '标记',
    markerHint: '名称 + tick；勾选 "/time" 会把标记写入 /time set 建议',
    shaped: '有序',
    shapeless: '无序',
    count: '数量',
    shapelessHint: 'ingredients，每行一个物品 id（无序配方）',
    craftingHint:
      '网格字符只能是 A-Z、a-z、0-9、_ 或 -（loader 按 TOML bare key 解析），并为每个字符映射物品 id',
    oreBiomesHint: '生物群系，每行一个；留空 = 所有群系',
    attackSpeedHint: '修饰值；原版空手为 4.0',
    timelinesHint: '每行一个时间线 id',
    tagValuesHint: '每行一项；# 前缀 = 标签引用',
    dropNone: '没有掉落覆盖：破坏方块时掉落方块本身。',
    drops: (drop) => `掉落 ${drop}`,
    dropHint: '在左侧“掉落”中编辑（每个方块一个 [loot.<block>]）',
    addDrop: '添加掉落',
    generateOre: '按矿石生成',
    removeRule: '移除规则',
    removeMarker: '移除标记',
  },
  ids: {
    namespace: (value) => `'${value}' 不是合法的资源命名空间（仅小写字母、数字和 . - _）`,
    entityIdEmpty: 'id 不能为空',
    entityIdSegment: (id) => `'${id}' 不是合法的 id（以 / 分隔的每一段必须匹配 [a-z0-9_.-]+）`,
    resourceNotTag: (value) => `'${value}' 必须是 id，不能是标签引用`,
    misplacedHash: (value) => `'${value}' 的 '#' 位置不对`,
    multipleColons: (value) => `'${value}' 含有多余的 ':'`,
    invalidNamespace: (value) => `'${value}' 的命名空间不合法`,
    emptyPath: (value) => `'${value}' 的路径为空`,
    invalidPath: (value) => `'${value}' 不是合法的 id（每一段路径必须匹配 [a-z0-9_.-]+）`,
    tagPrefix: (value) => `'${value}' 必须以 '#' 开头`,
    keyChar: (char) =>
      `key '${char}' 必须是 loader 能写成 TOML bare key 的单个字符（A-Z、a-z、0-9、_ 或 -）`,
  },
  validation: {
    required: (label) => `${label} 为必填项`,
    number: (label) => `${label} 必须是数字`,
    finite: (label) => `${label} 必须是有限数`,
    whole: (label) => `${label} 必须是整数`,
    min: (label, min) => `${label} 不能小于 ${min}`,
    max: (label, max) => `${label} 不能大于 ${max}`,
    oneOf: (label, options) => `${label} 必须是以下之一：${options}`,
    list: (label) => `${label} 必须是列表`,
    listEntry: (label) => `${label} 的条目必须是字符串`,
    entry: (label, error) => `${label} 条目 ${error}`,
    idString: '必须是 id 字符串',
    oreWhole: (key) => `ore.${key} 必须是整数`,
    oreMin: (key) => `ore.${key} 不能小于 1`,
    oreMinMax: 'ore.min_y 不能大于 ore.max_y',
    oreBiome: (error) => `ore.biomes 条目 ${error}`,
    ruleList: (label) => `${label} 必须是列表`,
    ruleBlock: (label, error) => `${label} 条目 ${error}`,
    ruleSpeed: (label, block) => `${label} 中 '${block}' 的条目需要数字 speed`,
    count: 'count 必须是 >= 1 的整数',
    shapelessNeed: 'shapeless 配方需要 1-9 个 ingredients',
    shapelessMax: 'shapeless 配方最多 9 个 ingredients',
    ingredient: (error) => `ingredient ${error}`,
    patternNeed: 'shaped 配方需要 1-3 行的 pattern',
    patternRows: (count) => `pattern 最多 3 行（当前 ${count} 行）`,
    patternWidth: (widths) => `pattern 每行必须是 1-3 格宽（当前 ${widths}）`,
    patternRect: 'pattern 各行宽度必须一致',
    keyMissing: (char) => `pattern 字符 '${char}' 没有对应的 key`,
    keyItem: (char, error) => `key '${char}' 的物品 ${error}`,
    markerList: 'markers 必须是列表',
    markerName: (name) => `marker 名 '${name}' 必须匹配 [a-z0-9_-]+（TOML bare key）`,
    markerDuplicate: (name) => `marker '${name}' 重复声明`,
    markerTicks: (name) => `marker '${name}' 需要整数 tick`,
    heightMultiple: (height) => `height ${height} 不是 16 的倍数`,
    minYMultiple: (minY) => `min_y ${minY} 不是 16 的倍数`,
    logicalExceeds: (logical, height) => `logical_height ${logical} 超过了 height ${height}`,
    ceiling: (minY, height) => `min_y ${minY} + height ${height} 超过了 2032 的建筑上限`,
    dropCountOrder: 'drop_count_max 不能小于 drop_count_min',
    duplicateId: 'id 重复声明',
    dimensionTypeMissing: (type) => `'${type}' 未在本包中声明`,
    clockMissing: (clock) => `clock '${clock}' 未在本包中声明`,
  },
};

export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

const KEY_LOCALE = 'oml-editor:locale';

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(KEY_LOCALE);
    if (stored === 'en' || stored === 'zh') return stored;
  } catch {
    // no storage: fall through to the browser language
  }
  const language =
    typeof navigator !== 'undefined' && typeof navigator.language === 'string'
      ? navigator.language
      : 'en';
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const flattened = { en: flatten(en), zh: flatten(zh) };
const [locale, setLocaleSignal] = createSignal<Locale>(initialLocale());

type LeafKey<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends (...args: never[]) => unknown
    ? `${P}${P extends '' ? '' : '.'}${K}`
    : T[K] extends string
      ? `${P}${P extends '' ? '' : '.'}${K}`
      : LeafKey<T[K], `${P}${P extends '' ? '' : '.'}${K}`>;
}[keyof T & string];

/** Only the leaf message keys (nested objects are containers, not messages). */
export type MessageKey = LeafKey<Dict>;

const translate = translator(() => flattened[locale()], resolveTemplate) as unknown as (
  key: string,
  ...args: unknown[]
) => string;

export function t(key: MessageKey, ...args: unknown[]): string {
  return translate(key, ...args);
}

export { locale };

export function setLocale(next: Locale): void {
  setLocaleSignal(next);
  try {
    localStorage.setItem(KEY_LOCALE, next);
  } catch {
    // best-effort, like the draft
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
    document.title = t('app.title');
  }
}

if (typeof document !== 'undefined') {
  document.documentElement.lang = locale() === 'zh' ? 'zh-CN' : 'en';
  document.title = t('app.title');
}

export function typeLabel(type: ContentType): string {
  return t(`types.${type}` as MessageKey);
}
