#!/usr/bin/env node
'use strict';
/**
 * 아르곤웹 — Gemini 웹 「4 Argon」(사고 수준 높음)에 사진 · 글 파일을 올려 묻고 답을 파일로 받는다. 굽기 전 지시문의 기계 점검도 한다(2026-10-31).
 *
 *   node tools/아르곤웹.js 점검 <지시문 파일…> [--json] [--없이 <항목,…>]
 *        굽기 전 지시문(작업 JSON 배열 · 「## 컷」 마크다운 · 글 한 편)을 길이 · 필수 문장 · 충돌 · 좌우 표기로 본다. 빠짐 · 넘침이 있으면 종료 1.
 *        항목: 길이 · 영상 · 나이 · 점 · 결 · 글자 · 혼자 · 충돌 · 좌우 · 비율 (--없이 혼자,좌우 처럼 뺀다 — 단체 컷 등)
 *   node tools/아르곤웹.js 보내기 <작업.json…> [--이름 <줄 이름>] [--두줄] [--덮어쓰기] [--차례없이 --u <번호> [--계정 <이름>]] [--공간 <작업 공간>]
 *   node tools/아르곤웹.js 보내기 --파일 <사진·글…> --지시문 <지시문 파일> --답 <답.md> [--머리 <답 머리 글>]
 *        공용 차례(gemini)를 잡고 → 작업마다 새 대화(새 탭)에 올려 보내고 → 답을 파일로 받고 → 내려놓는다.
 *        한 차례(보내기 · 읽기 6번 · 20분)를 넘길 것 같으면 내려놓고 다시 줄을 선다. 답 파일이 이미 있는 작업은 건너뛴다.
 *   node tools/아르곤웹.js 읽기 <작업.json…> [같은 선택]
 *        보낸 대화를 같은 작업 공간의 탭에서 읽는다(열린 탭은 옮기거나 새로 고치지 않는다). 탭에 없고 보냄 표시가 있으면 빈 탭 하나로
 *        같은 계정 첫 화면의 사이드바 최근 대화(보낸 지 20분 안이면 8개, 지나면 15개)를 차례로 열어 지시문 전체 · 그림 수가 맞는 대화를 찾아
 *        답을 읽고, 표시 · 결과에 그 주소를 남긴다(11-08). 어디에도 없고 보낸 지 20분이 지났으면 표시를 <답>.안보내짐.json으로 옮긴다 —
 *        다음 보내기가 다시 보낸다. 지시문이 같은데 첨부가 다르거나 같은 대화가 여럿이면 「헷갈림」으로 멈추고 손에 넘긴다(표시는 그대로).
 *   node tools/아르곤웹.js 확인 [--이름 <줄 이름>] [--두줄] [--차례없이 --u <번호> --계정 <이름>] [--공간 <작업 공간>]
 *        차례를 잡고 그 줄 계정의 새 대화 화면만 열어 「Google 계정 … @」 표시가 차례의 계정과 같은지 본다 — 올리기 · 보내기 없음(11-07).
 *
 * 작업 파일: { "files": [...], "prompt": "<지시문>" | "promptFile": "<파일>", "out": "<답.md>", "shots"?, "head"?, "space"?, "answerMin"? }
 *   경로는 작업 파일 폴더 기준으로도 쓴다. 첨부는 한 번에 10개까지, 지시문은 4,300자 안(긴 자료는 글 파일로 붙인다).
 *   그림이 4장을 넘으면 보내기 전에 경고한다 — 11-07 그림 8장 한 대화는 두 번 다 대화가 남지 않았다(4장씩은 받음). 멈추지는 않는다:
 *   experiences/drama/qa/제2의나-20261102/조각/실존대조.mjs 모델이 얼굴 조각 5~10장 묶음을 11-04~06에 그대로 받았다.
 *   글 파일은 칩에 보이는 이름(확장자 뺀)으로 확인하니 이름이 서로 달라야 한다.
 *
 * 다시 보내지 않기: 페이지 스크립트(tools/아르곤웹.mjs)가 보내기를 누르기 직전에 `<답>.보냄.json` 표시를 쓰고, 답을 받으면 지운다.
 *   표시가 남은 작업은 보내기를 불러도 「읽기」로 간다. 표시는 손으로 지우지 않는다 — 읽기가 탭 · 사이드바까지 보고 없으면(보낸 지 20분 뒤)
 *   <답>.안보내짐.json으로 옮겨(기록은 남김) 다음 보내기가 다시 보낸다. 사이드바를 거치지 않고 표시를 푸는 길은 없다(같은 질문을 두 번 보내지 않게).
 * 올리기 잠금: 한 ego 브라우저에서 파일 올리기는 한 번에 하나(10-31 a · b 두 줄 동시 올리기에서 첨부 0장) — 이 도구끼리는 임시 폴더 잠금
 *   (%TEMP%/synk-argonweb-upload.lock)으로 지킨다. 11-08부터 gemini 차례를 잡은 뒤, 파일이 있는 보내기 한 건의 「올리기 ~ 보내기 누르기 직전」에만
 *   쥔다(차례를 기다리며 쥐던 앞 판은 줄이 꺼진 7시간 동안 이 PC의 아르곤을 모두 묶었다). 상한(10분 + 25MB마다 1분, 15분까지)을 넘기면 올리기를
 *   그만두고 잠금을 풀어 「올리기 시간 넘김」으로 묶음을 멈춘다(보내지 않았으니 다시 불러도 된다). 상한 + 3분을 넘겨 살아 쥔 주인은 기다리는 쪽이
 *   「멈춘 주인」으로 치우고 공용차례 README 막힘 기록에 남긴다. 「--두줄」은 다른 올리기 실행기가 안 도는 것을 알 때만 붙인다.
 * 차례: 사용자 폴더의 synk-vendor/_공용차례/차례.py(README). 막힘 · 한도 · 동의 창은 누르지 않고 멈춘다 — sorry면 두 줄 다 끈다(off 파일).
 * 계정: 차례의 `계정` 출력(「gemini-a 77yuhbs https://gemini.google.com/u/1/」)에서 번호와 계정 이름을 함께 받아, 페이지 스크립트가 화면의 계정
 *   표시와 대조한다 — 다르면 올리기 전에 멈춘다. 11-07 ego 기본 프로필이 `Profile 2`(「유호 (Chrome)」)로 바뀌어 구글 로그인이 그 프로필에만 있고
 *   순번도 달라졌다(a 77yuhbs /u/1 · b unmet25 /u/5). 공간은 그 프로필에 새 이름(`-p2`)으로 만든다 — 이름이 같은 옛 공간은 「유호」 프로필 그대로 열린다.
 * 함정: docs/현장노트/gemini_사진.md 「영상 올려 분석시키기」. 시험: node --test tests/아르곤웹.test.js
 * 실행기 원문: 실행마다 .tmp/아르곤웹/<시각-pid-고유값>/stdout.log · stderr.log에 받은 바이트 전체를 남긴다(재시도도 새 폴더).
 *   실행.json에는 작업 · 종료 코드 · 신호 · 바이트 수 · 실행한 스크립트 SHA-256을 남긴다. 원문에는 계정 · 답이 섞일 수 있어 공개하지 않는다.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { StringDecoder } = require('node:string_decoder');
const { spawn, spawnSync } = require('node:child_process');

const 페이지 = path.join(__dirname, '아르곤웹.mjs');
const 기본공간 = 'synk-argon-web-p2'; // 11-07 Profile 2로 옮김(옛 'synk-argon-web'은 「유호」 프로필 — 구글 로그아웃)
const 기본프로필 = 'Profile 2';
const 첨부한도 = 10;
const 지시문한도 = 4300;
const 한차례 = { 건: 6, 새건마감: 12 * 60_000, 다시읽기마감: 15 * 60_000 }; // 한 건 3~8분 — 12분 뒤에는 새 건을 시작하지 않는다(20분 안)
const 보내기전실패쉼 = 20_000;
const 그림한도 = 4; // 한 대화 그림 — 11-07 그림 8장 묶음은 두 번 다 대화가 남지 않았다(4장씩은 받음). 경고만 한다(실존대조 얼굴 조각 5~10장은 받았다)
const 풀기기다림 = 20 * 60_000; // 보낸 지 이만큼 지나고 탭 · 사이드바에도 없으면 표시를 「안 보내짐」으로 옮긴다(사이드바 목록이 늦게 바뀐다, 10-19)

const 슬래시 = (p) => String(p).replace(/\\/g, '/');
const 종류 = (f) => (/\.(jpe?g|png|webp|gif|heic)$/i.test(f) ? '사진' : /\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(f) ? '영상' : '글');
const 칩이름 = (f) => path.basename(f).replace(/\.[^.]+$/, '');
const 그림셈 = (files) => (files || []).filter((f) => 종류(f) === '사진').length;
const 표시경로 = (out) => `${out}.보냄.json`;
const 풀린표시경로 = (out) => `${out}.안보내짐.json`;
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

// 보내기 전 경고(멈추지 않음) — 그림이 4장을 넘는 작업. 멈추게 하지 않는 까닭: 실존대조.mjs 모델이 얼굴 조각 5~10장 묶음을 11-04~06에 받았다.
function 작업경고(job) {
  const n = 그림셈(job.files);
  if (n <= 그림한도) return [];
  return [`그림 ${n}장 — 한 대화 그림 ${그림한도}장까지(11-07 8장 묶음 실패) — 나눠 보낸다. 이번에는 경고만 하고 보낸다(작은 얼굴 조각 5~10장 묶음은 11-04~06에 받았다) — 「보냄」으로 끝나면 ${그림한도}장씩 나눈다`];
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

// 첫 줄은 JOB, 다음 줄들은 판단 함수 소스(페이지 스크립트가 같은 함수로 대화를 알아보고 표시 풀기를 정한다), 그 뒤가 페이지 스크립트
function 판단머리() {
  return 판단함수.map((f) => `const ${f.name} = ${f.toString()};`).join('\n');
}

function 페이지글(job, u, mode, 계정 = '') {
  const JOB = {
    mode, files: job.files.map(슬래시), prompt: job.prompt, out: 슬래시(job.out), shots: 슬래시(job.shots), u: Number(u),
    account: 계정 || job.account || '', space: job.space || 기본공간, profile: job.profile || 기본프로필,
    head: job.head || '아르곤 답', mark: 슬래시(표시경로(job.out)), unsentMark: 슬래시(풀린표시경로(job.out)),
    claimed: Array.isArray(job.claimed) ? job.claimed : [], twins: Number(job.twins) || 0, releaseAfterMs: 풀기기다림,
    ...(job.failShot ? { failShot: 슬래시(job.failShot) } : {}),
    ...(job.answerMin ? { answerMin: job.answerMin } : {}), ...(job.sentWaitSec ? { sentWaitSec: job.sentWaitSec } : {}),
    ...(job.upload ? { upload: job.upload } : {}), // 올리기 잠금 { lock, key, deadline } — 파일을 올리는 보내기만(페이지돌리기가 쥔 뒤)
  };
  return `globalThis.JOB = ${JSON.stringify(JOB)};\n${판단머리()}\n${fs.readFileSync(페이지, 'utf8')}`;
}

// ego 출력 → 결과. ego는 스크립트의 console 출력을 표준 오류로 낸다(10-31 첫 실행 — 표준 출력만 읽어 「받음」을 못 보고 다시 보내려 했다).
// 그래서 두 흐름을 합쳐 읽고, 받았는지는 출력과 따로 이번 실행에 새로 써진 답 파일(받은답)로도 본다.
// 표시 파일이 남았으면 보냈을 수 있다 — 보내기 전 실패만 「실패」(다시 돌려도 된다).
// 읽기가 사이드바까지 보고 표시를 옮겼으면 「안 보내짐」(다음 보내기가 다시 보낸다), 거의 같은 대화가 여럿이면 「헷갈림」(표시는 그대로 — 손으로).
function 결과가르기(출력, 표시있음, 받은답 = null) {
  const 줄들 = String(출력 || '').split(/\r?\n/);
  // 일반 로그 · 스택 줄마다 JSON 예외를 만들지 않는다. 원문은 실행기기록이 별도로 전부 보존한다.
  const steps = 줄들.map((l) => { const s = l.trim(); if (!s.startsWith('{')) return null; try { return JSON.parse(s); } catch { return null; } }).filter((x) => x && x.step);
  const done = steps.find((x) => x.step === 'done');
  const url = (steps.filter((x) => ['sent', 'url', 'tab', 'found', 'done'].includes(x.step) && x.url).pop() || {}).url || '';
  const 찾은 = steps.find((x) => x.step === 'found');
  if (done || 받은답) return { 결과: '받음', url, 글자: done ? done.chars : 받은답.글자, ...(찾은 ? { 찾음: 찾은.via || '사이드바' } : {}) };
  const f = steps.find((x) => x.step === 'fail');
  const 오류머리 = f ? '' : 줄들.find((l) => /(?:^|\]\s*)\s*\w*Error(?:\s*\[[^\]]+\])?:/.test(l));
  const 꼬리 = f || 오류머리 ? '' : String(출력 || '').trim().split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('{"step"')).slice(-2).join(' / ');
  const 까닭 = f ? f.why : (오류머리 || 꼬리 || '출력 없이 끝남');
  if (f && f.kind === '멈춤') return { 결과: '멈춤', 까닭, 보냄: 표시있음, url };
  if (f && f.kind === '안보내짐' && !표시있음) return { 결과: '안 보내짐', 까닭, 기록: f.record || '' };
  if (f && f.kind === '헷갈림') return { 결과: '헷갈림', 까닭, url, 후보: Array.isArray(f.urls) ? f.urls : [], 보냄: 표시있음 };
  if (f && f.kind === '올리기넘김' && !표시있음) return { 결과: '올리기 시간 넘김', 까닭 }; // 표시를 쓰기 전에 그만뒀다 — 다시 보내도 된다
  if (표시있음) return { 결과: '보냄', 까닭, url, 늦음: !!(f && f.kind === '늦음'), 사라짐: !!(f && f.kind === '사라짐') };
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

// 차례 `계정` 출력의 둘째 칸(계정 이름) — 번호를 계정 이름으로 바꾸는 표를 따로 두지 않는다(로그인이 바뀌면 순번이 바뀐다, 11-07)
function 계정이름(글) {
  const m = /^gemini-[a-z]+\s+(\S+)\s+https:\/\/gemini\.google\.com\/u\/\d+\//m.exec(String(글 || ''));
  return m ? m[1] : '';
}

// ── 보낸 대화 알아보기 · 표시 풀기 판단 ──
// 아래 함수들(판단함수 목록 — 올리기 기다림 둘은 11-08)은 페이지글()이 소스째 페이지 스크립트 앞에 붙인다(아르곤웹.mjs가 같은 함수로 판단 — 시험은 여기서). 그래서 이 파일의 다른 이름
// (fs · path · 상수)을 쓰지 않고 서로만 부른다.

// 보낸 글(user-query)은 목록 번호 · 마크다운 기호가 빠지고 줄바꿈이 달라져 그려진다 — 그것만 걷고 견준다(10-31 앞머리 견주기와 같은 셈).
function 글정규화(t) {
  return String(t || '').replace(/\d+\.(?=\s)/g, '').replace(/[\s#*_`>|-]+/g, '');
}

function 대화아이디(글) {
  const m = /\/app\/([0-9a-f]{8,})/.exec(String(글 || ''));
  return m ? m[1] : '';
}

// 한 대화의 보낸 글들(user-query마다 { 글: innerText, 그림: 보이는 그림 수 })이 이 작업과 맞는지.
//   기대 = { 지시문, 그림: 사진 수(영상이 있으면 null — 안 셈), 글: 글 파일 수(칩 아이콘이 그림으로 잡힐 여유) }
//   먼저 표시의 「지시문앞」과 같은 기준(글정규화 앞 40자 — 보내기 확인이 실제로 쓰는 셈)이 맞아야 하고, 그 뒤 전체는 글자 · 숫자만 견준다
//   (11-02 실측으로 전체 글이 정규화째 같게 그려지는 것은 봤지만 곧은 따옴표 같은 기호는 못 봤다 — 기호 하나로 내 대화를 남의 것으로 보면 두 번 보낸다)
//   맞음: 지시문 전체가 들어 있고 그림 수가 맞거나 셀 수 없다(0)
//   첨부다름: 지시문 전체는 같은데 보이는 그림 수가 다르다 — 같은 지시문을 다른 그림으로 보낸 작업(11-07 8장 → 4장씩 나눔)
//   잘림: 앞머리 40자(표시의 「지시문앞」과 같은 기준)부터 같다가 보낸 글이 거기서 끝난다(남은 글 60자 안 — 단추 글자 정도) —
//         화면이 글을 줄여 그렸을 수 있어 「없음」으로 치지 않는다
//   앞머리: 앞머리부터 같다가 갈라진 뒤에도 남의 글이 길게 이어진다 — 같은 틀의 다른 지시문(미학맹검 묶음끼리는 화면 목록만 다르다)
//   다름: 앞머리부터 다르다
function 대화견주기(보낸글들, 기대) {
  const 온 = 글정규화(기대 && 기대.지시문);
  if (!온) return '다름';
  const 앞 = 온.slice(0, 40);
  const 그림 = 기대.그림 == null ? null : Number(기대.그림);
  const 여유 = Number(기대.글 || 0);
  const 무게 = { 다름: 0, 앞머리: 1, 잘림: 2, 첨부다름: 3 };
  const 글자 = (s) => 글정규화(s).replace(/[^\p{L}\p{N}]+/gu, '');
  const 온글자 = 글자(온);
  const 앞글자 = 글자(앞);
  // 앞머리가 나오는 자리마다 이 지시문과 같은 만큼 재고, 가장 길게 같은 자리에서 갈라진 뒤 보낸 글이 몇 자 남는지(글자 · 숫자만)
  const 갈라진뒤 = (t) => {
    if (!앞글자) return 0; // 앞머리에 글자가 없으면 못 가린다 — 막는 쪽(잘림)으로
    let 길이 = -1, 남음 = t.length;
    for (let i = t.indexOf(앞글자); i >= 0; i = t.indexOf(앞글자, i + 1)) {
      let k = 앞글자.length;
      while (k < 온글자.length && i + k < t.length && t[i + k] === 온글자[k]) k += 1;
      if (k > 길이) { 길이 = k; 남음 = t.length - (i + k); }
    }
    return 남음;
  };
  let 결과 = '다름';
  for (const q of 보낸글들 || []) {
    if (!글정규화(q && q.글).includes(앞)) continue;
    const t = 글자(q && q.글);
    let 이번 = '';
    if (t.includes(온글자)) {
      const n = Number((q && q.그림) || 0);
      이번 = 그림 === null || n === 0 || (n >= 그림 && n <= 그림 + 여유) ? '맞음' : '첨부다름';
    } else 이번 = 갈라진뒤(t) <= 60 ? '잘림' : '앞머리';
    if (이번 === '맞음') return '맞음';
    if (무게[이번] > 무게[결과]) 결과 = 이번;
  }
  return 결과;
}

// 표시 파일의 보낸 때(ms). 「시각」은 서울 시각 글(sv-SE · 「2026-11-08 03:10:00」), 못 읽으면 파일 시각(파일시각)
function 보낸때(표시) {
  if (!표시) return NaN;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(String(표시.시각 || '').trim());
  const t = m ? Date.parse(`${m[1]}T${m[2]}+09:00`) : NaN;
  if (Number.isFinite(t)) return t;
  return Number.isFinite(표시.파일시각) ? 표시.파일시각 : NaN;
}

// 표시가 지금 잡은 계정에서 보낸 것인지 — 계정 이름이 적혀 있으면 이름으로(로그인이 바뀌면 순번이 바뀐다, 11-07), 없으면 /u/ 번호로
function 표시계정(표시, u, 계정) {
  if (!표시) return { 같음: false, 까닭: '보냄 표시가 없다' };
  if (표시.계정이름 && 계정) return 표시.계정이름 === 계정 ? { 같음: true } : { 같음: false, 까닭: `보낸 계정은 ${표시.계정이름}(지금 ${계정})` };
  if (표시.계정 != null && 표시.계정 !== '' && Number(표시.계정) !== Number(u)) return { 같음: false, 까닭: `보낸 계정은 /u/${표시.계정}(지금 /u/${u})` };
  return { 같음: true };
}

// 탭 · 사이드바 어디에도 맞는 대화가 없을 때 표시를 풀지(「안 보내짐」). 본 = { 계정확인, 사이드바: 뜬 대화 링크 수, 열어봄, 빈화면, 헷갈림 }
// 화면 계정을 대조했고 · 사이드바가 떴고 · 글이 안 뜬 대화 · 거의 같은 대화가 없고 · 보낸 지 기다림(20분)이 지났을 때만 푼다.
function 표시풀까(표시, 지금, 본, 기다림) {
  if (!표시) return { 풀기: false, 까닭: '보냄 표시가 없다' };
  if (!본 || !본.계정확인) return { 풀기: false, 까닭: '화면 계정을 대조하지 못했다(계정 이름 없이 불렀다)' };
  if (!본.사이드바) return { 풀기: false, 까닭: '사이드바에 대화 목록이 안 떴다' };
  if (본.빈화면) return { 풀기: false, 까닭: `열어도 글이 안 뜬 대화가 ${본.빈화면}개 있다` };
  if (본.헷갈림) return { 풀기: false, 까닭: `지시문이 거의 같은 대화가 ${본.헷갈림}개 있다` };
  const t = 보낸때(표시);
  if (!Number.isFinite(t)) return { 풀기: false, 까닭: '표시에서 보낸 때를 못 읽었다' };
  const 분 = Math.floor((지금 - t) / 60_000);
  if (지금 - t < 기다림) return { 풀기: false, 까닭: `보낸 지 ${분}분 — ${Math.round(기다림 / 60_000)}분이 지나야 푼다(사이드바 목록이 늦게 바뀐다)` };
  return { 풀기: true, 까닭: `사이드바 최근 대화 ${본.열어봄}개에 없다 · 보낸 지 ${분}분` };
}

// 「안 보내짐」 기록 한 줄 — 표시 내용에 언제 · 왜 · 몇 개를 보고 풀었는지 붙인다(파일시각은 뺀다)
function 풀린기록(표시, 본, 까닭, 지금글) {
  const 기록 = { ...(표시 || {}), 풀린때: 지금글, 까닭, 열어본대화: 본 ? 본.열어봄 : 0, 사이드바대화: 본 ? 본.사이드바 : 0 };
  delete 기록.파일시각;
  return 기록;
}

// 올리기 뒤 고정 기다림(ms) — 썸네일 수가 맞은 뒤에도 올리는 중이다(10-25). 12초 + 파일마다 1.5초(영상 +15초)에, 큰 묶음은 2MB 넘는 1MB마다 2초
// (1분까지)를 더한다 — 11-08 큰 그림 넷(7~11MB) 묶음 셋 · 영상 하나(10MB)가 덜 올라간 채 보내져 사라졌다
function 올리기뒤기다림(바이트, 파일수, 영상) {
  const MB = Math.max(0, Number(바이트) || 0) / (1024 * 1024);
  return 12000 + 1500 * (Number(파일수) || 0) + (영상 ? 15000 : 0) + Math.min(60000, Math.round(2000 * Math.max(0, MB - 2)));
}

// 누르기 직전 올리기 끝 기다림 상한(초) — 미리보기 안 돌고 있는 표시 · 꺼진 보내기 단추가 없어질 때까지 이만큼까지 본다. 30초 + 1MB마다 3초, 150초까지.
// 넘기면 그대로 보낸다(선택자가 다른 것을 잡아도 늦어질 뿐 막히지 않게)
function 올리기끝상한초(바이트) {
  const MB = Math.max(0, Number(바이트) || 0) / (1024 * 1024);
  return Math.min(150, 30 + Math.ceil(3 * MB));
}

const 판단함수 = [글정규화, 대화아이디, 대화견주기, 보낸때, 표시계정, 표시풀까, 풀린기록, 올리기뒤기다림, 올리기끝상한초];

// ── 사이드바에서 찾을 때 이 묶음에서 넘길 것 ──

// 답 파일 머리의 「대화: <주소>」에서 대화 번호
function 답대화(out) {
  try {
    const m = /^대화: (\S+)/m.exec(fs.readFileSync(out, 'utf8').slice(0, 3000));
    return m ? 대화아이디(m[1]) : '';
  } catch { return ''; }
}

// 보냄 표시 — 없으면 null, 깨졌으면 {}에 파일 시각만
function 표시읽기(out) {
  const f = 표시경로(out);
  let st;
  try { st = fs.statSync(f); } catch { return null; }
  let j = {};
  try { const x = JSON.parse(fs.readFileSync(f, 'utf8')); if (x && typeof x === 'object') j = x; } catch { /* 깨진 표시 — 파일 시각으로 */ }
  return { ...j, 파일시각: st.mtimeMs };
}

