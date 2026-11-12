#!/usr/bin/env node
'use strict';
/**
 * 새편 — SNS 편의 Remotion 틀을 원천 한 벌(tools/편틀)에서 찍고, 부품 폴더(node_modules)를 저장소 밖 한 곳에 잇는다 (2026-11-11).
 * 설계 · 재기 · 검토: docs/_ops/qa/작업방식정리_20261110/3단계_편틀_설계.md. 예약 회차가 읽는 절차: docs/_ops/예약작업_작업자리.md 「시작」 5.
 *
 * 왜: 새 편마다 앞 편의 remotion/ 폴더를 통째로 복사해 틀이 갈라졌고(11월 35편에 fonts.ts 세 판 · tsconfig 두 판 · .gitignore 세 판),
 *   부품 폴더는 「가장 최근 같은 브랜드 편」으로 손 연결해 편에서 편으로 사슬이 됐다(78곳이 옛 편 하나의 실폴더에 매달림, synkbrief 줄은 아홉 고리 —
 *   그 실폴더는 48시간 조용하면 공간 지킴이가 지우는 자리다). 편 폴더가 놓이는 모양(<편>/remotion/이 혼자 서는 Remotion 프로젝트)은 그대로 둔다 —
 *   tools/음악층.js · 합성미리보기 · 판본잇기 · 올리기전검사가 그 모양을 읽는다.
 *
 *   node tools/새편.js <편 폴더> [--실행] [--갱신] [--json]    틀 찍기 + 부품 잇기 (기본은 미리 보기 — 아무것도 쓰지 않는다)
 *   node tools/새편.js 부품 [--실행] [--json]                   부품 자리 상태 · 없거나 속이 비었으면 깔기
 *
 * <편 폴더>/remotion/ 에 하는 일(tools/편틀/틀.json의 목록대로):
 *   새 편(remotion/package.json이 아직 없다) · 「적용」 편(틀.json 「적용」에 그 브랜드가 있고 폴더 날짜가 그 날짜부터) — 틀까지 본다:
 *     같아야 · 글꼴   없으면 찍는다. 있고 원천과 같으면 그대로. 원천이 지나온 판(원천을 고치기 전에 찍은 것 — git 이력으로 본다)이어도 그대로.
 *                    다르면 「다름」으로 알리고 종료 1 — --갱신을 줘야 원천의 지금 판으로 덮는다.
 *     처음만         (.gitignore) 없을 때만 찍는다. 브랜드(편 폴더 이름의 첫 _ 앞) 판이 있으면 그것, 없으면 기본. 편이 고쳐도 된다.
 *     있으면같아야   (package-lock.json) 찍지 않는다. 편에 있는데 다르면 「다름」.
 *   그 밖의 이미 있는 편(옛 편 · 「적용」에 없는 브랜드 · 「예외」 편) — 부품만 잇는다. 틀 파일은 보기만 하고 찍지도 덮지도 않는다(얼린 편).
 *   --갱신          어느 편이든 틀 파일을 원천 판으로 바꾼다. 덮기 전에 편에만 있던 줄을 보이고, 편이 틀 파일에 더한 이름(export)을 다른 편 파일이
 *                  쓰고 있으면 그 파일은 덮지 않는다(편 파일로 옮긴 뒤 다시). 이미 렌더 · 게시한 편에는 쓰지 않는다 — 판본 지문이 바뀐다.
 *   node_modules   없으면 부품 자리로 연결(junction). 다른 곳을 가리키는 연결이면 연결만 풀고 다시 건다(대상은 건드리지 않는다).
 *                  실폴더면 손대지 않는다. 편의 package.json이 원천과 다르면(옛 판 틀) 잇지 않는다.
 *   편 고유 파일(src/Root.tsx · 장면 · public/img · vo · sfx · scripts)은 만들지도 건드리지도 않는다.
 *
 * 부품 자리: %LOCALAPPDATA%\synk\remotion-parts\<열쇠>\node_modules (Windows 밖은 ~/.cache/synk/remotion-parts, 환경변수 SYNK_REMOTION_PARTS_DIR로 바꾼다).
 *   열쇠 = remotion-<remotion 판>-<잠금 파일 지문 12자>-<OS>-<CPU>. 잠금이 바뀌면 새 자리에 깔리고 옛 자리는 그대로 남는다(옛 편의 연결이 산다).
 *   깔기: 옆 임시 폴더(.installing-…)에 원천의 package.json · package-lock.json을 놓고 npm ci → 렌더용 브라우저 받기(remotion browser ensure)
 *     → 잠금 · 실물 대조 → 「깔림」 표시(installed.json) → 폴더 이름을 열쇠로 바꿔 끼운다. 그래서 열쇠 폴더는 다 깔린 것만 보인다.
 *     두 회차가 같이 깔면 먼저 끼운 쪽이 이기고 진 쪽은 제 임시 폴더를 지운다. 실패한 설치도 제 임시 폴더를 지우고, 죽은 설치가 남긴 임시 폴더는 다음 깔기가 치운다.
 *   깔려 있는지는 표시 + 실물(뿌리가 바로 부르는 패키지의 폴더 · remotion 실행 파일)로 본다. 속이 비었으면(사본을 통째로 지우다 연결을 따라 들어간 사고 등)
 *     그 폴더를 지우지 않고 옆으로 비켜 놓은 뒤 같은 자리에 다시 깐다 — 편의 연결은 그대로 산다.
 *   이 도구는 옛 열쇠 자리 · 살아 있는 남의 임시 폴더를 지우지 않는다.
 * 사본을 지울 때: 연결이 든 작업 사본을 통째로 지우면 연결을 따라 부품까지 지울 수 있다(현장 노트 git 「junction이 든 워크트리」).
 *   예약 회차는 지금처럼 `node tools/예약사본.js 끝 --실행`이 연결만 끊는다.
 * 시험: node --test tests/새편.test.js tests/편틀.test.js
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const 저장소 = path.resolve(__dirname, '..');
const 기본원천 = path.join(__dirname, '편틀');
// 부품 자리 안의 이름은 영문으로 둔다 — npm · 크롬이 도는 경로다
const 표시이름 = 'installed.json';
const 임시접두 = '.installing-';
const 비킴꼬리 = '.unmarked-';
const 틀꼴 = '편틀/1';
const 죽은임시쉼ms = 10 * 60 * 1000;
// 파일 머리의 BOM — 소스에 글자 그대로 두지 않는다(편집기 · 도구가 지우거나 풀어 버린다)
const BOM머리 = new RegExp(`^${String.fromCharCode(0xFEFF)}`);
const 원천생긴날 = '2026-11-10T00:00:00+09:00';

const 빗금 = (p) => p.split(path.sep).join('/');
const 가짐 = (객체, 열쇠값) => Object.prototype.hasOwnProperty.call(객체, 열쇠값);
// 절대 경로는 두 OS의 꼴을 다 본다 — Linux의 path.isAbsolute는 'C:/…'를 상대 경로로 본다
const 안전한이름 = (이름) => typeof 이름 === 'string' && 이름 !== '' && !path.win32.isAbsolute(이름) && !path.posix.isAbsolute(이름) && !이름.includes('\\') && !이름.split('/').some((칸) => 칸 === '' || 칸 === '.' || 칸 === '..');

/** 틀.json — 목록 꼴을 확인해 돌려준다(이름은 remotion/ 기준 빗금 경로, 위로 나가는 경로는 받지 않는다) */
function 틀읽기(원천 = 기본원천) {
  const 틀 = JSON.parse(fs.readFileSync(path.join(원천, '틀.json'), 'utf8').replace(BOM머리, ''));
  if (!틀 || 틀.꼴 !== 틀꼴) throw new Error(`틀.json 꼴을 모른다: ${틀 && 틀.꼴}`);
  const 객체 = (값) => (값 && typeof 값 === 'object' && !Array.isArray(값) ? 값 : {});
  const 결과 = { 같아야: Array.isArray(틀.같아야) ? 틀.같아야 : [], 글꼴: 객체(틀.글꼴), 처음만: 객체(틀.처음만), 있으면같아야: 객체(틀.있으면같아야), 적용: 객체(틀.적용), 예외: 객체(틀.예외), 더함: 객체(틀.더함), 다른틀: 객체(틀.다른틀) };
  const 이름들 = [...결과.같아야, ...Object.keys(결과.글꼴), ...Object.keys(결과.처음만), ...Object.keys(결과.있으면같아야)];
  for (const 이름 of 이름들) if (!안전한이름(이름)) throw new Error(`틀.json에 받을 수 없는 이름: ${JSON.stringify(이름)}`);
  if (new Set(이름들).size !== 이름들.length) throw new Error('틀.json에 같은 이름이 두 번 있다');
  if (이름들.some((이름) => 이름 === 'node_modules' || 이름.startsWith('node_modules/'))) throw new Error('틀.json이 node_modules를 찍으려 한다');
  if (!결과.같아야.includes('package.json')) throw new Error('틀.json 「같아야」에 package.json이 없다 — 부품이 그 편에 맞는지 볼 수 없다');
  for (const 출처 of [...Object.values(결과.글꼴), ...Object.values(결과.있으면같아야)]) if (!안전한이름(출처)) throw new Error(`틀.json에 받을 수 없는 출처: ${JSON.stringify(출처)}`);
  for (const [이름, 판] of Object.entries(결과.처음만)) {
    if (!판 || typeof 판 !== 'object' || !안전한이름(판.기본)) throw new Error(`틀.json 「처음만」 ${이름}에 기본 판이 없다`);
    for (const 값 of Object.values(판)) if (!안전한이름(값)) throw new Error(`틀.json 「처음만」 ${이름}에 받을 수 없는 판: ${JSON.stringify(값)}`);
  }
  for (const [이름, 날짜] of Object.entries(결과.더함)) {
    if (!이름들.includes(이름)) throw new Error(`틀.json 「더함」의 ${JSON.stringify(이름)}이(가) 틀 목록에 없다`);
    if (!/^20\d{6}$/.test(String(날짜))) throw new Error(`틀.json 「더함」 ${이름}의 날짜 꼴(YYYYMMDD)`);
  }
  for (const [접두, 세우는법] of Object.entries(결과.다른틀)) {
    if (!접두 || 접두.includes('/') || !안전한이름(세우는법)) throw new Error(`틀.json 「다른틀」 ${JSON.stringify(접두)}의 꼴(편 이름 접두 → 그 편을 세우는 스크립트 경로)`);
  }
  return 결과;
}

