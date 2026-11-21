import { For, Show, createMemo, createSignal } from 'solid-js';
import type { Entity, TimelineMarker } from '../lib/model';
import { t } from '../lib/i18n';
import { keyCharError } from '../lib/ids';
import { fieldError, validateEntity } from '../lib/validate';
import { sectionsFor, type FieldSpec } from './sections';
import { PlusIcon, TrashIcon } from './icons';
import { addDefault, findEntity } from '../lib/store';
import { updateEntity } from '../lib/store';

/**
 * Field-spec-driven entity editors: one renderer covers every type; the spec per field declares
 * the input kind and the hard constraints. The spec mirrors the loader's accepted key set per
 * type — a field here is a key there, so the form cannot produce a key the loader would reject.
 */

// ---------- generic inputs ----------

function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  kind?: 'number' | 'float';
  min?: number;
  max?: number;
  invalid?: boolean;
}) {
  return (
    <input
      class={`input ${props.invalid ? 'input--invalid' : ''}`}
      type="number"
      step={props.kind === 'float' ? '0.05' : '1'}
      min={props.min}
      max={props.max}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.currentTarget.value)}
    />
  );
}

function StringListInput(props: { value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  return (
    <div>
      <textarea
        class="textarea h-20"
        value={props.value.join('\n')}
        placeholder={t('form.onePerLine')}
        onChange={(e) =>
          props.onChange(
            e.currentTarget.value
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l !== ''),
          )
        }
      />
      <Show when={props.hint}>
        <p class="hint">{props.hint}</p>
      </Show>
    </div>
  );
}

function Field(props: { spec: FieldSpec; value: unknown; onChange: (v: unknown) => void }) {
  const f = () => props.spec;
  const error = () => fieldError(f(), props.value);
  return (
    <label class="block">
      <span class="label">{f().label}</span>
      <Show
        when={f().kind !== 'boolean'}
        fallback={
          <input
            type="checkbox"
            class="checkbox"
            checked={props.value === true}
            onChange={(e) => props.onChange(e.currentTarget.checked)}
          />
        }
      >
        <Show
          when={f().options}
          fallback={
            <Show
              when={f().kind !== 'text'}
              fallback={
                <input
                  class={`input ${error() ? 'input--invalid' : ''}`}
                  value={props.value === undefined || props.value === null ? '' : String(props.value)}
                  placeholder={f().placeholder}
                  onChange={(e) =>
                    props.onChange(e.currentTarget.value === '' ? undefined : e.currentTarget.value)
                  }
                />
              }
            >
              <TextInput
                kind={f().kind === 'float' ? 'float' : 'number'}
                min={f().min}
                max={f().max}
                invalid={error() !== null}
                value={props.value === undefined || props.value === null ? '' : String(props.value)}
                placeholder={f().placeholder}
                onChange={(v) => {
                  if (v === '') return props.onChange(undefined);
                  const n = Number(v);
                  props.onChange(Number.isNaN(n) ? undefined : n);
                }}
              />
            </Show>
          }
        >
          {(options) => (
            <select
              class={`select ${error() ? 'input--invalid' : ''}`}
              value={props.value === undefined || props.value === null ? '' : String(props.value)}
              onChange={(e) =>
                props.onChange(e.currentTarget.value === '' ? undefined : e.currentTarget.value)
              }
            >
              <option value="">—</option>
              <For each={options()}>{(option) => <option value={option}>{option}</option>}</For>
            </select>
          )}
        </Show>
      </Show>
      <Show when={error()}>
        <p class="field-error">{error()}</p>
      </Show>
      <Show when={f().hintKey}>
        <p class="hint">{t(f().hintKey!)}</p>
      </Show>
    </label>
  );
}

// ---------- sub-editors ----------

