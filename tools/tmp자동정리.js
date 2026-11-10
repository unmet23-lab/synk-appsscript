#!/usr/bin/env node
'use strict';
/**
 * .tmp 자동 정리 — 조용해진 임시 폴더를 날마다 정리 대기로 옮기고, 정리 대기를 D:로 내려놓고, 쌓이는 양을 한 줄씩 잰다
 * (2026-11-10 작업 방식 정리 2단계, 유호님 「2단계 시작」 — 설계 docs/_ops/qa/작업방식정리_20261110/2단계_설계.md).
 *
 * 왜: 11-10에 재니 .tmp가 146GB였고 그 가운데 14일 규칙(매달 1일 목록 · 승인 뒤 옮기기)이 고르는 것은 21곳 3.8GB뿐이었다.
 * 7일 넘게 조용한 폴더가 60GB였고, 정리 대기는 C:에 있어 옮겨도 C: 여유가 늘지 않았다. 다시 만들 수 있는 것(node_modules · 빌드 캐시)은
 * 조용한 폴더 안에 0.3GB뿐이라 「캐시 지우기」로는 못 푼다 — 그림 56GB · 영상 34GB, 곧 일하며 남긴 화면 · 렌더다.
 *
 * 하는 일(영구 삭제는 하지 않는다 — 지우는 것은 유호님이 tools/정리대기비우기.ps1로):
 *   1. 고르기 — tools/tmp정리목록.js의 후보(최근 작업 · 저장소 코드 · _정리제외.txt가 가리키는 폴더는 뺌) 가운데 N일 넘게 조용한 것만.
 *      릴리스 옛 판도 여기서는 N일이 지나야 한다(매달 목록은 날짜와 상관없이 보이고 승인을 받지만, 여기는 승인이 없다).
 *      살아 있는 문서(트랙 · 관문 한 장 · AGENTS · 운영 원칙)가 `.tmp/<이름>`으로 가리키는 폴더는 남기고 그 폴더가 가리키는 폴더도 남긴다.
 *      올리지 않은 git 변경이 있는 폴더 · 실행 중인 명령줄에 `.tmp/<이름>`이 보이는 폴더도 뺀다.
 *      모음 폴더(.tmp/검수)는 통째로 두고 안의 옛 묶음만 `검수/<묶음>`으로 고른다 — 기준 안의 묶음 · _보존 묶음 · 살아 있는 문서가 검수 ID로
 *      적어 둔 묶음과 그 다시 검수 사슬의 앞 고리는 남긴다(11-10: 묶음 1,807개 12GB 가운데 7일 넘은 것이 1,203개 6.8GB).
 *   2. 옮기기 — 옮기기 직전에 다시 재어 그새 바뀐 폴더는 두고, 같은 드라이브의 정리 대기(<날짜>/)로 이름만 바꿔 옮긴다(한 번에 끝나는 이동).
 *      안에 열린 파일이 있거나 어떤 프로세스의 작업 폴더면 Windows가 거절한다 — 그 폴더는 둔다.
 *   3. 내려놓기 — 정리 대기의 폴더를 D:\SYNK_정리대기로 옮긴다(robocopy /MOVE, 연결은 따라가지 않고 끊은 자리를 적어 둔다).
 *      .tmp에서 바로 D:로 옮기지 않는 까닭: 쓰는 중일지 모르는 자리에서 드라이브를 넘는 복사를 하면 반쯤 옮겨진 채로 보이는 시간이 생긴다.
 *      먼 자리에 같은 이름이 이미 있으면 합치지 않고 번호를 붙인다(`<이름>__2`).
 *   4. 재기 — .tmp 합 · 나이별 · 큰 폴더 열 · 정리 대기 · 디스크 여유를 장부 한 줄로 남긴다(`--추이`로 본다).
 *
 *   node tools/tmp자동정리.js                 미리 보기(고르기만 — 아무것도 옮기지 않고 장부도 쓰지 않는다)
 *   node tools/tmp자동정리.js --실행           1~4를 한다
 *   node tools/tmp자동정리.js --일수 N         「N일 넘게 조용한」 기준(기본 7)
 *   node tools/tmp자동정리.js --되돌리기 <이름> [--실행]   정리 대기(C: · D:)에 있는 폴더를 .tmp 제자리로 되돌린다(검수 묶음은 검수/<묶음>)
 *   node tools/tmp자동정리.js --추이 [N]       장부의 끝 N줄(기본 14)을 표로
 *   공통: --json(결과를 JSON으로) · --help
 * 공간 지킴이가 하루 한 번 운영 사본에서 `--실행 --json`으로 부른다(대상은 늘 공용 작업본의 .tmp — tools/lib/공용작업본.js).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const 목록도구 = require('./tmp정리목록.js');
const { 공용작업본 } = require('./lib/공용작업본.js');

const 쓰는법 = [
  '쓰는 법 — node tools/tmp자동정리.js [선택지]',
  '  (선택지 없음)            미리 보기 — 옮길 폴더와 남기는 까닭만 보인다',
  '  --실행                   조용한 임시 폴더를 정리 대기로 옮기고, 정리 대기를 D:로 내려놓고, 쌓인 양을 장부에 적는다',
  '  --일수 N                 「N일 넘게 손대지 않은」 기준(기본 7)',
  '  --되돌리기 <이름>        정리 대기(C: · D:)의 그 폴더를 .tmp 제자리로(--실행을 붙여야 옮긴다, 검수 묶음은 검수/<묶음>)',
  '  --추이 [N]               장부의 끝 N줄(기본 14)',
  '  --json                   결과를 JSON으로 찍는다',
  '  --help, -h               이 쓰는 법만 찍는다',
  '영구 삭제는 하지 않는다. 모르는 인자를 주면 아무것도 하지 않고 이 쓰는 법을 찍고 2로 끝난다.',
].join('\n');

const 메인 = 공용작업본(path.resolve(__dirname, '..'));
const 기본 = {
  임시: path.join(메인, '.tmp'),
  대기: path.join(os.homedir(), 'SYNK_정리대기'),
  먼대기: 'D:\\SYNK_정리대기',
  // 살아 있는 문서 — 지금 하는 일과 늘 도는 것을 적는 장. 여기서 가리킨 임시 폴더는 조용해도 남긴다(결정 표는 지난 근거라 보지 않는다).
  문서들: ['docs/_ops/트랙.md', 'docs/_ops/관문_자동화.md', 'AGENTS.md', 'docs/AI_운영원칙.md'].map((f) => path.join(메인, f)),
  장부: path.join(메인, 'output', '크레딧작업', 'tmp정리목록', '자동.jsonl'),
  일수: 7,
  모음: 목록도구.기본.모음,   // 묶음마다 재는 모음 폴더(.tmp/검수) — 옛 묶음은 `검수/<묶음>` 이름으로 옮긴다
  한도분: 40,                 // 내려놓기에 쓰는 시간 — 넘으면 남은 폴더는 다음 회차가 잇는다(지킴이의 잠금을 오래 쥐지 않게)
};
const 하루 = 24 * 60 * 60 * 1000;
const GB = 1024 ** 3;
const 기가 = (바이트) => +(바이트 / GB).toFixed(2);
const 날이름 = (ms) => { const d = new Date(ms); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
const 맞춘글 = (글) => 글.toLowerCase().replace(/\\+/g, '/');
const 중간자리 = '_되돌리는중';

/** 실행 중인 모든 프로세스의 명령줄(소문자, 빗금은 /로). 못 읽으면 null — 그날은 옮기지 않는다. */
function 명령줄들() {
  if (process.platform !== 'win32') return '';
  const r = spawnSync('powershell', ['-NoProfile', '-Command',
    '[Console]::OutputEncoding=[Text.Encoding]::UTF8; (Get-CimInstance Win32_Process | ForEach-Object { $_.CommandLine }) -join "`n"'],
  { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26, timeout: 120000 });
  if (r.status !== 0 || typeof r.stdout !== 'string' || !r.stdout.trim()) return null;
  return 맞춘글(r.stdout);
}

