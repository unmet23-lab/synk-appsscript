'use strict';
/**
 * 알림 고침(무인)의 기계 관문과 격리 시험 — tools/크레딧작업/알림고침.js가 쓴다.
 *
 * 유호님 11-26 「바로 올리고 전후 보고」에 따라 사람 없이 올린다. 그래서 고칠 수 있는 곳은 아래 종류 표의 파일뿐이다(표에 없는 종류는
 * 진단만 한다). 모델이 쓴 코드는 GPT 검수를 통과한 뒤에만, 공용 git 폴더를 나누지 않는 사본에서, 자격 · 집 폴더 · 운영 경로를 뺀 환경으로 돈다.
 * 설계와 검토: 설계 검토 Fable 5.2(11-26, v1 · v2 · v4 · v4.1 · v4.2), GPT 검수 alert-fix-20261126 · -r2 · -r3 · -r4, README 「알림 고침」.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

/**
 * 사건 종류 → 고칠 수 있는 원천, 그 종류의 시험, 새 시험 이름 꼴, 고치면 안 되는 줄과 구간.
 * 막을구간은 바탕 판에서 시작 줄부터 끝 줄까지다. 구간 안의 줄을 바꾸거나 지우거나 구간 안에 줄을 넣으면 막는다. 못 찾으면 막는다.
 */
