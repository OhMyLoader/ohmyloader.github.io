// API-reference guard (plan §3 AC-8, §5.4): every API member the site documents must exist in the
// loader source. Scope: the **inline code spans** on the api/ reference pages (en + zh) — the
// signature tables and prose references that name API members. Fenced example blocks are out of
// scope on purpose: they carry user-side sample code and game-side calls the loader does not own,
// and a guard that drowns in exemptions trains people to ignore it.
//
// How it works:
//   1. walk the loader's oml-api / oml-api-26_3 sources and index every declared name
//      (fun with optional receiver, val/var, class/object/interface);
//   2. walk the site's api pages and extract two token shapes from inline code:
//        - call-shaped: the identifier immediately before `(` in each span
//          (`Container.countOf(` → countOf, `.every(...)` → every);
//        - OML-shaped: spans starting with `OML` or `Events.` — every dotted segment must resolve.
//   3. anything not found is a failure, unless it is a Kotlin keyword or listed in EXEMPT with a reason.
//
// Loader sources resolve via OML_SOURCES, or by probing the two layouts a checkout can produce:
// the workspace layout (loader is a sibling of the site repo) and the CI layout (actions/checkout
// puts a `path:` checkout INSIDE the workspace root, so the loader is a subdirectory of the site
// checkout — not beside it). Zero runtime dependencies; run with `node scripts/check-api-refs.mjs`.

import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function resolveLoaderRoot() {
    if (process.env.OML_SOURCES) return process.env.OML_SOURCES;
    const candidates = [
        {path: join(SITE_ROOT, '..', 'OhMyLoader'), why: 'workspace sibling layout'},
        {path: join(SITE_ROOT, 'OhMyLoader'), why: 'CI checkout layout'},
    ];
    for (const candidate of candidates) {
        if (existsSync(join(candidate.path, 'oml-api', 'src', 'main', 'kotlin'))) return candidate.path;
    }
    // Neither probe hit: report the first candidate as the expected place, the message stays honest.
    return candidates[0].path;
}

const LOADER_ROOT = resolveLoaderRoot();

const SOURCE_DIRS = [
    join(LOADER_ROOT, 'oml-api/src/main/kotlin'),
    join(LOADER_ROOT, 'oml-api-26_3/src/main/kotlin'),
];

// Kotlin words that legitimately appear before a paren in docs and are not OML API.
const KEYWORDS = new Set([
    'if', 'for', 'while', 'when', 'return', 'super', 'else', 'try', 'catch', 'throw', 'in', 'is',
]);

// Site-documented names that are not loader API, each with a reason. Kept explicit — a growing
// allowlist is a smell; entries graduate into the index by being real API.
const EXEMPT = new Map([
    // the user-side sample classes the doc examples define themselves (network.md, command.md)
    ['Sync', 'a payload type the example defines, not loader API'],
    // the game's own dimension-type method, cited in content.md while explaining the native page's
    // weather behavior — the same surface the native page documents wholesale
    ['canHaveWeather', 'a game member (dimension type), explained on the native page'],
]);

const failureBias = (msg) => {
    console.error(msg);
    process.exitCode = 1;
};

// ---------- 1. the index ----------

function* kotlinFiles(dir) {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) yield* kotlinFiles(path);
        else if (entry.name.endsWith('.kt')) yield path;
    }
}

const members = new Set(); // fun/val/var names, exact case
const types = new Set(); // class/object/interface simple names
for (const dir of SOURCE_DIRS) {
    let files;
    try {
        files = [...kotlinFiles(dir)];
    } catch {
        failureBias(`check-api-refs: cannot read loader sources at ${dir} — set OML_SOURCES`);
        process.exit(process.exitCode ?? 1);
    }
    for (const file of files) {
        for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
            // Generics first: `fun <T : Any> Registry<Timeline>.name(` — strip `<…>` so the plain
            // declaration shapes below match. Declarations are single-line for the name itself.
            const line = rawLine.replace(/<[^<>]*>/g, '');
            for (const m of line.matchAll(/\bfun\s+(?:[A-Za-z_][\w.]*\.)?([A-Za-z_]\w*)\s*\(/g)) members.add(m[1]);
            for (const m of line.matchAll(/\b(?:val|var)\s+(?:[A-Za-z_][\w.]*\.)?([A-Za-z_]\w*)\s*(?::|=|\bget\b|\bset\b)/g)) members.add(m[1]);
            for (const m of line.matchAll(/\b(?:class|interface|object)\s+([A-Za-z_]\w*)/g)) types.add(m[1]);
        }
    }
}
const apiNames = new Set([...members, ...types]);
if (apiNames.size === 0) failureBias('check-api-refs: the loader API index came out empty — OML_SOURCES wrong?');

