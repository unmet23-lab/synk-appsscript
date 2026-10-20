#!/usr/bin/env node
// TOPIK 문항 AI 2중 검수(교원 검수 대체, 2026-10-20 결정). 1차 Claude Opus(Message Batches · 기준 프롬프트 캐시),
// 2차 아르곤(Google AI 구독 · 영어·몽골어 해설 역번역), 엇갈리면 Opus가 두 의견을 놓고 판정한다.
// 새 LLM 실행기가 아니다 — 부르는 통로는 tools/lib/클로드키.js(일괄·한 건)와 tools/lib/제미나이구독호출.js 그대로다.
//
//   node tools/topik-review.mjs 준비 <이름> [--새 [<묶음…>]] [--새표본 N] [--기존 [<출처…>]] [--출처마다 N] [--표본 N]   검수 묶음(output/topik-review/<이름>/)
//   node tools/topik-review.mjs 클로드 <이름> [--보내기|--받기]   1차: 블라인드 풀이 + 기준 검수 일괄(반값)
//   node tools/topik-review.mjs 아르곤 <이름> [--묶음 4]           2차: 독립 검수 + 해설 역번역(하나씩 차례로)
//   node tools/topik-review.mjs 판정 <이름> [--보내기]             두 검수 합치기 · 엇갈린 문항은 Opus 판정
//   node tools/topik-review.mjs 반영 <이름>                         새 문항 review 줄·reviewStatus, 기존 문항 existing-verdicts.json
//   node tools/topik-review.mjs 보고 <이름>                         판정 수·쓴 비용·1,000문항 어림(report.md)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
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