/** 편 폴더 이름 풀기 — <브랜드>_…_<YYYYMMDD>. 날짜로 안 끝나면 날짜는 null이다 */
function 편이름풀기(편폴더) {
  const 이름 = path.basename(path.resolve(편폴더));
  const m = /^([^_]+)_(?:.*_)?(\d{8})$/.exec(이름);
  return { 이름, 브랜드: m ? m[1] : 이름.split('_')[0], 날짜: m ? m[2] : null };
}
/**
 * 이 편에 그 틀 파일을 요구하나 — 원천에 나중에 더한 파일(틀.json 「더함」: 이름 → 날짜)은 그 날짜부터의 편에만 요구한다.
 * 그 전에 찍은 편에 새 파일을 찍어 넣으면 이미 렌더한 편의 판본 지문이 바뀐다. 명령과 tests/편틀.test.js가 같이 쓴다.
 */
function 요구하나(틀, 이름, 날짜) {
  const 더한날 = 가짐(틀.더함 || {}, 이름) ? String(틀.더함[이름]) : null;
  return !더한날 || Boolean(날짜 && 날짜 >= 더한날);
}
/**
 * 다른 틀이 세우는 편인가 — 틀.json 「다른틀」(편 이름 접두 → 그 편을 세우는 스크립트). 같은 브랜드 안에 제 틀을 가진 줄이 있다
 * (LAB 21:00 노래 · 퀴즈 — 제 src · tsconfig를 찍는다). 그런 편은 이 원천과 견주지도, 이 명령이 틀을 찍지도 않는다. 맞는 것이 없으면 null.
 */
function 다른틀찾기(틀, 이름) {
  for (const [접두, 세우는법] of Object.entries(틀.다른틀 || {})) if (String(이름).startsWith(접두)) return { 접두, 세우는법 };
  return null;
}
/** 틀 대조 대상인가 — 「적용」에 그 브랜드가 있고 폴더 날짜가 그 날짜부터이며 「예외」 · 「다른틀」에 없을 때. 명령과 tests/편틀.test.js가 같이 쓴다 */
function 적용편인가(틀, { 이름, 브랜드, 날짜 }) {
  const 문턱 = 가짐(틀.적용, 브랜드) ? String(틀.적용[브랜드]) : null;
  return Boolean(문턱 && /^\d{8}$/.test(문턱) && 날짜 && 날짜 >= 문턱 && !가짐(틀.예외, 이름) && !다른틀찾기(틀, 이름));
}

/** 부품 자리 — 저장소 밖, 이 PC의 사용자마다 한 곳. 경로에 한글을 넣지 않는다 */
function 부품자리(env = process.env) {
  // 환경변수 이름은 영문이다 — bash는 한글 이름의 `이름=값 명령`을 받지 않아, 한글 이름이면 자리를 못 바꾼 채 진짜 부품 자리로 돈다
  if (env.SYNK_REMOTION_PARTS_DIR) return path.resolve(env.SYNK_REMOTION_PARTS_DIR);
  if (process.platform === 'win32') return path.join(env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'synk', 'remotion-parts');
  return path.join(env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'synk', 'remotion-parts');
}

/** 잠금 파일 — 줄끝(CR)을 지운 글과 읽은 값. 작업본이 CRLF로 체크아웃해도 같은 지문이 나온다 */
function 잠금읽기(원천 = 기본원천) {
  const 글 = fs.readFileSync(path.join(원천, 'package-lock.json'), 'utf8').replace(BOM머리, '').replace(/\r/g, '');
  return { 글, 잠금: JSON.parse(글) };
}

