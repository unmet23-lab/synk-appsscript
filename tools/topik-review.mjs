#!/usr/bin/env node
// TOPIK 문항 AI 2중 검수(교원 검수 대체, 2026-10-20 결정). 1차 Claude Opus(Message Batches · 기준 프롬프트 캐시),
// 2차 아르곤(Google AI 구독 · 영어·몽골어 해설 역번역), 엇갈리면 Opus가 두 의견을 놓고 판정한다.
// 새 LLM 실행기가 아니다 — 부르는 통로는 tools/lib/클로드키.js(일괄·한 건)와 tools/lib/제미나이구독호출.js 그대로다.
//
//   node tools/topik-review.mjs 준비 <이름> [--새 [<묶음…>]] [--새표본 N] [--기존 [<출처…>]] [--출처마다 N] [--표본 N] [--미판정]   검수 묶음(output/topik-review/<이름>/)
//   node tools/topik-review.mjs 준비 <이름> --찻집 [<줄 id…>]   싱크타운 찻집 주문 틀(rubric-compose-r1 — 목록이 없으면 증거 없는 요청 틀 전부), 반영은 review/town-tea-w10.json
//   node tools/topik-review.mjs 클로드 <이름> [--보내기|--받기]   1차: 블라인드 풀이 + 기준 검수 일괄(반값)
//   node tools/topik-review.mjs 아르곤 <이름> [--묶음 4]           2차: 독립 검수 + 해설 역번역(하나씩 차례로)
//   node tools/topik-review.mjs 판정 <이름> [--보내기]             두 검수 합치기 · 엇갈린 문항은 Opus 판정
//   node tools/topik-review.mjs 반영 <이름>                         새 문항 review 줄·reviewStatus, 기존 문항 existing-verdicts.json
//   node tools/topik-review.mjs 보고 <이름>                         판정 수·쓴 비용·1,000문항 어림(report.md)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { contentHash, itemKeyOf, familyKeyOf, reviewOutcome } from '../experiences/topik-items/validate.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankDir = path.join(root, 'experiences/topik-items');
export const RUBRIC_ID = 'topik-review-r1';
export const CLAUDE_MODEL = 'claude-opus-5-5';
export const ARGON = { model: 'gemini-4-argon', thinking: 'high', label: 'gemini-4-argon-high' };
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n'); fs.renameSync(tmp, file); };

export const WRITING_RUBRIC_ID = 'topik-review-writing-r3';
/** 찻집 주문 틀의 검수 꼴(다리 설계 §2-2 · 세로 조각 §16-3): 요청을 읽고 축마다 값을 적는 블라인드 풀이 + 기준 여섯. */
export const COMPOSE_RUBRIC_ID = 'rubric-compose-r1';
export function rubricText(kind = 'choice') {
  if (kind === 'compose') {
    const text = fs.readFileSync(path.join(bankDir, 'review/rubric-compose-r1.md'), 'utf8').replace(/\r\n/g, '\n');
    return { text, sha: sha(text).slice(0, 16), id: COMPOSE_RUBRIC_ID };
  }
  if (kind === 'writing') {
    const text = fs.readFileSync(path.join(bankDir, 'review/rubric-writing-r3.md'), 'utf8').replace(/\r\n/g, '\n');
    return { text, sha: sha(text).slice(0, 16), id: WRITING_RUBRIC_ID };
  }
  const rubric = fs.readFileSync(path.join(bankDir, 'review/rubric-r1.md'), 'utf8').replace(/\r\n/g, '\n');
  const guide = fs.readFileSync(path.join(bankDir, '작성기준.md'), 'utf8').replace(/\r\n/g, '\n');
  const text = `${rubric}\n\n---\n\n# 함께 주는 작성 기준\n\n${guide}`;
  return { text, sha: sha(text).slice(0, 16), id: RUBRIC_ID };
}

// ── 검수 단위 만들기 ────────────────────────────────────────────────
const CRITERIA = ['answer_unique', 'distractors', 'type_fit', 'level_fit', 'naturalness', 'explanation', 'culture_bias', 'exam_similarity', 'skill_fit', 'difficulty_fit'];
function typeView(type) {
  if (!type) return null;
  return { id: type.id, numbers: type.numbers, task: type.task, discourse: type.discourse, skills: type.skills, plays: type.plays ?? null, note: type.note ?? null };
}
function skillLabels() {
  const labels = {};
  for (const rel of ['strata/maps/topik-i.json', 'strata/maps/topik-ii.json']) for (const node of readJson(path.join(root, rel)).nodes) if (node.kind === 'skill') labels[node.id] = node.label_ko;
  labels['ko.listening.response'] ??= '듣고 알맞게 대답하기';
  return labels;
}
export function newItemView(item, types, labels) {
  const type = types.find(t => t.id === item.officialType);
  return { existing: false, exam: item.exam, officialType: typeView(type), targetGrade: item.targetGrade, skillId: item.skillId, skillLabel: labels[item.skillId] || null,
    difficulty: item.difficulty, set: item.set ?? null, passage: item.passage ?? null, script: item.script ?? null, question: item.question,
    choices: item.choices, answer: item.answer, explanation: item.explanation, choiceNotes: item.choiceNotes };
}
// 기존 게임 문항: 출처마다 시험 자리(맞춘 꼴)와 화면에 보이는 글. 입장 검사는 안내문·서류·짐·말을 글로 옮긴다.
// 레이싱 그림 낱말(낱말 하나를 듣고 그림 고르기)은 맞는 공식 자리가 없어(그림 자리 TI-L-15는 대화·세부) 자리 없이 본다.
const EXISTING_TYPE = { 'blank-slice': () => 'TI-R-34', 'synk-town': item => item.skillId === 'ko.reading.main' ? 'TI-R-46' : 'TI-R-43', 'entry-check': () => 'TI-R-40',
  'korean-racing': () => null, 'korean-runner': () => null, 'korean-rhythm': () => null, 'talk-rally': item => item.kind === 'follow' ? 'TI-L-05' : 'TI-L-01' };
