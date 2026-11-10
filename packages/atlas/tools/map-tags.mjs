// 태그 채우기와 2중 검수(단계 1 계획 §5 · 운영 원칙의 문항 검수 — 1차 Opus · 2차 아르곤). 새 LLM 실행기가 아니다 — 부르는 통로는
// tools/lib/클로드키.js(일괄)와 tools/lib/제미나이구독호출.js 그대로다(tools/topik-review.mjs와 같은 꼴).
//   node packages/atlas/tools/map-tags.mjs 준비 <이름> --은행 <은행,…>   묶음(.tmp/atlas-map-tags/<이름>/packet.json)
//   node … 초안 <이름> --보내기 | --받기                                  규칙 초안이 없는 문항만 Opus가 초안(일괄 — 반값)
//   node … 클로드 <이름> --보내기 | --받기                                1차 검수(Opus 일괄)
//   node … 아르곤 <이름> [--묶음 12]                                      2차 검수(구독 — 차례로, 목록 끝 표식 확인)
//   node … 판정 <이름>                                                    둘을 합쳐 엇갈린 줄을 judge.md로 — 판정은 세션(Opus)이 judge.json에 쓴다
//   node … 반영 <이름>                                                    통과 줄을 map/tags/<은행>.json에(검수 줄과 함께)
// 묶음 · 응답은 git 밖(.tmp)에 두고, 판정을 거친 태그만 패키지 자료에 들어간다. 제품 은행은 고치지 않는다(계획 §5).
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP_DIR } from './map-build.mjs';
import { BANKS, readBanks, readUnits, REPO_ROOT } from './map-sources.mjs';
import { ALL_ITEMS, MULTI_ONLY, tagContent } from './map-tags-content.mjs';

const require = createRequire(import.meta.url);
export const RUBRIC_ID = 'atlas-tags-r1';
const CLAUDE_MODEL = 'claude-opus-5-5';
// 11-11 유호님 「제미나이 관련한 검수 … 전부 카본(max)」 — 아르곤 검수 모델은 Gemini 4 Carbon high(agy의 가장 높은 수준).
const ARGON = { model: 'gemini-4-carbon', thinking: 'high', label: 'gemini-4-carbon-high' };
const WORK = path.join(REPO_ROOT, '.tmp', 'atlas-map-tags');
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}
const rubricText = () =>
  fs.readFileSync(path.join(MAP_DIR, 'tags', 'rubric-r1.md'), 'utf8').replace(/\r\n/g, '\n');

// ── 준비 ──────────────────────────────────────────────────────────────────────────────

function catalogText(units, words) {
  const grammar = units
    .filter(([, kind]) => kind === 'grammar')
    .map(([id, , label]) => `${id} ${label}`);
  const life = units.filter(([, kind]) => kind === 'life').map(([id, , label]) => `${id} ${label}`);
  const word = words.map(([id, label, pos]) => `ko.word.${id} ${label}(${pos})`);
  return [
    '# 지도의 단위(이 목록 밖의 id는 쓸 수 없다)',
    '## 문형',
    ...grammar,
    '## 생활 표현',
    ...life,
    '## 낱말',
    ...word,
  ].join('\n');
}

async function prepare(name, banks) {
  const dir = path.join(WORK, name);
  if (fs.existsSync(path.join(dir, 'packet.json'))) throw new Error(`이미 있는 묶음: ${dir}`);
  const { units, words } = await readUnits();
  const items = (await readBanks(REPO_ROOT, banks)).flatMap(bank =>
    bank.items.map(item => ({ ...item, bank: bank.bank })),
  );
  const rows = await tagContent(REPO_ROOT, items, { units, words });
  const rubric = rubricText();
  const catalog = catalogText(units, words);
  writeJson(path.join(dir, 'packet.json'), {
    name,
    rubric: { id: RUBRIC_ID, sha: sha(rubric) },
    catalog: { sha: sha(catalog) },
    banks,
    rows,
  });
  fs.writeFileSync(path.join(dir, 'catalog.md'), catalog);
  const drafted = rows.filter(row => row.draft).length;
  console.log(
    `${dir} · 문항 ${rows.length} · 규칙 초안 ${drafted} · Opus 초안 ${rows.length - drafted}`,
  );
}