function 열쇠짓기({ 글, 잠금 }) {
  const 판 = 잠금 && 잠금.packages && 잠금.packages['node_modules/remotion'] && 잠금.packages['node_modules/remotion'].version;
  if (!/^[0-9A-Za-z.+-]+$/.test(String(판 || ''))) throw new Error('잠금 파일에서 remotion 판을 못 읽었다');
  return `remotion-${판}-${crypto.createHash('sha256').update(글).digest('hex').slice(0, 12)}-${process.platform}-${process.arch}`;
}
function 열쇠(원천 = 기본원천) { return 열쇠짓기(잠금읽기(원천)); }

/**
 * 실물이 빠졌나 — 뿌리가 바로 부르는 패키지의 폴더와 remotion 실행 파일이 그 자리에 있는지. 빠진 이름 목록(비면 다 있다).
 * 장부(.package-lock.json)만 남고 속이 빈 폴더, 끝이 빈 폴더였던 옛 연결(현장 노트 영상 10-24)을 「깔림」으로 보지 않는다.
 */
function 실물빠짐(모듈, 잠금) {
  const 뿌리 = (잠금 && 잠금.packages && 잠금.packages['']) || {};
  const 빠짐 = [];
  if (!fs.existsSync(path.join(모듈, '.package-lock.json'))) 빠짐.push('.package-lock.json');
  for (const 이름 of Object.keys({ ...뿌리.dependencies, ...뿌리.devDependencies })) {
    if (!fs.existsSync(path.join(모듈, ...이름.split('/'), 'package.json'))) 빠짐.push(이름);
  }
  if (잠금 && 잠금.packages && 잠금.packages['node_modules/@remotion/cli']) {
    const 실행 = process.platform === 'win32' ? 'remotion.cmd' : 'remotion';
    if (!fs.existsSync(path.join(모듈, '.bin', 실행))) 빠짐.push(`.bin/${실행}`);
  }
  return 빠짐;
}

/** 깔린 것이 잠금과 같은가 — 어긋난 줄 목록(비면 같다). 잠금에만 있는 것은 선택 패키지(다른 OS용)만 넘긴다 */
function 깔린것대조(모듈, 잠금) {
  let 깔린;
  try { 깔린 = JSON.parse(fs.readFileSync(path.join(모듈, '.package-lock.json'), 'utf8')).packages || {}; } catch (e) { return [`node_modules/.package-lock.json을 못 읽었다 — ${e.message}`]; }
  const 원 = (잠금 && 잠금.packages) || {};
  const 어긋남 = [];
  for (const [이름, 값] of Object.entries(원)) {
    if (!이름) continue;
    const 깔 = 깔린[이름];
    if (!깔) { if (!값.optional) 어긋남.push(`안 깔림 ${이름}@${값.version}`); continue; }
    if (깔.version !== 값.version || (깔.integrity || '') !== (값.integrity || '')) 어긋남.push(`다른 판 ${이름} — 깔림 ${깔.version} · 잠금 ${값.version}`);
  }
  for (const 이름 of Object.keys(깔린)) if (이름 && !원[이름]) 어긋남.push(`잠금에 없는 것 ${이름}`);
  if (Object.keys(깔린).filter(Boolean).length === 0) 어긋남.push('깔린 패키지가 하나도 없다');
  for (const 이름 of 실물빠짐(모듈, 잠금)) 어긋남.push(`실물이 없다 ${이름}`);
  return 어긋남;
}

function 부품상태({ 원천 = 기본원천, 자리 = 부품자리() } = {}) {
  const 읽음 = 잠금읽기(원천);
  const 이름 = 열쇠짓기(읽음);
  const 폴더 = path.join(자리, 이름), 모듈 = path.join(폴더, 'node_modules');
  let 표시 = null;
  try { 표시 = JSON.parse(fs.readFileSync(path.join(폴더, 표시이름), 'utf8')); } catch {}
  const 표시맞음 = Boolean(표시 && 표시.열쇠 === 이름);
  const 있음 = fs.existsSync(폴더);
  const 빠진것 = 있음 ? 실물빠짐(모듈, 읽음.잠금) : [];
  const 깔림 = 표시맞음 && 빠진것.length === 0;
  let 남은임시 = [], 그밖 = [];
  try {
    const 이름들 = fs.readdirSync(자리).sort();
    남은임시 = 이름들.filter((n) => n.startsWith(임시접두));
    // 옛 열쇠 자리 · 비켜 놓은 폴더 — 이 도구는 지우지 않으니 보이기라도 한다(한 벌 0.6GB)
    그밖 = 이름들.filter((n) => n !== 이름 && !n.startsWith(임시접두));
  } catch {}
  return { 자리, 열쇠: 이름, 폴더, 모듈, 깔림, 표시: 깔림 ? 표시 : null, 반쪽: 있음 && !깔림, 빠진것: 있음 && !깔림 ? (표시맞음 ? 빠진것 : ['깔림 표시', ...빠진것]) : [], 남은임시, 그밖 };
}

function 돌리기(명령, 인자, 옵션, 무엇) {
  const r = spawnSync(명령, 인자, { stdio: ['ignore', 2, 2], windowsHide: true, ...옵션 });
  if (r.error) throw new Error(`${무엇}을(를) 못 불렀다: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${무엇} 실패(종료 ${r.status})`);
}

/**
 * 기본 설치기 — npm ci(Node 옆의 npm-cli.js를 node로 바로, 셸 없이) 뒤에 렌더용 브라우저까지 받는다(remotion browser ensure — node_modules/.remotion).
 * 브라우저를 여기서 받아 두지 않으면 새 자리의 첫 렌더들이 같은 폴더에 같이 받는다. 출력은 stderr로 보낸다(--json 출력을 흐리지 않게).
 */