// 이름이 더 이어지는 글자(영문 · 숫자 · _ · -). 한글은 이어짐으로 보지 않는다 — 「.tmp/job-1에서」 · 「…-20261101로 올린다」처럼 조사가 붙는다.
// 한글로 끝나는 이름은 더 긴 한글 이름의 언급에도 걸리지만(.tmp/옛것둘 → 옛것), 남기는 쪽으로 틀리는 것이라 둔다.
const 이어짐 = /[a-z0-9_-]/;

/** 글이 `.tmp/<이름>`을 적었는가(뒤에 이름 글자가 이어지면 다른 폴더, 문장 끝 마침표는 같은 폴더). 글은 맞춘글()을 거친 것. */
function 가리킴(글, 이름) {
  const 찾을 = `.tmp/${이름.toLowerCase()}`;
  for (let i = 글.indexOf(찾을); i !== -1; i = 글.indexOf(찾을, i + 1)) {
    const 뒤 = 글[i + 찾을.length] || '', 그뒤 = 글[i + 찾을.length + 1] || '';
    if (이어짐.test(뒤) || (뒤 === '.' && 이어짐.test(그뒤))) continue;
    return true;
  }
  return false;
}

/** 글에 그 낱말이 따로 서 있는가(앞뒤에 이름 글자가 이어지지 않게) — 검수 ID만 적어 둔 묶음을 남기려고. */
function 낱말있음(글, 낱말) {
  const 찾을 = 낱말.toLowerCase();
  for (let i = 글.indexOf(찾을); i !== -1; i = 글.indexOf(찾을, i + 1)) {
    const 앞 = i > 0 ? 글[i - 1] : '', 뒤 = 글[i + 찾을.length] || '', 그뒤 = 글[i + 찾을.length + 1] || '';
    if (이어짐.test(앞) || 이어짐.test(뒤) || (뒤 === '.' && 이어짐.test(그뒤))) continue;
    return true;
  }
  return false;
}

/**
 * 글이 `.tmp/…*…` 꼴로 적은 무늬들 — 무늬 하나는 경로 조각마다의 정규식(앞의 둘까지). 「.tmp/검수/*-끝판 묶음에서 센다」 같은 남은 일을 놓치지 않으려고.
 * 별표뿐인 조각(`.tmp/*` · `.tmp/검수/*`)은 버린다 — 문서 한 줄로 모든 폴더가 「지킬 것」이 되어 자동 정리가 조용히 꺼지지 않게.
 * 조사가 붙었을 수 있어(`…/*묶음에서`) 끝의 한글을 셋까지 뗀 꼴도 같이 본다(남기는 쪽으로 넓힌다).
 */
function 무늬들(글) {
  const 찾은 = [];
  const 조각식 = (s) => new RegExp(`^${s.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);
  for (const m of 글.matchAll(/\.tmp\/([^\s`'"()<>|,]+)/g)) {
    const 원 = m[1].replace(/[.)\]:;]+$/, '').replace(/\/+$/, '');
    if (!원.includes('*')) continue;
    const 꼴들 = new Set([원]);
    for (let t = 원, i = 0; i < 3 && /[가-힣]$/.test(t); i++) { t = t.slice(0, -1); 꼴들.add(t); }
    for (const 꼴 of 꼴들) {
      const 조각들 = 꼴.split('/').slice(0, 2);
      if (!조각들.some((s) => s.includes('*'))) continue;   // 별표가 더 깊은 자리에만 있으면 가리킴()이 이미 그 폴더를 본다
      if (조각들.some((s) => s.includes('*') && s.replace(/\*/g, '').length < 2)) continue;
      찾은.push(조각들.map(조각식));
    }
  }
  return 찾은;
}
/** 이름(맨 위 폴더 · `<모음>/<묶음>`)이 무늬의 앞 조각들과 맞는가 — 별표가 든 폴더 이름 뒤에 안쪽 경로가 붙어 있어도 그 폴더를 가리킨 것이다. */
function 무늬맞음(무늬, 이름) {
  const 조각 = 이름.toLowerCase().split('/');
  return 조각.length <= 무늬.length && 조각.every((s, i) => 무늬[i].test(s));
}

/** 살아 있는 문서들의 글 — { 글, 못읽음 }. 없는 문서는 넘어가고(시험 · 다른 저장소), 있는데 못 읽은 문서는 못읽음에 적는다. */
function 문서글(설정, 없어도됨 = true) {
  let 글 = '';
  const 못읽음 = [];
  for (const f of 설정.문서들 || []) {
    let 원문;
    try { 원문 = fs.readFileSync(f, 'utf8'); } catch (e) { if (e.code !== 'ENOENT' || !없어도됨) 못읽음.push(path.basename(f)); continue; }
    // 마크다운이 밑줄 · 별표 앞에 붙인 역슬래시(`공간정리\_20261102`)를 뗀 글과 그대로의 글을 둘 다 본다(남기는 쪽으로).
    글 += `\n${맞춘글(원문.replace(/\\([_*~])/g, '$1'))}\n${맞춘글(원문)}`;
  }
  return { 글, 못읽음 };
}

