import { describe, expect, test } from 'bun:test';
import type { Pack } from './model';
import { emptyPack } from './model';
import { codecs, entityToml } from './toml';
import { collectFiles, findFile, packTree } from './files';

function samplePack(): Pack {
  const pack = emptyPack('ruby_pack');
  pack.files.block.push({
    id: 'ruby_ore',
    hardness: 3,
    ore: { veinSize: 8, perChunk: 6, minY: 16, maxY: 64, biomes: ['minecraft:taiga'] },
  });
  pack.files.block.push({ id: 'deep/ore' });
  pack.files.item.push({ id: 'ruby', maxDurability: 592 });
  return pack;
}

const assets = {
  'assets/ruby_pack/lang/en_us.json': new TextEncoder().encode('{"item.ruby":"Ruby"}'),
  'assets/ruby_pack/textures/block/ruby_ore.png': new Uint8Array([137, 80, 78, 71]),
  'notes.txt': new TextEncoder().encode('hello'),
};

describe('archive tree', () => {
  test('mirrors content paths, including slash ids', () => {
    const root = packTree(samplePack(), assets);
    expect(root.children.map((entry) => entry.name)).toEqual(['assets', 'content']);
    const paths = collectFiles(root).map((file) => file.path);
    expect(paths).toContain('content/block/ruby_ore.toml');
    expect(paths).toContain('content/block/deep/ore.toml');
    expect(paths).toContain('content/item/ruby.toml');
    expect(paths).toContain('assets/ruby_pack/lang/en_us.json');
    expect(paths).toContain('assets/ruby_pack/notes.txt');
  });

  test('content files are the loader-format entity TOML', () => {
    const root = packTree(samplePack(), {});
    const file = findFile(root, 'content/block/ruby_ore.toml');
    expect(file?.content).toBe(
      entityToml(codecs.block.toToml(samplePack().files.block[0]) as Record<string, unknown>),
    );
    expect(file?.content).toContain('ore = {');
    expect(file?.content).not.toContain('[ore]');
    expect(file?.binary).toBe(false);
  });

  test('text assets decode; binary assets keep size', () => {
    const root = packTree(samplePack(), assets);
    const lang = findFile(root, 'assets/ruby_pack/lang/en_us.json');
    expect(lang?.content).toBe('{"item.ruby":"Ruby"}');
    expect(lang?.binary).toBe(false);

    const png = findFile(root, 'assets/ruby_pack/textures/block/ruby_ore.png');
    expect(png?.content).toBeUndefined();
    expect(png?.binary).toBe(true);
    expect(png?.size).toBe(4);

    const bare = findFile(root, 'assets/ruby_pack/notes.txt');
    expect(bare?.content).toBe('hello');
  });

  test('missing paths return undefined and empty packs have no children', () => {
    const root = packTree(emptyPack('empty_pack'), {});
    expect(root.children).toEqual([]);
    expect(findFile(root, 'content/block/nope.toml')).toBeUndefined();
    expect(collectFiles(root)).toEqual([]);
  });

  test('an entity the writer cannot spell keeps the tree usable', () => {
    const pack = emptyPack('bad_pack');
    pack.files.crafting.push({
      id: 'ruby',
      type: 'shaped',
      pattern: ['#'],
      key: { '#': 'minecraft:stone' },
    });
    const root = packTree(pack, {});
    const file = findFile(root, 'content/crafting/ruby.toml');
    expect(file?.content).toContain('failed to serialize');
  });
});