function 기본설치(폴더) {
  const 곁 = path.dirname(process.execPath);
  const npmcli = [path.join(곁, 'node_modules', 'npm', 'bin', 'npm-cli.js'), path.join(곁, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')].find((p) => fs.existsSync(p));
  const 인자 = ['ci', '--no-audit', '--no-fund', '--prefer-offline'];
  if (npmcli) 돌리기(process.execPath, [npmcli, ...인자], { cwd: 폴더, timeout: 30 * 60 * 1000 }, 'npm ci');
  else 돌리기('npm', 인자, { cwd: 폴더, timeout: 30 * 60 * 1000, shell: process.platform === 'win32' }, 'npm ci');
  const cli폴더 = path.join(폴더, 'node_modules', '@remotion', 'cli');
  let 실행 = 'remotion-cli.js';
  try { const bin = JSON.parse(fs.readFileSync(path.join(cli폴더, 'package.json'), 'utf8')).bin; 실행 = (bin && bin.remotion) || 실행; } catch {}
  돌리기(process.execPath, [path.join(cli폴더, 실행), 'browser', 'ensure'], { cwd: 폴더, timeout: 20 * 60 * 1000 }, '렌더용 브라우저 받기(remotion browser ensure)');
}

function 잠깐(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function pid살아있나(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }

/** 이 도구의 임시 폴더만 지운다 — 부품 자리 바로 아래 · 임시 접두일 때만. 설치 폴더에는 연결이 없다(npm ci는 연결을 만들지 않는다) */
function 임시지우기(자리, 임시) {
  if (path.resolve(path.dirname(임시)) !== path.resolve(자리) || !path.basename(임시).startsWith(임시접두)) throw new Error(`설치 임시 폴더가 아니다: ${임시}`);
  fs.rmSync(임시, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}

/** 죽은 설치가 남긴 임시 폴더 치우기 — 이름의 pid가 죽었고 10분 넘게 그대로인 것만. 치운 이름 목록 */
function 죽은임시치우기(자리) {
  const 치움 = [];
  let 이름들 = [];
  try { 이름들 = fs.readdirSync(자리); } catch { return 치움; }
  for (const 이름 of 이름들) {
    const m = new RegExp(`^${임시접두.replace(/\./g, '\\.')}.+-(\\d+)-[0-9a-f]{8}$`).exec(이름);
    if (!m || pid살아있나(Number(m[1]))) continue;
    const 임시 = path.join(자리, 이름);
    try {
      const st = fs.lstatSync(임시);
      if (!st.isDirectory() || st.isSymbolicLink() || Date.now() - st.mtimeMs < 죽은임시쉼ms) continue;
      임시지우기(자리, 임시);
      치움.push(이름);
    } catch {}
  }
  return 치움;
}

/**
 * 부품 깔기 — 열쇠 자리가 깔려 있으면(표시 + 실물) 그대로, 아니면(실행일 때) 옆 임시 폴더에 깔아 이름을 바꿔 끼운다.
 * 설치기는 시험용(폴더를 받아 그 안에 node_modules를 만든다) — 바꿔 넣을 때는 자리도 꼭 준다(실제 자리에 가짜 부품을 깔지 않게).
 * 돌려주는 값은 부품상태 + 결과(있음 · 깔 것 · 깖 · 다른 회차가 먼저 깖).
 */
function 부품깔기(옵션 = {}) {
  if (옵션.설치기 && !가짐(옵션, '자리')) throw new Error('설치기를 바꿔 넣을 때는 부품 자리도 준다 — 실제 부품 자리에 가짜 부품을 깔지 않는다');
  const { 원천 = 기본원천, 자리 = 부품자리(), 실행 = false, 설치기 = 기본설치, 알림 = () => {} } = 옵션;
  const 앞 = 부품상태({ 원천, 자리 });
  if (앞.깔림) return { ...앞, 결과: '있음' };
  if (!실행) return { ...앞, 결과: '깔 것' };
  fs.mkdirSync(자리, { recursive: true });
  const 치움 = 죽은임시치우기(자리);
  if (치움.length) 알림(`죽은 설치가 남긴 임시 폴더 ${치움.length}개를 치웠다`);
  const 임시 = path.join(자리, `${임시접두}${앞.열쇠}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(임시);
  let 끼움 = false;
  try {
    for (const f of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(원천, f), path.join(임시, f));
    알림(`부품을 깐다(npm ci + 렌더용 브라우저, 몇 분) — ${임시}`);
    설치기(임시);
    const { 글, 잠금 } = 잠금읽기(원천);
    const 어긋남 = 깔린것대조(path.join(임시, 'node_modules'), 잠금);
    if (어긋남.length) throw new Error(`깐 부품이 잠금 파일과 다르다:\n  ${어긋남.slice(0, 10).join('\n  ')}`);
    const 표시 = { 꼴: '편틀부품/1', 열쇠: 앞.열쇠, 잠금지문: crypto.createHash('sha256').update(글).digest('hex'), 때: new Date().toISOString(), node: process.version };
    fs.writeFileSync(path.join(임시, 표시이름), `${JSON.stringify(표시, null, 1)}\n`);
    // 열쇠 자리를 깔리지 않은 폴더(표시가 없거나 속이 빈 것)가 막고 있으면 지우지 않고 옆으로 비켜 놓는다 — 쓰는 중이면 이름을 못 바꿔 여기서 멈춘다
    if (fs.existsSync(앞.폴더) && !부품상태({ 원천, 자리 }).깔림) {
      const 비킴 = `${앞.폴더}${비킴꼬리}${Date.now()}`;
      try { fs.renameSync(앞.폴더, 비킴); } catch (e) { throw new Error(`부품 자리에 깔리지 않은 폴더가 있고 비켜 놓지 못했다(쓰는 중일 수 있다): ${앞.폴더} — ${e.message}`); }
      알림(`깔리지 않은 폴더를 비켜 놓았다(지우지 않는다): ${비킴}`);
    }
    let 마지막 = null;
    // 방금 깐 파일을 백신 · 색인기가 잠깐 쥐면 Windows에서 폴더 이름을 못 바꾼다 — 자리가 비어 있는 동안만 다시 해 본다
    for (let 번 = 0; 번 < 20 && !끼움; 번 += 1) {
      try { fs.renameSync(임시, 앞.폴더); 끼움 = true; } catch (e) { 마지막 = e; if (fs.existsSync(앞.폴더)) break; 잠깐(500); }
    }
    if (!끼움) {
      const 뒤 = 부품상태({ 원천, 자리 });
      if (!뒤.깔림) throw new Error(`깐 부품을 제자리에 못 놓았다: ${마지막 && 마지막.message}`);
      return { ...뒤, 결과: '다른 회차가 먼저 깖' };
    }
    return { ...부품상태({ 원천, 자리 }), 결과: '깖' };
  } finally {
    // 끼우지 못한 제 임시 폴더는 남기지 않는다(한 벌 0.6GB) — 지우다 실패해도 원래 오류를 가리지 않는다
    if (!끼움) { try { 임시지우기(자리, 임시); } catch {} }
  }
}

/** 같은 내용인가 — 바이트가 같거나, 글 파일이면 줄끝(CRLF · LF)만 다를 때(git이 같은 blob으로 넣는다) */
function 같은내용(가, 나) {
  if (가.equals(나)) return true;
  if (가.includes(0) || 나.includes(0)) return false;
  const 정리 = (b) => b.toString('latin1').replace(/\r\n/g, '\n');
  return 정리(가) === 정리(나);
}

/** git이 넣을 blob 값 — 글 파일은 줄끝(CRLF → LF)을 정리한 바이트로 잰다(작업본이 CRLF로 체크아웃해도 색인과 같은 값) */
function blob값(바이트) {
  const b = 바이트.includes(0) ? 바이트 : Buffer.from(바이트.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
  return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
}
/** `git log --raw --no-abbrev` 글에서 경로마다 지나온 blob을 모은다 — Map(경로 → Set(blob)). 새로 생김 · 지움의 0000…은 뺀다 */
function raw줄읽기(글, 경로들) {
  const 지도 = new Map(경로들.map((p) => [p, new Set()]));
  for (const 줄 of String(글).split('\n')) {
    const m = /^:\d+ \d+ ([0-9a-f]+) ([0-9a-f]+) \S+\t(.+)$/.exec(줄.replace(/\r$/, ''));
    if (!m || !지도.has(m[3])) continue;
    for (const blob of [m[1], m[2]]) if (!/^0+$/.test(blob)) 지도.get(m[3]).add(blob);
  }
  return 지도;
}
/**
 * 원천 파일이 지나온 판 — Map(저장소 기준 경로 → Set(blob)). 원천이 생긴 날부터의 이력만 걷는다(그 전의 판은 어느 편에도 찍힌 적이 없다).
 * 이력에 그 경로가 아직 없으면 빈 집합이고, git이 없거나 저장소가 아니면 null이다. 명령과 tests/편틀.test.js가 같이 쓴다.
 */
function 지난blob(뿌리, 경로들) {
  if (!경로들.length) return new Map();
  const r = spawnSync('git', ['-c', 'core.quotepath=false', 'log', '--raw', '--no-abbrev', '--no-renames', '--format=', `--since=${원천생긴날}`, '--', ...경로들], { cwd: 뿌리, encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20 });
  return r.status === 0 ? raw줄읽기(r.stdout, 경로들) : null;
}

function 같은길(가, 나) {
  const 풀기 = (p) => path.resolve(String(p).replace(/^\\\\\?\\/, '')).replace(/[\\/]+$/, '');
  const [a, b] = [풀기(가), 풀기(나)];
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}
function 안에있나(아래, 위) {
  const 상대 = path.relative(path.resolve(위), path.resolve(아래));
  return 상대 === '' || (!상대.startsWith('..') && !path.isAbsolute(상대));
}
function 링크대상(링크) {
  const 읽음 = fs.readlinkSync(링크).replace(/^\\\\\?\\/, '');
  return path.resolve(path.dirname(링크), 읽음);
}

/** 틀 목록을 그 편의 줄로 편다 — [{ 이름, 종류, 원본 }] */
function 틀항목(틀, { 원천 = 기본원천, 뿌리 = 저장소, 브랜드 = '' } = {}) {
  return [
    ...틀.같아야.map((이름) => ({ 이름, 종류: '같아야', 원본: path.join(원천, 이름) })),
    ...Object.entries(틀.글꼴).map(([이름, 출처]) => ({ 이름, 종류: '글꼴', 원본: path.join(뿌리, 출처) })),
    ...Object.entries(틀.처음만).map(([이름, 판]) => ({ 이름, 종류: '처음만', 원본: path.join(원천, 가짐(판, 브랜드) ? 판[브랜드] : 판.기본) })),
    ...Object.entries(틀.있으면같아야).map(([이름, 출처]) => ({ 이름, 종류: '있으면같아야', 원본: path.join(원천, 출처) })),
  ];
}

/**
 * 편의 지금 모습 — 틀 파일마다 없음 · 같음 · 지난 판 · 다름 · 있음(처음만) · 파일 아님, 부품 연결은 없음 · 이어짐 · 다른 곳 · 실폴더 · 파일. 읽기만 한다.
 * 「지난 판」은 원천의 지금 판과는 다르지만 원천이 지나온 판과 같은 것이다(원천을 고치기 전에 찍은 편) — 다름으로 치지 않는다(tests/편틀.test.js와 같은 기준).
 */
function 편보기(편폴더, 옵션 = {}) {
  const { 원천 = 기본원천, 뿌리 = 저장소, 자리 = 부품자리() } = 옵션;
  const 편 = path.resolve(편폴더);
  if (path.basename(편).toLowerCase() === 'remotion') throw new Error(`remotion 폴더가 아니라 그 위의 편 폴더를 준다: ${편}`);
  const 프로젝트 = path.join(편, 'remotion');
  if (안에있나(프로젝트, 원천) || 안에있나(원천, 프로젝트)) throw new Error(`편 폴더가 틀 원천과 겹친다: ${편}`);
  if (같은길(편, 뿌리)) throw new Error('편 폴더가 저장소 뿌리다 — 편 폴더를 준다(docs/마케팅/<브랜드>_<이름>_<날짜>)');
  if (fs.existsSync(편) && !fs.statSync(편).isDirectory()) throw new Error(`편 폴더 자리에 파일이 있다: ${편}`);
  const 이름풀이 = 편이름풀기(편);
  const 틀 = 틀읽기(원천);
  const 파일 = 틀항목(틀, { 원천, 뿌리, 브랜드: 이름풀이.브랜드 }).map((항) => {
    if (!fs.existsSync(항.원본)) throw new Error(`틀 원본이 없다: ${항.원본}`);
    const 대상 = path.join(프로젝트, 항.이름);
    let st = null;
    try { st = fs.lstatSync(대상); } catch {}
    const 상태 = !st ? '없음' : !st.isFile() ? '파일 아님' : 항.종류 === '처음만' ? '있음' : 같은내용(fs.readFileSync(대상), fs.readFileSync(항.원본)) ? '같음' : '다름';
    return { ...항, 대상, 상태, 요구: 요구하나(틀, 항.이름, 이름풀이.날짜) };
  });
  // 다른 파일이 있을 때만 이력을 본다(git 한 번) — 원천이 저장소 안에 있고 git이 될 때만
  const 다른 = 파일.filter((f) => f.상태 === '다름');
  if (다른.length) {
    const 상대 = (p) => { const r = 빗금(path.relative(뿌리, p)); return r && !r.startsWith('..') && !path.isAbsolute(r) ? r : null; };
    const 볼 = 다른.map((f) => [f, 상대(f.원본)]).filter(([, r]) => r);
    const 지난 = 볼.length ? 지난blob(뿌리, 볼.map(([, r]) => r)) : null;
    if (지난) for (const [f, r] of 볼) if (지난.get(r).has(blob값(fs.readFileSync(f.대상)))) f.상태 = '지난 판';
  }
  const 부품 = 부품상태({ 원천, 자리 });
  const 링크 = path.join(프로젝트, 'node_modules');
  let 연결 = { 상태: '없음' };
  let st = null;
  try { st = fs.lstatSync(링크); } catch {}
  if (st && st.isSymbolicLink()) { const 대상 = 링크대상(링크); 연결 = { 상태: 같은길(대상, 부품.모듈) ? '이어짐' : '다른 곳', 대상 }; }
  else if (st && st.isDirectory()) 연결 = { 상태: '실폴더' };
  else if (st) 연결 = { 상태: '파일' };
  const 있는편 = 파일.find((f) => f.이름 === 'package.json').상태 !== '없음';
  return { 편, 프로젝트, 브랜드: 이름풀이.브랜드, 날짜: 이름풀이.날짜, 있는편, 적용편: 적용편인가(틀, 이름풀이), 다른틀: 다른틀찾기(틀, 이름풀이.이름), 파일, 연결, 링크, 부품 };
}

const 글파일인가 = (b) => !b.includes(0);
/** 덮으면 사라지는 줄 — 편 쪽에만 있는 줄(앞뒤 빈칸을 떼고 견준다), 많으면 앞 20줄 */
function 사라지는줄(옛, 새) {
  if (!글파일인가(옛) || !글파일인가(새)) return [];
  const 새줄 = new Set(새.toString('utf8').split(/\r?\n/).map((l) => l.trim()));
  return 옛.toString('utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !새줄.has(l)).slice(0, 20);
}
/** 편이 틀 파일에 더한 이름 — 옛 글에서 내보내는데 새 글에는 없는 이름 */
function 빠지는이름(옛글, 새글) {
  const 이름들 = (글) => new Set([...글.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  const 새 = 이름들(새글);
  return [...이름들(옛글)].filter((n) => !새.has(n));
}
/**
 * 그 틀 파일에서 그 이름을 가져다 쓰는 편 파일 — remotion/src 아래 코드 파일의 import · export … from 가운데 그 틀 파일을 가리키는 것만 본다.
 * 이름을 골라 가져오면({ PEN }) 그 이름, 통째로 가져오면(* as F) F.PEN을 쓰는지, 통째로 다시 내보내면(export * from) 모든 이름. [{ 파일, 이름 }]
 */
function 이름쓰는곳(프로젝트, 이름들, 틀파일) {
  const 찾음 = [];
  if (!이름들.length) return 찾음;
  const 확장자뗌 = (p) => p.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '');
  const 낱말 = (이름) => new RegExp(`(^|[^\\w$.])${이름.replace(/\$/g, '\\$')}([^\\w$]|$)`);
  const 걷기 = (d) => {
    let 항목 = [];
    try { 항목 = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of 항목) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink() || e.name === 'node_modules') continue;
      if (e.isDirectory()) { 걷기(p); continue; }
      if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(e.name) || 같은길(p, 틀파일)) continue;
      const 글 = fs.readFileSync(p, 'utf8');
      for (const m of 글.matchAll(/(?:import|export)\s+(?:type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
        if (!m[2].startsWith('.') || !같은길(확장자뗌(path.resolve(path.dirname(p), m[2])), 확장자뗌(틀파일))) continue;
        const 절 = m[1];
        const 통째 = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(절);
        for (const 이름 of 이름들) {
          const 쓴다 = 통째 ? new RegExp(`(^|[^\\w$])${통째[1].replace(/\$/g, '\\$')}\\s*\\.\\s*${이름.replace(/\$/g, '\\$')}([^\\w$]|$)`).test(글) : /^\s*\*\s*$/.test(절) || 낱말(이름).test(절.replace(/\bas\s+[A-Za-z_$][\w$]*/g, ''));
          if (쓴다) 찾음.push({ 파일: 빗금(path.relative(프로젝트, p)), 이름 });
        }
      }
    }
  };
  걷기(path.join(프로젝트, 'src'));
  return 찾음;
}
/** 이미 렌더 · 게시한 편인가 — remotion/out에 파일이 있거나 게시 묶음이 있다 */
function 렌더흔적(편, 프로젝트) {
  try { if (fs.readdirSync(path.join(프로젝트, 'out')).length) return true; } catch {}
  return fs.existsSync(path.join(편, '게시'));
}

/**
 * 틀 찍기 + 부품 잇기. 실행이 아니면 할 일만 돌려준다.
 * 돌려주는 값: { 결과, 편, 프로젝트, 브랜드, 갈래(틀까지 · 부품만), 찍음 · 덮음(이름 목록 — 미리 보기에서는 할 것), 그대로(수), 다름(이름 목록 — --갱신 없이 남은 것),
 *   보기만({ 다름, 없음 } — 부품만 갈래에서 틀 파일의 모습), 사라진줄({ 이름: [줄] } — 덮으면 · 덮어서 사라지는 편 쪽 줄), 알림(글 목록), 막힘(글 목록), 연결, 부품 }
 */
function 편찍기(편폴더, 옵션 = {}) {
  if (옵션.설치기 && !가짐(옵션, '자리')) throw new Error('설치기를 바꿔 넣을 때는 부품 자리도 준다 — 실제 부품 자리에 가짜 부품을 깔지 않는다');
  const { 실행 = false, 갱신 = false, 원천 = 기본원천, 자리 = 부품자리(), 설치기, 알림 = () => {} } = 옵션;
  const 앞 = 편보기(편폴더, 옵션);
  // 이미 있는 편 가운데 「적용」 밖(옛 편 · 다른 브랜드 · 예외)은 얼린 편이다 — --갱신이 아니면 틀을 건드리지 않고 부품만 잇는다
  if (앞.다른틀 && !앞.있는편) throw new Error(`이 이름(${앞.다른틀.접두}…)의 편은 다른 틀이 세운다 — ${앞.다른틀.세우는법} 로 세운 뒤, 부품 연결이 끊겼을 때만 이 명령으로 잇는다`);
  if (앞.다른틀 && 갱신) throw new Error(`이 편의 틀은 이 원천이 아니라 ${앞.다른틀.세우는법} 가 찍은 것이다 — --갱신으로 덮지 않는다(그 틀의 갱신 길로 고친다)`);
  const 갈래 = !앞.다른틀 && (!앞.있는편 || 앞.적용편 || 갱신) ? '틀까지' : '부품만';
  const 찍을 = [], 덮을 = [], 다름 = [], 지난판 = [], 막힘 = [], 알림글 = [];
  const 보기만 = { 다름: [], 지난판: [], 없음: [] }, 사라진줄 = {};
  let 그대로 = 0;
  for (const f of 앞.파일) {
    if (f.상태 === '파일 아님') { 막힘.push(`${f.이름} — 그 자리에 파일이 아닌 것이 있다`); continue; }
    if (갈래 === '부품만') {
      if (앞.다른틀) continue; // 다른 틀이 찍은 편 — 이 원천과 견주는 것이 뜻이 없다
      if (f.상태 === '다름') 보기만.다름.push(f.이름);
      else if (f.상태 === '지난 판') 보기만.지난판.push(f.이름);
      else if (f.상태 === '없음' && f.종류 !== '있으면같아야' && f.요구) 보기만.없음.push(f.이름);
      continue;
    }
    if (f.상태 === '없음' && 앞.있는편 && !f.요구) continue; // 이 편을 찍은 뒤에 원천에 더한 파일 — 넣지 않는다
    if (f.종류 === '처음만') { if (f.상태 === '없음') 찍을.push(f); else 그대로 += 1; continue; }
    if (f.상태 === '없음') { if (f.종류 !== '있으면같아야') 찍을.push(f); continue; }
    if (f.상태 === '같음') { 그대로 += 1; continue; }
    // 원천을 고치기 전에 찍은 판은 다름이 아니다 — 그대로 둔다(--갱신을 줬을 때만 지금 판으로 바꾼다)
    if (f.상태 === '지난 판' && !갱신) { 지난판.push(f.이름); continue; }
    const [옛, 새] = [fs.readFileSync(f.대상), fs.readFileSync(f.원본)];
    const 줄 = 사라지는줄(옛, 새);
    if (줄.length) 사라진줄[f.이름] = 줄;
    if (!갱신) { 다름.push(f.이름); continue; }
    // 편이 틀 파일에 더한 이름을 다른 편 파일이 쓰고 있으면 덮지 않는다 — 덮으면 그 이름이 사라져 렌더가 달라진다
    const 쓰임 = /\.(tsx?|jsx?|mjs|cjs)$/.test(f.이름) && 글파일인가(옛) ? 이름쓰는곳(앞.프로젝트, 빠지는이름(옛.toString('utf8'), 새.toString('utf8')), f.대상) : [];
    if (쓰임.length) {
      다름.push(f.이름);
      막힘.push(`${f.이름} — 편이 더한 ${[...new Set(쓰임.map((x) => x.이름))].join(' · ')}을(를) ${[...new Set(쓰임.map((x) => x.파일))].join(' · ')}이(가) 쓴다. 그 이름을 편 파일(src/lib/편서체.ts 등)로 옮긴 뒤 다시 --갱신`);
      continue;
    }
    덮을.push(f);
  }
  if (덮을.length && 렌더흔적(앞.편, 앞.프로젝트)) 알림글.push('이 편에는 렌더 · 게시 흔적이 있다 — 틀 파일을 바꾸면 판본 지문(tools/lib/판본잇기.js)이 달라져 판본을 다시 렌더해야 한다');
  const pkg = 앞.파일.find((f) => f.이름 === 'package.json');
  const pkg맞음 = pkg.상태 === '같음' || (갈래 === '틀까지' && (pkg.상태 === '없음' || 덮을.includes(pkg)));
  let 연결일 = null;
  if (앞.연결.상태 === '파일') 막힘.push('remotion/node_modules 자리에 파일이 있다');
  else if (앞.연결.상태 !== '실폴더' && 앞.연결.상태 !== '이어짐') {
    // 지금 부품 자리는 원천의 지금 package.json에 맞춘 것이다 — 다른 판의 편을 거기에 이으면 다른 Remotion으로 렌더된다
    // 다른 판의 편이 이미 제 부품 폴더(살아 있는 다른 곳)에 이어져 있으면 멀쩡한 것이다 — 그대로 둔다
    if (!pkg맞음 && 앞.연결.상태 === '다른 곳' && fs.existsSync(path.join(앞.연결.대상, 'remotion', 'package.json'))) {
      알림글.push(`package.json이 원천의 지금 판과 다른 편이다 — 지금 이어진 부품 폴더(${앞.연결.대상})를 그대로 둔다`);
    } else if (!pkg맞음) {
      막힘.push(갈래 === '틀까지' && pkg.상태 === '다름'
        ? 'package.json이 원천과 달라 부품을 잇지 않았다 — 아직 렌더하지 않은 새 편이면 --갱신으로 원천 판으로 바꾸면 잇는다'
        : 'package.json이 원천의 지금 판과 달라(다른 Remotion 판의 편) 부품을 잇지 않았다 — 이 편이 쓰던 부품 폴더에 그대로 잇는다(그 판의 부품 자리로 잇는 길은 이 명령에 아직 없다). --갱신은 이 편을 지금 판으로 다시 렌더하기로 했을 때만 쓴다');
    } else 연결일 = 앞.연결.상태 === '없음' ? '잇기' : '다시 잇기';
  }
  // 이어져 있어도 부품이 비었으면 다시 깐다(같은 자리 — 연결은 그대로 산다)
  const 부품일 = !앞.부품.깔림 && (연결일 || 앞.연결.상태 === '이어짐');
  const 이름들 = (목록) => 목록.map((f) => f.이름);
  const 바탕 = { 편: 앞.편, 프로젝트: 앞.프로젝트, 브랜드: 앞.브랜드, 갈래, 다른틀: 앞.다른틀, 그대로, 다름, 지난판, 보기만, 사라진줄, 알림: 알림글, 막힘 };
  if (!실행) {
    return { 결과: '미리 보기', ...바탕, 찍음: 이름들(찍을), 덮음: 이름들(덮을), 연결: { ...앞.연결, 할일: 연결일 }, 부품: { ...앞.부품, 결과: 앞.부품.깔림 ? '있음' : 부품일 ? '깔 것' : '안 깔림' } };
  }
  for (const f of [...찍을, ...덮을]) {
    fs.mkdirSync(path.dirname(f.대상), { recursive: true });
    fs.copyFileSync(f.원본, f.대상);
  }
  let 부품 = { ...앞.부품, 결과: 앞.부품.깔림 ? '있음' : '안 깔림' };
  let 연결 = { ...앞.연결, 할일: null };
  if (부품일) 부품 = 부품깔기({ 원천, 자리, 실행: true, 알림, ...(설치기 ? { 설치기 } : {}) });
  if (연결일) {
    fs.mkdirSync(앞.프로젝트, { recursive: true });
    if (연결일 === '다시 잇기') {
      // 연결만 푼다 — 대상 폴더는 건드리지 않는다. 그새 실폴더로 바뀌었으면 손대지 않는다(unlink는 폴더를 지우지 못한다)
      if (!fs.lstatSync(앞.링크).isSymbolicLink()) throw new Error(`연결이 아니다 — 손대지 않는다: ${앞.링크}`);
      fs.unlinkSync(앞.링크);
    }
    try { fs.symlinkSync(부품.모듈, 앞.링크, 'junction'); }
    catch (e) {
      // 다른 손이 그새 같은 연결을 만들었으면 그대로 둔다
      let 이어짐 = false;
      try { 이어짐 = fs.lstatSync(앞.링크).isSymbolicLink() && 같은길(링크대상(앞.링크), 부품.모듈); } catch {}
      if (!이어짐) throw e;
    }
    연결 = { 상태: '이어짐', 대상: 부품.모듈, 한일: 연결일, ...(앞.연결.대상 ? { 옛대상: 앞.연결.대상 } : {}) };
  }
  return { 결과: 막힘.length || 다름.length ? '남은 것 있음' : '됨', ...바탕, 찍음: 이름들(찍을), 덮음: 이름들(덮을), 연결, 부품 };
}

function 보이는길(p) {
  const 상대 = path.relative(process.cwd(), p);
  return 상대 && !상대.startsWith('..') && !path.isAbsolute(상대) ? 빗금(상대) : p;
}

function 편글(r) {
  const 미리 = r.결과 === '미리 보기';
  const 줄 = [`[${r.결과}] ${보이는길(r.프로젝트)} · 브랜드 ${r.브랜드} · ${r.다른틀 ? `부품만(다른 틀 ${r.다른틀.세우는법} 가 세운 편 — 틀은 견주지도 건드리지도 않는다)` : r.갈래 === '부품만' ? '부품만(이미 있는 편이고 틀 대조 대상이 아니다 — 틀은 건드리지 않는다)' : '틀까지'}`];
  if (r.찍음.length) 줄.push(`  ${미리 ? '찍을 것' : '찍음'} ${r.찍음.length}: ${r.찍음.join(' · ')}`);
  if (r.덮음.length) 줄.push(`  ${미리 ? '원천 판으로 덮을 것' : '원천 판으로 덮음'} ${r.덮음.length}: ${r.덮음.join(' · ')}`);
  if (r.그대로) 줄.push(`  그대로 ${r.그대로}`);
  if (r.지난판.length) 줄.push(`  원천의 지난 판 ${r.지난판.length}: ${r.지난판.join(' · ')} — 원천을 고치기 전에 찍은 것이라 그대로 둔다`);
  if (r.다름.length) 줄.push(`  원천과 다름 ${r.다름.length}: ${r.다름.join(' · ')}`, '    → 원천 판으로 바꾸려면 --갱신(편만의 서체 · 설정은 틀 파일이 아니라 편 파일에 둔다 — src/lib/편서체.ts 등). 이미 렌더 · 게시한 편에는 쓰지 않는다');
  for (const [이름, 사라짐] of Object.entries(r.사라진줄)) {
    줄.push(`  ${r.덮음.includes(이름) ? (미리 ? '덮으면 사라지는' : '덮어서 사라진') : '원천에 없는'} 편 쪽 줄 — ${이름}:`, ...사라짐.map((l) => `      ${l.length > 160 ? `${l.slice(0, 160)}…` : l}`));
  }
  if (r.갈래 === '부품만' && (r.보기만.다름.length || r.보기만.지난판.length || r.보기만.없음.length)) 줄.push(`  틀(보기만): 원천과 다름 ${r.보기만.다름.length}${r.보기만.다름.length ? `(${r.보기만.다름.join(' · ')})` : ''} · 원천의 지난 판 ${r.보기만.지난판.length} · 없음 ${r.보기만.없음.length}`);
  for (const m of r.알림) 줄.push(`  알림: ${m}`);
  const c = r.연결, 부 = r.부품;
  const 자리글 = 부.깔림 ? 부.모듈 : `${부.모듈} (${부.반쪽 ? `속이 비었다 — 빠진 것 ${부.빠진것.slice(0, 4).join(' · ')}` : '아직 안 깔림'}${미리 && 부.결과 === '깔 것' ? ' — 실행하면 깐다' : ''})`;
  if (c.상태 === '실폴더') 줄.push('  부품: remotion/node_modules가 실폴더다 — 손대지 않는다');
  else if (c.할일) 줄.push(`  부품: ${c.할일 === '잇기' ? '이을 것' : `다시 이을 것(지금 ${c.대상})`} → ${자리글}`);
  else if (c.한일) 줄.push(`  부품: ${c.한일 === '잇기' ? '이음' : `다시 이음(옛 대상 ${c.옛대상} — 그대로 둠)`} → ${c.대상}${부.결과 === '깖' ? ' (부품을 새로 깔았다)' : ''}`);
  else if (c.상태 === '이어짐') 줄.push(`  부품: 이어져 있음 → ${미리 ? 자리글 : `${c.대상}${부.결과 === '깖' ? ' (속이 비어 다시 깔았다)' : ''}`}`);
  else if (c.상태 === '다른 곳') 줄.push(`  부품: 다른 곳을 가리킨다(${c.대상}) — 바꾸지 않았다`);
  else if (c.상태 === '없음') 줄.push('  부품: 연결 없음 — 잇지 않았다');
  for (const m of r.막힘) 줄.push(`  막힘: ${m}`);
  const 할일있음 = r.찍음.length || r.덮음.length || c.할일 || (미리 && 부.결과 === '깔 것');
  if (미리) 줄.push(할일있음 ? '→ --실행으로 한다' : r.다름.length || r.막힘.length ? '→ 위 남은 것을 본다' : '→ 할 일 없다(부품이 이어져 있다)');
  else if (!r.막힘.length && !r.다름.length && r.갈래 === '틀까지') 줄.push('→ 다음: src/Root.tsx(구성 등록)와 장면 · public의 그림 · 소리는 편에서 쓴다. 렌더는 remotion 폴더에서 npx remotion render');
  return 줄.join('\n');
}

function 부품글(r) {
  const 줄 = [`[부품 ${r.결과}] ${r.모듈}`, `  열쇠 ${r.열쇠}${r.표시 ? ` · 깐 때 ${r.표시.때}` : ''}`];
  if (r.결과 === '깔 것') 줄.push('→ --실행으로 깐다(npm ci + 렌더용 브라우저, 몇 분 · 캐시에 없으면 내려받는다)');
  if (r.반쪽) 줄.push(`  열쇠 자리에 깔리지 않은 폴더가 있다(빠진 것: ${r.빠진것.slice(0, 6).join(' · ')}): ${r.폴더} — 깔 때 옆으로 비켜 놓는다(지우지 않는다)`);
  if (r.남은임시.length) 줄.push(`  설치 임시 폴더 ${r.남은임시.length}: ${r.남은임시.join(' · ')} — 도는 설치의 것이거나, 죽은 설치의 것이면 다음 깔기 · 「부품 --실행」이 치운다`);
  if (r.그밖.length) 줄.push(`  이 자리의 다른 폴더 ${r.그밖.length}: ${r.그밖.join(' · ')} — 옛 열쇠 자리(그 판의 편이 이어져 있을 수 있다)나 비켜 놓은 폴더(${비킴꼬리}…)다. 이 도구는 지우지 않는다(한 벌 0.6GB쯤 — 이어진 편이 없는 것을 확인하고 손으로 치운다)`);
  return 줄.join('\n');
}

function main(argv) {
  const 깃발 = new Set(argv.filter((a) => a.startsWith('--')));
  const 자리값 = argv.filter((a) => !a.startsWith('--'));
  const 모르는 = [...깃발].filter((k) => !['--실행', '--갱신', '--json'].includes(k));
  if (모르는.length || 자리값.length !== 1) {
    console.error('사용: node tools/새편.js <편 폴더> [--실행] [--갱신] [--json]\n      node tools/새편.js 부품 [--실행] [--json]');
    return 2;
  }
  const 실행 = 깃발.has('--실행'), 갱신 = 깃발.has('--갱신'), json = 깃발.has('--json');
  const 알림 = (글) => console.error(글);
  if (자리값[0] === '부품') {
    // 깔 일이 없어도 죽은 설치의 임시 폴더는 여기서 치운다(부품이 멀쩡한 동안에는 깔기가 돌지 않는다)
    if (실행) { const 치움 = 죽은임시치우기(부품자리()); if (치움.length) 알림(`죽은 설치가 남긴 임시 폴더 ${치움.length}개를 치웠다`); }
    const r = 부품깔기({ 실행, 알림 });
    console.log(json ? JSON.stringify(r, null, 1) : 부품글(r));
    return 0;
  }
  const r = 편찍기(자리값[0], { 실행, 갱신, 알림 });
  console.log(json ? JSON.stringify(r, null, 1) : 편글(r));
  return r.막힘.length || r.다름.length ? 1 : 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(`새편: ${e.message}`); process.exitCode = 1; }
}

module.exports = { 틀읽기, 편이름풀기, 적용편인가, 다른틀찾기, 요구하나, 부품자리, 잠금읽기, 열쇠, 실물빠짐, 깔린것대조, 부품상태, 부품깔기, 죽은임시치우기, 같은내용, blob값, raw줄읽기, 지난blob, 같은길, 틀항목, 편보기, 편찍기, 편글, 부품글, 기본원천, 표시이름, 임시접두, 비킴꼬리 };