// 이 묶음의 다른 작업이 쓴 대화(답 · 표시에 적힌 주소)는 후보에서 빼고(claimed), 지시문 · 그림 수가 똑같은데 대화를 모르는 작업이
// 또 있으면(보냄 표시가 있거나 주소 없는 답) 사이드바로는 가리지 못한다(twins) — 11-07처럼 같은 지시문을 4장씩 나눠 보낸 묶음
function 찾기정보(jobs, job) {
  const 나 = path.resolve(job.out);
  const 남 = jobs.filter((k) => k.out && path.resolve(k.out) !== 나);
  const 아이디 = (k) => 답대화(k.out) || 대화아이디((표시읽기(k.out) || {}).대화);
  const 열쇠 = (k) => `${글정규화(k.prompt)}#${그림셈(k.files)}`;
  const claimed = [...new Set(남.map(아이디).filter(Boolean))];
  const twins = 남.filter((k) => 열쇠(k) === 열쇠(job) && !아이디(k) && (fs.existsSync(표시경로(k.out)) || fs.existsSync(k.out))).length;
  return { claimed, twins };
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

// ── 올리기 잠금 ──
// 한 ego 브라우저에서 파일 올리기는 한 번에 하나(10-31 a · b 두 줄 동시 올리기에서 첨부 0장). 11-08부터 gemini 차례를 잡은 뒤, 파일이 있는 보내기
// 한 건의 「올리기 ~ 보내기 누르기 직전」에만 쥔다 — 앞 판은 차례를 기다리는 동안에도 쥐어, a · b 줄이 꺼진 07:41~14:22 내내 차례만 기다리던
// 주인(07:13부터) 하나가 이 PC의 아르곤 아홉 건을 묶었다(현장노트 gemini_사진 「올리기 잠금」).
// 잠금 폴더 = <열쇠>.key(먼저 씀) + owner.json { pid, 이름, 시각, 상한, 열쇠, 판: 2(열쇠 파일을 쓰는 판), 할일 }. 푸는 것 · 넘겨받는 것은 모두 그 열쇠 파일 지우기로 확인한다 —
// 지우기는 한 사람만 되고, 그새 풀리고 새 주인이 잡은 폴더에는 그 열쇠 파일이 없다(11-08 GPT 검수 — 「읽고 지우기」 · 「옮겼다 되돌리기」는 그 틈에
// 새 주인 것을 지울 수 있었다). 페이지 스크립트가 누르기 직전 · 그 앞에서 끝날 때 · 상한에 스스로 풀고, 부르는 쪽은 상한 + 끄기여유에도 쥐고 있으면
// 실행기를 나무째 끄고 푼다. 기다리는 쪽은 주인 pid가 없거나, 살아 있어도 상한 + 넘김여유를 넘겼으면 「멈춘 주인」으로 치우고 넘겨받는다
// (그 프로세스는 끄지 않는다). 보냄 표시(<답>.보냄.json)는 잠금과 따로라 치울 때도 건드리지 않는다.
const 설정 = {
  폴더: path.join(os.tmpdir(), 'synk-argonweb-upload.lock'),
  기록폴더: path.join(__dirname, '..', '.tmp', '아르곤웹'), // 원문은 공개 저장소 밖에, 실행마다 새 폴더(재시도도 덮지 않음)
  에고: 'ego-browser nodejs', // 페이지 스크립트를 표준 입력으로 받는 실행기(시험은 가짜로 바꾼다)
  쉼: 10_000, // 기다리는 쪽이 다시 보는 간격
  살핌: 2_000, // 쥔 쪽이 스크립트가 잠금을 풀었는지 보는 간격
  끄기여유: 60_000, // 상한 뒤 페이지 스크립트가 스스로 그만두고 풀 틈 — 그래도 쥐고 있으면 실행기를 끈다
  넘김여유: 3 * 60_000, // 상한 뒤 이만큼 지나도 살아 쥐고 있으면 멈춘 주인
  빈잠금: 2 * 60_000, // 주인 표시(owner.json) 없는 잠금 폴더가 이만큼 묵으면 쓰다 끊긴 것
  옛판줄: 75 * 60_000, // 상한 없는 옛 판 주인이 gemini 줄을 이만큼 넘게 쥐면 멈춘 것(한 차례 최대 — 새 건 12분 + 한 건 30분 + 1분 + 다시 읽기 30분)
  옛판잠금: 60 * 60_000, // 상한 없는 옛 판 주인이 줄도 번호표도 없이 이만큼 넘게 쥐면 멈춘 것(--차례없이 한 차례 — 새 건 12분 + 한 건 30분 + 1분 남짓)
  상한: 0, // 시험용 — 0이 아니면 올리기 상한(ms)을 이것으로
};
const 때 = (ms) => new Date(ms).toLocaleTimeString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 5);
const 분수 = (ms) => Math.max(0, Math.round(ms / 60_000));

