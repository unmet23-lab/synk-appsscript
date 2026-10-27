#!/usr/bin/env node
/** 싱크타운 원고 검사기 — 찻집 골목의 하루 세로 조각 설계 §16-3.
 *
 *   node tools/town-lines-check.mjs          원고 전체를 검사한다(오류가 있으면 종료 1)
 *   node tools/town-lines-check.mjs --json   결과를 JSON으로 낸다
 *
 * 원고는 experiences/synk-town/town/data/lines/*.json 이다. 파일 하나는 줄 묶음(배열, §16-2 꼴) 또는
 * 대화 장면 하나(sceneId·versions, §12-2 꼴)다.
 * 지금 보는 것: 원고 ID 꼴·중복, L1 판, 금지 말(G3·G4·G10·주민:26), 마음 한 줄(kind mood, W4)의 꼴·네 판·판 길이 상한,
 * W5의 카드·쌍·소식 줄 꼴과 판 길이(소식 줄은 금지 말 예외 없음), 전해 듣기 틀을 소식 줄로 채운 판 길이.
 * 낱말·문형 층 대조와 설정 일관성은 W10에서 더한다.
 * 금지 말 목록은 이 파일 한 곳에 두고, 원칙 시험(§15-2)도 여기서 가져다 쓴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LINES_DIR = path.join(ROOT, 'experiences/synk-town/town/data/lines');
export const ALLOW_FILE = path.join(ROOT, 'experiences/synk-town/town/data/lines-allow.json');

export const LEVELS = ['L1', 'L2', 'L3', 'L4'];
export const RESIDENTS = ['cafe-owner', 'workshop-owner', 'researcher'];
/** 「그동안 달라진 것」 줄과 마을 소식 줄 — 금지 말을 허용 목록 없이 막는다(§10-2, W5 §2-9). */
export const STRICT_KINDS = ['changes', 'news'];
/** 전해 듣기 틀의 빈칸(§9-4): {news}는 소식 줄, {from}은 전해 준 주민의 역할명. 검사기는 채운 뒤 길이를 잰다. */
export const ROLE_LABELS = Object.freeze({ 'cafe-owner': '찻집 주인', 'workshop-owner': '공방 주인', researcher: '연구원' });
/** 소식 줄은 전해 듣기 틀(앞말 한 덩이·뒷말 한 문장)이 감쌀 자리를 남긴다 — L2 한 문장 5어절, L3 두 문장까지, L4 세 문장까지. */
export const NEWS_LENGTH = Object.freeze({ L1: { sentences: [1, 1], words: 5 }, L2: { sentences: [1, 1], words: 5 },
  L3: { sentences: [1, 2], words: 10 }, L4: { sentences: [2, 3], words: 14 } });

/** 금지 말. 주민·마을 글에서 걸리면, 사람이 확인해 허용 목록에 올린 쓰임만 지나간다. */
export const FORBIDDEN = Object.freeze([
  // G3 · §10-2 — 오지 않은 날을 세게 하는 기간 말, 기다림, 탓을 돌리는 감사
  { rule: 'period', label: '기간·기다림 말', patterns: [/며칠/, /오랜만/, /동안/, /만에/, /그\s?사이/, /기다[리려렸]/, /보고\s?싶/, /왜\s?안/, /이제야/, /덕분에/] },
  // G4 · G10 — 플레이어 탓·서운함·실망
  { rule: 'blame', label: '탓·서운함 말', patterns: [/때문에\s?못/, /서운/, /섭섭/, /실망/] },
  // G3 — 플레이어를 향한 재촉
  { rule: 'nag', label: '재촉하는 말', patterns: [/빨리/, /어서\s?와요/] },
  // 주민:26 — 묻지 않는 주제
  { rule: 'topic', label: '묻지 않는 주제', patterns: [/결혼/, /연애/, /애인/, /남자\s?친구/, /여자\s?친구/, /몸무게/, /살이?\s?(?:빠|쪘|찌)/, /생김새/, /잘생기/, /돈벌이/, /월급/, /연봉/] },
]);

const ID = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9-]*\.\d+$/;
const SCENE_ID = /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/;

/** 마음 한 줄의 그림(§7-3 icon). 화면(day-mood.mjs)이 이 이름마다 그림을 그린다. */
export const MOOD_ICONS = Object.freeze(['rain', 'guests', 'seat', 'menu', 'leaf', 'steam', 'umbrella', 'cups', 'together', 'cold', 'orders',
  'quiet', 'plane', 'cup', 'wobble', 'tired', 'puddle', 'moon', 'sparkle', 'board', 'flower', 'pages', 'sun']);
