#!/usr/bin/env node
// WORLD 말하기 연습 문항 AI 2중 검수(2026-10-21, 결정 표 10-20 「교원 검수를 AI로」). 1차 Claude Opus 5.5, 2차 아르곤이 따로 본다.
// 새 실행기가 아니다 — tools/topik-review.mjs와 같은 통로(tools/lib/클로드키.js 일괄 · tools/lib/제미나이구독호출.js)와 같은 꼴
// (기준 글 1시간 캐시 · JSON 꼴 출력 · 아르곤 끝 표식)을 말하기 문항(시험 형식 6 + 역할극 1)에 맞췄다. 원자료는 이 폴더의 <판>/*.json(Git 제외).
//
//   node review.mjs 준비 <판> [--문항 <id…>] [--종류 r1|r2|r3]   검수 단위(<판>/packet.json). r2는 r1 두 의견을, r3는 고친 것 목록(<판>/changes.json)을 싣는다
//   node review.mjs 클로드 <판> --보내기 | --기다리기 | --받기    Claude 일괄(반값). --기다리기는 끝날 때까지 20초마다 보고 받는다
//   node review.mjs 아르곤 <판> [--묶음 4]                        같은 단위를 아르곤에게(묶음 차례로, 끊겨도 받은 단위는 건너뜀)
//   node review.mjs 합치기 <판>                                   두 결과를 단위마다 나란히(<판>/merged.json)
// 환경: SYNK_CLAUDE_KEYS·SYNK_CLAUDE_KEY_STATE(검수 키 목록 — experiences/topik-items/README.md 「키와 비용」)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { syllables, slotsFromText, nextStep } from '../../../../../tools/lib/말하기피드백.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../../..');
const BANK = path.join(root, 'experiences/synk-world-app/world-speaking-items.json');
export const RUBRIC_ID = 'speaking-review-r1';
export const CLAUDE_MODEL = 'claude-opus-5-5';
export const ARGON = { model: 'gemini-4-argon', thinking: 'high', label: 'gemini-4-argon-high' };
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n'); fs.renameSync(tmp, file); };

export function rubric() {
  const text = fs.readFileSync(path.join(here, 'rubric-speaking-r1.md'), 'utf8').replace(/\r\n/g, '\n');
  return { id: RUBRIC_ID, text, sha: sha(text).slice(0, 16) };
}