// 듣기 게임은 진단 문항에 들리는 글이 줄여져 있어(label) 게임 원고에서 들리는 글 전체를 찾아 대본으로 보인다.
const LISTENING_FORMAT = {
  'korean-runner': '게임 꼴: 안내 한마디를 듣고 갈 길(행동)을 보기 셋 가운데 고른다. 공식 시험 자리는 없다(세부 듣기 연습)',
  'korean-rhythm': '게임 꼴: 짧은 이야기를 듣고 묻는 말이 맞으면 O, 틀리면 X를 고른다. 공식 시험 자리는 없다(듣기 이해 O/X 연습)',
  'talk-rally': '게임 꼴: 몽글(마스코트)의 한마디를 듣고 알맞은 대답 카드를 셋 가운데 고른다(시험은 넷). 대답 카드는 글로 보인다',
};
let wordById = null;
const wordOf = id => (wordById ??= new Map(readJson(path.join(root, 'strata/topik-i.words.json')).words.map(([wid, word]) => [wid, word]))).get(id) || null;
function entryText(card) {
  const lines = [`[안내문] ${card.notice.title}`, ...card.notice.rules.map(rule => `- ${rule}`)];
  if (card.date) lines.push(`[오늘] ${card.date}`); // 게임·WORLD 카드처럼 그날 날짜를 보인다(10-21)
  if (card.at) lines.push(`[지금 시각] ${card.time || card.at}`); // WORLD 카드처럼 게임 시계 꼴(오후 4시 29분, 10-22)
  if (card.doc) lines.push(`[손님 서류] ${card.doc.title}`, ...card.doc.rows.map(row => `  ${row.join(': ')}`));
  if (card.bag) lines.push(`[짐] ${card.bag.length ? card.bag.join(', ') : '없음'}`); // 게임은 빈 짐도 「보여 준 짐이 없어요.」로 보인다(10-21)
  if (card.line) lines.push(`[손님 말] ${card.who ? `${card.who}: ` : ''}${card.line}`);
  return lines.join('\n');
}
export function existingItemView(item, types, labels, { script = null } = {}) {
  if (script) {
    const typeId = EXISTING_TYPE[item.source]?.(item);
    return { existing: true, source: item.source, exam: 'topik-i', officialType: typeView(types.find(t => t.id === typeId)), fit: 'adapted',
      format: LISTENING_FORMAT[item.source] || null, targetGrade: null, skillId: item.skillId, skillLabel: labels[item.skillId] || null,
      difficulty: item.difficulty, passage: null, script, question: item.question, choices: item.choices.map(choice => choice.label),
      answer: item.choices.findIndex(choice => choice.id === item.correctId), explanation: { ko: item.explanation }, choiceNotes: null };
  }
  const typeId = EXISTING_TYPE[item.source]?.(item);
  const picture = item.ask === 'picture';
  const passage = item.source === 'entry-check' ? entryText(item.card) : picture ? `[소리로 들리는 낱말] ${item.label}` : item.prompt;
  // 그림 보기는 그림 글자(이모지)만으로는 검수자가 어느 낱말 그림인지 대조할 수 없어, 그 그림이 가리키는 낱말을 괄호로 붙인다.
  const choices = item.choices.map(choice => picture && wordOf(choice.id) ? `${choice.label}(${wordOf(choice.id)})` : choice.label);
  return { existing: true, source: item.source, exam: 'topik-i', officialType: typeView(types.find(t => t.id === typeId)), fit: 'adapted',
    ...(picture ? { format: '게임 꼴: 낱말 하나를 듣고 보기 그림(이모지) 셋 가운데 고른다. 공식 시험 자리는 없다(낱말 듣기 연습). 그림이 그 낱말을 하나로 가리키는지, 보기 그림끼리 헷갈리지 않는지, 1급 낱말인지 본다' } : {}),
    targetGrade: null, skillId: item.skillId, skillLabel: labels[item.skillId] || null, difficulty: item.difficulty, passage, script: null,
    question: item.question, choices, answer: item.choices.findIndex(choice => choice.id === item.correctId),
    explanation: { ko: item.explanation }, choiceNotes: null };
}
const blindView = view => { const { answer, explanation, choiceNotes, ...rest } = view; return rest; };

async function diagnosticItems() {
  return (await import(pathToFileURL(path.join(root, 'experiences/synk-world-app/world-diagnostic-items.mjs')))).DIAGNOSTIC_ITEMS;
}
// 말 랠리 대답 카드(WORLD 진단·연습에 들어갈 듣기 대답하기 문항)를 진단 문항과 같은 꼴로 만든다 — 열쇠는 게임과 같은 itemMetadata.
async function talkRallyItems() {
  const imp = rel => import(pathToFileURL(path.join(root, rel)));
  const [{ ITEMS }, { itemMetadata }] = await Promise.all([imp('experiences/talk-rally/content.mjs'), imp('experiences/talk-rally/learning.mjs')]);
  return ITEMS.map(item => ({ ...itemMetadata(item), source: 'talk-rally', kind: item.kind, line: item.line, question: null,
    choices: item.options.map((label, index) => ({ id: `talk-rally.${item.id}.${index}`, label })),
    correctId: `talk-rally.${item.id}.${item.options.indexOf(item.answer)}`, explanation: item.why }));
}
// 듣기 게임 문항의 들리는 글 전체(대본). 바람길은 안내 한 줄, 리듬은 이야기 + 묻는 말, 말 랠리는 몽글의 한마디.
async function listeningScripts() {
  const imp = rel => import(pathToFileURL(path.join(root, rel)));
  const [{ LISTENING_CHECKS }, { TRACKS }] = await Promise.all([imp('experiences/korean-runner/listening-check.mjs'), imp('experiences/korean-rhythm/core.mjs')]);
  return item => {
    if (item.source === 'talk-rally') return [{ speaker: '몽글', text: item.line }];
    if (item.source === 'korean-runner') {
      const check = LISTENING_CHECKS.find(c => item.id === `korean-runner.listening-check.${c.id}` || item.itemKey?.startsWith(`korean-runner.listening-check.${c.id}.`));
      return check ? [{ speaker: '안내', text: check.text }] : null;
    }
    if (item.source === 'korean-rhythm') {
      const [, track, index, variant] = String(item.id).match(/^t(\d+)q(\d+)v(\d+)$/) || [];
      const question = TRACKS.find(t => String(t.id) === track)?.questions[Number(index)];
      return question ? [{ speaker: '이야기', text: question.prompt }, { speaker: '묻는 말', text: question.claims[Number(variant)].question }] : null;
    }
    return null;
  };
}
function itemFiles() {
  const dir = path.join(bankDir, 'items');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort().map(name => ({ name, file: path.join(dir, name), data: readJson(path.join(dir, name)) })) : [];
}

// 같은 입력에 같은 표본(문항 키로 섞는다).
function seededPick(list, n, key) {
  return [...list].sort((a, b) => sha(`${key}|${a.key}`).localeCompare(sha(`${key}|${b.key}`))).slice(0, n);
}

// 쓰기 문항(쓰기 세션의 world-writing-items.json): 문항 그대로를 보이고(검수 칸만 뺀다) 쓰기 기준으로 본다.
export function writingUnits(rel) {
  const data = readJson(path.join(root, rel));
  return (data.items || []).map(item => { const { review, ...view } = item;
    return { key: item.id, kind: 'writing', file: rel, id: item.id, hash: sha(JSON.stringify(view)).slice(0, 16), view: { ...view, existing: false, section: 'writing' } }; });
}

// ── 찻집 주문 틀(compose) ─────────────────────────────────────────────
// 요청 틀 하나(네 판)가 한 단위다. 판마다 값을 바꿔 채운 예 셋까지(빈칸마다 모든 값이 한 번은 나오게)를 보이고, 「같은 걸로」 틀은
// 앞 손님 말(req-tea 틀을 같은 판으로)을 함께 준다. 정답(축마다 값, 요청하지 않은 축은 null)은 view 밖 answers에 두어
// 블라인드 풀이와 아르곤에는 보이지 않는다. 반응·단골 줄(요청 아님)은 풀이 없이 기준만 본다.
const TOWN_DATA = path.join(root, 'experiences/synk-town/town/data');
const TEA_VALUES = Object.freeze({ tea: ['barley', 'yuzu', 'today'], temp: ['warm', 'cold'], sweet: [0, 1, 2] });
const TEA_LEVELS = ['L1', 'L2', 'L3', 'L4'];
export async function teaUnits(ids = null) {
  const order = await import(pathToFileURL(path.join(root, 'experiences/synk-town/town/activities/tea-order.mjs')).href);
  const { TEA_ASSESSMENT = {} } = await import(pathToFileURL(path.join(root, 'experiences/synk-town/town/data.gen.mjs')).href);
  const { teaReviewUnitHash } = await import('./lib/town-tea-review-unit.mjs');
  const lines = readJson(path.join(TOWN_DATA, 'lines/tea.json')), axes = readJson(path.join(TOWN_DATA, 'tea.json')).axes;
  const chosen = ids?.length ? lines.filter(l => ids.includes(l.id)) : lines.filter(l => l.when?.part === 'request' && !TEA_ASSESSMENT[l.id]?.levels?.length);
  if (ids?.length && chosen.length !== ids.length) throw new Error(`찻집 줄을 못 찾았다: ${ids.filter(id => !chosen.some(l => l.id === id)).join(', ')}`);
  return chosen.map(l => {
    const w = l.when || {}, fixed = w.fixed || {};
    if (w.part !== 'request') {
      const levels = Object.fromEntries(TEA_LEVELS.map(L => [L, order.lineWords(l.id, L, { tea: 'yuzu' })]));
      return { key: `town-tea:${l.id}`, kind: 'compose', role: 'line', id: l.id, hash: sha(JSON.stringify({ when: w, levels: l.levels })).slice(0, 16),
        view: { 줄: '손님 반응 · 단골 말(요청 아님)', 뜻: l.meaning, 판: levels } };
    }
    const combos = [];
    for (let k = 0; k < 3; k++) {
      const req = Object.fromEntries(w.axes.map(a => [a, Object.hasOwn(fixed, a) ? fixed[a] : TEA_VALUES[a][k % TEA_VALUES[a].length]]));
      if (!combos.some(c => JSON.stringify(c) === JSON.stringify(req))) combos.push(req);
    }
    const levels = {}, answers = {};
    for (const L of TEA_LEVELS) {
      levels[L] = combos.map((req, i) => ({ n: i + 1, 손님: order.lineWords(l.id, L, req), ...(w.same ? { 앞손님: order.lineWords('guest.tea.req-tea.1', L, { tea: req.tea }) } : {}) }));
      answers[L] = combos.map((req, i) => ({ n: i + 1, tea: req.tea ?? null, temp: req.temp ?? null, sweet: req.sweet ?? null }));
    }
    return { key: `town-tea:${l.id}`, kind: 'compose', role: 'request', id: l.id, hash: teaReviewUnitHash(l, axes),
      view: { 줄: '손님 주문', 뜻: l.meaning, 이_판이_쓰이는_수준: w.home, 판: levels }, answers };
  });
}
/** 블라인드 풀이가 정답과 어긋난 자리: [{ level, n, axis }] — 풀이가 빠진 예도 어긋남이다. */
export function composeMisses(unit, solved = []) {
  const out = [];
  for (const [level, rows] of Object.entries(unit.answers || {})) for (const want of rows) {
    const got = (solved || []).find(r => r.level === level && r.n === want.n);
    if (!got) { out.push({ level, n: want.n, axis: 'all' }); continue; }
    for (const axis of ['tea', 'temp', 'sweet']) if ((got[axis] ?? null) !== want[axis]) out.push({ level, n: want.n, axis });
  }
  return out;
}