/** 판 길이 상한(§13-1·§16-3, 다리 §3-1): 문장 수 [최소, 최대]와 문장마다 어절 수. L4의 최소 둘은 설계 §7-3 본보기(두 문장)에 맞춘 것. */
export const LEVEL_LENGTH = Object.freeze({ L1: { sentences: [1, 1], words: 5 }, L2: { sentences: [1, 1], words: 8 },
  L3: { sentences: [2, 3], words: 10 }, L4: { sentences: [2, 4], words: 14 } });
/** 문장으로 나눈다 — 마침표·물음표·느낌표 뒤에서만(말줄임 「…」은 문장 안이다). */
export const sentencesOf = text => text.trim().split(/(?<=[.?!])\s+/).filter(Boolean);
export const wordsOf = sentence => sentence.trim().split(/\s+/).filter(Boolean).length;

/** 마음 한 줄 하나의 꼴(§7-3 json·§16-2): ID = <주민>.mood.<이유>.<번호>, 네 판·그림·근거·하루 한 번, 판 길이. */
function moodProblems(entry, file) {
  const out = [], bad = (rule, message, level) => out.push({ file, id: entry.id, rule, message, ...(level ? { level } : {}) });
  const [npc, , key] = entry.id.split('.');
  if (!RESIDENTS.includes(entry.npc) || entry.npc !== npc) bad('mood', '마음 한 줄은 ID 앞의 주민이 npc예요.');
  if (entry.when?.reason !== key || Object.keys(entry.when || {}).length !== 1) bad('mood', 'when은 ID의 이유 하나({ reason })예요.');
  if (typeof entry.meaning !== 'string' || !entry.meaning.trim()) bad('mood', '뜻(meaning)이 없어요.');
  if (!MOOD_ICONS.includes(entry.icon)) bad('mood', `그림(icon)은 ${MOOD_ICONS.join('·')} 가운데 하나예요.`);
  if (!Array.isArray(entry.from) || !entry.from.length || !entry.from.every(f => typeof f === 'string' && f.trim())) bad('mood', '근거 설정(from)이 없어요.');
  if (entry.oncePerLifeDay !== true) bad('mood', '마음 한 줄은 생활일마다 한 번이에요(oncePerLifeDay).');
  for (const level of LEVELS) {
    const text = entry.levels?.[level];
    // 판본 일치(§16-3): 네 판이 다 있고, 빈칸은 쓰지 않는다(마음 줄에는 채울 값이 없다).
    if (typeof text !== 'string' || !text.trim()) { bad('mood', `${level} 판이 없어요 — 마음 한 줄은 네 판이 다 있어요.`, level); continue; }
    if (/[{}]/.test(text)) bad('mood', '마음 한 줄에는 빈칸이 없어요.', level);
    const { sentences: [least, most], words } = LEVEL_LENGTH[level], parts = sentencesOf(text);
    if (parts.length < least || parts.length > most) bad('length', `${level}은 ${least === most ? `${least}문장` : `${least}~${most}문장`}이에요(지금 ${parts.length}).`, level);
    for (const part of parts) if (wordsOf(part) > words) bad('length', `${level}은 문장마다 ${words}어절 안이에요 — 「${part}」 ${wordsOf(part)}어절.`, level);
  }
  return out;
}

/** 판 길이 하나를 잰다(문장 수와 문장마다 어절 수). */
function lengthProblems(text, level, rule, bad) {
  const { sentences: [least, most], words } = rule, parts = sentencesOf(text);
  if (parts.length < least || parts.length > most) bad('length', `${level}은 ${least === most ? `${least}문장` : `${least}~${most}문장`}이에요(지금 ${parts.length}).`, level);
  for (const part of parts) if (wordsOf(part) > words) bad('length', `${level}은 문장마다 ${words}어절 안이에요 — 「${part}」 ${wordsOf(part)}어절.`, level);
}

/** 「그동안 달라진 것」 줄(§10-2·§16-1, W6)의 판 길이 — 판의 첫 줄은 크게 보이는 한 줄이라 L2까지 한 문장, 채울 이름은 가장 긴 역할명으로 잰다. */
export const CHANGES_LENGTH = Object.freeze({ L1: { sentences: [1, 1], words: 5 }, L2: { sentences: [1, 1], words: 8 },
  L3: { sentences: [1, 2], words: 10 }, L4: { sentences: [1, 3], words: 14 } });
