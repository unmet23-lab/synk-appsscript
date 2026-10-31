#!/usr/bin/env node
'use strict';
/**
 * 아르곤웹 — Gemini 웹 「4 Argon」(사고 수준 높음)에 사진 · 글 파일을 올려 묻고 답을 파일로 받는다. 굽기 전 지시문의 기계 점검도 한다(2026-10-31).
 *
 *   node tools/아르곤웹.js 점검 <지시문 파일…> [--json] [--없이 <항목,…>]
 *        굽기 전 지시문(작업 JSON 배열 · 「## 컷」 마크다운 · 글 한 편)을 길이 · 필수 문장 · 충돌 · 좌우 표기로 본다. 빠짐 · 넘침이 있으면 종료 1.
 *        항목: 길이 · 영상 · 나이 · 점 · 결 · 글자 · 혼자 · 충돌 · 좌우 · 비율 (--없이 혼자,좌우 처럼 뺀다 — 단체 컷 등)
 *   node tools/아르곤웹.js 보내기 <작업.json…> [--이름 <줄 이름>] [--두줄] [--덮어쓰기] [--차례없이 --u <번호>] [--공간 <작업 공간>]
 *   node tools/아르곤웹.js 보내기 --파일 <사진·글…> --지시문 <지시문 파일> --답 <답.md> [--머리 <답 머리 글>]
 *        공용 차례(gemini)를 잡고 → 작업마다 새 대화(새 탭)에 올려 보내고 → 답을 파일로 받고 → 내려놓는다.
 *        한 차례(보내기 · 읽기 6번 · 20분)를 넘길 것 같으면 내려놓고 다시 줄을 선다. 답 파일이 이미 있는 작업은 건너뛴다.
 *   node tools/아르곤웹.js 읽기 <작업.json…> [같은 선택]
 *        보낸 대화를 같은 작업 공간의 탭에서 읽기만 한다(주소를 옮기거나 다시 보내지 않는다).
 *
 * 작업 파일: { "files": [...], "prompt": "<지시문>" | "promptFile": "<파일>", "out": "<답.md>", "shots"?, "head"?, "space"?, "answerMin"? }
 *   경로는 작업 파일 폴더 기준으로도 쓴다. 첨부는 한 번에 10개까지, 지시문은 4,300자 안(긴 자료는 글 파일로 붙인다).
 *   글 파일은 칩에 보이는 이름(확장자 뺀)으로 확인하니 이름이 서로 달라야 한다.
 *
 * 다시 보내지 않기: 페이지 스크립트(tools/아르곤웹.mjs)가 보내기를 누르기 직전에 `<답>.보냄.json` 표시를 쓰고, 답을 받으면 지운다.
 *   표시가 남은 작업은 보내기를 불러도 「읽기」로 간다 — 그래도 다시 보내야 하면 표시 파일을 지운 뒤 부른다.
 * 한 ego 브라우저에서 파일을 올리는 실행기는 하나만 돈다(10-31 a · b 두 줄 동시 올리기에서 첨부 0장) — 이 도구끼리는 임시 폴더의
 *   잠금으로 차례를 지키고, 「--두줄」은 다른 올리기 실행기가 안 도는 것을 알 때만 붙인다.
 * 차례: 사용자 폴더의 synk-vendor/_공용차례/차례.py(README). 막힘 · 한도 · 동의 창은 누르지 않고 멈춘다 — sorry면 두 줄 다 끈다(off 파일).
 * 함정: docs/현장노트/gemini_사진.md 「영상 올려 분석시키기」. 시험: node --test tests/아르곤웹.test.js
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const 페이지 = path.join(__dirname, '아르곤웹.mjs');
const 기본공간 = 'synk-argon-web';
const 첨부한도 = 10;
const 지시문한도 = 4300;
const 한차례 = { 건: 6, 새건마감: 12 * 60_000, 다시읽기마감: 15 * 60_000 }; // 한 건 3~8분 — 12분 뒤에는 새 건을 시작하지 않는다(20분 안)
const 보내기전실패쉼 = 20_000;

const 슬래시 = (p) => String(p).replace(/\\/g, '/');
const 종류 = (f) => (/\.(jpe?g|png|webp|gif|heic)$/i.test(f) ? '사진' : /\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(f) ? '영상' : '글');
const 칩이름 = (f) => path.basename(f).replace(/\.[^.]+$/, '');
const 표시경로 = (out) => `${out}.보냄.json`;
const 쉬기 = (ms) => new Promise((r) => setTimeout(r, ms));
const 시각 = () => new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Seoul' });
const 차례경로 = () => process.env.SYNK_CHARYE_PY || path.join(os.homedir(), 'Documents', 'synk-vendor', '_공용차례', '차례.py');

// ── 인자 ──

const 참거짓 = new Set(['json', '두줄', '덮어쓰기', '차례없이']);
function parseArgs(argv) {
  const o = { _: [], 파일: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2);
    if (참거짓.has(k)) { o[k] = true; continue; }
    if (k === '파일') {
      while (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) o.파일.push(argv[++i]);
      if (!o.파일.length) throw new Error('--파일 뒤에 파일이 없다');
      continue;
    }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`${a} 뒤에 값이 없다`);
    o[k] = v;
    i += 1;
  }
  return o;
}

// ── 작업 ──

function 작업만들기(j, dir, 이름, o = {}) {
  const abs = (p) => (p ? path.resolve(dir, String(p)) : '');
  let prompt = j.prompt != null ? String(j.prompt) : '';
  let 읽기오류 = '';
  if (!prompt && j.promptFile) {
    try { prompt = fs.readFileSync(abs(j.promptFile), 'utf8'); } catch (e) { 읽기오류 = `지시문 파일을 못 읽음: ${abs(j.promptFile)}`; }
  }
  const out = abs(j.out);
  return {
    이름,
    files: (Array.isArray(j.files) ? j.files : []).map(abs),
    prompt: prompt.trim(),
    out,
    shots: abs(j.shots) || (out ? path.dirname(out) : ''),
    head: j.head || o.머리 || '아르곤 답',
    space: o.공간 || j.space || 기본공간,
    answerMin: j.answerMin || undefined,
    sentWaitSec: j.sentWaitSec || undefined,
    읽기오류,
  };
}

function 작업읽기(file, o = {}) {
  const full = path.resolve(file);
  let j;
  try { j = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (e) { return { 이름: path.basename(full), files: [], prompt: '', out: '', 읽기오류: `작업 파일을 못 읽음: ${full} — ${e.message}` }; }
  return 작업만들기(j, path.dirname(full), path.basename(full).replace(/\.json$/i, ''), o);
}

function 깃발작업(o) {
  if (!o.지시문 || !o.답) throw new Error('--파일과 함께 --지시문 <지시문 파일> · --답 <답.md>를 준다');
  return 작업만들기({ files: o.파일, promptFile: o.지시문, out: o.답 }, process.cwd(), path.basename(o.답).replace(/\.[^.]+$/, ''), o);
}

function 작업문제(job) {
  const 문제 = [];
  if (job.읽기오류) 문제.push(job.읽기오류);
  if (!job.out) 문제.push('「out」(답 파일)이 없다');
  else if (!fs.existsSync(path.dirname(job.out))) 문제.push(`답 폴더가 없다: ${path.dirname(job.out)}`);
  if (!job.prompt && !job.읽기오류) 문제.push('지시문이 비었다');
  if (job.prompt && job.prompt.length > 지시문한도) 문제.push(`지시문 ${job.prompt.length}자 — ${지시문한도}자를 넘으면 보내기가 튕긴다(긴 자료는 글 파일로 붙인다)`);
  if (job.files.length > 첨부한도) 문제.push(`첨부 ${job.files.length}개 — 한 번에 ${첨부한도}개까지(작업을 나눈다)`);
  for (const f of job.files) if (!fs.existsSync(f)) 문제.push(`파일이 없다: ${f}`);
  const 이름들 = job.files.filter((f) => 종류(f) === '글').map(칩이름);
  const 겹침 = 이름들.filter((n, i) => 이름들.indexOf(n) !== i);
  if (겹침.length) 문제.push(`글 파일 이름이 겹친다(칩 이름으로 확인한다): ${[...new Set(겹침)].join(', ')}`);
  return 문제;
}

// 할 일 고르기 — 답이 있으면 건너뜀, 보냄 표시가 있으면 다시 보내지 않고 읽기
function 할일정하기(job, 처음, o = {}) {
  if (job.out && fs.existsSync(job.out) && !o.덮어쓰기) return '건너뜀';
  if (처음 === '읽기') return '읽기';
  return fs.existsSync(표시경로(job.out)) ? '읽기' : '보내기';
}

function 줄이름(jobs, o = {}) {
  if (o.이름) return o.이름;
  const seed = jobs.map((j) => j.out).join('|');
  return `argonweb-${crypto.createHash('sha1').update(seed).digest('hex').slice(0, 6)}`;
}

function 페이지글(job, u, mode) {
  const JOB = {
    mode, files: job.files.map(슬래시), prompt: job.prompt, out: 슬래시(job.out), shots: 슬래시(job.shots), u: Number(u),
    space: job.space || 기본공간, head: job.head || '아르곤 답', mark: 슬래시(표시경로(job.out)),
    ...(job.failShot ? { failShot: 슬래시(job.failShot) } : {}),
    ...(job.answerMin ? { answerMin: job.answerMin } : {}), ...(job.sentWaitSec ? { sentWaitSec: job.sentWaitSec } : {}),
  };
  return `globalThis.JOB = ${JSON.stringify(JOB)};\n${fs.readFileSync(페이지, 'utf8')}`;
}

// ego 출력 → 결과. ego는 스크립트의 console 출력을 표준 오류로 낸다(10-31 첫 실행 — 표준 출력만 읽어 「받음」을 못 보고 다시 보내려 했다).
// 그래서 두 흐름을 합쳐 읽고, 받았는지는 출력과 따로 이번 실행에 새로 써진 답 파일(받은답)로도 본다.
// 표시 파일이 남았으면 보냈을 수 있다 — 보내기 전 실패만 「실패」(다시 돌려도 된다).
function 결과가르기(출력, 표시있음, 받은답 = null) {
  const steps = String(출력 || '').split(/\r?\n/).map((l) => { try { return JSON.parse(l.trim()); } catch { return null; } }).filter((x) => x && x.step);
  const done = steps.find((x) => x.step === 'done');
  const url = (steps.filter((x) => (x.step === 'sent' || x.step === 'url' || x.step === 'done') && x.url).pop() || {}).url || '';
  if (done || 받은답) return { 결과: '받음', url, 글자: done ? done.chars : 받은답.글자 };
  const f = steps.find((x) => x.step === 'fail');
  const 꼬리 = String(출력 || '').trim().split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('{"step"')).slice(-2).join(' / ');
  const 까닭 = f ? f.why : (꼬리 || '출력 없이 끝남');
  if (f && f.kind === '멈춤') return { 결과: '멈춤', 까닭, 보냄: 표시있음, url };
  if (표시있음) return { 결과: '보냄', 까닭, url, 늦음: !!(f && f.kind === '늦음') };
  if (f && f.kind === '없음') return { 결과: '없음', 까닭 };
  return { 결과: '실패', 까닭 };
}

// 이번 실행(시작 시각 뒤)에 새로 써진 답 파일 — 있으면 { 글자 }
function 새답(out, 시작) {
  try {
    const st = fs.statSync(out);
    if (st.mtimeMs < 시작 - 2000) return null;
    return { 글자: fs.readFileSync(out, 'utf8').length };
  } catch { return null; }
}

// 실패한 건을 다시 할 때 — 답 파일이 생겼으면 그만, 보냄 표시가 있으면 읽기, 아니면 하던 일(보내기 전 실패만 다시 보낸다)
function 다시할일(j) {
  if (fs.existsSync(j.out)) return '그만';
  return fs.existsSync(표시경로(j.out)) ? '읽기' : j.할일;
}

function 계정번호(글) {
  const m = /\/u\/(\d+)\//.exec(String(글 || ''));
  return m ? Number(m[1]) : null;
}

// ── 차례 · 잠금 ──

function 차례(args) {
  const r = spawnSync('python', ['-X', 'utf8', 차례경로(), 'gemini', ...args], { encoding: 'utf8', windowsHide: true, timeout: 60_000 });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

function 차례기다리기(이름, 할일, 두줄) {
  return new Promise((resolve, reject) => {
    const args = ['-X', 'utf8', 차례경로(), 'gemini', '기다리기', 이름, 할일, ...(두줄 ? ['--두줄'] : [])];
    const child = spawn('python', args, { windowsHide: true });
    const 흘림 = (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) console.log(`  차례 · ${l.trim()}`); };
    child.stdout.on('data', 흘림);
    child.stderr.on('data', 흘림);
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`차례 기다리기가 ${code}로 끝남`))));
  });
}

function 줄끄기(까닭) {
  const dir = path.dirname(차례경로());
  for (const k of ['a', 'b']) {
    try { fs.appendFileSync(path.join(dir, `gemini-${k}.off`), `${new Date().toISOString()} 아르곤웹 · ${까닭} — 유호님이 확인을 누르신 뒤 지운다\n`); } catch { /* 폴더가 없으면 알림만 */ }
  }
}

