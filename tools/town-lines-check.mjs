#!/usr/bin/env node
/** 싱크타운 원고 검사기 — 찻집 골목의 하루 세로 조각 설계 §16-3.
 *
 *   node tools/town-lines-check.mjs          원고 전체를 검사한다(오류가 있으면 종료 1)
 *   node tools/town-lines-check.mjs --json   결과를 JSON으로 낸다
 *
 * 원고는 experiences/synk-town/town/data/lines/*.json 이다. 파일 하나는 줄 묶음(배열, §16-2 꼴) 또는
 * 대화 장면 하나(sceneId·versions, §12-2 꼴)다.
 * 지금(W0) 보는 것: 원고 ID 꼴·중복, L1 판, 금지 말(G3·G4·G10·주민:26). 수준·설정 일관성·판본 일치는 W10에서 더한다.
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
/** 「그동안 달라진 것」 줄 — 금지 말을 허용 목록 없이 막는다(§10-2). */
export const STRICT_KINDS = ['changes'];

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