/** 살아 있는 문서가 가리키는 이름들(맨 위 폴더 · `<모음>/<묶음>`)과 본 이름 수. 목록을 만들기 전에 골라 「남길 뿌리」로 넘긴다. */
function 지킬이름(설정, 글) {
  const 지킬 = new Set();
  let 전체 = 0;
  const 무늬 = 글.trim() ? 무늬들(글) : [];
  let 맨위 = [];
  try { 맨위 = fs.readdirSync(설정.임시, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return { 지킬, 전체 }; }
  for (const 이름 of 맨위) {
    const 모음인가 = 설정.모음.includes(이름);
    if (!모음인가) { 전체++; if (가리킴(글, 이름) || 무늬.some((r) => 무늬맞음(r, 이름))) 지킬.add(이름); continue; }
    // 모음 폴더 자체는 늘 통째로 남는다 — 「남길 뿌리」로 넘기면 모든 묶음을 따라가게 되므로 묶음만 본다
    let 묶음들 = [];
    try { 묶음들 = fs.readdirSync(path.join(설정.임시, 이름), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { continue; }
    for (const 묶음 of 묶음들) {
      전체++;
      const 온이름 = `${이름}/${묶음}`;
      if (가리킴(글, 온이름) || 낱말있음(글, 묶음) || 무늬.some((r) => 무늬맞음(r, 온이름))) 지킬.add(온이름);
    }
  }
  return { 지킬, 전체 };
}

/**
 * 옮길 폴더를 고른다 — { 목록, 옮길: [후보…], 남김: [{ 이름, 이유 }], 지킨: [이름…], 멈춤: 까닭|null }.
 * 멈춤이 있으면 아무것도 옮기지 않는다(참조를 끝까지 못 훑었거나 프로세스 목록을 못 읽었다).
 */
function 고르기(옵션 = {}) {
  const 설정 = { ...기본, ...옵션 };
  const 지금 = 옵션.지금 || Date.now();
  const 기준 = 지금 - 설정.일수 * 하루;
  const 문서 = 문서글(설정, Boolean(옵션.문서들));
  if (문서.못읽음.length) return { 목록: {}, 옮길: [], 남김: [], 지킨: [], 멈춤: `살아 있는 문서를 읽지 못했다(${문서.못읽음.join(', ')})` };
  const { 지킬, 전체 } = 지킬이름(설정, 문서.글);
  const 지킨 = [...지킬].sort();
  // 문서가 폴더의 절반 넘게 가리킨다면 무늬가 너무 넓은 것이다 — 조용히 아무것도 안 옮기는 대신 멈춰서 알린다.
  if (전체 >= 20 && 지킬.size > 전체 / 2) return { 목록: {}, 옮길: [], 남김: [], 지킨, 멈춤: `살아 있는 문서가 폴더 ${전체}곳 가운데 ${지킬.size}곳을 가리킨다 — 문서의 별표 무늬가 너무 넓은지 본다` };
  const 목록 = (옵션.목록만들기 || 목록도구.목록만들기)({ 임시: 설정.임시, 대기: 설정.대기, 일수: 설정.일수, 모음: 설정.모음, 재기: true, 지킬: 지킨,
    ...(옵션.지금 ? { 지금: 옵션.지금 } : {}), ...(옵션.저장소 ? { 저장소: 옵션.저장소 } : {}) });
  if (목록.참조잘림) return { 목록, 옮길: [], 남김: [], 지킨, 멈춤: '참조를 끝까지 훑지 못했다' };
  const 명령줄 = (옵션.명령줄들 || 명령줄들)();
  if (명령줄 === null) return { 목록, 옮길: [], 남김: [], 지킨, 멈춤: '실행 중인 프로세스 목록을 읽지 못했다' };
  // 모음(.tmp/검수) 안의 옛 묶음 — 기준보다 오래됐고 「남길 묶음」(기준 안 · _보존 · 문서가 가리킴 · 그 다시 검수 사슬의 앞 고리)이 아닌 것.
  // 그 묶음으로 다시 배포하거나 다시 검수를 이으려 하면 관문이 「묶음 없음」으로 멈춘다 — 그때 --되돌리기로 제자리에 놓는다.
  const 묶음후보 = [];
  for (const m of 목록.모음남길 || []) {
    const 남길 = new Set(m.뿌리);
    for (const f of 목록.잰폴더 || []) {
      if (!f.이름.startsWith(`${m.이름}/`) || 남길.has(f.이름) || !(f.마지막ms < 기준)) continue;
      묶음후보.push({ 이름: f.이름, MB: +(f.바이트 / 1048576).toFixed(1), 파일: f.파일, 마지막: new Date(f.마지막ms).toISOString().slice(0, 10), 마지막ms: f.마지막ms, git: null, 까닭: ['옛묶음'] });
    }
  }
  const 옮길 = [], 남김 = [];
  for (const c of [...목록.후보, ...묶음후보]) {
    const g = c.git;
    if (!(c.마지막ms < 기준)) 남김.push({ 이름: c.이름, 이유: `릴리스 옛 판이지만 아직 ${설정.일수}일이 안 됨` });
    else if (g && (g.미커밋 !== 0 || g.안올린커밋 !== 0)) 남김.push({ 이름: c.이름, 이유: '올리지 않은 git 변경이 있거나 git 상태를 못 읽음' });
    else if (지킬.has(c.이름)) 남김.push({ 이름: c.이름, 이유: '살아 있는 문서가 가리킴' });
    else if (가리킴(명령줄, c.이름)) 남김.push({ 이름: c.이름, 이유: '실행 중인 명령줄에 보임' });
    else 옮길.push(c);
  }
  return { 목록, 옮길, 남김, 지킨, 멈춤: null };
}

/** 이름이 맨 위 폴더 하나이거나 모음 안의 묶음 하나(`검수/<묶음>`)인가 — 맞으면 경로 조각들, 아니면 null. */
function 이름조각(이름, 모음들) {
  if (typeof 이름 !== 'string' || !이름 || 이름.includes('\\')) return null;
  const 조각 = 이름.split('/');
  if (조각.length > 2 || 조각.some((s) => !s || s === '.' || s === '..')) return null;
  if (조각.length === 2 && !모음들.includes(조각[0])) return null;
  return 조각;
}

/** 고른 폴더를 같은 드라이브의 정리 대기(<오늘>/)로 옮긴다. 옮기기 직전에 다시 재어 그새 바뀐 폴더는 둔다. */
function 옮기기(옮길, 옵션 = {}) {
  const 설정 = { ...기본, ...옵션 };
  const 지금 = 옵션.지금 || Date.now();
  const 기준 = 지금 - 설정.일수 * 하루;
  const 목적 = path.join(설정.대기, 날이름(지금));
  const 결과 = { 옮김: [], 남김: [], 위치: 목적 };
  for (const c of 옮길) {
    const 이름 = c.이름;
    const 조각 = 이름조각(이름, 설정.모음);
    if (!조각) { 결과.남김.push({ 이름, 이유: '이름이 폴더 하나가 아님' }); continue; }
    const 원래 = path.join(설정.임시, ...조각);
    const 잰것 = 목록도구.훑기(원래);
    if (잰것.없음) { 결과.남김.push({ 이름, 이유: '없어졌거나 읽지 못함' }); continue; }
    // 목록을 만든 뒤로 바뀌었거나(몇 분이 걸린다) 지금은 기준보다 새것이면 둔다.
    const 목록때 = Number.isFinite(c.마지막ms) ? c.마지막ms : null;
    if ((목록때 !== null && 잰것.최신 > 목록때) || 잰것.최신 >= 기준) { 결과.남김.push({ 이름, 이유: '그새 바뀜' }); continue; }
    try {
      let 자리 = path.join(목적, ...조각);
      fs.mkdirSync(path.dirname(자리), { recursive: true });
      const 먼날 = path.join(설정.먼대기, 날이름(지금));
      const 겹침 = (끝이름) => fs.existsSync(path.join(목적, ...조각.slice(0, -1), 끝이름))
        || fs.existsSync(조각.length === 1 ? path.join(먼날, `${끝이름}${옮기는중}`) : path.join(먼날, `${조각[0]}${옮기는중}`, 끝이름));
      let 끝이름 = 조각[조각.length - 1];
      for (let n = 2; 겹침(끝이름); n++) 끝이름 = `${조각[조각.length - 1]}__${n}`;
      자리 = path.join(목적, ...조각.slice(0, -1), 끝이름);
      fs.renameSync(원래, 자리);
      결과.옮김.push({ 이름, 자리, 바이트: 잰것.크기, 파일: 잰것.파일, 마지막: new Date(잰것.최신).toISOString().slice(0, 10), 까닭: c.까닭 || [] });
    } catch (e) { 결과.남김.push({ 이름, 이유: `옮기지 못함(${e.code || e.message}) — 열린 파일이 있거나 누가 그 안에서 일하는 중` }); }
  }
  return 결과;
}

/** 폴더 안에 남은 연결을 끊고(가리키던 곳은 그대로) 빈 폴더를 아래부터 지운다. 재귀 삭제는 쓰지 않는다. { 끊은, 남은파일 } */
function 남은것치우기(폴더) {
  const 끊은 = [];
  let 남은파일 = 0;
  const 돌기 = (지금) => {
    let 항목;
    try { 항목 = fs.readdirSync(지금, { withFileTypes: true }); } catch { 남은파일++; return false; }
    let 비었나 = true;
    for (const e of 항목) {
      const p = path.join(지금, e.name);
      let st;
      try { st = fs.lstatSync(p); } catch { 남은파일++; 비었나 = false; continue; }
      if (st.isSymbolicLink()) {
        // 연결 자체만 끊는다 — rmdir은 폴더 연결(junction 포함)을, unlink는 파일 연결을 지우고 둘 다 가리키던 곳은 건드리지 않는다.
        let 가리킨 = null;
        try { 가리킨 = fs.readlinkSync(p); } catch { /* 못 읽어도 끊는다 */ }
        let 끊음 = false;
        for (const 끊기 of [fs.rmdirSync, fs.unlinkSync]) { try { 끊기(p); 끊음 = true; break; } catch { /* 다른 꼴로 다시 */ } }
        if (끊음) 끊은.push({ 자리: path.relative(폴더, p), 가리킨 }); else { 남은파일++; 비었나 = false; }
      } else if (st.isDirectory()) { if (!돌기(p)) 비었나 = false; } else { 남은파일++; 비었나 = false; }
    }
    if (비었나) { try { fs.rmdirSync(지금); return true; } catch { return false; } }
    return false;
  };
  if (fs.existsSync(폴더)) 돌기(폴더);
  return { 끊은, 남은파일 };
}

/**
 * robocopy로 폴더를 통째로 옮긴다(드라이브를 넘는다). 연결은 따라가지 않는다. 종료 코드 8 이상이 실패다.
 * /IS /IT — 지난번에 복사만 되고 원본을 못 지운 채 끊긴 파일(목적지에 같은 것이 있음)도 다시 옮겨 원본을 치운다.
 */
function 로보옮김(원래, 목적) {
  fs.mkdirSync(목적, { recursive: true });
  const r = spawnSync('robocopy', [원래, 목적, '/E', '/MOVE', '/XJ', '/IS', '/IT', '/COPY:DAT', '/DCOPY:DAT', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 26, timeout: 30 * 60 * 1000 });
  return { 코드: r.status, 됨: typeof r.status === 'number' && r.status < 8 };
}

const 옮기는중 = '.옮기는중';

/** 그 방에서 아직 쓰이지 않은 이름 — 있으면 `<이름>__2`, `__3` … */
function 빈이름(방, 이름) {
  let 새 = 이름;
  for (let n = 2; fs.existsSync(path.join(방, 새)); n++) 새 = `${이름}__${n}`;
  return 새;
}

/** 폴더 안에 남은 보통 파일 수(연결은 세지 않고 따라가지도 않는다). 없는 폴더는 0, 못 읽은 자리는 남은 것으로 센다. */
function 남은파일수(폴더) {
  let 수 = 0;
  const 쌓기 = [폴더];
  while (쌓기.length) {
    const 지금 = 쌓기.pop();
    let 항목;
    try { 항목 = fs.readdirSync(지금, { withFileTypes: true }); } catch (e) { if (e.code !== 'ENOENT') 수++; continue; }
    for (const e of 항목) {
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) 쌓기.push(path.join(지금, e.name)); else 수++;
    }
  }
  return 수;
}

function 끊은연결적기(날폴더, 줄들) {
  if (!줄들.length) return;
  try {
    const 적을곳 = path.join(날폴더, '_끊은연결.json');
    let 앞 = [];
    try { 앞 = JSON.parse(fs.readFileSync(적을곳, 'utf8')); } catch { /* 처음 */ }
    fs.writeFileSync(적을곳, JSON.stringify([...(Array.isArray(앞) ? 앞 : []), ...줄들], null, 1));
  } catch { /* 못 적어도 끊은 것은 결과(장부)에 남는다 */ }
}

/** 먼 자리의 `<이름>.옮기는중`에 끝난 이름을 붙인다(같은 드라이브 안의 이름 바꾸기). 모음이면 묶음마다. 같은 이름이 이미 있으면 번호를 붙인다. */
function 끝이름붙이기(목적날, 이름, 설정) {
  const 중 = path.join(목적날, `${이름}${옮기는중}`);
  const 번호붙임 = [];
  if (설정.모음.includes(이름)) {
    const 끝방 = path.join(목적날, 이름);
    fs.mkdirSync(끝방, { recursive: true });
    const 이름표 = new Map();
    for (const g of fs.readdirSync(중)) {
      const 새 = 빈이름(끝방, g);
      fs.renameSync(path.join(중, g), path.join(끝방, 새));
      이름표.set(g, 새);
      if (새 !== g) 번호붙임.push(`${이름}/${g} → ${새}`);
    }
    fs.rmdirSync(중);
    return { 자리: (안) => { const [묶음, ...나머지] = 안.split(path.sep); return path.join(이름, 이름표.get(묶음) || 묶음, ...나머지); }, 번호붙임 };
  }
  const 새 = 빈이름(목적날, 이름);
  fs.renameSync(중, path.join(목적날, 새));
  if (새 !== 이름) 번호붙임.push(`${이름} → ${새}`);
  return { 자리: (안) => path.join(새, 안), 번호붙임 };
}

/**
 * 정리 대기의 날짜 폴더 하나를 먼 자리로 내려놓는다 — 맨 위 폴더 하나씩, 먼 자리의 `<이름>.옮기는중`에 다 옮긴 뒤 이름을 바꿔 끝낸다.
 * 끊기면 `.옮기는중`과 원본에 나뉘어 남고 다음 회차가 같은 자리로 이어 옮긴다. 먼 자리의 끝난 이름과는 절대 합치지 않는다 —
 * 합치면 같은 이름의 다른 폴더가 섞이고, 끊긴 것을 「이미 있는 다른 폴더」로 보면 한 폴더가 둘로 쪼개진다.
 * 차례: robocopy → 원본에 파일이 안 남았는지 → 끝난 이름 붙이기 → 그 뒤에만 원본에 남은 연결을 끊는다(중간에 막히면 연결도 원본에 그대로).
 */
function 날짜내려놓기(원래날, 목적날, 설정, 옵션, 끝낼때) {
  const 한 = { 바이트: 0, 파일: 0, 끊은: [], 번호붙임: [], 남김: [] };
  let 항목 = [];
  try { 항목 = fs.readdirSync(원래날, { withFileTypes: true }); } catch { return 한; }
  for (const e of 항목) {
    const 원 = path.join(원래날, e.name);
    if (e.isSymbolicLink()) { 한.남김.push(`${e.name}(연결이라 두었다)`); continue; }
    if (!e.isDirectory()) {   // 날짜 폴더 바로 아래의 파일(메모 따위) — 덮지 않고 복사한 뒤 원본을 지운다
      try { fs.mkdirSync(목적날, { recursive: true }); fs.copyFileSync(원, path.join(목적날, 빈이름(목적날, e.name)), fs.constants.COPYFILE_EXCL); fs.unlinkSync(원); } catch { 한.남김.push(`${e.name}(파일을 못 옮김)`); }
      continue;
    }
    if (Date.now() > 끝낼때) { 한.남김.push(`${e.name}(시간이 다 돼 다음 회차로)`); continue; }
    const 옮기던자리 = path.join(목적날, `${e.name}${옮기는중}`);
    if (!fs.existsSync(옮기던자리) && 남은파일수(원) === 0) {   // 앞 회차가 다 옮기고 껍데기만 남겼다 — 다시 옮기면 빈 `__2`가 생긴다
      for (const c of 남은것치우기(원).끊은) 한.끊은.push({ 자리: path.join(e.name, c.자리), 가리킨: c.가리킨 });
      continue;
    }
    if (옵션.도는명령 && 옵션.도는명령.includes('robocopy') && 옵션.도는명령.includes(맞춘글(원))) { 한.남김.push(`${e.name}(앞 회차의 robocopy가 아직 옮기는 중)`); continue; }
    const 잰 = 목록도구.훑기(원);
    const r = (옵션.로보옮김 || 로보옮김)(원, 옮기던자리);
    if (!r.됨) { 한.남김.push(`${e.name}(robocopy ${r.코드} — 다음 회차가 잇는다)`); continue; }
    const 남은수 = 남은파일수(원);
    if (남은수) { 한.남김.push(`${e.name}(파일 ${남은수}개가 남음 — 다음 회차가 잇는다)`); continue; }
    let 끝;
    try { 끝 = 끝이름붙이기(목적날, e.name, 설정); } catch (err) { 한.남김.push(`${e.name}(끝 이름을 못 붙임 ${err.code || err.message} — 다음 회차가 잇는다)`); continue; }
    for (const c of 남은것치우기(원).끊은) 한.끊은.push({ 자리: 끝.자리(c.자리), 가리킨: c.가리킨 });
    한.번호붙임.push(...끝.번호붙임);
    한.바이트 += 잰.크기;
    한.파일 += 잰.파일;
  }
  try { fs.rmdirSync(원래날); } catch { /* 남은 것이 있으면 그대로 */ }
  return 한;
}

/**
 * 다 옮기고도 끝 이름을 못 붙인 것(가까운 자리에 원본이 없는 `.옮기는중`)에 이름을 붙인다. 원본이 남아 있으면 이어 옮기는 중이라 둔다.
 * 옮기기보다 먼저 돈다 — 같은 날 같은 이름의 새 폴더가 그 `.옮기는중`으로 합쳐지지 않게.
 */
function 고아이름붙이기(설정, 결과 = { 남김: [] }) {
  let 날들 = [];
  try { 날들 = fs.readdirSync(설정.먼대기, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name); } catch { return; }
  for (const 날 of 날들) {
    let 안 = [];
    try { 안 = fs.readdirSync(path.join(설정.먼대기, 날)).filter((n) => n.endsWith(옮기는중)); } catch { continue; }
    for (const n of 안) {
      const 이름 = n.slice(0, -옮기는중.length);
      if (fs.existsSync(path.join(설정.대기, 날, 이름))) continue;
      try { 끝이름붙이기(path.join(설정.먼대기, 날), 이름, 설정); 크기기억지우기(설정.먼대기, 날); } catch { 결과.남김.push({ 이름: 날, 이유: `${이름}(끝 이름을 못 붙임)` }); }
    }
  }
}

/** 정리 대기(C:)의 폴더를 먼 정리 대기(D:)로 내려놓는다. D:가 없거나 Windows가 아니면 건너뛴다. */
function 내려놓기(옵션 = {}) {
  const 설정 = { ...기본, ...옵션 };
  const 결과 = { 내려놓음: [], 남김: [], 건너뜀: null };
  if (process.platform !== 'win32') { 결과.건너뜀 = 'Windows가 아님'; return 결과; }
  if (!fs.existsSync(path.parse(path.resolve(설정.먼대기)).root)) { 결과.건너뜀 = '내려놓을 드라이브가 안 보임'; return 결과; }
  if (path.resolve(설정.먼대기).toLowerCase() === path.resolve(설정.대기).toLowerCase()) { 결과.건너뜀 = '정리 대기가 이미 그 자리'; return 결과; }
  고아이름붙이기(설정, 결과);
  let 항목 = [];
  try { 항목 = fs.readdirSync(설정.대기, { withFileTypes: true }); } catch { 항목 = []; }
  const 끝낼때 = Date.now() + 설정.한도분 * 60 * 1000;
  옵션 = { ...옵션, 도는명령: (옵션.명령줄들 || 명령줄들)() || '' };   // 지킴이가 시간을 넘겨 node만 끊은 뒤에도 robocopy는 남아 돌 수 있다
  for (const e of 항목) {
    if (e.name.startsWith('_') || e.isSymbolicLink() || !e.isDirectory()) continue;   // `_되돌리는중`처럼 이 도구가 쓰는 자리 · 연결 · 맨 위 파일은 둔다
    const 목적 = path.join(설정.먼대기, e.name);
    const 한 = 날짜내려놓기(path.join(설정.대기, e.name), 목적, 설정, 옵션, 끝낼때);
    끊은연결적기(목적, 한.끊은);
    크기기억지우기(설정.먼대기, e.name);
    for (const 글 of 한.남김) 결과.남김.push({ 이름: e.name, 이유: 글 });
    if (한.파일 || 한.끊은.length || 한.번호붙임.length || !한.남김.length) 결과.내려놓음.push({ 이름: e.name, 바이트: 한.바이트, 파일: 한.파일, 끊은: 한.끊은, 번호붙임: 한.번호붙임 });
  }
  고아이름붙이기(설정, 결과);
  return 결과;
}

/** 정리 대기(C: · D:)의 날짜 폴더에서 그 이름(번호 붙은 것 포함)을 찾는다 — 가장 늦게 옮긴 것부터. 옮기는 중인 것(`.옮기는중`)은 보지 않는다. */
function 대기찾기(설정, 조각) {
  const 끝 = 조각[조각.length - 1];
  const 꼴 = new RegExp(`^${끝.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}((?:__\\d+)*)$`, 'i');
  const 찾은 = [];
  let 내려놓는중 = 0;
  for (const 뿌리 of [설정.대기, 설정.먼대기]) {
    let 날들 = [];
    try { 날들 = fs.readdirSync(뿌리, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d{8}$/.test(e.name)).map((e) => e.name); } catch { continue; }
    for (const 날 of 날들) {
      const 방 = path.join(뿌리, 날, ...조각.slice(0, -1));
      let 이름들 = [];
      try { 이름들 = fs.readdirSync(방, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.isSymbolicLink()).map((e) => e.name); } catch { continue; }
      for (const n of 이름들) {
        const m = 꼴.exec(n);
        // 가까운 자리의 폴더가 먼 자리로 옮겨지는 중이면(먼 자리에 `.옮기는중`이 있다) 반쪽이다 — 고르지 않는다
        if (m && 뿌리 === 설정.대기 && fs.existsSync(path.join(설정.먼대기, 날, `${조각.length === 1 ? n : 조각[0]}${옮기는중}`))) { 내려놓는중++; continue; }
        if (m) 찾은.push({ p: path.join(방, n), 날, 날폴더: path.join(뿌리, 날), 안자리: path.join(...조각.slice(0, -1), n), 번호들: (m[1].match(/\d+/g) || []).map(Number) });
      }
    }
  }
  const 번호견줌 = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (b[i] || 0) - (a[i] || 0); if (d) return d; } return 0; };
  찾은.sort((a, b) => b.날.localeCompare(a.날) || 번호견줌(a.번호들, b.번호들));
  찾은.내려놓는중 = 내려놓는중;
  return 찾은;
}

