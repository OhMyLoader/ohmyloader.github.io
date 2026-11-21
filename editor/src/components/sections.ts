import { resourceIdError, tagRefError } from '../lib/ids';
import type { MessageKey } from '../lib/i18n';

export type FieldKind = 'text' | 'number' | 'float' | 'boolean';

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  hintKey?: MessageKey;
  min?: number;
  max?: number;
  required?: boolean;
  options?: readonly string[];
  hardValidate?: (value: unknown) => string | null;
}

export interface SectionSpec {
  titleKey: MessageKey;
  fields: FieldSpec[];
  sub?: 'ore' | 'crafting';
  records?: 'toolRules' | 'markers';
  strings?: {
    key: string;
    label: string;
    hintKey?: MessageKey;
    validate?: (entry: string) => string | null;
  };
}

const idOnly = (value: unknown) =>
  typeof value === 'string' ? resourceIdError(value) : 'must be an id string';
const tagOrId = (value: unknown) =>
  typeof value === 'string' ? resourceIdError(value, { tag: true }) : 'must be an id string';

/** The field-spec sections per type: a field here is a key the loader accepts there. */
export function sectionsFor(type: string): SectionSpec[] {
  switch (type) {
    case 'block':
      return [
        {
          titleKey: 'sections.blockProperties',
          fields: [
            { key: 'hardness', label: 'hardness', kind: 'float' },
            { key: 'blastResistance', label: 'blast_resistance', kind: 'float' },
            { key: 'dropsRequireCorrectTool', label: 'drops_require_correct_tool', kind: 'boolean' },
            { key: 'lightLevel', label: 'light_level (0–15)', kind: 'number', min: 0, max: 15 },
          ],
        },
        {
          titleKey: 'sections.blockWorldgen',
          sub: 'ore',
          fields: [],
        },
      ];
    case 'item':
      return [
        {
          titleKey: 'sections.item',
          fields: [
            { key: 'maxDurability', label: 'max_durability', kind: 'number', min: 1 },
            { key: 'attackDamage', label: 'attack_damage', kind: 'float' },
            { key: 'attackSpeed', label: 'attack_speed', kind: 'float', hintKey: 'form.attackSpeedHint' },
            { key: 'miningSpeed', label: 'mining_speed', kind: 'float' },
            { key: 'toolDamagePerBlock', label: 'tool_damage_per_block', kind: 'number' },
            { key: 'breaksBlocksInCreative', label: 'breaks_blocks_in_creative', kind: 'boolean' },
          ],
        },
        {
          titleKey: 'sections.itemToolRules',
          records: 'toolRules',
          fields: [],
        },
      ];
    case 'crafting':
      return [
        {
          titleKey: 'sections.crafting',
          sub: 'crafting',
          fields: [],
        },
      ];
    case 'smelting':
      return [
        {
          titleKey: 'sections.smelting',
          fields: [
            { key: 'input', label: 'input', kind: 'text', required: true, hardValidate: tagOrId },
            {
              key: 'furnace',
              label: 'furnace',
              kind: 'text',
              options: ['smelting', 'blasting', 'smoking'],
            },
            { key: 'experience', label: 'experience', kind: 'float', min: 0 },
            { key: 'cookingTime', label: 'cooking_time (ticks)', kind: 'number', min: 1 },
          ],
        },
      ];
    case 'loot':
      return [
        {
          titleKey: 'sections.loot',
          fields: [
            { key: 'drop', label: 'drop', kind: 'text', required: true, hardValidate: idOnly },
            { key: 'dropCountMin', label: 'drop_count_min', kind: 'number', min: 0 },
            { key: 'dropCountMax', label: 'drop_count_max', kind: 'number', min: 0 },
          ],
        },
      ];
    case 'damage_type':
      return [
        {
          titleKey: 'sections.damageType',
          fields: [
            {
              key: 'messageId',
              label: 'message_id',
              kind: 'text',
              required: true,
              placeholder: 'my_pack.hurt',
            },
            {
              key: 'scaling',
              label: 'scaling',
              kind: 'text',
              options: ['never', 'when_caused_by_living_non_player', 'always'],
            },
            {
              key: 'effects',
              label: 'effects',
              kind: 'text',
              options: ['hurt', 'thorns', 'drowning', 'burning', 'poking', 'freezing'],
            },
            { key: 'exhaustion', label: 'exhaustion', kind: 'float' },
            {
              key: 'deathMessageType',
              label: 'death_message_type',
              kind: 'text',
              options: ['default', 'fall_variants', 'intentional_game_design'],
            },
          ],
        },
      ];
    case 'clock':
      return [{ titleKey: 'sections.clock', fields: [] }];
    case 'timeline':
      return [
        {
          titleKey: 'sections.timeline',
          fields: [
            { key: 'clock', label: 'clock', kind: 'text', required: true, hardValidate: idOnly },
            { key: 'periodTicks', label: 'period_ticks', kind: 'number', min: 1 },
          ],
        },
        {
          titleKey: 'sections.markers',
          records: 'markers',
          fields: [],
        },
      ];
    case 'dimension_type':
      return [
        {
          titleKey: 'sections.dimensionType',
          fields: [
            { key: 'skyLight', label: 'sky_light', kind: 'boolean' },
            { key: 'ceiling', label: 'ceiling', kind: 'boolean' },
            { key: 'dragonFight', label: 'dragon_fight', kind: 'boolean' },
            {
              key: 'coordinateScale',
              label: 'coordinate_scale',
              kind: 'float',
              min: 9.999999747378752e-6,
              max: 3.0e7,
            },
            { key: 'minY', label: 'min_y', kind: 'number', min: -2032, max: 2031 },
            { key: 'height', label: 'height', kind: 'number', min: 16, max: 4064 },
            { key: 'logicalHeight', label: 'logical_height', kind: 'number', min: 0, max: 4064 },
            {
              key: 'infiniburn',
              label: 'infiniburn (tag reference)',
              kind: 'text',
              hardValidate: (value) =>
                typeof value === 'string' ? tagRefError(value) : 'must be a string',
            },
            { key: 'ambientLight', label: 'ambient_light', kind: 'float', min: 0, max: 1 },
            {
              key: 'monsterSpawnLightLevel',
              label: 'monster_spawn_light_level',
              kind: 'number',
              min: 0,
              max: 15,
            },
            {
              key: 'monsterSpawnBlockLightLimit',
              label: 'monster_spawn_block_light_limit',
              kind: 'number',
              min: 0,
              max: 15,
            },
            { key: 'fixedTime', label: 'fixed_time', kind: 'boolean' },
            { key: 'skybox', label: 'skybox', kind: 'text', options: ['none', 'overworld', 'end'] },
            { key: 'clock', label: 'clock (declared clock id)', kind: 'text', hardValidate: idOnly },
          ],
          strings: { key: 'timelines', label: 'timelines', hintKey: 'form.timelinesHint', validate: idOnly },
        },
      ];
    case 'dimension':
      return [
        {
          titleKey: 'sections.dimension',
          fields: [
            {
              key: 'type',
              label: 'type (declared dimension_type id)',
              kind: 'text',
              required: true,
              hardValidate: idOnly,
            },
            { key: 'biome', label: 'biome', kind: 'text', hardValidate: idOnly },
            { key: 'noiseSettings', label: 'noise_settings', kind: 'text', hardValidate: idOnly },
          ],
        },
      ];
    case 'tag':
      return [
        {
          titleKey: 'sections.tag',
          fields: [
            {
              key: 'registry',
              label: 'registry (e.g. minecraft:block)',
              kind: 'text',
              required: true,
              hardValidate: idOnly,
            },
            { key: 'tag', label: 'tag path', kind: 'text', required: true, hardValidate: idOnly },
            { key: 'replace', label: 'replace', kind: 'boolean' },
          ],
          strings: {
            key: 'values',
            label: 'values',
            hintKey: 'form.tagValuesHint',
            validate: tagOrId,
          },
        },
      ];
    default:
      return [];
  }
}