// ── 검수 단위 ────────────────────────────────────────────────────────
const BAND = { beginner: '초급', intermediate: '중급', advanced: '고급' };
// 검수자는 그림을 보지 않는다 — 지금 그림을 사람이 본 대로 적어 준다(alt보다 자세히, 10-21).
const PICTURE_NOTE = {
  's2-cafe': '위에서 비스듬히 내려다본 카페 안 그림. 가운데 계산대에 붉은 커피 기계·커피 그라인더·컵이 있고 유리 덮개 안에 크루아상 같은 빵이 있다. 왼쪽 큰 창가를 따라 긴 탁자와 붉은 의자 세 개가 있다. 사람·메뉴판·가격표는 보이지 않는다.',
  's3-birthday': [
    '크림색 바탕 위 펠트 소품 하나: 접시 위 둥근 생일 케이크, 초 하나에 불이 켜져 있다. 사람·장소·시간 단서 없음.',
    '크림색 바탕 위 펠트 소품 하나: 붉은 하트 스티커로 붙인 편지 봉투. 사람·장소·시간 단서 없음.',
    '크림색 바탕 위 펠트 소품 하나: 뚜껑이 열린 빈 종이 상자와 그 위의 붉은 리본. 사람·장소·시간 단서 없음.',
    '크림색 바탕 위 펠트 소품 하나: 푸른 무늬 꽃병에 꽂힌 흰·분홍 꽃. 사람·장소·시간 단서 없음.',
  ],
};
// 튜터 말풍선의 임무 줄(world-speaking-practice.mjs TUTOR_LINES — 이 파일 밖, 참고만).
const TUTOR_MISSION = {
  marin: '임무. 따뜻한 차 두 잔. 내 컵 하나, 네 컵 하나. …카페 안에서 마신다.',
  kkamong: '이 몸은 따뜻한 차가 마시고 싶군. …네 컵도 같이, 두 잔. 여기서 마시자.',
  mongle: '오! 따뜻한 차 두 잔! 하나는 내 거, 하나는 네 거! 카페 안에서 같이 마시자!',
};
const SLOT_RULE = '받아 적은 말에서 규칙으로 고른다(모델이 지어내지 않는다). 음료: 낱말이 차·녹차·홍차·유자차·보리차·허브차(+조사)면 tea, 주스면 juice, 커피·아메리카노·라떼면 coffee. 온도: 따뜻·따듯·뜨거·따끈·핫이면 warm, 차가·차갑·시원·아이스면 cold. 잔 수: (숫자·한·두·세·네·다섯)+잔·개·컵. 마실 곳: 여기서·매장·먹고 갈·마시고 갈·앉아서·안에서면 here, 가져·포장·테이크아웃·들고 갈이면 togo. 대답: 네·예(잔 수가 아닐 때)·응·맞아요·맞습니다·그래요면 yes. 높임: 끝이 요·니다·세요·십시오면 높임.';
const FLOW = 'order(직원 첫 말) → 잔 수를 말하지 않으면 count · 주스를 고르면 soldout → 다 맞으면 confirm → place → 끝(ending). 목표와 어긋나는데 되물을 녹음이 없으면 튜터가 말풍선으로 돕는다. 같은 차례에서 두 번 놓치면 그 차례의 model을 「이렇게 말해 볼 수 있어요」로 보인다. 한 차례 대답 시간은 answerSec초.';

export function itemView(bank, item) {
  const type = bank.types[item.type];
  const n = syllables(item.model);
  const view = { id: item.id, kind: 'exam', type: item.type, typeName: type.name, band: BAND[type.band] || type.band, prepSec: type.prepSec, answerSec: type.answerSec, label: item.label };
  for (const key of ['situation', 'news', 'prompt']) if (item[key]) view[key] = item[key];
  if (item.picture) view.picture = { alt: item.picture.alt, 검수자참고_실제그림: PICTURE_NOTE[item.id] || null };
  if (item.partner) view.partner = { role: item.partner.role, line: item.partner.line, 고정: '승인된 녹음 — 바꿀 수 없다' };
  if (item.panels) view.panels = item.panels.map((p, i) => ({ alt: p.alt, scene: p.scene, 검수자참고_실제그림: PICTURE_NOTE[item.id]?.[i] || null }));
  if (item.dialogue) view.dialogue = item.dialogue;
  if (item.data) view.data = item.data;
  // 화면 순서와 같게: 문제지 → 과제 → 다뤄야 할 것 → 예시 답·살펴볼 것.
  if (item.prompt) { delete view.prompt; view.prompt = item.prompt; }
  Object.assign(view, { covers: item.covers, minSyllables: item.minSyllables, model: item.model, watch: item.watch,
    계산값: { 예시답_한글음절: n, 대답시간_초: type.answerSec, 대답시간에_말하면_초당음절: Number((n / type.answerSec).toFixed(2)), 보류문턱_minSyllables: item.minSyllables, 예시답은_문턱의_몇배: Number((n / item.minSyllables).toFixed(2)) } });
  return view;
}