export function rubricText() {
  const rubric = fs.readFileSync(path.join(bankDir, 'review/rubric-r1.md'), 'utf8').replace(/\r\n/g, '\n');
  const guide = fs.readFileSync(path.join(bankDir, '작성기준.md'), 'utf8').replace(/\r\n/g, '\n');
  const text = `${rubric}\n\n---\n\n# 함께 주는 작성 기준\n\n${guide}`;
  return { text, sha: sha(text).slice(0, 16) };
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
const EXISTING_TYPE = { 'blank-slice': () => 'TI-R-34', 'synk-town': item => item.skillId === 'ko.reading.main' ? 'TI-R-46' : 'TI-R-43', 'entry-check': () => 'TI-R-40' };
function entryText(card) {
  const lines = [`[안내문] ${card.notice.title}`, ...card.notice.rules.map(rule => `- ${rule}`)];
  if (card.at) lines.push(`[지금 시각] ${card.at}`);
  if (card.doc) lines.push(`[손님 서류] ${card.doc.title}`, ...card.doc.rows.map(row => `  ${row.join(': ')}`));
  if (card.bag?.length) lines.push(`[짐] ${card.bag.join(', ')}`);
  if (card.line) lines.push(`[손님 말] ${card.who ? `${card.who}: ` : ''}${card.line}`);
  return lines.join('\n');
}
export function existingItemView(item, types, labels) {
  const typeId = EXISTING_TYPE[item.source]?.(item);
  const passage = item.source === 'entry-check' ? entryText(item.card) : item.prompt;
  return { existing: true, source: item.source, exam: 'topik-i', officialType: typeView(types.find(t => t.id === typeId)), fit: 'adapted',
    targetGrade: null, skillId: item.skillId, skillLabel: labels[item.skillId] || null, difficulty: item.difficulty, passage, script: null,
    question: item.question, choices: item.choices.map(choice => choice.label), answer: item.choices.findIndex(choice => choice.id === item.correctId),
    explanation: { ko: item.explanation }, choiceNotes: null };
}
const blindView = view => { const { answer, explanation, choiceNotes, ...rest } = view; return rest; };

async function diagnosticItems() {
  return (await import(pathToFileURL(path.join(root, 'experiences/synk-world-app/world-diagnostic-items.mjs')))).DIAGNOSTIC_ITEMS;
}
function itemFiles() {
  const dir = path.join(bankDir, 'items');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort().map(name => ({ name, file: path.join(dir, name), data: readJson(path.join(dir, name)) })) : [];
}

// 같은 입력에 같은 표본(문항 키로 섞는다).
function seededPick(list, n, key) {
  return [...list].sort((a, b) => sha(`${key}|${a.key}`).localeCompare(sha(`${key}|${b.key}`))).slice(0, n);
}

export async function prepare(name, { newFiles = null, existingSources = null, sample = null, perSource = null, newSample = null } = {}) {
  const dir = path.join(root, 'output/topik-review', name);
  if (fs.existsSync(path.join(dir, 'packet.json'))) throw new Error(`이미 있는 묶음: ${dir}`);
  const types = readJson(path.join(root, 'strata/topik-types.json')).types, labels = skillLabels(), rubric = rubricText();
  const units = [];
  if (newFiles) for (const { name: fileName, data } of itemFiles().filter(f => !newFiles.length || newFiles.includes(f.name) || newFiles.includes(f.name.replace(/\.json$/, '')))) {
    for (const item of data.items) {
      if (item.reviewStatus === 'ai-reviewed' && reviewOutcome(item) === 'pass') continue;
      units.push({ key: itemKeyOf(item), kind: 'new', file: `items/${fileName}`, id: item.id, rev: item.rev, hash: contentHash(item), view: newItemView(item, types, labels) });
    }
  }
  if (newSample) {
    const kept = new Set(seededPick(units.filter(unit => unit.kind === 'new'), newSample, name).map(unit => unit.key));
    for (let i = units.length - 1; i >= 0; i--) if (units[i].kind === 'new' && !kept.has(units[i].key)) units.splice(i, 1);
  }
  if (existingSources) {
    const pool = (await diagnosticItems()).filter(item => EXISTING_TYPE[item.source] && (!existingSources.length || existingSources.includes(item.source)));
    const picked = perSource ? Object.values(Object.groupBy(pool.map(item => ({ key: item.itemKey, item })), row => row.item.source)).flatMap(rows => seededPick(rows, perSource, name)).map(row => row.item) : pool;
    for (const item of picked) units.push({ key: item.itemKey, kind: 'existing', source: item.source, meta: { itemKey: item.itemKey, familyKey: item.familyKey,
      skillId: item.skillId, difficulty: item.difficulty, responseFormat: item.responseFormat }, hash: sha(JSON.stringify(existingItemView(item, types, labels))).slice(0, 16),
      view: existingItemView(item, types, labels) });
  }
  let chosen = units;
  if (sample && units.length > sample) chosen = seededPick(units, sample, name);
  chosen.forEach((unit, index) => { unit.ref = `u${String(index + 1).padStart(3, '0')}`; });
  const packet = { name, createdAt: new Date().toISOString(), rubric: { id: RUBRIC_ID, sha: rubric.sha }, units: chosen };
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

export function claudeRequests(packet, rubric = rubricText()) {
  const system = [{ type: 'text', text: rubric.text, cache_control: { type: 'ephemeral', ttl: '1h' } }];
  return packet.units.flatMap(unit => [
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

export async function runArgon(packet, dir, { groupSize = 4, call, log = console.log } = {}) {
  const outFile = path.join(dir, 'argon.json');
  const state = fs.existsSync(outFile) ? readJson(outFile) : { model: ARGON.label, rubric: packet.rubric, calls: [], results: {} };
  const todo = packet.units.filter(unit => !state.results[unit.ref]);
  for (let i = 0; i < todo.length; i += groupSize) {
    const group = todo.slice(i, i + groupSize), { marker, prompt } = argonPrompt(group);
    const started = Date.now();
    let record, error = null;
    try { record = await call({ model: ARGON.model, thinking: ARGON.thinking, prompt, schema: ARGON_SCHEMA, timeoutMs: 1_200_000 }); }
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
export function effectiveClaude(unit, claude) {
  const c = claude?.[unit.ref];
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
  return { model: CLAUDE_MODEL, max_tokens: 12000, system: [{ type: 'text', text: rubricText().text, cache_control: { type: 'ephemeral', ttl: '1h' } }],
    output_config: { effort: 'high', format: { type: 'json_schema', schema: { type: 'object', additionalProperties: false, required: ['verdict', 'reason', 'fixes'],
      properties: { verdict: { type: 'string', enum: ['pass', 'fix', 'drop'] }, reason: { type: 'string' }, fixes: { type: 'array', items: { type: 'string' } } } } } },
    messages: [{ role: 'user', content: `두 검수자가 같은 문항에 다른 판정을 냈다. 문항과 두 의견을 놓고 직접 다시 따져 최종 판정을 내려라. 어느 쪽 지적이든 맞으면 받아들이고, 학생 화면에 나가도 되는지만 본다(확신이 없으면 fix).\n\n# 문항\n${JSON.stringify(unit.view, null, 1)}\n\n# 검수자 A(Claude)\n${JSON.stringify(merged.claude, null, 1)}\n\n# 검수자 B(아르곤)\n${JSON.stringify(merged.argon, null, 1)}` }] };
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
  const file = path.join(dir, 'review/existing-verdicts.json'), doc = readJson(file);
  const rows = new Map((doc.items || []).map(row => [row.itemKey, row]));
  for (const unit of packet.units.filter(u => u.kind === 'existing')) {
    const m = merged[unit.ref];
    if (!m || m.outcome === 'incomplete') continue;
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

// ── 명령 ───────────────────────────────────────────────────────────
function packetDir(name) { return path.join(root, 'output/topik-review', name); }
function load(name) { const dir = packetDir(name); return { dir, packet: readJson(path.join(dir, 'packet.json')) }; }
const list = (argv, flag) => { const i = argv.indexOf(flag); if (i < 0) return null; const out = []; for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) out.push(argv[j]); return out; };
const num = (argv, flag) => { const i = argv.indexOf(flag); return i < 0 ? null : Number(argv[i + 1]); };

async function main([command, name, ...argv]) {
  if (!command || !name) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).join('\n')); return 2; }
  const 클로드 = require('./lib/클로드키.js');
  if (command === '준비') {
    const packet = await prepare(name, { newFiles: list(argv, '--새'), existingSources: list(argv, '--기존'), sample: num(argv, '--표본'), perSource: num(argv, '--출처마다'), newSample: num(argv, '--새표본') });
    console.log(`${packetDir(name)} · 문항 ${packet.units.length}(새 ${packet.units.filter(u => u.kind === 'new').length} · 기존 ${packet.units.filter(u => u.kind === 'existing').length}) · 기준 ${packet.rubric.id} ${packet.rubric.sha}`);
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
    const changed = applyToItems(packet, merged), existing = applyToExisting(packet, merged);
    console.log(`새 문항 반영 ${changed.length} · 기존 판정 목록 ${existing}줄`);
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
    console.log(lines.slice(0, 7).join('\n'));
    return 0;
  }
  throw new Error(`모르는 명령 ${command}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(error.stack || error.message); process.exitCode = 2; });
}
