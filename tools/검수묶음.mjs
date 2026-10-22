#!/usr/bin/env node
// 화면·백엔드 검수 묶음(2026-10-21). docs/AI_운영원칙.md 「백엔드 검수」·「화면 검수」의 아르곤(백엔드는 GPT도) → Fable 검수에 넘길 자료를 한 명령으로 묶고,
// 받은 답을 입력 SHA·끝 표식·읽은 항목으로 대조해 지적표·Fable 요약·「아르곤 N건(반영 M) · GPT N건(반영 M) · Fable N건(반영 M)」 집계를 만든다.
// 새 LLM 실행기가 아니다 — 아르곤은 tools/lib/제미나이구독호출.js의 부르기를, GPT는 공식 Codex CLI(`codex exec`, 주간 몫이 넉넉한 Pro 계정)를 묶음마다 한 번 부르고
// (되풀이·다른 모델로 대체 없음, 다시 보내기는 사람이 --다시로), Fable은 세션이 Agent 도구(model: fable)에 fable.md를 준다. 틀은 tools/topik-review.mjs를 본떴다.
//
//   node tools/검수묶음.mjs 준비 <이름> --종류 화면|백엔드 --바탕 <커밋> [<경로…>] [준비 옵션]   아르곤 묶음·전후 캡처·시험 TAP·Fable 요약
//   node tools/검수묶음.mjs 아르곤 <이름> [--수준 high|medium] [--묶음 A …] [--다시]       묶음마다 하나씩 보내고 입력 SHA·끝 표식·읽은 항목을 대조
//   node tools/검수묶음.mjs GPT <이름> [--수준 high|xhigh…] [--묶음 A …] [--다시]          백엔드 2차 검수의 GPT 몫(2026-10-22) — 같은 묶음·같은 대조, 아르곤과 함께 돌려도 된다
//   node tools/검수묶음.mjs 처리 <이름> <번호>=<반영|일부|안함|재현안됨|후속>[:<이유>] … [<번호>=재확인]   지적마다 Claude의 처리를 적는다
//   node tools/검수묶음.mjs 페이블 <이름> [--시험안함] [--캡처안함]      고친 뒤 상태로 diff·시험·캡처를 다시 떠 fable.md를 쓴다
//   node tools/검수묶음.mjs 페이블받기 <이름> [<답 파일>] [--새로]     Fable 답의 JSON 지적을 지적표에 F1…로 넣는다
//   node tools/검수묶음.mjs 집계 <이름>                                  아르곤·Fable N건(반영 M)·반영 안 한 이유·배포 조건(보고.md)
//   준비 옵션: --끝 <커밋>(기본 작업본) · --저장소 <git 폴더>(기본 이 저장소) · --경로 <경로…> · --배경 <파일> · --곁 <경로[:시작-끝]>…
//     --시험 <파일·글롭…> | --시험결과 <tap> · --화면 [<이름>=]<주소·저장소 경로>[|<후 주소>]… · --장면 <파일.mjs> · --주소뿌리 <주소>=<저장소 경로>…
//     --시각 <ISO> · --캡처 <폴더> · --뺌 <glob…> · --넣음 <glob…> · --크기 <바이트>(기본 150000) · --폴더 <출력>
//   경로는 이름 바로 뒤에 두거나 --경로로 준다(목록 옵션 뒤의 낱말은 그 목록에 든다).
//   <이름>의 폴더는 <공용 작업본>/.tmp/검수/<이름>/ 이다(워크트리를 보관해도 남는다). 다음 명령에는 이름이나 폴더 경로를 준다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as 캡처도구 from './lib/검수캡처.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ARGON = { model: 'gemini-4-argon' };
// 한 묶음 바이트(머리말 포함) — 10-18 한 번에 넘긴 745KB가 뒷부분이 잘려 0건이었고 190KB 언저리에서도 잘렸다(현장 노트 AI_CLI).
export const 기본크기 = 150_000;
// 코드 묶음은 medium으로 먼저(high 코드 묶음이 답 없이 끝난 적이 있다 — 운영 원칙 「백엔드 검수」), 화면은 high(10-20 PULSE 세 묶음 4~6분).
export const 기본수준 = { 화면: 'high', 백엔드: 'medium' };
const 제한분 = { high: 25, medium: 20, low: 15 };
const 긴줄 = 400;    // 바뀐 줄이 이보다 길면 낱말 diff — 템플릿 문자열 한 줄에 화면 하나가 든 파일(10-20 화면 검수 첫 회 376KB)
const 기본뺌 = ['**/node_modules/**', '**/dist/**', '**/generated/**', '**/*.min.js', '**/*.min.css', '**/*.map', '**/package-lock.json'];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n'); fs.renameSync(tmp, file); };
const 글쓰기 = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const 바이트 = s => Buffer.byteLength(s, 'utf8');
const 슬래시 = p => p.split(path.sep).join('/');
const 줄임 = (s, n) => (s.length > n ? `${s.slice(0, Math.floor(n / 2))} …(${s.length - n}자 줄임)… ${s.slice(-Math.floor(n / 2))}` : s);

