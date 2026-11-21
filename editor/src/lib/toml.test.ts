import { describe, expect, test } from 'bun:test';
import type { Pack } from './model';
import { emptyPack } from './model';
import { entityToml, packFromToml, packToToml, codecs } from './toml';

function samplePack(): Pack {
  const pack = emptyPack('ruby_pack');
  pack.files.block.push({
    id: 'ruby_ore',
    hardness: 3,
    lightLevel: 0,
    ore: { veinSize: 8, perChunk: 6, minY: 16, maxY: 64, biomes: ['minecraft:taiga'] },
  });
  pack.files.item.push({ id: 'ruby', maxDurability: 592, attackDamage: 7 });
  pack.files.crafting.push({
    id: 'ruby',
    type: 'shaped',
    count: 1,
    pattern: ['RR', 'RR'],
    key: { R: 'ruby_pack:ruby_ore' },
  });
  pack.files.smelting.push({
    id: 'ruby_ingot',
    input: 'ruby_pack:ruby_ore',
    furnace: 'blasting',
    experience: 1,
  });
  pack.files.timeline.push({
    id: 'day',
    clock: 'minecraft:overworld',
    periodTicks: 24000,
    markers: [
      { name: 'dusk', ticks: 12000 },
      { name: 'dawn', ticks: 23000, inCommands: true },
    ],
  });
  return pack;
}

describe('whole-pack TOML', () => {
  test('round-trips every field through the single-file form', () => {
    const pack = samplePack();
    const text = packToToml(pack);
    expect(text).toContain('[block.ruby_ore]');
    expect(text).toContain('vein_size = 8');
    const reparsed = packFromToml(text, 'ruby_pack');
    expect(reparsed.files.block[0].ore?.biomes[0]).toBe('minecraft:taiga');
    expect(reparsed.files.item[0].maxDurability).toBe(592);
    expect(reparsed.files.timeline[0].markers).toEqual([
      { name: 'dusk', ticks: 12000 },
      { name: 'dawn', ticks: 23000, inCommands: true },
    ]);
  });
});

describe('one-entity TOML (the loader format)', () => {
  test('writes the ore table inline, not as a section', () => {
    const text = entityToml(codecs.block.toToml(samplePack().files.block[0]));
    expect(text).not.toContain('[ore]');
    expect(text).toContain(
      'ore = { vein_size = 8, per_chunk = 6, min_y = 16, max_y = 64, biomes = ["minecraft:taiga"] }',
    );
  });

  test('writes crafting keys and tool rules inline', () => {
    const crafting = entityToml(codecs.crafting.toToml(samplePack().files.crafting[0]));
    expect(crafting).toContain('key = { R = "ruby_pack:ruby_ore" }');
    expect(crafting).toContain('pattern = ["RR", "RR"]');

    const item = entityToml(
      codecs.item.toToml({
        id: 'pick',
        minesAndDrops: [{ block: 'minecraft:stone', speed: 8 }],
        overrideSpeed: [],
      }),
    );
    expect(item).toContain('mines_and_drops = [{ block = "minecraft:stone", speed = 8 }]');
    expect(item).not.toContain('override_speed');
  });

  test('writes timeline markers as the loader inline table', () => {
    const text = entityToml(codecs.timeline.toToml(samplePack().files.timeline[0]));
    expect(text).toContain(
      'markers = { dusk = 12000, dawn = { ticks = 23000, in_commands = true } }',
    );
    expect(text).not.toContain('[markers]');
  });

  test('refuses a key the loader cannot spell as a TOML bare key', () => {
    expect(() => entityToml({ key: { '#': 'minecraft:stone' } })).toThrow(/bare key/);
  });
});
