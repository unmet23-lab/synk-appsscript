// 태그 채우기와 2중 검수(단계 1 계획 §5 · 운영 원칙의 문항 검수 — 1차 Opus · 2차 아르곤). 새 LLM 실행기가 아니다 — 부르는 통로는
// tools/lib/클로드키.js(일괄)와 tools/lib/제미나이구독호출.js 그대로다(tools/topik-review.mjs와 같은 꼴).
//   node packages/atlas/tools/map-tags.mjs 준비 <이름> --은행 <은행,…>   묶음(.tmp/atlas-map-tags/<이름>/packet.json)
//        [--태그없음] [--다시 <열쇠,…>]                                    검수 전 태그 없는 문항만 · 이미 태그가 있는 문항 다시
//   node … 까닭 <파일>                                                    태그 없는 문항과 그 까닭 목록(markdown)
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
// r2(11-11): r1에 낱말 뜻(표제어 하나) · 보조 용언과 부정 「안 · 못」은 문형 — 두 줄을 더함(낱말 뜻 고르기와 함께).
export const RUBRIC_ID = 'atlas-tags-r2';
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
// 기준 글은 판마다 파일 하나(rubric-r1.md · rubric-r2.md) — 묶음은 준비한 판의 글로 검수 · 반영한다(GPT 보충 검수 GB3).
const rubricText = (id = RUBRIC_ID) =>
  fs
    .readFileSync(path.join(MAP_DIR, 'tags', `rubric-${id.replace('atlas-tags-', '')}.md`), 'utf8')
    .replace(/\r\n/g, '\n');

// 묶음을 준비한 뒤 기준 글이나 지도 단위 목록(낱말 뜻 포함)이 바뀌었으면 그 묶음의 검수는 옛 뜻을 본 것이다 — 보내기 · 반영을
// 멈추고 새 묶음으로 준비한다(GPT 보충 검수 GB3: id를 그대로 두고 뜻만 바꾸는 뜻 고르기에서 낡은 검수가 새 뜻에 붙을 수 있었다).
export function packetDrift(packet, catalog = null) {
  const problems = [];
  if (packet.rubric?.sha !== sha(rubricText(packet.rubric?.id)))
    problems.push(`기준 글 ${packet.rubric?.id}이 묶음을 준비한 뒤 바뀌었다`);
  if (catalog !== null && packet.catalog?.sha !== sha(catalog))
    problems.push('지도 단위 목록(낱말 뜻 포함)이 묶음을 준비한 뒤 바뀌었다');
  if (problems.length) throw new Error(`${problems.join(' · ')} — 새 묶음으로 준비한다`);
}
// 초안 · 1차 보내기와 2차 보내기 · 반영 모두 지금 지도로 대조한다(GPT 보충 검수 GB3 다시 검수 — 보내는 때도).
async function assertFresh(packet) {
  const { units, words } = await readUnits();
  packetDrift(packet, catalogText(units, words));
}

// ── 준비 ──────────────────────────────────────────────────────────────────────────────

// 낱말 이름: 글(품사 · 뜻) — 뜻은 같은 글의 다른 표제어가 흔한 낱말에만 있다(map/senses.json).
export const wordName = (label, pos, sense) => `${label}(${pos}${sense ? ` · ${sense}` : ''})`;