function ToolRulesEditor(props: {
  label: string;
  value: { block: string; speed: number }[] | undefined;
  onChange: (v: { block: string; speed: number }[] | undefined) => void;
}) {
  const rules = () => props.value ?? [];
  return (
    <div class="subcard">
      <div class="mb-2 flex items-center justify-between">
        <span class="section-kicker">{props.label}</span>
        <button
          class="btn btn-soft btn-sm"
          onClick={() => props.onChange([...rules(), { block: 'minecraft:stone', speed: 4 }])}
        >
          <PlusIcon class="h-3 w-3" />
          {t('form.rule')}
        </button>
      </div>
      <div class="space-y-1.5">
        <For each={rules()}>
          {(rule, i) => (
            <div class="flex gap-1.5">
              <input
                class="input font-mono"
                value={rule.block}
                onChange={(e) => {
                  const next = [...rules()];
                  next[i()] = { ...rule, block: e.currentTarget.value };
                  props.onChange(next);
                }}
              />
              <input
                class="input w-20 shrink-0"
                type="number"
                step="0.5"
                value={String(rule.speed)}
                onChange={(e) => {
                  const next = [...rules()];
                  next[i()] = { ...rule, speed: Number(e.currentTarget.value) || 1 };
                  props.onChange(next);
                }}
              />
              <button
                class="btn btn-ghost btn-icon btn-sm shrink-0"
                title={t('form.removeRule')}
                onClick={() => {
                  const next = rules().filter((_, j) => j !== i());
                  props.onChange(next.length > 0 ? next : undefined);
                }}
              >
                <TrashIcon class="h-3 w-3" />
              </button>
            </div>
          )}
        </For>
      </div>
      <p class="hint">{t('form.toolRulesHint')}</p>
    </div>
  );
}

function MarkerEditor(props: {
  value: TimelineMarker[] | undefined;
  onChange: (v: TimelineMarker[] | undefined) => void;
}) {
  const markers = () => props.value ?? [];
  const nextName = () => {
    const names = new Set(markers().map((m) => m.name));
    let candidate = 'marker';
    let n = 2;
    while (names.has(candidate)) candidate = `marker_${n++}`;
    return candidate;
  };
  return (
    <div class="subcard">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-[11px] text-slate-500">{t('form.markersLabel')}</span>
        <button
          class="btn btn-soft btn-sm"
          onClick={() => props.onChange([...markers(), { name: nextName(), ticks: 0 }])}
        >
          <PlusIcon class="h-3 w-3" />
          {t('form.marker')}
        </button>
      </div>
      <div class="space-y-1.5">
        <For each={markers()}>
          {(marker, i) => (
            <div class="flex items-center gap-1.5">
              <input
                class="input font-mono"
                value={marker.name}
                placeholder="dusk"
                onChange={(e) => {
                  const next = [...markers()];
                  next[i()] = { ...marker, name: e.currentTarget.value };
                  props.onChange(next);
                }}
              />
              <input
                class="input w-20 shrink-0"
                type="number"
                step="1"
                value={String(marker.ticks)}
                onChange={(e) => {
                  const next = [...markers()];
                  next[i()] = { ...marker, ticks: Number(e.currentTarget.value) };
                  props.onChange(next);
                }}
              />
              <label class="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
                <input
                  type="checkbox"
                  class="checkbox"
                  checked={marker.inCommands === true}
                  onChange={(e) => {
                    const next = [...markers()];
                    next[i()] = { ...marker, inCommands: e.currentTarget.checked };
                    props.onChange(next);
                  }}
                />
                /time
              </label>
              <button
                class="btn btn-ghost btn-icon btn-sm shrink-0"
                title={t('form.removeMarker')}
                onClick={() => {
                  const next = markers().filter((_, j) => j !== i());
                  props.onChange(next.length > 0 ? next : undefined);
                }}
              >
                <TrashIcon class="h-3 w-3" />
              </button>
            </div>
          )}
        </For>
      </div>
      <p class="hint">{t('form.markerHint')}</p>
    </div>
  );
}

interface CraftingShape {
  type: 'shaped' | 'shapeless';
  count?: number;
  pattern?: string[];
  key?: Record<string, string>;
  ingredients?: string[];
}