// 올리기 상한 — 10분 + 25MB마다 1분(올림), 15분까지. 첫 화면 · 모드 고르기 · 올리기 · 썸네일 뒤 기다림 · 지시문 넣기까지(보통 1~4분)
function 올리기상한(바이트) {
  return 설정.상한 || Math.min(15 * 60_000, 10 * 60_000 + Math.ceil(Math.max(0, Number(바이트) || 0) / (25 * 1024 * 1024)) * 60_000);
}
function 올리기상한계산(files) {
  return 올리기상한((files || []).reduce((n, f) => { try { return n + fs.statSync(f).size; } catch { return n; } }, 0));
}

// owner.json — 없거나 덜 써졌으면 null, 읽다 막히면 { 모름: true }(멀쩡한 잠금을 「주인 표시 없음」으로 치우지 않게)
function 잠금주인읽기(dir) {
  let 글;
  try { 글 = fs.readFileSync(path.join(dir, 'owner.json'), 'utf8'); } catch (e) { return e.code === 'ENOENT' ? null : { 모름: true }; }
  try { const j = JSON.parse(글); return j && typeof j === 'object' ? j : null; } catch { return null; }
}

const 열쇠파일 = (dir, 열쇠) => path.join(dir, `${열쇠}.key`);
const 열쇠파일들 = (dir) => { try { return fs.readdirSync(dir).filter((f) => f.endsWith('.key')); } catch { return []; } };
// 폴더 하나의 정체 — 같은 경로에 새로 만든 잠금 폴더와 가린다(윈도는 파일 번호, 리눅스는 번호가 다시 쓰여도 만든 때로). 못 읽으면 ''
const 폴더표 = (dir) => { try { const s = fs.statSync(dir, { bigint: true }); return `${s.ino}:${s.birthtimeNs}`; } catch { return ''; } };
const 잠깐 = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// 파일 하나를 지운다 — 지웠으면 true, 없으면 false. 윈도에서 남이 잠깐 연 핸들(EPERM · EBUSY · EACCES)이면 쉬고 세 번까지
function 지우기(f) {
  for (let i = 0; ; i += 1) {
    try { fs.unlinkSync(f); return true; } catch (e) {
      if (e.code === 'ENOENT') return false;
      if (i >= 3 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      잠깐(50);
    }
  }
}

// 내 열쇠 파일이 아직 있나 — 읽다 막히면 있는 것으로 본다(멀쩡히 쥔 잠금을 풀린 것으로 보지 않게)
function 열쇠있음(dir, 열쇠) {
  try { fs.statSync(열쇠파일(dir, 열쇠)); return true; } catch (e) { return e.code !== 'ENOENT'; }
}

// 열쇠를 지운(끝난) 잠금 폴더를 치운다 — 경로째 지우지 않고 고유한 이름으로 옮긴 뒤 지운다(지우는 사이 남이 같은 경로에 새로 잡은 잠금을 안 건드리게).
// 못 옮기면(열린 핸들) 그대로 둔다 — 열쇠 없이 2분 묵은 폴더는 기다리는 쪽이 치운다
function 폴더치우기(dir) {
  const 무덤 = `${dir}.풀림-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  for (let i = 0; ; i += 1) {
    try { fs.renameSync(dir, 무덤); break; } catch (e) {
      if (e.code === 'ENOENT' || i >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) return;
      잠깐(50);
    }
  }
  try { fs.rmSync(무덤, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* 옮긴 이름은 잠금이 아니다 */ }
}

// 내 열쇠 파일을 지운 사람만 푼다 — 지운 뒤 그 폴더는 아무도 못 잡는다(mkdir가 막힘). 남이 넘겨받은 잠금에는 내 열쇠 파일이 없다
function 잠금풀기(dir, 열쇠) {
  try { if (!지우기(열쇠파일(dir, 열쇠))) return false; } catch { return false; }
  폴더치우기(dir);
  return true;
}

// 이 이름의 차례 — 차례.py는 줄을 쥐면 `<줄>.lock/owner.txt` 첫 줄에 「이름 날짜 시각 …」(이 PC 시각)을 쓰고, 기다리는 동안은 `gemini.queue/<번호>_<이름>`
// 번호표를 둔다. 쥔 줄 { 줄, 시각 } · 번호표로 기다림 '줄섬' · 둘 다 없음 null · 읽다 막히면 '모름'
function 줄주인(이름) {
  const dir = path.dirname(차례경로());
  let 모름 = false;
  for (const [줄, 폴더] of [['gemini-a', 'gemini.lock'], ['gemini-b', 'gemini-b.lock']]) {
    let 첫 = '';
    try { 첫 = fs.readFileSync(path.join(dir, 폴더, 'owner.txt'), 'utf8').split(/\r?\n/)[0]; } catch (e) { if (e.code !== 'ENOENT') 모름 = true; continue; }
    const [누구, 날, 때글] = 첫.trim().split(/\s+/);
    if (누구 === 이름) return { 줄, 시각: Date.parse(`${날}T${때글}`) };
  }
  if (모름) return '모름';
  try {
    if (fs.readdirSync(path.join(dir, 'gemini.queue')).some((f) => /^\d+_/.test(f) && f.slice(f.indexOf('_') + 1) === 이름)) return '줄섬';
  } catch (e) { if (e.code !== 'ENOENT') return '모름'; }
  return null;
}

// 올리기 잠금 주인을 치울지 — 주인 = owner.json, 본 = { 살아있음, 폴더나이(ms), 열쇠없음(새 판 열쇠 파일이 없음), 줄: 줄주인() }.
// { 치움, 멈춤(살아 있는데 멈춘 주인 — 막힘 기록에 남김), 까닭 }
function 멈춘주인(주인, 지금, 본 = {}, 값 = 설정) {
  const 치움 = (까닭, 멈춤 = true) => ({ 치움: true, 멈춤, 까닭 });
  const 둠 = (까닭) => ({ 치움: false, 멈춤: false, 까닭 });
  if (주인 && 주인.모름) return 둠('주인 표시를 못 읽음 — 다음 바퀴에 다시 본다');
  const 나이 = Number(본.폴더나이);
  if (!주인) return Number.isFinite(나이) && 나이 > 값.빈잠금 ? 치움(`주인 표시 없는 잠금이 ${분수(나이)}분 묵음(쓰다 끊김)`, false) : 둠('주인 표시를 쓰는 중');
  if (!본.살아있음) return 치움(`주인 pid ${주인.pid}가 없다`, false);
  // 열쇠 파일을 쓰는 판(판 2)은 열쇠를 먼저 쓰니, 열쇠 파일 없는 주인 표시는 푸는 중이거나 열쇠만 지우고 폴더를 못 지운 채 끝난 잠금이다
  // (열쇠를 지우면 폴더 시각이 새로 찍혀 막 푼 것은 2분 안 — 11-08 윈도에서 잼)
  if (주인.열쇠 && Number(주인.판) >= 2 && 본.열쇠없음 && Number.isFinite(나이) && 나이 > 값.빈잠금) return 치움(`열쇠 없이 ${분수(나이)}분 남은 잠금(풀다 끊김)`, false);
  const 끝 = Date.parse(주인.상한);
  if (Number.isFinite(끝)) {
    if (지금 > 끝 + 값.넘김여유) return 치움(`살아 있지만 올리기 상한(${때(끝)})을 ${분수(지금 - 끝)}분 넘김`);
    return 둠(`올리는 중 — 상한 ${때(끝)}${지금 > 끝 ? ' 넘김(주인이 끄고 풀기를 기다림)' : ''}`);
  }
  // 11-08 앞 판 — 상한이 없고 차례를 기다리는 동안에도 쥔다. 올리기는 gemini 줄을 쥐었을 때만 한다
  if (본.줄 === '모름') return 둠('옛 판 주인 — 차례 줄 · 번호표를 못 읽음');
  if (본.줄 === '줄섬') return 치움('옛 판 주인이 gemini 줄 없이 번호표로 차례를 기다리는 중(올리는 중일 수 없다)');
  if (본.줄) {
    const 쥔 = 지금 - 본.줄.시각;
    if (Number.isFinite(쥔) && 쥔 > 값.옛판줄) return 치움(`옛 판 주인이 ${본.줄.줄} 줄을 ${분수(쥔)}분째 쥐고 있다`);
    return 둠(`옛 판 주인이 ${본.줄.줄} 줄을 쥐고 있다 — 올리는 중일 수 있다`);
  }
  // 줄도 번호표도 없다 — 차례 사이 잠깐이거나, --차례없이(부르는 쪽이 다른 이름으로 차례를 쥠)로 올리는 중일 수 있다(11-08 GPT 검수)
  const 쥔지 = 지금 - Date.parse(주인.시각);
  if (Number.isFinite(쥔지) && 쥔지 > 값.옛판잠금) return 치움(`옛 판 주인이 줄 · 번호표 없이 잠금을 ${분수(쥔지)}분째 쥐고 있다`);
  return 둠('옛 판 주인 — 줄 · 번호표가 안 보인다(차례 사이 · --차례없이일 수 있다)');
}

const 같은주인 = (a, b) => (!a && !b) || (!!a && !!b && (a.열쇠 || b.열쇠 ? a.열쇠 === b.열쇠 : a.pid === b.pid && a.이름 === b.이름 && a.시각 === b.시각));
const 주인글 = (주인) => (주인 ? `${주인.이름 || '?'}(pid ${주인.pid}${주인.시각 ? `, ${때(Date.parse(주인.시각))}부터` : ''}${주인.상한 ? ` · 상한 ${때(Date.parse(주인.상한))}` : ' · 옛 판'})` : '주인 표시 없음');

// 공용차례 README 「막힘 기록」에 한 줄(차례.py와 같은 꼴) — 기록을 못 써도 잠금은 넘긴다
function 막힘기록(글) {
  const f = path.join(path.dirname(차례경로()), 'README.md');
  try {
    if (!fs.existsSync(path.dirname(f))) return;
    const 앞 = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    const 때글 = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(5, 16);
    fs.appendFileSync(f, `${앞 && !앞.endsWith('\n') ? '\n' : ''}- ${때글} ${글}\n`);
  } catch { /* 기록 못 함 */ }
}

// 판단한 주인의 잠금을 치운다(본열쇠 = 판단할 때 그 폴더에 있던 열쇠 파일 이름들). 새 판(열쇠가 있는 주인)은 그 열쇠 파일 지우기로 확인한다 — 한 사람만
// 지우고, 그새 풀리고 새 주인이 잡은 폴더에는 이 파일이 없어 손대지 않는다. 열쇠 파일이 이미 없는 같은 주인 표시는 남이 막 푸는 중일 수 있어(열쇠를
// 지우면 폴더 시각이 새로 찍힌다) 2분 묵었을 때만 치운다 — 막 지운 것을 남이 치우고 새로 잡은 뒤 푸는 쪽이 그 새 잠금을 지우던 틈(11-08 GPT 다시 검수 GA2).
// 열쇠로 확인 못 하는 잠금(옛 판 · 주인 표시 없음 · 열쇠만 지우고 끊긴 것)은 다른 이름으로 옮긴 뒤 주인 표시와 열쇠 파일들이 판단할 때와 같으면 지우고,
// 다르면(그새 새 주인) 제자리로 돌린다 — 쓰다 끊겨 열쇠만 남은 폴더도 판단 때와 같으니 치운다(GA3). 본표(판단한 폴더의 정체)를 주면 옮긴 폴더가
// 그 폴더일 때만 지운다 — 판단하는 사이 남이 치우고 같은 경로에 새로 잡은 폴더가 빈 주인 표시 · 같은 열쇠 목록으로 맞아 떨어져도 안 지운다(세 번째 검수).
// 다시 잡아 볼 만하면 true, 이번 바퀴는 기다릴 것이면 false(남이 푸는 중 · 열린 파일로 못 옮김)
function 잠금치우기(dir, 주인, 판단, 나, 본열쇠 = [], 본표 = '') {
  let 기대열쇠 = 본열쇠;
  if (주인 && 주인.열쇠) {
    let 지움;
    try { 지움 = 지우기(열쇠파일(dir, 주인.열쇠)); } catch { return false; }
    if (지움) { 폴더치우기(dir); return 치운뒤(주인, 판단, 나); }
    const 지금 = 잠금주인읽기(dir);
    if (!지금 || 지금.열쇠 !== 주인.열쇠) return true; // 그새 풀렸거나 새 주인이다 — 다시 잡아 본다
    let 나이 = 0;
    try { 나이 = Date.now() - fs.statSync(dir).mtimeMs; } catch { return true; }
    if (나이 <= 설정.빈잠금) return false; // 열쇠가 막 지워졌다 — 남이 푸는 중이니 한 바퀴 기다린다
    기대열쇠 = []; // 열쇠만 지우고 끊긴 잠금 — 열쇠 파일 없는 그 주인 표시로 옮겨 치운다
  }
  const 옮김 = `${dir}.치움-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  try { fs.renameSync(dir, 옮김); } catch (e) { return e.code === 'ENOENT'; }
  const 같은열쇠 = (a, b) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);
  if ((본표 && 폴더표(옮김) !== 본표) || !같은주인(잠금주인읽기(옮김), 주인) || !같은열쇠(열쇠파일들(옮김), 기대열쇠)) {
    try { fs.renameSync(옮김, dir); } catch { fs.rmSync(옮김, { recursive: true, force: true }); console.log(`  ${시각()} 올리기 잠금을 치우다 새 주인 것을 옮겼는데 제자리가 이미 찼다 — 옮긴 것은 지웠다(드묾)`); }
    return true;
  }
  try { fs.rmSync(옮김, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* 옮긴 이름으로 남아도 잠금은 아니다 */ }
  return 치운뒤(주인, 판단, 나);
}

function 치운뒤(주인, 판단, 나) {
  console.log(`  ${시각()} 올리기 잠금 치움 — ${주인글(주인)} · ${판단.까닭}${판단.멈춤 ? ' — 그 프로세스는 끄지 않고 차례를 넘겨받는다' : ''}`);
  if (판단.멈춤) 막힘기록(`${나}(아르곤웹 올리기 잠금): ${주인글(주인)} 잠금을 치우고 넘겨받음 — ${판단.까닭}. 그 프로세스는 끄지 않았다`);
  return true;
}

// 올리기 잠금을 잡는다 — { 폴더, 열쇠, 잡은때, 상한(ms), 풀기() }. 선택.그만()이 참이 되면(차례를 잃음) 기다리기를 그만두고 null
async function 올리기잠금(이름, 상한ms, 선택 = {}) {
  const dir = 설정.폴더;
  const 열쇠 = crypto.randomBytes(8).toString('hex');
  let 알림 = 0, 막힘 = 0;
  for (;;) {
    if (선택.그만 && 선택.그만()) return null;
    try { fs.mkdirSync(dir); } catch (e) {
      // 윈도는 지우는 중인 폴더(남이 막 푼 잠금)에 mkdir하면 EPERM · EACCES를 낸다 — 잠깐 쉬고 다시(1분 넘게 이어지면 진짜 막힘)
      if (['EPERM', 'EACCES', 'EBUSY'].includes(e.code) && (막힘 += 1) <= 120) { await 쉬기(500); continue; }
      if (e.code !== 'EEXIST') throw e;
      막힘 = 0;
      // 한 폴더에서 읽었을 때만 판단한다 — 읽는 사이 남이 치우고 같은 경로에 새로 잡으면 서로 다른 잠금의 주인 표시 · 시각 · 열쇠 목록이 섞인다(세 번째 검수)
      const 표 = 폴더표(dir);
      const 주인 = 잠금주인읽기(dir);
      const 본열쇠 = 열쇠파일들(dir); // 판단할 때 그 폴더의 열쇠 파일들 — 옮겨 치울 때 이것과 같아야 지운다
      let 폴더나이 = 0;
      try { 폴더나이 = Date.now() - fs.statSync(dir).mtimeMs; } catch { continue; } // 그새 풀렸다
      if (!표 || 폴더표(dir) !== 표) { await 쉬기(Math.min(설정.쉼, 1000)); continue; } // 그새 바뀌었다 — 다시 본다
      // 내 열쇠가 든 폴더 — 내가 만들고 쓰다 잃었던(남이 옮겼다 되돌린) 잠금이다. 주인 표시를 마저 쓰고 잡는다
      if (본열쇠.includes(`${열쇠}.key`) && !주인) {
        const 잡음 = 잠금마저쓰기(dir, 이름, 열쇠, 상한ms, 선택);
        if (잡음) return 잡음;
        continue;
      }
      const 읽음 = 주인 && !주인.모름;
      const 판단 = 멈춘주인(주인, Date.now(), {
        살아있음: !!읽음 && 살아있나(주인.pid), 폴더나이,
        열쇠없음: !!읽음 && !!주인.열쇠 && !열쇠있음(dir, 주인.열쇠),
        줄: 읽음 && !주인.상한 ? 줄주인(주인.이름) : null,
      });
      if (판단.치움 && 잠금치우기(dir, 읽음 ? 주인 : null, 판단, 이름, 본열쇠, 표)) continue;
      if (Date.now() - 알림 > 60_000) { console.log(`  ${시각()} 올리기 잠금 기다림 — ${주인글(읽음 ? 주인 : null)} · ${판단.까닭}`); 알림 = Date.now(); }
      await 쉬기(설정.쉼);
      continue;
    }
    try { fs.writeFileSync(열쇠파일(dir, 열쇠), ''); } catch (e) { // 열쇠가 먼저 — 열쇠 파일 없는 새 판 주인 표시는 푸는 중이거나 끝난 잠금으로 본다
      if (e.code === 'ENOENT') continue; // 잡은 폴더가 그새 없어졌다(남이 옮겨 치우는 틈 — 드묾) — 처음부터 다시
      throw e;
    }
    const 잡음 = 잠금마저쓰기(dir, 이름, 열쇠, 상한ms, 선택);
    if (잡음) return 잡음;
  }
}

// 열쇠를 쓴 잠금 폴더에 주인 표시를 쓴다 — { 폴더, 열쇠, 잡은때, 상한, 풀기() }. 쓰는 사이 폴더를 잃었으면(ENOENT) 내 열쇠만 풀고 null(처음부터 다시).
// 실패해도 경로째 지우지 않는다 — 그 경로는 남의 새 잠금일 수 있다
function 잠금마저쓰기(dir, 이름, 열쇠, 상한ms, 선택) {
  const 잡은때 = Date.now();
  const 상한 = 잡은때 + 상한ms;
  try {
    fs.writeFileSync(path.join(dir, 'owner.json'), JSON.stringify({ pid: process.pid, 이름, 시각: new Date(잡은때).toISOString(), 상한: new Date(상한).toISOString(), 열쇠, 판: 2, 할일: 선택.할일 || '' }));
  } catch (e) {
    잠금풀기(dir, 열쇠);
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  return { 폴더: dir, 열쇠, 잡은때, 상한, 풀기: () => 잠금풀기(dir, 열쇠) };
}

// 실행기를 나무째 끈다 — 윈도는 shell(cmd.exe)만 끄면 손주 ego-browser.exe가 남아 출력 관이 안 닫힌다(close가 안 온다).
// ego 안 스크립트는 이것으로 안 멈춘다(현장노트 gemini_사진 「실행기를 꺼도 ego 안 스크립트는 산다」) — 올리기 마감은 페이지 스크립트가 스스로 지킨다
function 나무끄기(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 30_000 });
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* 이미 끝남 */ } } }
}