// ── git ────────────────────────────────────────────────────────────
function gitRaw(args, { cwd = root, buffer = false } = {}) {
  return spawnSync('git', ['-c', 'core.quotepath=off', ...args], { cwd, maxBuffer: 1 << 29, windowsHide: true, ...(buffer ? {} : { encoding: 'utf8' }) });
}
export function git(args, opts = {}) {
  const r = gitRaw(args, opts);
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`git ${args.slice(0, 3).join(' ')} 실패(${r.status}): ${String(r.stderr || '').trim().slice(0, 400)}`);
  return r.stdout;
}
export function 공용작업본(cwd = root) {
  const r = gitRaw(['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd });
  const common = r.status === 0 ? r.stdout.trim() : '';
  return common && path.basename(common) === '.git' ? path.dirname(common) : cwd;
}
function 워크트리인가(cwd) {
  const r = gitRaw(['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'], { cwd });
  if (r.status !== 0) return false;
  const [a, b] = r.stdout.trim().split('\n');
  return path.resolve(a) !== path.resolve(b);
}
export function 폴더찾기(이름, 폴더 = null) {
  if (폴더) return path.resolve(폴더);
  if (!이름) throw new Error('이름이 필요하다');
  if (/[\\/]/.test(이름) || fs.existsSync(path.join(path.resolve(이름), '묶음.json'))) return path.resolve(이름);
  if (/[:*?"<>|]/.test(이름)) throw new Error(`이름에 쓸 수 없는 글자가 있다: ${이름}`);
  return path.join(process.env.SYNK_REVIEW_DIR || path.join(공용작업본(), '.tmp', '검수'), 이름);
}
function 커밋풀기(rev, cwd) {
  const 커밋 = git(['rev-parse', '--verify', `${rev}^{commit}`], { cwd }).trim();
  return { 커밋, 제목: git(['log', '-1', '--format=%s', 커밋], { cwd }).trim() };
}
const 범위 = 설정 => [설정.바탕.커밋, ...(설정.끝 === '작업본' ? [] : [설정.끝.커밋])];

/** git diff --name-status -z (-M). 이름 바뀜·복사는 옛 경로·새 경로 두 칸. */
export function 이름상태읽기(z) {
  const t = z.split('\0'), out = [];
  for (let i = 0; i < t.length;) {
    const s = t[i++];
    if (!s) continue;
    if (/^[RC]/.test(s)) out.push({ 상태: s[0], 옛경로: t[i++], 경로: t[i++] });
    else out.push({ 상태: s[0], 경로: t[i++] });
  }
  return out;
}
/** git diff --numstat -z (-M). 이진은 「-」, 이름 바뀜은 빈 경로 뒤에 옛 경로·새 경로. */
export function 줄수읽기(z) {
  const t = z.split('\0'), m = new Map();
  for (let i = 0; i < t.length;) {
    const tok = t[i++];
    if (!tok) continue;
    const r = /^(-|\d+)\t(-|\d+)\t([\s\S]*)$/.exec(tok);
    if (!r) continue;
    let p = r[3];
    if (p === '') { i++; p = t[i++]; }
    m.set(p, { 더함: r[1] === '-' ? null : Number(r[1]), 뺌: r[2] === '-' ? null : Number(r[2]), 이진: r[1] === '-' });
  }
  return m;
}
export function glob식(g) {
  let s = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') { i++; if (g[i + 1] === '/') { i++; s += '(?:.*/)?'; } else s += '.*'; }
    else if (c === '*') s += '[^/]*';
    else if (c === '?') s += '[^/]';
    else s += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${s}$`);
}
const 맞나 = (p, globs) => globs.some(g => glob식(g).test(p));

export function 바뀐파일들({ 바탕, 끝 = '작업본', 경로 = [], cwd = root }) {
  const 판 = [바탕, ...(끝 === '작업본' ? [] : [끝])];
  const 거름 = ['--', ...(경로.length ? 경로 : ['.'])];
  const 목록 = 이름상태읽기(git(['diff', '--name-status', '-z', '-M', ...판, ...거름], { cwd }));
  const 수 = 줄수읽기(git(['diff', '--numstat', '-z', '-M', ...판, ...거름], { cwd }));
  for (const f of 목록) Object.assign(f, 수.get(f.경로) || { 더함: null, 뺌: null, 이진: false });
  if (끝 === '작업본') for (const p of git(['ls-files', '--others', '--exclude-standard', '-z', ...거름], { cwd }).split('\0').filter(Boolean)) {
    const b = fs.readFileSync(path.join(cwd, p));
    const 이진 = b.subarray(0, 8000).includes(0);
    목록.push({ 상태: 'A', 경로: p, 추적안됨: true, 이진, 더함: 이진 ? null : b.toString('utf8').replace(/\n$/, '').split('\n').length, 뺌: 0 });
  }
  return 목록.sort((a, b) => (a.경로 < b.경로 ? -1 : a.경로 > b.경로 ? 1 : 0));
}

/** 긴 줄 파일의 바뀐 낱말만 앞뒤 맥락과 함께(git diff --word-diff=porcelain -U0). 한 항목 「[파일:줄] …앞 [-옛-]{+새+} 뒤…」. */
export function 낱말줄이기(porcelain, { 맥락 = 70, 파일이름 = null, 조각최대 = 2000 } = {}) {
  let file = 파일이름, line = 0, segs = [];
  const out = [];
  const cut = (s, where) => {
    if (s.length <= 맥락 * 2 + 5) return s;
    if (where === 'head') return s.slice(0, 맥락) + ' …';
    if (where === 'tail') return '… ' + s.slice(-맥락);
    return s.slice(0, 맥락) + ' … ' + s.slice(-맥락);
  };
  const flush = () => {
    if (!segs.some(s => s.t !== ' ')) { segs = []; return; }
    let txt = '';
    segs.forEach((s, i) => {
      if (s.t === ' ') txt += cut(s.v, i === 0 ? 'tail' : i === segs.length - 1 ? 'head' : 'mid');
      else if (s.t === '-') txt += `[-${줄임(s.v, 조각최대)}-]`;
      else txt += `{+${줄임(s.v, 조각최대)}+}`;
    });
    out.push(`[${file}:${line}] ${txt.replace(/\s+/g, ' ').trim()}`);
    segs = [];
  };
  for (const l of porcelain.replace(/\r\n/g, '\n').split('\n')) {
    if (l.startsWith('diff --git')) { flush(); continue; }
    if (l.startsWith('+++ ')) { if (!파일이름) file = l.slice(4).replace(/^b\//, ''); continue; }
    if (/^(--- |index |new file|deleted file|similarity|rename |old mode|new mode)/.test(l)) continue;
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l);
    if (h) { flush(); line = Number(h[1]); continue; }
    if (l === '~') { flush(); line++; continue; }
    if (!l) continue;
    segs.push({ t: l[0], v: l.slice(1) });
  }
  flush();
  return out;
}

const 머리줄 = /^(diff --git|index |--- |\+\+\+ |similarity index|dissimilarity index|rename from|rename to|copy from|copy to|new file mode|deleted file mode|old mode|new mode)/;
/** 한 파일의 diff 글: unified(앞뒤 5줄) · 긴 줄이면 낱말 · 추적 안 된 새 파일은 + 줄로. 아주 긴 줄은 가운데를 줄인다. */
export function 파일diff(f, 설정) {
  const cwd = 설정.저장소;
  const 긴줄줄임 = l => (l.length > 3000 ? 줄임(l, 3000) : l);
  if (f.추적안됨) {
    const 줄들 = fs.readFileSync(path.join(cwd, f.경로), 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
    return { 꼴: '새 파일', 글: [`@@ -0,0 +1,${줄들.length} @@`, ...줄들.map(l => '+' + 긴줄줄임(l))].join('\n') };
  }
  const 경로들 = f.옛경로 ? [f.옛경로, f.경로] : [f.경로];
  const 몸 = git(['diff', '-U5', '--no-color', '-M', ...범위(설정), '--', ...경로들], { cwd }).replace(/\r\n/g, '\n')
    .split('\n').filter(l => !머리줄.test(l)).join('\n').trim();
  if (f.상태 === 'M' && 몸.split('\n').some(l => /^[+-]/.test(l) && l.length > 긴줄)) {
    // 낱말 = 글자 덩이 또는 문장 부호 하나. 띄어쓰기로만 자르면 띄어쓰기 없는 템플릿 한 줄이 통째로 한 낱말이 된다.
    const 낱말 = 낱말줄이기(git(['diff', '--word-diff=porcelain', '--word-diff-regex=[^[:space:][:punct:]]+|[[:punct:]]', '-U0', '--no-color', ...범위(설정), '--', ...경로들], { cwd }), { 파일이름: path.posix.basename(f.경로) });
    return { 꼴: '낱말', 글: 낱말.join('\n') };
  }
  return { 꼴: 'diff', 글: 몸.split('\n').map(긴줄줄임).join('\n') };
}

/** Fable이 읽는 전체 diff(추적 안 된 새 파일 포함). */
function 전체diff(설정, 파일들) {
  const 거름 = ['--', ...(설정.경로.length ? 설정.경로 : ['.'])];
  let 글 = git(['diff', '--no-color', '-M', ...범위(설정), ...거름], { cwd: 설정.저장소 }).replace(/\r\n/g, '\n');
  for (const f of 파일들.filter(x => x.추적안됨 && !x.이진)) {
    const d = 파일diff(f, 설정);
    글 += `diff --git a/${f.경로} b/${f.경로}\nnew file (추적 안 됨)\n--- /dev/null\n+++ b/${f.경로}\n${d.글}\n`;
  }
  return 글;
}

function 커밋목록(설정) {
  const 끝 = 설정.끝 === '작업본' ? 'HEAD' : 설정.끝.커밋;
  const r = gitRaw(['log', '--no-color', '-n', '40', '--format=%h %s%n%b%x1e', `${설정.바탕.커밋}..${끝}`], { cwd: 설정.저장소 });
  if (r.status !== 0) return '';
  return r.stdout.split('\x1e').map(s => s.trim()).filter(Boolean).map(s => {
    const [첫, ...몸] = s.split('\n');
    const b = 몸.join(' ').replace(/\s+/g, ' ').trim();
    return `- ${첫}${b ? `\n  ${b.slice(0, 500)}${b.length > 500 ? '…' : ''}` : ''}`;
  }).join('\n');
}

// ── 시험 ───────────────────────────────────────────────────────────
/** node --test TAP: 셈과 실패한 시험(묶음 › 이름, 첫 오류 줄). 하위 시험 실패만 알리는 부모 줄은 뺀다. */
export function TAP요약(tap) {
  const 수 = k => { const m = new RegExp(`^# ${k} (\\d+)`, 'm').exec(tap); return m ? Number(m[1]) : null; };
  const 줄들 = tap.split(/\r?\n/), 실패 = [], 쌓임 = [];
  for (let i = 0; i < 줄들.length; i++) {
    const sub = /^(\s*)# Subtest: (.*)$/.exec(줄들[i]);
    if (sub) { const d = Math.floor(sub[1].length / 4); 쌓임.length = d; 쌓임[d] = sub[2].trim(); continue; }
    const m = /^(\s*)not ok \d+ - (.*)$/.exec(줄들[i]);
    if (!m || /#\s*(TODO|SKIP)\b/i.test(m[2])) continue;
    const yaml = [];
    let j = i + 1;
    if (/^\s*---\s*$/.test(줄들[j] || '')) { j++; while (j < 줄들.length && !/^\s*\.\.\.\s*$/.test(줄들[j])) yaml.push(줄들[j++]); }
    if (yaml.some(l => /failureType:\s*'?subtestsFailed/.test(l))) continue;
    const d = Math.floor(m[1].length / 4);
    const 이름 = [...쌓임.slice(0, d).filter(Boolean), m[2].trim()].join(' › ');
    const k = yaml.findIndex(l => /^\s*error:/.test(l));
    let 오류 = '';
    if (k >= 0) {
      const 첫 = yaml[k].replace(/^\s*error:\s*/, '');
      const 들여 = yaml[k].length - yaml[k].trimStart().length;
      const 뒤 = [];
      if (/^[|>][-+]?$/.test(첫.trim())) for (let x = k + 1; x < yaml.length && (yaml[x].length - yaml[x].trimStart().length > 들여 || !yaml[x].trim()); x++) 뒤.push(yaml[x].trim());
      오류 = (뒤.length ? 뒤 : [첫.replace(/^'|'$/g, '')]).filter(Boolean).slice(0, 4).join(' / ').slice(0, 400);
    }
    const 위치 = (yaml.find(l => /^\s*location:/.test(l)) || '').replace(/^\s*location:\s*/, '').replace(/^'|'$/g, '');
    실패.push({ 이름, 오류, 위치 });
  }
  return { 시험: 수('tests'), 통과: 수('pass'), 실패: 수('fail'), 건너뜀: 수('skipped'), 취소: 수('cancelled'), 할일: 수('todo'), 실패목록: 실패 };
}

export function 시험돌리기(대상, { cwd, 폴더, 이름 = '시험' }) {
  const tap = path.join(폴더, `${이름}.tap`);
  fs.mkdirSync(폴더, { recursive: true });
  const 임시뿌리 = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || os.homedir(), 'Temp') : os.tmpdir();
  fs.mkdirSync(임시뿌리, { recursive: true });
  const 임시 = fs.mkdtempSync(path.join(임시뿌리, 'sr-'));
  // 워크트리에서는 git 밖 로컬 자료를 읽는 시험이 빨개서 CI=1로 돌린다(현장 노트 시험·화면 확인). 임시 폴더는 짧은 경로(저장소 밖).
  const env = { ...process.env, TEMP: 임시, TMP: 임시, TMPDIR: 임시, ...(워크트리인가(cwd) ? { CI: '1' } : {}) };
  const 없음 = 대상.filter(t => !/[*?]/.test(t) && !fs.existsSync(path.resolve(cwd, t)));
  const 시작 = Date.now();
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...대상], { cwd, env, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 40 * 60 * 1000, windowsHide: true });
  fs.rmSync(임시, { recursive: true, force: true, maxRetries: 3 });
  const 글 = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8') : '';
  return { 명령: `node --test ${대상.join(' ')}${env.CI ? '  (CI=1)' : ''}`, 종료: r.status, 초: Math.round((Date.now() - 시작) / 1000), tap: path.basename(tap), 없는파일: 없음,
    ...(r.error ? { 오류: r.error.message } : {}), ...TAP요약(글) };
}
const 시험한줄 = t => `${t.명령} → 종료 ${t.종료 ?? '?'} · 시험 ${t.시험 ?? '?'} · 통과 ${t.통과 ?? '?'} · 실패 ${t.실패 ?? '?'} · 건너뜀 ${t.건너뜀 ?? '?'} · 취소 ${t.취소 ?? '?'}${t.초 != null ? ` · ${t.초}초` : ''}`;

// ── 화면 ───────────────────────────────────────────────────────────
/** --화면 [<이름>=]<대상>[|<후 대상>]: 대상은 주소(http·https)나 저장소 경로. 이름이 없으면 경로·주소에서 짓는다. */
export function 화면읽기(목록 = []) {
  const 쓴 = new Set();
  const 대상 = s => (/^https?:\/\//i.test(s) ? { 종류: '주소', 값: s } : { 종류: '경로', 값: s.replace(/\\/g, '/').replace(/^\.\//, '') });
  return 목록.map(spec => {
    const m = /^([^=/:?|]+)=(.+)$/.exec(spec);
    const [전, 후] = (m ? m[2] : spec).split('|');
    const 전대상 = 대상(전), 후대상 = 후 ? 대상(후) : 전대상;
    let 이름 = m ? m[1].trim() : (() => {
      const v = 후대상.값;
      if (후대상.종류 === '경로') { const 칸 = v.replace(/\/$/, '').split('/'); const 끝 = 칸.at(-1); return /^index\.html?$/i.test(끝) ? 칸.at(-2) || 'index' : 끝.replace(/\.[^.]+$/, ''); }
      const u = new URL(v); return u.pathname.replace(/\/$/, '').split('/').filter(Boolean).at(-1) || u.hostname;
    })();
    이름 = 이름.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || '화면';
    let 붙임 = 이름;
    for (let k = 2; 쓴.has(붙임); k++) 붙임 = `${이름}-${k}`;
    쓴.add(붙임);
    return { 이름: 붙임, 전: 전대상, 후: 후대상 };
  });
}
const 주소로 = (정적, 대상) => (대상.종류 === '주소' ? 대상.값 : `${정적}/${대상.값.split('/').map(encodeURIComponent).join('/')}`);

/** 그 판 보기: 작업본과 rev가 다른 파일만 rev 바이트(없으면 null), 같은 파일은 undefined(서버대로).
 *  이름 바뀜은 옛 경로·새 경로를 다 넣는다(--no-renames) — 바탕 HTML이 옛 경로를 부르면 그 판 바이트를 내줘야 한다. */
function 판보기만들기(rev, cwd) {
  const 다른 = new Set(git(['diff', '--name-only', '--no-renames', '-z', rev], { cwd }).split('\0').filter(Boolean));
  for (const p of git(['ls-files', '--others', '--exclude-standard', '-z'], { cwd }).split('\0').filter(Boolean)) 다른.add(p);
  const 캐시 = new Map();
  const 보기 = p => {
    if (!다른.has(p)) return undefined;
    if (!캐시.has(p)) { const r = gitRaw(['show', `${rev}:${p}`], { cwd, buffer: true }); 캐시.set(p, r.status === 0 ? r.stdout : null); }
    return 캐시.get(p);
  };
  보기.경로들 = [...다른];
  return 보기;
}

async function 화면찍기(설정, 폴더, { 판들 = ['전', '후'], 하위 = '캡처', 앞장들 = [], 알리기 = () => {} } = {}) {
  const 화면 = 설정.화면;
  const 정적 = 화면.some(x => x.전.종류 === '경로' || x.후.종류 === '경로') ? await 캡처도구.정적서버(설정.저장소) : null;
  try {
    const 전보기 = 판보기만들기(설정.바탕.커밋, 설정.저장소);
    const 후보기 = 설정.끝 === '작업본' ? null : 판보기만들기(설정.끝.커밋, 설정.저장소);
    const 헷갈림 = new Set();
    const 경로찾기 = 캡처도구.경로찾기만들기({ 정적주소: 정적?.주소 || null, 주소뿌리: 설정.주소뿌리.map(s => { const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)]; }),
      바뀐경로들: [...new Set([...전보기.경로들, ...(후보기?.경로들 || [])])], 헷갈림 });
    const 판정의 = { 전: { 이름: '전', 덧: { 판보기: 전보기, 경로찾기 } }, 후: { 이름: '후', 덧: 후보기 ? { 판보기: 후보기, 경로찾기 } : null } };
    const 화면들 = 화면.map(x => ({ 이름: x.이름, 주소: { 전: 주소로(정적?.주소, x.전), 후: 주소로(정적?.주소, x.후) } }));
    const 장면 = 설정.장면 ? (await import(pathToFileURL(path.resolve(설정.장면)).href)).default : null;
    const 시각 = 설정.시각 || null;
    const r = await 캡처도구.찍기({ 화면들, 장면, 판들: 판들.map(k => 판정의[k]), 폴더: path.join(폴더, 하위), 시각, 알리기 });
    // 페이블 때는 후만 다시 찍고 전은 준비 때 그림(앞장들, 절대 경로)과 견준다
    const 장들 = [...앞장들.filter(x => !판들.includes(x.판)), ...r.장들];
    const 차이들 = 앞장들.length ? await 캡처도구.견주기(장들, path.join(폴더, 하위)) : r.차이들;
    // 바뀐 화면 파일(이름 바뀜은 옛 경로)인데 「전」에서 한 번도 바꿔 끼우지 못한 것 — 주소 연결이 틀렸을 수 있다. 바탕에 없는 새 파일은 끼울 것이 없어 뺀다.
    const 웹 = /\.(html?|m?js|css|json|svg)$/i;
    const 이번파일 = new Set([...설정.파일경로들, ...(설정.옛경로들 || [])]);
    const 못끼움 = 판들.includes('전') ? 전보기.경로들.filter(p => 웹.test(p) && !r.덧쓴.includes(p) && 이번파일.has(p) && 전보기(p) !== null) : [];
    const 상대 = p => 슬래시(path.relative(폴더, p));
    // 장면이 찍은 화면은 --화면 이름과 다르다 — 실제로 찍힌 이름으로 목록을 만든다(주소는 그 그림을 찍은 때의 주소)
    const 목록 = 장면 ? [...new Set(장들.map(x => x.이름))].map(이름 => ({ 이름, 주소: { 전: 장들.find(x => x.이름 === 이름 && x.판 === '전')?.주소, 후: 장들.find(x => x.이름 === 이름 && x.판 === '후')?.주소 } })) : 화면들;
    return { 하위, 화면들: 목록, 장들: 장들.map(x => ({ ...x, 그림: 상대(x.그림) })), 차이들: 차이들.map(x => ({ ...x, ...(x.그림 ? { 그림: 상대(x.그림) } : {}) })),
      못연: r.못연, 덧쓴: r.덧쓴, 못끼움, 헷갈림: [...헷갈림] };
  } finally { await 정적?.닫기(); }
}

/** --캡처 <폴더>: 따로 찍어 둔 그림·글. 전/<기기>/<이름>.png·후/… 꼴이면 그대로 견준다. */
async function 캡처가져오기(원본, 폴더) {
  const 대상 = path.join(폴더, '캡처-가져옴');
  fs.cpSync(path.resolve(원본), 대상, { recursive: true });
  const 파일들 = fs.readdirSync(대상, { recursive: true }).map(f => 슬래시(String(f))).filter(f => fs.statSync(path.join(대상, f)).isFile());
  const 장들 = [];
  for (const f of 파일들.filter(x => /^(전|후)\/[^/]+\/[^/]+\.png$/.test(x))) {
    const [판, 기기, 이름] = f.replace(/\.png$/, '').split('/');
    const 글파일 = path.join(대상, f.replace(/\.png$/, '.txt'));
    const 글 = fs.existsSync(글파일) ? fs.readFileSync(글파일, 'utf8') : '';
    장들.push({ 이름, 판, 기기, 그림: path.join(대상, f), 넘침: null, 높이: null, 흔들림: false, 글길이: 글.length, 글sha: sha(글).slice(0, 12), 오류: [] });
  }
  const 차이들 = 장들.length ? await 캡처도구.견주기(장들, 대상) : [];
  for (const 장 of 장들) 장.그림 = 슬래시(path.relative(폴더, 장.그림));
  for (const 차 of 차이들) if (차.그림) 차.그림 = 슬래시(path.relative(폴더, 차.그림));
  return { 하위: '캡처-가져옴', 가져옴: true, 화면들: [...new Set(장들.map(x => x.이름))].map(이름 => ({ 이름, 주소: {} })), 장들, 차이들, 못연: [], 덧쓴: [], 못끼움: [], 헷갈림: [], 파일: 파일들 };
}

function 화면항목글(캡처, 폴더, 이름) {
  const 캡 = 캡처;
  const 줄 = [];
  const 장 = (판, 기기) => 캡.장들.find(x => x.이름 === 이름 && x.판 === 판 && x.기기 === 기기);
  const 기기들 = [...new Set(캡.장들.filter(x => x.이름 === 이름).map(x => x.기기))].sort((a, b) => Number(b) - Number(a));
  for (const 기기 of 기기들) {
    const 전 = 장('전', 기기), 후 = 장('후', 기기), 차 = 캡.차이들.find(x => x.이름 === 이름 && x.기기 === 기기);
    const 넘침 = x => (x ? x.넘침 || '없음' : '-');
    const 새오류 = 후 ? 후.오류.filter(e => !(전?.오류 || []).includes(e)) : [];
    const 없어진 = 전 ? 전.오류.filter(e => !(후?.오류 || []).includes(e)) : [];
    const 차글 = !차 ? '' : 차.같음 ? ' · 그림 같음' : ` · 그림 차이 ${차.퍼센트 != null ? `${Number(차.퍼센트).toFixed(2)}%` : 차.이유}${차.위 != null ? `(위에서 ${차.위}~${차.아래}px)` : ''}${차.높이?.전 && 차.높이.전 !== 차.높이.후 ? ` · 높이 ${차.높이.전}→${차.높이.후}` : ''}`;
    줄.push(`- ${기기}px: 가로 넘침 후 ${넘침(후)}${전 ? `(전 ${넘침(전)})` : ''} · 오류 후 ${후 ? 후.오류.length : '-'}${전 ? `(전 ${전.오류.length})` : ''}${차글}${후?.흔들림 ? ' · 후 그림이 끝내 흔들림' : ''}${후?.잘림 ? ' · 너무 길어 위쪽만 찍음' : ''}`);
    for (const e of 새오류.slice(0, 8)) 줄.push(`  - 새 오류: ${e}`);
    for (const e of 없어진.slice(0, 4)) 줄.push(`  - 없어진 오류: ${e}`);
  }
  const 글 = (판, 기기) => { const x = 장(판, 기기); if (!x) return null; const f = path.join(폴더, x.그림.replace(/\.png$/, '.txt')); return fs.existsSync(f) ? f : null; };
  const 큰 = 기기들[0];
  if (큰) {
    const 전글 = 글('전', 큰), 후글 = 글('후', 큰);
    if (전글 && 후글) {
      const 바뀜 = 캡처도구.글차이(전글, 후글);
      줄.push(바뀜 ? `보이는 글 바뀐 곳(${큰}px, 전 → 후):\n${줄임(바뀜, 30000)}` : `보이는 글(${큰}px): 전후 같음`);
    }
    for (const 기기 of 기기들.slice(1)) {
      const a = 장('후', 기기), b = 장('후', 큰), 전a = 글('전', 기기), 후a = 글('후', 기기);
      if (a && b && a.글sha !== b.글sha && 전a && 후a) { const 바뀜 = 캡처도구.글차이(전a, 후a); if (바뀜) 줄.push(`보이는 글 바뀐 곳(${기기}px, 전 → 후):\n${줄임(바뀜, 15000)}`); }
    }
    if (후글) {
      const 전부 = fs.readFileSync(후글, 'utf8').replace(/\n{3,}/g, '\n\n').trim();
      줄.push(`보이는 글 전체(${큰}px 후, ${전부.length.toLocaleString('en-US')}자):\n${줄임(전부, 12000)}`);
    }
  }
  return 줄.join('\n');
}

// ── 묶음 만들기 ─────────────────────────────────────────────────────
function 항목(앞, 제목, 몸, 갈래 = '코드', 파일 = null) {
  const id = `${앞}-${sha(몸).slice(0, 4)}`;
  return { id, 앞, 제목, 몸, 갈래, 파일, 글: `### [${id}] ${제목}\n${몸}\n` };
}
/** 한도를 넘는 항목을 조각으로: diff는 @@ 덩이 경계, 덩이 하나가 넘치면 줄 경계. 조각마다 번호에 a·b·c…를 붙인다. */
export function 쪼개기(x, 한도) {
  const 덩이들 = [];
  let 지금 = [];
  for (const 줄 of x.몸.split('\n')) { if (/^@@ /.test(줄) && 지금.length) { 덩이들.push(지금); 지금 = []; } 지금.push(줄); }
  if (지금.length) 덩이들.push(지금);
  const 조각들 = [];
  let 모음 = [], 크기 = 0;
  const 밀기 = () => { if (모음.length) 조각들.push(모음.join('\n')); 모음 = []; 크기 = 0; };
  // 줄 하나가 한도를 넘으면(줄바꿈 없는 긴 글) 바이트 기준으로 자른다
  const 줄자르기 = 줄 => {
    if (바이트(줄) + 1 <= 한도) return [줄];
    const 토막 = [];
    let 지금 = '', 크기 = 0;
    for (const 글자 of 줄) { const b = 바이트(글자); if (크기 + b > 한도 - 1) { 토막.push(지금); 지금 = ''; 크기 = 0; } 지금 += 글자; 크기 += b; }
    if (지금) 토막.push(지금);
    return 토막;
  };
  for (const 덩이 of 덩이들) {
    const b = 바이트(덩이.join('\n')) + 1;
    if (b > 한도) {
      밀기();
      for (const 줄 of 덩이.flatMap(줄자르기)) { const lb = 바이트(줄) + 1; if (크기 + lb > 한도) 밀기(); 모음.push(줄); 크기 += lb; }
      밀기();
      continue;
    }
    if (크기 + b > 한도) 밀기();
    모음.push(...덩이); 크기 += b;
  }
  밀기();
  const 글자 = 'abcdefghijklmnopqrstuvwxyz';
  return 조각들.map((몸, k) => 항목(`${x.앞}${글자[k] ?? `z${k}`}`, `${x.제목} (조각 ${k + 1}/${조각들.length})`, 몸, x.갈래, x.파일));
}
/** 한도 안에서 차례대로 채운다. 코드에서 화면으로 넘어갈 때 지금 묶음이 반을 넘었으면 새 묶음을 연다. */
export function 묶기(항목들, { 한도 }) {
  const 조각들 = 항목들.flatMap(x => (바이트(x.글) > 한도 ? 쪼개기(x, 한도 - 바이트(x.제목) - 200) : [x]));
  const 묶음들 = [];
  let 지금 = null;
  for (const x of 조각들) {
    const b = 바이트(x.글);
    const 갈림 = 지금 && 지금.갈래 !== x.갈래 && 지금.바이트 > 한도 / 2;
    if (!지금 || 지금.바이트 + b > 한도 || 갈림) { 지금 = { 항목: [], 바이트: 0, 갈래: x.갈래 }; 묶음들.push(지금); }
    지금.항목.push(x);
    지금.바이트 += b;
  }
  return 묶음들;
}
const 묶음이름 = k => (k < 26 ? String.fromCharCode(65 + k) : `Z${k - 25}`);

export function 규칙글(종류) {
  const 화면 = 종류 === '화면';
  return [
    `너는 SYNK의 ${종류} 검수자다. 다른 회사 모델(Claude)이 만든 변경을 처음 보는 사람처럼 독립적으로 검수한다. 실제 문제만 찾는다.`,
    `## 등급
- P0: 데이터·인증·라이브 손상
- P1: 기능 오류(${화면 ? '화면이 깨지거나 못 쓰게 됨, 뜻이 틀려 사용자가 잘못 알게 됨 포함' : '틀린 결과·멈춤·잘못 저장되는 상태 포함'})
- P2: 품질 문제(${화면 ? '기준 위반·어색하거나 틀린 한국어·같은 것을 다르게 부름·작은 배치 흐트러짐' : '오류 처리·기록·시험의 빈틈, 고치기 어려운 코드'})
- P3: 추가 확인이 필요한 의심
지적마다 파일·줄(또는 화면 이름)·깨지는 동작·재현 근거를 댄다. 읽지 못한 범위는 coverage.limitations에 밝히고 그 범위로 지적을 만들지 않는다. 취향 차이(더 좋은 표현 제안)는 지적하지 않는다. 글·코드를 통째로 새로 쓰지 말고 무엇이 왜 문제인지와 고칠 방향만 쓴다.`,
    화면 ? `## 찾을 것
- 바뀐 코드가 깨뜨린 동작: 조건식·이벤트·상태·정규식·템플릿 문자열·import, 글자가 동작에 엮인 곳(판정 집합·비교·정규식·키)과 어긋난 글
- 휴대폰(390px)·컴퓨터(1440px)의 가로 넘침·겹침·잘림, 새로 생긴 콘솔 오류·실패한 요청(화면 항목의 「전 → 후」를 견준다)
- 접근성: 이름 없는 단추·링크, 그림 대체 글, 키보드로 못 닿는 조작, 낮은 글자 대비
- 사용자 글: 뜻이 틀리거나 어색한 한국어, 한 화면 안에서 섞인 말투, 같은 것을 다르게 부른 곳, 사용자 글에 남은 내부 코드·영문 약어·버전 번호`
      : `## 찾을 것
① 바뀐 문자열·상수가 다른 코드에서 비교·검색·정규식·키·상태값·기록 사유로 쓰여 동작이 바뀌는 곳(화면이 서버 글로 판정하는 곳 포함)
② 코드 변경의 정확성: 경계값·오류 처리·동시성·시간 초과·되돌리기
③ 운영 데이터를 바꾸는 코드의 범위·멱등·되돌리기, 마이그레이션 순서
④ 인증·권한·비밀값·개인정보가 새거나 넓어지는 곳
⑤ 시험이 그 동작을 실제로 지키는지(늘 통과하는 시험, 가짜가 실제와 다른 곳)`,
    `## 자료 꼴
항목마다 「### [항목 번호] …」 머리 줄이 있다. diff는 unified 꼴(@@ 머리의 줄 번호)이고, 긴 줄 파일은 「[파일:줄] …앞 [-옛-]{+새+} 뒤…」 꼴(줄 번호는 바뀐 뒤 기준)이다.${화면 ? ' 화면 항목은 실제로 띄운 화면에서 뽑은 보이는 글·콘솔 오류·가로 넘침·그림 차이 비율이다(그림 자체는 이 묶음에 없다 — 그림은 다음 검수자가 본다).' : ''}
이 묶음에 없는 파일은 다른 묶음이 맡는다 — 보지 못한 코드를 추측해 지적하지 않는다.`,
    `## 답
주어진 JSON 꼴로만 답한다. findings마다 grade·location(파일:줄 또는 「화면 이름 · 그 글」)·quote(지금 글·코드를 그대로)·problem(무엇이 왜 문제인지와 재현 근거)·fix(고칠 방향 한 줄). 지적이 없으면 빈 목록.
seen에는 읽은 항목 번호를 머리 줄의 대괄호 안 그대로 모두 적는다. coverage.reviewed에는 읽은 범위, coverage.limitations에는 못 본 것을 적는다.
endMarker에는 자료 맨 끝 「자료 끝 표식:」 뒤의 글을 그대로 적는다. 그 줄을 보지 못했으면 「truncated」라고 적는다.`,
  ].join('\n\n');
}

export function 묶음글({ 규칙, 배경, 커밋, 파일목록, 이름, 차례, 전체, 항목들 }) {
  const 몸 = [
    규칙,
    `## 이번 변경\n${배경.trim()}`,
    커밋 ? `## 커밋\n${커밋}` : null,
    `## 바뀐 파일 전체 ${파일목록.length}개(이 묶음은 ${전체}묶음 가운데 ${차례}번째 「${이름}」 — 다른 묶음의 파일은 그 묶음이 본다)\n${파일목록.join('\n')}`,
    `## 이 묶음의 자료(항목 ${항목들.length}개)\n\n${항목들.map(x => x.글).join('\n')}`,
  ].filter(Boolean).join('\n\n');
  const 표식 = `END_OF_REVIEW_${이름}_${sha(몸).slice(0, 12)}`;
  return { 글: `${몸}\n\n자료 끝 표식: ${표식}\n`, 표식 };
}

const 상태말 = { A: '새', M: '바뀜', D: '지움', R: '옮김', C: '복사', T: '형식' };
const 수글 = f => (f.이진 ? '이진' : `+${f.더함 ?? '?'} −${f.뺌 ?? '?'}`);

/** 지금 상태로 자료를 모은다(준비·페이블이 같이 쓴다). */
async function 자료모으기(설정, 폴더, { 시험 = true, 캡처 = true, 캡처하위 = '캡처', 캡처판 = ['전', '후'], 앞장들 = [], 알리기 = () => {} } = {}) {
  const 파일들 = 바뀐파일들({ 바탕: 설정.바탕.커밋, 끝: 설정.끝 === '작업본' ? '작업본' : 설정.끝.커밋, 경로: 설정.경로, cwd: 설정.저장소 });
  설정.파일경로들 = 파일들.map(f => f.경로);
  설정.옛경로들 = 파일들.filter(f => f.옛경로).map(f => f.옛경로);
  for (const f of 파일들) {
    if (맞나(f.경로, 설정.넣음)) continue;
    if (맞나(f.경로, [...기본뺌, ...설정.뺌])) f.뺀까닭 = '생성물·잠금 파일(--넣음으로 넣는다)';
  }
  for (const f of 파일들.filter(x => !x.이진 && !x.뺀까닭)) {
    const d = 파일diff(f, 설정);
    if (바이트(d.글) > 설정.크기 * 3 && !맞나(f.경로, 설정.넣음)) { f.뺀까닭 = `diff가 너무 크다(${Math.round(바이트(d.글) / 1024)}KB) — 생성물이면 원천을 보이고, 아니면 --경로로 나눠 준비한다`; continue; }
    f.diff = d;
  }
  const 자료 = { 파일들, 커밋: 커밋목록(설정), 전체diff: 전체diff(설정, 파일들) };
  if (설정.배경파일) 자료.배경 = fs.readFileSync(path.resolve(설정.배경파일), 'utf8');
  if (시험 && 설정.시험.length) { 알리기(`시험: node --test ${설정.시험.join(' ')}`); 자료.시험 = 시험돌리기(설정.시험, { cwd: 설정.저장소, 폴더 }); }
  else if (설정.시험결과) { fs.copyFileSync(path.resolve(설정.시험결과), path.join(폴더, '시험.tap')); 자료.시험 = { 명령: `(받은 TAP ${path.basename(설정.시험결과)})`, 종료: null, tap: '시험.tap', 없는파일: [], ...TAP요약(fs.readFileSync(path.join(폴더, '시험.tap'), 'utf8')) }; }
  if (캡처 && (설정.화면.length || 설정.장면)) { 알리기(`화면 ${설정.화면.length || '장면'} × 1440·390 × ${캡처판.join('·')} 캡처`); 자료.화면 = await 화면찍기(설정, 폴더, { 판들: 캡처판, 하위: 캡처하위, 앞장들, 알리기 }); }
  if (캡처 && 설정.캡처) 자료.가져온캡처 = await 캡처가져오기(설정.캡처, 폴더);
  return 자료;
}

function 항목만들기(자료, 설정, 폴더) {
  const 항목들 = [];
  if (자료.시험) {
    const t = 자료.시험;
    const 몸 = [시험한줄(t), ...(t.없는파일?.length ? [`- 없는 시험 파일(돌지 않음): ${t.없는파일.join(', ')}`] : []),
      ...(t.실패목록.length ? ['실패:', ...t.실패목록.slice(0, 30).map(x => `- ${x.이름}${x.위치 ? ` (${x.위치})` : ''}: ${x.오류}`)] : ['실패 없음'])].join('\n');
    항목들.push(항목('T01', '시험 결과', 몸));
  }
  설정.곁.forEach((spec, i) => {
    const m = /^(.*?)(?::(\d+)-(\d+))?$/.exec(spec);
    const 경로 = m[1].replace(/\\/g, '/');
    const 원 = 설정.끝 === '작업본' ? fs.readFileSync(path.join(설정.저장소, 경로), 'utf8') : git(['show', `${설정.끝.커밋}:${경로}`], { cwd: 설정.저장소 });
    const 줄들 = 원.replace(/\r\n/g, '\n').split('\n');
    const 시작 = m[2] ? Math.max(1, Number(m[2])) : 1, 끝줄 = m[3] ? Math.min(줄들.length, Number(m[3])) : 줄들.length;
    const 몸 = 줄들.slice(시작 - 1, 끝줄).map((l, k) => `${String(시작 + k).padStart(5)}| ${l.length > 3000 ? 줄임(l, 3000) : l}`).join('\n');
    항목들.push(항목(`X${String(i + 1).padStart(2, '0')}`, `곁 자료 ${경로}${m[2] ? `:${시작}-${끝줄}` : ''} (맥락으로 주는 파일 · 끝 판 · 줄 번호)`, 몸, '코드', 경로));
  });
  let n = 0;
  for (const f of 자료.파일들.filter(x => x.diff)) {
    n++;
    const 꼴 = f.diff.꼴 === '낱말' ? '긴 줄 파일이라 바뀐 낱말만' : f.diff.꼴 === '새 파일' ? '추적 안 된 새 파일' : 'unified diff, 앞뒤 5줄';
    항목들.push(항목(`D${String(n).padStart(2, '0')}`, `${f.옛경로 ? `${f.옛경로} → ` : ''}${f.경로} — ${상태말[f.상태] || f.상태} ${수글(f)} (${꼴})`, f.diff.글 || '(내용 차이 없음)', '코드', f.경로));
  }
  for (const 캡 of [자료.화면, 자료.가져온캡처].filter(Boolean)) {
    캡.화면들.forEach((h, i) => {
      const 주소 = h.주소?.후 ? ` — 후 ${h.주소.후}${h.주소.전 && h.주소.전 !== h.주소.후 ? ` · 전 ${h.주소.전}` : ' (전: 같은 주소에 바뀐 파일만 바탕 판)'}` : '';
      항목들.push(항목(`S${String(i + 1).padStart(2, '0')}${캡.가져옴 ? 'g' : ''}`, `화면 「${h.이름}」${주소}`, 화면항목글(캡, 폴더, h.이름) || '(찍힌 그림 없음)', '화면', null));
    });
  }
  return 항목들;
}

function 파일목록글(파일들, 어디) {
  return 파일들.map(f => `- ${상태말[f.상태] || f.상태} ${f.옛경로 ? `${f.옛경로} → ` : ''}${f.경로} (${수글(f)})${f.뺀까닭 ? ` — 뺌: ${f.뺀까닭}` : f.이진 ? ' — 이진 파일이라 내용 없음' : 어디.get(f.경로) ? ` → 묶음 ${[...어디.get(f.경로)].join('·')}` : ''}`);
}

export function 설정만들기(o) {
  const 저장소 = path.resolve(o.저장소 || root);
  if (!['화면', '백엔드'].includes(o.종류)) throw new Error('--종류 화면|백엔드가 필요하다');
  if (!o.바탕) throw new Error('--바탕 <커밋>이 필요하다');
  const 크기 = o.크기 ? Number(o.크기) : 기본크기;
  if (!(크기 >= 30_000)) throw new Error('--크기는 30000 이상 바이트');
  // 화면의 저장소 경로는 저장소 기준 상대 경로로(절대 경로를 주면 바꾸고, 저장소 밖이면 멈춘다)
  const 상대로 = 대상 => {
    if (대상.종류 !== '경로' || !path.isAbsolute(대상.값)) return 대상;
    const r = 슬래시(path.relative(저장소, 대상.값));
    if (r.startsWith('..') || path.isAbsolute(r)) throw new Error(`--화면 경로가 저장소 밖이다: ${대상.값}`);
    return { ...대상, 값: r };
  };
  const 화면 = 화면읽기(o.화면 || []).map(h => ({ ...h, 전: 상대로(h.전), 후: 상대로(h.후) }));
  // --주소뿌리 <주소>=<저장소 경로>: 준비 때 미리 본다(캡처 도중 route 처리기 안에서 터지지 않게)
  for (const s of o.주소뿌리 || []) {
    const i = s.indexOf('=');
    let 주소 = null;
    try { 주소 = i > 0 ? new URL(s.slice(0, i)) : null; } catch { /* 아래에서 멈춤 */ }
    if (!주소 || !/^https?:$/.test(주소.protocol) || !s.slice(i + 1).trim()) throw new Error(`--주소뿌리는 <주소>=<저장소 경로> 꼴이다(예: http://127.0.0.1:8080/=docs/x/public/): ${s}`);
  }
  return { 종류: o.종류, 저장소, 바탕: 커밋풀기(o.바탕, 저장소), 끝: o.끝 ? 커밋풀기(o.끝, 저장소) : '작업본', 경로: [...(o.경로 || []), ...(o.경로목록 || [])],
    배경파일: o.배경 ? path.resolve(o.배경) : null, 곁: o.곁 || [], 시험: o.시험 || [], 시험결과: o.시험결과 || null, 화면,
    장면: o.장면 ? path.resolve(o.장면) : null, 주소뿌리: o.주소뿌리 || [], 시각: o.시각 || null, 캡처: o.캡처 ? path.resolve(o.캡처) : null,
    뺌: o.뺌 || [], 넣음: o.넣음 || [], 크기 };
}

export async function 준비하기(o, { 알리기 = () => {} } = {}) {
  const 설정 = 설정만들기(o);
  const 폴더 = 폴더찾기(o.이름, o.폴더);
  if (fs.existsSync(path.join(폴더, '묶음.json'))) throw new Error(`이미 있는 묶음: ${폴더} — 다른 이름을 쓴다`);
  fs.mkdirSync(폴더, { recursive: true });
  const 자료 = await 자료모으기(설정, 폴더, { 알리기 });
  if (!자료.파일들.length && !자료.화면 && !자료.가져온캡처) throw new Error('바뀐 파일이 없다 — --바탕·--끝·경로를 확인한다');
  const 항목들 = 항목만들기(자료, 설정, 폴더);
  const 배경 = 자료.배경 || `(배경 글이 없어 커밋 메시지로 대신한다 — 무엇을 왜 바꿨는지·글자가 동작에 엮인 곳은 아래 커밋과 diff로 판단한다.)`;
  const 규칙 = 규칙글(설정.종류);
  const 임시목록 = 파일목록글(자료.파일들, new Map(자료.파일들.map(f => [f.경로, new Set(['A', 'B'])])));
  const 머리 = 바이트(묶음글({ 규칙, 배경, 커밋: 자료.커밋, 파일목록: 임시목록, 이름: 'A', 차례: 1, 전체: 9, 항목들: [] }).글);
  const 한도 = 설정.크기 - 머리 - 300;
  if (한도 < 20_000) throw new Error(`머리말(규칙·배경·커밋·파일 목록)이 ${Math.round(머리 / 1024)}KB라 자료 칸이 모자란다 — 배경을 줄이거나 --경로로 나눈다`);
  const 묶음들 = 묶기(항목들, { 한도 });
  const 어디 = new Map();
  묶음들.forEach((b, k) => { for (const x of b.항목) if (x.파일) (어디.get(x.파일) || 어디.set(x.파일, new Set()).get(x.파일)).add(묶음이름(k)); });
  const 파일목록 = 파일목록글(자료.파일들, 어디);
  const 목록 = { 도구: 'tools/검수묶음.mjs', 판: 1, 이름: path.basename(폴더), 종류: 설정.종류, 만든때: new Date().toISOString(), 저장소: 설정.저장소,
    바탕: 설정.바탕, 끝: 설정.끝, 머리커밋: 설정.끝 === '작업본' ? 커밋풀기('HEAD', 설정.저장소) : null, 설정: { ...설정, 파일경로들: undefined },
    배경: 자료.배경 ? { 파일: 설정.배경파일, sha256: sha(자료.배경) } : null,
    파일: 자료.파일들.map(({ diff, ...f }) => ({ ...f, 꼴: diff?.꼴 || null })), 시험: 자료.시험 || null,
    화면: 자료.화면 ? { ...자료.화면, 화면들: 자료.화면.화면들 } : null, 가져온캡처: 자료.가져온캡처 || null, 최대바이트: 설정.크기, 묶음: [] };
  묶음들.forEach((b, k) => {
    const 이름 = 묶음이름(k);
    const { 글, 표식 } = 묶음글({ 규칙, 배경, 커밋: 자료.커밋, 파일목록, 이름, 차례: k + 1, 전체: 묶음들.length, 항목들: b.항목 });
    const 버퍼 = Buffer.from(글, 'utf8');
    글쓰기(path.join(폴더, `묶음-${이름}.txt`), 버퍼);
    목록.묶음.push({ 이름, 파일: `묶음-${이름}.txt`, 바이트: 버퍼.length, sha256: sha(버퍼), 표식, 항목: b.항목.map(x => x.id), 파일들: [...new Set(b.항목.map(x => x.파일).filter(Boolean))], 갈래: b.갈래 });
  });
  글쓰기(path.join(폴더, 'diff.patch'), 자료.전체diff);
  writeJson(path.join(폴더, '묶음.json'), 목록);
  if (!fs.existsSync(path.join(폴더, '지적표.json'))) writeJson(path.join(폴더, '지적표.json'), { 이름: 목록.이름, 지적: [] });
  페이블쓰기(폴더, 목록, { 파일: 목록.파일, 시험: 자료.시험 || null, 화면: 자료.화면 || null, 가져온캡처: 자료.가져온캡처 || null, 배경: 자료.배경 || null, 때: 목록.만든때 });
  return { 폴더, 목록 };
}

// ── 아르곤 ─────────────────────────────────────────────────────────
export const 답꼴 = { type: 'object', additionalProperties: false, required: ['findings', 'seen', 'coverage', 'endMarker'], properties: {
  findings: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['grade', 'location', 'quote', 'problem', 'fix'], properties: {
    grade: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] }, location: { type: 'string' }, quote: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } } } },
  seen: { type: 'array', items: { type: 'string' } },
  coverage: { type: 'object', additionalProperties: false, required: ['reviewed', 'limitations'], properties: { reviewed: { type: 'string' }, limitations: { type: 'string' } } },
  endMarker: { type: 'string' } } };