/** 「그동안 달라진 것」 줄의 빈칸: {npc}·{npc2}는 주민 역할명뿐이다(G5 — 허용 값만). */
export const CHANGES_SLOTS = Object.freeze(['npc', 'npc2']);
const LONGEST_LABEL = Object.values(ROLE_LABELS).reduce((a, b) => (b.split(/\s+/).length > a.split(/\s+/).length ? b : a));

/** 「그동안 달라진 것」 줄 하나의 꼴(W6): ID = village.changes.<틀>.<번호>, npc village, 네 판·뜻·근거, 빈칸은 역할명 둘까지(쌍 틀은
 * 둘 다), 채운 판 길이. 금지 말은 STRICT_KINDS로 허용 목록 없이 막는다. */
function changesProblems(entry, file) {
  const out = [], bad = (rule, message, level) => out.push({ file, id: entry.id, rule, message, ...(level ? { level } : {}) });
  const [npc, , frame] = entry.id.split('.');
  if (npc !== 'village' || entry.npc !== 'village') bad('changes', '그동안 달라진 것 줄의 npc는 village예요.');
  if (entry.when?.frame !== frame || Object.keys(entry.when || {}).length !== 1) bad('changes', 'when은 ID의 틀 하나({ frame })예요.');
  if (typeof entry.meaning !== 'string' || !entry.meaning.trim()) bad('changes', '뜻(meaning)이 없어요.');
  if (!Array.isArray(entry.from) || !entry.from.length || !entry.from.every(f => typeof f === 'string' && f.trim())) bad('changes', '근거 설정(from)이 없어요.');
  for (const level of LEVELS) {
    const text = entry.levels?.[level];
    if (typeof text !== 'string' || !text.trim()) { bad('changes', `${level} 판이 없어요 — 네 판이 다 있어요.`, level); continue; }
    const slots = [...text.matchAll(/\{([a-z0-9]+)\}/g)].map(m => m[1]);
    if (slots.some(slot => !CHANGES_SLOTS.includes(slot)) || /[{}]/.test(text.replace(/\{(?:npc|npc2)\}/g, ''))) bad('changes', `${level}: 빈칸은 {npc}·{npc2}뿐이에요.`, level);
    if (frame === 'pair' && !(slots.includes('npc') && slots.includes('npc2'))) bad('changes', `${level}: 쌍 틀에는 {npc}와 {npc2}가 다 있어요.`, level);
    lengthProblems(text.replace(/\{npc2?\}/g, LONGEST_LABEL), level, CHANGES_LENGTH[level], bad);
  }
  return out;
}

/** W5 줄의 꼴(§16-2·§2-9): 카드 줄(card — 계기·혼자·둘이·제안·결과), 쌍 줄(pair — 단계마다 두 사람), 소식 줄(news — 마을의 말),
 * 전해 듣기 틀(hearsay — 빈칸 {news}·{from}). 네 판이 다 있고, 빈칸은 전해 듣기 틀에만, 근거 설정(from)이 있다. */
function townProblems(entry, file) {
  const out = [], bad = (rule, message, level) => out.push({ file, id: entry.id, rule, message, ...(level ? { level } : {}) });
  const [npc, kind] = entry.id.split('.');
  if (entry.kind !== kind) bad(kind, `kind는 ID의 둘째 칸(${kind})이에요.`);
  if (entry.npc !== npc || !(kind === 'news' ? npc === 'village' : RESIDENTS.includes(npc))) bad(kind, kind === 'news' ? '소식 줄의 npc는 village예요.' : '줄의 npc는 ID 앞의 주민이에요.');
  if (typeof entry.meaning !== 'string' || !entry.meaning.trim()) bad(kind, '뜻(meaning)이 없어요.');
  if (!Array.isArray(entry.from) || !entry.from.length || !entry.from.every(f => typeof f === 'string' && f.trim())) bad(kind, '근거 설정(from)이 없어요.');
  for (const level of LEVELS) {
    const text = entry.levels?.[level];
    if (typeof text !== 'string' || !text.trim()) { bad(kind, `${level} 판이 없어요 — 네 판이 다 있어요.`, level); continue; }
    const slots = [...text.matchAll(/\{([a-z]+)\}/g)].map(m => m[1]);
    if (kind === 'hearsay') {
      if (!slots.includes('news') || slots.some(s => !['news', 'from'].includes(s)) || (entry.when?.how !== 'heard' && slots.includes('from'))) bad('hearsay', `${level}: 전해 듣기 틀에는 {news}가 하나 있고, {from}은 들은 것(heard)에만 있어요.`, level);
      continue;
    }
    if (/[{}]/.test(text)) bad(kind, '빈칸은 전해 듣기 틀에만 있어요.', level);
    lengthProblems(text, level, kind === 'news' ? NEWS_LENGTH[level] : LEVEL_LENGTH[level], bad);
  }
  return out;
}

