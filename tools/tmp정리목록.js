#!/usr/bin/env node
'use strict';
/**
 * .tmp 한 달 정리 목록 — 앱 예약 작업 synk-tmp-monthly-list(매달 1일 10:00)를 AI 없이 돌리는 판(2026-10-18).
 * 정해진 계산(14일 넘게 손대지 않은 폴더 찾기)이라 모델을 부르지 않는다(운영 원칙: 단순 확인은 AI 없는 조회·알림).
 * 결정의 정본은 docs/_ops/결정.md 「작업 방식 확정 · .tmp 운영」(10-17). 영구 삭제는 어떤 경우에도 하지 않는다.
 *
 *   node tools/tmp정리목록.js                    목록을 만들어 텔레그램으로 보내고 output/크레딧작업/tmp정리목록/ 에 남긴다
 *   node tools/tmp정리목록.js --보내지않기        화면에만 보여 준다
 *   node tools/tmp정리목록.js --옮기기 a,b,c     유호님이 승인한 폴더만 C:\Users\q1212\SYNK_정리대기\<오늘>\ 로 옮긴다
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const 저장소 = path.resolve(__dirname, '..');
const 기본 = {
  임시: path.join(저장소, '.tmp'),
  대기: path.join(os.homedir(), 'SYNK_정리대기'),
  기기: '83F5',
  일수: 14,
};

function 기기모델() {
  const r = spawnSync('powershell', ['-NoProfile', '-Command', '(Get-CimInstance Win32_ComputerSystem).Model'], { encoding: 'utf8', windowsHide: true });
  return String(r.stdout || '').trim();
}

/** 링크(junction·심볼릭)는 따라 들어가지 않고, 가장 늦은 수정 시각·크기·파일 수를 모은다. */
function 훑기(폴더) {
  let 최신 = fs.lstatSync(폴더).mtimeMs, 크기 = 0, 파일 = 0;
  const 쌓기 = [폴더];
  while (쌓기.length) {
    const 지금 = 쌓기.pop();
    let 항목;
    try { 항목 = fs.readdirSync(지금, { withFileTypes: true }); } catch { continue; }
    for (const e of 항목) {
      const p = path.join(지금, e.name);
      let st;
      try { st = fs.lstatSync(p); } catch { continue; }
      if (st.mtimeMs > 최신) 최신 = st.mtimeMs;
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) 쌓기.push(p);
      else { 파일++; 크기 += st.size; }
    }
  }
  return { 최신, 크기, 파일 };
}

function git정보(폴더) {
  if (!fs.existsSync(path.join(폴더, '.git'))) return null;
  const 실행 = (args) => spawnSync('git', ['--no-optional-locks', '-C', 폴더, ...args], { encoding: 'utf8', windowsHide: true });
  const 상태 = 실행(['status', '--porcelain']);
  const 안올림 = 실행(['rev-list', '--count', 'HEAD', '--not', '--remotes']);
  return {
    미커밋: 상태.status === 0 ? String(상태.stdout).split(/\r?\n/).filter(Boolean).length : null,
    안올린커밋: 안올림.status === 0 ? Number(String(안올림.stdout).trim()) : null,
  };
}

// 코드와 작은 설정 파일만 본다. 문서·로그·소스 사본은 경로를 적어도 도구를 깨뜨리지 않고, 읽기만 오래 걸린다.
const 참조확장자 = new Map([['.cjs', 512 * 1024], ['.mjs', 512 * 1024], ['.js', 512 * 1024], ['.py', 512 * 1024], ['.ps1', 512 * 1024], ['.sh', 512 * 1024], ['.json', 64 * 1024]]);
const 건너뛸폴더 = new Set(['node_modules', '.git', 'isolated-source', 'candidate', 'candidates', 'source', 'sources', 'snapshot', 'snapshots',
  'dist', 'build', 'out', 'payload', 'images', 'frames', 'media', 'renders', '__pycache__']);
