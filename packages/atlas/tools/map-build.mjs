// 지도 빌드(단계 1 계획 §2~§7): 원천(strata · 제품 은행 · 태그 자료 · 번호 장부) → 지도 생성물(map/index.json · units.json ·
// words.json · audit.json)과 장부 · 판 목록. 생성물은 커밋한다 — 패키지 빌드(tools/build.mjs)는 커밋된 생성물만 판 폴더로
// 내고 제품 코드를 부르지 않는다.
//   node packages/atlas/tools/map-build.mjs            대조만(기본) — 제품 은행 · 원천에서 다시 만든 값이 커밋된 것과 같은가
//   node packages/atlas/tools/map-build.mjs --write    다시 만들어 쓴다(장부는 덧붙이기만, 색인 내용이 바뀌면 판 +1)
// 대조가 어긋나면(drift) 끝 코드 1이다. 패키지 check는 단계 4 전까지 이 대조를 알림으로만 본다(계획 §7).
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditMap } from '../src/map/audit.mjs';
import {
  changesBetween,
  composeIndex,
  foldViewOf,
  ITEM_FIELDS,
  TEMPLATE_FIELDS,
} from '../src/map/compose.mjs';
import { appendOnly, currentName } from '../src/map/ledger.mjs';
import { MAP_FORMAT, UNITS_FORMAT, WORDS_FORMAT } from '../src/map/index.mjs';
import { readBanks, readUnits, REPO_ROOT } from './map-sources.mjs';

export const MAP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'map');
// 사람이 올리는 능력 분류 판(능력 분류가 바뀔 때만 — 설계 §4 「판 이름」). 색인 판(edition)은 빌드가 올린다 — 태그를 고치면
// 오르는 「태그 판」이고 단계 3 서버의 판 묶음에 든다(조율 세션 · 단계 3 요청 11-11).
export const SKILLS_EDITION = 1;
export const GENERATED = Object.freeze([
  'index.json',
  'units.json',
  'words.json',
  'audit.json',
  'numbers.json',
  'revisions.json',
]);
export const REVIEWED = new Set(['pass', 'fixed']);

const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const readIf = (dir, name, fallback) => {
  const file = path.join(dir, name);
  return fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''))
    : fallback;
};