/** 전해 듣기 틀을 소식 줄마다(같은 판)·전해 준 주민마다 채워 보고 판 길이를 잰다 — 틀 하나에 걸린 것은 한 번만 적는다. */
function hearsayProblems(documents) {
  const entries = documents.flatMap(({ file, doc }) => (Array.isArray(doc) ? doc.map(entry => ({ file, entry })) : []));
  const news = entries.filter(({ entry }) => entry?.kind === 'news').map(({ entry }) => entry);
  const out = [];
  for (const { file, entry } of entries.filter(({ entry }) => entry?.kind === 'hearsay')) {
    const tellers = Object.entries(ROLE_LABELS).filter(([npc]) => npc !== entry.npc).map(([, label]) => label);
    for (const level of LEVELS) {
      const frame = entry.levels?.[level];
      if (typeof frame !== 'string') continue;
      const found = new Map();
      for (const item of news) for (const from of tellers) {
        const text = frame.replace('{news}', item.levels?.[level] ?? '').replace('{from}', from);
        lengthProblems(text, level, LEVEL_LENGTH[level], (rule, message) => { if (!found.has(message)) found.set(message, item.id); });
      }
      for (const [message, newsId] of found) out.push({ file, id: entry.id, rule: 'length', level, message: `${message} (${newsId}로 채웠을 때)` });
    }
  }
  return out;
}

/** 글 하나에서 걸린 금지 말. 플레이어 보기는 기간·탓·재촉 대상이 아니라 주제만 본다. */
export function scanText(text, { speaker = 'resident' } = {}) {
  const hits = [];
  for (const group of FORBIDDEN) {
    if (speaker === 'player' && group.rule !== 'topic') continue;
    for (const pattern of group.patterns) {
      const re = new RegExp(pattern.source, 'g');
      for (let m = re.exec(text); m; m = re.exec(text)) hits.push({ rule: group.rule, label: group.label, phrase: m[0], index: m.index });
    }
  }
  // 겹친 같은 갈래는 하나로 센다(「오랜만에」는 「오랜만」·「만에」 둘이 아니라 한 번).
  hits.sort((a, b) => a.index - b.index || b.phrase.length - a.phrase.length);
  return hits.filter((hit, i) => !hits.slice(0, i).some(prev => prev.rule === hit.rule && hit.index < prev.index + prev.phrase.length));
}

function levelTexts(levels) {
  return LEVELS.filter(level => Object.hasOwn(levels, level)).map(level => [level, levels[level]]);
}

/** 원고 문서에서 검사할 글을 모은다. */
export function collectTexts(doc, file) {
  const texts = [], problems = [];
  const bad = (id, message) => problems.push({ file, id, rule: 'shape', message });
  if (Array.isArray(doc)) {
    for (const entry of doc) {
      const id = entry?.id;
      if (typeof id !== 'string' || !ID.test(id)) { bad(id ?? '(없음)', 'ID는 <주민>.<종류>.<열쇠>.<번호> 꼴이어야 해요.'); continue; }
      if (!entry.levels || typeof entry.levels !== 'object' || Array.isArray(entry.levels)) { bad(id, '판(levels)이 없어요.'); continue; }
      const extra = Object.keys(entry.levels).filter(level => !LEVELS.includes(level));
      if (extra.length) bad(id, `모르는 판: ${extra.join(', ')}`);
      if (typeof entry.levels.L1 !== 'string') bad(id, 'L1 판은 모든 줄에 있어야 해요(다리 §3-4).');
      if (entry.kind === 'mood') problems.push(...moodProblems(entry, file));
      if (['card', 'hearsay', 'pair', 'news'].includes(entry.kind)) problems.push(...townProblems(entry, file));
      if (entry.kind === 'changes') problems.push(...changesProblems(entry, file));
      const speaker = RESIDENTS.includes(entry.npc) ? 'resident' : 'system';
      for (const [level, text] of levelTexts(entry.levels)) {
        if (typeof text !== 'string' || !text.trim()) { bad(id, `${level} 판이 비었어요.`); continue; }
        texts.push({ file, id, level, kind: entry.kind ?? null, speaker, strict: STRICT_KINDS.includes(entry.kind), text });
      }
    }
  } else if (doc && typeof doc === 'object' && typeof doc.sceneId === 'string') {
    const id = doc.sceneId;
    if (!SCENE_ID.test(id)) bad(id, '장면 ID 꼴을 확인해 주세요.');
    if (!doc.versions?.L1) bad(id, 'L1 판은 모든 장면에 있어야 해요(다리 §3-4).');
    for (const [level, version] of levelTexts(doc.versions || {})) {
      const add = (text, speaker) => {
        if (typeof text === 'string' && text.trim()) texts.push({ file, id, level, kind: 'scene', speaker, strict: false, text });
      };
      const turn = t => {
        if (!t || typeof t !== 'object') return;
        add(t.line, 'resident');
        for (const choice of t.choices || []) add(typeof choice === 'string' ? choice : choice?.text, 'player');
        for (const branch of Object.values(t.byOutcome || {})) turn(branch);
      };
      if (!Array.isArray(version?.turns)) { bad(id, `${level} 판에 차례(turns)가 없어요.`); continue; }
      version.turns.forEach(turn);
      for (const key of ['stop', 'aroma']) add(version[key], 'resident');
    }
  } else bad(path.basename(file), '줄 묶음(배열)이나 장면(sceneId)이어야 해요.');
  return { texts, problems };
}