// ── Opus 일괄(초안 · 1차) ────────────────────────────────────────────────────────────────

const UNIT_LIST = { type: 'array', items: { type: 'string' } };
const DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['units', 'why'],
  properties: { units: UNIT_LIST, why: { type: 'string' } },
};
const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'units', 'why'],
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fix'] },
    units: UNIT_LIST,
    why: { type: 'string' },
    note: { type: 'string' },
    outside: { type: 'array', items: { type: 'string' } },
  },
};

const itemText = row =>
  [
    `문항 열쇠: ${row.key}`,
    `은행: ${row.bank} · 능력: ${row.skillId} · 응답 꼴: ${row.responseFormat ?? '판마다'}`,
    row.show,
    row.hints.length ? `글에서 찾은 후보: ${row.hints.join(' · ')}` : '글에서 찾은 후보: 없음',
  ].join('\n');

// 단위 이름표(카탈로그의 「id 이름」 줄) — 적힌 단위를 이름과 함께 보이려고.
function labelsOf(dir) {
  const labels = new Map();
  for (const line of fs.readFileSync(path.join(dir, 'catalog.md'), 'utf8').split('\n')) {
    const at = line.indexOf(' ');
    if (line.startsWith('ko.') && at > 0) labels.set(line.slice(0, at), line.slice(at + 1));
  }
  return labels;
}
const withLabels = (units, labels) =>
  JSON.stringify(units.map(unit => (labels.has(unit) ? `${unit} ${labels.get(unit)}` : unit)));

// 검수(1차 · 2차)에는 낱말 2,000 목록을 싣지 않는다 — 문항마다 후보 낱말과 적힌 단위의 이름이 있고, 후보에 없는 낱말은
// 「낱말:<사전형>」으로 적으면 판정 때 목록에서 찾는다(키 통로가 요청마다 바이트로 어림해 한도키를 빼지 않게).
const WORD_NOTE =
  '낱말은 후보에 적힌 ko.word.<id>를 쓰고, 후보에 없는 지도 낱말이 꼭 필요하면 「낱말:<사전형>」(예: 낱말:마시다)으로 적는다.';
function system(dir, rubric, { words = true } = {}) {
  const full = fs.readFileSync(path.join(dir, 'catalog.md'), 'utf8');
  const catalog = words ? full : `${full.split('## 낱말')[0]}\n${WORD_NOTE}`;
  return [
    {
      type: 'text',
      text: `${rubric}\n\n${catalog}`,
      cache_control: { type: 'ephemeral', ttl: '1h' },
    },
  ];
}

function requestsFor(kind, packet, dir) {
  const rubric = rubricText();
  const sys = system(dir, rubric, { words: kind === 'draft' });
  const rows = kind === 'draft' ? packet.rows.filter(row => !row.draft) : packet.rows;
  const drafts = kind === 'review' ? readDrafts(dir, packet) : null;
  const labels = labelsOf(dir);
  return rows.map((row, at) => {
    const ask =
      kind === 'draft'
        ? '이 문항의 units를 정하라 — 정답을 내려면 꼭 떠올려야 하는 단위만, 첫째가 주 단위. 없으면 빈 목록.'
        : `적힌 units: ${withLabels(drafts[row.key], labels)}\n기준 1~4로 보고 pass 또는 fix(고친 units 전체)를 내라. pass면 units에 적힌 것을 그대로.`;
    return {
      custom_id: `${kind}-${at}`,
      params: {
        model: CLAUDE_MODEL,
        max_tokens: kind === 'draft' ? 4000 : 2000,
        system: sys,
        output_config: {
          effort: 'high',
          format: { type: 'json_schema', schema: kind === 'draft' ? DRAFT_SCHEMA : REVIEW_SCHEMA },
        },
        messages: [{ role: 'user', content: `${itemText(row)}\n\n${ask}` }],
      },
    };
  });
}