// ── 한 건 ──

// console 단계 요약과 별개로 두 관의 실제 바이트를 받는 즉시 보존한다. ego의 오류 머리 · 스택은 마지막 두 줄보다 앞에 있다(11-08 묶음 읽기).
// 줄 파싱은 관마다 따로 한다 — UTF-8/JSON 한 줄이 여러 data 사건에 나뉘거나 두 관이 번갈아 와도 깨뜨리지 않는다.
function 실행기기록(job, u, mode) {
  fs.mkdirSync(설정.기록폴더, { recursive: true });
  const dir = fs.mkdtempSync(path.join(설정.기록폴더, `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}-`));
  const 기록 = { 폴더: dir, stdout: path.join(dir, 'stdout.log'), stderr: path.join(dir, 'stderr.log'), 실행: path.join(dir, '실행.json') };
  const 정보 = { 시작: new Date().toISOString(), 작업: job.이름, mode, u, out: job.out };
  fs.writeFileSync(기록.실행, JSON.stringify(정보, null, 2) + '\n');
  const 관 = {}, 판정줄 = [];
  const 줄찍기 = (s) => { for (const l of s) { 판정줄.push(l); if (l.trim().startsWith('{"step"')) console.log(`    ${l.trim()}`); } };
  for (const name of ['stdout', 'stderr']) {
    fs.writeFileSync(기록[name], Buffer.alloc(0));
    관[name] = { 바이트: 0, decoder: new StringDecoder('utf8'), 남음: '' };
  }
  return {
    기록,
    받기(name, d) {
      const p = 관[name];
      fs.appendFileSync(기록[name], d);
      p.바이트 += d.length;
      const lines = (p.남음 + p.decoder.write(d)).split(/\r?\n/);
      p.남음 = lines.pop();
      줄찍기(lines);
    },
    출력: () => [...판정줄, ...Object.values(관).map((p) => p.남음)].join('\n'),
    끝(정보더) {
      for (const p of Object.values(관)) { 줄찍기([p.남음 + p.decoder.end()]); p.남음 = ''; }
      fs.writeFileSync(기록.실행, JSON.stringify({ ...정보, ...정보더, 끝: new Date().toISOString(), 바이트: Object.fromEntries(Object.entries(관).map(([n, p]) => [n, p.바이트])) }, null, 2) + '\n');
    },
  };
}