/** 답이 묶음을 끝까지 읽었는지: 끝 표식이 같고 항목 번호(뒤의 해시까지)를 다 적었으면 읽음. 표식이 다르거나 truncated면 잘림. */
export function 답대조(묶음, 답) {
  const 정규 = s => String(s).toLowerCase().replace(/[^0-9a-z]/g, '');
  const 본 = new Set((답?.seen || []).map(정규));
  const 잘림 = (답?.seen || []).some(s => /truncated/i.test(s)) || /truncated/i.test(답?.endMarker || '');
  const 표식맞음 = String(답?.endMarker || '').trim() === 묶음.표식;
  const 빠진항목 = 묶음.항목.filter(id => !본.has(정규(id)));
  return { 상태: !표식맞음 || 잘림 ? '잘림' : 빠진항목.length ? '덜 읽음' : '읽음', 표식맞음, 빠진항목 };
}
const 막힘인가 = e => /quota|rate.?limit|exhaust|429|login|log in|sign.?in|auth|credential|limit remaining/i.test(String(e || ''));

/** 아르곤 주간·5시간 몫(agy /usage — 토큰 0). 못 읽으면 null. */
export function 몫읽기() {
  const bin = process.env.SYNK_AGY_BIN || 'agy';
  const js = /\.[cm]?js$/i.test(bin);
  const r = spawnSync(js ? process.execPath : bin, [...(js ? [bin] : []), '-p', '/usage', '--output-format', 'json'], { encoding: 'utf8', timeout: 90_000, windowsHide: true });
  if (r.status !== 0 || !r.stdout) return null;
  try {
    const j = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
    const g = (j.command?.data?.groups || []).find(x => /Gemini/i.test(x.name));
    const b = id => g?.buckets?.find(x => x.id === id);
    return { 때: new Date().toISOString(), 주간: b('gemini-weekly')?.remaining_fraction ?? null, 다섯시간: b('gemini-5h')?.remaining_fraction ?? null, 주간초기화: b('gemini-weekly')?.reset_time ?? null };
  } catch { return null; }
}
const 퍼 = v => (v == null ? '?' : `${(v * 100).toFixed(1)}%`);
const 몫글 = m => (m?.앞 || m?.뒤 ? ` · 주간 몫 ${퍼(m.앞?.주간)} → ${퍼(m.뒤?.주간)}` : '');

