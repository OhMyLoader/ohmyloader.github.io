// en/zh sync guard: compares every root markdown page with its zh/ counterpart.
//
// The site rule is "english (root) and chinese (zh/) correspond one-to-one; a change
// to one side must be mirrored to the other". This script turns that rule into a
// checkable gate. It compares structure only (headings, fences, containers, tables,
// code tokens) — prose wording is free to differ.
//
// Zero runtime dependencies; run with `node scripts/check-sync.mjs`.
//
// Failure bias: false positives train people to ignore the gate, so anything that
// must legitimately differ is opted out explicitly, never by loosening a check:
//   - inline marker in the md file:   <!-- sync-ignore -->            (all checks)
//                                     <!-- sync-ignore: tables, tokens --> (listed checks)
//   - or the EXEMPTIONS table below (kept for cases where the marker cannot sit
//     in the file itself). Every entry needs a reason.
// Checks default to ON for every pair.

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// file paths are posix-style relative to the site root (e.g. "api/config.md")
const EXEMPTIONS = [
  // { file: 'api/config.md', checks: ['tokens'], reason: '...' },
];

const CHECK_IDS = ['existence', 'headings', 'fences', 'containers', 'tables', 'tokens'];

// single-side files that have no zh counterpart by design
const UNPAIRED = new Set(['README.md']);
// directories never scanned
const SKIP_DIRS = new Set(['node_modules', '.vitepress', '.git', 'dist', 'run']);

// line-comment markers per fenced-code language
const LINE_COMMENTS = {
  kotlin: '//', java: '//', kt: '//', kts: '//', groovy: '//', scala: '//',
  javascript: '//', js: '//', typescript: '//', ts: '//',
  c: '//', cpp: '//', rust: '//', go: '//', swift: '//',
  bash: '#', sh: '#', shell: '#', console: '#', powershell: '#', ps1: '#',
  yaml: '#', yml: '#', toml: '#', python: '#', py: '#', ruby: '#', rb: '#',
  ini: '#', properties: '#', dockerfile: '#',
};

class File {
  constructor(relPath, raw) {
    this.path = relPath;
    this.lines = stripFrontmatter(raw.split(/\r?\n/));
    // filled by parse()
    this.headings = [];      // { level, line }
    this.fenceLangs = [];    // { lang, line }
    this.fenceBalanced = true;
    this.containers = [];    // { type, line } for openers only
    this.containersBalanced = true;
    this.tables = [];        // { line, rows: [colCount] }
    this.inlineTokens = new Map(); // token -> first line
    this.codeTokens = new Map();   // token -> first line
  }
}

function stripFrontmatter(lines) {
  if (lines[0] !== undefined && /^---\s*$/.test(lines[0])) {
    for (let i = 1; i < lines.length; i++) {
      if (/^---\s*$/.test(lines[i])) return lines.slice(i + 1);
    }
  }
  return lines;
}

function parseFile(relPath, raw) {
  const file = new File(relPath, raw);
  const lines = file.lines;

  let inFence = false;
  let fenceLang = '';
  let codeLines = [];
  let openContainers = 0;
  let currentTable = null;

  const flushTable = () => {
    if (currentTable) { file.tables.push(currentTable); currentTable = null; }
  };
  const flushCode = () => {
    if (codeLines.length) extractCodeTokens(file, fenceLang, codeLines);
    codeLines = [];
  };

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;

    if (/^\s*```/.test(line)) {
      if (!inFence) {
        inFence = true;
        fenceLang = line.replace(/^\s*```/, '').trim().split(/\s+/)[0] || '';
        file.fenceLangs.push({ lang: fenceLang, line: lineNo });
      } else {
        inFence = false;
        flushCode();
      }
      flushTable();
      return;
    }
    if (inFence) { codeLines.push(line); return; }

    // VitePress container marker: opener "::: type [title]", closer ":::"
    if (/^:::/.test(line)) {
      flushTable();
      const m = line.match(/^:::\s*(\S+)/);
      if (m) {
        file.containers.push({ type: m[1], line: lineNo });
        openContainers++;
      } else {
        openContainers--;
        if (openContainers < 0) { file.containersBalanced = false; openContainers = 0; }
      }
      return;
    }

    const heading = line.match(/^(#{1,6})\s/);
    if (heading) {
      flushTable();
      file.headings.push({ level: heading[1].length, line: lineNo });
      extractInlineTokens(file, line, lineNo);
      return;
    }

    // table row: starts and ends with a pipe (outside fences)
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cols = splitRow(line).length;
      if (!currentTable) currentTable = { line: lineNo, rows: [] };
      currentTable.rows.push(cols);
      extractInlineTokens(file, line, lineNo);
      return;
    }
    flushTable();

    extractInlineTokens(file, line, lineNo);
  });

  if (inFence) file.fenceBalanced = false;
  if (openContainers !== 0) file.containersBalanced = false;
  flushTable();
  flushCode();
  return file;
}