// 페이지 스크립트 한 번. 파일을 올리는 보내기는 올리기 잠금을 쥐고 띄워, 스크립트가 스스로 풀 때까지(누르기 직전 · 그 앞에서 끝남 · 마감) 본다.
// 실행기 출력은 끝에 한꺼번에 올 때가 있어(현장노트 gemini_사진) 잠금이 풀렸는지는 owner.json으로 본다. 선택 = { 이름(줄 이름), 그만() }
async function 페이지돌리기(job, u, mode, 계정, 선택 = {}) {
  const 기록 = 실행기기록(job, u, mode); // 파일을 못 쓰면 잠금 · 브라우저를 잡기 전에 멈춘다
  let 잠금 = null;
  if (mode === '보내기' && (job.files || []).length) {
    잠금 = await 올리기잠금(선택.이름 || 'argonweb', 올리기상한계산(job.files), { 그만: 선택.그만, 할일: `보내기 ${job.이름 || ''} · 첨부 ${job.files.length}개` });
    if (!잠금) { 기록.끝({ code: null, 그만: true }); return { code: null, 출력: '', 기록: 기록.기록, 그만: true }; }
  }
  const script = 페이지글(잠금 ? { ...job, upload: { lock: 슬래시(잠금.폴더), key: 잠금.열쇠, deadline: 잠금.상한 } } : job, u, mode, 계정);
  const 상한 = (mode === '확인' ? 5 : (job.answerMin || 12) + 18) * 60_000; // 페이지 스크립트 자체 상한(올리기 · 보냄 확인 · 답) 뒤의 마지막 그물 — 확인은 화면 하나라 5분
  const child = spawn(설정.에고, { shell: true, windowsHide: true, detached: process.platform !== 'win32' }); // 리눅스는 나무째 끄려고 따로 무리를 만든다
  child.stdout.on('data', (d) => 기록.받기('stdout', d));
  child.stderr.on('data', (d) => 기록.받기('stderr', d));
  child.stdin.on('error', () => {}); // 실행기가 먼저 끝나면 EPIPE — 출력으로 가른다
  let 끝남 = false, 종료, 실행오류 = '', 관닫음 = false;
  const 닫힘 = new Promise((resolve) => {
    const 끝 = (code) => { if (!끝남) { 끝남 = true; resolve(code); } };
    child.on('close', 끝);
    child.on('error', (e) => { 실행오류 = e.stack || e.message; 끝(null); });
    // 끈 뒤에도 손주가 출력 관을 쥐면 close가 안 온다 — exit 15초 뒤에는 그대로 끝낸다
    child.on('exit', (code) => { 종료 = code; setTimeout(() => { if (끝남) return; 관닫음 = true; child.stdout.destroy(); child.stderr.destroy(); 끝(code); }, 15_000).unref(); });
  });
  const 전체 = setTimeout(() => 나무끄기(child), 상한);
  let 넘김 = '', 짧게 = null, 죽임 = false;
  child.stdin.end(script);
  if (잠금) {
    const 여유 = 설정.끄기여유;
    for (;;) {
      if (!열쇠있음(잠금.폴더, 잠금.열쇠)) { // 내 열쇠 파일이 없어졌다 — 스크립트가 풀었다(읽다 막힌 바퀴는 그대로 쥔 것으로 본다)
        // 스크립트가 풀었다 — 누르기 직전(보냄 표시를 쓴 뒤)이면 그대로 답을 기다린다. 마감 뒤에 표시 없이 풀었으면 마감 감시가 그만둔 것이라
        // (그 뒤로는 누르지 않는다) 2분 안에 안 끝나면 실행기를 끈다. 마감 전에 표시 없이 풀었으면 실패로 끝나는 중 — 끄지 않고 끝나기를 기다린다
        if (!fs.existsSync(표시경로(job.out)) && Date.now() >= 잠금.상한 - 1000) {
          넘김 = '올리기';
          짧게 = setTimeout(() => 나무끄기(child), 2 * 여유);
        }
        break;
      }
      // 실행기가 끝났는데 잠금이 그대로 — 실패 · 오류로 끝났으면 바로 푼다. 0으로 끝나고 실패 줄도 없으면 ego 안 스크립트가 아직 돌 수 있다
      // (현장노트 gemini_사진 「3분 반 만에 돌아왔는데 … 스크립트는 계속」) — 스스로 풀거나 마감이 오기를 기다린다
      if (끝남 && (종료 !== 0 || /"step":"(fail|done)"/.test(기록.출력()))) { 잠금.풀기(); break; }
      if (Date.now() > 잠금.상한 + 여유) {
        if (fs.existsSync(표시경로(job.out))) { 잠금.풀기(); break; } // 누르기 직전까지 갔다(풀기만 못 함) — 끄지 않는다
        넘김 = '올리기';
        죽임 = true;
        console.log(`  ${시각()} 올리기 시간 넘김 — 상한 ${때(잠금.상한)}까지 보내기 앞에 못 가 실행기를 끄고 올리기 잠금을 푼다(보내지 않음)`);
        나무끄기(child);
        잠금.풀기();
        break;
      }
      await (끝남 ? 쉬기(설정.살핌) : Promise.race([닫힘, 쉬기(설정.살핌)]));
    }
  }
  const code = await 닫힘;
  clearTimeout(전체);
  if (짧게) clearTimeout(짧게);
  if (잠금) 잠금.풀기(); // 남았으면(열쇠가 같을 때만)
  기록.끝({ code, signal: child.signalCode || null, 넘김, 죽임, 관닫음, 실행오류, scriptSha256: crypto.createHash('sha256').update(script).digest('hex') });
  console.log(`    실행기 원문 · ${기록.기록.폴더}`);
  return { code, 출력: 기록.출력() + (실행오류 ? `\n${실행오류}` : ''), 기록: 기록.기록, 넘김, 죽임, ...(잠금 ? { 상한분: 분수(잠금.상한 - 잠금.잡은때) } : {}) };
}