// `../../옛폴더/…`·`.tmp/옛폴더/…`처럼 다른 .tmp 폴더를 가리키는 경로. 점으로 시작하는 이름(`..`)은 폴더 이름이 아니다.
const 참조식 = /(?:(?:\.\.[\\/])+|\.tmp[\\/])([^.\\/'"`\s)\]][^\\/'"`\s)\]]*)/g;

/**
 * 주어진 폴더들의 코드·설정 파일에서 다른 .tmp 폴더를 가리키는 경로를 모은다(이름 → 가리킨 폴더들).
 * 10-19: 회사 서버 릴리스 도구가 10-11~14 폴더(서버 접속 고정 정보·도우미)를 경로로 끌어 써서,
 * 날짜만 보고 옮기면 최근 작업이 깨진다. 읽기만 하며 폴더마다·전체 파일 수에 상한을 둔다.
 */
function 참조모으기(임시, 폴더들, 이름들, 상한 = { 폴더당: 2000, 전체: 60000 }) {
  const 찾은 = new Map();
  let 전체 = 0;
  for (const 폴더 of 폴더들) {
    const 쌓기 = [path.join(임시, 폴더)];
    let 본파일 = 0;
    while (쌓기.length && 본파일 < 상한.폴더당 && 전체 < 상한.전체) {
      const 지금 = 쌓기.pop();
      let 항목;
      try { 항목 = fs.readdirSync(지금, { withFileTypes: true }); } catch { continue; }
      for (const e of 항목) {
        if (e.isSymbolicLink()) continue;
        const p = path.join(지금, e.name);
        if (e.isDirectory()) { if (!건너뛸폴더.has(e.name)) 쌓기.push(p); continue; }
        const 최대 = 참조확장자.get(path.extname(e.name).toLowerCase());
        if (!최대) continue;
        let 글;
        try { if (fs.statSync(p).size > 최대) continue; 글 = fs.readFileSync(p, 'utf8'); } catch { continue; }
        본파일++; 전체++;
        for (const m of 글.matchAll(참조식)) {
          const 이름 = m[1];
          if (이름 === 폴더 || !이름들.has(이름)) continue;
          if (!찾은.has(이름)) 찾은.set(이름, new Set());
          찾은.get(이름).add(폴더);
        }
      }
    }
  }
  return 찾은;
}

function 목록만들기(옵션 = {}) {
  const { 임시, 대기, 일수 } = { ...기본, ...옵션 };
  const 지금 = 옵션.지금 || Date.now();
  const 기준 = 지금 - 일수 * 24 * 60 * 60 * 1000;
  let 후보 = [];
  const 최근 = [];
  let 오래된파일 = 0, 오래된파일크기 = 0;
  for (const e of fs.existsSync(임시) ? fs.readdirSync(임시, { withFileTypes: true }) : []) {
    const p = path.join(임시, e.name);
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) continue;
    if (!st.isDirectory()) {
      if (st.mtimeMs < 기준) { 오래된파일++; 오래된파일크기 += st.size; }
      continue;
    }
    if (fs.existsSync(path.join(p, '_보존.txt'))) { 최근.push(e.name); continue; }
    const 잰것 = 훑기(p);
    if (잰것.최신 >= 기준) { 최근.push(e.name); continue; }
    후보.push({ 이름: e.name, MB: +(잰것.크기 / 1048576).toFixed(1), 파일: 잰것.파일, 마지막: new Date(잰것.최신).toISOString().slice(0, 10), git: git정보(p) });
  }
  // 최근·보존 폴더가 끌어 쓰는 옛 폴더는 남긴다. 남긴 폴더가 다시 가리키는 폴더도 따라가며 남긴다.
  const 참조로남김 = [];
  let 볼곳 = 최근;
  while (볼곳.length && 후보.length) {
    const 찾은 = 참조모으기(임시, 볼곳, new Set(후보.map((c) => c.이름)));
    if (!찾은.size) break;
    for (const [이름, 가리킨] of 찾은) 참조로남김.push({ 이름, 가리킨: [...가리킨].sort() });
    후보 = 후보.filter((c) => !찾은.has(c.이름));
    볼곳 = [...찾은.keys()];
  }
  후보.sort((a, b) => b.MB - a.MB);
  참조로남김.sort((a, b) => a.이름.localeCompare(b.이름));
  let 대기폴더 = 0, 대기MB = 0;
  if (fs.existsSync(대기)) {
    for (const e of fs.readdirSync(대기, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      대기폴더++;
      대기MB += 훑기(path.join(대기, e.name)).크기 / 1048576;
    }
  }
  return { 후보, 참조로남김, 오래된파일, 오래된파일MB: +(오래된파일크기 / 1048576).toFixed(1), 대기폴더, 대기MB: +대기MB.toFixed(1), 일수 };
}

function 글로(목록) {
  const 줄 = [`[.tmp 한 달 정리] ${목록.일수}일 넘게 손대지 않은 폴더 ${목록.후보.length}개`];
  if (!목록.후보.length) 줄.push('이번 달 정리할 폴더 없음');
  for (const c of 목록.후보) {
    const g = c.git ? ` · git(미커밋 ${c.git.미커밋 ?? '?'} · 안 올린 커밋 ${c.git.안올린커밋 ?? '?'})` : '';
    줄.push(`- ${c.이름} · ${c.MB}MB · ${c.파일}개 · 마지막 ${c.마지막}${g}`);
  }
  if (목록.참조로남김?.length) 줄.push(`오래됐지만 최근 작업이 경로로 끌어 써서 목록에서 뺀 폴더 ${목록.참조로남김.length}개: ${목록.참조로남김.slice(0, 8).map((x) => x.이름).join(', ')}${목록.참조로남김.length > 8 ? ' 외' : ''}`);
  if (목록.오래된파일) 줄.push(`맨 위 파일 중 ${목록.일수}일 넘은 것 ${목록.오래된파일}개 · ${목록.오래된파일MB}MB`);
  if (목록.대기폴더) 줄.push(`정리 대기(C:\\Users\\q1212\\SYNK_정리대기)에 지난 폴더 ${목록.대기폴더}개 · ${목록.대기MB}MB — 확인이 끝났으면 직접 지우시면 돼요.`);
  if (목록.후보.length) {
    줄.push('정리할 폴더를 알려 주세요(전부·일부·없음). git 사본 중 미커밋·안 올린 커밋이 있는 폴더는 한 번 더 확인할게요.');
    줄.push('승인하신 폴더만 정리 대기 폴더로 옮기고(이름만 바뀌는 이동), 지우지는 않아요.');
  }
  return 줄.join('\n');
}

function 옮기기(이름들, 옵션 = {}) {
  const { 임시, 대기 } = { ...기본, ...옵션 };
  const 지금목록 = new Set(목록만들기(옵션).후보.map((c) => c.이름));
  const 날 = new Date(옵션.지금 || Date.now());
  const 오늘 = `${날.getFullYear()}${String(날.getMonth() + 1).padStart(2, '0')}${String(날.getDate()).padStart(2, '0')}`;
  const 목적 = path.join(대기, 오늘);
  const 결과 = { 옮김: [], 남김: [] };
  for (const 이름 of 이름들) {
    if (!지금목록.has(이름) || 이름.includes('/') || 이름.includes('\\') || 이름 === '..') { 결과.남김.push({ 이름, 이유: '지금 후보가 아님' }); continue; }
    fs.mkdirSync(목적, { recursive: true });
    try { fs.renameSync(path.join(임시, 이름), path.join(목적, 이름)); 결과.옮김.push(이름); }
    catch (e) { 결과.남김.push({ 이름, 이유: e.code || e.message }); }
  }
  return { ...결과, 위치: 목적 };
}

module.exports = { 목록만들기, 글로, 옮기기, 훑기, 참조모으기 };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const 모델 = 기기모델();
  if (모델 !== 기본.기기) {
    console.error(`이 PC(${모델 || '모름'})는 새 노트북(${기본.기기})이 아니라서 아무것도 하지 않았다.`);
    process.exitCode = 2;
  } else if (argv[0] === '--옮기기') {
    const r = 옮기기(String(argv[1] || '').split(',').map((s) => s.trim()).filter(Boolean));
    console.log(`옮긴 폴더 ${r.옮김.length}개 → ${r.위치}${r.남김.length ? `\n남긴 것: ${r.남김.map((x) => `${x.이름}(${x.이유})`).join(', ')}` : ''}`);
  } else {
    const 글 = 글로(목록만들기());
    console.log(글);
    const 방 = path.join(저장소, 'output', '크레딧작업', 'tmp정리목록');
    fs.mkdirSync(방, { recursive: true });
    fs.writeFileSync(path.join(방, `${new Date().toISOString().slice(0, 10)}.md`), 글 + '\n');
    if (!argv.includes('--보내지않기')) require('./크레딧실행.js').텔레그램보내기(글);
  }
}