const 종류표 = Object.freeze({
  'tip-worker': Object.freeze({
    이름: '팁 적용안 처리',
    원천: Object.freeze(['tools/크레딧작업/팁적용안.js', 'tools/크레딧작업/팁판단자료.js']),
    시험: Object.freeze(['tests/팁적용안.test.js', 'tests/크레딧실행.test.js']),
    새시험: /^tests\/알림고침-팁[\p{L}\p{N}_-]{0,40}\.test\.js$/u,
    // 모델 · 노력 · 비용 · 시간 · 권한 · 도구 · 키 · 환경을 다루는 줄은 바꾸지 않는다(더하거나 빼는 줄 모두)
    못고칠줄: /모델|노력|비용상한|구독대체|시간제한|잠금시간|permission|allow|deny|Bash\(|PowerShell|WebFetch|WebSearch|NotebookEdit|mcp|--add-dir|--settings|--setting-sources|--tools|--model|--effort|--max-budget|--permission|dangerously|bypass|dontAsk|acceptEdits|크레딧|클로드키|\bkey\b|token|secret|password|비밀|자격|process\.env/i,
    // 배열 항목만 바꾸는 줄도 걸리게 구간째 막는다(GPT alert-fix-20261126 GA7, Fable v4 검토)
    막을구간: Object.freeze([
      Object.freeze({ 파일: 'tools/크레딧작업/팁적용안.js', 이름: '머리 상수(경로 · 장부 · 한 번의 줄 수)', 시작: /^const 파이썬 = /, 끝: /^const 판단언제 = / }),
      Object.freeze({ 파일: 'tools/크레딧작업/팁적용안.js', 이름: '권한 설정', 시작: /^const 설정 = \{/, 끝: /^\};\s*$/ }),
      Object.freeze({ 파일: 'tools/크레딧작업/팁적용안.js', 이름: '작업 머리(모델 · 노력 · 비용 · 시간)', 시작: /^module\.exports = \{/, 끝: /^\s+async 사전확인\(/ }),
      Object.freeze({ 파일: 'tools/크레딧작업/팁적용안.js', 이름: 'claude 인자', 시작: /^\s+인자\(/, 끝: /^\s+\},\s*$/ }),
    ]),
    // 실행 설정 지문(Fable v4 검토 P1-5) — GPT 통과 뒤, 격리 사본에서, 집까지 비운 환경의 자식 프로세스로 바탕 판과 고친 판을 불러 견준다.
    // 정직한 실수(머리 · 인자 · 지시문을 건드림)를 잡는 장치다. 일부러 피하는 코드는 GPT 검수가 막는다(설계 v4 4절).
    지문: Object.freeze({
      파일: 'tools/크레딧작업/팁적용안.js',
      자료: Object.freeze({ 판단문서: '판단', 카드형식: '형식', 자료오류: '', 지도: '지도', 줄: [{ row: 1, 게시물ID: 'x' }], 남은줄: 0, 재료: [], 덧붙임: '' }),
      ctx: Object.freeze({ 루트: '/고정' }),
    }),
  }),
});
const 한도 = Object.freeze({ 파일: 6, 줄: 400 });

const 비밀꼴 = [/sk-ant-[A-Za-z0-9_-]{10,}/, /\bsk-[A-Za-z0-9]{20,}/, /\bgh[pousr]_[A-Za-z0-9]{20,}/, /\bxox[abprs]-[A-Za-z0-9-]{10,}/, /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/];
const 메일꼴 = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;   // match로만 쓴다(g의 lastIndex)
const 예시메일 = /@example\.(?:invalid|com|org)$/i;
const 절대경로꼴 = /(?:\b[A-Za-z]:[\\/](?:Users|Windows|Program)|\/c\/Users\/|\\\\Users\\\\|%LOCALAPPDATA%|AppData[\\/])/i;
const 제어글자 = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/;
// 조건으로 건너뛰는 꼴({ skip: 조건 })도 막는다. 실제로 건너뛴 시험은 시험돌리기가 TAP의 skipped · todo로 다시 본다(GA6).
const 건너뛰기꼴 = /\.(?:only|skip|todo)\s*\(|\b(?:only|skip|todo)\s*:/;
// 올리기 검사 · 관련 시험에 넘기지 않는 환경 값 — 자격 · 운영 경로 · SSH와 GPG 대리(GA3 · r2 GA6). push는 이 환경을 쓰지 않는다.
const 뺄환경 = /^(?:SYNK_|HERMES_|ANTHROPIC_|CLAUDE_|OPENAI_|CODEX_|GEMINI_|GOOGLE_|TELEGRAM_|AWS_|AZURE_|GH_|GITHUB_|NPM_|SSH_|GPG_|GNUPG)|TOKEN|SECRET|PASSW|API_?KEY|CREDENTIAL|PRIVATE|ASKPASS/i;
// 원천에 더한 줄에서 막는 낱말 — 실행 설정을 밖에서 바꾸거나 새 권한을 쓰는 꼴(r2 GA9). process.execPath는 원천이 원래 쓴다(Fable v4 P2-1).
const 위험낱말 = /\bmodule\b|\bexports\b|\bthis\b|\brequire\s*\(|\beval\b|\bFunction\s*\(|globalThis|prototype|__proto__|child_process|process\.(?!execPath\b)/;
// 새 시험의 정체는 이름이 아니라 정의한 자리(파일 · 줄 · 칸)다 — 시험돌리기가 이 보고기를 TAP과 함께 붙인다(r4 GA8, 설계 v4.2)
const 자리보고기 = pathToFileURL(path.join(__dirname, '알림고침시험자리.mjs')).href;

function git(cwd, args, { input, env, 한도ms = 120000 } = {}) {
  // encoding이 buffer라 글자열 입력은 미리 바이트로 바꾼다
  const 입력 = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], { cwd, input: 입력, env, encoding: 'buffer', windowsHide: true, maxBuffer: 256 << 20, timeout: 한도ms });
  if (r.status !== 0) throw new Error(`git ${args[0]} 실패(${r.status ?? r.error?.code}) ${String(r.stderr || '').slice(0, 300)}`);
  return r.stdout;
}
const 글 = (b) => b.toString('utf8');

/** -U0 diff 하나를 덩이와 더한 · 뺀 줄로. 머리줄은 첫 @@ 앞에만 있다 — 내용이 ++ · --로 시작해도 줄로 센다(GA8). */
function diff읽기(diff) {
  const 덩이 = [], 더한줄 = [], 뺀줄 = [];
  let 안 = false;
  for (const 원 of diff.split('\n')) {
    const l = 원.endsWith('\r') ? 원.slice(0, -1) : 원;
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (m) { 안 = true; 덩이.push({ 기점: +m[1], 기수: m[2] === undefined ? 1 : +m[2], 새점: +m[3], 새수: m[4] === undefined ? 1 : +m[4] }); continue; }
    if (!안) continue;
    if (l.startsWith('+')) 더한줄.push(l.slice(1));
    else if (l.startsWith('-')) 뺀줄.push(l.slice(1));
  }
  return { 덩이, 더한줄, 뺀줄 };
}

/** 사본에서 바탕 커밋과 견준 바뀐 것. 새 파일도 보이게 사본의 인덱스에 올린다(사본은 이 시도만의 것이다). 고친 파일은 바탕 글도 붙인다. */
function 바뀐것(사본, 바탕) {
  git(사본, ['add', '-A', '--', '.']);
  const 칸 = 글(git(사본, ['diff', '--cached', '--name-status', '-z', '--no-renames', 바탕])).split('\0');
  const 목록 = [];
  for (let i = 0; i + 1 < 칸.length; i += 2) if (칸[i]) 목록.push({ 상태: 칸[i], 경로: 칸[i + 1] });
  const 수 = new Map();
  for (const 줄 of 글(git(사본, ['diff', '--cached', '--numstat', '-z', '--no-renames', 바탕])).split('\0')) {
    const m = /^(-|\d+)\t(-|\d+)\t(.+)$/s.exec(줄);
    if (m) 수.set(m[3], { 더함: m[1] === '-' ? null : Number(m[1]), 뺌: m[2] === '-' ? null : Number(m[2]) });
  }
  const 요약 = 글(git(사본, ['diff', '--cached', '--summary', '--no-renames', 바탕])).split(/\r?\n/);
  return 목록.map((x) => {
    const n = 수.get(x.경로) || { 더함: null, 뺌: null };
    const d = diff읽기(글(git(사본, ['diff', '--cached', '-U0', '--no-renames', 바탕, '--', x.경로])));
    const 모드 = 요약.some((l) => l.endsWith(` ${x.경로}`) && /mode change|create mode 120000/.test(l)) || 요약.some((l) => /create mode 120000/.test(l) && l.includes(x.경로));
    let 바탕글 = null;
    if (x.상태 === 'M') { try { 바탕글 = 글(git(사본, ['show', `${바탕}:${x.경로}`])); } catch { 바탕글 = null; } }
    return { ...x, 더함: n.더함, 뺌: n.뺌, 이진: n.더함 === null || n.뺌 === null, 모드, ...d, 바탕글 };
  });
}

/** 바탕 글에서 막을 구간의 줄 번호(1부터, 양끝 포함). 못 찾으면 null. */
function 구간찾기(바탕글, 구간) {
  const 줄 = String(바탕글).split(/\r?\n/);
  const i = 줄.findIndex((l) => 구간.시작.test(l));
  if (i < 0) return null;
  const j = 줄.findIndex((l, k) => k > i && 구간.끝.test(l));
  return j < 0 ? null : [i + 1, j + 1];
}
/** 덩이가 바탕의 [a, b]에 닿나. 넣기만 한 덩이(기수 0)는 기점 줄 뒤에 들어간다 — a ≤ 기점 < b면 구간 안이다. */
function 닿나(덩, [a, b]) {
  return 덩.기수 > 0 ? !(덩.기점 + 덩.기수 - 1 < a || 덩.기점 > b) : 덩.기점 >= a && 덩.기점 < b;
}

/** G1(경로 · 꼴 · 크기 · 못 고칠 줄 · 막을 구간) · G2(비밀값 · 메일 · 절대경로 · 제어 글자). 걸리면 { 통과: false, 까닭 }. */
function 관문(바뀐, 종류) {
  const 걸림 = (까닭) => ({ 통과: false, 까닭 });
  if (!종류) return 걸림('종류 표에 없는 사건이다');
  if (!바뀐.length) return 걸림('바뀐 것이 없다');
  if (바뀐.length > 한도.파일) return 걸림(`바뀐 파일이 ${바뀐.length}개다(${한도.파일}개까지)`);
  const 합 = 바뀐.reduce((n, x) => n + (x.더함 || 0) + (x.뺌 || 0), 0);
  if (합 > 한도.줄) return 걸림(`바뀐 줄이 ${합}줄이다(${한도.줄}줄까지)`);
  let 원천수 = 0, 시험수 = 0;
  for (const x of 바뀐) {
    if (x.이진) return 걸림(`이진 파일이다: ${x.경로}`);
    if (x.모드) return 걸림(`파일 꼴이 바뀌었다: ${x.경로}`);
    if (종류.원천.includes(x.경로)) {
      if (x.상태 !== 'M') return 걸림(`원천은 고치기만 한다(${x.상태}): ${x.경로}`);
      const 줄 = [...x.더한줄, ...x.뺀줄].find((l) => 종류.못고칠줄.test(l));
      if (줄 !== undefined) return 걸림(`고치면 안 되는 줄을 건드렸다: ${x.경로}`);
      if (x.더한줄.some((l) => 위험낱말.test(l))) return 걸림(`더한 줄에 실행 설정을 바꿀 수 있는 낱말이 있다: ${x.경로}`);
      for (const 구간 of (종류.막을구간 || []).filter((c) => c.파일 === x.경로)) {
        const 범위 = x.바탕글 === null || x.바탕글 === undefined ? null : 구간찾기(x.바탕글, 구간);
        if (!범위) return 걸림(`막을 구간 「${구간.이름}」을 바탕에서 찾지 못했다: ${x.경로}`);
        if ((x.덩이 || []).some((d) => 닿나(d, 범위))) return 걸림(`막은 구간 「${구간.이름}」을 건드렸다: ${x.경로}`);
      }
      원천수++;
    } else if (종류.새시험.test(x.경로)) {
      if (x.상태 !== 'A') return 걸림(`시험은 새 파일로만 더한다: ${x.경로}`);
      if (x.더한줄.some((l) => 건너뛰기꼴.test(l))) return 걸림(`시험에 only · skip · todo가 있다: ${x.경로}`);
      시험수++;
    } else return 걸림(`고칠 수 없는 파일이다: ${x.경로}`);
    for (const l of x.더한줄) {
      if (비밀꼴.some((re) => re.test(l))) return 걸림(`비밀값 꼴이 있다: ${x.경로}`);
      // 주소마다 본다 — 예시 주소가 한 줄에 있어도 다른 주소는 걸린다(GA9)
      if ((l.match(메일꼴) || []).some((m) => !예시메일.test(m))) return 걸림(`메일 주소가 있다: ${x.경로}`);
      if (절대경로꼴.test(l)) return 걸림(`PC 경로가 있다: ${x.경로}`);
      if (제어글자.test(l)) return 걸림(`제어 글자가 있다: ${x.경로}`);
    }
  }
  if (!원천수) return 걸림('원천을 고치지 않았다');
  if (!시험수) return 걸림('새 시험이 없다');
  return { 통과: true, 원천: 바뀐.filter((x) => 종류.원천.includes(x.경로)).map((x) => x.경로), 새시험: 바뀐.filter((x) => 종류.새시험.test(x.경로)).map((x) => x.경로), 줄: 합 };
}

/** 사본 인덱스의 blob sha(줄끝을 맞춘 내용). 올린 커밋과 견준다. */
function blob들(사본, 경로들) {
  const 출력 = 글(git(사본, ['ls-files', '-s', '-z', '--', ...경로들])).split('\0').filter(Boolean);
  return Object.fromEntries(출력.map((l) => { const m = /^\d+ ([0-9a-f]{40}) \d\t(.+)$/s.exec(l); return m ? [m[2], m[1]] : null; }).filter(Boolean));
}
function blob읽기(cwd, sha) { return git(cwd, ['cat-file', 'blob', sha]); }

/** 시험 환경 — 자격 · 운영 경로 · 집 폴더를 뺀다. 집 · 앱 자료 · 임시 폴더는 시도 폴더 안(사본의 .git 밖)으로, git 사용자는 시험용으로. */
function 환경(시도폴더, 바탕 = process.env) {
  const 자리 = path.join(시도폴더, '시험환경');
  for (const p of ['home', 'appdata', 'localappdata', 'tmp']) fs.mkdirSync(path.join(자리, p), { recursive: true });
  const 설정 = path.join(자리, 'gitconfig');
  fs.writeFileSync(설정, '[user]\n\tname = synk-alert-fix\n\temail = alert-fix@example.invalid\n[core]\n\tautocrlf = false\n[init]\n\tdefaultBranch = master\n');
  const env = {};
  for (const k of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'COMSPEC', 'PATHEXT', 'windir', 'WINDIR', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE', 'OS']) {
    if (typeof 바탕[k] === 'string') env[k] = 바탕[k];
  }
  return Object.assign(env, {
    HOME: path.join(자리, 'home'), USERPROFILE: path.join(자리, 'home'), APPDATA: path.join(자리, 'appdata'), LOCALAPPDATA: path.join(자리, 'localappdata'),
    TEMP: path.join(자리, 'tmp'), TMP: path.join(자리, 'tmp'), GIT_CONFIG_GLOBAL: 설정, GIT_CONFIG_NOSYSTEM: '1', CI: '1', SYNK_관련시험_자리: '끔',
  });
}
/** 올리기 환경 — 집 폴더는 그대로 두고(git push가 쓴다) 자격 · 운영 경로 · 관련 시험 끄기 값만 뺀다. 바깥 시험 실행의 표시(NODE_TEST_CONTEXT)도 뺀다. */
function 올리기환경(바탕 = process.env) {
  const env = {};
  for (const [k, v] of Object.entries(바탕)) if (typeof v === 'string' && !뺄환경.test(k) && k !== 'NODE_TEST_CONTEXT') env[k] = v;
  return env;
}

/** 그 자리가 파일인가 — 없거나 디렉터리면 아니다(디렉터리를 넘기면 node --test는 그 안의 시험 없이도 통과한다, r4 GA5 · GA7). */
function 파일인가(사본, p) {
  try { return fs.statSync(path.join(사본, p)).isFile(); } catch { return false; }
}

/**
 * node --test를 그 환경으로 돌리고 TAP 셈을 읽는다. 시험 파일이 하나라도 없거나 파일이 아니거나, 셈이 없거나, 시간이 넘거나, 하나라도 건너뛰면
 * 통과가 아니다. 없는 파일을 섞어 넘기면 node --test는 그 파일을 말없이 건너뛰고 통과로 끝난다(r3 GA3 · GA7) — 돌리기 전에 본다.
 * 자리: 시험마다 정의한 자리(사본 기준 파일:줄:칸)와 결과를 보고기로 함께 받는다 — 새 시험의 전후 대조(r4 GA8). 자리 수가 시험 + 묶음 수와 같아야 믿는다.
 */
function 시험돌리기({ 사본, 파일들, env, 한도ms = 15 * 60000, 자리 = false }) {
  const 시작 = Date.now();
  const 없는파일 = (파일들 || []).filter((p) => !파일인가(사본, p));
  if (!(파일들 || []).length || 없는파일.length) {
    return { 통과함: false, 없는파일, 종료: null, 시간넘김: false, 시험: null, 통과: null, 실패: null, 취소: null, 건너뜀: 0, 할일: 0, 묶음: null,
      실패이름: [], 자리들: [], 자리겹침: false, 자리밖: false, 파일째: false, 빈파일: [], 자리건너뜀: false, 자리취소: false, 자리셈맞음: false, 초: 0 };
  }
  const 자리방 = 자리 ? fs.mkdtempSync(path.join(os.tmpdir(), 'synk-alertfix-')) : null;
  const 자리파일 = 자리방 ? path.join(자리방, '자리.jsonl') : null;
  const 보고 = 자리파일 ? ['--test-reporter=tap', '--test-reporter-destination=stdout', `--test-reporter=${자리보고기}`, `--test-reporter-destination=${자리파일}`] : ['--test-reporter=tap'];
  let r, 자리글 = '';
  try {
    r = spawnSync(process.execPath, ['--test', ...보고, ...파일들], { cwd: 사본, env, encoding: 'utf8', windowsHide: true, timeout: 한도ms, maxBuffer: 64 << 20 });
    if (자리파일) { try { 자리글 = fs.readFileSync(자리파일, 'utf8'); } catch { 자리글 = ''; } }
  } finally { if (자리방) fs.rmSync(자리방, { recursive: true, force: true }); }
  const 셈 = (k) => { const m = new RegExp(`^# ${k} (\\d+)\\s*$`, 'm').exec(r.stdout || ''); return m ? Number(m[1]) : null; };
  const 시험 = 셈('tests'), 통과 = 셈('pass'), 실패 = 셈('fail'), 취소 = 셈('cancelled'), 건너뜀 = 셈('skipped') || 0, 할일 = 셈('todo') || 0, 묶음 = 셈('suites') || 0;
  const 시간넘김 = r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM';
  const 실패이름 = (r.stdout || '').split(/\r?\n/).map((l) => /^\s*not ok \d+ - (.+)$/.exec(l)?.[1]).filter(Boolean).slice(0, 8).map((s) => s.trim().slice(0, 120));
  const 자리들 = [];
  for (const 줄 of 자리글.split(/\r?\n/)) {
    if (!줄.trim()) continue;
    let x;
    try { x = JSON.parse(줄); } catch { x = null; }
    const 상대 = x && typeof x.파일 === 'string' ? path.relative(사본, x.파일).replace(/\\/g, '/') : '';
    자리들.push({ 자리: 상대 && Number.isSafeInteger(x.줄) && Number.isSafeInteger(x.칸) ? `${상대}:${x.줄}:${x.칸}` : '', 결과: x?.결과 || '', 깊이: x?.깊이 ?? null,
      이름: String(x?.이름 ?? ''), 종류: x?.종류 ?? null, 건너뜀: Boolean(x?.건너뜀), 할일: Boolean(x?.할일), 실패종류: x?.실패종류 ?? null });
  }
  // 몸통이 돌다 실패한 것만 실패로 믿는다 — before 훅이 깨지면 그 아래 시험은 몸통 없이 「취소」로 찍히고, 묶음은 hookFailed로 찍힌다(11-26 실측, r8 GA4).
  // 시간 넘김도 TAP에서는 취소로 센다. 취소가 하나라도 있는 판은 자리를 믿지 않는다.
  const 몸통실패 = new Set(['testCodeFailure', 'subtestsFailed']);
  const 자리취소 = (취소 ?? 0) > 0 || 자리들.some((x) => x.결과 === '실패' && !몸통실패.has(x.실패종류));
  const 이름표 = 자리들.map((x) => x.자리);
  // 줄 · 칸 없는 사건은 겹침으로, 넘긴 파일 밖에서 찍힌 시험은 자리밖으로 본다 — 둘 다 자리를 믿지 않는다(Fable v4.2 P2-1).
  const 넘긴 = new Set((파일들 || []).map((p) => String(p).replace(/\\/g, '/')));
  const 경로만 = (자) => 자.replace(/:\d+:\d+$/, '');
  // 파일째 결과: test(…)로 등록한 시험이 없거나 맨 위에서 던진 파일은 그 파일 경로를 이름으로 한 결과 하나(1:1)로 찍힌다(11-26 실측).
  // 등록한 시험이 돈 것이 아니라 파일 맨 위의 코드가 돈 것이라 자리를 믿지 않는다(r5 GA1 · GA5). 이름이 파일 경로인 진짜 시험은 1:1이 아니다(r6 GA1).
  const 파일이름인가 = (x) => 넘긴.has(x.이름.replace(/\\/g, '/')) || 넘긴.has(path.relative(사본, path.resolve(사본, x.이름)).replace(/\\/g, '/'));
  const 파일째 = 자리들.some((x) => x.깊이 === 0 && 파일이름인가(x) && x.자리 === `${경로만(x.자리)}:1:1` && 넘긴.has(경로만(x.자리)));
  // 넘긴 새 시험 파일마다 등록한 시험(묶음 말고)이 하나 넘게 돌아야 한다 — 빈 describe만 둔 파일도 믿지 않는다(r6 GA3)
  const 빈파일 = [...넘긴].filter((f) => !자리들.some((x) => x.종류 === 'test' && 경로만(x.자리) === f));
  return { 통과함: !시간넘김 && r.status === 0 && 시험 > 0 && 실패 === 0 && 취소 === 0 && 건너뜀 === 0 && 할일 === 0,
    없는파일: [], 종료: r.status, 시간넘김, 시험, 통과, 실패, 취소, 건너뜀, 할일, 묶음, 실패이름,
    // 건너뛰거나 할 일로 둔 시험은 돌지 않은 것이다 — 그 판의 자리를 믿지 않는다(r7 GA2)
    자리들, 자리겹침: new Set(이름표).size !== 이름표.length || 이름표.includes(''), 자리밖: 이름표.some((x) => x && !넘긴.has(경로만(x))), 파일째, 빈파일,
    자리건너뜀: 자리들.some((x) => x.건너뜀 || x.할일), 자리취소,
    자리셈맞음: Boolean(자리) && 시험 !== null && 자리들.length === 시험 + 묶음, 초: Math.round((Date.now() - 시작) / 1000) };
}

/**
 * 두 판에서 돈 새 시험이 같은 자리들인가 — 자리가 겹치지 않고(반복 · 도우미로 만든 시험 막기), 넘긴 새 시험 파일 안이고,
 * 자리 묶음이 같아야 한다(조건 · 변수 이름 · 별칭으로 전후에 다른 시험 막기). 같은 자리의 몸통이 안에서 갈리는 것은 GPT 검수가 본다(설계 v4.2 한계 1).
 */
function 자리같나(가, 나) {
  const 자리 = (x) => (x?.자리들 || []).map((y) => y.자리).sort();
  const 믿음 = (x) => Boolean(x?.자리셈맞음) && !x.자리겹침 && !x.자리밖 && !x.파일째 && !x.자리건너뜀 && !x.자리취소 && !(x.빈파일 || []).length
    && (x.자리들 || []).length > 0;
  return 믿음(가) && 믿음(나) && JSON.stringify(자리(가)) === JSON.stringify(자리(나));
}

/**
 * 실행 설정 지문 — 사본의 지금 원천을 자식 프로세스(주어진 환경)에서 불러 작업 머리 · 인자 · 지시문을 JSON으로 낸다.
 * 바탕 판과 고친 판에서 한 번씩 재어 견준다. → { 글 } 또는 { 오류 }
 */
function 지문재기({ 사본, 종류, env, 한도ms = 120000 }) {
  const 설정 = 종류?.지문;
  if (!설정) return { 글: '' };
  const 글귀 = `const 작업 = require(process.argv[1]);
const 뽑 = (f) => { try { return f(); } catch (e) { return '오류: ' + String(e && e.message || e).slice(0, 200); } };
const 머리 = {}; for (const k of ['설명', '모델', '노력', '비용상한USD', '시간제한', '잠금시간', '구독대체']) 머리[k] = 작업[k] === undefined ? null : 작업[k];
const 자료 = JSON.parse(process.argv[2]), ctx = JSON.parse(process.argv[3]);
process.stdout.write(JSON.stringify({ 머리,
  인자: [true, false].map((크레딧) => 뽑(() => typeof 작업.인자 === 'function' ? 작업.인자({ 크레딧 }) : null)),
  지시문: 뽑(() => typeof 작업.지시문 === 'function' ? 작업.지시문(자료, ctx) : null),
  함수: Object.keys(작업).filter((k) => typeof 작업[k] === 'function').sort() }));`;
  const r = spawnSync(process.execPath, ['-e', 글귀, path.join(사본, 설정.파일), JSON.stringify(설정.자료 || {}), JSON.stringify(설정.ctx || {})],
    { cwd: 사본, env, encoding: 'utf8', windowsHide: true, timeout: 한도ms, maxBuffer: 16 << 20 });
  if (r.status !== 0 || !r.stdout) return { 오류: `지문을 재지 못했다(종료 ${r.status ?? r.error?.code}) ${String(r.stderr || '').trim().split(/\r?\n/).slice(-1)[0] || ''}`.slice(0, 300) };
  return { 글: r.stdout };
}

/** 원천만 바탕 판으로 되돌린다(새 시험은 둔다) — 「고치기 전」을 재는 자리. 끝나면 후입히기로 고친 판을 되돌려 놓는다. */
function 원천되돌리기(사본, 바탕, 경로들) { git(사본, ['checkout', 바탕, '--', ...경로들]); }
function 후입히기(사본, blob, 경로들) {
  for (const p of 경로들) fs.writeFileSync(path.join(사본, p), blob읽기(사본, blob[p]));
}

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

module.exports = { 종류표, 한도, git, diff읽기, 바뀐것, 구간찾기, 닿나, 관문, blob들, blob읽기, 환경, 올리기환경, 파일인가, 시험돌리기, 자리같나, 지문재기, 원천되돌리기, 후입히기, sha256 };
