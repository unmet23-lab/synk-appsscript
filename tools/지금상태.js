#!/usr/bin/env node
'use strict';
/**
 * 지금 상태 — Claude Code 훅(SessionStart · UserPromptSubmit)이 부른다(2026-11-15).
 *
 * 왜: 11-15 업무 백업 세션(11-12부터 돈 세션)이 이미 끝난 일(손님용 B2 가입 11-12, 화면 시안 「A 확인서」 11-13)을 유호님께 다시 부탁드렸다.
 *   설계 문서의 11-12 일정표와 「여쭐 것」 표를 읽고 말했는데, 끝났다는 사실은 트랙과 결정 행에만 있었다. 시안은 곁 세션이 정한 것이고,
 *   B2 행은 그 세션이 직접 썼지만 압축 여덟 번 뒤에 잊었다(Fable 5.2 설계 검토 D2). 같은 문맥에서 기록찾기를 돌렸지만 다른 낱말이었다.
 *   유호님 「…대부분의 세션이 그 전의 정보들을 읽고있더라고 … 근본적인 원인을 고치고싶어」 → 「응, 만들어」.
 *   그래서 세션이 일을 다시 잡는 순간(이어 받기 · 압축 뒤 · 새 말)에 하네스가 그 일의 지금 기록을 문맥에 넣는다. 압축 뒤 영상 입구(tools/압축뒤입구.js)를 모든 일로 넓힌 꼴이다.
 *
 * 하는 일: 훅 입력(stdin JSON — hook_event_name · source · session_id · transcript_path · cwd · prompt)을 읽어, SYNK 작업본의 세션이면
 *   기록 끝 24MB의 어시스턴트 도구 입력에서 이 세션이 고친 「곳」(experiences/<x> · tools/<파일> · docs/마케팅/<편> …)을 셋까지 고른다
 *   (고친 흔적이 한 번은 있어야 곳이다 — 돌리기만 한 도구 · 읽기만 한 곳은 순위에만 쓴다). 운영 사본(이 파일의 저장소)의 git에서 셋을 찾아 넣는다.
 *     ① 그 곳의 트랙 줄 — 「유호님 차례」(트랙 1절) 줄을 따로 묶어 먼저, 줄마다 제목 · 끝난 것 · 남은 일
 *     ② 세션 시작 뒤(새 말 때는 마지막으로 넣은 뒤) 생긴 결정 행 가운데 그 곳과 이어진 것 — 이 세션이 쓴 행도 넣는다(압축 뒤에는 잊는다)
 *     ③ 그 곳에 올라온 커밋 — 수와 최근 셋
 *   잇는 법: 줄의 md 링크를 docs/_ops 자리에서 풀거나 경로를 글자로 품으면 잇고, 태그 · 제목 첫 마디가 그 곳의 이름(그 곳의 경로를 품은 행 · 줄의 첫 마디)과
 *   같거나 앞머리면 잇는다. 지금 문맥(마지막 압축 뒤 기록 끝 4MB)에 이미 있는 것은 뺀다. 압축 직후에는 새 경계 줄이 아직 기록에 없으므로 문맥을 비운 것으로 본다.
 *   글은 압축 · 이어 받기 4,000자, 새 말 1,500자까지. 넣을 것이 없으면 아무것도 내지 않는다. AI가 요약하지 않는다(트랙 · 결정 표 · git 원문 조각만).
 *   새 말(UserPromptSubmit): 10분 안에 본 적이 있으면 바로 끝난다. 그 뒤로 그 곳 · 결정 표 · 트랙이 바뀌지 않았으면 기록을 읽지 않는다.
 *   말이 남은 일 · 일정 · 유호님 차례를 물으면(「나머지 작업 … 얼마나 걸릴것같아?」) 새것이 없어도 그 곳의 트랙 줄을 다시 넣는다(30분 안에 넣었으면 뺀다).
 *   운영 사본이 30분 넘게 origin을 따라가지 못했으면 그 사실 한 줄만 넣는다. 늘 끝 코드 0, git 한 번에 5초 — 이 훅 때문에 세션이 멈추지 않는다.
 *   상태 · 기록: %LOCALAPPDATA%/synk/지금상태/<session_id>.json · 기록.jsonl(훅마다 한 줄 — 걸린 ms · 넣은 수 · 실패 까닭, 14일 지난 상태는 지운다).
 *
 *   node tools/지금상태.js                                   훅으로(stdin JSON)
 *   node tools/지금상태.js --되짚기 <기록.jsonl> [--판 origin/master]   그 세션의 사람 말 · 압축마다 그때의 판으로 돌려 무엇이 들어갔을지 보인다
 *
 * 등록: ~/.claude/settings.json(과 ~/.claude-unmet29/settings.json)의 hooks.SessionStart · hooks.UserPromptSubmit에
 *   { type: "command", command: "<node>", args: ["<운영 사본>/tools/지금상태.js"], timeout: 15 } (관문·자동화 한 장의 Claude Code 훅 표).
 *   재기: node tools/기록찾기재기.js. 시험: node --test tests/지금상태.test.js
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { 칸나누기 } = require('./lib/표.js');

const MARK = '〔지금 상태〕';
const TAIL_BYTES = 24 * 1024 * 1024;
const 문맥한도 = 4 * 1024 * 1024;     // 「지금 문맥에 있다」는 마지막 압축 뒤 기록 끝 4MB에 있을 때만(D2 · 물음 2)
const BIG_LINE = 300 * 1024;
const 말간격 = Number(process.env.SYNK_지금상태_간격분 || 10) * 60e3;
const 다시넣기간격 = 30 * 60e3;
const 글상한 = { 시작: 4000, 말: 1500 };
const 곳수 = 3;
const 낡은판 = 30 * 60e3;
const 상태폴더 = () => process.env.SYNK_지금상태폴더 || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'synk', '지금상태');
const 저장소뿌리 = () => path.resolve(process.env.SYNK_지금상태뿌리 || path.join(__dirname, '..'));

// ── 세션 기록 ────────────────────────────────────────────────────────────

function 끝읽기(file, bytes = TAIL_BYTES) {
  try {
    const size = fs.statSync(file).size;
    const fd = fs.openSync(file, 'r');
    try {
      const n = Math.min(size, bytes);
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, size - n);
      return buf.toString('utf8');
    } finally { fs.closeSync(fd); }
  } catch { return ''; }
}

/** 기록의 첫 시각 — 끝 24MB 앞에 세션 시작이 있을 수 있어 머리만 따로 읽는다. */
function 첫시각(file) {
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(256 * 1024);
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      const m = /"timestamp":"([^"]+)"/.exec(buf.toString('utf8', 0, n));
      return m ? m[1] : null;
    } finally { fs.closeSync(fd); }
  } catch { return null; }
}

