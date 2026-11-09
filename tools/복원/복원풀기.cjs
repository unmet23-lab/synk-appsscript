#!/usr/bin/env node
'use strict';
/**
 * 복원풀기 — 암호 묶음을 암호 한 번으로 풀어 집 아래 원래 자리에 놓는다(새 노트북, 복원 시험).
 *
 *   node 복원풀기.cjs --집 <폴더> [--열쇠파일 <열쇠-….enc>] [--폴더 <암호문 폴더>…] [--받기 비공개문서,창고장부,대화기록] [--받는곳 <폴더>]
 *                     [--비밀키 <비밀키_잠금.json>] [--임시 <폴더>] [--암호파일 <파일>] [--json]
 *
 * 순서: 암호를 묻는다 → 열쇠 묶음을 푼다(Drive 자격이 여기 들어 있다) → --받기 묶음을 77yuhbs에서 받는다 → 받은 것 · --폴더의 묶음을 푼다.
 * 받기가 실패하면 묶음을 하나도 풀지 않는다 — 있는 파일을 덮지 않으므로, 한쪽의 옛 판을 먼저 풀면 다시 돌려도 새 판으로 안 바뀐다. 끝 코드 3. 받기 없이 --폴더만 주면 그 조각만 푼다(77yuhbs를 못 쓸 때).
 * 조각은 최신→과거 순으로 풀고 이미 있는 파일은 건너뛴다 — 같은 경로는 최신 판이 이기고, 끊겨도 다시 돌리면 이어진다. 기존 파일을 덮지 않는다.
 * 같은 묶음 이름의 폴더가 여럿이면(77yuhbs에서 받은 곳 · G:의 unmet23 자리) 조각을 합쳐 한 줄로 푼다 — 두 드라이브는 서로 독립이라 한쪽에만 간 조각이 있을 수 있다.
 * GCM 태그가 맞은 뒤에만 푼다(암호.js decryptFile). 풀린 tar는 임시 폴더에서 바로 지운다.
 * --암호파일은 시험용이다. 평소에는 터미널에서 묻는다(암호는 화면 · 기록 어디에도 남지 않는다).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const 암호 = require('./암호.js');

const 조각꼴 = /\.tar\.zst\.enc$/;

function 인자(argv) {
  const 값 = { 폴더: [], 받기: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--집') 값.집 = argv[++i];
    else if (a === '--열쇠파일') 값.열쇠파일 = argv[++i];
    else if (a === '--폴더') 값.폴더.push(argv[++i]);
    else if (a === '--받기') 값.받기 = argv[++i].split(',').filter(Boolean);
    else if (a === '--받는곳') 값.받는곳 = argv[++i];
    else if (a === '--비밀키') 값.비밀키 = argv[++i];
    else if (a === '--임시') 값.임시 = argv[++i];
    else if (a === '--암호파일') 값.암호파일 = argv[++i];
    else if (a === '--json') 값.json = true;
    else throw new Error(`모르는 인자: ${a}`);
  }
  if (!값.집) throw new Error('--집이 필요하다');
  return 값;
}

function 비밀키찾기(값) {
  const 집 = 값.집, 진짜집 = os.homedir();
  const 후보 = [값.비밀키,
    path.join(집, '.synk-backup-key', '비밀키_잠금.json'),
    값.열쇠파일 && path.join(path.dirname(값.열쇠파일), '비밀키_잠금.json'),
    'G:\\내 드라이브\\SYNK_복원\\열쇠\\비밀키_잠금.json',
    'G:\\내 드라이브\\SYNK_금고\\열쇠\\백업열쇠_비밀키_잠금.json',
    path.join(진짜집, 'Downloads', '비밀키_잠금.json'),
    path.join(진짜집, 'OneDrive', 'SYNK', '복구열쇠', '비밀키_잠금.json')].filter(Boolean);
  for (const f of 후보) if (fs.existsSync(f)) return f;
  throw new Error('비밀키_잠금.json을 못 찾았다 — 드라이브 SYNK_복원/열쇠에서 받아 내려받기 폴더에 두세요');
}

function 숨겨묻기(질문) {
  return new Promise((ok, no) => {
    const 입력 = process.stdin;
    if (!입력.isTTY || typeof 입력.setRawMode !== 'function') { no(new Error('키 입력을 받을 수 있는 터미널 창에서 실행해 주세요')); return; }
    process.stdout.write(질문);
    let s = '';
    입력.setRawMode(true); 입력.resume(); 입력.setEncoding('utf8');
    const 끝 = () => { 입력.setRawMode(false); 입력.pause(); 입력.off('data', 받음); process.stdout.write('\n'); ok(s); };
    const 받음 = (덩이) => {
      for (const ch of 덩이) {
        if (ch === '\r' || ch === '\n') { 끝(); return; }
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); }
        if (ch === '\u0008' || ch === '\u007f') { if (s) { s = s.slice(0, -1); process.stdout.write('\b \b'); } continue; }
        if (ch < ' ') continue;
        s += ch;
        process.stdout.write('*');
      }
    };
    입력.on('data', 받음);
  });
}

function 임시자리(값) {
  const 후보 = [값.임시, 'D:\\SYNK_복원대기\\풀기', path.join(os.tmpdir(), 'SYNK_복원풀기')].filter(Boolean);
  for (const 곳 of 후보) {
    try {
      if (!fs.existsSync(path.parse(곳).root)) continue;
      fs.mkdirSync(곳, { recursive: true });
      return 곳;
    } catch {}
  }
  throw new Error('임시 폴더를 못 만들었다');
}

function 파이썬(args, 집, stdio = 'pipe') {
  const r = spawnSync(process.env.SYNK_복원_파이썬 || 'python', ['-X', 'utf8', '-B', path.join(__dirname, '암호묶음.py'), ...args],
    { encoding: 'utf8', windowsHide: true, stdio, env: { ...process.env, SYNK_복원_집: 집 }, maxBuffer: 16 << 20 });
  return r;
}

async function 조각풀기(비밀키, 파일, 임시, 집) {
  const tar = path.join(임시, `${path.basename(파일, '.enc')}.${process.pid}`);
  try {
    await 암호.decryptFile(비밀키, 파일, tar);
    const r = 파이썬(['풀기', tar, '--집', 집], 집);
    if (r.status !== 0) throw new Error(`묶음 풀기 실패: ${String(r.stderr).slice(-300)}`);
    return JSON.parse(String(r.stdout).trim().split('\n').pop());
  } finally {
    fs.rmSync(tar, { force: true });
    fs.rmSync(`${tar}.part`, { force: true });
  }
}

function 조각들(곳) {
  let 이름들 = [];
  try { 이름들 = fs.readdirSync(곳); } catch { return []; }
  return 이름들.filter((n) => 조각꼴.test(n)).sort().reverse().map((n) => path.join(곳, n));
}

/** 묶음마다 모든 폴더의 조각을 합쳐 최신→과거로 줄 세운다. 같은 이름은 앞 폴더 것을 쓴다(이미 받은 것을 드라이브 자리표시자보다 먼저). */
function 묶음별조각(폴더들) {
  const 묶음별 = new Map();
  for (const 곳 of 폴더들) {
    const 묶음 = path.basename(곳);
    if (!묶음별.has(묶음)) 묶음별.set(묶음, new Map());
    const 줄 = 묶음별.get(묶음);
    for (const 파일 of 조각들(곳)) if (!줄.has(path.basename(파일))) 줄.set(path.basename(파일), 파일);
  }
  return [...묶음별].map(([묶음, 줄]) => [묶음, [...줄.keys()].sort().reverse().map((n) => 줄.get(n))]);
}