/** 내려놓을 때 끊은 연결을 되돌린 자리에 다시 잇는다(가리키던 폴더가 지금도 있을 때만). 이은 것은 `_끊은연결.json`에서 지운다. */
function 연결다시잇기(원본, 자리) {
  const 적힌곳 = path.join(원본.날폴더, '_끊은연결.json');
  let 줄들;
  try { 줄들 = JSON.parse(fs.readFileSync(적힌곳, 'utf8')); } catch { return { 이은연결: 0, 못이은연결: [] }; }
  if (!Array.isArray(줄들)) return { 이은연결: 0, 못이은연결: [] };
  const 머리 = `${원본.안자리}${path.sep}`;
  let 이음 = 0;
  const 못이음 = [], 남길 = [];
  for (const 줄 of 줄들) {
    if (!줄 || typeof 줄.자리 !== 'string' || !줄.자리.startsWith(머리)) { 남길.push(줄); continue; }
    const 놓을곳 = path.join(자리, 줄.자리.slice(머리.length));
    try {
      if (!줄.가리킨 || !fs.statSync(줄.가리킨).isDirectory()) throw new Error('가리키던 폴더가 없음');
      fs.symlinkSync(줄.가리킨, 놓을곳, 'junction');
      이음++;
    } catch { 못이음.push({ 자리: 줄.자리.slice(머리.length), 가리킨: 줄.가리킨 }); 남길.push(줄); }
  }
  try { if (남길.length) fs.writeFileSync(적힌곳, JSON.stringify(남길, null, 1)); else fs.unlinkSync(적힌곳); } catch { /* 기록을 못 고쳐도 되돌린 것은 그대로 */ }
  return { 이은연결: 이음, 못이은연결: 못이음 };
}

