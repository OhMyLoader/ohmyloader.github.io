import type {
  CraftingEntity,
  DimensionTypeEntity,
  Entity,
  Pack,
  TimelineEntity,
  ToolRule,
} from './model';
import { CONTENT_TYPES } from './model';
import { sectionsFor, type FieldSpec } from '../components/sections';
import { t } from './i18n';
import {
  BARE_KEY,
  entityIdError,
  keyCharError,
  namespaceError,
  resourceIdError,
} from './ids';

/** One problem of an entity; [key] names the field it belongs to when it has one. */
export interface Issue {
  key?: string;
  message: string;
}

/** One problem of a whole pack, located for the header list and the export gate. */
export interface PackProblem {
  where: string;
  message: string;
}

/** The generic hard checks a [FieldSpec] declares (kind, bounds, closed value set, custom check). */
export function fieldError(spec: FieldSpec, value: unknown): string | null {
  const empty = value === undefined || value === null || value === '';
  if (empty) return spec.required ? t('validation.required', spec.label) : null;
  if (spec.kind === 'number' || spec.kind === 'float') {
    if (typeof value !== 'number' || Number.isNaN(value)) return t('validation.number', spec.label);
    if (!Number.isFinite(value)) return t('validation.finite', spec.label);
    if (spec.kind === 'number' && !Number.isInteger(value)) {
      return t('validation.whole', spec.label);
    }
    if (spec.min !== undefined && value < spec.min) {
      return t('validation.min', spec.label, spec.min);
    }
    if (spec.max !== undefined && value > spec.max) {
      return t('validation.max', spec.label, spec.max);
    }
  }
  if (spec.options && (typeof value !== 'string' || !spec.options.includes(value))) {
    return t('validation.oneOf', spec.label, spec.options.join(', '));
  }
  return spec.hardValidate ? spec.hardValidate(value) : null;
}

/** Every hard rule the loader (or the game's own codec) applies to one entity. */
export function validateEntity(type: string, entity: Entity): Issue[] {
  const issues: Issue[] = [];
  const rec = entity as unknown as Record<string, unknown>;

  for (const section of sectionsFor(type)) {
    for (const spec of section.fields) {
      const error = fieldError(spec, rec[spec.key]);
      if (error) issues.push({ key: spec.key, message: error });
    }
    if (section.strings) {
      const entries = rec[section.strings.key];
      if (entries !== undefined && !Array.isArray(entries)) {
        issues.push({
          key: section.strings.key,
          message: t('validation.list', section.strings.label),
        });
      } else if (Array.isArray(entries)) {
        for (const entry of entries) {
          if (typeof entry !== 'string') {
            issues.push({
              key: section.strings.key,
              message: t('validation.listEntry', section.strings.label),
            });
            continue;
          }
          const error = section.strings.validate?.(entry);
          if (error) {
            issues.push({
              key: section.strings.key,
              message: t('validation.entry', section.strings.label, error),
            });
          }
        }
      }
    }
  }

  switch (type) {
    case 'block': {
      const ore = rec.ore as Record<string, unknown> | undefined;
      if (ore) {
        for (const [key, label] of [
          ['veinSize', 'vein_size'],
          ['perChunk', 'per_chunk'],
          ['minY', 'min_y'],
          ['maxY', 'max_y'],
        ] as const) {
          if (typeof ore[key] !== 'number' || !Number.isInteger(ore[key])) {
            issues.push({ key: 'ore', message: t('validation.oreWhole', label) });
          }
        }
        if (typeof ore.veinSize === 'number' && ore.veinSize < 1) {
          issues.push({ key: 'ore', message: t('validation.oreMin', 'vein_size') });
        }
        if (typeof ore.perChunk === 'number' && ore.perChunk < 1) {
          issues.push({ key: 'ore', message: t('validation.oreMin', 'per_chunk') });
        }
        if (
          typeof ore.minY === 'number' &&
          typeof ore.maxY === 'number' &&
          ore.minY > ore.maxY
        ) {
          issues.push({ key: 'ore', message: t('validation.oreMinMax') });
        }
        if (Array.isArray(ore.biomes)) {
          for (const biome of ore.biomes) {
            const error =
              typeof biome === 'string' ? resourceIdError(biome) : t('validation.idString');
            if (error) issues.push({ key: 'ore', message: t('validation.oreBiome', error) });
          }
        }
      }
      break;
    }
    case 'item': {
      for (const [key, label, needsSpeed] of [
        ['minesAndDrops', 'mines_and_drops', true],
        ['deniesDrops', 'denies_drops', false],
        ['overrideSpeed', 'override_speed', true],
      ] as const) {
        const rules = rec[key];
        if (rules === undefined) continue;
        if (!Array.isArray(rules)) {
          issues.push({ key, message: t('validation.ruleList', label) });
          continue;
        }
        for (const rule of rules as ToolRule[]) {
          const blockError = resourceIdError(rule.block ?? '');
          if (blockError) issues.push({ key, message: t('validation.ruleBlock', label, blockError) });
          if (needsSpeed && (!Number.isFinite(rule.speed) || typeof rule.speed !== 'number')) {
            issues.push({ key, message: t('validation.ruleSpeed', label, rule.block) });
          }
        }
      }
      break;
    }
    case 'crafting':
      issues.push(...craftingIssues(entity as CraftingEntity));
      break;
    case 'loot': {
      const loot = entity as { dropCountMin?: number; dropCountMax?: number };
      if (
        typeof loot.dropCountMin === 'number' &&
        typeof loot.dropCountMax === 'number' &&
        loot.dropCountMin > loot.dropCountMax
      ) {
        issues.push({ key: 'dropCountMax', message: t('validation.dropCountOrder') });
      }
      break;
    }
    case 'timeline':
      issues.push(...timelineIssues(entity as TimelineEntity));
      break;
    case 'dimension_type':
      issues.push(...dimensionTypeIssues(entity as DimensionTypeEntity));
      break;
  }
  return issues;
}

