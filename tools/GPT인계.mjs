#!/usr/bin/env node
// GPT 인계(2026-10-22) — 유호님 손이 필요한 일을 GPT(Codex 앱)에 붙여 넣을 한 단락(카드)으로 만들고, GPT가 남긴 결과를 Claude가 저절로 받아 온다.
// 유호님 손은 「붙여 넣기」 한 번이다. Claude가 GPT를 사람 없이 띄워 그 일을 시키지는 않는다 — 비밀번호·인증 코드·결제·가입·영구 삭제·권한 바꾸기는
// 어느 AI가 하든 같은 일이라, 카드는 GPT가 그 화면에서 멈추고 유호님께 한 줄로 넘기게 적는다(docs/AI_운영원칙.md 「비용과 권한」).
// 결과는 두 길로 받는다: ① GPT가 카드에 적힌 파일(결과.md)에 쓴 것 ② 쓰지 못했으면 Codex 대화 기록(~/.codex/sessions)에서 카드 표를 찾아 그 턴의 마지막 답.
//
//   node tools/GPT인계.mjs 준비 <이름> --할일 "<할 일>" | --할일파일 <파일> [--대상 "<사이트·계정>"] [--클립보드안함]
//       카드(지시.md)를 만들고 클립보드에 올린다. 유호님은 Codex 앱에 붙여 넣기만 한다.
//   node tools/GPT인계.mjs 기다리기 <이름> [--분 <N>(기본 180)]
//       결과가 오면 찍고 끝낸다(종료 0). GPT가 끝 표식 없이 턴을 마쳤으면(유호님 손을 기다림) 그 말을 찍고 종료 3, 시간이 넘으면 종료 1.
//       Claude는 준비 직후 이 명령을 백그라운드로 띄워, 끝나는 알림으로 결과를 받아 보고한다.
//   node tools/GPT인계.mjs 확인 <이름>      지금 한 번만 본다(종료 코드는 기다리기와 같고, 아직이면 2)
//   node tools/GPT인계.mjs 목록             열린 인계와 상태
//   폴더는 <공용 작업본>/.tmp/GPT인계/<이름>/ — 지시.md · 상태.json · 결과.md(GPT가 씀). 시험 이음매: SYNK_GPT_HANDOFF_DIR, CODEX_HOME, SYNK_NO_CLIPBOARD.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const 끝표식 = 'GPT_인계_끝';
const 상태들 = ['끝', '일부', '막힘'];
const 슬래시 = p => p.split(path.sep).join('/');
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, JSON.stringify(v, null, 2) + '\n'); fs.renameSync(t, f); };