/**
 * 정리 대기(C: · D:)에서 그 이름의 폴더를 찾아 .tmp 제자리로 되돌린다. 여러 곳에 있으면 가장 늦게 옮긴 것.
 * 드라이브를 넘을 때는 같은 드라이브의 「되돌리는 중」 자리로 다 옮긴 뒤 한 번에 제자리로 놓는다. 어느 원본을 옮기던 중인지 옆에 적어 두어,
 * 중간에 멈춘 뒤 다시 부르면 그 원본만 이어 옮긴다(다른 날짜의 같은 이름과 섞지 않는다). 원본이 이미 비었으면 이름만 바꿔 끝낸다.
 */
function 되돌리기(이름, 옵션 = {}) {
  const 설정 = { ...기본, ...옵션 };
  const 조각 = 이름조각(이름, 설정.모음);
  if (!조각) return { 됨: false, 이유: '이름이 폴더 하나가 아님' };
  const 제자리 = path.join(설정.임시, ...조각);
  if (fs.existsSync(제자리)) return { 됨: false, 이유: '.tmp에 같은 이름의 폴더가 이미 있음' };
  const 중간 = path.join(설정.대기, 중간자리, ...조각);
  const 적은곳 = `${중간}.원본.json`;
  const 잇는중 = fs.existsSync(중간);
  const 찾은 = 대기찾기(설정, 조각);
  if (!찾은.length && !잇는중) return { 됨: false, 이유: 찾은.내려놓는중 ? '먼 자리로 내려놓는 중인 폴더다 — 자동 정리가 마저 옮긴 뒤 다시 부른다' : '정리 대기에 그 이름이 없음' };
  let 원본 = 찾은[0] || null;
  if (잇는중) {
    try { 원본 = JSON.parse(fs.readFileSync(적은곳, 'utf8')); } catch { 원본 = null; }
    if (!원본 || typeof 원본.p !== 'string') return { 됨: false, 이유: `되돌리던 원본을 적은 쪽지를 읽지 못했다 — ${중간} 과 먼 자리를 직접 본다`, 잇는중: 중간 };
    if (!fs.existsSync(path.parse(path.resolve(원본.p)).root)) return { 됨: false, 이유: '되돌리던 원본의 드라이브가 안 보인다 — 보일 때 다시 부른다', 잇는중: 중간 };
  }
  if (!옵션.실행) return { 됨: false, 미리: true, 있는곳: 잇는중 ? 중간 : 원본.p, 다른곳: 찾은.filter((x) => !원본 || x.p !== 원본.p).map((x) => x.p), ...(잇는중 ? { 잇는중: 중간 } : {}) };
  const 풀기 = 잠그기(설정.장부);
  if (!풀기) return { 됨: false, 이유: '자동 정리가 돌고 있다 — 끝난 뒤 다시 부른다' };
  try {
    // 되돌린 폴더는 오늘 손댄 것으로 남긴다 — 표식이 새 파일이라 그 폴더는 다시 조용해질 때까지 고르지 않는다.
    const 끝내기 = (이은) => {
      try { fs.writeFileSync(path.join(제자리, '_되돌림.txt'), `${new Date().toISOString()} 정리 대기에서 되돌림(${원본 ? 원본.p : 중간})\n`); } catch { /* 표식을 못 써도 되돌린 것은 그대로 */ }
      if (원본) 크기기억지우기(path.dirname(원본.날폴더), 원본.날);
      return { 됨: true, 있던곳: 원본 ? 원본.p : 중간, ...이은 };
    };
    fs.mkdirSync(path.dirname(제자리), { recursive: true });
    if (!잇는중) {
      try { (옵션.이름바꾸기 || fs.renameSync)(원본.p, 제자리); return 끝내기(연결다시잇기(원본, 제자리)); } catch (e) {
        if (e.code !== 'EXDEV') return { 됨: false, 이유: e.code || e.message };
      }
      fs.mkdirSync(path.dirname(중간), { recursive: true });
      fs.writeFileSync(적은곳, JSON.stringify({ p: 원본.p, 날: 원본.날, 날폴더: 원본.날폴더, 안자리: 원본.안자리 }));
    }
    if (원본 && fs.existsSync(원본.p)) {
      const r = (옵션.로보옮김 || 로보옮김)(원본.p, 중간);
      if (!r.됨) return { 됨: false, 이유: `robocopy ${r.코드} — 옮기다 멈췄다. 다시 부르면 이어서 한다`, 잇는중: 중간 };
      const 남은수 = 남은파일수(원본.p);
      if (남은수) return { 됨: false, 이유: `원본에 파일 ${남은수}개가 남았다 — 다시 부르면 이어서 한다`, 잇는중: 중간 };
      남은것치우기(원본.p);
    }
    const 이은 = 원본 ? 연결다시잇기(원본, 중간) : { 이은연결: 0, 못이은연결: [] };
    (옵션.끝이름바꾸기 || fs.renameSync)(중간, 제자리);
    try { fs.unlinkSync(적은곳); } catch { /* 이미 없음 */ }
    return 끝내기(이은);
  } catch (e) { return { 됨: false, 이유: `${e.code || e.message} — 다시 부르면 이어서 한다` }; } finally { 풀기(); }
}