export function roleplayView(rp) {
  return { id: rp.id, kind: 'roleplay', label: rp.label,
    화면: '학생 화면: 튜터 말풍선(임무) + 「오늘의 주문」 칩 세 개(goal로 만든다: 「따뜻한 차」「두 잔」「카페 안에서」) + 영어·몽골어 화면이면 그 아래 missionGloss 한 줄. 직원 말은 소리로 듣고, 글은 「글로 보기」를 누르면 보인다.',
    mission: rp.mission, missionGloss: rp.missionGloss, goal: rp.goal, answerSec: rp.answerSec, partner: rp.partner, 흐름: FLOW, 규칙: SLOT_RULE,
    steps: rp.steps.map(step => { const slots = slotsFromText(step.model);
      return { id: step.id, line: step.line, line고정: '승인된 녹음 — 바꿀 수 없다', asks: step.asks, ...(step.onlyAfter ? { onlyAfter: step.onlyAfter } : {}), model: step.model,
        규칙판정: { slots, next: nextStep({ roleplay: rp, stepId: step.id, slots }) } }; }),
    ending: rp.ending, ending의_friend자리: ['마린과', '까몽과', '몽글과', '친구와(튜터 없음)'],
    튜터말풍선_참고: TUTOR_MISSION };
}

export function units(bank, only = null) {
  const out = [];
  for (const item of bank.items) out.push({ key: item.id, kind: 'exam', view: itemView(bank, item) });
  for (const rp of bank.roleplays || []) out.push({ key: rp.id, kind: 'roleplay', view: roleplayView(rp) });
  return out.filter(u => !only?.length || only.includes(u.key)).map((u, i) => ({ ...u, ref: `u${i + 1}`, hash: sha(JSON.stringify(u.view)).slice(0, 16) }));
}

// ── 출력 꼴 ─────────────────────────────────────────────────────────
const CRITERIA = ['type_fit', 'level_fit', 'naturalness', 'covers_fit', 'model_answer', 'length_time', 'data_consistency', 'exam_similarity', 'culture_bias', 'roleplay_fit'];
const okNote = { type: 'object', additionalProperties: false, required: ['ok', 'note'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } };
const fix = { type: 'object', additionalProperties: false, required: ['field', 'old', 'new', 'why'],
  properties: { field: { type: 'string' }, old: { type: 'string' }, new: { type: 'string' }, why: { type: 'string' } } };
const verdict = { type: 'string', enum: ['pass', 'fix', 'drop'] };
export const REVIEW_SCHEMA = { type: 'object', additionalProperties: false, required: ['verdict', 'criteria', 'fixes', 'summary'],
  properties: { verdict, criteria: { type: 'object', additionalProperties: false, required: CRITERIA, properties: Object.fromEntries(CRITERIA.map(c => [c, okNote])) },
    fixes: { type: 'array', items: fix }, summary: { type: 'string' } } };
// r2(다시 묻기): 상대 의견의 지적마다 받아들이는지와 까닭, 그리고 최종 판정·고칠 글.
export const RECONSIDER_SCHEMA = { type: 'object', additionalProperties: false, required: ['verdict', 'responses', 'fixes', 'summary'],
  properties: { verdict, responses: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['point', 'agree', 'why'],
    properties: { point: { type: 'string' }, agree: { type: 'boolean' }, why: { type: 'string' } } } }, fixes: { type: 'array', items: fix }, summary: { type: 'string' } } };
// r3(확인): 고친 판 전체를 기준대로 다시 보고, 고친 것이 지적을 풀었는지 따로 적는다.
export const CONFIRM_SCHEMA = { ...REVIEW_SCHEMA, required: [...REVIEW_SCHEMA.required, 'changes_ok'], properties: { ...REVIEW_SCHEMA.properties, changes_ok: okNote } };
const SCHEMA = { r1: REVIEW_SCHEMA, r2: RECONSIDER_SCHEMA, r3: CONFIRM_SCHEMA };
const wrap = schema => ({ type: 'object', additionalProperties: false, required: ['items', 'seen'], properties: { seen: { type: 'array', items: { type: 'string' } },
  items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['ref', ...schema.required], properties: { ref: { type: 'string' }, ...schema.properties } } } } });

