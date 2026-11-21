import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FileNode, TreeEntry } from '../lib/files';
import { ChevronIcon, FileIcon, FolderIcon } from './icons';

/** The exported archive as a collapsible tree; clicking a file selects it in the viewer. */
export function ArchiveTree(props: {
  entries: TreeEntry[];
  selected?: string;
  onSelect: (file: FileNode) => void;
}) {
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set());
  const toggle = (path: string) => {
    const next = new Set(collapsed());
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setCollapsed(next);
  };

  const rows = (entries: TreeEntry[], depth: number): JSX.Element => (
    <For each={entries}>
      {(entry) =>
        entry.kind === 'dir' ? (
          <>
            <button
              class="archive-row archive-dir"
              style={{ 'padding-left': `${0.5 + depth * 0.875}rem` }}
              title={entry.path}
              onClick={() => toggle(entry.path)}
            >
              <ChevronIcon
                open={!collapsed().has(entry.path)}
                class="h-2.5 w-2.5 shrink-0"
              />
              <FolderIcon class="h-3 w-3 shrink-0" />
              <span class="truncate">{entry.name}</span>
            </button>
            <Show when={!collapsed().has(entry.path)}>{rows(entry.children, depth + 1)}</Show>
          </>
        ) : (
          <button
            class={`archive-row ${props.selected === entry.path ? 'archive-row--active' : ''}`}
            style={{ 'padding-left': `${0.5 + depth * 0.875}rem` }}
            title={entry.path}
            onClick={() => props.onSelect(entry)}
          >
            <FileIcon class="h-3 w-3 shrink-0" />
            <span class="truncate">{entry.name}</span>
            <Show when={entry.binary && entry.size !== undefined}>
              <span class="archive-size">{entry.size} B</span>
            </Show>
          </button>
        )
      }
    </For>
  );

  return <div class="archive-tree">{rows(props.entries, 0)}</div>;
}