/**
 * 정리 대기 뿌리의 크기. 먼 정리 대기는 날마다 커지기만 해서 통째로 다시 훑지 않는다 — 폴더마다 잰 값을 `_크기.json`에 적어 두고,
 * 폴더의 수정 시각이 그대로이고 잰 지 7일이 안 됐으면 그 값을 쓴다. 이 도구가 내려놓거나 되돌린 폴더는 그 자리에서 기억을 지운다.
 */
function 폴더크기(뿌리, 기억하기 = false, 적기 = false) {
  let 바이트 = 0, 폴더 = 0;
  let 항목 = [];
  try { 항목 = fs.readdirSync(뿌리, { withFileTypes: true }); } catch { return { 바이트: 0, 폴더: 0 }; }
  const 기억파일 = path.join(뿌리, '_크기.json');
  let 기억 = {};
  if (기억하기) { try { 기억 = JSON.parse(fs.readFileSync(기억파일, 'utf8')) || {}; } catch { 기억 = {}; } }
  const 새기억 = {};
  const 지금 = Date.now();
  for (const e of 항목) {
    if (!e.isDirectory() || e.name.startsWith('_')) continue;
    const p = path.join(뿌리, e.name);
    let 고친때 = 0;
    try { 고친때 = Math.round(fs.statSync(p).mtimeMs); } catch { continue; }
    const 앞 = 기억[e.name];
    const 쓸만 = 기억하기 && 앞 && 앞.고친때 === 고친때 && Number.isFinite(앞.바이트) && 지금 - 앞.잰때 < 7 * 하루;
    새기억[e.name] = 쓸만 ? 앞 : { 고친때, 바이트: 목록도구.훑기(p).크기, 잰때: 지금 };
    폴더++; 바이트 += 새기억[e.name].바이트;
  }
  if (기억하기 && 적기) { try { fs.writeFileSync(기억파일, JSON.stringify(새기억)); } catch { /* 못 적으면 다음에 다시 잰다 */ } }
  return { 바이트, 폴더 };
}
function 크기기억지우기(뿌리, 이름) {
  const 기억파일 = path.join(뿌리, '_크기.json');
  try { const 기억 = JSON.parse(fs.readFileSync(기억파일, 'utf8')); if (기억 && 이름 in 기억) { delete 기억[이름]; fs.writeFileSync(기억파일, JSON.stringify(기억)); } } catch { /* 기억이 없으면 지울 것도 없다 */ }
}
function 여유(자리) {
  try { const s = fs.statfsSync(path.parse(path.resolve(자리)).root); return Number(s.bavail) * Number(s.bsize); } catch { return null; }
}