// --미판정: 지금 내용(지문)으로 이미 판정을 받은 문항은 다시 보내지 않는다. 고친 문항은 rev·지문이 달라 다시 들어간다.
export function alreadyJudged(unit, { review = [], verdictHash = new Map() } = {}) {
  if (unit.kind === 'new') return review.some(entry => entry.stage !== 'author-fix' && entry.rev === unit.rev && entry.hash === unit.hash);
  if (unit.kind === 'existing') return verdictHash.get(unit.key) === unit.hash;
  return false;
}

export async function prepare(name, { newFiles = null, existingSources = null, sample = null, perSource = null, newSample = null, writingFile = null, onlyIds = null, onlyUnjudged = false, teaIds = null } = {}) {
  const dir = path.join(root, 'output/topik-review', name);
  if (fs.existsSync(path.join(dir, 'packet.json'))) throw new Error(`이미 있는 묶음: ${dir}`);
  const types = readJson(path.join(root, 'strata/topik-types.json')).types, labels = skillLabels(), rubric = rubricText();
  const verdictHash = new Map((readJson(path.join(bankDir, 'review/existing-verdicts.json')).items || []).map(row => [row.itemKey, row.hash]));
  const units = [];
  if (newFiles) for (const { name: fileName, data } of itemFiles().filter(f => !newFiles.length || newFiles.includes(f.name) || newFiles.includes(f.name.replace(/\.json$/, '')))) {
    for (const item of data.items) {
      if (item.reviewStatus === 'ai-reviewed' && reviewOutcome(item) === 'pass') continue;
      const unit = { key: itemKeyOf(item), kind: 'new', file: `items/${fileName}`, id: item.id, rev: item.rev, hash: contentHash(item), view: newItemView(item, types, labels) };
      if (onlyUnjudged && alreadyJudged(unit, { review: item.review })) continue;
      units.push(unit);
    }
  }
  if (newSample) {
    const kept = new Set(seededPick(units.filter(unit => unit.kind === 'new'), newSample, name).map(unit => unit.key));
    for (let i = units.length - 1; i >= 0; i--) if (units[i].kind === 'new' && !kept.has(units[i].key)) units.splice(i, 1);
  }
  if (existingSources) {
    const all = [...await diagnosticItems(), ...(existingSources.includes('talk-rally') ? await talkRallyItems() : [])];
    const scriptOf = await listeningScripts();
    const pool = all.filter(item => item.source in EXISTING_TYPE && (!existingSources.length || existingSources.includes(item.source)));
    const picked = perSource ? Object.values(Object.groupBy(pool.map(item => ({ key: item.itemKey, item })), row => row.item.source)).flatMap(rows => seededPick(rows, perSource, name)).map(row => row.item) : pool;
    for (const item of picked) {
      const view = existingItemView(item, types, labels, { script: scriptOf(item) });
      const unit = { key: item.itemKey, kind: 'existing', source: item.source, meta: { itemKey: item.itemKey, familyKey: item.familyKey,
        skillId: item.skillId, difficulty: item.difficulty, responseFormat: item.responseFormat }, hash: sha(JSON.stringify(view)).slice(0, 16), view };
      if (onlyUnjudged && alreadyJudged(unit, { verdictHash })) continue;
      units.push(unit);
    }
  }
  if (writingFile) units.push(...writingUnits(writingFile));
  // 찻집 주문 틀(--찻집 [<줄 id…>]): 목록이 없으면 검수 증거가 없는 요청 틀 전부.
  if (teaIds) units.push(...await teaUnits(teaIds.length ? teaIds : null));
  // 고친 문항만 다시 볼 때(--문항 <id…>): 나머지는 지난 판정을 그대로 둔다.
  if (onlyIds?.length) for (let i = units.length - 1; i >= 0; i--) if (!onlyIds.includes(units[i].id) && !onlyIds.includes(units[i].key)) units.splice(i, 1);
  let chosen = units;
  if (sample && units.length > sample) chosen = seededPick(units, sample, name);
  chosen.forEach((unit, index) => { unit.ref = `u${String(index + 1).padStart(3, '0')}`; });
  const writing = chosen.some(unit => unit.kind === 'writing') ? rubricText('writing') : null;
  if (chosen.some(unit => unit.kind === 'compose') && !chosen.every(unit => unit.kind === 'compose')) throw new Error('찻집 주문 틀은 다른 문항과 한 묶음에 섞지 않는다(기준이 다르다).');
  const compose = chosen.length && chosen.every(unit => unit.kind === 'compose') ? rubricText('compose') : null;
  const packet = { name, createdAt: new Date().toISOString(), rubric: compose ? { id: compose.id, sha: compose.sha } : writing && chosen.every(unit => unit.kind === 'writing') ? { id: writing.id, sha: writing.sha }
    : { id: RUBRIC_ID, sha: rubric.sha, ...(writing ? { writing: { id: writing.id, sha: writing.sha } } : {}) }, units: chosen };
  writeJson(path.join(dir, 'packet.json'), packet);
  return packet;
}

// ── 1차 Claude ─────────────────────────────────────────────────────
const criterionSchema = { type: 'object', additionalProperties: false, required: ['ok', 'note'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } };
export const REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['solved', 'verdict', 'criteria', 'fixes', 'suggestedSkillId', 'suggestedDifficulty', 'summary'],
  properties: { solved: { type: 'integer' }, verdict: { type: 'string', enum: ['pass', 'fix', 'drop'] },
    criteria: { type: 'object', additionalProperties: false, required: CRITERIA, properties: Object.fromEntries(CRITERIA.map(c => [c, criterionSchema])) },
    fixes: { type: 'array', items: { type: 'string' } }, suggestedSkillId: { type: ['string', 'null'] }, suggestedDifficulty: { type: ['integer', 'null'] },
    summary: { type: 'string' } } };