/** JSONL 글 → [{ o, raw }]. 잘린 첫 줄 · 그림이 든 큰 줄은 버린다. */
function 기록풀기(text) {
  const out = [];
  for (const raw of String(text || '').split('\n')) {
    if (!raw || raw[0] !== '{' || raw.length > BIG_LINE) continue;
    try { out.push({ o: JSON.parse(raw), raw }); } catch { /* 잘린 줄 */ }
  }
  return out;
}

const 주입줄인가 = (o, raw) => o.type === 'attachment' && o.attachment && o.attachment.type === 'hook_additional_context' && raw.includes(MARK);

/** 기록 → { 문맥글, 도구들, 지난주입 }. 도구 입력은 어시스턴트(사이드체인 빼고)의 tool_use만, 줄의 cwd와 함께. */
function 세션읽기(기록, { 문맥비움 = false } = {}) {
  let 경계 = -1;
  기록.forEach((r, i) => { if (r.o.type === 'system' && r.o.subtype === 'compact_boundary') 경계 = i; });
  let 지난주입 = null;
  const 도구들 = [];
  for (const r of 기록) {
    const o = r.o;
    if (주입줄인가(o, r.raw) && o.timestamp) 지난주입 = o.timestamp;
    if (o.type !== 'assistant' || o.isSidechain || !Array.isArray(o.message && o.message.content)) continue;
    for (const b of o.message.content) if (b && b.type === 'tool_use' && b.input) 도구들.push({ 이름: b.name, 입력: b.input, cwd: o.cwd || null });
  }
  let 문맥글 = '';
  if (!문맥비움) {
    const 조각 = [];
    let 바이트 = 0;
    for (let i = 기록.length - 1; i > 경계 && 바이트 < 문맥한도; i--) { 조각.push(기록[i].raw); 바이트 += 기록[i].raw.length; }
    문맥글 = 조각.reverse().join('\n');
  }
  return { 문맥글, 도구들, 지난주입 };
}

// ── 곳 ──────────────────────────────────────────────────────────────────