function catalogText(units, words) {
  const grammar = units
    .filter(([, kind]) => kind === 'grammar')
    .map(([id, , label]) => `${id} ${label}`);
  const life = units.filter(([, kind]) => kind === 'life').map(([id, , label]) => `${id} ${label}`);
  const word = words.map(
    ([id, label, pos, , sense]) => `ko.word.${id} ${wordName(label, pos, sense)}`,
  );
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

// 지금 태그 자료의 줄(열쇠 → { units, by, review, why? }).
function tagLines() {
  const lines = new Map();
  const dir = path.join(MAP_DIR, 'tags');
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.json')))
    for (const [key, line] of Object.entries(readJson(path.join(dir, file)).tags ?? {}))
      lines.set(key, line);
  return lines;
}

// 고르기(11-11 둘째 묶음): --태그없음은 커밋된 색인에서 단위가 비었고 태그 줄도 없는 문항(검수 전 — 판정이 빈 목록으로 정한 줄은
// 빼고), --다시 <열쇠,…>는 이미 태그가 있는 문항을 지금 단위를 초안으로 다시 본다(낱말 뜻 고르기로 뜻이 바뀐 단위). 둘 다 없으면
// 첫 묶음의 고르기(selected — 은행 전체 · 제품 태그 둘 이상).
function picker({ untagged, again }) {
  if (!untagged && !again.size) return { pick: null, drafts: new Map() };
  const index = readJson(path.join(MAP_DIR, 'index.json'));
  const [key, unitsAt] = ['itemKey', 'units'].map(field => index.fields.indexOf(field));
  const current = new Map(index.items.map(row => [row[key], row[unitsAt]]));
  const lines = tagLines();
  const missing = [...again].filter(item => !current.has(item));
  if (missing.length) throw new Error(`--다시의 열쇠가 색인에 없다: ${missing.join(' · ')}`);
  const drafts = new Map(
    [...again].map(item => [
      item,
      { units: current.get(item), by: lines.get(item)?.by ?? 'product', again: true },
    ]),
  );
  const pick = item =>
    again.has(item.itemKey) ||
    (untagged && current.get(item.itemKey)?.length === 0 && !lines.has(item.itemKey));
  return { pick, drafts };
}

async function prepare(name, banks, choice = { untagged: false, again: new Set() }) {
  const dir = path.join(WORK, name);
  if (fs.existsSync(path.join(dir, 'packet.json'))) throw new Error(`이미 있는 묶음: ${dir}`);
  const { units, words } = await readUnits();
  const items = (await readBanks(REPO_ROOT, banks)).flatMap(bank =>
    bank.items.map(item => ({ ...item, bank: bank.bank })),
  );
  const { pick, drafts } = picker(choice);
  const rows = await tagContent(REPO_ROOT, items, { units, words, pick, drafts });
  const absent = [...choice.again].filter(key => !rows.some(row => row.key === key));
  if (absent.length) throw new Error(`--다시의 문항이 고른 은행에 없다: ${absent.join(' · ')}`);
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
  packetDrift(packet);
  const rubric = rubricText(packet.rubric.id);
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
    await assertFresh(packet);
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

export async function argonGroup(group, context) {
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
    // 목록 끝 표식이 없거나 묶음의 문항 가운데 판정이 빠진 답은 끝까지 읽었다고 볼 수 없다 — 묶음 전체를 저장하지 않아 다음 실행이
    // 그 묶음을 통째로 다시 보낸다(GPT 보충 검수 GB1 · 다시 검수).
    const answered = new Map((parsed.verdicts ?? []).map(verdict => [verdict.key, verdict]));
    const missing = group.filter(row => !answered.has(row.key)).length;
    if (parsed.end !== true) error = '목록 끝 표식이 없다 — 묶음을 저장하지 않음';
    else if (missing) error = `판정이 빠진 문항 ${missing} — 묶음을 저장하지 않음`;
    else for (const row of group) context.state.results[row.key] = answered.get(row.key);
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
  await assertFresh(packet);
  const outFile = path.join(dir, 'argon.json');
  const option = flag => Number(argv[argv.indexOf(flag) + 1]) || null;
  const context = {
    call: require('../../../tools/lib/제미나이구독호출.js').부르기,
    rubric: rubricText(packet.rubric.id),
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

// 검수자가 「낱말:<사전형>」으로 적은 것을 지도 낱말 id로 바꾼다. 같은 글 단위가 둘 이상(뜻 고르기의 개 · 새 · 말 · 눈 · 차)이면
// 어느 뜻인지 모르므로 바꾸지 않는다. 못 찾으면 그대로 둔다 — 반영이 「지도에 없는 단위」로 멈춰 판정에서 다시 본다.
export function labelIndex(labels) {
  const byLabel = new Map();
  for (const [id, name] of labels) {
    if (!id.startsWith('ko.word.')) continue;
    const label = name.replace(/\(.*\)$/, '');
    byLabel.set(label, byLabel.has(label) ? null : id);
  }
  return byLabel;
}
// 검수자는 묶음에 보인 「id 이름」 꼴을 그대로 돌려줄 때가 많다(11-11 실측 — 1차 고침 19 가운데 18) — id만 남긴다. 떼지 않으면
// 둘이 같은 고침도 「지도에 없는 단위」로 판정에 넘어갔다(첫 묶음 같은 고침 22 가운데 20).
function resolveWords(verdict, byLabel) {
  if (!verdict?.units) return verdict;
  const units = verdict.units.map(unit => {
    if (unit.startsWith('ko.')) return unit.split(' ')[0];
    const word = unit.startsWith('낱말:') ? byLabel.get(unit.slice(3).trim()) : null;
    return word ?? unit;
  });
  return { ...verdict, units };
}

function verdictsOf(dir, packet) {
  const drafts = readDrafts(dir, packet);
  const claude = readJson(path.join(dir, 'claude.json')).results;
  const argon = readJson(path.join(dir, 'argon.json')).results;
  const byLabel = labelIndex(labelsOf(dir));
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

// 빈 목록은 까닭을 줄에 남긴다(태그를 붙일 수 없는 문항 목록 — map-tags 까닭): 판정이 있으면 판정, 없으면 1차 · 2차의 까닭.
function emptyWhy(v, judge, chosen) {
  if (chosen.length) return {};
  return { why: judge[v.row.key]?.why ?? v.first?.why ?? v.second?.why ?? null };
}

// judge.json: { 열쇠: { units, why } } — 엇갈린 줄마다 판정(Opus)이 정한 값. units가 빈 목록이면 단위 없는 줄을 쓴다(계열 단위로 돈다).
const TWO_REVIEWS = new Set(['pass', 'fix']);
// 판정은 엇갈린 두 검수를 가르는 길이지 검수를 건너뛰는 길이 아니다 — 1차 · 2차가 다 있어야 줄을 쓴다(GPT 보충 검수 GB2).
function chosenUnits(v, judge, known) {
  if (!TWO_REVIEWS.has(v.first?.verdict) || !TWO_REVIEWS.has(v.second?.verdict))
    throw new Error(`1차 · 2차 검수가 다 있지 않다: ${v.row.key} — 클로드 · 아르곤 먼저`);
  const agreed = judge[v.row.key] ? null : agreementOf(v, known);
  if (!agreed && !judge[v.row.key]) throw new Error(`판정이 없다: ${v.row.key} — judge.json`);
  const chosen = agreed ? agreed.units : judge[v.row.key].units;
  // 빈 목록도 줄로 남긴다 — 줄이 없으면 조립이 제품 conceptIds로 되돌아간다(태그 자료 > 제품). 빈 줄 = 계열 단위로 돈다.
  if (!Array.isArray(chosen)) throw new Error(`판정 단위 목록이 없다: ${v.row.key}`);
  for (const unit of chosen)
    if (!known.has(unit)) throw new Error(`지도에 없는 단위: ${v.row.key} ${unit}`);
  return { agreed, chosen };
}

export function lineFor(v, judge, known, { name, at, rubric }) {
  const { agreed, chosen } = chosenUnits(v, judge, known);
  return {
    units: chosen,
    ...emptyWhy(v, judge, chosen),
    by: v.row.draft?.by ?? 'draft:opus',
    review: {
      rubric,
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
  packetDrift(packet, catalogText(units, words));
  const known = new Set([...units.map(([id]) => id), ...words.map(([id]) => `ko.word.${id}`)]);
  const context = { name, at: new Date().toISOString().slice(0, 10), rubric: packet.rubric.id };
  const byBank = new Map();
  for (const v of verdictsOf(dir, packet)) {
    const line = lineFor(v, judge, known, context);
    if (!line) continue;
    if (!byBank.has(v.row.bank)) byBank.set(v.row.bank, {});
    byBank.get(v.row.bank)[v.row.key] = line;
  }
  writeBankTags(byBank);
}

// 태그를 붙일 수 없는 문항(커밋된 색인에서 단위가 빈 문항)과 그 까닭 — 은행별 markdown. 까닭은 태그 줄의 why(빈 목록 판정의
// 까닭), 옛 줄은 판정 글(review.judge), 줄이 없으면 「검수 전」.
function reasons(out) {
  const index = readJson(path.join(MAP_DIR, 'index.json'));
  const at = field => index.fields.indexOf(field);
  const lines = tagLines();
  const byBank = new Map();
  for (const row of index.items) {
    if (row[at('units')].length) continue;
    const key = row[at('itemKey')];
    const line = lines.get(key);
    const why = line ? (line.why ?? line.review?.judge ?? '(까닭 없음)') : '검수 전';
    const bank = row[at('bank')];
    byBank.set(bank, [...(byBank.get(bank) ?? []), `- \`${key}\` — ${why.replace(/\n/g, ' ')}`]);
  }
  const total = [...byBank.values()].reduce((sum, list) => sum + list.length, 0);
  const text = [
    `# 태그를 붙일 수 없는 문항 ${total} (색인 판 ${index.edition})`,
    '',
    '`node packages/atlas/tools/map-tags.mjs 까닭 <파일>`이 커밋된 색인과 태그 자료에서 만든다. 이 문항들은 계열이 곧 단위로 돈다(계획 §2). 까닭은 2중 검수(1차 Opus · 2차 아르곤)와 Opus 판정이 빈 목록으로 정한 근거다.',
    '',
    ...[...byBank].flatMap(([bank, list]) => [`## ${bank} (${list.length})`, '', ...list, '']),
  ].join('\n');
  fs.writeFileSync(out, text);
  console.log(`${out} · ${total}`);
}

const COMMANDS = {
  까닭: reasons,
  준비: (name, argv) => {
    const list = flag => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1].split(',') : null);
    const banks = list('--은행') ?? [...ALL_ITEMS, ...MULTI_ONLY];
    if (banks.some(bank => !BANKS[bank])) throw new Error('--은행 <은행,…>');
    const choice = { untagged: argv.includes('--태그없음'), again: new Set(list('--다시') ?? []) };
    return prepare(name, banks, choice);
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