/** 쌓인 양 한 줄 — 목록만들기({ 재기: true })가 잰 폴더들로 셈한다(다시 훑지 않는다). 나이는 꽉 찬 날수로 센다(6.5일은 「3~6」). */
function 재기(목록, 옵션 = {}) {
  const 설정 = { ...기본, ...옵션 };
  const 지금 = 옵션.지금 || Date.now();
  const 폴더들 = 목록.잰폴더 || [];
  const 나이 = { '0-2': 0, '3-6': 0, '7-13': 0, '14+': 0 };
  const 날수 = (f) => Math.max(0, Math.floor((지금 - f.마지막ms) / 하루));
  let 합 = 0;
  for (const f of 폴더들) {
    합 += f.바이트;
    const 일 = 날수(f);
    나이[일 <= 2 ? '0-2' : 일 <= 6 ? '3-6' : 일 <= 13 ? '7-13' : '14+'] += f.바이트;
  }
  const 대기 = 폴더크기(설정.대기), 먼대기 = 폴더크기(설정.먼대기, true, Boolean(옵션.실행));
  const c여유 = 여유(설정.임시), d여유 = 여유(설정.먼대기);
  return {
    임시GB: 기가(합), 폴더: 폴더들.length, 나이GB: Object.fromEntries(Object.entries(나이).map(([k, v]) => [k, 기가(v)])),
    큰것: [...폴더들].sort((a, b) => b.바이트 - a.바이트).slice(0, 10).map((f) => ({ 이름: f.이름, GB: 기가(f.바이트), 일: 날수(f) })),
    대기GB: 기가(대기.바이트), 먼대기GB: 기가(먼대기.바이트), 여유GB: c여유 === null ? null : 기가(c여유), 먼여유GB: d여유 === null ? null : 기가(d여유),
  };
}

/** 한 번에 하나만 — 잠금 파일에 pid를 적는다. 주인이 죽었거나 12시간이 지났으면 넘겨받는다. 잡으면 푸는 함수를 준다(내 잠금일 때만 지운다). */
function 잠그기(장부) {
  const 잠금 = path.join(path.dirname(장부), '자동.lock');
  fs.mkdirSync(path.dirname(장부), { recursive: true });
  const 표 = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  for (let 번 = 0; 번 < 2; 번++) {
    try {
      fs.writeFileSync(잠금, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), 표 }), { flag: 'wx' });
      return () => { try { if (JSON.parse(fs.readFileSync(잠금, 'utf8')).표 === 표) fs.unlinkSync(잠금); } catch { /* 이미 없거나 남의 것 */ } };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let 주인 = null;
      try { 주인 = JSON.parse(fs.readFileSync(잠금, 'utf8')); } catch { /* 쓰는 중이거나 깨진 잠금 */ }
      let 살았나 = false;
      try { if (주인 && Number.isInteger(주인.pid)) { process.kill(주인.pid, 0); 살았나 = true; } } catch (err) { 살았나 = err.code === "EPERM"; }   // EPERM은 「있지만 내 권한으로 못 건드림」 — 살아 있다
      let 고친때 = 0;
      try { 고친때 = fs.statSync(잠금).mtimeMs; } catch { continue; }
      const 오래됨 = Date.now() - 고친때 > 12 * 60 * 60 * 1000;
      // 쥐고 있는 것으로 보는 때: 12시간이 안 됐고, 주인이 살아 있거나 내용을 아직 못 읽었다(방금 만든 잠금). 죽은 주인 · 오래된 잠금만 넘겨받는다.
      if (!오래됨 && (살았나 || !주인)) return null;
      try { fs.unlinkSync(잠금); } catch { return null; }
    }
  }
  return null;
}

/** 1~4를 한 번 돈다. 실행이 아니면 고르기만 한다(장부도 쓰지 않는다). */
function 돌기(옵션 = {}) {
  const 설정 = { ...기본, ...옵션 };
  const 지금 = 옵션.지금 || Date.now();
  const 고른 = 고르기(옵션);
  const 결과 = { at: new Date(지금).toISOString(), 일수: 설정.일수, 실행: Boolean(옵션.실행), 멈춤: 고른.멈춤,
    옮길: 고른.옮길.map((c) => ({ 이름: c.이름, MB: c.MB, 파일: c.파일, 마지막: c.마지막, 까닭: c.까닭 })), 고르기남김: 고른.남김,
    참조로남김: (고른.목록.참조로남김 || []).length, 문서가지킴: 고른.지킨.length };
  결과.옮길GB = +(고른.옮길.reduce((a, c) => a + c.MB, 0) / 1024).toFixed(2);
  if (!옵션.실행) { 결과.재기 = 재기(고른.목록, 옵션); return 결과; }
  const 풀기 = 잠그기(설정.장부);
  if (!풀기) return { ...결과, 멈춤: '다른 자동 정리가 돌고 있다' };
  try {
    if (process.platform === 'win32') 고아이름붙이기(설정);
    const 옮긴 = 고른.멈춤 ? { 옮김: [], 남김: [], 위치: null } : 옮기기(고른.옮길, 옵션);
    const 내린 = 내려놓기(옵션);
    // 옮긴 폴더는 이제 .tmp에 없다 — 재기에서 뺀다.
    const 옮긴이름 = new Set(옮긴.옮김.map((x) => x.이름));
    const 잰 = 재기({ ...고른.목록, 잰폴더: (고른.목록.잰폴더 || []).filter((f) => !옮긴이름.has(f.이름)) }, 옵션);
    Object.assign(결과, {
      옮김: 옮긴.옮김.map((x) => ({ 이름: x.이름, GB: 기가(x.바이트), 파일: x.파일, 마지막: x.마지막, 까닭: x.까닭 })), 옮김GB: 기가(옮긴.옮김.reduce((a, x) => a + x.바이트, 0)),
      옮기기남김: 옮긴.남김, 위치: 옮긴.위치,
      내려놓음: 내린.내려놓음.map((x) => ({ 이름: x.이름, GB: 기가(x.바이트), 파일: x.파일, 끊은연결: x.끊은.length, ...(x.번호붙임.length ? { 번호붙임: x.번호붙임 } : {}) })),
      끊은연결: 내린.내려놓음.flatMap((x) => x.끊은.map((c) => ({ 폴더: x.이름, ...c }))),
      내려놓기남김: 내린.남김, 내려놓기건너뜀: 내린.건너뜀, 재기: 잰,
    });
    delete 결과.옮길;
    fs.appendFileSync(설정.장부, JSON.stringify(결과) + '\n');
    return 결과;
  } finally { 풀기(); }
}