function readDrafts(dir, packet) {
  const opus = fs.existsSync(path.join(dir, 'draft.json'))
    ? readJson(path.join(dir, 'draft.json')).results
    : {};
  const drafts = {};
  for (const row of packet.rows) {
    const units = row.draft?.units ?? opus[row.key]?.units;
    if (!units) throw new Error(`초안이 없다: ${row.key} — 초안 --받기 먼저`);
    drafts[row.key] = units;
  }
  return drafts;
}

function parseBatch(results, rows, kind) {
  const byId = new Map(
    (kind === 'draft' ? rows.filter(row => !row.draft) : rows).map((row, at) => [
      `${kind}-${at}`,
      row,
    ]),
  );
  const out = {};
  for (const result of results) {
    const row = byId.get(result.custom_id);
    const text = result.result?.message?.content?.find(block => block.type === 'text')?.text;
    if (!row || !text) continue;
    try {
      out[row.key] = JSON.parse(text);
    } catch {
      out[row.key] = { error: 'JSON이 아니다' };
    }
  }
  return out;
}

// 일괄은 --나눔 N개씩 덩이로 보낸다 — 키 통로가 요청마다 크게 어림한 값(캐시 · 반값 전)이 한도키의 남은 몫을 넘으면 그 키를
// 빼므로(실제 값은 그보다 훨씬 작다). 덩이마다 { 배치id, 키이름 }을 남긴다(옛 꼴 — 맨 위에 배치id 하나 — 도 읽는다).
const batchesOf = made => made.batches ?? [{ 배치id: made.배치id, 키이름: made.키이름 }];

// 덩이를 보낼 때마다 기록 파일을 다시 쓴다 — 뒤 덩이가 한도로 멈춰도 앞 덩이(이미 보내져 돈이 드는 것)를 잃지 않는다
// (11-10 실측: 120개씩 다섯째 덩이에서 멈춰 넷째까지의 일괄 번호가 기록에 없었다 — 사용 기록에서 찾아 붙였다).
async function sendBatches(requests, { size, from, before, batchFile }, use, 클로드) {
  const batches = [...before];
  for (let at = from; at < requests.length; at += size) {
    const part = requests.slice(at, at + size);
    const made = await 클로드.배치보내기(part, { 용도: use });
    batches.push({ 배치id: made.배치id, 키이름: made.키이름, from: at, count: part.length });
    writeJson(batchFile, { batches, at: new Date().toISOString(), requests: requests.length });
    console.log(
      `일괄 ${made.배치id} · 키 ${made.키이름} · 요청 ${part.length} — 다음은 --부터 ${at + part.length}`,
    );
  }
  return batches;
}

async function receiveBatches(made, use, 클로드) {
  const results = [];
  const total = { 요청: 0, 성공: 0, 추정USD: 0 };
  for (const batch of batchesOf(made)) {
    const { 결과, 합계 } = await 클로드.배치결과(batch.배치id, batch.키이름, { 용도: use });
    results.push(...결과);
    total.요청 += 합계.요청;
    total.성공 += 합계.성공;
    total.추정USD = Number((total.추정USD + 합계.추정USD).toFixed(6));
  }
  return { results, total };
}

async function claudeStep(kind, name, argv) {
  const dir = path.join(WORK, name);
  const packet = readJson(path.join(dir, 'packet.json'));
  const 클로드 = require('../../../tools/lib/클로드키.js');
  const file = kind === 'draft' ? 'draft' : 'claude';
  const batchFile = path.join(dir, `${file}-batch.json`);
  const use = `atlas-map-tags:${name}:${kind}`;
  // --부터 N: 앞 덩이를 이미 보냈을 때 N번째 요청부터 이어 보내고 기록에 덧붙인다(한도에 걸려 중간에 멈춘 뒤).
  if (argv.includes('--보내기')) {
    const from = argv.includes('--부터') ? Number(argv[argv.indexOf('--부터') + 1]) : 0;
    const before = fs.existsSync(batchFile) ? readJson(batchFile) : null;
    if (before && !from) throw new Error(`이미 보낸 일괄이 있다: ${batchFile} (--부터 N으로 잇기)`);
    const requests = requestsFor(kind, packet, dir);
    const size = Number(argv[argv.indexOf('--나눔') + 1]) || requests.length;
    const already = before ? batchesOf(before) : [];
    await sendBatches(requests, { size, from, before: already, batchFile }, use, 클로드);
    return;
  }
  const made = readJson(batchFile);
  if (argv.includes('--받기')) {
    const { results, total } = await receiveBatches(made, use, 클로드);
    const parsed = parseBatch(results, packet.rows, kind);
    writeJson(path.join(dir, `${file}.json`), { batches: batchesOf(made), total, results: parsed });
    console.log(`결과 ${total.요청} · 성공 ${total.성공} · 추정 $${total.추정USD}`);
    return;
  }
  for (const batch of batchesOf(made)) {
    const state = await 클로드.배치보기(batch.배치id, batch.키이름);
    console.log(
      `${batch.배치id}: ${state.processing_status} ${JSON.stringify(state.request_counts)}`,
    );
  }
}