// ── 묻는 글 ─────────────────────────────────────────────────────────
const ASK = {
  r1: '아래 문항을 위 검수 기준대로 검수하라. 항목마다 ok와 한 줄 메모, 고칠 것이 있으면 fixes에 바꿀 글을 그대로 적는다.',
  r2: '같은 문항을 두 검수자가 따로 검수했고 의견이 갈렸다. 아래에 너의 1차 의견과 다른 검수자의 1차 의견이 있다(「사실 확인」이 있으면 그 사실을 전제로 한다). 다른 검수자의 지적과 고칠 글, 그리고 네 지적 가운데 상대가 하지 않은 것을 하나씩 기준에 비추어 다시 따져, 받아들이면 agree true, 아니면 false와 까닭을 responses에 적어라. 그 뒤 최종 판정과 최종 fixes를 낸다 — fixes는 이 문항에 실제로 반영할 고침 전체 목록이다(네 1차 고침 가운데 유지할 것도 다시 적고, 두 사람의 고칠 글이 같은 곳을 다르게 고치면 더 나은 한 글로 합친다). 상대 의견을 따르는 것이 목적이 아니다 — 기준에 비추어 맞는 쪽을 고른다.',
  r3: '아래 문항은 1차 검수의 지적을 받아 고친 판이다. 「고친 것」 목록(옛 글 → 새 글)이 지적을 제대로 풀었는지 changes_ok에 적고, 고친 판 전체를 기준대로 다시 검수하라. 고친 글이 새 문제를 만들었는지도 본다. 사소한 다듬기 의견은 pass로 두고 메모만 남긴다.',
};
function unitText(round, unit, who) {
  const parts = [JSON.stringify(unit.view, null, 1)];
  // 진행자가 붙이는 사실 확인(화면·운영이 문항 글을 어떻게 쓰는지 — 1차에서 검수자가 잘못 짐작한 사실을 바로잡는다. 판단은 검수자 몫).
  if (unit.facts) parts.push(`# 사실 확인(진행자)\n${unit.facts}`);
  if (round === 'r2') parts.push(`# 너의 1차 의견\n${JSON.stringify(unit.opinions[who], null, 1)}`, `# 다른 검수자의 1차 의견\n${JSON.stringify(unit.opinions[who === 'claude' ? 'argon' : 'claude'], null, 1)}`);
  if (round === 'r3') parts.push(`# 고친 것(옛 글 → 새 글)\n${JSON.stringify(unit.changes, null, 1)}`);
  return parts.join('\n\n');
}
export function claudeRequests(packet, rb = rubric()) {
  const system = [{ type: 'text', text: rb.text, cache_control: { type: 'ephemeral', ttl: '1h' } }];
  return packet.units.map(unit => ({ custom_id: `${packet.round}-${unit.ref}`, params: { model: CLAUDE_MODEL, max_tokens: 16000, system,
    output_config: { effort: packet.effort || 'high', format: { type: 'json_schema', schema: SCHEMA[packet.round] } },
    messages: [{ role: 'user', content: `${ASK[packet.round]}\n\n${unitText(packet.round, unit, 'claude')}` }] } }));
}
export function argonPrompt(packet, group, rb = rubric()) {
  const marker = `END-OF-ITEMS-${sha(group.map(u => u.ref).join(',') + packet.round).slice(0, 8)}`;
  return { marker, schema: wrap(SCHEMA[packet.round]), prompt: `${rb.text}\n\n---\n\n# 이번에 검수할 단위 ${group.length}개\n\n${ASK[packet.round]} 단위마다 따로 판단하고 결과를 items에 ref와 함께 적는다.\n`
    + `seen에는 읽은 단위의 ref를 모두 적는다. 목록은 「${marker}」 줄에서 끝난다 — 그 줄을 보지 못했으면 seen에 「truncated」를 넣는다.\n\n`
    + group.map(unit => `## ref ${unit.ref}\n${unitText(packet.round, unit, 'argon')}`).join('\n\n') + `\n\n${marker}\n` };
}

// ── 명령 ────────────────────────────────────────────────────────────
const dirOf = name => path.join(here, name);
const list = (argv, flag) => { const i = argv.indexOf(flag); if (i < 0) return null; const out = []; for (let j = i + 1; j < argv.length && !argv[j].startsWith('--'); j++) out.push(argv[j]); return out; };
const one = (argv, flag) => list(argv, flag)?.[0] ?? null;
const textOf = message => (message?.content || []).filter(block => block.type === 'text').map(block => block.text).join('');