function craftingIssues(c: CraftingEntity): Issue[] {
  const issues: Issue[] = [];
  if (c.count !== undefined && (!Number.isInteger(c.count) || c.count < 1)) {
    issues.push({ key: 'count', message: t('validation.count') });
  }
  if (c.type === 'shapeless') {
    const ingredients = c.ingredients;
    if (!ingredients || ingredients.length === 0) {
      issues.push({ key: 'ingredients', message: t('validation.shapelessNeed') });
    } else if (ingredients.length > 9) {
      issues.push({ key: 'ingredients', message: t('validation.shapelessMax') });
    } else {
      for (const ingredient of ingredients) {
        const error = resourceIdError(ingredient, { tag: true });
        if (error) issues.push({ key: 'ingredients', message: t('validation.ingredient', error) });
      }
    }
    return issues;
  }

  const pattern = c.pattern;
  if (!pattern || pattern.length === 0) {
    issues.push({ key: 'pattern', message: t('validation.patternNeed') });
    return issues;
  }
  if (pattern.length > 3) {
    issues.push({ key: 'pattern', message: t('validation.patternRows', pattern.length) });
  }
  const widths = pattern.map((row) => row.length);
  if (widths.some((width) => width < 1 || width > 3)) {
    issues.push({ key: 'pattern', message: t('validation.patternWidth', widths.join(', ')) });
  }
  if (new Set(widths).size > 1) {
    issues.push({ key: 'pattern', message: t('validation.patternRect') });
  }

  const key = c.key ?? {};
  for (const [ch, item] of Object.entries(key)) {
    const charError = keyCharError(ch);
    if (charError) issues.push({ key: 'key', message: charError });
    const idError = resourceIdError(item, { tag: true });
    if (idError) issues.push({ key: 'key', message: t('validation.keyItem', ch, idError) });
  }
  const used = new Set(pattern.join('').replaceAll(' ', ''));
  for (const ch of used) {
    const charError = keyCharError(ch);
    if (charError) issues.push({ key: 'pattern', message: charError });
    else if (!(ch in key)) {
      issues.push({ key: 'key', message: t('validation.keyMissing', ch) });
    }
  }
  return issues;
}