export const BLIND_SCHEMA = { type: 'object', additionalProperties: false, required: ['solved', 'confidence', 'alsoDefensible', 'reason'],
  properties: { solved: { type: 'integer' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    alsoDefensible: { type: 'array', items: { type: 'integer' } }, reason: { type: 'string' } } };

const WRITING_CRITERIA = ['task_fit', 'model_answer', 'accept_range', 'data_consistency', 'prompt_quality', 'level_fit', 'naturalness', 'exam_similarity', 'culture_bias', 'dispute_risk'];
export const WRITING_SCHEMA = { type: 'object', additionalProperties: false, required: ['verdict', 'criteria', 'fixes', 'altAnswers', 'summary'],
  properties: { verdict: { type: 'string', enum: ['pass', 'fix', 'drop'] },
    criteria: { type: 'object', additionalProperties: false, required: WRITING_CRITERIA, properties: Object.fromEntries(WRITING_CRITERIA.map(c => [c, { type: 'object', additionalProperties: false, required: ['ok', 'note'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } }])) },
    fixes: { type: 'array', items: { type: 'string' } }, altAnswers: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } } };

// 찻집 주문 틀: 풀이 한 줄 = 판 · 채운 예 번호 · 축 셋(요청하지 않은 축은 null).
const COMPOSE_CRITERIA = ['answer_unique', 'type_fit', 'level_fit', 'naturalness', 'culture_bias', 'skill_fit'];
const composeSolved = { type: 'array', items: { type: 'object', additionalProperties: false, required: ['level', 'n', 'tea', 'temp', 'sweet'],
  properties: { level: { type: 'string', enum: TEA_LEVELS }, n: { type: 'integer' }, tea: { type: ['string', 'null'] }, temp: { type: ['string', 'null'] }, sweet: { type: ['integer', 'null'] } } } };
export const COMPOSE_BLIND_SCHEMA = { type: 'object', additionalProperties: false, required: ['solved', 'reason'], properties: { solved: composeSolved, reason: { type: 'string' } } };
export const COMPOSE_REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['verdict', 'criteria', 'levelsOk', 'fixes', 'summary'],
  properties: { verdict: { type: 'string', enum: ['pass', 'fix', 'drop'] },
    criteria: { type: 'object', additionalProperties: false, required: COMPOSE_CRITERIA, properties: Object.fromEntries(COMPOSE_CRITERIA.map(c => [c, criterionSchema])) },
    levelsOk: { type: 'array', items: { type: 'string', enum: TEA_LEVELS } }, fixes: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' } } };
const COMPOSE_ASK = '풀이: 채운 예마다(판 · n) 손님이 요청한 값을 적는다 — tea는 barley · yuzu · today, temp는 warm · cold, sweet는 0 · 1 · 2, 요청하지 않은 축은 null. 앞손님 말이 있으면 「같은 걸로」를 그 말로 푼다.';
const COMPOSE_LEVELS = 'levelsOk에는 지금 글 그대로 학생에게 보여도 되는 판(L1~L4)만 적는다 — 고칠 곳이 있는 판은 빼고 fixes에 「L3: 고친 글」처럼 적는다.';
function composeClaude(unit, system) {
  const review = { custom_id: `${unit.ref}-review`, params: { model: CLAUDE_MODEL, max_tokens: 12000, system, output_config: { effort: 'high', format: { type: 'json_schema', schema: COMPOSE_REVIEW_SCHEMA } },
    messages: [{ role: 'user', content: `아래 찻집 ${unit.role === 'request' ? '주문 틀을 위 기준대로 검수하라. 정답(만든 이가 뜻한 값)도 함께 준다 — 정답이 틀렸거나 둘로 읽히면 answer_unique에 적는다' : '손님 줄(요청 아님)을 위 기준대로 검수하라. answer_unique · skill_fit은 ok true와 「요청 아님」'}. ${COMPOSE_LEVELS}\n\n${JSON.stringify(unit.view, null, 1)}${unit.answers ? `\n\n# 정답\n${JSON.stringify(unit.answers, null, 1)}` : ''}` }] } };
  if (unit.role !== 'request') return [review];
  return [{ custom_id: `${unit.ref}-blind`, params: { model: CLAUDE_MODEL, max_tokens: 6000, system, output_config: { effort: 'medium', format: { type: 'json_schema', schema: COMPOSE_BLIND_SCHEMA } },
    messages: [{ role: 'user', content: `아래 찻집 주문을 정답을 모르는 상태에서 직접 풀어라. ${COMPOSE_ASK}\n\n${JSON.stringify(unit.view, null, 1)}` }] } }, review];
}

export function claudeRequests(packet, rubric = packet.rubric?.id === COMPOSE_RUBRIC_ID ? rubricText('compose') : rubricText(), writingRubric = packet.units.some(u => u.kind === 'writing') ? rubricText('writing') : null) {
  const system = [{ type: 'text', text: rubric.text, cache_control: { type: 'ephemeral', ttl: '1h' } }];
  if (packet.units.every(unit => unit.kind === 'compose')) return packet.units.flatMap(unit => composeClaude(unit, system));
  const writingSystem = writingRubric ? [{ type: 'text', text: writingRubric.text, cache_control: { type: 'ephemeral', ttl: '1h' } }] : null;
  return packet.units.flatMap(unit => unit.kind === 'writing' ? [
    { custom_id: `${unit.ref}-review`, params: { model: CLAUDE_MODEL, max_tokens: 16000, system: writingSystem,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: WRITING_SCHEMA } },
      messages: [{ role: 'user', content: `아래 쓰기 문항을 위 기준대로 검수하라. 51·52와 study-form은 예시답(정답)과 다른 바른 답을 altAnswers에 한두 개 적고 인정 범위가 그것을 받는지 본다(53·54·study-find는 빈 목록).\n\n${JSON.stringify(unit.view, null, 1)}` }] } },
  ] : [
    { custom_id: `${unit.ref}-blind`, params: { model: CLAUDE_MODEL, max_tokens: 6000, system,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: BLIND_SCHEMA } },
      messages: [{ role: 'user', content: `아래 문항을 정답을 모르는 상태에서 직접 풀어라. 정답이라고 보는 보기 번호(0부터)를 solved에, 그 밖에 맞다고 다툴 수 있는 보기가 있으면 alsoDefensible에 적는다.\n\n${JSON.stringify(blindView(unit.view), null, 1)}` }] } },
    { custom_id: `${unit.ref}-review`, params: { model: CLAUDE_MODEL, max_tokens: 16000, system,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: REVIEW_SCHEMA } },
      messages: [{ role: 'user', content: `아래 문항을 위 검수 기준대로 검수하라. suggestedSkillId·suggestedDifficulty는 지금 값이 틀렸을 때만 적고, 맞으면 null.\n\n${JSON.stringify(unit.view, null, 1)}` }] } },
  ]);
}

const textOf = message => (message?.content || []).filter(block => block.type === 'text').map(block => block.text).join('');
export function parseClaudeResults(packet, rows) {
  const out = {};
  for (const unit of packet.units) out[unit.ref] = { blind: null, review: null, errors: [] };
  for (const row of rows) {
    const [ref, kind] = String(row.custom_id).split('-');
    if (!out[ref]) continue;
    if (row.result?.type !== 'succeeded') { out[ref].errors.push(`${kind}: ${row.result?.type}${row.result?.error?.type ? ` ${row.result.error.type}` : ''}`); continue; }
    const message = row.result.message;
    if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') { out[ref].errors.push(`${kind}: ${message.stop_reason}`); continue; }
    try { out[ref][kind] = JSON.parse(textOf(message)); } catch { out[ref].errors.push(`${kind}: JSON 아님`); }
  }
  return out;
}

// ── 2차 아르곤 ─────────────────────────────────────────────────────
export const ARGON_SCHEMA = { type: 'object', additionalProperties: false, required: ['items', 'seen'],
  properties: { seen: { type: 'array', items: { type: 'string' } }, items: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['ref', ...REVIEW_SCHEMA.required, 'backTranslation', 'translation_match'],
    properties: { ref: { type: 'string' }, ...REVIEW_SCHEMA.properties,
      backTranslation: { type: 'object', additionalProperties: false, required: ['en', 'mn'], properties: { en: { type: 'string' }, mn: { type: 'string' } } },
      translation_match: criterionSchema } } } } };