// ---------- 2. the site's documented references ----------

const API_PAGES = ['api', 'zh/api'];

function* inlineSpans(markdown) {
    let inFence = false;
    for (const [index, line] of markdown.split('\n').entries()) {
        if (/^\s*```/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        for (const m of line.matchAll(/`([^`]+)`/g)) {
            yield {token: m[1], line: index + 1};
        }
    }
}

const failures = [];
const checked = new Set();

// Per-page exemptions (the check-sync.mjs pattern: explicit, with a reason, never a loosened check).
const PAGE_EXEMPTIONS = new Map([
    // The native-access page's very subject is the game's own members reachable through typed
    // payloads (`MinecraftServer.tickCount`, `Level.isLoaded`, `LivingEntity.heal`, `Container.getItem`
    // …) — game members are not loader API, and that is the page's point, not a drift.
    ['api/native.md', 'documents game-side members, which are not loader API'],
    ['zh/api/native.md', '同上（中文镜像）'],
]);

// Lines linking at the native page are referrals to that same game-member surface
// (content.md: "`dimensionType()` … [/api/native]"), not loader-API claims.
function linksAtNativePage(line) {
    return /\((\.\.)?\/(zh\/)?api\/native[#)]/.test(line);
}

function checkName(name, where) {
    if (KEYWORDS.has(name) || EXEMPT.has(name)) return;
    checked.add(name);
    if (!apiNames.has(name) && !members.has(name)) {
        failures.push(`  ${where}: '${name}' is not in the loader API index`);
    }
}

for (const dir of API_PAGES) {
    const full = join(SITE_ROOT, dir);
    let pages;
    try {
        pages = readdirSync(full).filter((f) => f.endsWith('.md'));
    } catch {
        failureBias(`check-api-refs: cannot list ${full}`);
        process.exit(process.exitCode ?? 1);
    }
    for (const page of pages) {
        const where = `${dir}/${page}`;
        const pageExempt = PAGE_EXEMPTIONS.has(where);
        const markdown = readFileSync(join(full, page), 'utf8');
        for (const {token, line} of inlineSpans(markdown)) {
            const lineText = markdown.split('\n')[line - 1];
            // call-shaped: every identifier immediately before a `(` in the span
            if (!pageExempt && !linksAtNativePage(lineText)) {
                for (const m of token.matchAll(/([A-Za-z_]\w*)\s*\(/g)) {
                    checkName(m[1], `${where}:${line}`);
                }
            }
            // OML-shaped: `OML*` and `Events.*` spans name loader types and their members. Segment
            // cleanup: call suffix, null-assertion `?` and generics come off; ALL-CAPS segments are
            // enum constants or const vals (const vals are indexed, enum entries need no index).
            if (/^OML[A-Za-z0-9_]*(\.|$)/.test(token) || token.startsWith('Events.')) {
                for (const rawSegment of token.replace(/<.*$/, '').split('.')) {
                    const segment = rawSegment.replace(/\(.*?\)/g, '').replace(/[()?]/g, '');
                    if (segment === 'Events' || segment === '' || /^[A-Z0-9_]+$/.test(segment)) continue;
                    checkName(segment, `${where}:${line}`);
                }
            }
        }
    }
}

// ---------- 3. the verdict ----------

console.log(`check-api-refs: ${apiNames.size} loader API names indexed, ${checked.size} documented references checked`);
if (failures.length > 0) {
    failureBias(`check-api-refs: ${failures.length} documented reference(s) missing from the loader source\n${failures.join('\n')}`);
} else {
    console.log('check-api-refs: OK');
}