function timelineIssues(timeline: TimelineEntity): Issue[] {
  const issues: Issue[] = [];
  if (timeline.markers === undefined) return issues;
  if (!Array.isArray(timeline.markers)) {
    return [{ key: 'markers', message: t('validation.markerList') }];
  }
  const names = new Set<string>();
  for (const marker of timeline.markers) {
    if (
      !marker ||
      typeof marker.name !== 'string' ||
      !BARE_KEY.test(marker.name) ||
      marker.name !== marker.name.toLowerCase()
    ) {
      issues.push({
        key: 'markers',
        message: t('validation.markerName', marker?.name ?? ''),
      });
      continue;
    }
    if (names.has(marker.name)) {
      issues.push({ key: 'markers', message: t('validation.markerDuplicate', marker.name) });
    }
    names.add(marker.name);
    if (!Number.isInteger(marker.ticks)) {
      issues.push({ key: 'markers', message: t('validation.markerTicks', marker.name) });
    }
  }
  return issues;
}

function dimensionTypeIssues(d: DimensionTypeEntity): Issue[] {
  const issues: Issue[] = [];
  const height = d.height ?? 384;
  const minY = d.minY ?? -64;
  const logicalHeight = d.logicalHeight ?? height;
  if (d.height !== undefined && d.height % 16 !== 0) {
    issues.push({ key: 'height', message: t('validation.heightMultiple', d.height) });
  }
  if (d.minY !== undefined && d.minY % 16 !== 0) {
    issues.push({ key: 'minY', message: t('validation.minYMultiple', d.minY) });
  }
  if (logicalHeight > height) {
    issues.push({
      key: 'logicalHeight',
      message: t('validation.logicalExceeds', logicalHeight, height),
    });
  }
  if (minY + height > 2032) {
    issues.push({ key: 'height', message: t('validation.ceiling', minY, height) });
  }
  return issues;
}

/** The whole-pack gate: namespace, declared ids, every entity rule, and same-pack references. */
export function validatePack(pack: Pack): PackProblem[] {
  const problems: PackProblem[] = [];
  const namespaceErrorValue = namespaceError(pack.namespace);
  if (namespaceErrorValue) problems.push({ where: 'namespace', message: namespaceErrorValue });

  const idsByType = new Map<string, Set<string>>();
  for (const type of CONTENT_TYPES) {
    const ids = new Set<string>();
    for (const entity of pack.files[type]) {
      const idError = entityIdError(entity.id);
      if (idError) problems.push({ where: `${type}.${entity.id}`, message: idError });
      if (ids.has(entity.id)) {
        problems.push({ where: `${type}.${entity.id}`, message: t('validation.duplicateId') });
      }
      ids.add(entity.id);
      for (const issue of validateEntity(type, entity)) {
        problems.push({
          where: `${type}.${entity.id}${issue.key ? `.${issue.key}` : ''}`,
          message: issue.message,
        });
      }
    }
    idsByType.set(type, ids);
  }

  for (const dimension of pack.files.dimension) {
    if (!dimension.type) continue;
    const [ns, path] = splitRef(dimension.type, pack.namespace);
    if (ns === pack.namespace && !idsByType.get('dimension_type')?.has(path)) {
      problems.push({
        where: `dimension.${dimension.id}.type`,
        message: t('validation.dimensionTypeMissing', dimension.type),
      });
    }
  }

  for (const type of pack.files.dimension_type) {
    if (!type.clock) continue;
    const [ns, path] = splitRef(type.clock, pack.namespace);
    if (ns === pack.namespace && !idsByType.get('clock')?.has(path)) {
      problems.push({
        where: `dimension_type.${type.id}.clock`,
        message: t('validation.clockMissing', type.clock),
      });
    }
  }

  return problems;
}

function splitRef(ref: string, ownNamespace: string): [string, string] {
  const colon = ref.indexOf(':');
  return colon === -1 ? [ownNamespace, ref] : [ref.slice(0, colon), ref.slice(colon + 1)];
}