export function argonPrompt(units, rubric = rubricText()) {
  const marker = `END-OF-ITEMS-${sha(units.map(u => u.ref).join(',')).slice(0, 8)}`;
  return { marker, prompt: `${rubric.text}\n\n---\n\n# 이번에 검수할 문항 ${units.length}개\n\n각 문항을 위 기준대로 따로 검수하라. 정답 칸을 보기 전에 먼저 풀어 solved를 적는다.\n`
    + `그리고 explanation.en과 explanation.mn을 각각 한국어로 직역해(고쳐 읽지 말고 글자 그대로) backTranslation에 적고, ko 해설과 같은 근거·주장인지 translation_match에 판정한다. 해설이 한국어뿐이면 backTranslation은 빈 글, translation_match는 ok true와 「한국어 해설만 있음」.\n`
    + `seen에는 읽은 문항의 ref를 모두 적는다. 문항 목록은 「${marker}」 줄에서 끝난다 — 그 줄을 보지 못했으면 seen에 「truncated」를 넣는다.\n\n`
    + units.map(unit => `## ref ${unit.ref}\n${JSON.stringify(unit.view, null, 1)}`).join('\n\n') + `\n\n${marker}\n` };
}

export const ARGON_WRITING_SCHEMA = { type: 'object', additionalProperties: false, required: ['items', 'seen'],
  properties: { seen: { type: 'array', items: { type: 'string' } }, items: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['ref', ...WRITING_SCHEMA.required], properties: { ref: { type: 'string' }, ...WRITING_SCHEMA.properties } } } } };
export function argonWritingPrompt(units, rubric = rubricText('writing')) {
  const marker = `END-OF-ITEMS-${sha(units.map(u => u.ref).join(',')).slice(0, 8)}`;
  return { marker, prompt: `${rubric.text}\n\n---\n\n# 이번에 검수할 쓰기 문항 ${units.length}개\n\n각 문항을 위 기준대로 따로 검수하라. 51·52와 study-form은 예시답(정답)과 다른 바른 답을 altAnswers에 한두 개 적고 인정 범위가 그것을 받는지 본다(53·54·study-find는 빈 목록). 53·54 예시 글의 글자 수(띄어쓰기 포함)를 직접 세어 modelLength·분량과 대조한다.\n`
    + `seen에는 읽은 문항의 ref를 모두 적는다. 문항 목록은 「${marker}」 줄에서 끝난다 — 그 줄을 보지 못했으면 seen에 「truncated」를 넣는다.\n\n`
    + units.map(unit => `## ref ${unit.ref}\n${JSON.stringify(unit.view, null, 1)}`).join('\n\n') + `\n\n${marker}\n` };
}

// 찻집 주문 틀: 아르곤은 정답을 보지 않는다(answers는 묶음에 없다) — 풀이와 정답 대조는 이 도구가 한다.
export const ARGON_COMPOSE_SCHEMA = { type: 'object', additionalProperties: false, required: ['items', 'seen'],
  properties: { seen: { type: 'array', items: { type: 'string' } }, items: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['ref', 'solved', ...COMPOSE_REVIEW_SCHEMA.required], properties: { ref: { type: 'string' }, solved: composeSolved, ...COMPOSE_REVIEW_SCHEMA.properties } } } } };
export function argonComposePrompt(units, rubric = rubricText('compose')) {
  const marker = `END-OF-ITEMS-${sha(units.map(u => u.ref).join(',')).slice(0, 8)}`;
  return { marker, prompt: `${rubric.text}\n\n---\n\n# 이번에 검수할 찻집 줄 ${units.length}개\n\n줄마다 따로 검수하라. 손님 주문(요청)이면 먼저 직접 풀어 solved에 적는다. ${COMPOSE_ASK} 손님 반응·단골 말(요청 아님)은 solved를 빈 목록으로 두고, answer_unique · skill_fit은 ok true와 「요청 아님」.\n`
    + `${COMPOSE_LEVELS}\nseen에는 읽은 줄의 ref를 모두 적는다. 목록은 「${marker}」 줄에서 끝난다 — 그 줄을 보지 못했으면 seen에 「truncated」를 넣는다.\n\n`
    + units.map(unit => `## ref ${unit.ref}\n${JSON.stringify(unit.view, null, 1)}`).join('\n\n') + `\n\n${marker}\n` };
}

export async function runArgon(packet, dir, { groupSize = 4, call, log = console.log } = {}) {
  const outFile = path.join(dir, 'argon.json');
  const state = fs.existsSync(outFile) ? readJson(outFile) : { model: ARGON.label, rubric: packet.rubric, calls: [], results: {} };
  const pending = packet.units.filter(unit => !state.results[unit.ref]);
  // 쓰기 · 고르기 · 찻집 줄은 기준이 달라 한 번에 섞어 보내지 않는다(쓰기는 길어 두 개씩).
  const groups = [], kindOf = unit => (unit.kind === 'writing' || unit.kind === 'compose' ? unit.kind : 'choice');
  for (const kind of ['choice', 'writing', 'compose']) {
    const same = pending.filter(unit => kindOf(unit) === kind), size = kind === 'writing' ? Math.min(groupSize, 2) : groupSize;
    for (let i = 0; i < same.length; i += size) groups.push({ kind, units: same.slice(i, i + size) });
  }
  for (const { kind, units: group } of groups) {
    const { marker, prompt } = kind === 'writing' ? argonWritingPrompt(group) : kind === 'compose' ? argonComposePrompt(group) : argonPrompt(group);
    const started = Date.now();
    let record, error = null;
    try { record = await call({ model: ARGON.model, thinking: ARGON.thinking, prompt, schema: kind === 'writing' ? ARGON_WRITING_SCHEMA : kind === 'compose' ? ARGON_COMPOSE_SCHEMA : ARGON_SCHEMA, timeoutMs: 1_200_000 }); }
    catch (e) { error = e.message; }
    const seconds = Math.round((Date.now() - started) / 1000);
    let parsed = null;
    if (!error) { try { parsed = JSON.parse(record.text); } catch { error = '답이 JSON이 아니다'; } }
    if (parsed && (parsed.seen || []).includes('truncated')) error = '아르곤이 목록 끝을 못 봤다(잘림)';
    state.calls.push({ refs: group.map(u => u.ref), seconds, marker, error, at: new Date().toISOString(), selectedModel: record?.selectedModel ?? null });
    if (!error) for (const row of parsed.items || []) if (group.some(u => u.ref === row.ref)) state.results[row.ref] = row;
    const missing = group.filter(u => !state.results[u.ref]).map(u => u.ref);
    log(`아르곤 ${group.map(u => u.ref).join(',')} · ${seconds}초${error ? ` · 실패: ${error}` : missing.length ? ` · 빠짐 ${missing.join(',')}` : ''}`);
    writeJson(outFile, state);
  }
  return state;
}