function CraftingEditor(props: { value: CraftingShape; onChange: (v: CraftingShape) => void }) {
  const v = () => props.value;
  const [charError, setCharError] = createSignal<string | null>(null);
  const shaped = () => v().type !== 'shapeless';
  const rows = () => {
    const p = v().pattern ?? [];
    return [0, 1, 2].map((r) => (p[r] ?? '').slice(0, 3).padEnd(3, ' '));
  };
  const setCell = (row: number, col: number, raw: string) => {
    const ch = raw.trim().slice(0, 1);
    if (ch !== '' && keyCharError(ch)) {
      setCharError(keyCharError(ch));
      return;
    }
    setCharError(null);
    const line = rows()[row].split('');
    line[col] = ch || ' ';
    const pattern = rows().map((r, i) => (i === row ? line.join('') : r));
    props.onChange({ ...v(), type: 'shaped', pattern });
  };
  const usedChars = () => {
    const set = new Set<string>();
    for (const row of rows()) for (const ch of row) if (ch !== ' ') set.add(ch);
    return [...set].sort();
  };
  return (
    <div class="subcard space-y-3">
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-1.5 text-[11px] text-slate-600">
          <input
            type="radio"
            class="checkbox"
            checked={shaped()}
            onChange={() => props.onChange({ ...v(), type: 'shaped' })}
          />
          {t('form.shaped')}
        </label>
        <label class="flex items-center gap-1.5 text-[11px] text-slate-600">
          <input
            type="radio"
            class="checkbox"
            checked={!shaped()}
            onChange={() => props.onChange({ ...v(), type: 'shapeless' })}
          />
          {t('form.shapeless')}
        </label>
        <label class="ml-auto flex items-center gap-1.5 text-[11px] text-slate-600">
          {t('form.count')}
          <input
            class="input w-16"
            type="number"
            min="1"
            value={v().count ?? 1}
            onChange={(e) => props.onChange({ ...v(), count: Number(e.currentTarget.value) || 1 })}
          />
        </label>
      </div>
      <Show
        when={shaped()}
        fallback={
          <StringListInput
            value={v().ingredients ?? []}
            hint={t('form.shapelessHint')}
            onChange={(ingredients) => props.onChange({ ...v(), ingredients })}
          />
        }
      >
        <div class="grid w-fit grid-cols-3 gap-1.5">
          <For each={[0, 1, 2]}>
            {(row) => (
              <For each={[0, 1, 2]}>
                {(col) => (
                  <input
                    class="grid-cell"
                    maxLength={1}
                    value={rows()[row][col] ?? ' '}
                    onChange={(e) => setCell(row, col, e.currentTarget.value)}
                  />
                )}
              </For>
            )}
          </For>
        </div>
        <div class="space-y-1.5">
          <For each={usedChars()}>
            {(ch) => (
              <div class="flex items-center gap-2">
                <span class="key-badge">{ch}</span>
                <input
                  class="input font-mono"
                  value={v().key?.[ch] ?? ''}
                  placeholder="minecraft:item_id"
                  onChange={(e) => {
                    const key = { ...(v().key ?? {}) };
                    if (e.currentTarget.value === '') delete key[ch];
                    else key[ch] = e.currentTarget.value;
                    props.onChange({ ...v(), key });
                  }}
                />
              </div>
            )}
          </For>
        </div>
        <Show when={charError()}>
          <p class="field-error">{charError()}</p>
        </Show>
        <p class="hint">{t('form.craftingHint')}</p>
      </Show>
    </div>
  );
}

interface OreShape {
  veinSize: number;
  perChunk: number;
  minY: number;
  maxY: number;
  biomes: string[];
}

function OreEditor(props: { value: OreShape; onChange: (v: OreShape) => void }) {
  const v = () => props.value;
  const set = (patch: Partial<OreShape>) => props.onChange({ ...v(), ...patch });
  const numField = (label: string, key: keyof OreShape) => (
    <label class="block">
      <span class="label">{label}</span>
      <input
        class="input"
        type="number"
        value={String(v()[key])}
        onChange={(e) => set({ [key]: Number(e.currentTarget.value) } as Partial<OreShape>)}
      />
    </label>
  );
  return (
    <div class="subcard grid grid-cols-2 gap-3">
      {numField('vein_size', 'veinSize')}
      {numField('per_chunk', 'perChunk')}
      {numField('min_y', 'minY')}
      {numField('max_y', 'maxY')}
      <div class="col-span-2">
        <StringListInput
          value={v().biomes}
          hint={t('form.oreBiomesHint')}
          onChange={(biomes) => set({ biomes })}
        />
      </div>
    </div>
  );
}

// ---------- the form ----------

type EntityRecord = Record<string, unknown>;

function dropFor(blockId: string): { drop: string } | undefined {
  const loot = findEntity('loot', blockId) as { drop: string } | undefined;
  return loot;
}