// ── 아르곤(2차) ──────────────────────────────────────────────────────────────────────────

const ARGON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts', 'end'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'verdict', 'units', 'why'],
        properties: {
          key: { type: 'string' },
          verdict: { type: 'string', enum: ['pass', 'fix'] },
          units: UNIT_LIST,
          why: { type: 'string' },
          note: { type: 'string' },
          outside: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    end: { type: 'boolean' },
  },
};

function argonPrompt(rubric, group, drafts, grammar, labels) {
  const blocks = group.map(
    (row, at) =>
      `### ${at + 1}\n${itemText(row)}\n적힌 units: ${withLabels(drafts[row.key], labels)}`,
  );
  return [
    rubric,
    '# 문형 · 생활 표현 단위',
    grammar,
    WORD_NOTE,
    `# 문항 ${group.length}개 — 문항마다 판정 하나, 마지막에 "end": true`,
    ...blocks,
    `# 목록 끝(문항 ${group.length}개)`,
  ].join('\n\n');
}

async function argonGroup(group, context) {
  const started = Date.now();
  let error = null;
  try {
    const record = await context.call({
      model: ARGON.model,
      thinking: ARGON.thinking,
      prompt: argonPrompt(context.rubric, group, context.drafts, context.grammar, context.labels),
      schema: ARGON_SCHEMA,
      timeoutMs: 1_200_000,
    });
    const parsed = JSON.parse(record.text);
    if (parsed.end !== true) error = '목록 끝 표식이 없다';
    for (const verdict of parsed.verdicts ?? [])
      if (group.some(row => row.key === verdict.key)) context.state.results[verdict.key] = verdict;
  } catch (e) {
    error = e.message;
  }
  context.state.calls.push({
    keys: group.map(row => row.key),
    seconds: Math.round((Date.now() - started) / 1000),
    error,
    at: new Date().toISOString(),
  });
  // 쓰기 전에 파일의 결과와 합친다 — 같은 묶음을 다른 실행이 함께 쓰고 있어도(멈춘 줄 안 앞 실행 등) 서로의 결과를 덮지 않는다.
  const onDisk = fs.existsSync(context.outFile) ? readJson(context.outFile) : null;
  if (onDisk) context.state.results = { ...onDisk.results, ...context.state.results };
  writeJson(context.outFile, context.state);
  const missing = group.filter(row => !context.state.results[row.key]).length;
  console.log(`아르곤 묶음 ${group.length} · 빠짐 ${missing}${error ? ` · ${error}` : ''}`);
}