function 공용작업본() {
  const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: root, encoding: 'utf8', windowsHide: true });
  const common = r.status === 0 ? r.stdout.trim() : '';
  return common && path.basename(common) === '.git' ? path.dirname(common) : root;
}
export const 뿌리 = () => process.env.SYNK_GPT_HANDOFF_DIR || path.join(공용작업본(), '.tmp', 'GPT인계');
export function 폴더찾기(이름) {
  if (!이름 || /[\\/:*?"<>|\s]/.test(이름) || /^\.+$/.test(이름)) throw new Error(`이름은 띄어쓰기·경로 글자 없이: ${이름 || '(없음)'}`);
  const 폴더 = path.join(뿌리(), 이름);
  if (path.dirname(폴더) !== path.resolve(뿌리())) throw new Error(`이름은 인계 폴더 바로 아래 한 칸이어야 한다: ${이름}`);   // . · .. 로 뿌리 밖을 가리키지 않게(검수 A2·GA1)
  return 폴더;
}

/** GPT가 읽을 카드. 표(토큰)는 대화 기록에서 이 카드를 찾는 열쇠이고, 끝 표식 줄에도 들어가 다른 카드의 결과와 섞이지 않는다. */
export function 카드글({ 이름, 표, 할일, 대상 = '', 결과파일 }) {
  return [
    `[SYNK GPT 인계 · ${이름} · ${표}]`,
    '유호님 대신 Claude가 정리한 일이에요. 아래 한 가지만 해 주세요.',
    '',
    `할 일: ${할일.trim()}`,
    ...(대상 ? [`대상: ${대상.trim()}`] : []),
    '',
    '지킬 것',
    '- 인터넷 작업은 ego-browser 스킬(ego(lite) 브라우저)로 하고 유호님이 쓰는 탭은 건드리지 않는다. ego에서 막히면 Codex 크롬 확장으로 넘어간다.',
    '- 적힌 일만 한다. 다른 설정·권한·결제·삭제·게시·보내기는 건드리지 않는다.',
    '- 비밀번호·인증 코드·휴대폰 2단계 인증·캡차·결제 확인 화면이 나오면 거기서 멈추고, 유호님께 「지금 화면에서 무엇을 해 주시면 되는지」를 한 줄로 말한 뒤 기다린다. 유호님이 끝내면 이어서 한다.',
    '- 이 대화에 비밀번호·키·인증 코드를 적지 않는다.',
    '',
    '끝나면(막혀서 멈춘 경우도) 결과를 아래 파일에 쓴다.',
    `  ${결과파일}`,
    `  첫 줄: 상태: ${상태들.join(' | ')}`,
    '  다음 줄부터: 한 일 · 못 한 일과 까닭 · Claude가 확인하려면 볼 곳(주소·화면 이름)',
    `  마지막 줄: ${끝표식} ${표}`,
    `파일을 쓸 수 없으면 같은 내용을 마지막 답으로 남긴다(마지막 줄 「${끝표식} ${표}」까지). Claude가 Codex 대화 기록에서 읽는다.`,
  ].join('\n');
}

/** 결과 글에서 상태·본문을 읽는다. 끝 표식(그 표)이 마지막 줄이 아니면 null — 쓰다 만 파일이나 다른 카드의 결과다. */
export function 결과읽기(글, 표) {
  const 줄들 = String(글 || '').replace(/\r\n/g, '\n').replace(/\s+$/, '').split('\n');
  if ((줄들.at(-1) || '').trim() !== `${끝표식} ${표}`) return null;
  const 머리 = /^\s*상태\s*[:：]\s*(\S+)/.exec(줄들.find(l => /^\s*상태\s*[:：]/.test(l)) || '');
  return { 상태: 머리 && 상태들.includes(머리[1]) ? 머리[1] : '모름', 본문: 줄들.slice(0, -1).join('\n').trim() };
}

/** Codex 대화 기록 폴더들(본 계정 + 굽기 장부 계정). 카드는 유호님이 쓰는 GPT 앱(본 계정)에 붙지만 다른 폴더도 같이 본다. */
export function 기록폴더들() {
  const 집 = os.homedir();
  const 홈들 = [process.env.CODEX_HOME || path.join(집, '.codex')];
  const 굽기 = process.env.CODEX_BAKE_DIR || path.join(집, '.codex-bake');
  if (!process.env.CODEX_HOME && fs.existsSync(굽기)) for (const d of fs.readdirSync(굽기)) if (fs.statSync(path.join(굽기, d)).isDirectory()) 홈들.push(path.join(굽기, d));
  return 홈들.flatMap(h => ['sessions', 'archived_sessions'].map(s => path.join(h, s))).filter(d => fs.existsSync(d));
}
function* 기록파일들(폴더, 이후ms) {
  for (const 이름 of fs.readdirSync(폴더)) {
    const p = path.join(폴더, 이름);
    let st;
    try { st = fs.lstatSync(p); } catch { continue; }
    if (st.isSymbolicLink()) continue;   // 링크·정션은 따라가지 않는다 — 위 폴더로 되돌아가 끝없이 훑지 않게(검수 GA4)
    if (st.isDirectory()) yield* 기록파일들(p, 이후ms);
    else if (/\.jsonl$/.test(이름) && st.mtimeMs >= 이후ms) yield [p, st.size];
  }
}
// 카드를 이미 열린 Codex 대화에 붙이면 그 기록 파일은 며칠 전에 만들어졌고, Windows는 열린 채 덧붙이는 파일의 수정 시각을 늦게 갱신한다
// (현장노트 「GPT가 끝났는지를 기록 파일의 수정 시각으로 보면 틀린다」). 그래서 최근 7일 기록을 다 보되, 크기가 그대로이고 표가 없던 파일은 다시 읽지 않는다.
const 훑는날 = 7;
const 안든파일 = new Map();   // 경로 → 표가 없던 때의 크기(표마다)
const 글꺼내기 = content => (Array.isArray(content) ? content.map(c => c?.text || '').join('') : String(content || ''));

/** 대화 기록 하나에서 카드를 찾는다: 카드 표가 든 사용자 말 뒤로, 맨 마지막 턴의 답과 그 턴이 끝났는지.
 *  사용자 말이 새로 올 때마다(「넣었어 이어서 해」, 같은 카드를 다시 붙임) 앞 턴의 답·끝남을 지운다 — 진행 중인 새 턴을 앞 턴 결과로 읽지 않게(검수 A1·GA2). */
export function 기록읽기(줄글, 표) {
  let 찾음 = false, 마지막답 = null, 끝난턴 = false;
  for (const 줄 of 줄글.split('\n')) {
    if (!줄.trim()) continue;
    let e;
    try { e = JSON.parse(줄); } catch { continue; }
    const p = e?.payload;
    if (e.type === 'response_item' && p?.type === 'message' && p.role === 'user') {
      if (글꺼내기(p.content).includes(표)) 찾음 = true;
      if (찾음) { 끝난턴 = false; 마지막답 = null; }
      continue;
    }
    if (!찾음) continue;
    if (e.type === 'response_item' && p?.type === 'message' && p.role === 'assistant') { const t = 글꺼내기(p.content).trim(); if (t) 마지막답 = t; }
    if (e.type === 'event_msg' && p?.type === 'task_complete') { 끝난턴 = true; if (p.last_agent_message) 마지막답 = String(p.last_agent_message).trim(); }
  }
  return 찾음 ? { 마지막답, 끝난턴 } : null;
}

/** 지금 상태: 결과 파일 → 대화 기록 순서. { 꼴: '결과'|'기다림'|'아직', 상태, 본문, 출처 } */
export function 살피기(폴더) {
  const 정보 = readJson(path.join(폴더, '상태.json'));
  const 결과파일 = path.join(폴더, '결과.md');
  if (fs.existsSync(결과파일)) {
    const r = 결과읽기(fs.readFileSync(결과파일, 'utf8'), 정보.표);
    if (r) return { 꼴: '결과', ...r, 출처: '결과.md' };
  }
  const 이후 = Date.parse(정보.만든때) - 훑는날 * 86_400_000;
  let 기다림 = null;
  for (const 기록폴더 of 기록폴더들()) {
    for (const [f, 크기] of 기록파일들(기록폴더, 이후)) {
      const 열쇠 = `${정보.표}\0${f}`;
      if (안든파일.get(열쇠) === 크기) continue;
      let 글;
      try { 글 = fs.readFileSync(f, 'utf8'); } catch { continue; }
      if (!글.includes(정보.표)) { 안든파일.set(열쇠, 크기); continue; }
      const k = 기록읽기(글, 정보.표);
      if (!k) continue;
      const r = k.마지막답 && 결과읽기(k.마지막답, 정보.표);
      if (r) return { 꼴: '결과', ...r, 출처: 슬래시(f) };
      if (k.끝난턴 && k.마지막답) 기다림 = { 꼴: '기다림', 상태: null, 본문: k.마지막답, 출처: 슬래시(f) };
    }
  }
  return 기다림 || { 꼴: '아직', 상태: null, 본문: '', 출처: null };
}

function 클립보드(글) {
  if (process.env.SYNK_NO_CLIPBOARD) return false;
  if (process.platform !== 'win32') return false;
  const 임시 = path.join(os.tmpdir(), `synk-gpt-handoff-${process.pid}.txt`);
  fs.writeFileSync(임시, 글, 'utf8');
  try {
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Set-Clipboard -Value ([IO.File]::ReadAllText('${임시.replace(/'/g, "''")}', [Text.Encoding]::UTF8))`], { windowsHide: true, timeout: 20_000 });
    return r.status === 0;
  } finally { fs.rmSync(임시, { force: true }); }
}

export function 준비하기({ 이름, 할일, 대상 = '' }) {
  if (!할일 || !String(할일).trim()) throw new Error('--할일 "<할 일>" 또는 --할일파일 <파일>이 필요하다');
  폴더찾기(이름);   // 이름 검사를 폴더를 만들기 전에
  const 폴더 = 폴더찾기(이름);
  // 이름은 폴더를 배타로 만들어 먼저 잡는다 — 같은 이름으로 둘이 동시에 준비해도 카드·상태의 표가 엇갈리지 않게(검수 GA3)
  fs.mkdirSync(뿌리(), { recursive: true });
  try { fs.mkdirSync(폴더); }
  catch (e) { if (e.code === 'EEXIST') throw new Error(`이미 있는 인계: ${폴더} — 다른 이름을 쓴다`); throw e; }
  const 표 = crypto.randomBytes(6).toString('hex');
  const 결과파일 = 슬래시(path.join(폴더, '결과.md'));
  const 글 = 카드글({ 이름, 표, 할일, 대상, 결과파일 });
  fs.writeFileSync(path.join(폴더, '지시.md'), 글 + '\n');
  writeJson(path.join(폴더, '상태.json'), { 이름, 표, 만든때: new Date().toISOString(), 할일: String(할일).trim(), 대상, 결과파일 });
  return { 폴더, 표, 글 };
}

const 쉬기 = ms => new Promise(r => setTimeout(r, ms));
export const 최대분 = 24 * 60;
export async function 기다리기(폴더, { 분 = 180, 간격ms = 10_000 } = {}) {
  // 숫자가 아니거나 끝없는 값이면 시간 제한이 영영 오지 않는다(검수 A3·GA5)
  if (!Number.isFinite(분) || 분 <= 0 || 분 > 최대분) throw new Error(`--분은 0보다 크고 ${최대분} 이하인 숫자여야 한다(받음 ${분})`);
  const 끝 = Date.now() + 분 * 60_000;
  for (;;) {
    const s = 살피기(폴더);
    if (s.꼴 !== '아직') return s;
    if (Date.now() > 끝) return s;
    await 쉬기(간격ms);
  }
}

function 보이기(이름, s) {
  if (s.꼴 === '결과') return `GPT 인계 ${이름} — 결과(상태: ${s.상태}, ${s.출처})\n\n${s.본문}`;
  if (s.꼴 === '기다림') return `GPT 인계 ${이름} — GPT가 끝 표식 없이 턴을 마쳤다(유호님 손을 기다리는 것으로 보인다, ${s.출처})\n\n${s.본문}`;
  return `GPT 인계 ${이름} — 아직 결과 없음`;
}
const 종료 = s => (s.꼴 === '결과' ? 0 : s.꼴 === '기다림' ? 3 : null);

function 인자읽기(argv) {
  const [명령, ...나머지] = argv;
  const o = { 명령, 남은: [] };
  for (let i = 0; i < 나머지.length; i++) {
    const a = 나머지[i];
    if (['--할일', '--할일파일', '--대상', '--분'].includes(a)) { if (i + 1 >= 나머지.length) throw new Error(`${a} 뒤에 값이 없다`); o[a.slice(2)] = 나머지[++i]; }
    else if (a === '--클립보드안함') o.클립보드안함 = true;
    else if (a.startsWith('--')) throw new Error(`모르는 인자 ${a}`);
    else o.남은.push(a);
  }
  return o;
}
const 쓰는법 = () => fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split(/\r?\n/).slice(1).filter(l => l.startsWith('//')).map(l => l.replace(/^\/\/ ?/, '')).join('\n');

async function main(argv) {
  let o;
  try { o = 인자읽기(argv); } catch (e) { console.error(e.message); return 2; }
  const 이름 = o.남은[0];
  if (o.명령 === '준비') {
    const 할일 = o.할일파일 ? fs.readFileSync(path.resolve(o.할일파일), 'utf8') : o.할일;
    const { 폴더, 글 } = 준비하기({ 이름, 할일, 대상: o.대상 || '' });
    const 올림 = !o.클립보드안함 && 클립보드(글);
    console.log(글);
    console.log(`\n→ ${슬래시(path.join(폴더, '지시.md'))}`);
    console.log(올림 ? '클립보드에 올렸다 — 유호님은 Codex 앱 새 대화에 붙여 넣기만 하면 된다.' : `클립보드에 ${o.클립보드안함 ? '올리지 않았다(--클립보드안함)' : '올리지 못했다'} — 위 단락을 그대로 Codex 앱에 붙여 넣는다.`);
    console.log(`다음(Claude): node tools/GPT인계.mjs 기다리기 ${이름}  — 백그라운드로 띄워 끝나는 알림을 받는다`);
    return 0;
  }
  if (o.명령 === '기다리기' || o.명령 === '확인') {
    const 폴더 = 폴더찾기(이름);
    if (!fs.existsSync(path.join(폴더, '상태.json'))) { console.error(`없는 인계: ${폴더}`); return 2; }
    const 분 = o.분 == null ? 180 : Number(o.분);
    if (!Number.isFinite(분) || 분 <= 0 || 분 > 최대분) { console.error(`--분은 0보다 크고 ${최대분} 이하인 숫자여야 한다(받음 ${o.분})`); return 2; }
    const s = o.명령 === '확인' ? 살피기(폴더) : await 기다리기(폴더, { 분 });
    console.log(보이기(이름, s));
    if (s.꼴 !== '아직') writeJson(path.join(폴더, '상태.json'), { ...readJson(path.join(폴더, '상태.json')), 마지막확인: new Date().toISOString(), 꼴: s.꼴, 상태: s.상태, 출처: s.출처 });
    return 종료(s) ?? (o.명령 === '확인' ? 2 : 1);
  }
  if (o.명령 === '목록') {
    let 수 = 0;
    for (const d of fs.existsSync(뿌리()) ? fs.readdirSync(뿌리()).sort() : []) {
      const f = path.join(뿌리(), d, '상태.json');
      if (!fs.existsSync(f)) continue;
      const s = 살피기(path.join(뿌리(), d)), 정보 = readJson(f);
      console.log(`${d}  ${정보.만든때.slice(0, 16).replace('T', ' ')}  ${s.꼴}${s.상태 ? `(${s.상태})` : ''}  ${정보.할일.split('\n')[0].slice(0, 60)}`);
      수++;
    }
    if (!수) console.log('인계 없음');
    return 0;
  }
  console.log(쓰는법());
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, e => { console.error(e.stack || e.message); process.exitCode = 2; });
}