const 살아있나 = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function 올리기잠금(이름) {
  const dir = path.join(os.tmpdir(), 'synk-argonweb-upload.lock');
  const owner = path.join(dir, 'owner.json');
  let 알림 = 0;
  for (;;) {
    try {
      fs.mkdirSync(dir);
      fs.writeFileSync(owner, JSON.stringify({ pid: process.pid, 이름, 시각: new Date().toISOString() }));
      return () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 이미 없음 */ } };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let 주인 = null;
      try { 주인 = JSON.parse(fs.readFileSync(owner, 'utf8')); } catch { /* 쓰는 중 */ }
      if (주인 && !살아있나(주인.pid)) { fs.rmSync(dir, { recursive: true, force: true }); continue; }
      if (Date.now() - 알림 > 60_000) { console.log(`  ${시각()} 다른 아르곤웹(${주인 ? 주인.이름 : '?'})이 파일을 올리는 중 — 끝나기를 기다린다`); 알림 = Date.now(); }
      await 쉬기(10_000);
    }
  }
}

// ── 한 건 ──

function 페이지돌리기(job, u, mode) {
  const script = 페이지글(job, u, mode);
  const 상한 = ((job.answerMin || 12) + 18) * 60_000; // 페이지 스크립트 자체 상한(올리기 · 보냄 확인 · 답) 뒤의 마지막 그물
  return new Promise((resolve) => {
    const child = spawn('ego-browser nodejs', { shell: true, windowsHide: true });
    const 조각 = [];
    const 받기 = (d) => {
      조각.push(d);
      for (const l of String(d).split(/\r?\n/)) if (l.trim().startsWith('{"step"')) console.log(`    ${l.trim()}`);
    };
    child.stdout.on('data', 받기);
    child.stderr.on('data', 받기);
    const timer = setTimeout(() => child.kill(), 상한);
    child.on('error', (e) => { 조각.push(Buffer.from(String(e.message))); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, 출력: Buffer.concat(조각.map((x) => Buffer.from(x))).toString('utf8') }); });
    child.stdin.end(script);
  });
}