// ── GPT ────────────────────────────────────────────────────────────
// 백엔드 2차 검수는 아르곤과 GPT가 함께 본다(2026-10-22 유호님, GPT 구독이 남은 동안). 모델·추론은 GPT 앱 본 설정(~/.codex/config.toml) 그대로이고,
// 계정은 Pro 계정(본 계정 + 굽기 장부 ~/.codex-bake) 가운데 주간 몫이 가장 넉넉한 것이다 — 10-22 본 계정은 GPT 앱 백엔드 작업으로 주간 90%였고
// 크레딧이 있어 한도를 넘기면 크레딧이 나갈 수 있었다. 그래서 주간 90% 넘게 쓴 계정은 고르지 않는다.
// 묶음은 표준입력으로만 준다 — Windows 읽기 전용 실행은 파일 읽기도 거절해서(현장 노트 AI_CLI) -C는 빈 폴더다. 그래서 GPT도 아르곤과 같은 바이트만 본다.
const require코덱스 = () => require('./codex계정.js');
const 추론들 = ['minimal', 'low', 'medium', 'high', 'xhigh', 'ultra'];
const GPT제한분 = 45;   // 10-20 아스트라 152KB 묶음이 10분 30초 — xhigh 큰 묶음의 여유
const GPT주간한계 = 90;  // 주간 이만큼(%) 넘게 쓴 계정은 검수에 쓰지 않는다
const 굽기뿌리 = () => process.env.CODEX_BAKE_DIR || path.join(os.homedir(), '.codex-bake');
/** 후보 계정마다 요금제·주간 사용(app-server, 토큰 0). 이름 null = 본 계정(~/.codex). 메일은 남기지 않는다. */
export async function GPT계정들읽기() {
  const { 묻기 } = require코덱스();
  const { codexWindows } = require('../desktop/src/ai-subscriptions.cjs');
  let 장부 = [];
  try { 장부 = JSON.parse(fs.readFileSync(path.join(굽기뿌리(), '계정.json'), 'utf8')).계정 || []; } catch { /* 장부 없음 */ }
  const 목록 = [];
  for (const 이름 of [null, ...장부.filter(a => !a.로그인필요).map(a => a.이름)]) {
    const [a, r] = await 묻기(이름, [{ method: 'account/read', params: {} }, { method: 'account/rateLimits/read', params: {} }]);
    const { weekly } = codexWindows(r?.rateLimits || Object.values(r?.rateLimitsByLimitId || {})[0] || {});
    목록.push({ 이름, home: 이름 ? path.join(굽기뿌리(), 이름) : null, 요금제: a?.account?.planType || null, 계정: a?.account?.email ? sha(a.account.email).slice(0, 8) : null,
      주간사용: Number.isFinite(weekly?.usedPercent) ? weekly.usedPercent : null, 주간초기화: weekly?.resetsAt ? new Date(weekly.resetsAt).toISOString() : null });
  }
  return 목록;
}
/** Pro이고 주간 90% 아래인 계정 가운데 가장 덜 쓴 것. 없으면 null(검수는 막힘으로 적힌다). */
export function GPT계정가리기(목록) {
  return 목록.filter(a => a.요금제 === 'pro' && a.주간사용 != null && a.주간사용 < GPT주간한계).sort((x, y) => x.주간사용 - y.주간사용)[0] || null;
}
const 계정말 = 계정 => (계정?.이름 ? `굽기 장부 ${계정.이름}` : '본 계정(~/.codex)');
function codex명령(args) {
  const 시험 = process.env.CODEX_BIN;
  const { candidatePaths, commandFor } = require('../desktop/src/ai-subscriptions.cjs');
  if (시험) return /\.[cm]?js$/i.test(시험) ? { command: process.execPath, argv: [시험, ...args], verbatim: false } : commandFor(시험, args, { platform: process.platform, env: process.env });
  const 파일 = candidatePaths('codex', { platform: process.platform, env: process.env, home: os.homedir() }).find(p => fs.existsSync(p));
  if (!파일) throw new Error('codex를 찾지 못했다 — Codex CLI 설치를 확인한다');
  return commandFor(파일, args, { platform: process.platform, env: process.env });
}
/** GPT 앱 본 설정의 모델·추론 — 맨 위(표 머리 전) 칸에서 읽고, 맨 위 `profile`이 고른 [profiles.<이름>] 칸이 있으면 그 값이 앞선다.
 *  문자열은 큰따옴표·작은따옴표 둘 다(3차 검수 GA4). 시험은 SYNK_CODEX_CONFIG로 다른 파일을 준다. */