// ── 합치기와 판정 ───────────────────────────────────────────────────
/** 찻집 줄 한 검수자의 판정: 풀이가 어긋난 판은 levelsOk에서 빼고 pass면 fix로 내린다. */
function composeVerdict(unit, review, solved) {
  if (!review || unit.role === 'request' && !solved) return null;
  let verdict = review.verdict;
  const notes = [review.summary], levels = new Set(review.levelsOk || []);
  if (unit.role === 'request') {
    const miss = composeMisses(unit, solved);
    for (const m of miss) levels.delete(m.level);
    if (miss.length) { if (verdict === 'pass') verdict = 'fix'; notes.push(`풀이 어긋남 ${miss.map(m => `${m.level}#${m.n} ${m.axis}`).join(', ')}`); }
  }
  return { verdict, notes: notes.join(' / '), fixes: review.fixes, levelsOk: TEA_LEVELS.filter(L => levels.has(L)) };
}
export function effectiveClaude(unit, claude) {
  const c = claude?.[unit.ref];
  if (unit.kind === 'compose') {
    const got = composeVerdict(unit, c?.review, c?.blind?.solved);
    return got ? { ...got, notes: c?.blind?.reason && got.notes.includes('풀이 어긋남') ? `${got.notes}: ${c.blind.reason}` : got.notes } : { verdict: null, notes: c?.errors?.length ? c.errors.join('; ') : '결과 없음' };
  }
  if (unit.kind === 'writing') {
    if (!c?.review) return { verdict: null, notes: c?.errors?.length ? c.errors.join('; ') : '결과 없음' };
    return { verdict: c.review.verdict, notes: c.review.summary, fixes: c.review.fixes, altAnswers: c.review.altAnswers };
  }
  if (!c?.review || !c?.blind) return { verdict: null, notes: c?.errors?.length ? c.errors.join('; ') : '결과 없음' };
  let verdict = c.review.verdict;
  const notes = [c.review.summary];
  if (c.blind.solved !== unit.view.answer || (c.blind.alsoDefensible || []).some(i => i !== unit.view.answer)) {
    if (verdict === 'pass') verdict = 'fix';
    notes.push(`블라인드 풀이 ${c.blind.solved}(정답 ${unit.view.answer})${c.blind.alsoDefensible?.length ? ` · 다툴 보기 ${c.blind.alsoDefensible.join(',')}` : ''}: ${c.blind.reason}`);
  }
  if (c.review.solved !== unit.view.answer && verdict === 'pass') { verdict = 'fix'; notes.push(`검수 풀이 ${c.review.solved}가 정답과 다름`); }
  return { verdict, notes: notes.join(' / '), fixes: c.review.fixes, suggestedSkillId: c.review.suggestedSkillId, suggestedDifficulty: c.review.suggestedDifficulty };
}
export function effectiveArgon(unit, argon) {
  const a = argon?.results?.[unit.ref];
  if (!a) return { verdict: null, notes: '결과 없음' };
  if (unit.kind === 'compose') return composeVerdict(unit, a, a.solved) ?? { verdict: null, notes: '결과 없음' };
  if (unit.kind === 'writing') return { verdict: a.verdict, notes: a.summary, fixes: a.fixes, altAnswers: a.altAnswers };
  let verdict = a.verdict;
  const notes = [a.summary];
  if (a.solved !== unit.view.answer && verdict === 'pass') { verdict = 'fix'; notes.push(`풀이 ${a.solved}가 정답과 다름`); }
  if (a.translation_match && a.translation_match.ok === false) { if (verdict === 'pass') verdict = 'fix'; notes.push(`역번역 불일치: ${a.translation_match.note}`); }
  return { verdict, notes: notes.join(' / '), fixes: a.fixes, suggestedSkillId: a.suggestedSkillId, suggestedDifficulty: a.suggestedDifficulty, backTranslation: a.backTranslation };
}
// 둘 다 pass → 통과. 둘 다 고침·뺌 → 보류(뺌이 둘이면 뺌). 하나만 pass → 판정(Opus)으로.
export function merge(packet, claude, argon, judge = {}) {
  return Object.fromEntries(packet.units.map(unit => {
    const c = effectiveClaude(unit, claude), a = effectiveArgon(unit, argon), j = judge[unit.ref] || null;
    let outcome;
    if (!c.verdict || !a.verdict) outcome = 'incomplete';
    else if (c.verdict === 'pass' && a.verdict === 'pass') outcome = 'pass';
    else if (c.verdict !== 'pass' && a.verdict !== 'pass') outcome = c.verdict === 'drop' && a.verdict === 'drop' ? 'drop' : 'fix';
    else outcome = j ? j.verdict : 'split';
    return [unit.ref, { outcome, claude: c, argon: a, judge: j }];
  }));
}

export function judgeRequest(unit, merged) {
  const compose = unit.kind === 'compose';
  return { model: CLAUDE_MODEL, max_tokens: 12000, system: [{ type: 'text', text: rubricText(unit.kind === 'writing' ? 'writing' : compose ? 'compose' : 'choice').text, cache_control: { type: 'ephemeral', ttl: '1h' } }],
    output_config: { effort: 'high', format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['verdict', 'reason', 'fixes', ...(compose ? ['levelsOk'] : [])],
      properties: { verdict: { type: 'string', enum: ['pass', 'fix', 'drop'] }, reason: { type: 'string' }, fixes: { type: 'array', items: { type: 'string' } },
        ...(compose ? { levelsOk: { type: 'array', items: { type: 'string', enum: TEA_LEVELS } } } : {}) } } } },
    messages: [{ role: 'user', content: `두 검수자가 같은 문항에 다른 판정을 냈다. 문항과 두 의견을 놓고 직접 다시 따져 최종 판정을 내려라. 어느 쪽 지적이든 맞으면 받아들이고, 학생 화면에 나가도 되는지만 본다(확신이 없으면 fix).${compose ? ` ${COMPOSE_LEVELS}` : ''}\n\n# 문항\n${JSON.stringify(unit.view, null, 1)}${unit.answers ? `\n\n# 정답\n${JSON.stringify(unit.answers, null, 1)}` : ''}\n\n# 검수자 A(Claude)\n${JSON.stringify(merged.claude, null, 1)}\n\n# 검수자 B(아르곤)\n${JSON.stringify(merged.argon, null, 1)}` }] };
}

/** 찻집 주문 틀의 검수 증거(experiences/topik-items/review/town-tea-w10.json): 학습 기록이 평가하는 판(L1 · L2)마다 두 검수자가 다
 * 그 판을 그대로 내도 된다고 했고(판정이 그 판을 본 경우 판정의 판), 아무도 뺌을 내지 않은 틀만 그 판을 적는다. 같은 줄의 앞 판정은 갈아 끼운다. */
export const TEA_EVIDENCE_FILE = path.join(bankDir, 'review/town-tea-w10.json');
export function teaEvidenceRows(packet, merged) {
  return packet.units.filter(unit => unit.kind === 'compose' && unit.role === 'request').flatMap(unit => {
    const m = merged[unit.ref];
    if (!m || m.outcome === 'incomplete' || m.outcome === 'split') return [];
    const ok = m.judge?.levelsOk ? new Set(m.judge.levelsOk) : new Set((m.claude.levelsOk || []).filter(L => (m.argon.levelsOk || []).includes(L)));
    const levels = m.outcome === 'drop' || [m.claude.verdict, m.argon.verdict, m.judge?.verdict].includes('drop') ? [] : ['L1', 'L2'].filter(L => ok.has(L));
    return [{ id: unit.id, hash: unit.hash, verdict: m.outcome, levels, packet: packet.name }];
  });
}
export async function applyToTea(packet, merged, { at = new Date().toISOString(), file = TEA_EVIDENCE_FILE } = {}) {
  if (!packet.units.some(unit => unit.kind === 'compose')) return null;
  const { TEA_JUDGE } = await import('./lib/town-tea-review-unit.mjs');
  const doc = fs.existsSync(file) ? readJson(file) : { task: 'town-w10-tea', rubric: COMPOSE_RUBRIC_ID, judge: TEA_JUDGE,
    reviewers: [{ stage: 'claude', model: CLAUDE_MODEL }, { stage: 'argon', model: ARGON.label }], results: [] };
  const rows = new Map(doc.results.map(row => [row.id, row]));
  for (const row of teaEvidenceRows(packet, merged)) rows.set(row.id, { ...row, reviewedAt: at });
  doc.results = [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
  doc.updatedAt = at;
  writeJson(file, doc);
  return doc.results.filter(row => row.levels.length).length;
}

// ── 반영 ───────────────────────────────────────────────────────────
const STATUS_OF = { pass: 'ai-reviewed', fix: 'held', drop: 'rejected', split: 'held' };
export function applyToItems(packet, merged, { at = new Date().toISOString(), dir = bankDir } = {}) {
  const byFile = new Map();
  for (const unit of packet.units.filter(u => u.kind === 'new')) { if (!byFile.has(unit.file)) byFile.set(unit.file, []); byFile.get(unit.file).push(unit); }
  const changed = [];
  for (const [rel, units] of byFile) {
    const file = path.join(dir, rel), data = readJson(file);
    for (const unit of units) {
      const item = data.items.find(x => x.id === unit.id), m = merged[unit.ref];
      if (!item || !m || m.outcome === 'incomplete') continue;
      if (item.rev !== unit.rev || contentHash(item) !== unit.hash) continue; // 검수 뒤 내용이 바뀐 문항은 이 판정을 받지 않는다
      const base = { rubric: RUBRIC_ID, at, rev: item.rev, hash: unit.hash, packet: packet.name };
      item.review.push({ stage: 'claude', model: CLAUDE_MODEL, verdict: m.claude.verdict, notes: m.claude.notes, ...base });
      item.review.push({ stage: 'argon', model: ARGON.label, verdict: m.argon.verdict, notes: m.argon.notes, ...base });
      if (m.judge) item.review.push({ stage: 'adjudication', model: CLAUDE_MODEL, verdict: m.judge.verdict, notes: m.judge.reason, ...base });
      item.reviewStatus = STATUS_OF[m.outcome];
      changed.push(item.id);
    }
    writeJson(file, data);
  }
  return changed;
}
export function applyToExisting(packet, merged, { at = new Date().toISOString(), dir = bankDir } = {}) {
  if (!packet.units.some(unit => unit.kind === 'existing')) return null; // 기존 문항이 없는 묶음(쓰기만 등)은 허용 목록을 건드리지 않는다
  const file = path.join(dir, 'review/existing-verdicts.json'), doc = readJson(file);
  const rows = new Map((doc.items || []).map(row => [row.itemKey, row]));
  // 같은 문항의 다른 판: 판 꼬리(.vN·:vN)를 뗀 열쇠가 같고 계열도 같다(blank-slice.e06.v1 → .v2, korean-rhythm:t1q0:v1:claim1 → …:claim1:v2).
  const itemBase = key => String(key).replace(/[.:]v\d+$/, '');
  for (const unit of packet.units.filter(u => u.kind === 'existing')) {
    const m = merged[unit.ref];
    if (!m || m.outcome === 'incomplete') continue;
    // 판을 올린 문항은 옛 판 줄을 새 판 줄로 갈아 끼운다 — 게임에 없는 판의 판정을 허용 목록에 남기지 않는다(옛 판정은 보고 폴더에 있다).
    for (const [key, row] of rows) if (key !== unit.key && row.familyKey === unit.meta.familyKey && itemBase(key) === itemBase(unit.key)) rows.delete(key);
    const suggested = [m.claude.suggestedSkillId, m.argon.suggestedSkillId].find(Boolean) || null;
    let verdict = m.outcome === 'split' ? 'held' : m.outcome;
    // 판정이 pass여도 능력·난도를 바꾸라는 의견이 있으면 원고·메타를 고칠 때까지 내지 않는다(① 세션과의 약속: pass면 메타가 같다).
    if (verdict === 'pass' && (suggested && suggested !== unit.meta.skillId)) verdict = 'fix';
    rows.set(unit.key, { itemKey: unit.key, source: unit.source, verdict, skillId: unit.meta.skillId, difficulty: unit.meta.difficulty,
      responseFormat: unit.meta.responseFormat, familyKey: unit.meta.familyKey, officialType: unit.view.officialType?.id || null,
      ...(suggested && suggested !== unit.meta.skillId ? { suggestedSkillId: suggested } : {}),
      reason: [m.claude.notes, m.argon.notes, m.judge?.reason].filter(Boolean).join(' | ').slice(0, 600),
      hash: unit.hash, reviewedAt: at, rubric: RUBRIC_ID, packet: packet.name,
      by: [{ stage: 'claude', model: CLAUDE_MODEL, verdict: m.claude.verdict }, { stage: 'argon', model: ARGON.label, verdict: m.argon.verdict },
        ...(m.judge ? [{ stage: 'adjudication', model: CLAUDE_MODEL, verdict: m.judge.verdict }] : [])] });
  }
  doc.items = [...rows.values()].sort((a, b) => a.itemKey.localeCompare(b.itemKey));
  doc.rubric = RUBRIC_ID; doc.updatedAt = at;
  writeJson(file, doc);
  return doc.items.length;
}

// 쓰기 반영: 쓰기 세션 파일의 review 칸만 바꾸고 그 세션의 생성 도구로 지문(contentHash)을 다시 쓴다.
export function applyToWriting(packet, merged, { at = new Date().toISOString(), rebuild = true } = {}) {
  const units = packet.units.filter(unit => unit.kind === 'writing');
  if (!units.length) return [];
  const changed = [];
  for (const rel of [...new Set(units.map(unit => unit.file))]) {
    const file = path.join(root, rel), data = readJson(file);
    let text = fs.readFileSync(file, 'utf8');
    for (const unit of units.filter(u => u.file === rel)) {
      const item = data.items.find(x => x.id === unit.id), m = merged[unit.ref];
      if (!item || !m || m.outcome === 'incomplete') continue;
      const { review, ...view } = item;
      if (sha(JSON.stringify(view)).slice(0, 16) !== unit.hash) continue; // 검수 뒤 바뀐 문항(지문은 writingUnits와 같은 셈)
      item.review = { status: m.outcome === 'pass' ? 'passed' : 'held', at, report: `experiences/topik-items/review/reports/${packet.name}.md`,
        by: [{ stage: 'claude', model: CLAUDE_MODEL, rubric: WRITING_RUBRIC_ID, verdict: m.claude.verdict }, { stage: 'argon', model: ARGON.label, rubric: WRITING_RUBRIC_ID, verdict: m.argon.verdict },
          ...(m.judge ? [{ stage: 'adjudication', model: CLAUDE_MODEL, rubric: WRITING_RUBRIC_ID, verdict: m.judge.verdict }] : [])],
        // 쓰기 세션 시험은 문항 JSON에 「기출·제N회」 같은 말이 없어야 한다고 본다 — 검수자 메모의 그 말을 바꿔 적는다.
        ...(m.outcome === 'pass' ? {} : { notes: [m.claude.notes, m.argon.notes, m.judge?.reason].filter(Boolean).join(' | ')
          .replace(/기출/g, '공식 시험 문항').replace(/제\s?\d+\s?회|TOPIK\s?\d+회/g, '공식 회차').slice(0, 600) }) };
      // 쓰기 세션 파일의 서식(문항마다 한 줄 review)을 지키려고 그 문항의 review 줄만 바꾼다.
      const idAt = text.indexOf(`"id": "${item.id}"`), reviewAt = idAt < 0 ? -1 : text.indexOf('"review": ', idAt);
      if (reviewAt < 0) throw new Error(`${rel}: ${item.id}의 review 줄을 못 찾았다`);
      const lineEnd = text.indexOf('\n', reviewAt), close = text.lastIndexOf('}', lineEnd < 0 ? text.length : lineEnd);
      text = text.slice(0, reviewAt) + '"review": ' + JSON.stringify(item.review) + text.slice(close + 1);
      changed.push(item.id);
    }
    JSON.parse(text);
    fs.writeFileSync(file, text);
  }
  // WORLD 문항 파일이 바뀐 때만 그 생성 도구로 지문을 다시 쓴다(한국어 공부의 학습 보조 문항 파일은 그 쪽 build.mjs가 읽는다).
  const worldChanged = units.some(unit => unit.file.replace(/\\/g, '/').endsWith('synk-world-app/world-writing-items.json') && changed.includes(unit.id));
  if (rebuild && worldChanged && fs.existsSync(path.join(root, 'tools/build-world-writing-items.mjs'))) {
    execFileSync(process.execPath, [path.join(root, 'tools/build-world-writing-items.mjs'), '--write'], { cwd: root, stdio: 'inherit' });
  }
  return changed;
}

// ── 명령 ───────────────────────────────────────────────────────────
function packetDir(name) { return path.join(root, 'output/topik-review', name); }
function load(name) { const dir = packetDir(name); return { dir, packet: readJson(path.join(dir, 'packet.json')) }; }
const list = (argv, flag) => { const i = argv.indexOf(flag); if (i < 0) return null; const out = []; for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) out.push(argv[j]); return out; };
const num = (argv, flag) => { const i = argv.indexOf(flag); return i < 0 ? null : Number(argv[i + 1]); };

async function main([command, name, ...argv]) {
  if (['예외준비', '예외반영'].includes(command)) {
    const { exceptionCommand } = await import('./lib/topik-review-atlas-20261028.mjs');
    console.log(JSON.stringify(await exceptionCommand(command, name, argv))); return 0;
  }
  if (!command || !name) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).join('\n')); return 2; }
  const 클로드 = require('./lib/클로드키.js');
  if (command === '준비') {
    const packet = await prepare(name, { newFiles: list(argv, '--새'), existingSources: list(argv, '--기존'), sample: num(argv, '--표본'), perSource: num(argv, '--출처마다'), newSample: num(argv, '--새표본'), writingFile: list(argv, '--쓰기')?.[0] || null, onlyIds: list(argv, '--문항'), onlyUnjudged: argv.includes('--미판정'), teaIds: list(argv, '--찻집') });
    console.log(`${packetDir(name)} · 문항 ${packet.units.length}(새 ${packet.units.filter(u => u.kind === 'new').length} · 기존 ${packet.units.filter(u => u.kind === 'existing').length} · 찻집 ${packet.units.filter(u => u.kind === 'compose').length}) · 기준 ${packet.rubric.id} ${packet.rubric.sha}`);
    return 0;
  }
  const { dir, packet } = load(name);
  if (command === '클로드') {
    const batchFile = path.join(dir, 'claude-batch.json');
    if (argv.includes('--보내기')) {
      if (fs.existsSync(batchFile)) throw new Error(`이미 보낸 일괄이 있다: ${batchFile}`);
      const requests = claudeRequests(packet);
      writeJson(path.join(dir, 'claude-requests.json'), { count: requests.length, sha: sha(JSON.stringify(requests)).slice(0, 16) });
      const made = await 클로드.배치보내기(requests, { 용도: `topik-review:${name}` });
      writeJson(batchFile, { ...made, at: new Date().toISOString(), requests: requests.length });
      console.log(`일괄 ${made.배치id} · 키 ${made.키이름} · 요청 ${requests.length}`);
      return 0;
    }
    const made = readJson(batchFile);
    if (argv.includes('--받기')) {
      const { 결과, 합계 } = await 클로드.배치결과(made.배치id, made.키이름, { 용도: `topik-review:${name}` });
      fs.writeFileSync(path.join(dir, 'claude-results.jsonl'), 결과.map(r => JSON.stringify(r)).join('\n') + '\n');
      writeJson(path.join(dir, 'claude.json'), { batch: made.배치id, key: made.키이름, total: 합계, results: parseClaudeResults(packet, 결과) });
      console.log(`결과 ${합계.요청} · 성공 ${합계.성공} · 추정 $${합계.추정USD}`);
      return 0;
    }
    const state = await 클로드.배치보기(made.배치id, made.키이름);
    console.log(`${made.배치id}: ${state.processing_status} ${JSON.stringify(state.request_counts)}`);
    return 0;
  }
  if (command === '아르곤') {
    const { 부르기 } = require('./lib/제미나이구독호출.js');
    const state = await runArgon(packet, dir, { groupSize: num(argv, '--묶음') || 4, call: 부르기 });
    console.log(`아르곤 결과 ${Object.keys(state.results).length}/${packet.units.length} · 호출 ${state.calls.length}`);
    return Object.keys(state.results).length === packet.units.length ? 0 : 1;
  }
  const claude = fs.existsSync(path.join(dir, 'claude.json')) ? readJson(path.join(dir, 'claude.json')).results : {};
  const argon = fs.existsSync(path.join(dir, 'argon.json')) ? readJson(path.join(dir, 'argon.json')) : null;
  const judgeFile = path.join(dir, 'judge.json'), judge = fs.existsSync(judgeFile) ? readJson(judgeFile) : {};
  if (command === '판정') {
    const merged = merge(packet, claude, argon, judge);
    if (argv.includes('--보내기')) {
      for (const unit of packet.units.filter(u => merged[u.ref].outcome === 'split' && !judge[u.ref])) {
        const { 응답 } = await 클로드.보내기(judgeRequest(unit, merged[unit.ref]), { 용도: `topik-review:${name}:판정` });
        judge[unit.ref] = { ...JSON.parse(textOf(응답)), usage: 응답.usage, at: new Date().toISOString() };
        writeJson(judgeFile, judge);
      }
    }
    const final = merge(packet, claude, argon, judge);
    writeJson(path.join(dir, 'merged.json'), final);
    const count = outcome => Object.values(final).filter(m => m.outcome === outcome).length;
    console.log(['pass', 'fix', 'drop', 'split', 'incomplete'].map(o => `${o} ${count(o)}`).join(' · '));
    return 0;
  }
  if (command === '반영') {
    const merged = readJson(path.join(dir, 'merged.json'));
    const changed = applyToItems(packet, merged), existing = applyToExisting(packet, merged), writing = applyToWriting(packet, merged), tea = await applyToTea(packet, merged);
    console.log(`새 문항 반영 ${changed.length} · 기존 판정 목록 ${existing ?? '그대로'}줄 · 쓰기 ${writing.length}${tea === null ? '' : ` · 찻집 틀 평가 판 있음 ${tea}`}`);
    return 0;
  }
  if (command === '보고') {
    const merged = readJson(path.join(dir, 'merged.json'));
    const total = fs.existsSync(path.join(dir, 'claude.json')) ? readJson(path.join(dir, 'claude.json')).total : null;
    const judgeUsd = Object.values(judge).reduce((s, j) => s + (클로드.추정USD(CLAUDE_MODEL, j.usage) || 0), 0);
    const usd = (total?.추정USD || 0) + judgeUsd, n = packet.units.length;
    const count = outcome => Object.values(merged).filter(m => m.outcome === outcome).length;
    const argonSeconds = argon ? argon.calls.reduce((s, c) => s + c.seconds, 0) : 0;
    const lines = [`# 검수 묶음 ${name}`, '', `- 문항 ${n}(새 ${packet.units.filter(u => u.kind === 'new').length} · 기존 ${packet.units.filter(u => u.kind === 'existing').length}) · 기준 ${packet.rubric.id} ${packet.rubric.sha}`,
      `- 판정: 통과 ${count('pass')} · 고침 ${count('fix')} · 뺌 ${count('drop')} · 엇갈림(판정 전) ${count('split')} · 미완 ${count('incomplete')}`,
      `- Claude 일괄 추정 $${(total?.추정USD || 0).toFixed(4)} + 판정 $${judgeUsd.toFixed(4)} = $${usd.toFixed(4)} → 1,000문항 어림 $${(usd / n * 1000).toFixed(2)}`,
      total ? `- 토큰 합계: 입력 ${total.usage.input_tokens} · 캐시 쓰기 ${total.usage.cache_creation_input_tokens} · 캐시 읽기 ${total.usage.cache_read_input_tokens} · 출력 ${total.usage.output_tokens}` : '- Claude 결과 없음',
      `- 아르곤 호출 ${argon?.calls.length || 0}회 · ${Math.round(argonSeconds / 60)}분(구독, 추가 비용 없음)`, '', '| ref | 문항 | 결과 | Claude | 아르곤 | 메모 |', '|---|---|---|---|---|---|',
      ...packet.units.map(u => { const m = merged[u.ref]; return `| ${u.ref} | ${u.id || u.key} | ${m.outcome} | ${m.claude.verdict ?? '-'} | ${m.argon.verdict ?? '-'} | ${String(m.judge?.reason || m.claude.notes || '').replace(/\|/g, '/').slice(0, 140)} |`; })];
    fs.writeFileSync(path.join(dir, 'report.md'), lines.join('\n') + '\n');
    // 저장소에도 남긴다(쓰기 세션의 review.report가 가리키는 곳). 원자료는 output/에만.
    fs.mkdirSync(path.join(bankDir, 'review/reports'), { recursive: true });
    fs.writeFileSync(path.join(bankDir, 'review/reports', `${name}.md`), lines.join('\n') + '\n');
    console.log(lines.slice(0, 7).join('\n'));
    return 0;
  }
  throw new Error(`모르는 명령 ${command}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(error.stack || error.message); process.exitCode = 2; });
}
