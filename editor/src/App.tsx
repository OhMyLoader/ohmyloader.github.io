import { For, Show, createMemo, createSignal } from 'solid-js';
import { ArchiveTree } from './components/ArchiveTree';
import { EntityForm } from './components/EntityForm';
import {
  AlertIcon,
  CheckIcon,
  ChevronIcon,
  CopyIcon,
  CubeIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from './components/icons';
import type { ContentType } from './lib/model';
import { CONTENT_TYPES, entityCount } from './lib/model';
import {
  addDefault,
  assetPaths,
  assets,
  dirty,
  findEntity,
  loadFromToml,
  markClean,
  pack,
  putAsset,
  removeAsset,
  removeEntity,
  renameNamespace,
  selected,
  setSelected,
  idsOf,
} from './lib/store';
import { collectFiles, findFile, packTree } from './lib/files';
import { downloadPack, importPack, namespaceError, packToToml } from './lib/pack';
import { locale, setLocale, t, typeLabel } from './lib/i18n';
import { loadCollapsed, saveCollapsed } from './lib/persist';
import { validatePack } from './lib/validate';

/** The three-pane editor: entity tree | form | TOML preview. */

const packProblems = () => validatePack(pack());

function AssetsSection() {
  const paths = () => assetPaths();
  return (
    <div class="border-t border-slate-100 px-1.5 py-1.5">
      <div class="flex items-center gap-1 px-1 py-1">
        <span class="flex flex-1 items-center gap-1.5 text-[11px] font-semibold text-slate-500">
          <FolderIcon class="h-3 w-3 text-slate-400" />
          {t('tree.assets')}
          <Show when={paths().length > 0}>
            <span class="count-badge">{paths().length}</span>
          </Show>
        </span>
        <label class="tree-add cursor-pointer" title={t('tree.addAssetsTitle')}>
          <PlusIcon class="h-3 w-3" />
          <input
            type="file"
            multiple
            class="hidden"
            onChange={(e) => {
              for (const file of e.currentTarget.files ?? []) {
                void file.arrayBuffer().then((buf) => {
                  const rel =
                    (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
                  putAsset(`assets/${pack().namespace}/${rel}`, new Uint8Array(buf));
                });
              }
              e.currentTarget.value = '';
            }}
          />
        </label>
      </div>
      <Show when={paths().length > 0}>
        <ul class="pb-1">
          <For each={paths()}>
            {(p) => (
              <li class="asset-row">
                <FileIcon class="h-3 w-3 shrink-0 text-slate-400" />
                <span class="min-w-0 flex-1 truncate" title={p}>
                  {p.replace(`assets/${pack().namespace}/`, '')}
                </span>
                <button
                  class="asset-delete btn btn-ghost btn-icon btn-sm"
                  title={t('tree.removeAsset')}
                  onClick={() => removeAsset(p)}
                >
                  <TrashIcon class="h-3 w-3" />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

function Tree() {
  const selectedType = () => selected()?.type;
  const [collapsed, setCollapsed] = createSignal<string[]>(loadCollapsed());
  const isCollapsed = (type: ContentType) => collapsed().includes(type);
  const toggle = (type: ContentType) => {
    const next = isCollapsed(type)
      ? collapsed().filter((item) => item !== type)
      : [...collapsed(), type];
    setCollapsed(next);
    saveCollapsed(next);
  };
  const addOfType = (type: ContentType) => {
    if (isCollapsed(type)) toggle(type);
    addDefault(type, `my_${type}`);
  };
  return (
    <aside class="tree-pane border-r border-slate-200">
      <div class="py-1">
        <For each={CONTENT_TYPES}>
          {(type: ContentType) => (
            <section class="tree-section">
              <div class="tree-head">
                <button class="tree-label" onClick={() => toggle(type)}>
                  <ChevronIcon open={!isCollapsed(type)} class="h-2.5 w-2.5 text-slate-400" />
                  <span class="truncate">{typeLabel(type)}</span>
                </button>
                <Show when={pack().files[type].length > 0}>
                  <span class="count-badge">{pack().files[type].length}</span>
                </Show>
                <button
                  class="tree-add"
                  title={t('tree.addType', typeLabel(type))}
                  onClick={() => addOfType(type)}
                >
                  <PlusIcon class="h-3 w-3" />
                </button>
              </div>
              <Show when={!isCollapsed(type) && pack().files[type].length > 0}>
                <ul class="pb-0.5">
                  <For each={idsOf(type)}>
                    {(id) => (
                      <li>
                        <button
                          class={`tree-row ${
                            selectedType() === type && selected()?.id === id ? 'tree-row--active' : ''
                          }`}
                          title={id}
                          onClick={() => setSelected({ type, id })}
                        >
                          {id}
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </section>
          )}
        </For>
      </div>
      <AssetsSection />
    </aside>
  );
}

function EditorPane() {
  const sel = () => selected();
  const entity = () => (sel() ? findEntity(sel()!.type, sel()!.id) : undefined);
  return (
    <div class="editor-pane">
      <Show
        when={sel() && entity()}
        fallback={
          <div class="empty-state">
            <div class="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-panel text-slate-400 shadow-sm">
              <CubeIcon class="h-5 w-5" />
            </div>
            <p class="mt-1 text-sm font-medium text-slate-600">{t('empty.title')}</p>
            <p class="max-w-64 text-xs text-slate-400">{t('empty.hint')}</p>
          </div>
        }
      >
        <div class="mx-auto w-full max-w-[780px]">
          <div class="mb-4 flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="truncate font-mono text-base font-semibold text-slate-800">
                  {sel()!.id}
                </h2>
                <span class="type-chip shrink-0">{sel()!.type}</span>
              </div>
              <p class="mt-1 truncate font-mono text-[11px] text-slate-400">
                content/{sel()!.type}/{sel()!.id}.toml
              </p>
            </div>
            <button
              class="btn btn-danger shrink-0"
              onClick={() => {
                const current = sel()!;
                if (
                  window.confirm(
                    t('editor.deleteConfirm', typeLabel(current.type), current.id),
                  )
                ) {
                  removeEntity(current.type, current.id);
                }
              }}
            >
              <TrashIcon />
              {t('editor.delete')}
            </button>
          </div>
          <EntityForm type={sel()!.type} entity={entity()!} />
        </div>
      </Show>
    </div>
  );
}

function PreviewPane() {
  const tree = createMemo(() => packTree(pack(), assets()));
  const files = createMemo(() => collectFiles(tree()));
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const selected = createMemo(() => {
    const path = selectedPath();
    if (path) {
      const found = findFile(tree(), path);
      if (found) return found;
    }
    return files().find((file) => file.path.startsWith('content/')) ?? files()[0];
  });
  const [copied, setCopied] = createSignal(false);
  const copy = () => {
    const content = selected()?.content;
    if (content === undefined) return;
    void navigator.clipboard
      ?.writeText(content)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => undefined);
  };
  return (
    <div class="preview-surface flex h-full flex-col">
      <div class="preview-head flex h-10 shrink-0 items-center gap-2 preview-line border-b px-3">
        <span class="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {t('preview.title')}
        </span>
        <span class="preview-chip shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
          {pack().namespace}.oml
        </span>
        <span class="shrink-0 text-[10px] text-slate-500">
          {t('preview.files', files().length)}
        </span>
        <div class="flex-1" />
        <Show when={selected()?.content !== undefined}>
          <button class="code-button" onClick={copy}>
            <Show
              when={copied()}
              fallback={
                <>
                  <CopyIcon class="h-3 w-3" />
                  {t('preview.copy')}
                </>
              }
            >
              <CheckIcon class="h-3 w-3" />
              {t('preview.copied')}
            </Show>
          </button>
        </Show>
      </div>
      <Show
        when={tree().children.length > 0}
        fallback={<div class="viewer-note">{t('preview.empty')}</div>}
      >
        <ArchiveTree
          entries={tree().children}
          selected={selected()?.path}
          onSelect={(file) => setSelectedPath(file.path)}
        />
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="flex h-8 shrink-0 items-center gap-2 preview-line border-b px-3">
            <span class="viewer-path truncate font-mono text-[10px] text-slate-500">
              {selected()?.path ?? t('preview.select')}
            </span>
            <Show when={selected()?.binary}>
              <span class="preview-chip shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-400">
                bin
              </span>
            </Show>
          </div>
          <Show
            when={selected()?.content !== undefined}
            fallback={
              <div class="viewer-note">
                {selected()?.binary
                  ? t('preview.binary', selected()!.size ?? 0)
                  : t('preview.select')}
              </div>
            }
          >
            <pre class="code-view">{selected()!.content}</pre>
          </Show>
        </div>
      </Show>
      <div class="preview-line shrink-0 border-t px-3 py-1.5 text-[10px] text-slate-500">
        {t('preview.hint')}
      </div>
    </div>
  );
}

function Header() {
  const err = () => namespaceError(pack().namespace);
  const onImport = async (file: File) => {
    try {
      const { pack: next } = await importPack(file);
      loadFromToml(packToToml(next), next.namespace);
      setSelected(null);
    } catch (e) {
      alert(t('header.importFailed', e instanceof Error ? e.message : String(e)));
    }
  };
  return (
    <header class="topbar flex items-center gap-3 border-b border-slate-200 bg-panel px-4">
      <div class="flex items-center gap-2.5">
        <div class="brand-tile grid h-7 w-7 place-items-center rounded-lg text-white shadow-sm">
          <CubeIcon class="h-4 w-4" />
        </div>
        <div class="leading-tight">
          <div class="text-[13px] font-semibold tracking-[-0.01em] text-slate-800">
            OhMyLoader
          </div>
          <div class="text-[9px] font-medium uppercase tracking-[0.16em] text-slate-400">
            {t('app.subtitle')}
          </div>
        </div>
      </div>
      <div class="mx-1 h-6 w-px bg-slate-200" />
      <label class="flex items-center gap-2">
        <span class="text-[11px] font-medium text-slate-400">{t('header.namespace')}</span>
        <input
          class={`input w-44 font-mono ${err() ? 'input--invalid' : ''}`}
          value={pack().namespace}
          onChange={(e) => renameNamespace(e.currentTarget.value.toLowerCase())}
        />
      </label>
      <Show when={err()}>
        <span class="max-w-64 truncate text-[11px] text-red-500" title={err()!}>
          {err()}
        </span>
      </Show>
      <div class="lang-group" role="group" aria-label={t('header.language')}>
        <button
          class={`lang-btn ${locale() === 'en' ? 'lang-btn--active' : ''}`}
          onClick={() => setLocale('en')}
        >
          EN
        </button>
        <button
          class={`lang-btn ${locale() === 'zh' ? 'lang-btn--active' : ''}`}
          onClick={() => setLocale('zh')}
        >
          中文
        </button>
      </div>
      <div class="flex-1" />
      <Show when={dirty()}>
        <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
          <span class="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {t('header.unsaved')}
        </span>
      </Show>
      <label class="btn btn-secondary cursor-pointer" title={t('header.importTitle')}>
        <UploadIcon />
        {t('header.import')}
        <input
          type="file"
          accept=".oml,.zip"
          class="hidden"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void onImport(f);
            e.currentTarget.value = '';
          }}
        />
      </label>
      <button
        class="btn btn-primary"
        disabled={packProblems().length > 0}
        title={
          packProblems().length > 0
            ? t('header.exportBlocked', packProblems().length)
            : t('header.exportTitle')
        }
        onClick={() => void downloadPack(pack(), assets()).then(markClean)}
      >
        <DownloadIcon />
        {t('header.export')}
      </button>
    </header>
  );
}

function ProblemsBar() {
  return (
    <Show when={packProblems().length > 0}>
      <div class="problem-bar">
        <div class="flex items-start gap-2 px-4 py-2">
          <AlertIcon class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div class="min-w-0 flex-1">
            <p class="font-semibold">
              {t('problems.summary', packProblems().length)}
            </p>
            <ul class="mt-1 space-y-0.5">
              <For each={packProblems()}>
                {(problem) => (
                  <li class="flex gap-1.5">
                    <span class="shrink-0 font-mono text-red-400">{problem.where}</span>
                    <span class="truncate">{problem.message}</span>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </div>
      </div>
    </Show>
  );
}

export default function App() {
  const total = createMemo(() => entityCount(pack()));
  return (
    <div class="app-shell flex h-full flex-col">
      <Header />
      <ProblemsBar />
      <main class="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
        <Tree />
        <section class="min-h-0 overflow-hidden bg-slate-50">
          <EditorPane />
        </section>
        <section class="min-h-0 overflow-hidden border-l border-slate-200">
          <PreviewPane />
        </section>
      </main>
      <footer class="statusbar flex items-center gap-3 border-t border-slate-200 bg-panel px-4 text-[11px] text-slate-500">
        <span class="font-mono text-slate-600">{pack().namespace}.oml</span>
        <span class="h-3 w-px bg-slate-200" />
        <span>{t('footer.entities', total())}</span>
        <div class="flex-1" />
        <Show
          when={packProblems().length > 0}
          fallback={
            <span class="inline-flex items-center gap-1 text-emerald-600">
              <CheckIcon class="h-3 w-3" />
              {t('problems.valid')}
            </span>
          }
        >
          <span class="inline-flex items-center gap-1 text-red-600">
            <AlertIcon class="h-3 w-3" />
            {t('problems.count', packProblems().length)}
          </span>
        </Show>
      </footer>
    </div>
  );
}