async function main([command, name, ...argv]) {
  if (!command || !name) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).join('\n')); return 2; }
  const dir = dirOf(name);
  if (command === '준비') {
    if (fs.existsSync(path.join(dir, 'packet.json'))) throw new Error(`이미 있는 판: ${dir}`);
    const round = one(argv, '--종류') || 'r1', bank = readJson(BANK), rb = rubric();
    const chosen = units(bank, list(argv, '--문항'));
    if (round === 'r2') { // r1 두 의견을 싣는다(--앞판 <판>)
      const prev = merged(one(argv, '--앞판'));
      for (const unit of chosen) { const m = prev[unit.key]; if (!m?.claude || !m?.argon) throw new Error(`${unit.key}: 앞판 의견이 둘 다 있지 않다`); unit.opinions = { claude: m.claude, argon: m.argon }; }
    }
    if (round === 'r3') { const changes = readJson(path.join(dir, 'changes.json')); for (const unit of chosen) unit.changes = changes[unit.key] || []; }
    if (fs.existsSync(path.join(dir, 'facts.json'))) { const facts = readJson(path.join(dir, 'facts.json')); for (const unit of chosen) if (facts[unit.key]) unit.facts = facts[unit.key]; }
    // Claude 생각 수준: 1차·다시 묻기는 high, 고친 판 확인은 --노력 medium으로 값을 아낄 수 있다(10-21 r3).
    const packet = { name, round, createdAt: new Date().toISOString(), rubric: { id: rb.id, sha: rb.sha }, bankHash: bank.contentHash, effort: one(argv, '--노력') || 'high', units: chosen };
    writeJson(path.join(dir, 'packet.json'), packet);
    console.log(`${dir} · ${round} · 단위 ${chosen.length}(${chosen.map(u => u.key).join(', ')}) · 기준 ${rb.id} ${rb.sha}`);
    return 0;
  }
  const packet = readJson(path.join(dir, 'packet.json'));
  if (command === '클로드') {
    const 클로드 = require('../../../../../tools/lib/클로드키.js');
    const batchFile = path.join(dir, 'claude-batch.json');
    if (argv.includes('--보내기')) {
      if (fs.existsSync(batchFile)) throw new Error(`이미 보낸 일괄: ${batchFile}`);
      const requests = claudeRequests(packet);
      const made = await 클로드.배치보내기(requests, { 용도: `speaking-review:${name}` });
      writeJson(batchFile, { ...made, at: new Date().toISOString(), requests: requests.length });
      console.log(`일괄 ${made.배치id} · 키 ${made.키이름} · 요청 ${requests.length}`);
      return 0;
    }
    const made = readJson(batchFile);
    if (argv.includes('--기다리기')) {
      for (let i = 0; i < 180; i++) { const state = await 클로드.배치보기(made.배치id, made.키이름);
        if (state.processing_status === 'ended') break; if (i % 6 === 0) console.log(`${new Date().toISOString()} ${state.processing_status} ${JSON.stringify(state.request_counts)}`);
        await new Promise(r => setTimeout(r, 20_000)); }
    }
    if (argv.includes('--받기') || argv.includes('--기다리기')) {
      const { 결과, 합계 } = await 클로드.배치결과(made.배치id, made.키이름, { 용도: `speaking-review:${name}` });
      const results = {}, errors = {};
      for (const row of 결과) { const ref = String(row.custom_id).split('-')[1]; const message = row.result?.message;
        if (row.result?.type !== 'succeeded') { errors[ref] = row.result?.type; continue; }
        if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') { errors[ref] = message.stop_reason; continue; }
        try { results[ref] = { ...JSON.parse(textOf(message)), usage: message.usage, usd: 클로드.추정USD(message.model, message.usage, { 배치: true }) }; } catch { errors[ref] = 'JSON 아님'; } }
      writeJson(path.join(dir, 'claude.json'), { batch: made.배치id, key: made.키이름, model: CLAUDE_MODEL, total: 합계, results, errors });
      console.log(`결과 ${합계.요청} · 성공 ${합계.성공} · 오류 ${Object.keys(errors).length} · 추정 $${합계.추정USD}`);
      return Object.keys(errors).length ? 1 : 0;
    }
    const state = await 클로드.배치보기(made.배치id, made.키이름);
    console.log(`${made.배치id}: ${state.processing_status} ${JSON.stringify(state.request_counts)}`);
    return 0;
  }
  if (command === '아르곤') {
    const { 부르기 } = require('../../../../../tools/lib/제미나이구독호출.js');
    const outFile = path.join(dir, 'argon.json'), size = Number(one(argv, '--묶음')) || 4;
    const state = fs.existsSync(outFile) ? readJson(outFile) : { model: ARGON.label, rubric: packet.rubric, calls: [], results: {} };
    const pending = packet.units.filter(unit => !state.results[unit.ref]);
    for (let i = 0; i < pending.length; i += size) {
      const group = pending.slice(i, i + size), { marker, prompt, schema } = argonPrompt(packet, group), started = Date.now();
      let record = null, error = null, parsed = null;
      try { record = await 부르기({ model: ARGON.model, thinking: ARGON.thinking, prompt, schema, timeoutMs: 1_200_000 }); } catch (e) { error = e.message; }
      if (!error) { try { parsed = JSON.parse(record.text); } catch { error = '답이 JSON이 아니다'; } }
      if (parsed && (parsed.seen || []).includes('truncated')) error = '목록 끝을 못 봤다(잘림)';
      const seconds = Math.round((Date.now() - started) / 1000);
      state.calls.push({ refs: group.map(u => u.ref), seconds, marker, promptBytes: Buffer.byteLength(prompt), error, at: new Date().toISOString(), selectedModel: record?.selectedModel ?? null, usage: record?.usage ?? null });
      if (!error) for (const row of parsed.items || []) if (group.some(u => u.ref === row.ref)) state.results[row.ref] = row;
      const missing = group.filter(u => !state.results[u.ref]).map(u => u.ref);
      console.log(`아르곤 ${group.map(u => u.ref).join(',')} · ${seconds}초${error ? ` · 실패: ${error}` : missing.length ? ` · 빠짐 ${missing.join(',')}` : ''}`);
      writeJson(outFile, state);
    }
    console.log(`아르곤 결과 ${Object.keys(state.results).length}/${packet.units.length}`);
    return Object.keys(state.results).length === packet.units.length ? 0 : 1;
  }
  if (command === '합치기') {
    const m = merged(name);
    writeJson(path.join(dir, 'merged.json'), m);
    for (const [key, row] of Object.entries(m)) console.log(`${key}: Claude ${row.claude?.verdict ?? '-'} · 아르곤 ${row.argon?.verdict ?? '-'}`);
    return 0;
  }
  throw new Error(`모르는 명령 ${command}`);
}

// 판 하나의 두 결과를 문항 id로 묶는다(usage·usd는 뺀다).
export function merged(name) {
  const dir = dirOf(name), packet = readJson(path.join(dir, 'packet.json'));
  const claude = fs.existsSync(path.join(dir, 'claude.json')) ? readJson(path.join(dir, 'claude.json')).results : {};
  const argon = fs.existsSync(path.join(dir, 'argon.json')) ? readJson(path.join(dir, 'argon.json')).results : {};
  const strip = row => { if (!row) return null; const { usage, usd, ref, ...rest } = row; return rest; };
  return Object.fromEntries(packet.units.map(unit => [unit.key, { ref: unit.ref, hash: unit.hash, claude: strip(claude[unit.ref]), argon: strip(argon[unit.ref]) }]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(error.stack || error.message); process.exitCode = 2; });
}
