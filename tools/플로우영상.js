#!/usr/bin/env node
'use strict';
/**
 * 플로우영상 — LAB 편 전체를 샷마다 Flow Omni 1.2 Flash 영상으로 굽는다(2026-11-25 Claude).
 * 결정 11-25 「LAB 영상 칸 엔진 · Omni 1.2 Flash · Veo 안 씀」 · 「LAB 편 전체를 영상으로」. 시험과 근거는
 * docs/마케팅/LAB_하루두편_설계_20261110/검토/영상시험_20261125/README.md, 절차는 제작 절차 「LAB 영상 칸」.
 * 브라우저 조작은 tools/플로우영상/(광명역 공모 편 Flow 실행기를 옮긴 것)이 하고, 이 파일은 편 폴더 설정을 읽어 차례대로 부른다.
 *
 *   node tools/플로우영상.js 점검 <편 폴더>            계획 · 지시문 · 시작 그림만 본다(브라우저 · 크레딧 없음)
 *   node tools/플로우영상.js 준비 <편 폴더>            점검 → Flow 프로젝트 만들기(처음 한 번) → 시작 그림 올리기(안 올린 것만). 크레딧 없음
 *   node tools/플로우영상.js 굽기 <편 폴더> [칸…]      칸(샷)마다 한 판 굽고 영상칸/받음/<칸>_<a|b|…>.mp4로 받는다(칸을 안 주면 계획의 모든 칸). 끝에 작업 공간을 닫는다
 *   node tools/플로우영상.js 띠 <편 폴더> <칸> [판]    받은 판을 0.5초 간격 띠(영상칸/flow/<칸>_<판>_띠.jpg)로 — 몽글 검사용
 *   node tools/플로우영상.js 넣기 <편 폴더> <칸> [판]  고른 판(기본 a)을 remotion/public/vid/<칸>.mp4로 복사한다
 *
 * 편 폴더의 영상칸/:
 *   계획.json   { "_예산": 180, "_누적상한": <없으면 뺀다>, "<칸>": { "model": "Omni 1.2 Flash", "n": 1, "cost": "12", "dur": "4초", "proj": "omni", "start": "<시작 그림 이름>", "end": "<끝 그림 이름 — 없으면 뺀다>", "key": "<지시문 속 한 번만 나오는 구절>" } }
 *   지시문.json { "공통": "<모든 칸 뒤에 붙는 글>", "클립": [{ "id": "<칸>", "prompt": "<칸 글>" }] }
 *   시작/<start>.jpg · 시작/<end>.jpg  1080×1920(9:16) 시작 · 끝 그림 — 그 샷의 GPT 판을 맞춘 것
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

const 실행기 = path.join(__dirname, '플로우영상');
const OMNI = 'Omni 1.2 Flash';
const 초당 = 3;
const 기본예산 = 180;

const 슬래시 = (p) => path.resolve(p).split(path.sep).join('/');
const 읽기 = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** 계획 · 지시문 · 시작 그림을 본다 → { 문제: [], 칸: [id…], 예산, 합 } */
function 점검(편) {
  const 문제 = [];
  const V = path.join(편, '영상칸');
  let 계획 = null; let 지시 = null;
  try { 계획 = 읽기(path.join(V, '계획.json')); } catch (e) { 문제.push(`영상칸/계획.json을 못 읽음 — ${e.message}`); }
  try { 지시 = 읽기(path.join(V, '지시문.json')); } catch (e) { 문제.push(`영상칸/지시문.json을 못 읽음 — ${e.message}`); }
  if (!계획 || !지시) return { 문제, 칸: [], 예산: 0, 합: 0 };
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
    if (p.model !== OMNI) 문제.push(`${id}: 모델이 ${OMNI}가 아님(${p.model}) — LAB 영상 칸은 Omni만(결정 11-25)`);
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
      if (!/no mouth/i.test(글[id])) 문제.push(`${id}: 지시문에 몽글의 「NO mouth」가 없음(제작 절차 「LAB 영상 칸」 공통 글을 쓴다)`);
    }
  }
  if (합 > 예산) 문제.push(`계획 합 ${합}이 편 예산 ${예산}을 넘음`);
  return { 문제, 칸, 예산, 합 };
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
  const [명령, 편인자, ...나머지] = argv;
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
  if (본.문제.length) return 1;
  if (명령 === '점검') return 0;

  if (명령 === '준비') {
    let res = 결과(편);
    if (!(res._projects || {}).omni) {
      돌리기('r01.mjs', { 편, round: `준비-${시각()}`, proj: 'omni' });
      res = 결과(편);
      if (!(res._projects || {}).omni) { console.log('  ✗ Flow 프로젝트를 못 만듦 — 영상칸/flow/steps.jsonl을 본다'); 공간닫기(편); return 1; }
    }
    const 계획 = 읽기(path.join(편, '영상칸', '계획.json'));
    const 올린 = new Set(res._올림 || []);
    const 올릴 = [...new Set(본.칸.flatMap((id) => [계획[id].start, 계획[id].end].filter(Boolean)))].filter((s) => !올린.has(s));
    if (올릴.length) {
      const r = 돌리기('up.mjs', { 편, round: `올리기-${시각()}`, proj: 'omni', files: 올릴.map((s) => 슬래시(path.join(편, '영상칸', '시작', `${s}.jpg`))) });
      if (r.줄.some((s) => s.step === '오류')) { console.log('  ✗ 시작 그림 올리기 실패'); 공간닫기(편); return 1; }
      res = 결과(편);
      res._올림 = [...new Set([...(res._올림 || []), ...올릴])];
      fs.writeFileSync(path.join(편, '영상칸', 'flow', 'results.json'), JSON.stringify(res, null, 1));
    }
    console.log(`준비 끝 — 프로젝트 ${res._projects.omni} · 올린 그림 ${(res._올림 || []).length}장`);
    공간닫기(편);
    return 0;
  }

  // 굽기
  const ids = 나머지.length ? 나머지 : 본.칸;
  const 모름 = ids.filter((id) => !본.칸.includes(id));
  if (모름.length) { console.error(`계획에 없는 칸: ${모름.join(', ')}`); return 2; }
  const res0 = 결과(편);
  if (!(res0._projects || {}).omni) { console.error('먼저 「준비」를 돌린다(프로젝트 · 시작 그림)'); return 1; }
  // 같은 key로 낸 줄이 프로젝트에 이미 있으면 실행기는 굽지 않고 그 줄을 기다리기만 한다 — 다시 구울 때는 칸 글과 key를 바꾼다
  const 계획 = 읽기(path.join(편, '영상칸', '계획.json'));
  const 낸key = new Set(Object.entries(res0).filter(([k, v]) => !k.startsWith('_') && v && v.accepted).map(([, v]) => `${v.id}\0${v.key}`));
  const 같은key = ids.filter((id) => 낸key.has(`${id}\0${계획[id].key}`));
  if (같은key.length) { console.error(`이미 같은 key로 낸 칸: ${같은key.join(', ')} — 다시 구우려면 지시문.json의 그 칸 글을 고치고 계획.json key를 새 글의 구절로 바꾼다`); return 1; }
  let 실패 = 0;
  for (const id of ids) {
    const run = 다음run(편, id);
    console.log(`${id} → ${run}`);
    const r = 돌리기('clip.mjs', { 편, round: `${run}-${시각()}`, id, run });
    const 받음 = r.줄.find((s) => s.step && s.step.startsWith('받음'));
    if (!받음) { 실패 += 1; console.log(`  ✗ ${id} 받지 못함`); }
  }
  공간닫기(편);
  return 실패 ? 1 : 0;
}

/** 다시 굽는 판은 기록 이름을 바꾼다(같은 이름이면 접수 잠금 때문에 기다리기만 한다 — 현장 노트 브라우저_게시 11-23) */
function 다음run(편, id) {
  const res = 결과(편);
  if (!res[id]) return id;
  for (let n = 2; n < 20; n += 1) if (!res[`${id}r${n}`]) return `${id}r${n}`;
  return `${id}r${Date.now()}`;
}

module.exports = { 점검, jpg크기 };
if (require.main === module) process.exit(main(process.argv.slice(2)));