async function 한건(job, u, mode) {
  console.log(`  ${시각()} ${mode} ${job.이름} — 첨부 ${job.files.length}개 · 지시문 ${job.prompt.length}자 · 계정 /u/${u}`);
  const 시작 = Date.now();
  const run = await 페이지돌리기(job, u, mode);
  const r = 결과가르기(run.출력, fs.existsSync(표시경로(job.out)), 새답(job.out, 시작));
  if (r.결과 === '받음') fs.rmSync(표시경로(job.out), { force: true }); // 답을 썼는데 표시가 남은 판 — 다음 부름이 읽기로 가지 않게
  return r;
}

// ── 보내기 · 읽기 ──

async function 돌리기(jobs, o, 처음) {
  const 문제 = jobs.flatMap((j) => 작업문제(j).map((p) => `${j.이름}: ${p}`));
  if (문제.length) { for (const p of 문제) console.error(`  ✗ ${p}`); console.error('작업 파일을 고친 뒤 다시 부른다(아무것도 보내지 않았다).'); return 2; }
  if (o.차례없이 && !/^\d$/.test(String(o.u || ''))) { console.error('--차례없이는 --u <계정 번호>(a 줄 4 · b 줄 1)와 함께 — 차례는 부르는 쪽이 쥐고 있어야 한다'); return 2; }
  const 결과 = [];
  const 남은 = [];
  for (const j of jobs) {
    const 할일 = 할일정하기(j, 처음, o);
    if (할일 === '건너뜀') 결과.push({ 작업: j, 결과: '건너뜀', 까닭: '답 파일이 이미 있다(--덮어쓰기로 다시)' });
    else 남은.push({ ...j, 할일 });
  }
  const 이름 = 줄이름(jobs, o);
  if (/[_\s]/.test(이름)) { console.error('--이름에는 밑줄 · 띄어쓰기를 쓰지 않는다(예: idol-gg-argon)'); return 2; }
  const 할일글 = `아르곤웹 ${남은.length}건 — ${남은.slice(0, 3).map((j) => j.이름).join(' · ')}${남은.length > 3 ? ' …' : ''}`;
  let 멈춤 = '';
  const 풀기 = 남은.length ? await 올리기잠금(이름) : () => {};
  try {
    let 이어실패 = 0;
    while (남은.length && !멈춤) {
      let u = Number(o.u);
      if (!o.차례없이) {
        await 차례기다리기(이름, 할일글, o.두줄);
        u = 계정번호(차례(['계정', 이름]).out);
        if (!u) { 차례(['내려놓기', 이름]); throw new Error('잡은 줄의 계정 주소를 못 읽음'); }
      }
      const 시작 = Date.now();
      let 건 = 0, 잃음 = false;
      const 살 = o.차례없이 ? null : setInterval(() => { if (차례(['살아있음', 이름]).code !== 0) 잃음 = true; }, 150_000);
      try {
        while (남은.length && !멈춤 && !잃음 && 건 < 한차례.건 && Date.now() - 시작 < 한차례.새건마감) {
          const j = 남은.shift();
          건 += 1;
          let r = await 한건(j, u, j.할일);
          if (!o.차례없이 && 차례(['살아있음', 이름]).code !== 0) 잃음 = true;
          if (r.결과 === '보냄' && !r.늦음 && !잃음 && 건 < 한차례.건 && Date.now() - 시작 < 한차례.다시읽기마감) {
            await 쉬기(60_000); // 보낸 뒤 끊긴 판 — 다시 보내지 않고 같은 탭을 읽는다
            건 += 1;
            const r2 = await 한건(j, u, '읽기');
            if (r2.결과 === '받음') r = r2;
          }
          if (r.결과 === '실패') {
            이어실패 += 1;
            // 다시 하기 전에 답 파일 · 보냄 표시를 다시 본다 — 답이 생겼거나 보냄 표시가 있으면 다시 보내지 않는다
            const 다음 = 다시할일(j);
            if (이어실패 >= 2) 멈춤 = `보내기 전 실패가 두 번 이어짐 — ${r.까닭}`;
            else if (!j.다시 && 다음 !== '그만') { 남은.unshift({ ...j, 할일: 다음, 다시: true }); await 쉬기(보내기전실패쉼); continue; }
            if (다음 === '그만') r = { ...r, 까닭: `${r.까닭} · 답 파일이 생겼다 — 열어 보고 판단한다(다시 보내지 않음)` };
          } else if (r.결과 !== '없음') 이어실패 = 0;
          if (r.결과 === '멈춤') {
            멈춤 = r.까닭;
            if (/sorry|로봇/.test(r.까닭) && !o.차례없이) 줄끄기(`로봇 확인(sorry) · ${이름}`);
          }
          결과.push({ 작업: j, ...r });
        }
      } finally {
        if (살) clearInterval(살);
        if (!o.차례없이) console.log(`  차례 · ${차례(['내려놓기', 이름]).out.split(/\r?\n/).pop()}`);
      }
      if (o.차례없이 && 남은.length && !멈춤) { 멈춤 = `한 차례(${한차례.건}건 · 20분)를 다 써서 남은 ${남은.length}건은 다시 부른다(--차례없이)`; }
    }
  } finally { 풀기(); }
  for (const j of 남은) 결과.push({ 작업: j, 결과: '안 함', 까닭: 멈춤 || '' });
  return 보고(결과, 멈춤);
}

