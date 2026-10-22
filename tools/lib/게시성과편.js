'use strict';
/**
 * 게시성과편 — 서버에 등록된 게시물을 편 폴더(docs/마케팅/<편>/)에 잇고, 편의 브랜드·역할·훅 이름표를 읽고, 판정을 편 폴더에 쓴다.
 *
 * 잇기: 게시/게시결과.json 판[].주소가 가장 확실하다. 그 밖에는 게시/ 안의 글(게시결과_*.md·게시글.md 등)과 기획.md·게시글.md에
 *   적힌 주소로 찾되, 한 폴더로만 좁혀질 때만 잇는다(다른 편이 비교용으로 남의 주소를 적어 둔 경우가 있어서).
 * 역할: 준비.json "역할" → 기획.md 첫 줄의 「역할 <유입|육성|권위|전환>」.
 * 훅 이름표: 준비.json 판[].훅(그 판의 이름표, 또는 "A"·"B") → 기획.md 첫 줄의 「훅: A <이름표> · B <이름표>」.
 *   A·B 둘이고 판마다 적지 않았으면 v2 §2-1 기본대로 유튜브는 B, 나머지(인스타·페북·틱톡)는 A다. 하나면 모든 판에 그 이름표.
 * 쓰기: 게시/성과.json의 "자동판정" 칸(다른 칸은 그대로 둔다)과 기획.md 끝의 표시 사이 묶음. 둘 다 이 도구가 다시 쓴다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { postIdOf } = require('./게시성과판정.js');

const ROLES = ['유입', '육성', '권위', '전환'];
const BLOCK_START = '<!-- 게시성과:시작 — tools/게시성과.js가 다시 쓴다. 손으로 고치지 않는다 -->';
const BLOCK_END = '<!-- 게시성과:끝 -->';
// 주소 글자는 ASCII만 — 「…/R3zPsNM6a2c에서」처럼 한글이 바로 붙어도 주소에서 끊는다. 끝의 문장부호는 아래에서 뗀다.
const URL_RE = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|instagram\.com|facebook\.com|tiktok\.com)\/[A-Za-z0-9\-._~/?#@!$&*+;=%:]+/gi;

const readJson = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
const readText = file => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
const firstLine = text => (String(text || '').split(/\r?\n/).find(l => l.trim() && !/^<!--/.test(l.trim())) || '').trim();

/** 기획.md 첫 줄 → {role, hooks:{A,B}|{one}} */
function parseFirstLine(line) {
  const out = { role: null, hooks: null };
  const r = /역할\s*[:：]?\s*(유입|육성|권위|전환)/.exec(line);
  if (r) out.role = r[1];
  const at = line.lastIndexOf('훅:') >= 0 ? line.lastIndexOf('훅:') : line.lastIndexOf('훅 :');
  if (at >= 0 && !/0초\s*$/.test(line.slice(0, at))) {
    const rest = line.slice(at).replace(/^훅\s*:\s*/, '');
    const segs = rest.split(/\s*·\s*/).map(s => s.trim()).filter(Boolean);
    const hooks = {};
    for (const s of segs) {
      const m = /^([AB])\s*[:：]?\s+(.+)$/.exec(s);
      if (m) hooks[m[1]] = m[2].replace(/[「」"]/g, '').trim();
      else if (!Object.keys(hooks).length) { hooks.one = s.replace(/[「」"]/g, '').trim(); break; }
      else break;
    }
    if (Object.keys(hooks).length) out.hooks = hooks;
  }
  return out;
}

function brandOf(folder, prep) {
  if (prep && typeof prep.브랜드 === 'string' && prep.브랜드.trim()) return prep.브랜드.trim();
  const m = /^(LAB|synkbrief|yuhobuilds|PATH|PULSE|SHIFT)[_\s]/i.exec(folder);
  return m ? (m[1].toUpperCase() === 'LAB' ? 'LAB' : m[1]) : null;
}

/** 편 하나의 정보 */
function readFolder(dir) {
  const folder = path.basename(dir);
  const prep = readJson(path.join(dir, '게시', '준비.json'));
  const result = readJson(path.join(dir, '게시', '게시결과.json'));
  const plan = readText(path.join(dir, '기획.md'));
  const head = parseFirstLine(firstLine(plan));
  const role = prep && ROLES.includes(prep.역할) ? prep.역할 : head.role;
  const plateHooks = new Map();
  for (const p of (prep && Array.isArray(prep.판) ? prep.판 : [])) {
    if (p && typeof p.계정 === 'string' && typeof p.훅 === 'string' && p.훅.trim()) plateHooks.set(p.계정, p.훅.trim());
  }
  return { folder, dir, brand: brandOf(folder, prep), role, hooks: head.hooks, plateHooks, prep, result, hasPlan: plan !== null };
}

/** 그 판(계정 키·플랫폼)의 훅 이름표 */
function hookFor(info, { account, platform }) {
  const hooks = info.hooks || {};
  const named = account && info.plateHooks.get(account);
  if (named) {
    if (/^[AB]$/.test(named)) return { label: hooks[named] || null, slot: named };
    return { label: named, slot: null };
  }
  if (hooks.one) return { label: hooks.one, slot: null };
  if (hooks.A && hooks.B) return platform === 'youtube' ? { label: hooks.B, slot: 'B' } : { label: hooks.A, slot: 'A' };
  if (hooks.A) return { label: hooks.A, slot: 'A' };
  return { label: null, slot: null };
}

/** docs/마케팅 아래 편 폴더를 훑어 주소 → 편 색인을 만든다 */
function buildIndex(root) {
  const folders = new Map();
  const hits = new Map(); // postKey → [{folder, strength, account}]
  const hit = (key, folder, strength, account = null) => {
    if (!hits.has(key)) hits.set(key, []);
    hits.get(key).push({ folder, strength, account });
  };
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()); } catch { return { folders, resolve: () => null }; }
  for (const d of dirs) {
    const dir = path.join(root, d.name);
    const pubDir = path.join(dir, '게시');
    const hasPub = fs.existsSync(pubDir);
    const plan = path.join(dir, '기획.md');
    if (!hasPub && !fs.existsSync(plan)) continue;
    const info = readFolder(dir);
    folders.set(d.name, info);
    for (const p of (info.result && Array.isArray(info.result.판) ? info.result.판 : [])) {
      const id = p && postIdOf(p.주소);
      if (id) hit(id.key, d.name, 3, typeof p.계정 === 'string' ? p.계정 : null);
    }
    const texts = [];
    if (hasPub) {
      for (const f of fs.readdirSync(pubDir)) {
        if (f === '성과.json' || !/\.(md|json|txt)$/i.test(f)) continue;
        texts.push([path.join(pubDir, f), /^게시결과|^게시글/.test(f) ? 2 : 1.5]);
      }
    }
    texts.push([plan, 1], [path.join(dir, '게시글.md'), 1.5]);
    for (const [file, strength] of texts) {
      const text = readText(file);
      if (!text) continue;
      for (const url of new Set(text.match(URL_RE) || [])) {
        const id = postIdOf(url.replace(/[.!?:;*]+$/, ''));
        if (id) hit(id.key, d.name, strength);
      }
    }
  }
  /** postKey → {info, account} | null(못 찾음·여러 폴더) */
  function resolve(postKey) {
    const list = hits.get(postKey);
    if (!list || !list.length) return null;
    const top = Math.max(...list.map(h => h.strength));
    const best = [...new Set(list.filter(h => h.strength === top).map(h => h.folder))];
    if (best.length !== 1) return { ambiguous: best };
    const account = list.find(h => h.folder === best[0] && h.account)?.account || null;
    return { info: folders.get(best[0]), account };
  }
  return { folders, resolve };
}

/** 원자적으로 쓴다(임시 파일 → 바꿔치기) */
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.게시성과.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

/** 게시/성과.json의 "자동판정" 칸을 바꾼다. 바뀐 것이 없으면 false */
function writeResultJson(dir, payload) {
  const file = path.join(dir, '게시', '성과.json');
  const raw = readText(file);
  let data = {};
  if (raw !== null) {
    try { data = JSON.parse(raw.replace(/^﻿/, '')); } catch { return { changed: false, skipped: '성과.json이 JSON이 아니라 건드리지 않았다' }; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { changed: false, skipped: '성과.json 모양이 달라 건드리지 않았다' };
  }
  const before = JSON.stringify(data.자동판정 ?? null);
  const after = JSON.stringify(payload);
  if (before === after) return { changed: false, file };
  data.자동판정 = payload;
  // 그 파일이 쓰던 줄끝을 따른다(공용 작업본은 CRLF로 꺼낸다 — 줄끝만 바뀐 파일이 미커밋으로 남지 않게)
  const eol = raw !== null && /\r\n/.test(raw) ? '\r\n' : '\n';
  writeAtomic(file, (JSON.stringify(data, null, 2) + '\n').replace(/\n/g, eol));
  return { changed: true, file };
}

/** 기획.md 끝의 판정 묶음을 바꾼다(없으면 끝에 붙인다). 바뀐 것이 없으면 false */
function writePlanBlock(dir, lines) {
  const file = path.join(dir, '기획.md');
  const text = readText(file);
  if (text === null) return { changed: false, skipped: '기획.md 없음' };
  const eol = /\r\n/.test(text) ? '\r\n' : '\n';
  const block = [BLOCK_START, ...lines, BLOCK_END].join(eol);
  const s = text.indexOf(BLOCK_START), e = text.indexOf(BLOCK_END);
  let next;
  if (s >= 0 && e > s) next = text.slice(0, s) + block + text.slice(e + BLOCK_END.length);
  else next = text.replace(/\s*$/, '') + eol + eol + block + eol;
  if (next === text) return { changed: false, file };
  writeAtomic(file, next);
  return { changed: true, file };
}

module.exports = { ROLES, BLOCK_START, BLOCK_END, parseFirstLine, readFolder, hookFor, buildIndex, writeResultJson, writePlanBlock, brandOf };