export function GPT설정(글 = null) {
  if (글 == null) { const f = process.env.SYNK_CODEX_CONFIG || path.join(os.homedir(), '.codex', 'config.toml'); 글 = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; }
  const 칸들 = { '': {} };
  let 지금 = '';
  for (const 줄 of 글.split(/\r?\n/)) {
    const 머리 = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(줄);
    if (머리) { 지금 = 머리[1].trim().replace(/\s*\.\s*/g, '.').replace(/"/g, ''); 칸들[지금] ||= {}; continue; }
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(줄);
    if (m) 칸들[지금][m[1]] = m[2] ?? m[3];
  }
  const 맨위 = 칸들[''], 고른 = 맨위.profile ? 칸들[`profiles.${맨위.profile}`] || {} : {};
  return { 모델: 고른.model || 맨위.model || null, 추론: 고른.model_reasoning_effort || 맨위.model_reasoning_effort || null };
}
/** codex exec 한 번(home null = 본 계정). 표준출력(--json 사건)·표준오류는 끝부분만 모으고, 시간 제한이면 나무째 끈다. */
function codex실행(args, 입력, timeoutMs, home = null) {
  return new Promise(resolve => {
    const { command, argv, verbatim } = codex명령(args);
    const env = { ...process.env };
    if (home) env.CODEX_HOME = home; else delete env.CODEX_HOME;
    const 끝 = { 출력: '', 오류: '' };
    const 담기 = (곳, d) => { 끝[곳] = (끝[곳] + d).slice(-1 << 20); };
    let 시간초과 = false;
    const child = spawn(command, argv, { env, windowsVerbatimArguments: verbatim, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const 시계 = setTimeout(() => {
      시간초과 = true;
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill();
    }, timeoutMs);
    child.stdout.on('data', d => 담기('출력', d));
    child.stderr.on('data', d => 담기('오류', d));
    child.on('error', e => { clearTimeout(시계); resolve({ code: -1, ...끝, 오류: `${끝.오류}\n${e}`, 시간초과 }); });
    child.on('close', code => { clearTimeout(시계); resolve({ code, ...끝, 시간초과 }); });
    child.stdin.on('error', () => {});
    child.stdin.end(입력);
  });
}
/** 아르곤 부르기와 같은 꼴: { prompt, schema, thinking, timeoutMs, 계정 } → { text, selectedModel, usage }. 한도·로그인은 막힘으로 읽히는 오류로 던진다.
 *  모델·추론은 본 설정 값을 -m·-c로 넘긴다 — 굽기 장부 폴더의 config.toml은 만들 때 옮긴 옛 값이라서. */
export async function GPT부르기({ prompt, schema, thinking = null, timeoutMs = GPT제한분 * 60_000, 계정 = { 이름: null, home: null } }) {
  const { 코덱스오류, 한도문구, 로그인문구 } = require코덱스();
  if (!계정) throw new Error(`GPT quota — 주간 ${GPT주간한계}% 아래인 Pro 계정이 없다`);
  const 설정 = GPT설정();
  const 추론 = thinking || 설정.추론;
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-gpt-review-'));
  try {
    const 빈 = path.join(임시, 'empty'), 꼴파일 = path.join(임시, 'schema.json'), 답파일 = path.join(임시, 'answer.json');
    fs.mkdirSync(빈);
    fs.writeFileSync(꼴파일, JSON.stringify(schema));
    const r = await codex실행(['exec', '--ephemeral', '--skip-git-repo-check', '-s', 'read-only', '-C', 빈, '--output-schema', 꼴파일, '-o', 답파일, '--json',
      ...(설정.모델 ? ['-m', 설정.모델] : []), ...(추론 ? ['-c', `model_reasoning_effort="${추론}"`] : []), '-'], prompt, timeoutMs, 계정.home);
    if (r.시간초과) throw new Error(`codex exec 시간 초과(${Math.round(timeoutMs / 60_000)}분)`);
    const 오류 = 코덱스오류(r).pop();
    if (r.code !== 0) {
      if (오류 && 한도문구.test(오류)) throw new Error(`GPT 한도(quota) — ${오류}`);
      if (오류 && 로그인문구.test(오류)) throw new Error(`GPT login 필요 — ${오류}`);
      throw new Error(`codex exec 실패(종료 ${r.code}) — ${(오류 || r.오류.trim().split('\n').pop() || '').slice(0, 400)}`);
    }
    if (!fs.existsSync(답파일)) throw new Error('codex exec가 답 파일을 남기지 않았다');
    let usage = null;
    for (const 줄 of r.출력.split(/\r?\n/)) { if (!줄.startsWith('{')) continue; try { const e = JSON.parse(줄); if (e?.type === 'turn.completed' && e.usage) usage = e.usage; } catch { /* 사건 아님 */ } }
    return { text: fs.readFileSync(답파일, 'utf8'), selectedModel: `${설정.모델 || 'codex'}-${추론 || '기본'} · ${계정말(계정)}`, usage };
  } finally { fs.rmSync(임시, { recursive: true, force: true, maxRetries: 3 }); }
}
/** 그 계정의 주간·5시간 몫(app-server, 토큰 0). 남은 몫으로 아르곤과 같은 꼴. 못 읽으면 null. */
export async function GPT몫읽기(계정 = { 이름: null }) {
  try {
    const { 묻기 } = require코덱스();
    const { codexWindows } = require('../desktop/src/ai-subscriptions.cjs');
    const [r] = await 묻기(계정?.이름 || null, [{ method: 'account/rateLimits/read', params: {} }]);
    const { session, weekly } = codexWindows(r?.rateLimits || Object.values(r?.rateLimitsByLimitId || {})[0] || {});
    const 남음 = w => (w && Number.isFinite(w.usedPercent) ? Math.max(0, 1 - w.usedPercent / 100) : null);
    return { 때: new Date().toISOString(), 주간: 남음(weekly), 다섯시간: 남음(session), 주간초기화: weekly?.resetsAt ? new Date(weekly.resetsAt).toISOString() : null };
  } catch { return null; }
}

// ── 보내기 ─────────────────────────────────────────────────────────
// 검수자마다 결과 파일 앞머리·지적 번호 앞머리·모델·수준만 다르고, 묶음 고르기·입력 SHA·답 대조·앞 답 지키기·막히면 멈추기는 같다.
export const 검수자들 = {
  아르곤: { 출처: '아르곤', 번호앞: '', 모델: ARGON.model, 기본수준: 종류 => 기본수준[종류], 제한분: 수준 => 제한분[수준], 몫: 몫읽기,
    수준검사: 수준 => { if (!제한분[수준]) throw new Error(`--수준은 high·medium·low 가운데 하나(받음 ${수준})`); },
    막힘말: '아르곤이 한도·로그인으로 막혔다 — 남은 묶음은 보내지 않는다. 운영 원칙대로 다른 경로를 찾지 않는다 — 백엔드는 GPT가 끝까지 읽었으면 그것으로, 아니면 Fable 검수로 대신하고 끝 보고에 그렇게 적는다' },
  GPT: { 출처: 'GPT', 번호앞: 'G', 모델: null, 기본수준: () => null, 제한분: () => GPT제한분, 몫: GPT몫읽기,
    수준검사: 수준 => { if (수준 != null && !추론들.includes(수준)) throw new Error(`--수준은 ${추론들.join('·')} 가운데 하나(받음 ${수준}) — 빼면 본 계정 설정 그대로`); },
    막힘말: 'GPT가 한도·로그인으로 막혔다 — 남은 묶음은 보내지 않는다. 아르곤이 끝까지 읽었으면 그것으로 가고(아르곤도 막히면 Fable), 끝 보고에 그렇게 적는다' },
};

export function 아르곤보내기(폴더, 목록, o = {}) { return 검수보내기('아르곤', 폴더, 목록, o); }
export function GPT보내기(폴더, 목록, o = {}) { return 검수보내기('GPT', 폴더, 목록, o); }

export async function 검수보내기(누구, 폴더, 목록, { 수준, 고른 = null, 다시 = false, call, 몫, 알리기 = () => {} } = {}) {
  const 자 = 검수자들[누구];
  if (!자) throw new Error(`모르는 검수자: ${누구}`);
  수준 = 수준 === undefined ? 자.기본수준(목록.종류) : 수준;
  자.수준검사(수준);
  몫 ||= 자.몫;
  const 결과들 = [], 내표시들 = [];
  try {
  for (const 묶음 of 목록.묶음) {
    if (고른 && !고른.includes(묶음.이름)) continue;
    const 파일 = path.join(폴더, `${자.출처}-${묶음.이름}.json`);
    // 같은 묶음을 다른 프로세스가 보내는 중이면 겹쳐 보내지 않는다(GPT 2차 검수 GA3)
    const 표시 = 보내는중파일(폴더, 자.출처, 묶음.이름);
    const 남의표시 = 살아있는표시(표시);
    if (남의표시) { 알리기(`${자.출처} 묶음 ${묶음.이름}: 다른 프로세스(pid ${남의표시.pid})가 ${남의표시.보낸때}부터 보내는 중 — 건너뜀`); continue; }
    const 앞결과 = fs.existsSync(파일) ? readJson(파일) : null;
    // 결과가 있는 묶음은 사람이 고를 때만 다시 보낸다: 읽음은 --다시, 잘림·덜 읽음·실패는 --다시나 --묶음으로 고른 것만.
    // 결과가 없거나 막힘이면 보낸다(막힘 뒤 이어 보내기). 도구가 스스로 되풀이하지 않게.
    if (앞결과 && 앞결과.상태 !== '막힘' && !다시 && !(앞결과.상태 !== '읽음' && 고른)) {
      알리기(`묶음 ${묶음.이름}: 이미 ${앞결과.상태} — 건너뜀(다시 보내려면 ${앞결과.상태 === '읽음' ? '--다시' : `--묶음 ${묶음.이름} 또는 --다시`})`);
      결과들.push(앞결과);
      continue;
    }
    const 입력 = fs.readFileSync(path.join(폴더, 묶음.파일));
    const 입력sha = sha(입력);
    if (입력sha !== 묶음.sha256) throw new Error(`묶음 ${묶음.이름}이 준비 뒤 바뀌었다(입력 SHA ${입력sha.slice(0, 12)} ≠ ${묶음.sha256.slice(0, 12)}) — 새 이름으로 준비를 다시 한다`);
    // 답을 기다리는 동안 집계가 이 묶음을 「안 보냄」으로 보고 관문에서 빼지 않게 표시를 남긴다(GPT 검수 GA2).
    // 몫을 읽기 전에 배타로 잡고, 결과 파일과 지적표에 다 넣은 뒤 바깥 finally에서 내 것만 지운다(2차 검수 아르곤 A1·GPT GA2·GA3).
    const 시작 = Date.now();
    const 내표시 = { 묶음: 묶음.이름, pid: process.pid, 표: crypto.randomUUID(), 보낸때: new Date(시작).toISOString() };
    if (!표시잡기(폴더, 표시, 내표시)) { 알리기(`${자.출처} 묶음 ${묶음.이름}: 그새 다른 프로세스가 보내기 시작했다 — 건너뜀`); continue; }
    내표시들.push([표시, 내표시.표]);
    const 앞몫 = await 몫();
    let 기록 = null, 오류 = null, 답 = null;
    if (앞몫?.주간 === 0) 오류 = `주간 몫이 다 찼다(초기화 ${앞몫.주간초기화 || '?'}) — limit remaining 0`;
    else {
      알리기(`${자.출처} 묶음 ${묶음.이름} 보냄 · ${수준 || '설정 그대로'} · ${Math.round(입력.length / 1024)}KB · 항목 ${묶음.항목.length}개${앞몫 ? ` · 주간 몫 ${퍼(앞몫.주간)}` : ''}`);
      try { 기록 = await call({ model: 자.모델, thinking: 수준, prompt: 입력.toString('utf8'), schema: 답꼴, timeoutMs: 자.제한분(수준) * 60_000 }); }
      catch (e) { 오류 = e.message; }
      if (기록) { try { 답 = JSON.parse(기록.text); } catch { 오류 = '답이 JSON이 아니다'; } }
    }
    const 대조 = 답 ? 답대조(묶음, 답) : { 상태: 막힘인가(오류) ? '막힘' : '실패', 표식맞음: false, 빠진항목: [] };
    const r = { 묶음: 묶음.이름, 입력sha256: 입력sha, 표식: 묶음.표식, 수준, 모델: 기록?.selectedModel || (자.모델 ? `${자.모델}-${수준}` : 자.출처), 보낸때: new Date(시작).toISOString(),
      초: Math.round((Date.now() - 시작) / 1000), ...대조, 오류, usage: 기록?.usage ?? null, 몫: { 앞: 앞몫, 뒤: 기록 || 오류 ? await 몫() : 앞몫 }, 답 };
    알리기(`${자.출처} 묶음 ${묶음.이름} · ${r.초}초 · ${r.상태}${r.빠진항목.length ? ` · 빠진 항목 ${r.빠진항목.join(',')}` : ''}${답 ? ` · 지적 ${답.findings.length}건` : ''}${오류 ? ` · ${오류.slice(0, 240)}` : ''}${몫글(r.몫)}`);
    // 다시 보낸 답이 못 쓰는 것(잘림·실패·막힘)이면 앞의 쓸 만한 답과 그 지적을 그대로 두고 이번 시도만 실패들에 적는다
    // — 결과 파일과 지적표가 같은 답을 가리키게.
    if (!쓸만한가(r) && 쓸만한가(앞결과)) {
      const 둠 = { ...앞결과, 실패들: [...(앞결과.실패들 || []), { 보낸때: r.보낸때, 초: r.초, 수준, 상태: r.상태, 오류: r.오류, 빠진항목: r.빠진항목 }] };
      writeJson(파일, 둠);
      알리기(`묶음 ${묶음.이름}: 다시 보낸 답이 ${r.상태}라 앞의 ${앞결과.상태} 답과 지적을 그대로 둔다`);
      결과들.push(둠);
    } else {
      writeJson(파일, r);
      결과들.push(r);
    }
    if (r.상태 === '막힘') { 알리기(자.막힘말); break; }
  }
  // 아르곤과 GPT를 따로 띄워 함께 돌려도 되게, 지적표는 잠근 채 다시 읽어 그 검수자 몫만 갈아 끼운다(GPT 검수 GA1)
  지적표고치기(폴더, 표 => { for (const r of 결과들) if (쓸만한가(r)) 검수자지적넣기(표, 자.출처, r.묶음, r.답.findings); });
  } finally {
    if (내표시들.length) 잠근채(폴더, () => { for (const [표시, 표] of 내표시들) { try { if (readJson(표시).표 === 표) fs.rmSync(표시, { force: true }); } catch { /* 이미 없음 */ } } });
  }
  return 결과들;
}
const 쓸만한가 = r => Boolean(r?.답 && (r.상태 === '읽음' || r.상태 === '덜 읽음'));
const 보내는중파일 = (폴더, 누구, 묶음) => path.join(폴더, `${누구}-${묶음}.보내는중.json`);
const 살아있나 = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
/** 살아 있는 다른 프로세스의 보내는 중 표시(없거나 주인이 죽었으면 null). */
function 살아있는표시(표시) {
  try { const m = readJson(표시); return m.pid !== process.pid && 살아있나(m.pid) ? m : null; } catch { return null; }
}
/** 폴더 잠금 안에서 표시를 잡는다 — 주인이 살아 있으면 못 잡고, 주인이 죽은 표시는 덮어 잡는다(잠금 안이라 둘이 같이 덮지 않는다, 3차 검수 GA2). */
function 표시잡기(폴더, 표시, 내표시) {
  return 잠근채(폴더, () => {
    if (fs.existsSync(표시) && 살아있는표시(표시)) return false;
    writeJson(표시, 내표시);
    return true;
  });
}
/** 묶음마다 지금 결과 상태(이번에 보내지 않은 묶음까지). 다 「읽음」이어야 검수 끝. */
export function 묶음상태들(폴더, 목록, 누구 = '아르곤') {
  const 결과들 = 결과들읽기(폴더, 목록, 누구);
  return 목록.묶음.map(b => ({ 이름: b.이름, 상태: 결과들.find(r => r.묶음 === b.이름)?.상태 ?? '안 보냄' }));
}
/** 묶음마다 결과. 보내는 프로세스가 살아 있으면(표시 파일) 「보내는 중」이다 — 끝까지 읽힌 것이 아니라 관문을 막는다. */
export function 결과들읽기(폴더, 목록, 누구 = '아르곤') {
  return 목록.묶음.map(b => {
    const 표시 = 보내는중파일(폴더, 누구, b.이름);
    if (fs.existsSync(표시)) { try { const m = readJson(표시); if (살아있나(m.pid)) return { 묶음: b.이름, 상태: '보내는 중', 입력sha256: b.sha256, 보낸때: m.보낸때 }; } catch { /* 깨진 표시는 없는 셈 */ } }
    const f = path.join(폴더, `${누구}-${b.이름}.json`);
    return fs.existsSync(f) ? readJson(f) : null;
  }).filter(Boolean);
}
/** 지적표 읽기~고치기~쓰기를 폴더 잠금 안에서(아르곤·GPT·처리·페이블받기를 따로 띄워도 서로의 지적을 지우지 않게). */
export function 지적표고치기(폴더, 고치기, o = {}) {
  return 잠근채(폴더, () => {
    const 지적표 = 지적표읽기(폴더);
    const 값 = 고치기(지적표);
    지적표쓰기(폴더, 지적표);
    return 값;
  }, o);
}
/** 폴더 잠금(`지적표.lock`) 안에서 fn을 돌린다 — 지적표 고치기, 보내는 중 표시 잡기·지우기, 집계 읽기가 모두 이 잠금을 쓴다(2·3차 검수 GA1·GA2). */
export function 잠근채(폴더, fn, o = {}) {
  const 잠금 = path.join(폴더, '지적표.lock');
  const 표 = 잠그기(잠금, o);
  try { return fn(); } finally { 풀기(잠금, 표); }
}
const 쉬기 = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
/** 잠금 파일을 배타로 만들고 제 표(pid-uuid)를 넣는다. 낡은 잠금을 저절로 걷지는 않는다 — 둘이 같이 걷다 새 잠금을 지우는
 *  경합이 걷기 쪽에서 생겨서(2·3차 검수 A2·GA1·GA3). 잠금은 프로세스가 죽을 때만 남으니, 한계가 지나면 주인과 함께 알린다. */
export function 잠그기(잠금, { 한계 = 60_000 } = {}) {
  const 표 = `${process.pid}-${crypto.randomUUID()}`;
  const 끝 = Date.now() + 한계;
  for (;;) {
    try { fs.writeFileSync(잠금, 표, { flag: 'wx' }); return 표; }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    if (Date.now() > 끝) {
      let 주인 = '?';
      try { 주인 = fs.readFileSync(잠금, 'utf8'); } catch { /* 그새 풀림 */ }
      const pid = Number(주인.split('-')[0]);
      throw new Error(`잠금을 ${Math.round(한계 / 1000)}초 동안 얻지 못했다: ${잠금} (주인 ${주인}${pid && !살아있나(pid) ? ' — 이 프로세스는 이미 없다. 다른 검수 명령이 돌고 있지 않으면 이 파일을 지우고 다시 한다' : ''})`);
    }
    쉬기(100);
  }
}
/** 제 표가 든 잠금만 푼다. */
export function 풀기(잠금, 표) {
  try { if (fs.readFileSync(잠금, 'utf8') === 표) fs.rmSync(잠금, { force: true }); } catch { /* 이미 없음 */ }
}

// ── 지적표 ─────────────────────────────────────────────────────────
const 출처순 = { 아르곤: 0, GPT: 1, Fable: 2 };
const 번호순 = (a, b) => (a.출처 === b.출처 ? (a.묶음 || '').localeCompare(b.묶음 || '') || Number(a.번호.replace(/^\D+/, '')) - Number(b.번호.replace(/^\D+/, '')) : (출처순[a.출처] ?? 9) - (출처순[b.출처] ?? 9));
export function 지적표읽기(폴더) { const f = path.join(폴더, '지적표.json'); return fs.existsSync(f) ? readJson(f) : { 지적: [] }; }
/** 그 묶음의 그 검수자 지적을 갈아 끼운다(다시 보낸 묶음). 번호는 아르곤 A1…, GPT GA1…. 위치·인용이 같은 지적은 적어 둔 처리를 잇는다. */
export function 검수자지적넣기(표, 출처, 묶음, findings) {
  const 앞 = 검수자들[출처]?.번호앞 ?? '';
  const 옛 = 표.지적.filter(x => x.출처 === 출처 && x.묶음 === 묶음);
  const 새 = findings.map((f, i) => {
    const 같은 = 옛.find(o => o.위치 === f.location && o.인용 === f.quote);
    return { 번호: `${앞}${묶음}${i + 1}`, 출처, 묶음, 등급: f.grade, 위치: f.location, 인용: f.quote, 문제: f.problem, 방향: f.fix, 처리: 같은?.처리 ?? null, 이유: 같은?.이유 ?? '', 재확인: null };
  });
  표.지적 = [...표.지적.filter(x => !(x.출처 === 출처 && x.묶음 === 묶음)), ...새].sort(번호순);
  return 표;
}
export function 아르곤지적넣기(표, 묶음, findings) { return 검수자지적넣기(표, '아르곤', 묶음, findings); }
const 처리말 = { 반영: '반영', 일부: '일부 반영', 일부반영: '일부 반영', 안함: '반영 안 함', 반영안함: '반영 안 함', 재현안됨: '재현 안 됨', 후속: '후속' };
export function 처리하기(표, 토막들) {
  const 바뀜 = [];
  for (const 토막 of 토막들) {
    const m = /^([A-Za-z]+\d+)=([^:]+)(?::([\s\S]*))?$/.exec(String(토막).trim());
    if (!m) throw new Error(`처리 꼴이 아니다: ${토막} — <번호>=<반영|일부|안함|재현안됨|후속>[:<이유>] 또는 <번호>=재확인`);
    const 지적 = 표.지적.find(x => x.번호.toUpperCase() === m[1].toUpperCase());
    if (!지적) throw new Error(`없는 지적 번호: ${m[1]}`);
    const 말 = m[2].replace(/\s+/g, '');
    if (말 === '재확인') { if (지적.처리 !== '반영' && 지적.처리 !== '일부 반영') throw new Error(`${지적.번호}: 재확인은 반영한 지적에만`); 지적.재확인 = '통과'; 바뀜.push(지적.번호); continue; }
    const 처리 = 처리말[말];
    if (!처리) throw new Error(`모르는 처리: ${m[2]} (반영·일부·안함·재현안됨·후속·재확인)`);
    const 이유 = (m[3] || '').trim();
    if (처리 !== '반영' && !이유) throw new Error(`${지적.번호}: 「${처리}」에는 이유를 붙인다(${지적.번호}=${말}:<이유>)`);
    Object.assign(지적, { 처리, 이유, 재확인: null });
    바뀜.push(지적.번호);
  }
  return 바뀜;
}
export function 페이블답읽기(글) {
  try { return JSON.parse(글); } catch { /* 보고 글 끝의 블록 */ }
  const 블록 = [...String(글).matchAll(/```json\s*\n([\s\S]*?)```/g)].map(m => m[1]).reverse();
  for (const b of 블록) { try { return JSON.parse(b); } catch { /* 다음 */ } }
  throw new Error('Fable 답에서 JSON을 못 찾았다(맨 끝 ```json 블록 또는 페이블-답.json)');
}
/** Fable 지적을 F1…로 더한다(같은 위치·인용은 한 번). 아르곤 지적에 대한 Fable 의견도 붙인다. */
export function 페이블지적넣기(표, 답, { 새로 = false, 때 = new Date().toISOString() } = {}) {
  if (새로) 표.지적 = 표.지적.filter(x => x.출처 !== 'Fable');
  const 있던 = 표.지적.filter(x => x.출처 === 'Fable');
  let n = 있던.reduce((m, x) => Math.max(m, Number(x.번호.slice(1)) || 0), 0);
  const 더함 = [];
  for (const f of 답.findings || []) {
    if (있던.some(x => x.위치 === f.location && x.인용 === (f.quote || ''))) continue;
    const 지적 = { 번호: `F${++n}`, 출처: 'Fable', 묶음: null, 등급: ['P0', 'P1', 'P2', 'P3'].includes(f.grade) ? f.grade : 'P3', 위치: f.location || '', 인용: f.quote || '', 문제: f.problem || '', 방향: f.fix || '', 처리: null, 이유: '', 재확인: null };
    표.지적.push(지적);
    더함.push(지적.번호);
  }
  for (const r of 답.argonReview || []) { const a = 표.지적.find(x => (x.출처 === '아르곤' || x.출처 === 'GPT') && x.번호 === r.id); if (a) a.페이블의견 = { 동의: r.agree !== false, 메모: r.note || '' }; }
  표.페이블 = { 받은때: 때, 범위: 답.coverage || null, 회차: (표.페이블?.회차 || 0) + 1 };
  표.지적.sort(번호순);
  return 더함;
}
const 칸 = s => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
function 지적표글(표, { 출처 = null } = {}) {
  const xs = 표.지적.filter(x => !출처 || x.출처 === 출처);
  if (!xs.length) return '(지적 없음)';
  return ['| 번호 | 등급 | 위치 | 지적 | 처리 | 이유 |', '|---|---|---|---|---|---|',
    ...xs.map(x => `| ${x.번호} | ${x.등급} | ${칸(x.위치).slice(0, 120)} | ${칸(x.문제).slice(0, 300)}${x.인용 ? ` — 인용 「${칸(x.인용).slice(0, 120)}」` : ''} | ${x.처리 || '미정'}${x.재확인 ? ` · Fable 재확인 ${x.재확인}` : ''} | ${칸(x.이유).slice(0, 300)}${x.페이블의견 ? ` · Fable ${x.페이블의견.동의 ? '동의' : '이견'}: ${칸(x.페이블의견.메모).slice(0, 160)}` : ''} |`)].join('\n');
}
function 지적표쓰기(폴더, 표) {
  writeJson(path.join(폴더, '지적표.json'), 표);
  글쓰기(path.join(폴더, '지적표.md'), `# 지적표 — ${표.이름 || path.basename(폴더)}\n\n${지적표글(표)}\n`);
  글쓰기(path.join(폴더, '아르곤지적표.md'), `# 아르곤 지적과 Claude의 처리 — ${표.이름 || path.basename(폴더)}\n\n${지적표글(표, { 출처: '아르곤' })}\n`);
  // GPT 결과가 하나라도 있으면 0건이어도 쓴다 — fable.md 2단계가 이 파일을 가리킨다(아르곤 검수 A1)
  const G결과있음 = fs.existsSync(폴더) && fs.readdirSync(폴더).some(f => /^GPT-[^.]+\.json$/.test(f));
  if (G결과있음 || 표.지적.some(x => x.출처 === 'GPT') || fs.existsSync(path.join(폴더, 'GPT지적표.md'))) 글쓰기(path.join(폴더, 'GPT지적표.md'), `# GPT 지적과 Claude의 처리 — ${표.이름 || path.basename(폴더)}\n\n${지적표글(표, { 출처: 'GPT' })}\n`);
}

// ── Fable ──────────────────────────────────────────────────────────
function 페이블쓰기(폴더, 목록, 지금) {
  const 화면 = 목록.종류 === '화면';
  const 표 = 지적표읽기(폴더);
  const 결과들 = 결과들읽기(폴더, 목록), G결과들 = 결과들읽기(폴더, 목록, 'GPT');
  const 막힘 = 결과들.some(r => r.상태 === '막힘');
  // 먼저 본 다른 회사 검수자(쓸 만한 답이 있는 쪽). 아르곤이 막혔어도 GPT가 읽었으면 2단계에 GPT 지적이 간다.
  const 앞검수 = [...(결과들.some(쓸만한가) ? [['아르곤', '아르곤지적표.md', 결과들]] : []), ...(G결과들.some(쓸만한가) ? [['GPT', 'GPT지적표.md', G결과들]] : [])];
  const 앞이름 = 앞검수.map(([이름]) => (이름 === '아르곤' ? '아르곤(Gemini 4 Argon)' : 'GPT')).join('과 ');
  const 끝말 =목록.끝 === '작업본' ? `작업본(HEAD ${목록.머리커밋?.커밋?.slice(0, 9) || '?'} + 미커밋 변경)` : `${목록.끝.커밋.slice(0, 9)} (${목록.끝.제목})`;
  const 캡처표 = 캡 => {
    if (!캡?.장들?.length) return [];
    const 줄 = ['| 화면 | 기기 | 전 | 후 | 차이 | 넘침(후) | 오류(후) |', '|---|---|---|---|---|---|---|'];
    // 기기는 실제로 찍힌 것(가져온 캡처는 1280 같은 다른 이름도 온다), 큰 폭부터
    const 기기들 = [...new Set(캡.장들.map(x => x.기기))].sort((a, b) => (Number(b) || 0) - (Number(a) || 0) || String(a).localeCompare(String(b)));
    for (const h of 캡.화면들) for (const 기기 of 기기들) {
      const 전 = 캡.장들.find(x => x.이름 === h.이름 && x.판 === '전' && x.기기 === 기기), 후 = 캡.장들.find(x => x.이름 === h.이름 && x.판 === '후' && x.기기 === 기기);
      if (!전 && !후) continue;
      const 차 = 캡.차이들.find(x => x.이름 === h.이름 && x.기기 === 기기);
      줄.push(`| ${h.이름} | ${기기} | ${전 ? `\`${전.그림}\`` : '-'} | ${후 ? `\`${후.그림}\`` : '-'} | ${차 ? (차.같음 ? '같음' : `${차.퍼센트 != null ? Number(차.퍼센트).toFixed(2) + '%' : 차.이유}${차.그림 ? ` \`${차.그림}\`` : ''}`) : '-'} | ${후?.넘침 || '없음'} | ${후 ? 후.오류.length : '-'} |`);
    }
    return ['', `화면 캡처(경로는 \`${폴더}\` 기준 · 전 = 바탕 판, 후 = 지금 판 · ${캡.가져옴 ? `가져온 캡처, 기기 ${기기들.join('·')}` : '1440×900 / 390×844 · 전체 화면'}):`, '', ...줄];
  };
  const 시 = 지금.시험;
  const 줄 = [
    `# Fable 최종 검수 — ${목록.이름} (${목록.종류})`,
    '',
    `너는 SYNK의 최종 ${목록.종류} 검수자(Fable)다. Claude(Opus)가 만든 변경을${앞검수.length ? ` ${앞이름}(다른 회사 모델)이 먼저 본 뒤 Claude가 고친` : 막힘 ? ' — 아르곤(다른 회사 모델)이 한도·로그인으로 막혀 아르곤 대신 —' : ' 아르곤(Gemini 4 Argon, 다른 회사 모델)이 먼저 본 뒤 Claude가 고친'} 지금 상태로 다시 본다. 품질이 먼저라 범위를 줄이지 않는다 — 바뀐 파일 전체와 그 변경이 닿는 ${화면 ? '화면' : '코드 경로'} 전체를 본다. 아래 목록은 헤매지 않게 하려는 안내일 뿐 범위의 끝이 아니다. 저장소 파일은 직접 열어 읽어도 되지만 고치지는 않는다.`,
    '',
    '## 1단계 — 네 검수를 먼저 쓴다',
    '',
    `- 작업본: \`${목록.저장소}\` · 바탕 \`${목록.바탕.커밋.slice(0, 9)}\` (${목록.바탕.제목}) → 끝 ${끝말}`,
    `- 바뀐 파일 ${지금.파일.length}개 — 전체 diff \`${path.join(폴더, 'diff.patch')}\`(${new Date(Date.parse(지금.때) + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')} KST에 뜬 것):`,
    ...지금.파일.map(f => `  - ${상태말[f.상태] || f.상태} \`${f.경로}\` (${수글(f)})${f.뺀까닭 ? ` — 아르곤 묶음에서 뺌: ${f.뺀까닭}` : ''}`),
    시 ? `- 시험: ${시험한줄(시)} — TAP \`${path.join(폴더, 시.tap)}\`` : '- 시험: 이 묶음에서 돌리지 않았다',
    ...(시?.실패목록?.length ? 시.실패목록.slice(0, 20).map(x => `  - 실패 ${x.이름}: ${x.오류}`) : []),
    ...캡처표(지금.화면), ...캡처표(지금.가져온캡처),
    ...(지금.화면?.못연?.length ? ['', `캡처하지 못한 화면: ${지금.화면.못연.map(x => `${x.판} ${x.기기} ${x.화면 || '장면'}(${x.오류})`).join(' · ')}`] : []),
    '',
    '### 이번 변경의 배경',
    '',
    (지금.배경 || '(배경 글 없음 — 커밋 메시지와 diff로 판단한다)').trim(),
    '',
    '### 등급과 쓰는 법',
    '',
    '- P0 데이터·인증·라이브 손상 · P1 기능 오류(뜻이 틀려 사용자가 잘못 알게 됨 포함) · P2 품질 문제 · P3 추가 확인이 필요한 의심',
    '- 실제 문제만, 파일·줄(또는 화면)·깨지는 동작·재현 근거와 함께. 읽지 못한 범위는 밝히고 지적을 만들지 않는다. 취향 차이는 지적하지 않는다.',
    ...(화면 ? ['- 그림은 직접 열어 본다(전·후·차이). 휴대폰 폭의 넘침·겹침·잘림, 화면 글의 말투·이름 엇갈림, 콘솔 오류를 본다.'] : []),
    '',
    ...(막힘 && !앞검수.length ? [] : ['1단계 답을 다 쓰기 전에는 아래 2단계 파일을 열지 않는다(먼저 본 의견에 끌리지 않으려고).', '',
      `## 2단계 — ${앞검수.length ? 앞검수.map(([이름]) => 이름).join('·') : '아르곤'} 지적과 Claude의 처리를 본다`, '',
      `${(앞검수.length ? 앞검수 : [['아르곤', '아르곤지적표.md', 결과들]]).map(([, 파일]) => `\`${path.join(폴더, 파일)}\``).join('와 ')}를 읽고, 지적마다 Claude의 처리(반영·일부 반영·반영 안 함·재현 안 됨·후속과 그 이유)가 맞는지 본다. 반영했다는 것은 지금 코드에서 확인하고, 처리가 틀렸으면 그 지적을 네 지적으로 다시 올린다. ${(앞검수.length ? 앞검수 : [['아르곤', '', 결과들]]).map(([이름, , rs]) => `${이름 === 'GPT' ? 'GPT는' : `${이름}은`} 묶음 ${목록.묶음.length}개 가운데 ${rs.filter(r => r.상태 === '읽음').length}개를 끝까지 읽었다.`).join(' ')}`, '']),
    '## 답',
    '',
    `사람이 읽는 보고를 쓰고, 맨 끝에 아래 꼴의 JSON 블록을 하나 붙인다. 같은 JSON을 \`${path.join(폴더, '페이블-답.json')}\`에도 쓴다(Write 도구).`,
    '',
    '```json',
    '{"findings":[{"grade":"P1","location":"파일:줄 또는 화면 · 그 글","quote":"지금 글·코드","problem":"무엇이 왜 문제인지·재현 근거","fix":"고칠 방향"}],',
    ' "argonReview":[{"id":"A3","agree":false,"note":"반영했다지만 390px에서 그대로 넘친다"}],',
    ' "coverage":{"reviewed":"읽은 범위","limitations":"못 본 것"}}',
    '```',
  ];
  글쓰기(path.join(폴더, 'fable.md'), 줄.join('\n') + '\n');
  if (!fs.existsSync(path.join(폴더, '아르곤지적표.md'))) 지적표쓰기(폴더, 표);
  return path.join(폴더, 'fable.md');
}

export async function 페이블하기(폴더, { 시험 = true, 캡처 = true, 알리기 = () => {} } = {}) {
  const 목록 = readJson(path.join(폴더, '묶음.json'));
  const 설정 = { ...목록.설정, 바탕: 목록.바탕, 끝: 목록.끝, 화면: 목록.설정.화면 || [] };
  const 앞장들 = (목록.화면?.장들 || []).map(x => ({ ...x, 그림: path.join(폴더, x.그림) }));
  const 자료 = await 자료모으기(설정, 폴더, { 시험, 캡처, 캡처하위: '캡처-페이블', 캡처판: ['후'], 앞장들, 알리기 });
  if (!시험 && 목록.시험) 자료.시험 = 목록.시험;
  if (!캡처 && 목록.화면) 자료.화면 = 목록.화면;
  if (!캡처 && 목록.가져온캡처) 자료.가져온캡처 = 목록.가져온캡처;
  글쓰기(path.join(폴더, 'diff.patch'), 자료.전체diff);
  const 지금 = { 파일: 자료.파일들.map(({ diff, ...f }) => f), 시험: 자료.시험 || null, 화면: 자료.화면 || null, 가져온캡처: 자료.가져온캡처 || null, 배경: 자료.배경 || null, 때: new Date().toISOString() };
  writeJson(path.join(폴더, '페이블자료.json'), 지금);
  지적표쓰기(폴더, 지적표읽기(폴더));
  return 페이블쓰기(폴더, 목록, 지금);
}

// ── 집계 ───────────────────────────────────────────────────────────
const 닫힘 = new Set(['반영', '재현 안 됨']);
export function 집계하기(목록, 결과들, 표, G결과들 = []) {
  const 셈 = 출처 => {
    const xs = 표.지적.filter(x => x.출처 === 출처), c = k => xs.filter(x => x.처리 === k).length;
    return { 건: xs.length, 반영: c('반영') + c('일부 반영'), 반영만: c('반영'), 일부: c('일부 반영'), 안함: c('반영 안 함'), 재현안됨: c('재현 안 됨'), 후속: c('후속'),
      미정: xs.filter(x => !x.처리).length, 등급: Object.fromEntries(['P0', 'P1', 'P2', 'P3'].map(g => [g, xs.filter(x => x.등급 === g).length])) };
  };
  const 아 = 셈('아르곤'), 지 = 셈('GPT'), 페 = 셈('Fable');
  const 상태표 = rs => 목록.묶음.map(b => { const r = rs.find(x => x.묶음 === b.이름); return { 이름: b.이름, 상태: r?.상태 ?? '안 보냄', 입력같음: r ? r.입력sha256 === b.sha256 : null, 초: r?.초 ?? null, 빠진항목: r?.빠진항목 || [] }; });
  const 묶음상태 = 상태표(결과들), G묶음상태 = 상태표(G결과들);
  const 덜읽음 = 상태 => 상태.filter(b => b.상태 !== '읽음' || b.입력같음 === false);
  const 덜글목록 = 상태 => 덜읽음(상태).filter(b => b.상태 !== '보내는 중');
  const 덜글 = 상태 => 덜글목록(상태).map(b => `${b.이름}(${b.입력같음 === false ? '입력 SHA 다름' : b.상태})`).join(', ');
  const 막힘 = 묶음상태.some(b => b.상태 === '막힘');
  // GPT는 백엔드 2차 검수에 아르곤과 함께(2026-10-22). 보낸 적이 없으면 관문에 넣지 않고(구독이 끝나면 아르곤만), 보냈으면 아르곤처럼 끝까지 읽혀야 친다.
  const G보냄 = G결과들.length > 0, G막힘 = G묶음상태.some(b => b.상태 === '막힘'), G다읽음 = G보냄 && !덜읽음(G묶음상태).length;
  const 페이블있음 = Boolean(표.페이블);
  const 열린 = 표.지적.filter(x => ['P0', 'P1'].includes(x.등급) && (!닫힘.has(x.처리) || (x.출처 === 'Fable' && x.처리 === '반영' && x.재확인 !== '통과')));
  const 조건 = [];
  // 답을 기다리는 묶음이 있으면 앞의 막힘 결과와 상관없이 미충족이다(GPT 2차 검수 GA4)
  const 보내는중 = [...묶음상태.filter(b => b.상태 === '보내는 중').map(b => `아르곤 ${b.이름}`), ...G묶음상태.filter(b => b.상태 === '보내는 중').map(b => `GPT ${b.이름}`)];
  if (보내는중.length) 조건.push(`${보내는중.join(', ')} 묶음을 보내는 중 — 답을 받은 뒤 집계한다`);
  if (덜글목록(묶음상태).length && !막힘) 조건.push(`아르곤 묶음 ${덜글(묶음상태)} — 끝까지 읽힌 묶음만 검수로 친다(0건이어도)`);
  if (G보냄 && !G막힘 && 덜글목록(G묶음상태).length) 조건.push(`GPT 묶음 ${덜글(G묶음상태)} — 끝까지 읽힌 묶음만 검수로 친다(0건이어도)`);
  // 아르곤이 막혀도 백엔드는 GPT가 끝까지 읽었으면 다른 회사 검수가 있는 셈이다. 둘 다 없으면 Fable로 대신한다.
  if (막힘 && !페이블있음 && !(목록.종류 === '백엔드' && G다읽음)) 조건.push(`아르곤이 막혀${G보냄 && !G다읽음 ? '(GPT도 끝까지 못 읽음)' : ''} Fable 검수로 대신해야 한다`);
  else if (목록.종류 === '화면' && !페이블있음) 조건.push('Fable 최종 검수 전');
  for (const x of 열린) 조건.push(`${x.번호} ${x.등급} ${x.처리 ? (x.처리 === '반영' ? '반영 — 같은 Fable 재확인 전' : x.처리) : '처리 미정'}`);
  const 한줄 = `아르곤 ${막힘 && !아.건 ? '막힘(한도·로그인)' : `${아.건}건(반영 ${아.반영})`}${G보냄 || 지.건 ? ` · GPT ${G막힘 && !지.건 ? '막힘(한도·로그인)' : `${지.건}건(반영 ${지.반영})`}` : ''}${페이블있음 || 페.건 ? ` · Fable ${페.건}건(반영 ${페.반영})` : ''}`;
  return { 한줄, 아르곤: 아, GPT: 지, 페이블: 페, 묶음상태, G묶음상태, 막힘, G보냄, G막힘, 페이블있음, 열린, 조건, 배포조건충족: !조건.length,
    안함: 표.지적.filter(x => x.처리 && x.처리 !== '반영'), 미정: 표.지적.filter(x => !x.처리) };
}
function 집계글(목록, 결과들, 표, s) {
  const 셈글 = c => `P0 ${c.등급.P0}·P1 ${c.등급.P1}·P2 ${c.등급.P2}·P3 ${c.등급.P3} · 반영 ${c.반영만}·일부 ${c.일부}·안 함 ${c.안함}·재현 안 됨 ${c.재현안됨}·후속 ${c.후속}·미정 ${c.미정}`;
  const 상태글 = 상태 => 상태.map(b => `${b.이름} ${b.상태}${b.입력같음 === false ? '(입력 SHA 다름)' : ''}${b.초 != null ? ` ${b.초}초` : ''}${b.빠진항목.length ? `(빠짐 ${b.빠진항목.length})` : ''}`).join(' · ');
  return [
    `# 검수 ${목록.이름} — ${목록.종류}`,
    '',
    `- ${s.한줄}`,
    `- 바탕 ${목록.바탕.커밋.slice(0, 9)} → ${목록.끝 === '작업본' ? '작업본' : 목록.끝.커밋.slice(0, 9)} · 묶음 ${목록.묶음.length}개: 아르곤 ${상태글(s.묶음상태)}${s.G보냄 ? ` / GPT ${상태글(s.G묶음상태)}` : ''}`,
    `- 아르곤: ${셈글(s.아르곤)}`,
    ...(s.G보냄 || s.GPT.건 ? [`- GPT: ${셈글(s.GPT)}`] : []),
    ...(s.페이블있음 || s.페이블.건 ? [`- Fable: ${셈글(s.페이블)}${표.페이블 ? ` · ${표.페이블.회차}회 받음` : ''}`] : []),
    `- 배포 조건(재현되는 P0·P1 0건${목록.종류 === '화면' ? ' · Fable 최종 검수' : ''}): ${s.배포조건충족 ? '충족' : `미충족 — ${s.조건.join(' / ')}`}`,
    ...(s.안함.length ? ['', '## 반영하지 않은 것', '', ...s.안함.map(x => `- ${x.번호} ${x.등급} ${x.처리} — ${칸(x.이유)} (${칸(x.위치).slice(0, 80)})`)] : []),
    ...(s.미정.length ? ['', '## 처리 미정', '', ...s.미정.map(x => `- ${x.번호} ${x.등급} ${칸(x.위치).slice(0, 80)} — ${칸(x.문제).slice(0, 160)}`)] : []),
    '', '## 지적표', '', 지적표글(표), '',
  ].join('\n');
}

// ── 명령 ───────────────────────────────────────────────────────────
const 값칸 = new Set(['--종류', '--바탕', '--끝', '--저장소', '--배경', '--시험결과', '--장면', '--시각', '--캡처', '--크기', '--폴더', '--수준']);
const 목록칸 = new Set(['--경로', '--곁', '--시험', '--화면', '--주소뿌리', '--뺌', '--넣음', '--묶음']);
const 켜기칸 = new Set(['--다시', '--시험안함', '--캡처안함', '--새로']);
export function 인자읽기(argv) {
  const [명령, 이름, ...나머지] = argv;
  const o = { 명령, 이름, 경로: [], 남은: [] };
  let 목록 = null;
  for (let i = 0; i < 나머지.length; i++) {
    const a = 나머지[i];
    if (값칸.has(a)) { if (i + 1 >= 나머지.length) throw new Error(`${a} 뒤에 값이 없다`); o[a.slice(2)] = 나머지[++i]; 목록 = null; }
    else if (목록칸.has(a)) { 목록 = a.slice(2) === '경로' ? '경로목록' : a.slice(2); o[목록] ||= []; }
    else if (켜기칸.has(a)) { o[a.slice(2)] = true; 목록 = null; }
    else if (a.startsWith('--')) throw new Error(`모르는 인자 ${a}`);
    else if (목록) o[목록].push(a);
    else (명령 === '준비' ? o.경로 : o.남은).push(a);
  }
  return o;
}
const 쓰는법 = () => {
  const 머리 = [];
  for (const l of fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split(/\r?\n/).slice(1)) { if (!l.startsWith('//')) break; 머리.push(l.replace(/^\/\/ ?/, '')); }
  return 머리.join('\n');
};

async function main(argv) {
  let o;
  try { o = 인자읽기(argv); } catch (e) { console.error(e.message); console.log(쓰는법()); return 2; }
  if (/^gpt$/i.test(o.명령 || '')) o.명령 = 'GPT';
  if (!o.명령 || !o.이름 || !['준비', '아르곤', 'GPT', '처리', '페이블', '페이블받기', '집계'].includes(o.명령)) { console.log(쓰는법()); return 2; }
  const 알리기 = m => console.error(`… ${m}`);
  if (o.명령 === '준비') {
    const { 폴더, 목록 } = await 준비하기(o, { 알리기 });
    console.log(`${폴더}`);
    console.log(`${목록.종류} 검수 · 바탕 ${목록.바탕.커밋.slice(0, 9)} → ${목록.끝 === '작업본' ? '작업본' : 목록.끝.커밋.slice(0, 9)} · 파일 ${목록.파일.length}개(뺌 ${목록.파일.filter(f => f.뺀까닭).length})`);
    for (const b of 목록.묶음) console.log(`  묶음 ${b.이름}: ${Math.round(b.바이트 / 1024)}KB · 항목 ${b.항목.length}개 · ${b.갈래} · sha ${b.sha256.slice(0, 12)} · 끝 표식 ${b.표식}${b.바이트 > 목록.최대바이트 ? ` · 주의: ${목록.최대바이트}바이트를 넘었다(파일 목록이 길다)` : ''}`);
    if (목록.시험) console.log(`  시험: ${시험한줄(목록.시험)}`);
    if (목록.화면) console.log(`  캡처: ${목록.화면.장들.length}장 · 차이 ${목록.화면.차이들.filter(x => !x.같음).length}곳 · 못 연 화면 ${목록.화면.못연.length}${목록.화면.못끼움.length ? ` · 「전」에 못 끼운 바뀐 화면 파일 ${목록.화면.못끼움.length}개(주소 연결 확인: ${목록.화면.못끼움.slice(0, 3).join(', ')})` : ''}${목록.화면.헷갈림.length ? ` · 헷갈린 주소 ${목록.화면.헷갈림.length}(--주소뿌리)` : ''}`);
    if (!목록.배경) console.log('  배경 글 없음 — 무엇을 왜 바꿨는지·글자가 동작에 엮인 곳을 --배경 <파일>로 주면 지적이 정확해진다');
    console.log(`  Fable 요약: ${path.join(폴더, 'fable.md')}`);
    console.log(`다음: node tools/검수묶음.mjs 아르곤 ${목록.이름}   (수준 ${기본수준[목록.종류]} · 묶음 ${목록.묶음.length}개를 하나씩)`);
    return 0;
  }
  const 폴더 = 폴더찾기(o.이름, o.폴더);
  if (!fs.existsSync(path.join(폴더, '묶음.json'))) { console.error(`묶음이 없다: ${폴더}`); return 2; }
  const 목록 = readJson(path.join(폴더, '묶음.json'));
  if (o.명령 === '아르곤') {
    const { 부르기 } = require('./lib/제미나이구독호출.js');
    await 아르곤보내기(폴더, 목록, { 수준: o.수준 || 기본수준[목록.종류], 고른: o.묶음 || null, 다시: Boolean(o.다시), call: 부르기, 알리기 });
    const 표 = 지적표읽기(폴더), 상태들 = 묶음상태들(폴더, 목록);
    console.log(`아르곤 ${상태들.map(b => `${b.이름} ${b.상태}`).join(' · ')} · 지적 ${표.지적.filter(x => x.출처 === '아르곤').length}건 → ${path.join(폴더, '지적표.md')}`);
    console.log(`다음: ${목록.종류 === '백엔드' ? `GPT ${목록.이름}(같이 돌려도 된다) → ` : ''}재현되는 지적만 고치고 node tools/검수묶음.mjs 처리 ${목록.이름} A1=반영 "A2=재현안됨:<이유>" … → ${목록.종류 === '백엔드' ? '집계' : '페이블'} ${목록.이름}`);
    return 상태들.every(b => b.상태 === '읽음') ? 0 : 1;
  }
  if (o.명령 === 'GPT') {
    const 계정들 = await GPT계정들읽기();
    const 계정 = GPT계정가리기(계정들);
    알리기(`GPT 계정: ${계정들.map(a => `${계정말(a)} ${a.요금제 || '?'} 주간 ${a.주간사용 ?? '?'}%`).join(' · ')} → ${계정 ? 계정말(계정) : `없음(주간 ${GPT주간한계}% 아래인 Pro 계정 없음 — 막힘으로 적는다)`}`);
    await GPT보내기(폴더, 목록, { 수준: o.수준 || null, 고른: o.묶음 || null, 다시: Boolean(o.다시), call: a => GPT부르기({ ...a, 계정 }), 몫: () => (계정 ? GPT몫읽기(계정) : null), 알리기 });
    const 표 = 지적표읽기(폴더), 상태들 = 묶음상태들(폴더, 목록, 'GPT');
    console.log(`GPT ${상태들.map(b => `${b.이름} ${b.상태}`).join(' · ')} · 지적 ${표.지적.filter(x => x.출처 === 'GPT').length}건 → ${path.join(폴더, '지적표.md')}`);
    console.log(`다음: 재현되는 지적만 고치고 node tools/검수묶음.mjs 처리 ${목록.이름} GA1=반영 "GA2=재현안됨:<이유>" … → 집계 ${목록.이름}`);
    return 상태들.every(b => b.상태 === '읽음') ? 0 : 1;
  }
  if (o.명령 === '처리') {
    if (!o.남은.length) { console.error('처리할 지적을 준다: <번호>=<반영|일부|안함|재현안됨|후속>[:<이유>] … 또는 <번호>=재확인'); return 2; }
    let 미정 = 0;
    const 바뀜 = 지적표고치기(폴더, 표 => { const b = 처리하기(표, o.남은); 미정 = 표.지적.filter(x => !x.처리).length; return b; });
    console.log(`처리 ${바뀜.join(', ')} · 미정 ${미정}건 → ${path.join(폴더, '지적표.md')}`);
    return 0;
  }
  if (o.명령 === '페이블') {
    const 파일 = await 페이블하기(폴더, { 시험: !o.시험안함, 캡처: !o.캡처안함, 알리기 });
    console.log(파일);
    console.log(`다음: Agent 도구(model: fable)에 「${파일}을 읽고 그대로 검수하라」를 주고, 답을 받으면 node tools/검수묶음.mjs 페이블받기 ${목록.이름}`);
    return 0;
  }
  if (o.명령 === '페이블받기') {
    const 답파일 = o.남은[0] ? path.resolve(o.남은[0]) : path.join(폴더, '페이블-답.json');
    const 답 = 페이블답읽기(fs.readFileSync(답파일, 'utf8'));
    let 페건 = 0;
    const 더함 = 지적표고치기(폴더, 표 => { const d = 페이블지적넣기(표, 답, { 새로: Boolean(o.새로) }); 페건 = 표.지적.filter(x => x.출처 === 'Fable').length; return d; });
    console.log(`Fable 지적 ${더함.length}건 더함(${더함.join(', ') || '없음'}) · Fable ${페건}건 → ${path.join(폴더, '지적표.md')}`);
    return 0;
  }
  if (o.명령 === '집계') {
    // 지적표·결과·표시를 한 잠금 안에서 읽는다 — 다른 프로세스가 결과와 지적표를 쓰는 사이에 읽으면 옛 지적표로 판정한다(3차 검수 GA1)
    const { 표, 결과들, G결과들 } = 잠근채(폴더, () => ({ 표: 지적표읽기(폴더), 결과들: 결과들읽기(폴더, 목록), G결과들: 결과들읽기(폴더, 목록, 'GPT') }));
    const s = 집계하기(목록, 결과들, 표, G결과들);
    const 글 = 집계글(목록, 결과들, 표, s);
    글쓰기(path.join(폴더, '보고.md'), 글);
    // 첫 덩이(한 줄 집계·묶음·셈·배포 조건)만 — 제목 다음부터 첫 빈 줄까지
    const 줄들 = 글.split('\n').slice(2);
    console.log(줄들.slice(0, 줄들.indexOf('') < 0 ? 줄들.length : 줄들.indexOf('')).join('\n'));
    console.log(`→ ${path.join(폴더, '보고.md')}`);
    return s.배포조건충족 ? 0 : 1;
  }
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, error => { console.error(error.stack || error.message); process.exitCode = 2; });
}