function 보고(결과, 멈춤) {
  const 셈 = (k) => 결과.filter((x) => x.결과 === k).length;
  console.log(`\n아르곤웹 · ${결과.length}건 — 받음 ${셈('받음')} · 보냄(답 기다림) ${셈('보냄')} · 실패 ${셈('실패') + 셈('없음') + 셈('멈춤')} · 건너뜀 ${셈('건너뜀')} · 안 함 ${셈('안 함')}`);
  for (const x of 결과) {
    const j = x.작업;
    if (x.결과 === '받음') console.log(`  받음  ${j.이름} → ${j.out} (${x.글자}자${x.글자 < 200 ? ' — 짧다, 오류 문구인지 본다' : ''}) ${x.url || ''}`);
    else if (x.결과 === '보냄') console.log(`  보냄  ${j.이름} — ${x.까닭}\n        다시 보내지 말고 나중에: node tools/아르곤웹.js 읽기 <작업 파일>${x.url ? ` · 대화 ${x.url}` : ''}`);
    else console.log(`  ${x.결과}  ${j.이름} — ${x.까닭}${x.보냄 ? ' · 보냄 표시가 있다(다시 보내지 않는다)' : ''}`);
  }
  if (멈춤) console.log(`멈춤: ${멈춤}`);
  return 결과.every((x) => x.결과 === '받음' || x.결과 === '건너뜀') ? 0 : 1;
}

