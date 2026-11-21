import { describe, expect, test } from 'bun:test';
import type { Entity, Pack } from './model';
import { emptyPack } from './model';
import { setLocale } from './i18n';
import { entityIdError, keyCharError, namespaceError, resourceIdError, tagRefError } from './ids';
import { validateEntity, validatePack } from './validate';

setLocale('en');

const entity = (value: unknown) => value as Entity;
const messages = (type: string, value: unknown) =>
  validateEntity(type, entity(value)).map((issue) => `${issue.key ?? ''}: ${issue.message}`);

describe('id rules', () => {
  test('namespaces and declared ids follow the loader regexes', () => {
    expect(namespaceError('ruby_pack')).toBeNull();
    expect(namespaceError('Ruby')).not.toBeNull();
    expect(entityIdError('ruby_ore')).toBeNull();
    expect(entityIdError('ruby/ore')).toBeNull();
    expect(entityIdError('ruby/Ore')).not.toBeNull();
    expect(entityIdError('ruby//ore')).not.toBeNull();
  });

  test('referenced ids may carry one namespace and, where allowed, a # tag', () => {
    expect(resourceIdError('minecraft:stone')).toBeNull();
    expect(resourceIdError('ruby')).toBeNull();
    expect(resourceIdError('a:b:c')).not.toBeNull();
    expect(resourceIdError('Bad:stone')).not.toBeNull();
    expect(resourceIdError('#minecraft:planks')).not.toBeNull();
    expect(resourceIdError('#minecraft:planks', { tag: true })).toBeNull();
    expect(tagRefError('#minecraft:infiniburn_overworld')).toBeNull();
    expect(tagRefError('minecraft:infiniburn_overworld')).not.toBeNull();
  });

  test('crafting key characters must be spellable as bare TOML keys', () => {
    expect(keyCharError('R')).toBeNull();
    expect(keyCharError('_')).toBeNull();
    expect(keyCharError('#')).not.toBeNull();
    expect(keyCharError('AB')).not.toBeNull();
  });
});

