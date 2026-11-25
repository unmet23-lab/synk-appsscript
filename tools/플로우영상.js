#!/usr/bin/env node
'use strict';
/**
 * 플로우영상 — 매일 편(LAB · synkbrief · yuhobuilds)의 장면을 샷마다 Flow Omni 1.2 Flash 영상으로 굽는다(2026-11-25 Claude, 11-26 세 계정으로 넓힘).
 * 결정 11-25 「LAB 영상 칸 엔진 · Omni 1.2 Flash · Veo 안 씀」 · 「LAB 편 전체를 영상으로」, 11-26 「Flow 크레딧은 매일 편에만 · 두 계정」. 시험과 근거는
 * docs/마케팅/LAB_하루두편_설계_20261110/검토/영상시험_20261125/README.md, 절차는 제작 절차 「LAB 영상 칸」.
 * 브라우저 조작은 tools/플로우영상/(광명역 공모 편 Flow 실행기를 옮긴 것)이 하고, 이 파일은 편 폴더 설정을 읽어 차례대로 부른다.
 *
 *   node tools/플로우영상.js 점검 <편 폴더>            계획 · 지시문 · 시작 그림만 본다(브라우저 · 크레딧 없음)
 *   node tools/플로우영상.js 준비 <편 폴더>            점검 → Flow 프로젝트 만들기(처음 한 번) → 시작 그림 올리기(안 올린 것만). 크레딧 없음
 *   node tools/플로우영상.js 굽기 <편 폴더> [칸…]      칸(샷)마다 한 판 굽고 영상칸/받음/<칸>_<a|b|…>.mp4로 받는다(칸을 안 주면 계획의 모든 칸). 끝에 작업 공간을 닫는다
 *   node tools/플로우영상.js 띠 <편 폴더> <칸> [판]    받은 판을 0.5초 간격 띠(영상칸/flow/<칸>_<판>_띠.jpg)로 — 몽글 검사용
 *   node tools/플로우영상.js 넣기 <편 폴더> <칸> [판]  고른 판(기본 a)을 remotion/public/vid/<칸>.mp4로 복사한다
 *   node tools/플로우영상.js 계정                      두 Flow 계정의 마지막으로 읽은 크레딧 · 경고 · 다시 차는 때와 지금 고를 계정을 보인다
 *   준비 · 굽기에 --계정 <77yuhbs|unmet23>을 주면 그 계정으로만 낸다. 안 주면 샷마다 고른다: 오늘 「비정상적인 활동」이 두 번 났거나
 *   3시간 안에 한 번 난 계정은 빼고, 남은 크레딧이 그 샷 값 + 바닥(300)보다 적은 계정도 빼고, 남은 것 가운데 다시 차는 때가 먼저 오는
 *   계정(그때 사라질 크레딧)부터 쓴다. 고른 계정에 이 편의 프로젝트 · 그림이 없으면 그 자리에서 만들고 올린다. 계정 상태는
 *   여러 세션이 같이 보는 synk-vendor/_공용차례/flow_계정.json에 남는다.
 *
 * 편 폴더의 영상칸/:
 *   계획.json   { "_예산": 180, "_누적상한": <없으면 뺀다>, "<칸>": { "model": "Omni 1.2 Flash", "n": 1, "cost": "12", "dur": "4초", "proj": "omni", "start": "<시작 그림 이름>", "end": "<끝 그림 이름 — 없으면 뺀다>", "key": "<지시문 속 한 번만 나오는 구절>" } }
 *   지시문.json { "공통": "<모든 칸 뒤에 붙는 글>", "클립": [{ "id": "<칸>", "prompt": "<칸 글>" }] }
 *   시작/<start>.jpg · 시작/<end>.jpg  1080×1920(9:16) 시작 · 끝 그림 — 그 샷의 GPT 판을 맞춘 것
 *   계획.json의 _배우는말(11-26 편부터 꼭): [{ "말": "시려", "한글": "손 시려…", "읽기": "сон сирё…", "뜻": "Гар даарч байна…", "초": 3.5, "칸": ["s04"], "음성": ["f2", "f2b"] }]
 *     배우는 말 칸은 3.5초 넘게, 글(한글 · 읽기 · 뜻)은 초당 13자 안, 뜻은 한 줄, 목소리는 초당 3.5음절 안으로 두 번(제작 절차 「배우는 말 칸은 천천히」 — 11-26 유호님).
 *     편 코드(remotion/src)와 목소리(public/vo의 vo.json)가 있으면 실제 at · to와 음절 빠르기까지 본다. 그래서 렌더하기 전에 점검을 한 번 더 돌린다.
 * 지키는 것: 모델은 Omni 1.2 Flash만, 값은 720p 1초 3크레딧(4초 12 · 8초 24)이라 계획 값이 「길이 × 3」이 아니면 멈춘다.
 *   접수 뒤 계정에 남을 크레딧이 1,000 밑이면 내지 않는다(실행기 FLOOR — 그 편은 정지 그림 판으로).
 *   _예산(기본 180)은 첫 굽기 계획 합의 상한이라 점검만 본다. 떨어진 샷은 계정 바닥까지 다시 굽는다(11-25 유호님 「크레딧 모자라는거 아니면 끝까지 진행해」).
 *   _누적상한을 적은 편만 다시 굽기까지 합한 값이 넘을 때 실행기가 멈춘다. 「다시 시도」 · 업스케일 · 결제 단추는 누르지 않는다(tools/플로우영상/lib.mjs 머리).
 * 종료 코드: 0 = 됨 · 1 = 점검 걸림 · 굽기 실패 · 2 = 사용법 · 실행 오류.  시험: node --test tests/플로우영상.test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const os = require('node:os');

const 실행기 = path.join(__dirname, '플로우영상');
const OMNI = 'Omni 1.2 Flash';
const 초당 = 3;
const 기본예산 = 180;
// Flow 계정 둘(11-26 유호님 「둘 다 울트라 결재했어」). 다시 차는 때는 그 계정 Flow 프로필 「… 초기화」(11-26 읽음, KST)
const 계정들 = Object.freeze(['77yuhbs', 'unmet23']);
const 다시참 = Object.freeze({ '77yuhbs': { 날: 1, 시: 21, 분: 29 }, unmet23: { 날: 26, 시: 6, 분: 37 } });
const 바닥 = 300; // tools/플로우영상/lib.mjs FLOOR와 같게
const 경고쉼 = 3 * 3600 * 1000;
const 상태파일 = () => process.env.SYNK_FLOW_ACCOUNTS || path.join(os.homedir(), 'Documents', 'synk-vendor', '_공용차례', 'flow_계정.json');
const 열쇠 = (계정, 기본 = 'omni') => (계정 === '77yuhbs' ? 기본 : `${기본}@${계정}`);
const 올림열쇠 = (계정) => (계정 === '77yuhbs' ? '_올림' : `_올림@${계정}`);
// 배우는 말 칸(11-26 유호님 「너무 빨라서 조금만 천천히」 → 「넣어 줘」). 글 빠르기 13자는 넷플릭스 어린이 자막 상한(여러 언어 판 — 빈칸까지 센다)이다
const 배움 = { 시작일: '20261126', 초: 3.5, 글: 13, 음절: 3.5, 틈: 0.05 };

const 슬래시 = (p) => path.resolve(p).split(path.sep).join('/');
const 읽기 = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** 계획 · 지시문 · 시작 그림을 본다 → { 문제: [], 칸: [id…], 예산, 합 } */
function 점검(편) {
  const 문제 = [];
  const V = path.join(편, '영상칸');
  let 계획 = null; let 지시 = null;
  try { 계획 = 읽기(path.join(V, '계획.json')); } catch (e) { 문제.push(`영상칸/계획.json을 못 읽음 — ${e.message}`); }
  try { 지시 = 읽기(path.join(V, '지시문.json')); } catch (e) { 문제.push(`영상칸/지시문.json을 못 읽음 — ${e.message}`); }
  const 알림 = [];
  if (!계획 || !지시) return { 문제, 알림, 칸: [], 예산: 0, 합: 0 };
  const 예산 = 계획._예산 == null ? 기본예산 : Number(계획._예산);
  if (!(예산 > 0)) 문제.push(`_예산이 수가 아님: ${계획._예산}`);
  const 칸 = Object.keys(계획).filter((k) => !k.startsWith('_'));
  if (!칸.length) 문제.push('계획.json에 칸이 없음');
  const 글 = {};
  for (const c of Array.isArray(지시.클립) ? 지시.클립 : []) 글[c.id] = `${c.prompt || ''} ${c.공통 || 지시.공통 || ''}`;
  if (!Array.isArray(지시.클립)) 문제.push('지시문.json에 「클립」 배열이 없음');
  let 합 = 0;
  for (const id of 칸) {
    const p = 계획[id];
    if (!/^[A-Za-z0-9_-]+$/.test(id)) 문제.push(`${id}: 칸 이름은 영문 · 숫자 · _ · -만`);
    if (p.model !== OMNI) 문제.push(`${id}: 모델이 ${OMNI}가 아님(${p.model}) — 매일 편 영상 칸은 Omni만(결정 11-25 · 11-26)`);
    if (p.proj !== 'omni') 문제.push(`${id}: proj는 "omni"`);
    if (p.n !== 1) 문제.push(`${id}: n은 1(한 번에 한 판)`);
    const 초 = Number(String(p.dur || '').replace(/[^0-9]/g, ''));
    if (!(초 >= 3 && 초 <= 10) || p.dur !== `${초}초`) 문제.push(`${id}: dur는 "3초"~"10초"(지금 ${p.dur})`);
    else if (String(p.cost) !== String(초 * 초당)) 문제.push(`${id}: cost가 ${초 * 초당}이어야 함(Omni 720p 1초 ${초당}크레딧, 지금 ${p.cost})`);
    합 += Number(p.cost) || 0;
    if (!p.start || !fs.existsSync(path.join(V, '시작', `${p.start}.jpg`))) 문제.push(`${id}: 시작 그림 영상칸/시작/${p.start}.jpg가 없음`);
    else {
      const 크기 = jpg크기(path.join(V, '시작', `${p.start}.jpg`));
      if (!크기 || Math.abs(크기.w / 크기.h - 9 / 16) > 0.01) 문제.push(`${id}: 시작 그림이 9:16이 아님(${크기 ? `${크기.w}x${크기.h}` : '크기 못 읽음'})`);
    }
    if (p.end != null) {
      const 끝 = path.join(V, '시작', `${p.end}.jpg`);
      if (!fs.existsSync(끝)) 문제.push(`${id}: 끝 그림 영상칸/시작/${p.end}.jpg가 없음`);
      else { const k = jpg크기(끝); if (!k || Math.abs(k.w / k.h - 9 / 16) > 0.01) 문제.push(`${id}: 끝 그림이 9:16이 아님`); }
    }
    if (!글[id]) 문제.push(`${id}: 지시문.json에 이 칸 글이 없음`);
    else {
      if (!p.key || 글[id].split(p.key).length - 1 !== 1) 문제.push(`${id}: key가 이 칸 글에 한 번이 아님`);
      for (const [oid, t] of Object.entries(글)) if (oid !== id && p.key && t.includes(p.key)) 문제.push(`${id}: key가 ${oid} 글에도 있음`);
      // 기본 상태의 몽글은 코와 입이 없고, 감정이 바뀌면 입까지 바뀌어도 된다(11-25 유호님 — 제작 절차 「몽글 표정」). LAB 편과 몽글이 나오는 샷만
      if ((LAB편(편) || /MONGLE/i.test(글[id])) && !/no mouth/i.test(글[id])) 문제.push(`${id}: 지시문에 몽글의 기본 얼굴(코 · 입 없음) 글이 없음(제작 절차 「편 전체를 영상으로」의 영상 공통 글을 쓴다)`);
      if (/no mouth[^.]{0,80}\bever\b/i.test(글[id])) 알림.push(`${id}: 「NO mouth … ever」가 표정을 막는다 — 영상 공통 글로 바꾼다(제작 절차 「몽글 표정」)`);
    }
  }
  if (합 > 예산) 문제.push(`계획 합 ${합}이 편 예산 ${예산}을 넘음`);
  배움점검(편, 계획, 문제, 알림);
  return { 문제, 알림, 칸, 예산, 합 };
}