// split a table row into cells; \| escapes stay inside their cell
function splitRow(line) {
  return line.trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

// inline-code tokens carrying natural language are translation examples, not API
// surface: CJK text, spaces and <...> placeholders are all free to differ between
// en and zh. Only such tokens are dropped — everything else must match exactly.
const NATURAL_LANGUAGE_TOKEN = /[\u4e00-\u9fff\s<>]/;

function extractInlineTokens(file, line, lineNo) {
  const re = /`([^`\n]+)`/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const token = m[1].trim();
    if (token && !NATURAL_LANGUAGE_TOKEN.test(token) && !file.inlineTokens.has(token)) {
      file.inlineTokens.set(token, lineNo);
    }
  }
}

// code blocks are expected to be identical across languages up to translated
// comments, so natural-language string literals and comments carry no signal:
// drop both, then collect the remaining identifiers.
function extractCodeTokens(file, lang, codeLines) {
  const commentMarker = LINE_COMMENTS[lang];
  const hasBlockComments = commentMarker === '//';
  for (let i = 0; i < codeLines.length; i++) {
    let line = codeLines[i]
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");
    if (hasBlockComments) line = line.replace(/\/\*.*?(?:\*\/|$)/g, ' ');
    if (commentMarker) {
      const at = line.indexOf(commentMarker);
      if (at !== -1) line = line.slice(0, at);
    }
    const re = /[A-Za-z_][A-Za-z0-9_$]*/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const token = m[0];
      if (!file.codeTokens.has(token)) file.codeTokens.set(token, i + 1); // line within the block
    }
  }
}

function parseExemptions(raw) {
  const ids = new Set();
  const re = /^\s*<!--\s*sync-ignore(?::\s*([^>]*?))?\s*-->\s*$/;
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(re);
    if (!m) continue;
    if (!m[1]) return { all: true, ids };
    for (const id of m[1].split(/[,\s]+/)) {
      if (id) {
        if (!CHECK_IDS.includes(id)) {
          console.error(`warning: unknown check id "${id}" in sync-ignore marker (known: ${CHECK_IDS.join(', ')})`);
        }
        ids.add(id);
      }
    }
  }
  return { all: false, ids };
}

function collectMdFiles(baseDir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...collectMdFiles(join(baseDir, entry.name), prefix ? `${prefix}${sep}${entry.name}` : entry.name));
    } else if (entry.name.endsWith('.md')) {
      out.push(prefix ? `${prefix}${sep}${entry.name}` : entry.name);
    }
  }
  return out;
}

const toPosix = (p) => p.split(sep).join('/');

// root-side scan must not include the zh/ mirror tree itself
const enFiles = new Set(
  collectMdFiles(SITE_ROOT)
    .map(toPosix)
    .filter((p) => !UNPAIRED.has(p) && p !== 'zh' && !p.startsWith('zh/')),
);
// names relative to the site root, mirroring the en tree
const zhNames = new Set(
  collectMdFiles(join(SITE_ROOT, 'zh')).map(toPosix).filter((p) => !UNPAIRED.has(p)),
);

// union of tree-relative paths, both directions
const allPaths = [...new Set([...enFiles, ...zhNames])].sort();

const problems = [];
const summaries = [];
let pairCount = 0;

for (const rel of allPaths) {
  const enPath = join(SITE_ROOT, rel);
  const zhPath = join(SITE_ROOT, 'zh', rel);
  const issues = [];
  const counts = {};

  const hasEn = enFiles.has(rel);
  const hasZh = zhNames.has(rel);
  if (!hasEn || !hasZh) {
    if (!hasEn) issues.push(`existence: zh/${rel} has no counterpart at ${rel}`);
    if (!hasZh) issues.push(`existence: ${rel} has no counterpart at zh/${rel}`);
    problems.push({ label: rel, issues, exempted: [] });
    continue;
  }
  pairCount++;

  const enRaw = readFileSync(enPath, 'utf8');
  const zhRaw = readFileSync(zhPath, 'utf8');
  const en = parseFile(rel, enRaw);
  const zh = parseFile(`zh/${rel}`, zhRaw);

  const exempt = parseExemptions(enRaw);
  const exemptZh = parseExemptions(zhRaw);
  const isExempt = (check) =>
    exempt.all || exemptZh.all || exempt.ids.has(check) || exemptZh.ids.has(check) ||
    EXEMPTIONS.some((e) => e.file === rel && (e.checks.includes(check) || e.checks.length === 0));

  const exemptedIssues = [];
  const add = (check, message) => {
    if (isExempt(check)) exemptedIssues.push(`[${check}] ${message}`);
    else issues.push(message);
  };

  // headings
  {
    counts.headings = en.headings.length;
    const max = Math.max(en.headings.length, zh.headings.length);
    for (let i = 0; i < max; i++) {
      const a = en.headings[i];
      const b = zh.headings[i];
      if (!a || !b) {
        add('headings', `headings: en has ${en.headings.length}, zh has ${zh.headings.length}` +
          (a ? ` (first extra en heading at line ${a.line})` : ` (first extra zh heading at line ${b.line})`));
        break;
      }
      if (a.level !== b.level) {
        add('headings', `headings: heading #${i + 1} level ${a.level} (en line ${a.line}) vs level ${b.level} (zh line ${b.line})`);
      }
    }
  }

  // fences
  {
    counts.fences = en.fenceLangs.length;
    if (!en.fenceBalanced || !zh.fenceBalanced) {
      add('fences', `fences: unclosed code fence (en: ${!en.fenceBalanced}, zh: ${!zh.fenceBalanced})`);
    } else {
      const max = Math.max(en.fenceLangs.length, zh.fenceLangs.length);
      for (let i = 0; i < max; i++) {
        const a = en.fenceLangs[i];
        const b = zh.fenceLangs[i];
        if (!a || !b) {
          add('fences', `fences: en has ${en.fenceLangs.length} code blocks, zh has ${zh.fenceLangs.length}`);
          break;
        }
        if (a.lang !== b.lang) {
          add('fences', `fences: code block #${i + 1} language "${a.lang}" (en line ${a.line}) vs "${b.lang}" (zh line ${b.line})`);
        }
      }
    }
  }

  // containers
  {
    counts.containers = en.containers.length;
    if (!en.containersBalanced || !zh.containersBalanced) {
      add('containers', `containers: open/close count mismatch (en: ${!en.containersBalanced}, zh: ${!zh.containersBalanced})`);
    } else {
      const max = Math.max(en.containers.length, zh.containers.length);
      for (let i = 0; i < max; i++) {
        const a = en.containers[i];
        const b = zh.containers[i];
        if (!a || !b) {
          add('containers', `containers: en has ${en.containers.length}, zh has ${zh.containers.length}` +
            (a ? ` (first extra en container at line ${a.line})` : ` (first extra zh container at line ${b.line})`));
          break;
        }
        if (a.type !== b.type) {
          add('containers', `containers: container #${i + 1} type ":::${a.type}" (en line ${a.line}) vs ":::${b.type}" (zh line ${b.line})`);
        }
      }
    }
  }

  // tables
  {
    counts.tables = en.tables.length;
    const max = Math.max(en.tables.length, zh.tables.length);
    for (let i = 0; i < max; i++) {
      const a = en.tables[i];
      const b = zh.tables[i];
      if (!a || !b) {
        add('tables', `tables: en has ${en.tables.length}, zh has ${zh.tables.length}` +
          (a ? ` (first extra en table at line ${a.line})` : ` (first extra zh table at line ${b.line})`));
        break;
      }
      if (a.rows.length !== b.rows.length) {
        add('tables', `tables: table #${i + 1} (en line ${a.line}) has ${a.rows.length} rows, zh (line ${b.line}) has ${b.rows.length}`);
        continue;
      }
      for (let r = 0; r < a.rows.length; r++) {
        if (a.rows[r] !== b.rows[r]) {
          add('tables', `tables: table #${i + 1} (en line ${a.line}) row ${r + 1} has ${a.rows[r]} columns, zh (line ${b.line}) has ${b.rows[r]}`);
        }
      }
    }
  }

  // api token sets (inline code + code-block identifiers)
  {
    counts.tokens = en.inlineTokens.size + en.codeTokens.size;
    const onlyEn = [...en.inlineTokens].filter(([t]) => !zh.inlineTokens.has(t))
      .map(([t, l]) => `\`${t}\` (en line ${l})`);
    const onlyZh = [...zh.inlineTokens].filter(([t]) => !en.inlineTokens.has(t))
      .map(([t, l]) => `\`${t}\` (zh line ${l})`);
    const onlyEnCode = [...en.codeTokens].filter(([t]) => !zh.codeTokens.has(t))
      .map(([t, l]) => `\`${t}\` (code block line ${l})`);
    const onlyZhCode = [...zh.codeTokens].filter(([t]) => !en.codeTokens.has(t))
      .map(([t, l]) => `\`${t}\` (code block line ${l})`);
    if (onlyEn.length || onlyZh.length || onlyEnCode.length || onlyZhCode.length) {
      const parts = [];
      if (onlyEn.length) parts.push(`only in en prose: ${onlyEn.join(', ')}`);
      if (onlyZh.length) parts.push(`only in zh prose: ${onlyZh.join(', ')}`);
      if (onlyEnCode.length) parts.push(`only in en code: ${onlyEnCode.join(', ')}`);
      if (onlyZhCode.length) parts.push(`only in zh code: ${onlyZhCode.join(', ')}`);
      add('tokens', `tokens: ${parts.join('; ')}`);
    }
  }

  if (issues.length || exemptedIssues.length) {
    problems.push({ label: `${rel} <-> zh/${rel}`, issues, exempted: exemptedIssues });
  } else {
    summaries.push({ rel, counts });
  }
}

const failures = problems.filter((p) => p.issues.length > 0);

// report
console.log(`check-sync: ${pairCount} en/zh pairs (${pairCount * 2} files)`);
if (failures.length === 0) {
  console.log('all pairs in sync');
  for (const { rel, counts } of summaries) {
    console.log(
      `OK ${rel.padEnd(28)} headings=${counts.headings} fences=${counts.fences} ` +
      `containers=${counts.containers} tables=${counts.tables} tokens=${counts.tokens}`,
    );
  }
  for (const p of problems) {
    console.log(`\n${p.label} (all findings exempted)`);
    for (const issue of p.exempted) console.log(`  skip ${issue}`);
  }
} else {
  for (const p of problems) {
    console.log(`\n${p.label}`);
    for (const issue of p.issues) console.log(`  FAIL ${issue}`);
    for (const issue of p.exempted) console.log(`  skip (exempted) ${issue}`);
  }
  console.error(`\n${failures.length} file(s) out of sync`);
}

process.exit(failures.length === 0 ? 0 : 1);