// 묶음을 --동시 개수만큼 함께 보낸다(아르곤 high는 한 호출이 길어 차례로만 돌면 몇 시간 걸린다 — 현장 노트 AI_CLI).
async function argonStep(name, argv) {
  const dir = path.join(WORK, name);
  const packet = readJson(path.join(dir, 'packet.json'));
  const outFile = path.join(dir, 'argon.json');
  const option = flag => Number(argv[argv.indexOf(flag) + 1]) || null;
  const context = {
    call: require('../../../tools/lib/제미나이구독호출.js').부르기,
    rubric: rubricText(),
    drafts: readDrafts(dir, packet),
    grammar: fs.readFileSync(path.join(dir, 'catalog.md'), 'utf8').split('## 낱말')[0],
    labels: labelsOf(dir),
    state: fs.existsSync(outFile)
      ? readJson(outFile)
      : { model: ARGON.label, calls: [], results: {} },
    outFile,
  };
  const size = (argv.includes('--묶음') && option('--묶음')) || 12;
  const parallel = (argv.includes('--동시') && option('--동시')) || 3;
  const pending = packet.rows.filter(row => !context.state.results[row.key]);
  const groups = [];
  for (let at = 0; at < pending.length; at += size) groups.push(pending.slice(at, at + size));
  const worker = async () => {
    while (groups.length) await argonGroup(groups.shift(), context);
  };
  await Promise.all(Array.from({ length: parallel }, worker));
  const done = packet.rows.filter(row => context.state.results[row.key]).length;
  console.log(`아르곤 결과 ${done}/${packet.rows.length}`);
}

// ── 판정 · 반영 ───────────────────────────────────────────────────────────────────────────

// 검수자가 「낱말:<사전형>」으로 적은 것을 지도 낱말 id로 바꾼다(이름이 2,000 안에서 하나뿐이다). 못 찾으면 그대로 둔다 —
// 반영이 「지도에 없는 단위」로 멈춰 판정에서 다시 본다.
function resolveWords(verdict, byLabel) {
  if (!verdict?.units) return verdict;
  const units = verdict.units.map(unit => {
    const word = unit.startsWith('낱말:') ? byLabel.get(unit.slice(3).trim()) : null;
    return word ?? unit;
  });
  return { ...verdict, units };
}

function verdictsOf(dir, packet) {
  const drafts = readDrafts(dir, packet);
  const claude = readJson(path.join(dir, 'claude.json')).results;
  const argon = readJson(path.join(dir, 'argon.json')).results;
  const byLabel = new Map(
    [...labelsOf(dir)].map(([id, label]) => [label.replace(/\(.*\)$/, ''), id]),
  );
  return packet.rows.map(row => ({
    row,
    draft: drafts[row.key],
    first: resolveWords(claude[row.key] ?? null, byLabel),
    second: resolveWords(argon[row.key] ?? null, byLabel),
  }));
}

// 두 검수의 일치: 둘 다 통과면 초안, 둘 다 고쳤고 고친 단위 목록(차례까지)이 같으면 그 목록. 그 밖은 판정(세션)이 정한다.
const sameUnits = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// 일치했어도 지도 밖 단위가 있으면 판정으로 돌린다 — 반영이 멈춘 채 풀 길이 없지 않게(Fable 최종 P2-3).
function agreedUnits(v) {
  if (v.first?.verdict === 'pass' && v.second?.verdict === 'pass')
    return { units: v.draft, verdict: 'pass' };
  if (
    v.first?.verdict === 'fix' &&
    v.second?.verdict === 'fix' &&
    sameUnits(v.first.units, v.second.units)
  )
    return { units: v.first.units, verdict: 'fixed' };
  return null;
}
export function agreementOf(v, known = null) {
  const agreed = agreedUnits(v);
  if (!agreed || !Array.isArray(agreed.units)) return null;
  if (known && agreed.units.some(unit => !known.has(unit))) return null;
  return agreed;
}

function judgeReport(name) {
  const dir = path.join(WORK, name);
  const packet = readJson(path.join(dir, 'packet.json'));
  const all = verdictsOf(dir, packet);
  const known = new Set(labelsOf(dir).keys());
  const open = all.filter(v => !agreementOf(v, known));
  const lines = [`# ${name} 판정할 줄 ${open.length}/${all.length}`, ''];
  for (const v of open) {
    lines.push(`## ${v.row.key}`, '', itemText(v.row), '');
    lines.push(`- 초안(${v.row.draft?.by ?? 'draft:opus'}): ${JSON.stringify(v.draft)}`);
    lines.push(
      `- 1차 Opus: ${v.first?.verdict ?? '없음'} ${JSON.stringify(v.first?.units ?? null)} — ${v.first?.why ?? ''}`,
    );
    lines.push(
      `- 2차 아르곤: ${v.second?.verdict ?? '없음'} ${JSON.stringify(v.second?.units ?? null)} — ${v.second?.why ?? ''}`,
      '',
    );
  }
  fs.writeFileSync(path.join(dir, 'judge.md'), `${lines.join('\n')}\n`);
  console.log(`${path.join(dir, 'judge.md')} · 판정할 줄 ${open.length}/${all.length}`);
}