function 추이(옵션 = {}) {
  const 설정 = { ...기본, ...옵션 };
  let 줄들 = [];
  try { 줄들 = fs.readFileSync(설정.장부, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { /* 장부 없음 */ }
  return 줄들.slice(-(옵션.줄 || 14));
}

function 글로(결과) {
  const 줄 = [];
  if (결과.멈춤) 줄.push(`멈춤: ${결과.멈춤} — 아무것도 옮기지 않았다.`);
  if (결과.실행 && 결과.옮김) {
    줄.push(`옮긴 임시 폴더 ${결과.옮김.length}개 · ${결과.옮김GB}GB${결과.위치 ? ` → ${결과.위치}` : ''}`);
    for (const x of 결과.옮김.slice(0, 20)) 줄.push(`  - ${x.이름} · ${x.GB}GB · 마지막 ${x.마지막}`);
    if (결과.옮김.length > 20) 줄.push(`  … 외 ${결과.옮김.length - 20}개`);
    if (결과.내려놓기건너뜀) 줄.push(`정리 대기 내려놓기는 건너뜀: ${결과.내려놓기건너뜀}`);
    else 줄.push(`정리 대기에서 D:로 내려놓은 폴더 ${결과.내려놓음.length}개 · ${+결과.내려놓음.reduce((a, x) => a + x.GB, 0).toFixed(2)}GB`);
    for (const x of [...결과.옮기기남김, ...결과.내려놓기남김]) 줄.push(`  남김: ${x.이름} — ${x.이유}`);
  } else if (결과.옮길 && !결과.실행) {
    줄.push(`[미리 보기] ${결과.일수}일 넘게 조용한 임시 폴더 ${결과.옮길.length}개 · ${결과.옮길GB}GB를 옮길 수 있다(--실행을 붙이면 옮긴다).`);
    for (const x of 결과.옮길.slice(0, 30)) 줄.push(`  - ${x.이름} · ${x.MB}MB · 마지막 ${x.마지막}`);
    if (결과.옮길.length > 30) 줄.push(`  … 외 ${결과.옮길.length - 30}개`);
  }
  for (const x of (결과.고르기남김 || []).slice(0, 30)) 줄.push(`  고르지 않음: ${x.이름} — ${x.이유}`);
  if (결과.문서가지킴) 줄.push(`살아 있는 문서가 가리켜 남긴 폴더 · 묶음 ${결과.문서가지킴}개`);
  if (결과.참조로남김) 줄.push(`최근 작업 · 저장소 코드가 가리켜 남긴 폴더 ${결과.참조로남김}개`);
  const j = 결과.재기;
  if (j) 줄.push(`.tmp ${j.임시GB}GB(0~2일 ${j.나이GB['0-2']} · 3~6일 ${j.나이GB['3-6']} · 7~13일 ${j.나이GB['7-13']} · 14일 넘음 ${j.나이GB['14+']}) · 정리 대기 C: ${j.대기GB} · D: ${j.먼대기GB}GB · 여유 C: ${j.여유GB ?? '?'} · D: ${j.먼여유GB ?? '?'}GB`);
  return 줄.join('\n');
}

function 추이글(줄들) {
  if (!줄들.length) return '장부가 비어 있다.';
  const 머리 = '날짜        .tmp   0~2일  3~6일  7~13일  14일+  옮김   대기C  대기D  여유C';
  const 칸 = (v, n = 6) => String(v ?? '?').padStart(n);
  return [머리, ...줄들.map((r) => { const j = r.재기 || { 나이GB: {} }; return `${String(r.at).slice(0, 10)} ${칸(j.임시GB)} ${칸(j.나이GB['0-2'])} ${칸(j.나이GB['3-6'])} ${칸(j.나이GB['7-13'], 7)} ${칸(j.나이GB['14+'])} ${칸(r.옮김GB)} ${칸(j.대기GB)} ${칸(j.먼대기GB)} ${칸(j.여유GB)}`; })].join('\n');
}

/** 인자를 읽는다 — { 도움 } · { 오류 } · { 실행, 일수, 되돌리기, 추이, json }. 모르는 인자 · 값 없는 선택지는 오류다(기본 길로 흘리지 않는다). */
function 인자읽기(argv) {
  if (argv.some((a) => a === '--help' || a === '-h')) return { 도움: true };
  const 읽음 = { 실행: false, 일수: null, 되돌리기: null, 추이: null, json: false };
  const 값 = (i) => (i + 1 < argv.length && !String(argv[i + 1]).startsWith('--') ? String(argv[i + 1]) : null);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--실행') 읽음.실행 = true;
    else if (a === '--json') 읽음.json = true;
    else if (a === '--일수') {
      const v = 값(i), n = Number(v);
      if (v === null || !v.trim() || !(Number.isInteger(n) && n >= 1)) return { 오류: '--일수 뒤에는 1 이상의 정수를 적는다' };
      읽음.일수 = n; i++;
    } else if (a === '--되돌리기') {
      const v = 값(i);
      if (v === null || !v.trim()) return { 오류: '--되돌리기 뒤에는 폴더 이름을 적는다' };
      읽음.되돌리기 = v.trim(); i++;
    } else if (a === '--추이') {
      const v = 값(i);
      if (v === null) 읽음.추이 = 14;
      else { const n = Number(v); if (!(Number.isInteger(n) && n >= 1)) return { 오류: '--추이 뒤에는 1 이상의 정수를 적는다' }; 읽음.추이 = n; i++; }
    } else return { 오류: `모르는 인자 ${a}` };
  }
  if (읽음.추이 !== null && (읽음.실행 || 읽음.되돌리기 || 읽음.일수)) return { 오류: '--추이는 --json하고만 같이 쓴다' };
  if (읽음.되돌리기 && 읽음.일수) return { 오류: '--되돌리기에는 --일수를 쓰지 않는다' };
  return 읽음;
}

/** 명령 본체 — 끝 코드(0 됨 · 1 멈춤 · 2 쓰는 법이 틀렸거나 새 노트북이 아님). 주입은 시험용(찍기 · 알리기 · 기기모델 · 옵션). */
function 실행(argv, 주입 = {}) {
  const 찍기 = 주입.찍기 || ((글) => console.log(글));
  const 알리기 = 주입.알리기 || ((글) => console.error(글));
  const 인자 = 인자읽기(argv);
  if (인자.도움) { 찍기(쓰는법); return 0; }
  if (인자.오류) { 알리기(`${인자.오류} — 아무것도 하지 않았다.\n\n${쓰는법}`); return 2; }
  const 옵션 = { ...주입.옵션, ...(인자.일수 ? { 일수: 인자.일수 } : {}), 실행: 인자.실행 };
  if (인자.추이 !== null) { const 줄들 = 추이({ ...옵션, 줄: 인자.추이 }); 찍기(인자.json ? JSON.stringify(줄들, null, 1) : 추이글(줄들)); return 0; }
  const 모델 = (주입.기기모델 || 목록도구.기기모델)();
  if (모델 !== 목록도구.기본.기기) { 알리기(`이 PC(${모델 || '모름'})는 새 노트북(${목록도구.기본.기기})이 아니라서 아무것도 하지 않았다.`); return 2; }
  if (인자.되돌리기) {
    const r = 되돌리기(인자.되돌리기, 옵션);
    const 글 = r.됨 ? `되돌림: ${r.있던곳} → .tmp/${인자.되돌리기}${r.이은연결 ? ` · 끊었던 연결 ${r.이은연결}개 다시 이음` : ''}${r.못이은연결 && r.못이은연결.length ? ` · 못 이은 연결 ${r.못이은연결.length}개(${r.못이은연결.map((x) => x.자리).join(', ')})` : ''}`
      : r.미리 ? `[미리 보기] ${r.있는곳} 을 .tmp/${인자.되돌리기} 로 되돌릴 수 있다(--실행을 붙이면 옮긴다).` : `되돌리지 못함: ${r.이유}`;
    찍기(인자.json ? JSON.stringify(r, null, 1) : 글);
    return r.됨 || r.미리 ? 0 : 1;
  }
  const 결과 = 돌기(옵션);
  찍기(인자.json ? JSON.stringify(결과, null, 1) : 글로(결과));
  return 결과.멈춤 ? 1 : 0;
}

module.exports = { 고르기, 옮기기, 내려놓기, 되돌리기, 남은것치우기, 재기, 돌기, 추이, 글로, 추이글, 인자읽기, 실행, 가리킴, 낱말있음, 무늬들, 무늬맞음, 지킬이름, 쓰는법, 기본 };

if (require.main === module) process.exitCode = 실행(process.argv.slice(2));