function allowedBy(allow, item, hit) {
  return allow.find(entry => entry.id === item.id && (entry.level === '*' || entry.level === item.level)
    && entry.rule === hit.rule && typeof entry.phrase === 'string' && entry.phrase.includes(hit.phrase)
    && [...item.text.matchAll(new RegExp(entry.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))]
      .some(m => m.index <= hit.index && hit.index + hit.phrase.length <= m.index + entry.phrase.length));
}

/** 문서들을 검사한다. allow: 사람이 확인한 쓰임(§16-3) — { id, level|'*', rule, phrase, reason }. */
export function checkDocuments(documents, { allow = [] } = {}) {
  const problems = [], seen = new Map(), used = new Set();
  let count = 0;
  for (const entry of allow) {
    if (!entry || typeof entry.reason !== 'string' || !entry.reason.trim()) problems.push({ file: 'lines-allow.json', id: entry?.id ?? '(없음)', rule: 'allow', message: '허용 목록에는 까닭이 있어야 해요.' });
  }
  for (const { file, doc } of documents) {
    const { texts, problems: shape } = collectTexts(doc, file);
    problems.push(...shape);
    const ids = Array.isArray(doc) ? doc.map(entry => entry?.id).filter(id => typeof id === 'string') : [doc?.sceneId];
    for (const id of ids) {
      if (seen.has(id)) problems.push({ file, id, rule: 'duplicate', message: `같은 ID가 ${path.basename(seen.get(id))}에도 있어요.` });
      else seen.set(id, file);
    }
    for (const item of texts) {
      count++;
      for (const hit of scanText(item.text, { speaker: item.speaker })) {
        const permit = item.strict ? null : allowedBy(allow, item, hit);
        if (permit) { used.add(permit); continue; }
        problems.push({ file, id: item.id, level: item.level, rule: hit.rule, phrase: hit.phrase, text: item.text,
          message: item.strict ? `「그동안 달라진 것」 줄에는 ${hit.label}을 쓰지 않아요.` : `${hit.label}: 사람이 확인한 쓰임만 허용 목록에 올려요.` });
      }
    }
  }
  problems.push(...hearsayProblems(documents));
  const unused = allow.filter(entry => !used.has(entry)).map(entry => ({ id: entry.id, phrase: entry.phrase }));
  return { texts: count, documents: documents.length, problems, unusedAllow: unused };
}

export function loadDocuments(dir = LINES_DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort()
    .map(name => ({ file: path.join(dir, name), doc: JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) }));
}

export function loadAllow(file = ALLOW_FILE) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkDocuments(loadDocuments(), { allow: loadAllow() });
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`원고 ${result.documents}개 · 글 ${result.texts}줄 · 문제 ${result.problems.length}건`);
    for (const p of result.problems) console.log(`- ${path.basename(p.file)} ${p.id}${p.level ? ` ${p.level}` : ''}: ${p.message}${p.phrase ? ` 「${p.phrase}」` : ''}`);
    if (result.unusedAllow.length) console.log(`쓰이지 않는 허용 ${result.unusedAllow.length}건: ${result.unusedAllow.map(a => a.id).join(', ')}`);
  }
  process.exitCode = result.problems.length ? 1 : 0;
}