// 전체 = 이 묶음의 작업들 — 읽기가 사이드바에서 찾을 때 다른 작업이 쓴 대화 · 같은 지시문 작업을 가린다(찾기정보, 부를 때마다 새로 본다)
// 선택 = { 이름, 그만() } — 올리기 잠금 주인 이름 · 차례를 잃었는지(잠금을 기다리다 잃으면 그만둔다)
async function 한건(job, u, mode, 계정, 전체 = [job], 선택 = {}) {
  console.log(`  ${시각()} ${mode} ${job.이름} — 첨부 ${job.files.length}개 · 지시문 ${job.prompt.length}자 · 계정 /u/${u}${계정 ? ` ${계정}` : ''}`);
  const 시작 = Date.now();
  const run = await 페이지돌리기({ ...job, ...찾기정보(전체, job) }, u, mode, 계정, 선택);
  if (run.그만) return { 결과: '실패', 까닭: '차례를 잃어 올리기 잠금 기다리기를 그만뒀다(보내지 않음)' };
  let r = 결과가르기(run.출력, fs.existsSync(표시경로(job.out)), 새답(job.out, 시작));
  // 마감 뒤 풀림 · 끔인데 결과가 「실패」 — 실행기를 껐거나 실패 줄이 없으면 올리기 시간 넘김. 마감 즈음 제 까닭으로 실패한 건(실패 줄이 있음)은 실패 그대로(한 번 다시 한다)
  if (run.넘김 === '올리기' && r.결과 === '실패' && (run.죽임 || !/"step":"fail"/.test(run.출력))) r = { 결과: '올리기 시간 넘김', 까닭: `올리기가 상한 ${run.상한분}분 안에 보내기 앞까지 못 갔다 — 실행기를 끄고 잠금을 풀었다(보내지 않음 · 다시 부르면 다시 보낸다)` };
  if (r.결과 === '받음') fs.rmSync(표시경로(job.out), { force: true }); // 답을 썼는데 표시가 남은 판 — 다음 부름이 읽기로 가지 않게
  return { ...r, 실행기기록: run.기록, 종료코드: run.code };
}