const 공용문서 = [/^docs\/_ops\//, /^docs\/현장노트\//, /^AGENTS\.md$/, /^CLAUDE\.md$/, /^docs\/AI_운영원칙\.md$/, /^docs\/문서_지도\.md$/,
  /^tests\//, /^package(-lock)?\.json$/, /^\.claude\/(?!skills\/)/, /(^|\/)node_modules\//, /^\.tmp\//, /^\.git\//];
const 깊은docs = new Set(['마케팅', '디자인', '캐릭터', '유지비_BM', '지원사업', '오프라인_공간설계', 'PATH_정착관리']);
const 머리 = new Set(['experiences', 'packages', 'desktop', 'tools', 'docs', 'server', 'supabase', '.claude']);

/**
 * 절대 경로 → 저장소 안 상대 경로('' = 뿌리). 이 저장소 밖이면 null. 세 뿌리 꼴: D:\SYNK-worktrees\SYNK-appsscript\<이름> ·
 * …\SYNK-appsscript\.claude\worktrees\<이름> · …\SYNK-appsscript(공용 작업본 · 운영 사본 · …\codex\<이름>\SYNK-appsscript). C:\ · /c/ · /d/ 모두.
 */
function 저장소안(p) {
  const s = String(p || '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
  let m;
  if ((m = /\/SYNK-worktrees\/SYNK-appsscript\/[^/]+(?:\/(.*))?$/i.exec(s))) return m[1] || '';
  if ((m = /\/SYNK-appsscript\/\.claude\/worktrees\/[^/]+(?:\/(.*))?$/i.exec(s))) return m[1] || '';
  if ((m = /\/SYNK-appsscript(?:\/(.*))?$/i.exec(s))) return m[1] || '';
  return null;
}

/** 경로(절대 · 상대) → 저장소 상대 경로. 상대 경로는 그 도구를 부른 자리(바탕)에서 푼다. 이 저장소 밖이면 null. */
function 저장소상대(p, 바탕 = '') {
  let s = String(p || '').trim().replace(/^['"`]+|['"`,;:)]+$/g, '').replace(/\\/g, '/');
  if (!s) return null;
  if (/^([A-Za-z]:|\/|~)/.test(s)) { const r = 저장소안(s); return r ? r : null; }
  if (바탕 == null) return null;
  s = path.posix.normalize(path.posix.join(바탕 || '.', s));
  if (s.startsWith('..') || s === '.') return null;
  return 머리.has(s.split('/')[0]) || /^[^/]+\.(?:js|md|cjs|mjs)$/.test(s) ? s : null;
}

/** 저장소 상대 경로 → 곳(묶음 이름). 공용 문서 · 알 수 없는 꼴은 null. */
function 곳으로(rel) {
  if (!rel || /[*?{}$<>]/.test(rel)) return null;
  const s = rel.replace(/\/+$/, '');
  if (공용문서.some((re) => re.test(s))) return null;
  const 마디 = s.split('/').filter(Boolean);
  if (!마디.length) return null;
  const 앞 = (n) => (마디.length >= n ? 마디.slice(0, n).join('/') : null);
  switch (마디[0]) {
    case 'experiences': case 'packages': case 'desktop': case 'server': case 'supabase': return 앞(2);
    case 'tools': return 마디[1] === 'lib' ? 앞(3) : 앞(2);
    case 'docs': return 마디.length === 2 ? s : 깊은docs.has(마디[1]) ? 앞(3) || s : 앞(2);
    case '.claude': return 마디[1] === 'skills' ? 앞(3) : null;
    default: return 마디.length === 1 && /\.(?:js|md|cjs|mjs)$/.test(s) ? s : null;
  }
}

const 쓰는도구 = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const 읽는도구 = new Set(['Read', 'Grep', 'Glob']);
const 실행기 = /^(?:node|node\.exe|python3?|py|python\.exe|deno|bun|npx|tsx|bash|sh|pwsh|powershell)$/i;

/** 명령 글 → { 바탕, 길들 } — 맨 앞 `cd <경로>`가 있으면 그 자리가 바탕이다. 실행한 스크립트 자신(node tools/x.js의 tools/x.js)은 뺀다. */
function 명령경로들(명령, 바탕) {
  const 글 = String(명령);
  const cd = /^\s*cd\s+("([^"]+)"|'([^']+)'|(\S+))\s*(?:&&|;|\n)/.exec(글);
  if (cd) { const 자리 = cd[2] || cd[3] || cd[4]; const r = /^([A-Za-z]:|\/|~)/.test(자리) ? 저장소안(자리) : 저장소상대(자리, 바탕); 바탕 = r == null ? null : r; }
  const 낱 = 글.split(/[\s"'`|;&()<>=]+/).filter(Boolean);
  const 길들 = [];
  for (let i = 0; i < 낱.length; i++) {
    const w = 낱[i];
    if (!/[/\\]/.test(w)) continue;
    let k = i - 1;
    while (k >= 0 && /^-/.test(낱[k])) k--;   // node -I tools/x.py 따위의 플래그
    if (k >= 0 && 실행기.test(낱[k].replace(/^.*[/\\]/, ''))) continue;
    if (k >= 0 && 낱[k] === 'cd') continue;
    길들.push(w);
  }
  return { 바탕, 길들 };
}

/**
 * 도구들 → [{ 곳, 점수, 고침 }] 점수 순. 고친 흔적(Edit · Write · 바로올리기에 준 경로)이 한 번은 있어야 곳이다.
 * 점수: 고침 3점, 읽기와 그 밖의 명령 속 경로 1점. 가장 높은 곳의 10%에 못 미치면 뺀다.
 */
function 곳찾기(도구들) {
  const 점수 = new Map(), 고침 = new Map();
  const 더 = (rel, n, 고친것) => { const 곳 = 곳으로(rel); if (!곳) return; 점수.set(곳, (점수.get(곳) || 0) + n); if (고친것) 고침.set(곳, (고침.get(곳) || 0) + 1); };
  for (const { 이름, 입력, cwd } of 도구들) {
    const 바탕 = cwd ? 저장소안(cwd) : '';
    if (쓰는도구.has(이름)) { 더(저장소상대(입력.file_path || 입력.notebook_path, 바탕), 3, true); continue; }
    if (읽는도구.has(이름)) { 더(저장소상대(입력.file_path || 입력.path, 바탕), 1, false); continue; }
    if (typeof 입력.command === 'string') {
      const 올림 = /바로올리기\.js|내커밋\.js/.test(입력.command);
      const r = 명령경로들(입력.command, 바탕);
      for (const w of r.길들) 더(저장소상대(w, r.바탕), 올림 ? 3 : 1, 올림);
    }
  }
  const 줄 = [...점수].map(([곳, n]) => ({ 곳, 점수: n, 고침: 고침.get(곳) || 0 })).filter((x) => x.고침 > 0)
    .sort((a, b) => b.점수 - a.점수 || a.곳.localeCompare(b.곳));
  const 높 = 줄.length ? 줄[0].점수 : 0;
  return 줄.filter((x) => x.점수 >= 3 && x.점수 >= 높 * 0.1).slice(0, 곳수);
}

// ── 결정 표 · 트랙 ───────────────────────────────────────────────────────

const 붙임말 = /Claude|GPT|카본|그록|Fable|Opus|유호님|판단|말씀|승인|결정$|요청|확정|반영|검수|후속/;
const 글자수 = (s) => [...String(s).replace(/\s+/g, '')].length;
const 고르기 = (s) => String(s || '').replace(/\s+/g, ' ').trim().replace(/[:：\s]+$/, '');

/** 태그 · 제목의 첫 마디 — 이름으로 쓸 수 있으면 그 글, 아니면 null. */
function 첫마디(글) {
  const t = 고르기(String(글).split(/\s+[·—]\s+|\s+-\s+/)[0].replace(/\(.*$/, ''));
  return t && 글자수(t) >= 4 && !붙임말.test(t) ? t : null;
}

/** 한 줄이 가리키는 저장소 경로 — md 링크를 그 문서(docs/_ops/…) 자리에서 풀고, 백틱 속 경로를 더한다(D4: 트랙은 ../마케팅/… 꼴이 364줄이다). */
function 줄길들(줄, 문서 = 'docs/_ops/트랙.md') {
  const out = new Set();
  const 자리 = path.posix.dirname(문서);
  for (const m of String(줄).matchAll(/\]\(\s*<([^>]+)>\s*\)|\]\(\s*([^)\s]+)\s*\)/g)) {
    let t = m[1] || m[2];
    if (!t || /^[a-z]+:/i.test(t) || t.startsWith('#')) continue;
    t = t.replace(/#.*$/, '');
    try { t = decodeURIComponent(t); } catch { /* 그대로 */ }
    const p = path.posix.normalize(path.posix.join(자리, t)).replace(/\/$/, '');
    if (!p.startsWith('..')) out.add(p);
  }
  for (const m of String(줄).matchAll(/`((?:experiences|packages|desktop|tools|docs|\.claude)\/[^`\s]+)`/g)) out.add(m[1].replace(/[#:].*$/, ''));
  return [...out];
}

function 결정행풀기(줄, 번호) {
  if (!/^\|\s*20\d\d-\d\d-\d\d\s*\|/.test(줄)) return null;
  const 칸 = 칸나누기(줄);
  const 결정 = 칸[2] || '';
  const 태그 = (/^\[([^\]]+)\]/.exec(결정) || [])[1] || null;
  return { 종류: '결정', 번호, 날: 칸[0], 결정, 태그, 이름: 태그 ? 첫마디(태그) : null, 줄, 길: 줄길들(줄, 'docs/_ops/결정.md'), 열쇠: `${칸[0]}|${[...결정].slice(0, 60).join('')}` };
}

function 트랙줄풀기(줄, 번호, 절) {
  const m = /^\s*- \*\*(.+?)\*\*/.exec(줄);
  if (!m) return null;
  const 제목 = 고르기(m[1]);
  return { 종류: '트랙', 번호, 제목, 이름: 첫마디(제목), 유호님차례: /^## 1\. 유호님 차례/.test(절 || ''), 줄, 길: 줄길들(줄, 'docs/_ops/트랙.md') };
}

function 결정들(글) {
  const out = [];
  String(글 || '').split(/\r?\n/).forEach((l, i) => { const r = 결정행풀기(l, i + 1); if (r) out.push(r); });
  return out;
}

function 트랙들(글) {
  const out = [];
  let 절 = '';
  String(글 || '').split(/\r?\n/).forEach((l, i) => {
    if (/^## /.test(l)) 절 = l;
    const r = 트랙줄풀기(l, i + 1, 절);
    if (r) out.push(r);
  });
  return out;
}

const 이스케이프 = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const 바늘틀 = (곳) => new RegExp(`(?:^|[^A-Za-z0-9가-힣_.-])${이스케이프(곳)}(?=$|[/\\s)\`#:,'"\\]|])`);
/** 행 · 줄이 그 곳의 경로를 품나 — 글자로 품거나, 풀어 낸 링크가 그 곳 안이거나. */
const 경로품음 = (r, 곳) => 바늘틀(곳).test(r.줄) || r.길.some((p) => p === 곳 || p.startsWith(`${곳}/`));

/** 곳 → 이름 집합(그 곳의 경로를 품은 결정 행 · 트랙 줄의 첫 마디). */
function 이름모으기(곳, 행들) {
  const 이름 = new Set();
  for (const r of 행들) if (r.이름 && 경로품음(r, 곳)) 이름.add(r.이름);
  return 이름;
}

function 이름맞음(a, 이름들) {
  if (!a) return false;
  for (const n of 이름들) {
    if (n === a) return true;
    const [짧, 긴] = 글자수(n) <= 글자수(a) ? [n, a] : [a, n];
    if (글자수(짧) >= 4 && 긴.startsWith(`${짧} `)) return true;
  }
  return false;
}

/** 행 · 줄이 그 곳들 가운데 하나와 이어지나 — 이어진 곳(없으면 null). */
function 이어진곳(r, 곳들, 이름표) {
  for (const 곳 of 곳들) if (경로품음(r, 곳)) return 곳;
  for (const 곳 of 곳들) if (이름맞음(r.이름, 이름표.get(곳) || new Set())) return 곳;
  return null;
}

// ── 글 조각 대조 ─────────────────────────────────────────────────────────

/** 다른 글에 그대로 들어 있을 만한 조각 — 따옴표 · 백틱 · 역슬래시가 없는 16자 넘는 토막의 40자(끝에서 찾으면 끝 토막). JSON 기록에 맞게 이스케이프한다. */
function 바늘(글, { 끝 = false } = {}) {
  const 토막 = [...String(글 || '').matchAll(/[^`"'\\$\n|*[\]]{16,}/g)].map((m) => m[0].trim()).filter((t) => [...t].length >= 16);
  if (!토막.length) return null;
  const t = 끝 ? 토막[토막.length - 1] : 토막[0];
  const g = [...t];
  return JSON.stringify((끝 ? g.slice(-40) : g.slice(0, 40)).join('')).slice(1, -1);
}

const 들었나 = (곳글, 조각) => !!조각 && 곳글.includes(조각);

// ── git ──────────────────────────────────────────────────────────────────

function git만들기(뿌리) {
  return (args) => execFileSync('git', ['-C', 뿌리, ...args], { encoding: 'utf8', timeout: 5000, maxBuffer: 64 * 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
}

function 판읽기(git, 판, 경로) { try { return git(['show', `${판}:${경로}`]); } catch { return ''; } }

function 그때판(git, 판, 때) {
  try { return git(['rev-list', '-1', '--first-parent', `--before=${때}`, 판]).trim() || null; } catch { return null; }
}

function 커밋들(git, 기준, 판, 곳들) {
  if (!곳들.length) return [];
  let 글 = '';
  try { 글 = git(['log', '--format=%H%x1f%ct%x1f%s', '--no-merges', 기준 ? `${기준}..${판}` : 판, '-n', '300', '--', ...곳들]); } catch { return []; }
  return 글.split('\n').filter(Boolean).map((l) => { const [해시, ct, 제목] = l.split('\x1f'); return { 해시, 때: Number(ct) * 1000, 제목: 제목 || '' }; });
}

function 판때(git, 판) { try { return Number(git(['show', '-s', '--format=%ct', 판]).trim()) * 1000 || null; } catch { return null; } }

/** 운영 사본이 origin을 마지막으로 받은 때(FETCH_HEAD) — 모르면 null. */
function 받은때(git, 뿌리) {
  try {
    const p = git(['rev-parse', '--git-path', 'FETCH_HEAD']).trim();
    return fs.statSync(path.isAbsolute(p) ? p : path.join(뿌리, p)).mtimeMs;
  } catch { return null; }
}

// ── 고르기 · 글 ──────────────────────────────────────────────────────────

const 한국 = (ms) => new Date(ms + 9 * 36e5).toISOString().slice(5, 16).replace('T', ' ');
const 자르기 = (s, n) => { const g = [...고르기(s)]; return g.length > n ? `${g.slice(0, n - 1).join('')}…` : g.join(''); };

function 트랙글(r) {
  const 몸 = r.줄.replace(/^\s*- \*\*.+?\*\*\s*/, '');
  const 남은 = /남은 일\s*[:：]\s*(.+)$/.exec(몸);
  const 끝난 = /끝난 [^:：—]{0,12}[:：—]\s*([^.。]+)/.exec(몸);
  const 조각 = [];
  if (끝난) 조각.push(`끝난 것: ${자르기(끝난[1], 110)}`);
  if (남은) 조각.push(`남은 일: ${자르기(남은[1], 130)}`);
  if (!조각.length) 조각.push(자르기(몸.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'), 100));
  return 자르기(`트랙.md:${r.번호} ${자르기(r.제목, 100)} · ${조각.join(' · ')}`, 300);
}

function 결정글(r) {
  const 본문 = r.결정.replace(/^\[[^\]]*\]\s*/, '');
  return `${r.날.slice(5)} ${r.태그 ? `[${자르기(r.태그, 45)}] ` : ''}${자르기(본문, 60)} (결정.md:${r.번호})`;
}

const 남은일물음 = /남은|나머지|얼마나 걸|일정|다음(?:에|은| 할| 단계)|뭐 하면|내가 할|유호님 차례|할 일|어디까지|진행 상황|다 끝났|언제 끝/;

/**
 * 핵심 — 무엇을 넣을지. 입력은 이미 읽은 것들이라 시험과 되짚기가 그대로 부른다.
 *   방식 '시작'(SessionStart) | '말'(UserPromptSubmit). 다시: 남은 일을 묻는 말 — 바뀌지 않은 트랙 줄도 넣는다.
 */
function 고를것({ 방식, 세션, 곳들, 결정지금, 결정기준, 트랙지금, 트랙기준, 커밋목록, 다시 = false }) {
  if (!곳들.length) return null;
  const 결정행 = 결정들(결정지금), 트랙줄 = 트랙들(트랙지금);
  const 이름표 = new Map(곳들.map((곳) => [곳, 이름모으기(곳, [...결정행, ...트랙줄])]));
  const 기준열쇠 = new Set(결정들(결정기준).map((r) => r.열쇠));
  const 기준트랙 = new Set(String(트랙기준 || '').split(/\r?\n/));
  const 문맥에 = (글, 끝도) => 들었나(세션.문맥글, 바늘(글)) && (!끝도 || 들었나(세션.문맥글, 바늘(글, { 끝: true })));

  const 트랙후보 = [];
  for (const r of 트랙줄) {
    const 곳 = 이어진곳(r, 곳들, 이름표);
    if (!곳 || 문맥에(r.줄, true)) continue;
    const 바뀜 = !기준트랙.has(r.줄);
    if (방식 === '말' && !바뀜 && !다시) continue;
    const 끝남 = /남은 일\s*[:：]\s*없음\s*\.?\s*$/.test(r.줄);
    트랙후보.push({ r, 곳, 점: (곳 === 곳들[0] ? 4 : 0) + (바뀜 ? 2 : 0) + (끝남 ? -6 : 0) });
  }
  트랙후보.sort((a, b) => b.점 - a.점 || b.r.번호 - a.r.번호);

  const 결정후보 = [];
  for (const r of 결정행) {
    if (기준열쇠.has(r.열쇠)) continue;
    const 곳 = 이어진곳(r, 곳들, 이름표);
    if (!곳 || 문맥에(r.결정)) continue;
    결정후보.push({ r, 곳 });
  }
  결정후보.sort((a, b) => b.r.날.localeCompare(a.r.날) || a.r.번호 - b.r.번호);

  const 커밋후보 = (커밋목록 || []).filter((c) => !세션.문맥글.includes(c.해시.slice(0, 9))).sort((a, b) => b.때 - a.때);
  if (!트랙후보.length && !결정후보.length && !커밋후보.length) return null;
  return { 곳들, 유호님: 트랙후보.filter((x) => x.r.유호님차례), 트랙: 트랙후보.filter((x) => !x.r.유호님차례), 결정: 결정후보, 커밋: 커밋후보 };
}

function 글만들기(고름, { 판, 판시각, 방식 = '시작' }) {
  const 상한 = 글상한[방식] || 글상한.시작;
  const 머리말 = `${MARK} 이 세션이 고치던 곳(${고름.곳들.join(' · ')})의 지금 기록이다(tools/지금상태.js, origin ${String(판 || '').slice(0, 9)}${판시각 ? ` · ${한국(판시각)}` : ''}). 설계 문서의 일정표 · 여쭐 것 표나 압축 요약보다 이것이 새것이다. 남은 일이나 유호님 차례를 말하기 전에 이것과 맞춘다.`;
  const 줄 = [머리말];
  let 길이 = [...머리말].length;
  const 넣기 = (제목, 항목들, 글로) => {
    if (!항목들.length) return;
    const 머 = 제목(항목들.length);
    if (길이 + [...머].length + 40 > 상한) return;
    줄.push(머); 길이 += [...머].length + 1;
    let n = 0;
    for (const x of 항목들) {
      const t = `· ${글로(x)}`;
      if (길이 + [...t].length + 20 > 상한) break;
      줄.push(t); 길이 += [...t].length + 1; n++;
    }
    if (n < 항목들.length) { const t = `· … ${항목들.length - n}개 더`; 줄.push(t); 길이 += [...t].length + 1; }
  };
  넣기((n) => `유호님 차례(트랙 1절) — 이 곳으로 적힌 것은 이 ${n}줄이다:`, 고름.유호님, (x) => 트랙글(x.r));
  넣기(() => '트랙의 지금 줄:', 고름.트랙, (x) => 트랙글(x.r));
  넣기((n) => `${방식 === '말' ? '마지막으로 넣은 뒤' : '세션 시작 뒤'} 생긴 결정 행 ${n}개(이 세션이 쓴 것 포함):`, 고름.결정, (x) => 결정글(x.r));
  if (고름.커밋.length) {
    const t = `이 곳에 올라온 커밋 ${고름.커밋.length}개, 최근: ${고름.커밋.slice(0, 3).map((c) => `${c.해시.slice(0, 9)} ${한국(c.때)} ${자르기(c.제목, 50)}`).join(' / ')}`;
    if (길이 + [...t].length <= 상한) { 줄.push(t); 길이 += [...t].length + 1; }
  }
  const 보기 = (고름.유호님[0] || 고름.트랙[0]) ? `docs/_ops/트랙.md:${(고름.유호님[0] || 고름.트랙[0]).r.번호}` : 고름.결정[0] ? `docs/_ops/결정.md:${고름.결정[0].r.번호}` : null;
  if (보기 && 길이 < 상한 - 60) 줄.push(`줄 전체: node tools/기록찾기.js --줄 ${보기}`);
  return 줄.length > 1 ? 줄.join('\n') : null;
}

// ── 상태 파일 · 기록 ─────────────────────────────────────────────────────

function 상태길(id) { return path.join(상태폴더(), `${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}.json`); }
function 상태읽기(id) { try { return JSON.parse(fs.readFileSync(상태길(id), 'utf8')); } catch { return {}; } }
function 상태쓰기(id, s) { try { fs.mkdirSync(상태폴더(), { recursive: true }); fs.writeFileSync(상태길(id), JSON.stringify(s)); } catch { /* 상태를 못 써도 멈추지 않는다 */ } }

/** 훅마다 한 줄 — 「돌았다」와 「넣을 것이 없었다」를 가른다(D9). 하루 한 번 14일 지난 상태 파일을 지운다. */
function 기록남기기(줄) {
  try {
    const 폴더 = 상태폴더();
    fs.mkdirSync(폴더, { recursive: true });
    fs.appendFileSync(path.join(폴더, '기록.jsonl'), `${JSON.stringify(줄)}\n`);
    const 표 = path.join(폴더, '.치움');
    let 앞 = 0;
    try { 앞 = fs.statSync(표).mtimeMs; } catch { /* 처음 */ }
    if (Date.now() - 앞 > 864e5) {
      fs.writeFileSync(표, '');
      for (const f of fs.readdirSync(폴더)) {
        if (!f.endsWith('.json')) continue;
        const p = path.join(폴더, f);
        if (Date.now() - fs.statSync(p).mtimeMs > 14 * 864e5) fs.rmSync(p, { force: true });
      }
      const 기록 = path.join(폴더, '기록.jsonl');
      if (fs.statSync(기록).size > 8 * 1024 * 1024) fs.writeFileSync(기록, fs.readFileSync(기록, 'utf8').split('\n').slice(-20000).join('\n'));
    }
  } catch { /* 기록을 못 남겨도 멈추지 않는다 */ }
}

// ── 한 번 돌기 ───────────────────────────────────────────────────────────

const synk세션인가 = (cwd) => 저장소안(cwd) != null;

/**
 * 한 번 — { 글, 상태, 고름, 까닭 } (글이 없으면 null). 되짚기와 시험이 「지금」 · 기록 · 판 · 상태를 넣어 부른다.
 *   기록: [{o, raw}] (그때까지, 끝 24MB), 시작때: 세션 첫 시각, 판: 지금 판(커밋), git: git 함수, 말: 사람 말(새 말일 때).
 */
function 한번({ 사건, source, 기록, 시작때, 지금, 판, 판시각 = null, git, 상태 = {}, 말 = '' }) {
  const 방식 = 사건 === 'UserPromptSubmit' ? '말' : '시작';
  const 새상태 = { ...상태 };
  const 시작 = Date.parse(시작때 || '') || 지금;
  const 다시 = 방식 === '말' && 남은일물음.test(String(말 || '')) && !(Date.parse(상태.넣은때 || '') > 지금 - 다시넣기간격);
  if (방식 === '말') {
    if (Date.parse(상태.본때 || '') > 지금 - 말간격 && !다시) return { 글: null, 상태: 새상태, 까닭: '간격' };
    // 곳 · 결정 표 · 트랙이 마지막으로 본 판 뒤로 바뀌지 않았으면 기록을 읽지 않는다
    if (상태.본판 && Array.isArray(상태.곳들) && 상태.곳들.length && !다시) {
      let 바뀐 = 'x';
      try { 바뀐 = git(['diff', '--name-only', `${상태.본판}..${판}`, '--', ...상태.곳들, 'docs/_ops/결정.md', 'docs/_ops/트랙.md']).trim(); } catch { 바뀐 = 'x'; }
      if (!바뀐) { 새상태.본때 = new Date(지금).toISOString(); 새상태.본판 = 판; return { 글: null, 상태: 새상태, 까닭: '바뀐 것 없음' }; }
    }
  }
  새상태.본때 = new Date(지금).toISOString();
  새상태.본판 = 판;
  // 압축 직후(compact)와 첫 시작에는 새 경계 줄이 아직 기록에 없다 — 앞 문맥을 「지금 문맥」으로 보면 방금 잊은 것을 뺀다(D1)
  const 세션 = 세션읽기(기록, { 문맥비움: 방식 === '시작' && source !== 'resume' });
  const 곳들 = 곳찾기(세션.도구들).map((x) => x.곳);
  새상태.곳들 = 곳들;
  if (!곳들.length) return { 글: null, 상태: 새상태, 까닭: '곳 없음' };
  const 기준때 = 방식 === '말' ? (Date.parse(상태.넣은때 || '') || Date.parse(세션.지난주입 || '') || 시작) : 시작;
  const 기준 = 그때판(git, 판, new Date(기준때).toISOString());
  const 고름 = 고를것({
    방식, 세션, 곳들, 다시,
    결정지금: 판읽기(git, 판, 'docs/_ops/결정.md'), 결정기준: 기준 ? 판읽기(git, 기준, 'docs/_ops/결정.md') : '',
    트랙지금: 판읽기(git, 판, 'docs/_ops/트랙.md'), 트랙기준: 기준 ? 판읽기(git, 기준, 'docs/_ops/트랙.md') : '',
    커밋목록: 커밋들(git, 기준, 판, 곳들),
  });
  const 글 = 고름 ? 글만들기(고름, { 판, 판시각, 방식 }) : null;
  if (!글) return { 글: null, 상태: 새상태, 까닭: '넣을 것 없음' };
  새상태.넣은때 = new Date(지금).toISOString();
  return { 글, 상태: 새상태, 고름, 까닭: '넣음' };
}

function 훅(input) {
  const 처음 = Date.now();
  if (!input || !synk세션인가(input.cwd) || !input.transcript_path || !input.session_id) return null;
  const 사건 = input.hook_event_name === 'UserPromptSubmit' ? 'UserPromptSubmit' : 'SessionStart';
  if (사건 === 'SessionStart' && input.source === 'clear') return null;
  const 상태 = 상태읽기(input.session_id);
  const 지금 = Date.now();
  const 다시 = 사건 === 'UserPromptSubmit' && 남은일물음.test(String(input.prompt || ''));
  // 새 말의 간격은 git · 기록을 읽기 전에 본다 — 대부분의 말은 node 시작만으로 끝난다
  if (사건 === 'UserPromptSubmit' && Date.parse(상태.본때 || '') > 지금 - 말간격 && !(다시 && !(Date.parse(상태.넣은때 || '') > 지금 - 다시넣기간격))) return null;
  const 뿌리 = 저장소뿌리();
  const git = git만들기(뿌리);
  const 줄 = { 때: new Date(지금).toISOString(), 세션: String(input.session_id).slice(0, 8), 사건, source: input.source || null };
  let r;
  try {
    const 판 = git(['rev-parse', 'HEAD']).trim();
    const 받음 = process.env.SYNK_지금상태_받은때검사 === '0' ? null : 받은때(git, 뿌리);
    if (받음 && 지금 - 받음 > 낡은판 && 사건 === 'SessionStart') {
      r = { 글: `${MARK} 운영 사본이 ${한국(받음)} 뒤로 origin을 따라가지 못해 이 세션 일의 지금 기록을 넣지 못했다. 남은 일이나 유호님 차례를 말하기 전에 node tools/기록찾기.js <일 이름>으로 직접 본다.`, 상태: { ...상태, 본때: new Date(지금).toISOString() }, 까닭: '운영 사본 낡음' };
    } else {
      r = 한번({ 사건, source: input.source, 기록: 기록풀기(끝읽기(input.transcript_path)), 시작때: 첫시각(input.transcript_path), 지금, 판, 판시각: 판때(git, 판), git, 상태, 말: input.prompt });
    }
  } catch (e) {
    기록남기기({ ...줄, ms: Date.now() - 처음, 오류: String(e && e.message || e).slice(0, 200) });
    return null;
  }
  상태쓰기(input.session_id, r.상태);
  const 수 = r.고름 ? { 유호님: r.고름.유호님.length, 트랙: r.고름.트랙.length, 결정: r.고름.결정.length, 커밋: r.고름.커밋.length } : null;
  기록남기기({ ...줄, ms: Date.now() - 처음, 까닭: r.까닭, 곳: (r.상태.곳들 || []).join(' · ') || null, 수, 글자: r.글 ? [...r.글].length : 0 });
  return r.글 ? { 사건, 글: r.글 } : null;
}

// ── 되짚기 ───────────────────────────────────────────────────────────────

function 사람말(o) {
  if (o.type !== 'user' || o.isSidechain || !o.message) return null;
  const c = o.message.content;
  const 글 = typeof c === 'string' ? c : Array.isArray(c) && !c.some((b) => b && b.type === 'tool_result') ? c.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n') : '';
  const t = String(글 || '').trim();
  return t && !t.startsWith('<') && !/^This session is being continued/.test(t) ? t : null;
}

function 되짚기(파일, { 판이름 = 'origin/master', 뿌리 = 저장소뿌리() } = {}) {
  const 전체 = 기록풀기(fs.readFileSync(파일, 'utf8'));
  const git = git만들기(뿌리);
  const 시작때 = (전체.find((r) => r.o.timestamp) || {}).o?.timestamp;
  const 사건들 = [];
  전체.forEach((r, i) => {
    if (r.o.isSidechain || !r.o.timestamp) return;
    if (r.o.type === 'system' && r.o.subtype === 'compact_boundary') 사건들.push({ i, 때: r.o.timestamp, 사건: 'SessionStart', source: 'compact' });
    else { const 말 = 사람말(r.o); if (말) 사건들.push({ i, 때: r.o.timestamp, 사건: 'UserPromptSubmit', 말 }); }
  });
  let 상태 = {};
  const 넣음 = [];   // 되짚기에서 넣은 글 — 그 뒤 문맥 대조에 보이게 기록에 끼운다
  const 결과 = [];
  for (const e of 사건들) {
    // 압축 훅은 경계 줄이 적히기 전에 돈다 — 경계 줄 앞까지만 준다(D1). 훅처럼 기록 끝 24MB만 본다.
    let 끝 = e.i, 첫 = 끝, 바이트 = 0;
    while (첫 > 0 && 바이트 + 전체[첫 - 1].raw.length <= TAIL_BYTES) 바이트 += 전체[--첫].raw.length;
    const 앞 = [];
    for (let k = 첫; k < 끝; k++) { 앞.push(전체[k]); for (const x of 넣음) if (x.자리 === k) 앞.push(x.r); }
    const 지금 = Date.parse(e.때);
    const 판 = 그때판(git, 판이름, e.때);
    if (!판) continue;
    const r = 한번({ 사건: e.사건, source: e.source, 기록: 앞, 시작때, 지금, 판, 판시각: 판때(git, 판), git, 상태, 말: e.말 });
    상태 = r.상태;
    if (r.글) {
      결과.push({ 때: e.때, 사건: e.사건 === 'SessionStart' ? '압축 뒤' : '사람 말', 판, 글: r.글, 말: e.말 });
      const o = { type: 'attachment', timestamp: e.때, attachment: { type: 'hook_additional_context', content: [r.글] } };
      넣음.push({ 자리: e.i, r: { o, raw: JSON.stringify(o) } });
    }
  }
  return 결과;
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--되짚기') {
    const 파일 = args[1];
    if (!파일 || !fs.existsSync(파일)) { console.error('기록 파일을 준다 — node tools/지금상태.js --되짚기 <기록.jsonl> [--판 origin/master]'); return 2; }
    const k = args.indexOf('--판');
    const 결과 = 되짚기(파일, { 판이름: k >= 0 ? args[k + 1] : 'origin/master' });
    if (!결과.length) console.log('넣은 것이 없다.');
    for (const x of 결과) console.log(`── ${한국(Date.parse(x.때))} ${x.사건}${x.말 ? ` 「${자르기(x.말, 40)}」` : ''} (판 ${x.판.slice(0, 9)})\n${x.글}\n`);
    return 0;
  }
  let input = null;
  try { input = JSON.parse(fs.readFileSync(0, 'utf8') || 'null'); } catch { input = null; }
  let r = null;
  try { r = 훅(input); } catch { r = null; }
  if (r) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: r.사건, additionalContext: r.글 } }));
  return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { MARK, 훅, 한번, 고를것, 글만들기, 세션읽기, 곳찾기, 곳으로, 저장소상대, 저장소안, 명령경로들, 기록풀기, 결정들, 트랙들, 첫마디, 이름맞음, 바늘, 줄길들, 되짚기, 남은일물음 };
