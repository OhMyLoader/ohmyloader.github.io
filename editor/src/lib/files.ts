import type { Pack } from './model';
import { CONTENT_TYPES } from './model';
import { codecs, entityToml } from './toml';

/** One file of the exported archive; [content] is absent for binary assets. */
export interface FileNode {
  kind: 'file';
  name: string;
  path: string;
  content?: string;
  binary: boolean;
  size?: number;
}

export interface DirNode {
  kind: 'dir';
  name: string;
  path: string;
  children: TreeEntry[];
}

export type TreeEntry = DirNode | FileNode;

/** Assets with these extensions are shown as text when they decode as UTF-8. */
const TEXT_ASSET = /\.(json|json5|txt|lang|mcmeta|toml|properties|md|ya?ml|csv)$/i;

/**
 * The archive the export would write: one TOML file per entity under `content/<type>/`, plus
 * `assets/…` passthrough. Ids may contain `/`, so they become subdirectories exactly like the
 * loader's path-is-id rule.
 */
export function packTree(pack: Pack, assets: Record<string, Uint8Array>): DirNode {
  const root = dirNode(`${pack.namespace}.oml`, '');
  for (const type of CONTENT_TYPES) {
    const codec = codecs[type];
    for (const entity of pack.files[type]) {
      const path = `content/${type}/${entity.id}.toml`;
      addFile(root, path, {
        kind: 'file',
        name: '',
        path,
        content: renderEntity(codec, entity),
        binary: false,
      });
    }
  }
  for (const [key, bytes] of Object.entries(assets)) {
    const path = key.startsWith('assets/') ? key : `assets/${pack.namespace}/${key}`;
    const text = TEXT_ASSET.test(path) ? decodeText(bytes) : undefined;
    addFile(root, path, {
      kind: 'file',
      name: '',
      path,
      content: text,
      binary: text === undefined,
      size: bytes.length,
    });
  }
  sortTree(root);
  return root;
}

export function collectFiles(node: TreeEntry): FileNode[] {
  if (node.kind === 'file') return [node];
  return node.children.flatMap(collectFiles);
}

export function findFile(root: DirNode, path: string): FileNode | undefined {
  return collectFiles(root).find((file) => file.path === path);
}

function addFile(root: DirNode, path: string, file: FileNode): void {
  const segments = path.split('/').filter(Boolean);
  const name = segments.pop() ?? path;
  let current = root;
  for (const segment of segments) {
    let next = current.children.find(
      (entry): entry is DirNode => entry.kind === 'dir' && entry.name === segment,
    );
    if (!next) {
      next = dirNode(segment, current.path === '' ? segment : `${current.path}/${segment}`);
      current.children.push(next);
    }
    current = next;
  }
  current.children.push({ ...file, name });
}

function dirNode(name: string, path: string): DirNode {
  return { kind: 'dir', name, path, children: [] };
}

function renderEntity(codec: (typeof codecs)[keyof typeof codecs], entity: unknown): string {
  try {
    return entityToml(codec.toToml(entity as never) as Record<string, unknown>);
  } catch (error) {
    // The export is blocked by validation anyway; keep the tree usable and show the reason.
    return `# failed to serialize: ${error instanceof Error ? error.message : String(error)}\n`;
  }
}

function decodeText(bytes: Uint8Array): string | undefined {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function sortTree(node: DirNode): void {
  node.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    if (child.kind === 'dir') sortTree(child);
  }
}