// 줄 배열은 한 줄에 한 줄씩(커밋 diff가 문항 단위로 보이게), 나머지는 공백 없이.
export function serialize(value) {
  const lines = ['{'];
  const entries = Object.entries(value);
  entries.forEach(([key, field], at) => {
    const comma = at < entries.length - 1 ? ',' : '';
    if (Array.isArray(field) && field.length && Array.isArray(field[0])) {
      lines.push(`  ${JSON.stringify(key)}: [`);
      field.forEach((row, i) =>
        lines.push(`    ${JSON.stringify(row)}${i < field.length - 1 ? ',' : ''}`),
      );
      lines.push(`  ]${comma}`);
    } else lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(field)}${comma}`);
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

// 태그 자료: map/tags/<묶음>.json의 { tags: { 열쇠: { units, by, review } } }. 검수 판정(pass · fixed)이 없는 줄은 멈춘다 —
// 검수 전 초안은 tags/ 밖(.tmp)에 둔다.
export function loadTags(dir = MAP_DIR) {
  const tags = new Map();
  const tagDir = path.join(dir, 'tags');
  if (!fs.existsSync(tagDir)) return tags;
  for (const name of fs
    .readdirSync(tagDir)
    .filter(file => file.endsWith('.json'))
    .sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(tagDir, name), 'utf8'));
    for (const [key, line] of Object.entries(data.tags ?? {})) {
      if (!REVIEWED.has(line.review?.verdict))
        throw new Error(`Atlas map: 검수 판정이 없는 태그(${name} ${key})`);
      if (tags.has(key)) throw new Error(`Atlas map: 태그가 두 파일에 있다(${key})`);
      tags.set(key, { units: line.units });
    }
  }
  return tags;
}

const itemRow = row => ITEM_FIELDS.map(field => row[field]);
const templateRow = row => TEMPLATE_FIELDS.map(field => row[field]);

function decodeRows(index) {
  if (!index) return [];
  const families = new Map((index.families ?? []).map(([n, key]) => [n, key]));
  const decode = (rows, fields) =>
    (rows ?? []).map(row => {
      const out = Object.fromEntries(fields.map((field, at) => [field, row[at]]));
      return { ...out, familyKey: families.get(out.f) };
    });
  return [
    ...decode(index.items, index.fields ?? ITEM_FIELDS),
    ...decode(index.templates, index.templateFields ?? TEMPLATE_FIELDS),
  ];
}

// 색인 판의 열쇠: 접기 칸만(번호 기준) — 은행 차례 · 소리 칸 · 열쇠 이름만 바뀐 것은 판을 올리지 않는다(Fable 설계 검토 P2-5).
// 파일 바이트의 같음은 빌드 manifest의 sha256이 본다.
export function foldHash(rows) {
  const view = rows.map(row => [row.n ?? null, foldViewOf(row)]);
  return sha(JSON.stringify(view));
}

// 계열 이름이 바뀐 것으로 보이는 것(Fable 설계 검토 P2-10): 앞 색인에서 한 계열에 있던 문항들이 지금 모두 새 계열 하나로 갔고
// 옛 계열은 사라졌다. 생활 계열처럼 원고 삽입 · 덩어리 합침으로 이름이 바뀌면 장부는 은퇴 + 새 번호로 보아 만남 기록이 끊긴다 —
// renames.families에 적을지 사람이 정해야 한다.
export function familyRenameCandidates(previous, rows, renames = {}) {
  const before = decodeRows(previous).filter(row => row.n !== null && row.n !== undefined);
  const now = new Map(rows.filter(row => row.n).map(row => [row.n, row]));
  const liveFamilies = new Set(rows.map(row => row.familyKey));
  const knownBefore = new Set(before.map(row => row.familyKey));
  const moved = new Map();
  for (const row of before) {
    const next = now.get(row.n);
    if (!next || liveFamilies.has(row.familyKey) || knownBefore.has(next.familyKey)) continue;
    if (!moved.has(row.familyKey)) moved.set(row.familyKey, new Set());
    moved.get(row.familyKey).add(next.familyKey);
  }
  return [...moved]
    .filter(([, targets]) => targets.size === 1)
    .map(([from, targets]) => [from, [...targets][0]])
    .filter(([from, to]) => currentName(from, renames) !== to);
}

export function nextEdition(previous, body, hash, revisions, rows) {
  if (previous?.hash === hash) return { edition: previous.edition, revisions };
  const edition = (previous?.edition ?? 0) + 1;
  if (!previous) return { edition, revisions: [...revisions, { edition, hash, initial: true }] };
  const change = changesBetween(decodeRows(previous), rows);
  return { edition, revisions: [...revisions, { edition, hash, ...change }] };
}

function sharedRows(shared, rows) {
  return [...shared]
    .map(([key, banks]) => {
      const row = rows.find(r => (r.itemKey ?? `family:${r.familyKey}`) === key);
      return [row.n ?? `f${row.f}`, banks];
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function indexBody(composed, renames) {
  return {
    format: MAP_FORMAT,
    skillsEdition: SKILLS_EDITION,
    fields: ITEM_FIELDS,
    items: composed.items.map(itemRow),
    templateFields: TEMPLATE_FIELDS,
    templates: composed.templates.map(templateRow),
    families: composed.families,
    shared: sharedRows(composed.shared, [...composed.items, ...composed.templates]),
    retired: composed.retired,
    renames,
  };
}

function unitFiles(units, words) {
  const unitsBody = { format: UNITS_FORMAT, fields: ['id', 'kind', 'label', 'level'], units };
  const wordsBody = {
    format: WORDS_FORMAT,
    prefix: 'ko.word.',
    fields: ['id', 'label', 'pos', 'band'],
    units: words,
  };
  return {
    units: { ...unitsBody, hash: sha(JSON.stringify(unitsBody)) },
    words: { ...wordsBody, hash: sha(JSON.stringify(wordsBody)) },
  };
}

// 원천에서 지도 생성물 전부를 만든다(쓰지 않는다). dir의 장부 · 판 목록 · 앞 색인을 읽는다.
export async function buildMap({ root = REPO_ROOT, dir = MAP_DIR } = {}) {
  const { units, words, skills } = await readUnits(root);
  const banks = await readBanks(root);
  const ledger = readIf(dir, 'numbers.json', { items: [], families: [] });
  const renames = readIf(dir, 'renames.json', { units: {}, items: {}, families: {} });
  const previous = readIf(dir, 'index.json', null);
  const unitIds = new Set([...units.map(([id]) => id), ...words.map(([id]) => `ko.word.${id}`)]);
  const composed = composeIndex({
    banks,
    tags: loadTags(dir),
    unitIds,
    skills,
    ledger,
    renames,
  });
  const ledgerProblems = appendOnly(ledger, composed.ledger);
  if (ledgerProblems.length) throw new Error(`Atlas map: ${ledgerProblems.join(' · ')}`);
  const body = indexBody(composed, renames);
  const rows = [...composed.items, ...composed.templates];
  const hash = foldHash(rows);
  const { edition, revisions } = nextEdition(
    previous,
    body,
    hash,
    readIf(dir, 'revisions.json', { revisions: [] }).revisions,
    rows,
  );
  const unitDocs = unitFiles(units, words);
  const catalog = [
    ...units.map(([id, kind]) => ({ id, kind })),
    ...words.map(([id]) => ({ id: `ko.word.${id}`, kind: 'word' })),
  ];
  const audit = { ...auditMap(rows, catalog), orphanTags: composed.orphanTags };
  // 계열 이름 후보는 앞 색인에 기대는 값이라 커밋하는 보고(audit.json)에 싣지 않는다 — 쓴 직후 대조가 어긋나지 않게(Fable 최종 P2-2).
  const familyRenames = previous
    ? familyRenameCandidates(previous, rows, renames.families ?? {})
    : [];
  return {
    files: {
      'index.json': serialize({ ...body, edition, hash }),
      'units.json': serialize(unitDocs.units),
      'words.json': serialize(unitDocs.words),
      'audit.json': `${JSON.stringify({ edition, hash, ...audit }, null, 2)}\n`,
      'numbers.json': serialize({
        _: '번호 장부 — 덧붙이기만 한다(설계 §4). 줄을 고치거나 지우지 않는다. map-build --write만 늘린다.',
        ...composed.ledger,
      }),
      'revisions.json': `${JSON.stringify({ revisions }, null, 2)}\n`,
    },
    audit,
    familyRenames,
    ledger: composed.ledger,
    edition,
    hash,
  };
}

// 커밋된 생성물과 다시 만든 것의 어긋남(파일 이름 목록).
export function driftOf(files, dir = MAP_DIR) {
  return GENERATED.filter(name => {
    const file = path.join(dir, name);
    return !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== files[name];
  });
}

// origin/master의 장부(다른 세션이 먼저 늘렸을 수 있다 — Fable 설계 검토 P3-16). 읽을 수 없으면 null.
function originLedger() {
  try {
    const text = execFileSync('git', ['show', 'origin/master:packages/atlas/map/numbers.json'], {
      cwd: MAP_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// --write 앞에 멈출 까닭: 계열 이름 후보(사람이 renames에 적거나 --계열이름확인으로 넘긴다) · origin 장부가 앞섬.
export function writeBlockers(
  { familyRenames, ledger },
  { confirmed = false, origin = originLedger() } = {},
) {
  const blockers = [];
  if (familyRenames.length && !confirmed)
    blockers.push(
      `계열 이름이 바뀐 것으로 보인다 — map/renames.json의 families에 적거나 --계열이름확인: ${familyRenames.map(([a, b]) => `${a} → ${b}`).join(' · ')}`,
    );
  if (!origin) console.log('atlas map: origin/master의 장부를 읽지 못해 그 대조는 건너뛴다');
  const behind = origin ? appendOnly(origin, ledger) : [];
  if (behind.length)
    blockers.push(
      `origin/master의 장부와 어긋난다(먼저 rebase): ${behind.slice(0, 3).join(' · ')}`,
    );
  return blockers;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const write = process.argv.includes('--write');
  const built = await buildMap();
  const { files, audit, edition, hash } = built;
  const drift = driftOf(files);
  console.log(
    `atlas map · 능력 분류 판 ${SKILLS_EDITION} · 색인(태그) 판 ${edition} (${hash}) · 문항 태그 없음 ${audit.untagged.untagged}/${audit.untagged.total} · 문항 하나뿐인 단위 ${audit.onlyItem.length} · 고아 태그 ${audit.orphanTags.length}`,
  );
  const blockers = write
    ? writeBlockers(built, { confirmed: process.argv.includes('--계열이름확인') })
    : [];
  if (blockers.length) {
    console.log(`atlas map: 쓰지 않았다 — ${blockers.join(' / ')}`);
    process.exitCode = 1;
  } else if (write) {
    for (const name of drift) fs.writeFileSync(path.join(MAP_DIR, name), files[name]);
    console.log(`atlas map: 썼다 — ${drift.join(' · ') || '바뀐 것 없음'}`);
  } else if (drift.length) {
    console.log(`atlas map: 커밋된 생성물과 다르다 — ${drift.join(' · ')} (map-build --write)`);
    process.exitCode = 1;
  }
}
