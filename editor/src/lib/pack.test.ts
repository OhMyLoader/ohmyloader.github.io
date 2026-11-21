import { describe, expect, test } from 'bun:test';
import { strFromU8, unzip } from 'fflate';
import type { Pack } from './model';
import { emptyPack } from './model';
import { setLocale } from './i18n';
import { exportPack, importPackFromBytes, namespaceError } from './pack';

setLocale('en');

function samplePack(): Pack {
  const pack = emptyPack('ruby_pack');
  pack.files.block.push({
    id: 'ruby_ore',
    hardness: 3,
    ore: { veinSize: 8, perChunk: 6, minY: 16, maxY: 64, biomes: ['minecraft:taiga'] },
  });
  pack.files.item.push({ id: 'ruby', maxDurability: 592 });
  pack.files.crafting.push({
    id: 'ruby',
    type: 'shapeless',
    ingredients: ['ruby_pack:ruby_ore'],
  });
  pack.files.tag.push({
    id: 'my_tag',
    registry: 'minecraft:block',
    tag: 'needs_iron_tool',
    values: ['ruby_pack:ruby_ore'],
  });
  return pack;
}

describe('.oml archive', () => {
  test('export -> import keeps entities and assets', async () => {
    const pack = samplePack();
    const png = new Uint8Array([137, 80, 78, 71]);
    const bytes = await exportPack(pack, { 'textures/block/ruby_ore.png': png });
    expect(bytes.length).toBeGreaterThan(100);

    const back = await importPackFromBytes(bytes, 'ruby_pack.oml');
    expect(back.pack.namespace).toBe('ruby_pack');
    expect(back.pack.files.block[0].id).toBe('ruby_ore');
    expect(back.pack.files.tag[0].values[0]).toBe('ruby_pack:ruby_ore');
    expect(back.assets['assets/ruby_pack/textures/block/ruby_ore.png']?.[0]).toBe(137);
  });

  test('entity files use root fields with inline tables only', async () => {
    const bytes = await exportPack(samplePack());
    const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(bytes, (error, data) => (error ? reject(error) : resolve(data)));
    });
    const block = strFromU8(entries['content/block/ruby_ore.toml']);
    expect(block).toContain('ore = {');
    expect(block).not.toContain('[ore]');
    const crafting = strFromU8(entries['content/crafting/ruby.toml']);
    expect(crafting).not.toContain('[ingredients]');
  });

  test('namespaces must derive from the archive stem', async () => {
    expect(namespaceError('ruby_pack')).toBeNull();
    expect(namespaceError('Ruby-Pack')).not.toBeNull();
    expect(namespaceError('')).not.toBeNull();
    await expect(exportPack(emptyPack('bad namespace'))).rejects.toThrow(/not a valid resource domain/);
    await expect(importPackFromBytes(new Uint8Array(), 'Bad Name.oml')).rejects.toThrow(
      /resource domain/,
    );
  });
});