describe('entity validation', () => {
  test('light_level is held to the game’s 0..15 window', () => {
    expect(messages('block', { id: 'lamp', lightLevel: 15 })).toEqual([]);
    expect(messages('block', { id: 'lamp', lightLevel: 16 })[0]).toContain('light_level');
  });

  test('required fields are refused when missing', () => {
    expect(messages('smelting', { id: 'ruby_ingot', furnace: 'smelting' })[0]).toContain(
      'input is required',
    );
    expect(messages('loot', { id: 'ruby_ore' })[0]).toContain('drop is required');
    expect(messages('damage_type', { id: 'hurt' })[0]).toContain('message_id is required');
    expect(messages('timeline', { id: 'day', markers: [] })[0]).toContain('clock is required');
    expect(messages('dimension', { id: 'void' })[0]).toContain('is required');
  });

  test('dimension_type mirrors every window the registry checks', () => {
    const valid = {
      id: 'ruby_world',
      minY: -64,
      height: 384,
      logicalHeight: 384,
      ambientLight: 0,
      monsterSpawnLightLevel: 7,
      monsterSpawnBlockLightLimit: 0,
      infiniburn: '#minecraft:infiniburn_overworld',
      skybox: 'none',
      fixedTime: true,
    };
    expect(messages('dimension_type', valid)).toEqual([]);
    expect(messages('dimension_type', { id: 'a', height: 100 }).join()).toContain('multiple of 16');
    expect(messages('dimension_type', { id: 'a', minY: -63 }).join()).toContain('multiple of 16');
    expect(messages('dimension_type', { id: 'a', logicalHeight: 400 }).join()).toContain(
      'exceeds height',
    );
    expect(messages('dimension_type', { id: 'a', minY: 2000 }).join()).toContain('build ceiling');
    expect(messages('dimension_type', { id: 'a', ambientLight: 2 }).join()).toContain(
      'at most 1',
    );
    expect(messages('dimension_type', { id: 'a', skybox: 'moon' }).join()).toContain('one of');
    expect(messages('dimension_type', { id: 'a', infiniburn: 'stone' }).join()).toContain(
      "must start with '#'",
    );
  });

  test('crafting patterns are rectangular, 1-3 cells, and fully keyed', () => {
    expect(messages('crafting', { id: 'ruby', type: 'shaped', pattern: ['RR'], key: { R: 'minecraft:stone' } })).toEqual(
      [],
    );
    expect(
      messages('crafting', { id: 'ruby', type: 'shaped', pattern: ['AB'], key: { A: 'minecraft:stone' } }).join(),
    ).toContain("character 'B' has no key entry");
    expect(
      messages('crafting', { id: 'ruby', type: 'shaped', pattern: ['RRR', 'RR'], key: { R: 'minecraft:stone' } }).join(),
    ).toContain('same width');
    expect(
      messages('crafting', { id: 'ruby', type: 'shaped', pattern: ['RRRR'], key: { R: 'minecraft:stone' } }).join(),
    ).toContain('1-3 cells wide');
    expect(
      messages('crafting', { id: 'ruby', type: 'shaped', pattern: ['#'], key: { '#': 'minecraft:stone' } }).join(),
    ).toContain('bare key');
    expect(
      messages('crafting', { id: 'ruby', type: 'shapeless', ingredients: Array(10).fill('minecraft:stone') }).join(),
    ).toContain('at most 9');
    expect(
      messages('crafting', { id: 'ruby', type: 'shapeless', ingredients: ['Bad:stone'] }).join(),
    ).toContain('invalid namespace');
  });

  test('timeline markers need lowercase bare-key names and whole ticks', () => {
    expect(
      messages('timeline', {
        id: 'day',
        clock: 'minecraft:overworld',
        markers: [{ name: 'dusk', ticks: 12000 }],
      }),
    ).toEqual([]);
    expect(
      messages('timeline', {
        id: 'day',
        clock: 'minecraft:overworld',
        markers: [{ name: 'Dusk', ticks: 12000 }],
      }).join(),
    ).toContain('bare TOML key');
    expect(
      messages('timeline', {
        id: 'day',
        clock: 'minecraft:overworld',
        markers: [
          { name: 'dusk', ticks: 1 },
          { name: 'dusk', ticks: 2 },
        ],
      }).join(),
    ).toContain('declared twice');
  });
});

describe('pack validation', () => {
  test('catches bad ids, duplicates, and same-pack references', () => {
    const pack: Pack = emptyPack('ruby_pack');
    pack.files.block.push({ id: 'Ruby_Ore' });
    pack.files.block.push({ id: 'ruby_ore' });
    pack.files.block.push({ id: 'ruby_ore' });
    pack.files.dimension.push({ id: 'ruby_world', type: 'ruby_pack:missing_type' });
    pack.files.dimension_type.push({ id: 'ruby_type', clock: 'missing_clock' });

    const problems = validatePack(pack);
    expect(problems.some((p) => p.message.includes('not a valid id'))).toBe(true);
    expect(problems.some((p) => p.message.includes('declared twice'))).toBe(true);
    expect(problems.some((p) => p.message.includes("'ruby_pack:missing_type' is not declared"))).toBe(true);
    expect(problems.some((p) => p.message.includes("clock 'missing_clock' is not declared"))).toBe(true);
  });

  test('a clean sample pack has no problems', () => {
    const pack = emptyPack('ruby_pack');
    pack.files.block.push({ id: 'ruby_ore', lightLevel: 7 });
    pack.files.item.push({ id: 'ruby' });
    pack.files.crafting.push({
      id: 'ruby_block',
      type: 'shaped',
      pattern: ['RR', 'RR'],
      key: { R: 'ruby_pack:ruby' },
    });
    pack.files.dimension_type.push({
      id: 'ruby_world',
      minY: -64,
      height: 384,
      clock: 'day',
      infiniburn: '#minecraft:infiniburn_overworld',
    });
    pack.files.clock.push({ id: 'day' });
    pack.files.dimension.push({ id: 'ruby_level', type: 'ruby_world' });
    expect(validatePack(pack)).toEqual([]);
  });
});