export function EntityForm(props: { type: string; entity: Entity }) {
  const e = () => props.entity as unknown as EntityRecord;
  const set = (key: string, value: unknown) => {
    updateEntity(props.type as never, props.entity.id, { ...props.entity, [key]: value } as never);
  };
  const fieldKeys = createMemo(() => {
    const keys = new Set<string>();
    for (const section of sectionsFor(props.type)) {
      for (const field of section.fields) keys.add(field.key);
    }
    return keys;
  });
  // Field-level problems already render under their inputs; everything else (ore, crafting
  // shape, marker rows, string lists) surfaces here.
  const panelIssues = createMemo(() =>
    validateEntity(props.type, props.entity).filter((i) => !i.key || !fieldKeys().has(i.key)),
  );

  return (
    <div class="space-y-3">
      <Show when={panelIssues().length > 0}>
        <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <ul class="space-y-0.5">
            <For each={panelIssues()}>
              {(issue) => (
                <li>
                  {issue.key ? <span class="font-mono text-red-500">{issue.key}: </span> : null}
                  {issue.message}
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
      <For each={sectionsFor(props.type)}>
        {(section) => (
          <section class="card">
            <header class="border-b border-slate-100 px-4 py-2.5">
              <span class="section-kicker">{t(section.titleKey)}</span>
            </header>
            <div class="p-4">
              <Show when={section.fields.length > 0}>
                <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
                  <For each={section.fields}>
                    {(f) => <Field spec={f} value={e()[f.key]} onChange={(v) => set(f.key, v)} />}
                  </For>
                </div>
              </Show>
              <Show when={section.sub === 'ore'}>
                <Show
                  when={e().ore !== undefined}
                  fallback={
                    <button
                      class="btn btn-soft btn-sm"
                      onClick={() =>
                        set('ore', { veinSize: 9, perChunk: 8, minY: 16, maxY: 64, biomes: [] })
                      }
                    >
                      <PlusIcon class="h-3 w-3" />
                      {t('form.generateOre')}
                    </button>
                  }
                >
                  <OreEditor
                    value={e().ore as unknown as OreShape}
                    onChange={(ore) => set('ore', ore)}
                  />
                </Show>
              </Show>
              <Show when={section.sub === 'crafting'}>
                <CraftingEditor
                  value={props.entity as unknown as CraftingShape}
                  onChange={(next) =>
                    updateEntity(
                      props.type as never,
                      props.entity.id,
                      { ...props.entity, ...next } as never,
                    )
                  }
                />
              </Show>
              <Show when={section.records === 'toolRules'}>
                <div class="space-y-2">
                  <ToolRulesEditor
                    label="mines_and_drops"
                    value={e().minesAndDrops as { block: string; speed: number }[] | undefined}
                    onChange={(v) => set('minesAndDrops', v)}
                  />
                  <ToolRulesEditor
                    label="denies_drops"
                    value={e().deniesDrops as { block: string; speed: number }[] | undefined}
                    onChange={(v) => set('deniesDrops', v)}
                  />
                  <ToolRulesEditor
                    label="override_speed"
                    value={e().overrideSpeed as { block: string; speed: number }[] | undefined}
                    onChange={(v) => set('overrideSpeed', v)}
                  />
                </div>
              </Show>
              <Show when={section.records === 'markers'}>
                <MarkerEditor
                  value={e().markers as TimelineMarker[] | undefined}
                  onChange={(v) => set('markers', v)}
                />
              </Show>
              <Show when={section.strings}>
                {(s) => (
                  <div class="mt-3">
                    <StringListInput
                      value={(e()[s().key] as string[] | undefined) ?? []}
                      hint={s().hintKey ? t(s().hintKey!) : undefined}
                      onChange={(v) => set(s().key, v.length > 0 ? v : undefined)}
                    />
                  </div>
                )}
              </Show>
            </div>
          </section>
        )}
      </For>
      <Show when={props.type === 'block'}>
        <section class="card">
          <header class="border-b border-slate-100 px-4 py-2.5">
            <span class="section-kicker">{t('sections.blockLoot')}</span>
          </header>
          <div class="flex items-center justify-between gap-3 p-4">
            <Show
              when={dropFor(props.entity.id)}
              fallback={
                <span class="text-xs text-slate-400">{t('form.dropNone')}</span>
              }
            >
              <div>
                <p class="text-xs text-slate-500">
                  {t('form.drops', dropFor(props.entity.id)!.drop)}
                </p>
                <p class="hint">{t('form.dropHint')}</p>
              </div>
            </Show>
            <Show when={!dropFor(props.entity.id)}>
              <button
                class="btn btn-soft btn-sm shrink-0"
                onClick={() => addDefault('loot', props.entity.id)}
              >
                <PlusIcon class="h-3 w-3" />
                {t('form.addDrop')}
              </button>
            </Show>
          </div>
        </section>
      </Show>
    </div>
  );
}