const LAB편 = (편) => /^LAB_/.test(path.basename(path.resolve(편)));
const 글자수 = (s) => [...String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim()].length;
const 둘째자리 = (n) => Math.round(n * 100) / 100;

function 파일들(뿌리, 맞음, 깊이 = 5) {
  let 이름 = [];
  try { 이름 = fs.readdirSync(뿌리, { withFileTypes: true }); } catch { return []; }
  return 이름.flatMap((e) => {
    const f = path.join(뿌리, e.name);
    if (e.isDirectory()) return 깊이 > 0 && e.name !== 'node_modules' ? 파일들(f, 맞음, 깊이 - 1) : [];
    return 맞음(e.name) ? [f] : [];
  });
}

/** 편 코드에서 key가 그 말인 글 칸의 길이(초) — at · to가 숫자인 것만. 같은 말이 다시 나오면 가장 긴 칸 */
function 코드칸초(글들, 말) {
  const 길이 = [];
  for (const 글 of 글들) {
    for (const [칸글] of 글.matchAll(/\{[^{}]*\}/g)) {
      const k = 칸글.match(/\bkey:\s*(['"`])(.*?)\1/);
      if (!k || k[2] !== 말) continue;
      const at = 칸글.match(/\bat:\s*(\d+(?:\.\d+)?)\s*[,}]/);
      const to = 칸글.match(/\bto:\s*(\d+(?:\.\d+)?)\s*[,}]/);
      if (at && to) 길이.push(Number(to[1]) - Number(at[1]));
    }
  }
  return 길이.length ? Math.max(...길이) : null;
}

/** 배우는 말 칸은 천천히(제작 절차 lab-learn-pace) — 크레딧을 쓰기 전에 계획으로, 렌더 전에 편 코드와 목소리로 본다 */
function 배움점검(편, 계획, 문제, 알림) {
  if (!LAB편(편)) return; // 배우는 말은 LAB 편에만 있다
  const 날짜 = (path.basename(path.resolve(편)).match(/_(\d{8})$/) || [])[1];
  const 말들 = 계획._배우는말;
  if (말들 == null) {
    if (!날짜 || 날짜 >= 배움.시작일) 문제.push('_배우는말이 없음 — 배우는 말마다 한글 · 읽기 · 뜻 · 초 · 칸 · 음성을 적는다(제작 절차 「배우는 말 칸은 천천히」)');
    return;
  }
  if (!Array.isArray(말들) || !말들.length) { 문제.push('_배우는말이 빈 목록이거나 목록이 아님'); return; }
  const 코드 = 파일들(path.join(편, 'remotion', 'src'), (n) => /\.(ts|tsx|js|jsx)$/.test(n)).map((f) => fs.readFileSync(f, 'utf8'));
  const 목소리 = {};
  for (const f of 파일들(path.join(편, 'remotion', 'public', 'vo'), (n) => n === 'vo.json', 2)) {
    try { for (const l of 읽기(f).lines || []) 목소리[l.id] ||= l; } catch { 알림.push(`목소리 기록을 못 읽음: ${path.basename(path.dirname(f))}/vo.json`); }
  }
  for (const [i, w] of 말들.entries()) {
    const 이름 = `배우는 말 「${(w && w.말) || i + 1}」`;
    if (!w || !w.말 || !w.한글 || !w.뜻) { 문제.push(`${이름}: 말 · 한글 · 뜻을 적는다`); continue; }
    const 초 = Number(w.초);
    if (!(초 >= 배움.초)) 문제.push(`${이름}: 칸이 ${배움.초}초 넘어야 함(지금 ${w.초})`);
    const 수 = 글자수(w.한글) + 글자수(w.읽기) + 글자수(w.뜻);
    const 필요 = Math.ceil((수 / 배움.글) * 10) / 10;
    if (초 > 0 && 수 / 초 > 배움.글 + 배움.틈) 문제.push(`${이름}: 글 ${수}자가 초당 ${둘째자리(수 / 초)}자 — ${배움.글}자 안이 되게 글을 줄이거나 ${필요}초로 늘림`);
    if (/[\r\n]|\(\s*=/.test(String(w.뜻).trim())) 문제.push(`${이름}: 뜻은 한 줄만 — 둘째 줄과 「(= …)」 풀이를 뺌`);
    const 샷들 = [].concat(w.칸 == null ? [] : w.칸);
    const 없는 = 샷들.filter((id) => !계획[id]);
    if (!샷들.length || 없는.length) 문제.push(`${이름}: 칸에 계획의 샷 이름을 적음${없는.length ? `(없는 샷: ${없는.join(', ')})` : ''}`);
    else {
      const 합 = 샷들.reduce((s, id) => s + (Number(String(계획[id].dur || '').replace(/[^0-9]/g, '')) || 0), 0);
      if (초 > 합) 문제.push(`${이름}: ${초}초인데 샷(${샷들.join(' + ')})은 ${합}초 — 샷을 늘림`);
    }
    const 편초 = 코드칸초(코드, w.말);
    if (편초 != null) {
      if (편초 < Math.max(배움.초, 필요) - 배움.틈) 문제.push(`${이름}: 편 코드의 칸이 ${둘째자리(편초)}초 — ${Math.max(배움.초, 필요)}초 넘게`);
    } else if (코드.length) 알림.push(`${이름}: 편 코드에서 key가 이 말인 칸의 at · to(숫자)를 못 찾음 — 칸 길이를 눈으로 잼`);
    const 음성 = [].concat(w.음성 == null ? [] : w.음성);
    if (음성.length < 2) 문제.push(`${이름}: 음성에 첫째와 천천히 한 번 더, 두 줄을 적음`);
    const 빠르기 = 음성.map((id) => {
      const l = 목소리[id];
      if (!l) { 알림.push(`${이름}: 목소리 ${id}를 아직 못 잼(vo.json에 없음)`); return null; }
      const 음절 = (String(l.text || '').match(/[가-힣]/g) || []).length;
      const v = Number(l.syllablesPerSec) || (l.dur > 0 ? 음절 / l.dur : 0);
      if (!(v > 0)) { 알림.push(`${이름}: 목소리 ${id}의 빠르기를 못 잼`); return null; }
      if (v > 배움.음절 + 배움.틈) 문제.push(`${이름}: 목소리 ${id}가 초당 ${둘째자리(v)}음절 — ${배움.음절} 안으로`);
      return v;
    });
    if (빠르기[0] && 빠르기[1] && 빠르기[1] > 빠르기[0] + 0.2) 문제.push(`${이름}: 둘째 목소리가 첫째보다 빠름(${둘째자리(빠르기[1])} > ${둘째자리(빠르기[0])}음절)`);
  }
}

/** JPEG 머리에서 가로 · 세로 */
function jpg크기(p) {
  const b = fs.readFileSync(p);
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

/** 실행기 하나를 ego 브라우저에서 돌린다. -e 글은 ASCII만(경로는 file URL로 퍼센트 부호화) */
function 돌리기(파일, v4) {
  const 라운드 = path.join(v4.편, '영상칸', 'flow', `_라운드_${v4.round}.mjs`);
  fs.mkdirSync(path.dirname(라운드), { recursive: true });
  fs.writeFileSync(라운드, `globalThis.V4 = ${JSON.stringify(v4)};\nawait import(${JSON.stringify(pathToFileURL(path.join(실행기, 파일)).href)});\n`, 'utf8');
  const r = spawnSync('ego-browser', ['nodejs', '-e', `await import('${pathToFileURL(라운드).href}')`], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 20 * 60 * 1000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const 줄 = out.split(/\r?\n/).filter((l) => /^\{/.test(l)).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  for (const s of 줄) if (/오류|멈춤|끝|받음|옮김|생성 시작 누름|크레딧 (시작 전|접수 뒤|끝)|새 프로젝트|올리기 끝|예산/.test(s.step || '')) console.log(`  ${s.local || ''} ${s.step}${s.e ? ` — ${String(s.e).slice(0, 200)}` : ''}${s.stop ? ` — ${String(s.stop).slice(0, 200)}` : ''}${s.dest ? ` → ${s.dest}` : ''}${s.credits != null ? ` (크레딧 ${s.credits})` : ''}`);
  if (r.status !== 0) console.log(`  ego-browser 종료 ${r.status}: ${out.split(/\r?\n/).filter((l) => /Error/.test(l)).slice(0, 3).join(' | ').slice(0, 300)}`);
  return { status: r.status, 줄 };
}

function 결과(편) { try { return 읽기(path.join(편, '영상칸', 'flow', 'results.json')); } catch { return {}; } }
const 시각 = () => new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/:/g, '');

function 공간닫기(편) {
  const { createHash } = require('node:crypto');
  const SPACE = `flowvid-${createHash('sha1').update(슬래시(편)).digest('hex').slice(0, 10)}`;
  const 글 = `const s=(await listTaskSpaces()).find((x)=>x.name===${JSON.stringify(SPACE)}); if (s && s.ownership==='agent') { const t=await taskSpace(s.id); await t.finish({ keep: [] }); console.log('closed', s.id); } else console.log('no space');`;
  spawnSync('ego-browser', ['nodejs', '-e', 글], { encoding: 'utf8' });
}

function main(argv) {
  const 옵션 = {};
  const 인자 = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--계정') { 옵션.계정 = argv[i + 1]; i += 1; } else 인자.push(argv[i]);
  }
  if (옵션.계정 !== undefined && !계정들.includes(옵션.계정)) { console.error(`--계정은 ${계정들.join(' · ')} 가운데 하나`); return 2; }
  if (인자[0] === '계정') return 계정보기();
  const [명령, 편인자, ...나머지] = 인자;
  if (!명령 || !편인자 || !['점검', '준비', '굽기', '띠', '넣기'].includes(명령)) {
    console.error('쓰는 법: node tools/플로우영상.js <점검|준비|굽기|띠|넣기> <편 폴더> [칸…] — 파일 머리 참고');
    return 2;
  }
  const 편 = 슬래시(편인자);
  if (!fs.existsSync(path.join(편, 'remotion'))) { console.error(`편 폴더가 아님(remotion/ 없음): ${편}`); return 2; }

  if (명령 === '띠' || 명령 === '넣기') {
    const [id, 판 = 'a'] = 나머지;
    if (!id) { console.error(`쓰는 법: node tools/플로우영상.js ${명령} <편 폴더> <칸> [판]`); return 2; }
    const src = path.join(편, '영상칸', '받음', `${id}_${판}.mp4`);
    if (!fs.existsSync(src)) { console.error(`받은 판이 없음: ${src}`); return 1; }
    if (명령 === '띠') {
      const dst = path.join(편, '영상칸', 'flow', `${id}_${판}_띠.jpg`);
      const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', 'fps=2,scale=432:768,tile=5x4', '-frames:v', '1', dst], { encoding: 'utf8' });
      if (r.status !== 0) { console.error(`ffmpeg 실패: ${r.stderr}`); return 2; }
      console.log(dst);
      return 0;
    }
    const pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src], { encoding: 'utf8' });
    const [w, h] = String(pr.stdout || '').trim().split(',').map(Number);
    if (!(w > 0 && h > 0) || Math.abs(w / h - 9 / 16) > 0.01) { console.error(`9:16 영상이 아님(${w}x${h})`); return 1; }
    const dst = path.join(편, 'remotion', 'public', 'vid', `${id}.mp4`);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    console.log(`넣음 ${path.relative(편, dst).split(path.sep).join('/')} ← ${id}_${판}.mp4 (${w}x${h})`);
    return 0;
  }

  const 본 = 점검(편);
  console.log(`점검 — 칸 ${본.칸.length}개 · 계획 합 ${본.합} / 편 예산 ${본.예산}`);
  for (const p of 본.문제) console.log(`  ✗ ${p}`);
  for (const p of 본.알림) console.log(`  · ${p}`);
  if (본.문제.length) return 1;
  if (명령 === '점검') return 0;

  const 고른계정 = 옵션.계정;
  if (명령 === '준비') {
    const 계정 = 고른계정 || 계정고르기(0).계정;
    if (!계정) { console.log('  ✗ 지금 낼 Flow 계정이 없음 — node tools/플로우영상.js 계정'); return 1; }
    const 끝 = 준비하기(편, 계정, 본);
    공간닫기(편);
    return 끝 ? 0 : 1;
  }

  // 굽기
  const ids = 나머지.length ? 나머지 : 본.칸;
  const 모름 = ids.filter((id) => !본.칸.includes(id));
  if (모름.length) { console.error(`계획에 없는 칸: ${모름.join(', ')}`); return 2; }
  const res0 = 결과(편);
  if (!Object.keys(res0._projects || {}).some((k) => k === 'omni' || k.startsWith('omni@'))) { console.error('먼저 「준비」를 돌린다(프로젝트 · 시작 그림)'); return 1; }
  // 같은 key로 낸 줄이 프로젝트에 이미 있으면 실행기는 굽지 않고 그 줄을 기다리기만 한다 — 다시 구울 때는 칸 글과 key를 바꾼다
  const 계획 = 읽기(path.join(편, '영상칸', '계획.json'));
  const 낸key = new Set(Object.entries(res0).filter(([k, v]) => !k.startsWith('_') && v && v.accepted).map(([, v]) => `${v.id}\0${v.key}`));
  const 같은key = ids.filter((id) => 낸key.has(`${id}\0${계획[id].key}`));
  if (같은key.length) { console.error(`이미 같은 key로 낸 칸: ${같은key.join(', ')} — 다시 구우려면 지시문.json의 그 칸 글을 고치고 계획.json key를 새 글의 구절로 바꾼다`); return 1; }
  let 실패 = 0;
  for (const id of ids) {
    const 값 = Number(계획[id].cost) || 0;
    const 쓴 = [];
    let 받음 = null;
    // 한 계정이 「비정상적인 활동」이나 바닥으로 막히면 다른 계정으로 한 번 더 낸다(--계정을 준 때는 넘기지 않는다)
    while (!받음 && 쓴.length < 계정들.length) {
      const 골라 = 고른계정 ? { 계정: 쓴.length ? null : 고른계정, 까닭: '' } : 계정고르기(값);
      if (!골라.계정 || 쓴.includes(골라.계정)) { if (!쓴.length) console.log(`  ✗ ${id} 낼 Flow 계정이 없음 — ${골라.까닭}`); break; }
      쓴.push(골라.계정);
      if (!준비됨(편, 골라.계정, 계획, [id]) && !준비하기(편, 골라.계정, 본)) { console.log(`  ✗ ${id} ${골라.계정} 준비 실패`); continue; }
      const run = 다음run(편, id);
      console.log(`${id} → ${run} (${골라.계정})`);
      const r = 돌리기('clip.mjs', { 편, round: `${run}-${시각()}`, id, run, account: 골라.계정 });
      상태적기(골라.계정, r.줄);
      받음 = r.줄.find((s) => s.step && s.step.startsWith('받음'));
      const 막힘 = r.줄.some((s) => /비정상적인 활동|Flow 크레딧 바닥/.test(JSON.stringify(s)));
      if (!받음 && !막힘) break;
    }
    if (!받음) { 실패 += 1; console.log(`  ✗ ${id} 받지 못함`); }
  }
  공간닫기(편);
  return 실패 ? 1 : 0;
}

/** 이 편의 그 계정 프로젝트와, 칸들이 쓰는 그림이 다 올라가 있나 */
function 준비됨(편, 계정, 계획, ids) {
  const res = 결과(편);
  if (!(res._projects || {})[열쇠(계정)]) return false;
  const 올린 = new Set(res[올림열쇠(계정)] || []);
  return ids.every((id) => [계획[id].start, 계획[id].end].filter(Boolean).every((s) => 올린.has(s)));
}

/** 그 계정에 이 편의 프로젝트를 만들고(처음 한 번) 안 올린 시작 · 끝 그림을 올린다. 크레딧은 쓰지 않는다 */
function 준비하기(편, 계정, 본) {
  let res = 결과(편);
  const pj = 열쇠(계정);
  if (!(res._projects || {})[pj]) {
    const r = 돌리기('r01.mjs', { 편, round: `준비-${계정}-${시각()}`, proj: pj, account: 계정 });
    상태적기(계정, r.줄);
    res = 결과(편);
    if (!(res._projects || {})[pj]) { console.log(`  ✗ ${계정} Flow 프로젝트를 못 만듦 — 영상칸/flow/steps.jsonl을 본다`); return false; }
  }
  const 계획 = 읽기(path.join(편, '영상칸', '계획.json'));
  const 올린 = new Set(res[올림열쇠(계정)] || []);
  const 올릴 = [...new Set(본.칸.flatMap((id) => [계획[id].start, 계획[id].end].filter(Boolean)))].filter((s) => !올린.has(s));
  if (올릴.length) {
    const r = 돌리기('up.mjs', { 편, round: `올리기-${계정}-${시각()}`, proj: pj, account: 계정, files: 올릴.map((s) => 슬래시(path.join(편, '영상칸', '시작', `${s}.jpg`))) });
    if (r.줄.some((s) => s.step === '오류')) { console.log(`  ✗ ${계정} 시작 그림 올리기 실패`); return false; }
    res = 결과(편);
    res[올림열쇠(계정)] = [...new Set([...(res[올림열쇠(계정)] || []), ...올릴])];
    fs.writeFileSync(path.join(편, '영상칸', 'flow', 'results.json'), JSON.stringify(res, null, 1));
  }
  console.log(`준비 끝(${계정}) — 프로젝트 ${res._projects[pj]} · 올린 그림 ${(res[올림열쇠(계정)] || []).length}장`);
  return true;
}

/* ── Flow 계정 고르기(11-26) ── */
function 상태읽기() { try { return 읽기(상태파일()); } catch { return {}; } }
function 상태쓰기(상태) {
  const f = 상태파일();
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, JSON.stringify(상태, null, 1)); fs.renameSync(t, f); } catch (e) { console.log(`  · 계정 상태를 못 적음: ${e.message}`); }
}
/** 지금 뒤로 처음 오는 다시 차는 때(KST 그달 날 · 시 · 분, 그달에 그날이 없으면 그달 끝날) */
function 다음다시참(계정, now = Date.now()) {
  const r = 다시참[계정];
  const kst = new Date(now + 9 * 3600 * 1000);
  for (let m = 0; m < 3; m += 1) {
    const y = kst.getUTCFullYear(), mo = kst.getUTCMonth() + m;
    const 끝날 = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const t = Date.UTC(y, mo, Math.min(r.날, 끝날), r.시, r.분) - 9 * 3600 * 1000;
    if (t > now) return t;
  }
  return null;
}
/** 실행기 줄에서 크레딧과 「비정상적인 활동」을 읽어 계정 상태에 적는다 */
function 상태적기(계정, 줄, now = Date.now()) {
  const 상태 = 상태읽기(), a = 상태[계정] || {};
  for (const s of 줄) {
    if (/^크레딧 /.test(s.step || '') && Number.isFinite(s.credits) && s.email === `${계정}@gmail.com`) Object.assign(a, { 크레딧: s.credits, 크레딧때: now });
  }
  if (줄.some((s) => /비정상적인 활동/.test(JSON.stringify(s)))) a.경고 = [...(a.경고 || []).filter((t) => now - t < 2 * 86400 * 1000), now];
  상태[계정] = a;
  상태쓰기(상태);
}
const kst날 = (t) => new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);
/** 샷 값이 「값」일 때 낼 계정과 까닭. 두 계정 다 안 되면 계정 null */
function 계정고르기(값, now = Date.now(), 상태 = 상태읽기()) {
  const 까닭 = [];
  const 후보 = 계정들.filter((계정) => {
    const a = 상태[계정] || {}, 경고 = (a.경고 || []).filter((t) => t <= now);
    if (경고.some((t) => now - t < 경고쉼)) { 까닭.push(`${계정} 3시간 안에 「비정상적인 활동」`); return false; }
    if (경고.filter((t) => kst날(t) === kst날(now)).length >= 2) { 까닭.push(`${계정} 오늘 「비정상적인 활동」 두 번 — 오늘은 접음`); return false; }
    // 읽은 뒤 다시 차는 때가 지났으면 다시 찬 것으로 본다(읽은 적 없으면 모름 — 내 보고 실행기가 접수 전에 잰다)
    const 찼다 = a.크레딧때 && 다음다시참(계정, a.크레딧때) <= now;
    if (Number.isFinite(a.크레딧) && !찼다 && a.크레딧 - 값 < 바닥) { 까닭.push(`${계정} 크레딧 ${a.크레딧} — 바닥 ${바닥}`); return false; }
    return true;
  });
  후보.sort((x, y) => 다음다시참(x, now) - 다음다시참(y, now) || ((상태[y] || {}).크레딧 ?? 0) - ((상태[x] || {}).크레딧 ?? 0));
  return { 계정: 후보[0] || null, 까닭: 까닭.join(' · ') };
}