// judge.json: { 열쇠: { units, why } } — 엇갈린 줄마다 판정(Opus)이 정한 값. units가 빈 목록이면 단위 없는 줄을 쓴다(계열 단위로 돈다).
function lineFor(v, judge, known, { name, at }) {
  const agreed = judge[v.row.key] ? null : agreementOf(v, known);
  if (!agreed && !judge[v.row.key]) throw new Error(`판정이 없다: ${v.row.key} — judge.json`);
  const chosen = agreed ? agreed.units : judge[v.row.key].units;
  for (const unit of chosen ?? [])
    if (!known.has(unit)) throw new Error(`지도에 없는 단위: ${v.row.key} ${unit}`);
  // 빈 목록도 줄로 남긴다 — 줄이 없으면 조립이 제품 conceptIds로 되돌아간다(태그 자료 > 제품). 빈 줄 = 계열 단위로 돈다.
  if (!Array.isArray(chosen)) throw new Error(`판정 단위 목록이 없다: ${v.row.key}`);
  return {
    units: chosen,
    by: v.row.draft?.by ?? 'draft:opus',
    review: {
      rubric: RUBRIC_ID,
      packet: name,
      first: v.first?.verdict ?? null,
      second: v.second?.verdict ?? null,
      verdict: agreed?.verdict ?? 'fixed',
      ...(agreed ? {} : { judge: judge[v.row.key].why ?? null }),
      at,
    },
  };
}

function writeBankTags(byBank) {
  for (const [bank, tags] of byBank) {
    const file = path.join(MAP_DIR, 'tags', `${bank}.json`);
    const before = fs.existsSync(file) ? readJson(file) : { rubric: RUBRIC_ID, tags: {} };
    const merged = { ...before.tags, ...tags };
    const ordered = Object.fromEntries(
      Object.entries(merged).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
    writeJson(file, { ...before, tags: ordered });
    console.log(`${file} · 줄 ${Object.keys(tags).length}`);
  }
}

async function apply(name) {
  const dir = path.join(WORK, name);
  const packet = readJson(path.join(dir, 'packet.json'));
  const judge = fs.existsSync(path.join(dir, 'judge.json'))
    ? readJson(path.join(dir, 'judge.json'))
    : {};
  const { units, words } = await readUnits();
  const known = new Set([...units.map(([id]) => id), ...words.map(([id]) => `ko.word.${id}`)]);
  const context = { name, at: new Date().toISOString().slice(0, 10) };
  const byBank = new Map();
  for (const v of verdictsOf(dir, packet)) {
    const line = lineFor(v, judge, known, context);
    if (!line) continue;
    if (!byBank.has(v.row.bank)) byBank.set(v.row.bank, {});
    byBank.get(v.row.bank)[v.row.key] = line;
  }
  writeBankTags(byBank);
}

const COMMANDS = {
  준비: (name, argv) => {
    const given = argv.includes('--은행') ? argv[argv.indexOf('--은행') + 1].split(',') : null;
    const banks = given ?? [...ALL_ITEMS, ...MULTI_ONLY];
    if (banks.some(bank => !BANKS[bank])) throw new Error('--은행 <은행,…>');
    return prepare(name, banks);
  },
  초안: (name, argv) => claudeStep('draft', name, argv),
  클로드: (name, argv) => claudeStep('review', name, argv),
  아르곤: argonStep,
  판정: judgeReport,
  반영: apply,
};

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const [command, name, ...rest] = process.argv.slice(2);
  if (!COMMANDS[command] || !name)
    throw new Error(`사용법: map-tags.mjs <${Object.keys(COMMANDS).join('|')}> <이름> …`);
  await COMMANDS[command](name, rest);
}