// ── 보내기 · 읽기 ──

async function 돌리기(jobs, o, 처음) {
  const 문제 = jobs.flatMap((j) => 작업문제(j).map((p) => `${j.이름}: ${p}`));
  if (문제.length) { for (const p of 문제) console.error(`  ✗ ${p}`); console.error('작업 파일을 고친 뒤 다시 부른다(아무것도 보내지 않았다).'); return 2; }
  if (o.차례없이 && !/^\d$/.test(String(o.u || ''))) { console.error('--차례없이는 --u <계정 번호>(차례 `계정`이 준 번호 — 11-07부터 a 줄 1 · b 줄 5)와 함께, --계정 <이름>도 주면 화면 계정과 대조한다 — 차례는 부르는 쪽이 쥐고 있어야 한다'); return 2; }
  const 결과 = [];
  const 남은 = [];
  for (const j of jobs) {
    const 할일 = 할일정하기(j, 처음, o);
    if (할일 === '건너뜀') 결과.push({ 작업: j, 결과: '건너뜀', 까닭: '답 파일이 이미 있다(--덮어쓰기로 다시)' });
    else 남은.push({ ...j, 할일 });
  }
  const 이름 = 줄이름(jobs, o);
  if (/[_\s]/.test(이름)) { console.error('--이름에는 밑줄 · 띄어쓰기를 쓰지 않는다(예: idol-gg-argon)'); return 2; }
  for (const j of 남은) if (j.할일 === '보내기') for (const w of 작업경고(j)) console.log(`  ⚠ ${j.이름}: ${w}`);
  const 할일글 = `아르곤웹 ${남은.length}건 — ${남은.slice(0, 3).map((j) => j.이름).join(' · ')}${남은.length > 3 ? ' …' : ''}`;
  let 멈춤 = '';
  let 이어실패 = 0;
  // 올리기 잠금은 여기서 쥐지 않는다 — 차례를 잡은 뒤 파일을 올리는 보내기 한 건마다 페이지돌리기가 쥐고 푼다(11-08, 위 「올리기 잠금」)
  while (남은.length && !멈춤) {
    let u = Number(o.u), 계정 = o.계정 || '';
    if (!o.차례없이) {
      await 차례기다리기(이름, 할일글, o.두줄);
      const 줄 = 차례(['계정', 이름]).out;
      u = 계정번호(줄);
      계정 = 계정이름(줄);
      if (u === null || !계정) { 차례(['내려놓기', 이름]); throw new Error(`잡은 줄의 계정 주소 · 이름을 못 읽음: ${줄}`); }
    }
    const 시작 = Date.now();
    let 건 = 0, 잃음 = false;
    const 선택 = { 이름, 그만: () => 잃음 };
    const 살 = o.차례없이 ? null : setInterval(() => { if (차례(['살아있음', 이름]).code !== 0) 잃음 = true; }, 150_000);
    try {
      while (남은.length && !멈춤 && !잃음 && 건 < 한차례.건 && Date.now() - 시작 < 한차례.새건마감) {
        const j = 남은.shift();
        건 += 1;
        let r = await 한건(j, u, j.할일, 계정, jobs, 선택);
        if (!o.차례없이 && 차례(['살아있음', 이름]).code !== 0) 잃음 = true;
        // 보낸 뒤 끊긴 판 — 다시 보내지 않고 같은 탭을 읽는다. 보낸 글이 화면에서 사라진 판(사라짐)은 1분 뒤 읽어도 없다 — 20분 뒤 읽기로
        if (r.결과 === '보냄' && !r.늦음 && !r.사라짐 && !잃음 && 건 < 한차례.건 && Date.now() - 시작 < 한차례.다시읽기마감) {
          await 쉬기(60_000);
          건 += 1;
          const r2 = await 한건(j, u, '읽기', 계정, jobs, 선택);
          if (['받음', '헷갈림', '멈춤', '안 보내짐'].includes(r2.결과)) r = r2;
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
        // 올리기가 상한 안에 안 끝난 날(11-08 07시 계정 단위 첨부 「!」 같은)은 이어 올려도 같다 — 묶음을 멈추고 알린다(보내지 않았으니 다시 불러도 된다)
        if (r.결과 === '올리기 시간 넘김') 멈춤 = r.까닭;
        결과.push({ 작업: j, ...r });
      }
    } finally {
      if (살) clearInterval(살);
      if (!o.차례없이) console.log(`  차례 · ${차례(['내려놓기', 이름]).out.split(/\r?\n/).pop()}`);
    }
    if (o.차례없이 && 남은.length && !멈춤) { 멈춤 = `한 차례(${한차례.건}건 · 20분)를 다 써서 남은 ${남은.length}건은 다시 부른다(--차례없이)`; }
  }
  for (const j of 남은) 결과.push({ 작업: j, 결과: '안 함', 까닭: 멈춤 || '' });
  return 보고(결과, 멈춤);
}

// 계정 확인만 — 차례를 잡고 그 줄 계정의 새 대화 화면을 열어 계정 표시만 대조하고 닫는다(올리기 · 보내기 없음). 로그인 · 프로필이 바뀐 뒤 쓴다(11-07).
async function 확인(o) {
  const 이름 = o.이름 || 'argonweb-check';
  if (/[_\s]/.test(이름)) { console.error('--이름에는 밑줄 · 띄어쓰기를 쓰지 않는다'); return 2; }
  if (o.차례없이 && (!/^\d$/.test(String(o.u || '')) || !o.계정)) { console.error('--차례없이 확인은 --u <번호> --계정 <이름>과 함께 — 차례는 부르는 쪽이 쥐고 있어야 한다'); return 2; }
  const out = path.join(os.tmpdir(), `synk-argonweb-${이름}-확인.md`);
  const job = { 이름: '계정 확인', files: [], prompt: '', out, shots: path.dirname(out), space: o.공간 || 기본공간, head: '계정 확인', answerMin: 1 };
  let u = Number(o.u), 계정 = o.계정 || '';
  if (!o.차례없이) {
    await 차례기다리기(이름, '아르곤웹 계정 확인(올리기 · 보내기 없음)', o.두줄);
    const 줄 = 차례(['계정', 이름]).out;
    u = 계정번호(줄);
    계정 = 계정이름(줄);
  }
  try {
    if (u === null || !계정) { console.error('잡은 줄의 계정 주소 · 이름을 못 읽음'); return 1; }
    console.log(`  ${시각()} 확인 — 계정 /u/${u} ${계정} · 공간 ${job.space}`);
    const run = await 페이지돌리기(job, u, '확인', 계정);
    const 본 = String(run.출력).split(/\r?\n/).map((l) => { try { return JSON.parse(l.trim()); } catch { return null; } }).find((x) => x && x.step === 'account');
    const r = 결과가르기(run.출력, false);
    const 통과 = r.결과 === '받음';
    console.log(`${통과 ? '통과' : '안 됨'} · /u/${u} ${계정} — 화면 ${본 ? 본.who || '계정 표시 없음' : '계정 단계 전에 끝남'}${통과 ? '' : ` · ${r.까닭}`}`);
    if (r.결과 === '멈춤' && /sorry|로봇/.test(r.까닭) && !o.차례없이) { 줄끄기(`로봇 확인(sorry) · ${이름} 계정 확인`); console.log('  두 줄을 껐다(gemini-a.off · gemini-b.off) — 유호님이 ego에서 확인을 누르신 뒤 지운다'); }
    return 통과 ? 0 : 1;
  } finally {
    if (!o.차례없이) console.log(`  차례 · ${차례(['내려놓기', 이름]).out.split(/\r?\n/).pop()}`);
  }
}

function 보고(결과, 멈춤) {
  const 셈 = (k) => 결과.filter((x) => x.결과 === k).length;
  const 더셈 = [['안 보내짐', '안 보내짐'], ['헷갈림', '헷갈림'], ['올리기 시간 넘김', '올리기 시간 넘김']].filter(([k]) => 셈(k)).map(([k, 말]) => ` · ${말} ${셈(k)}`).join('');
  console.log(`\n아르곤웹 · ${결과.length}건 — 받음 ${셈('받음')} · 보냄(답 기다림) ${셈('보냄')}${더셈} · 실패 ${셈('실패') + 셈('없음') + 셈('멈춤')} · 건너뜀 ${셈('건너뜀')} · 안 함 ${셈('안 함')}`);
  for (const x of 결과) {
    const j = x.작업;
    const 나눔 = j.files && 그림셈(j.files) > 그림한도 ? ` — 그림 ${그림셈(j.files)}장, ${그림한도}장씩 나눠 보낸다(11-07 8장 묶음 실패)` : '';
    if (x.결과 === '받음') console.log(`  받음  ${j.이름} → ${j.out} (${x.글자}자${x.글자 < 200 ? ' — 짧다, 오류 문구인지 본다' : ''}) ${x.url || ''}${x.찾음 ? ` · ${x.찾음}에서 찾음` : ''}`);
    else if (x.결과 === '보냄') console.log(`  보냄  ${j.이름} — ${x.까닭}\n        다시 보내지 말고 나중에: node tools/아르곤웹.js 읽기 <작업 파일>${x.url ? ` · 대화 ${x.url}` : ''}${x.사라짐 ? ` — 보낸 지 20분 뒤 읽기가 사이드바를 보고 없으면 표시를 푼다${나눔}` : ''}`);
    else if (x.결과 === '안 보내짐') console.log(`  안 보내짐  ${j.이름} — ${x.까닭}\n        표시는 ${x.기록 || 풀린표시경로(j.out)}에 남겼다 — 다음 보내기가 다시 보낸다${나눔}`);
    else if (x.결과 === '헷갈림') console.log(`  헷갈림  ${j.이름} — ${x.까닭}\n        다시 보내지 말고 그 대화를 열어 「말씀하신 내용」 · 첨부로 이 작업 대화를 고른다(보냄 표시는 그대로)`);
    else if (x.결과 === '올리기 시간 넘김') console.log(`  올리기 시간 넘김  ${j.이름} — ${x.까닭}\n        보냄 표시가 없다 — 첨부 · 회선 · 계정 올리기(빨간 「!」)를 본 뒤 같은 명령으로 다시 부른다`);
    else console.log(`  ${x.결과}  ${j.이름} — ${x.까닭}${x.보냄 ? ' · 보냄 표시가 있다(다시 보내지 않는다)' : ''}`);
    if (x.실행기기록) console.log(`        실행기 원문 · ${x.실행기기록.폴더} (종료 ${x.종료코드})`);
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
  if (cmd === '확인') return 확인(o);
  if ((cmd === '보내기' || cmd === '읽기') && (rest.length || o.파일.length)) {
    let jobs;
    try { jobs = o.파일.length ? [깃발작업(o)] : rest.map((f) => 작업읽기(f, o)); } catch (e) { console.error(e.message); return 2; }
    return 돌리기(jobs, o, cmd);
  }
  console.error('사용: node tools/아르곤웹.js 점검 <지시문 파일…> [--json] [--없이 <항목,…>]\n'
    + '      node tools/아르곤웹.js 보내기 <작업.json…> [--이름 <줄 이름>] [--두줄] [--덮어쓰기] [--차례없이 --u <번호>]\n'
    + '      node tools/아르곤웹.js 보내기 --파일 <사진·글…> --지시문 <지시문 파일> --답 <답.md> [--머리 <답 머리 글>]\n'
    + '      node tools/아르곤웹.js 읽기 <작업.json…> [같은 선택]\n'
    + '      node tools/아르곤웹.js 확인 [--이름 <줄 이름>] [--두줄] [--차례없이 --u <번호> --계정 <이름>]');
  return 2;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(e.stack || e.message); process.exitCode = 1; });
}

module.exports = {
  parseArgs, 작업만들기, 작업읽기, 작업문제, 작업경고, 할일정하기, 줄이름, 페이지글, 판단머리, 결과가르기, 계정번호, 계정이름, 표시경로, 풀린표시경로, 종류, 칩이름, 그림셈,
  지시문읽기, 점검한편, 점검, 모호한좌우, 충돌표, 첨부한도, 지시문한도, 그림한도, 풀기기다림, 기본공간, 기본프로필, 페이지, 새답, 다시할일,
  글정규화, 대화아이디, 대화견주기, 보낸때, 표시계정, 표시풀까, 풀린기록, 올리기뒤기다림, 올리기끝상한초, 답대화, 표시읽기, 찾기정보,
  설정, 살아있나, 올리기상한, 올리기상한계산, 잠금주인읽기, 잠금풀기, 줄주인, 멈춘주인, 잠금치우기, 올리기잠금, 폴더표, 페이지돌리기, 한건, 돌리기,
};