function 계정보기() {
  const 상태 = 상태읽기(), now = Date.now();
  const 때 = (t) => (t ? new Date(t).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(5, 16) : '—');
  for (const 계정 of 계정들) {
    const a = 상태[계정] || {};
    console.log(`${계정}  크레딧 ${a.크레딧 ?? '모름'}(${때(a.크레딧때)} 읽음) · 다시 참 ${때(다음다시참(계정, now))} · 경고 ${(a.경고 || []).map(때).join(', ') || '없음'}`);
  }
  const 골라 = 계정고르기(0, now, 상태);
  console.log(`지금 고를 계정: ${골라.계정 || '없음'}${골라.까닭 ? ` — ${골라.까닭}` : ''}`);
  return 0;
}

/** 다시 굽는 판은 기록 이름을 바꾼다(같은 이름이면 접수 잠금 때문에 기다리기만 한다 — 현장 노트 브라우저_게시 11-23) */
function 다음run(편, id) {
  const res = 결과(편);
  if (!res[id]) return id;
  for (let n = 2; n < 20; n += 1) if (!res[`${id}r${n}`]) return `${id}r${n}`;
  return `${id}r${Date.now()}`;
}

module.exports = { 점검, jpg크기, 계정고르기, 다음다시참 };
if (require.main === module) process.exit(main(process.argv.slice(2)));