// ── 굽기 전 지시문 점검 ──
// 10-31 Fable 지시문 검수의 「기계 점검」 몫 — 사람 사진(LoRA 세트 · 새 컷 · 영상 시작 그림) 지시문에서 손으로 세던 것만 본다.
// 결과가 어떻게 나올지(참조 그림이 이기는 문장 · 엔진이 무시하는 문장)는 아르곤 · Fable 지시문 검수 몫이다.

function 지시문읽기(file) {
  const 글 = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const 이름 = path.basename(file).replace(/\.[^.]+$/, '');
  if (/\.json$/i.test(file)) {
    const j = JSON.parse(글);
    const 줄 = Array.isArray(j) ? j : Array.isArray(j.jobs) ? j.jobs : Object.entries(j).map(([k, v]) => (typeof v === 'string' ? { id: k, prompt: v } : { id: k, ...v }));
    return 줄.map((x, i) => ({ id: String(x.id || x.shot || `${이름}#${i + 1}`), prompt: String(x.prompt || x.지시문 || ''), ratio: x.ratio || '' })).filter((x) => x.prompt);
  }
  const 쪽 = 글.split(/^## +/m);
  if (쪽.length < 2) return [{ id: 이름, prompt: 글.trim(), ratio: '' }];
  return 쪽.slice(1).map((s) => {
    const [머리, ...몸] = s.split(/\r?\n/);
    return { id: 머리.trim().split(/\s+/)[0], prompt: 몸.join('\n').trim(), ratio: '' };
  }).filter((x) => /[A-Za-z]{3}/.test(x.prompt));
}

const 사람 = /\b(woman|man|girl|boy|person|she|he|her|his|model)\b/i;
const 여럿 = /\b(two|three|four|five|six)\s+(young\s+)?(women|men|girls|boys|people|members|persons|friends|idols)\b|\bgroup (photo|shot|picture)\b/i;
const 뒷모습 = /\bfrom (directly )?behind\b|\bback of (her|his) head\b|\bback view\b|\brear view\b/i;
const 충돌표 = [
  {
    이름: '머리',
    지킴: /\b(keep|identical|same|exact)\b[^.]*\b(bangs|bob|hair ?pins?|pins|ponytail|braid|bun|hairstyle|ribbon|bow)\b/i,
    바꿈: /\b(different|change[sd]?|new|instead)\b[^.]*\b(hair|hairstyle|bangs)\b|\bno (hair )?pins\b|\bwithout (the |any )?(hair )?pins\b/i,
    글: '지킬 목록에 머리 · 핀이 있는데 머리를 바꾸라고 한다 — 지킬 목록에서 머리 · 핀을 빼고 바꿀 머리만 적는다(10-31 hair-3)',
  },
  {
    이름: '핀',
    지킴: /\bkeep\b[^.]*\bpins?\b|\bpins? clipped\b/i,
    바꿈: /\bpins?\b[^.]*\b(hidden|not visible|cannot be seen|out of view)\b/i,
    글: '핀을 지키라는 문장과 안 보인다는 문장이 함께 — 이 컷에서는 핀 문장을 빼고 「no hair pin is visible」 하나로(10-31 angle-left)',
  },
  {
    이름: '입',
    지킴: /\bcorners of (her|his) (lips|mouth) turn up\b|\bcat-like mouth\b/i,
    바꿈: /\b(angry|anger|furious|scowl\w*|frown\w*|lips pressed)\b/i,
    글: '입꼬리가 저절로 올라간다는 문장과 화난 얼굴이 함께 — 이 컷에서는 입 문장을 빼고 입꼬리를 내린다(10-31 exp-angry)',
  },
  {
    이름: '눈',
    지킴: /\bnatural eye size\b/i,
    바꿈: /\beyes (opened |open |wide )*wide\b|\bwide[- ]open eyes\b|\bwidened eyes\b/i,
    글: '「natural eye size」와 「eyes wide」가 함께 — 「아몬드 꼴 그대로 · 쌍꺼풀이 더 보임」으로(10-31 exp-surprised)',
  },
];

// 좌우 — 「her left」(본인 쪽)도 「left edge of the frame」(화면 쪽)도 아닌 left · right는 엔진이 반대로 읽는다(현장노트 「옆모습의 왼쪽·오른쪽」)
function 모호한좌우(t) {
  const 모호 = [];
  for (const m of t.matchAll(/\b(left|right)\b/gi)) {
    const 앞 = t.slice(Math.max(0, m.index - 28), m.index).toLowerCase();
    const 뒤 = t.slice(m.index + m[0].length, m.index + m[0].length + 48).toLowerCase();
    if (/\b(her|his|their|own)\s+$/.test(앞)) continue;
    if (/\b(upper|lower|top|bottom|far)[\s-]+$/.test(앞)) continue;
    if (/^[\s-]*(hand\s+)?(side|edge|corner|third|half|border)?\s*(of|in) (the )?(photo|frame|picture|image|shot|screen)\b/.test(뒤)) continue;
    if (/^[\s-]*(edge|corner|third|half|border)\b/.test(뒤)) continue;
    if (/^[\s-]*side of (her|his|their)\b/.test(뒤)) continue; // 「the left side of her jaw」 — 본인 쪽
    모호.push(t.slice(Math.max(0, m.index - 24), m.index + m[0].length + 16).replace(/\s+/g, ' ').trim());
  }
  return 모호;
}

function 점검한편(p, 없이 = new Set()) {
  const t = p.prompt;
  const 걸림 = [];
  const 걸어 = (등급, 항목, 글) => { if (!없이.has(항목)) 걸림.push({ 등급, 항목, 글 }); };
  if (t.length > 지시문한도) 걸어('넘침', '길이', `${t.length}자 — ${지시문한도}자를 넘으면 보내기가 튕긴다(생김새 문장을 그림 번호로 줄인다)`);
  if (/\bvideos?\b/i.test(t)) 걸어('주의', '영상', '「video」 낱말 — 그림 대신 영상을 만들기 시작한다(현장노트 FINISH 항목)');
  if (사람.test(t)) {
    const 여러사람 = 여럿.test(t);
    const 나이 = [...t.matchAll(/\b(\d{1,2})[- ]years?[- ]old\b/gi)].map((m) => Number(m[1]));
    if (!나이.length) 걸어('빠짐', '나이', '나이 문장(「She is NN years old - a mature adult …」)이 없다 — 전원 성인');
    else if (나이.some((a) => a < 19)) 걸어('빠짐', '나이', `나이 ${나이.join(' · ')} — 19세 아래가 있다`);
    else if (!/\badults?\b/i.test(t)) 걸어('주의', '나이', '나이는 있는데 「adult」가 없다 — 「a mature adult woman, not a teenager」');
    if (!/\b(moles?|beauty marks?|freckles?|blemish(es)?)\b/i.test(t)) 걸어('빠짐', '점', '점 문장이 없다 — 대표에 있는 것만 허용 목록으로');
    else if (!/\bonly\b[^.]{0,160}\bas (in )?(Image ?\d|the reference)/i.test(t)) 걸어('주의', '점', '점 문장이 금지(「no moles」)뿐 — 허용 목록 「… only <대표에 있는 것> exactly as in Image 1」로(10-31 새 점 2~6개)');
    if (!뒷모습.test(t) && !/\bpores?\b|\bskin texture\b|\bunretouched\b|\bvellus\b/i.test(t)) 걸어('빠짐', '결', '피부 결 문장(모공 · 솜털 · 보정 없음)이 없다');
    if (!/\bno\b[^.]{0,40}\b(text|letters|lettering|logos?|watermarks?|brand(s|ing)?)\b/i.test(t)) 걸어('빠짐', '글자', '글자 · 상표 금지(「No text, letters, logos or watermark anywhere」)가 없다');
    if (!여러사람 && !/\bonly (one )?person\b|\bno other (people|persons?|faces?|one|figures?)\b|\bnobody else\b|\bno one else\b|\balone\b/i.test(t)) {
      걸어('빠짐', '혼자', '혼자 나온다는 문장(「She is the only person in the photo」)이 없다 — 단체 컷이면 --없이 혼자');
    }
    // 충돌은 문장끼리 — 바꿈은 지킬 목록 · 조건절(「even when she opens her eyes wide」)이 아닌 문장에서만 찾는다
    const 문장 = t.split(/(?<=[.!?])\s+/);
    const 지킴말 = /\b(keep|identical|exact|even when|whenever)\b/i;
    for (const c of 충돌표) {
      if (문장.some((s) => c.지킴.test(s)) && 문장.some((s) => c.바꿈.test(s) && !지킴말.test(s))) 걸어('충돌', '충돌', `${c.이름}: ${c.글}`);
    }
  }
  const 모호 = 모호한좌우(t);
  if (모호.length) 걸어('주의', '좌우', `본인 쪽(her left)인지 화면 쪽(left edge of the frame)인지 모를 좌우 ${모호.length}곳: 「${모호.slice(0, 3).join('」 · 「')}」`);
  const 비율들 = [...new Set([...t.matchAll(/\b(9:16|16:9|3:4|4:3|1:1|2:3|3:2|4:5|5:4|21:9)\b/g)].map((m) => m[1]))];
  if (p.ratio && 비율들.length && !비율들.includes(p.ratio)) 걸어('주의', '비율', `글에는 ${비율들.join(' · ')}, 작업 비율은 ${p.ratio} — 화면의 비율 단추를 따로 고른다`);
  return { id: p.id, 글자: t.length, 걸림 };
}

function 점검(files, o = {}) {
  const 없이 = new Set(String(o.없이 || '').split(',').map((s) => s.trim()).filter(Boolean));
  const 편들 = files.flatMap((f) => 지시문읽기(f).map((p) => ({ ...p, 파일: f })));
  const 결과 = 편들.map((p) => ({ 파일: p.파일, ...점검한편(p, 없이) }));
  const 막힘 = 결과.filter((r) => r.걸림.some((x) => x.등급 === '빠짐' || x.등급 === '넘침')).length;
  return { 편: 결과.length, 막힘, 결과 };
}

function 점검보고(r) {
  const 길이 = r.결과.map((x) => x.글자);
  console.log(`지시문 점검 · ${r.편}편${길이.length ? `(${Math.min(...길이).toLocaleString()}~${Math.max(...길이).toLocaleString()}자)` : ''} — 빠짐 · 넘침 ${r.막힘}편 · 충돌 · 주의 ${r.결과.filter((x) => x.걸림.length && !x.걸림.some((y) => y.등급 === '빠짐' || y.등급 === '넘침')).length}편`);
  for (const x of r.결과) {
    console.log(`  ${x.걸림.length ? (x.걸림.some((y) => y.등급 === '빠짐' || y.등급 === '넘침') ? '✗' : '~') : '✓'} ${x.id} · ${x.글자.toLocaleString()}자`);
    for (const y of x.걸림) console.log(`      ${y.등급}(${y.항목}) ${y.글}`);
  }
  console.log('기계 점검은 길이 · 필수 문장 · 문장 충돌만 본다 — 결과 예측은 아르곤 · Fable 지시문 검수(node tools/아르곤웹.js 보내기 …).');
}

// ── 입구 ──

async function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { console.error(e.message); return 2; }
  const [cmd, ...rest] = o._;
  if (cmd === '점검' && rest.length) {
    let r;
    try { r = 점검(rest, o); } catch (e) { console.error(`지시문을 못 읽음: ${e.message}`); return 2; }
    if (o.json) console.log(JSON.stringify(r, null, 1)); else 점검보고(r);
    return r.막힘 ? 1 : 0;
  }
  if ((cmd === '보내기' || cmd === '읽기') && (rest.length || o.파일.length)) {
    let jobs;
    try { jobs = o.파일.length ? [깃발작업(o)] : rest.map((f) => 작업읽기(f, o)); } catch (e) { console.error(e.message); return 2; }
    return 돌리기(jobs, o, cmd);
  }
  console.error('사용: node tools/아르곤웹.js 점검 <지시문 파일…> [--json] [--없이 <항목,…>]\n'
    + '      node tools/아르곤웹.js 보내기 <작업.json…> [--이름 <줄 이름>] [--두줄] [--덮어쓰기] [--차례없이 --u <번호>]\n'
    + '      node tools/아르곤웹.js 보내기 --파일 <사진·글…> --지시문 <지시문 파일> --답 <답.md> [--머리 <답 머리 글>]\n'
    + '      node tools/아르곤웹.js 읽기 <작업.json…> [같은 선택]');
  return 2;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack || e.message); process.exitCode = 1; });
}

module.exports = {
  parseArgs, 작업만들기, 작업읽기, 작업문제, 할일정하기, 줄이름, 페이지글, 결과가르기, 계정번호, 표시경로, 종류, 칩이름,
  지시문읽기, 점검한편, 점검, 모호한좌우, 충돌표, 첨부한도, 지시문한도, 기본공간, 페이지, 새답, 다시할일,
};