async function 돌리기(값, 알림 = (m) => console.log(m)) {
  const 잠금파일 = 비밀키찾기(값);
  const 잠금 = JSON.parse(fs.readFileSync(잠금파일, 'utf8'));
  // 복호화 암호는 창고 열쇠를 만들 때(2026-10-17, 원본창고 `암호.js 열쇠만들기`) 정한 12자 이상의 암호다.
  // 틀리면 그 자리에서 다시 묻는다 — 받은 조각을 버리고 처음부터 다시 받지 않게. 열쇠 쪽에는 시도 제한이 없다.
  let 비밀키;
  for (let 번 = 1; !비밀키; 번++) {
    const 말 = 값.암호파일 ? fs.readFileSync(값.암호파일, 'utf8').replace(/\r?\n$/, '') : await (값.묻기 || 숨겨묻기)('복호화 암호(창고 열쇠 암호, 12자 이상): ');
    try { 비밀키 = 암호.unlockPrivate(잠금, 말); } catch {
      if (값.암호파일 || 번 >= 5) throw new Error('암호가 맞지 않습니다');
      const 길이 = [...말].length;
      process.stderr.write(`암호가 맞지 않습니다${길이 < 12 ? ` — 방금 친 것은 ${길이}자이고 창고 열쇠 암호는 12자 이상입니다` : ''}. 다시 쳐 주세요(${번}/5).\n`);
    }
  }
  const 임시 = 임시자리(값);
  const 합 = { 풀림: 0, 건너뜀: 0, 거절: 0, 실패: 0, 손상: 0, 바이트: 0, 조각: 0, 조각실패: 0, 묶음: {} };
  const 손상이름 = new Set();
  const 더하기 = (묶음, c) => {
    for (const k of ['풀림', '건너뜀', '거절', '실패', '바이트']) 합[k] += c[k] || 0;
    for (const n of c.손상이름 || []) 손상이름.add(n);
    합.조각++;
    합.묶음[묶음] = 합.묶음[묶음] || { 풀림: 0, 건너뜀: 0, 조각: 0 };
    합.묶음[묶음].풀림 += c.풀림 || 0; 합.묶음[묶음].건너뜀 += c.건너뜀 || 0; 합.묶음[묶음].조각++;
  };
  if (값.열쇠파일) {
    알림(`열쇠를 푸는 중: ${path.basename(값.열쇠파일)}`);
    더하기('열쇠', await 조각풀기(비밀키, 값.열쇠파일, 임시, 값.집));
  }
  const 받은폴더 = [];
  if (값.받기.length) {
    const 받는곳 = 값.받는곳 || path.join(임시, '받기');
    알림(`77yuhbs에서 받는 중: ${값.받기.join(' · ')}`);
    const r = 파이썬(['받기', ...값.받기, '--폴더', 받는곳], 값.집, ['ignore', 'pipe', 'inherit']);
    if (r.status === 0) for (const n of 값.받기) 받은폴더.push(path.join(받는곳, n));
    else {
      합.받기실패 = true;
      알림('77yuhbs에서 받지 못해 묶음을 풀지 않았습니다. 다시 돌리면 이어집니다.');
    }
  }
  for (const [묶음, 줄] of 합.받기실패 ? [] : 묶음별조각([...받은폴더, ...값.폴더])) {
    알림(`${묶음}: 조각 ${줄.length}개를 푸는 중`);
    for (const 파일 of 줄) {
      // 망가진 조각 하나 때문에 나머지를 포기하지 않는다. 더 옛 조각이 그 파일의 옛 판을 채운다.
      try { 더하기(묶음, await 조각풀기(비밀키, 파일, 임시, 값.집)); } catch (e) {
        합.조각실패++;
        알림(`  이 조각은 못 풀어 건너뜁니다: ${path.basename(파일)} (${e.message})`);
      }
    }
  }
  // 손상으로 지운 파일 중 더 옛 조각이 채운 것은 뺀다 — 끝까지 빠진 파일만 손상이다.
  합.손상목록 = [...손상이름].filter((n) => !fs.existsSync(path.join(값.집, ...n.split('/'))));
  합.손상 = 합.손상목록.length;
  return 합;
}

if (require.main === module) {
  (async () => {
    const 값 = 인자(process.argv.slice(2));
    const 합 = await 돌리기(값, 값.json ? () => {} : undefined);
    console.log(JSON.stringify(합, null, 값.json ? 0 : 1));
    if (합.받기실패) process.exitCode = 3; // 인터넷 · 로그인을 고치고 다시 돌리면 이어진다
    else if (합.실패 || 합.손상 || 합.조각실패) process.exitCode = 2; // 대부분은 풀렸지만 살펴볼 것이 있다
  })().catch((e) => { console.error(`실패: ${e.message}`); process.exitCode = 1; });
}

module.exports = { 돌리기, 인자, 조각들, 묶음별조각 };
