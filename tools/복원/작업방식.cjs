#!/usr/bin/env node
'use strict';
/**
 * 작업 방식 꾸러미 — 유호님과 AI가 쌓은 작업 방식(메모 · 설정 · 스킬 · 문서)을 비공개 GitHub에 평문으로, 한 방향으로 보낸다(2026-11-09 유호님 「이대로 만들어」).
 * 암호를 잊어도 이 층은 살아남는다. 정본은 이 노트북의 원래 자리이고, 거울(%LOCALAPPDATA%\synk\작업방식)은 고치지 않는다.
 *
 *   node tools/복원/작업방식.cjs                  고르기 → 검사 → 거울에 맞추기 → 커밋 → push → 드라이브(3시간마다, 암호묶음.py가 판단) → 열쇠 확인 → 영수증
 *   node tools/복원/작업방식.cjs --재기            고른 양과 빠진 까닭만 보인다(거울 · 원격을 건드리지 않는다)
 *   공통: --거울 <폴더> · --드라이브안함 · --push안함 · --json
 *
 * 평문으로 나가기 전에 두 번 거른다. 걸린 파일은 평문에서 빼고 작업방식_제외.json에 적어 암호 묶음이 대신 맡는다(값은 적지 않고 경로만).
 *   1. tools/이어하기꾸러미.js 금지인가 · textPolicy — 비밀 꼴 이름 · 비밀 서명 · 비밀 대입 · 내장 미디어 · 10MiB
 *   2. 실제 열쇠 값 대조 — 열쇠 폴더의 토큰을 뽑아 해시만 메모리에 두고, 글에 같은 토큰이 있으면 뺀다(서명 규칙이 모르는 키도 잡는다)
 * 검사한 바이트를 그대로 거울에 쓴다(검사와 복사 사이에 다른 세션이 파일을 고쳐도 검사 안 한 내용이 나가지 않는다). 예약 작업 XML · 설치 목록도 같은 검사를 받는다.
 * 줄어듦 멈춤: 관리 파일이 직전보다 20% 넘게 줄거나 필수 뿌리가 비면 커밋하지 않는다.
 * 강제 push는 없다. push가 거절되면(다른 노트북이 앞섬) 드라이브 · 열쇠도 올리지 않고 「다른PC가앞섬」 표식을 남긴다 — 되살아난 옛 노트북이 새 쪽을 덮지 못한다.
 * 시험: node --test tests/작업방식.test.cjs
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const 코드 = __dirname;
const 원격 = 'git@github.com:unmet23-lab/synk-memory.git';
const 줄어듦한도 = 0.2;
const 설치목록주기ms = 20 * 3600 * 1000;
const 큰파일 = 10 << 20;
// 평문 GitHub에 그대로 두면 안 되는 서명을 textPolicy에 더한다(구글 토큰 · 허깅페이스 · 슈파베이스 · 클로드 키 등).
const 더한서명 = /\bya29\.[\w-]{20,}|\b1\/\/0[\w-]{30,}|\bGOCSPX-[\w-]{20,}|\bhf_[A-Za-z]{30,}|\bsbp_[a-f0-9]{30,}|\bsk-ant-[\w-]{20,}|\bsk_[a-z0-9]{30,}|\bAKID[A-Za-z0-9]{13,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const 그림글꼴 = /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|pdf|wasm|mp3|wav|ogg|m4a)$/i;
const 안올림이름 = /(?:^|[\\/])(?:\.credentials\.json|auth\.json|.*\.(?:log|lock|pid|sqlite|sqlite-wal|sqlite-shm|db|bin|tmp|bak|zip))$|\.bak-[^\\/]+$/i;

function 인자(argv) {
  const 값 = { 거울: null, 재기: false, 드라이브안함: false, push안함: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--거울') 값.거울 = argv[++i];
    else if (a === '--재기') 값.재기 = true;
    else if (a === '--드라이브안함') 값.드라이브안함 = true;
    else if (a === '--push안함') 값.push안함 = true;
    else if (a === '--json') 값.json = true;
    else throw new Error(`모르는 인자: ${a}`);
  }
  return 값;
}

function 집자리(env = process.env) {
  const 집 = env.SYNK_복원_집 || os.homedir();
  return { 집, 문서: path.join(집, 'Documents'), 창고: path.join(집, 'Documents', 'SYNK_원본창고'), 상태: path.join(집, 'Documents', 'SYNK_원본창고', '상태', '복원꾸러미') };
}

/**
 * 고를 범위. 줄마다 { 곳: 거울 안 자리, 뿌리, 고름(상대경로) → true, 안봄(폴더 이름 집합), 검사: 'md'|'설정'|'보관함', 필수 }.
 * 문서는 md만(소스는 git이 맡는다), 설정 폴더는 글 파일과 작은 그림만.
 */
function 범위표(자리) {
  const { 집, 문서, 창고 } = 자리;
  const md = (rel) => /\.md$/i.test(rel);
  const 저장소안봄 = new Set(['node_modules', '.git', '.tmp', 'worktrees', 'output', 'artifacts', 'dist', 'build', 'builds', '.expo', '.next', 'coverage', '__pycache__', '.venv', 'venv', '.cache', 'public-site']);
  const 표 = [
    { 곳: 'claude', 뿌리: path.join(집, '.claude'), 고름: (r) => ['CLAUDE.md', 'settings.json', 'keybindings.json'].includes(r) || /^(?:skills|scheduled-tasks|plans|agents|commands)\//.test(r) || /^plugins\/(?:known_marketplaces|installed_plugins)\.json$/.test(r),
      안봄: new Set(['synced', '.trash', 'node_modules', '__pycache__', '.venv', 'cache', 'projects', 'file-history', 'shell-snapshots', 'sessions', 'session-env', 'telemetry', 'downloads', 'backups', 'daemon', 'spares', 'marketplaces', 'store', 'scheduled-tasks-orphans-20261017']), 검사: '설정', 필수: true },
    { 곳: 'codex', 뿌리: path.join(집, '.codex'), 고름: (r) => ['AGENTS.md', 'hooks.json', 'keybindings.json', 'config.toml'].includes(r) || /^(?:rules|skills|memories|memories_v2|automations)\//.test(r),
      안봄: new Set(['worktrees', 'generated_images', 'sessions', 'archived_sessions', 'plugins', 'vendor_imports', 'logs', 'tmp', '.tmp', 'cache', 'artifact-backups', 'visualizations', 'scratch', 'sqlite', 'secrets', '.sandbox', '.sandbox-bin', '.sandbox-secrets', 'runtime']), 검사: '설정' },
    { 곳: 'agents', 뿌리: path.join(집, '.agents'), 고름: (r) => /^skills\//.test(r), 안봄: new Set(['node_modules', '__pycache__', '.venv']), 검사: '설정' },
    { 곳: 'ai-accounts', 뿌리: path.join(집, '.ai-accounts'), 고름: (r) => /^[^/]+\.(?:mjs|ps1|json)$/.test(r) && !/\.bak|account-hook\.log/.test(r),
      안봄: new Set(['board', 'claude-session-backups', 'claude-unmet23', 'codex-synk.yuh', 'higgsfield-founder', 'higgsfield-unmet23', 'typecast-unmet23']), 검사: '설정' },
    { 곳: '창고도구', 뿌리: 창고, 고름: (r) => /^[^/]+\.(?:py|js|cjs|mjs|ps1|md|txt)$/.test(r) && !/\.bak/.test(r) || r === 'backup-health-config.json' || r === 'backup-monitor-config.json',
      안봄: 'all-dirs', 검사: '설정', 필수: true },
    { 곳: '창고도구/PC_백업_20261003', 뿌리: path.join(문서, 'PC_백업_20261003'), 고름: (r) => /^(?:media-upload|media-backup|되살리기|make-manifest)\.py$|^README\.md$/.test(r), 안봄: 'all-dirs', 검사: '설정' },
    { 곳: '문서/SYNK-appsscript', 뿌리: path.join(문서, 'SYNK-appsscript'), 고름: md, 안봄: 저장소안봄, 검사: 'md', 필수: true },
    { 곳: '문서/SYNK-appsscript-설정', 뿌리: path.join(문서, 'SYNK-appsscript'), 고름: (r) => /^\.claude\/(?:skills|agents|commands)\//.test(r) || r === '.claude/settings.json', 안봄: new Set(['node_modules', 'worktrees', '__pycache__', '.git', '.tmp', 'output', 'artifacts']), 검사: '설정' },
    { 곳: '문서/SYNK-talk', 뿌리: path.join(문서, 'SYNK-talk'), 고름: md, 안봄: 저장소안봄, 검사: 'md' },
    { 곳: '문서/SYNK-website', 뿌리: path.join(문서, 'SYNK-website'), 고름: md, 안봄: 저장소안봄, 검사: 'md' },
    { 곳: '문서/synk-tips', 뿌리: path.join(문서, 'synk-tips'), 고름: md, 안봄: 저장소안봄, 검사: 'md' },
    { 곳: '문서/claude-session-share', 뿌리: path.join(문서, 'claude-session-share'), 고름: md, 안봄: 저장소안봄, 검사: 'md' },
    { 곳: '문서/SYNK-LoRA', 뿌리: path.parse(문서).root ? path.join(path.parse(문서).root, 'SYNK-LoRA') : '', 고름: md, 안봄: new Set(['models', 'hf-cache', 'ai-toolkit', 'ComfyUI', 'src', '.venv', 'node_modules', 'weights', 'sam3', 'sam2.1-hiera-large', 'clip_dfn5b', 'model', 'output', 'outputs']), 검사: 'md', 링크풀기: true },
    { 곳: '문서/Videos', 뿌리: path.join(집, 'Videos'), 고름: md, 안봄: new Set(['node_modules', 'CacheClip', '.gallery']), 검사: 'md' },
  ];
  // 메모는 프로젝트마다 따로다. 폴더 이름이 저장소 경로에서 나오므로 이름 그대로 거울에 둔다(옆의 memory_보관_*.zip은 평문에 안 올린다 — 대화 기록 묶음이 맡는다).
  const 프로젝트 = path.join(집, '.claude', 'projects');
  let 줄 = [];
  try { 줄 = fs.readdirSync(프로젝트, { withFileTypes: true }); } catch {}
  for (const e of 줄) {
    if (!e.isDirectory()) continue;
    const 메모 = path.join(프로젝트, e.name, 'memory');
    let st;
    try { st = fs.lstatSync(메모); } catch { continue; }
    if (!st.isDirectory()) continue;
    표.push({ 곳: `메모/${e.name}`, 뿌리: 메모, 고름: () => true, 안봄: new Set(['node_modules', '.git']), 검사: '설정', 필수: e.name === 'C--Users-q1212-Documents-SYNK-appsscript' });
  }
  return 표;
}

function 링크인가(st) { return st.isSymbolicLink(); }

/** 폴더를 걸어 (상대 경로, 절대 경로, 통계)를 준다. junction · 심볼릭 링크는 따라가지 않는다. */
function* 걷기(뿌리, 안봄) {
  const 더미 = [[뿌리, '']];
  while (더미.length) {
    const [여기, 상대] = 더미.pop();
    let 줄;
    try { 줄 = fs.readdirSync(여기, { withFileTypes: true }); } catch { continue; }
    for (const e of 줄) {
      const 절대 = path.join(여기, e.name), rel = 상대 ? `${상대}/${e.name}` : e.name;
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (안봄 === 'all-dirs' || (안봄 && 안봄.has(e.name))) continue;
        더미.push([절대, rel]);
      } else if (e.isFile()) {
        let st;
        try { st = fs.lstatSync(절대); } catch { continue; }
        if (링크인가(st)) continue;
        yield { rel, 절대, 크기: st.size, 수정: st.mtimeMs };
      }
    }
  }
}

/** 실제 열쇠 값의 해시 모음. 값 자체는 어디에도 남기지 않고 프로세스 안에만 둔다. */
function 열쇠토큰모음(자리) {
  const { 집, 문서 } = 자리;
  // 서버 드라이브 폴더의 목록 · 영수증(.manifest · proof)은 뺀다 — 해시 · 알고리즘 이름이 문서에도 나와 오탐만 낸다(11-09 재기에서 암호.js · README가 걸렸다).
  const 뿌리들 = [path.join(집, 'SYNK_보안'), path.join(집, '.clasprc.json'), path.join(집, '.synk-drive-77yuhbs', '.clasprc.json'),
    path.join(집, '.codex', 'auth.json'), path.join(집, '.synk-vertex-oauth.json'), path.join(집, '.synk-vertex-oauth.77yuhbs.json'), path.join(집, '.grok', 'auth.json'),
    path.join(문서, 'SYNK-talk', '.env'), path.join(집, '.synk-backup-key', 'talk-pgpass.conf')];
  const 모음 = new Set();
  const 지문 = crypto.createHash('sha256');
  const 읽기 = (f, 크기) => {
    if (크기 > 2 << 20) return;
    let 글;
    try { 글 = fs.readFileSync(f, 'utf8'); } catch { return; }
    지문.update(crypto.createHash('sha256').update(글).digest());
    for (const m of 글.matchAll(토큰꼴)) {
      if (열쇠토큰인가(m[0])) 모음.add(토큰해시(m[0]));
    }
  };
  for (const 뿌리 of 뿌리들) {
    let st;
    try { st = fs.lstatSync(뿌리); } catch { continue; }
    if (st.isFile()) 읽기(뿌리, st.size);
    else if (st.isDirectory()) {
      for (const f of 걷기(뿌리, new Set(['내부문서_보존_20261020', 'node_modules']))) {
        if (/\.(?:jsonl|md|enc|bin)$|manifest/i.test(f.rel)) continue; // 사용 기록 · 안내 글 · 암호문은 키가 아니다(오탐만 는다)
        읽기(f.절대, f.크기);
      }
    }
  }
  return { 모음, 지문: 지문.digest('hex') };
}

const 토큰꼴 = /[A-Za-z0-9_\-.~+/=]{24,}/g;
function 토큰해시(t) { return crypto.createHash('sha256').update(t).digest('hex').slice(0, 32); }
/** 경로 · 시각 · 긴 낱말 조각은 열쇠가 아니다. 숫자와 영문이 섞인 값만 본다(오탐으로 멀쩡한 글이 평문에서 빠지지 않게). */
function 열쇠토큰인가(t) {
  if (/^\/|\/Users\/|\.(?:json|md|txt|js|py|png|html?)$/i.test(t)) return false;
  if ((t.match(/\//g) || []).length > 3) return false;
  if (!/[0-9]/.test(t) || !/[A-Za-z]/.test(t)) return false;
  // 구글 클라이언트 ID처럼 공개 값은 빼지 않는다
  if (/\.apps\.googleusercontent\.com$/.test(t) || /^[0-9]+-[a-z0-9]+$/.test(t)) return false;
  return true;
}

function 열쇠값이들었나(글, 모음) {
  if (!모음 || !모음.size) return false;
  for (const m of 글.matchAll(토큰꼴)) {
    if (열쇠토큰인가(m[0]) && 모음.has(토큰해시(m[0]))) return true;
  }
  return false;
}

/** 한 파일의 판정. null이면 평문으로 내보낸다. 그 밖에는 { 까닭, 갈곳 }. */
function 판정(줄, 파일, 도구, 모음, 받은데이터) {
  const { rel, 절대, 크기 } = 파일;
  const 경로 = `${줄.곳}/${rel}`;
  if (안올림이름.test(rel)) return { 까닭: 'not-for-plain', 갈곳: '' };
  if (도구.금지인가(rel) || 도구.금지인가(경로)) return { 까닭: 'credential-path', 갈곳: '열쇠' };
  if ((받은데이터 ? 받은데이터.length : 크기) > 큰파일) return { 까닭: 'over-10MiB', 갈곳: '작업기록' };
  let 데이터 = 받은데이터;
  if (!데이터) { try { 데이터 = fs.readFileSync(절대); } catch { return { 까닭: 'unreadable', 갈곳: '' }; } }
  if (줄.검사 === '설정' && 그림글꼴.test(rel)) return null;
  if (줄.검사 === '설정' && !도구.문서인가(rel) && !/\.(?:json|toml)$/i.test(rel)) return { 까닭: 'not-text', 갈곳: '' };
  const 원본검사경로 = 줄.곳.startsWith('문서/SYNK-appsscript') ? rel : 경로;
  const 정책 = 도구.textPolicy(원본검사경로.replace(/(^|\/)(worktrees)(\/|$)/, '$1wt$3'), 데이터);
  if (정책 === 'secret-signature' || 정책 === 'secret-literal' || 정책 === 'credential-path') return { 까닭: 정책, 갈곳: '열쇠' };
  if (정책 === 'embedded-media-or-base64' || 정책 === 'over-10MiB' || 정책 === 'binary-control-bytes' || 정책 === 'not-utf8-text') {
    if (줄.검사 === '설정') return { 까닭: 정책, 갈곳: '' };
    return { 까닭: 정책, 갈곳: '작업기록' };
  }
  // generated-or-excluded-path · non-text-extension은 설정 폴더의 정상 파일에서도 나온다 — 아래 서명 검사로 갈음한다.
  const 글 = 데이터.toString('utf8');
  if (더한서명.test(글)) return { 까닭: 'secret-signature', 갈곳: '열쇠' };
  if (열쇠값이들었나(글, 모음)) return { 까닭: 'known-secret-value', 갈곳: '열쇠' };
  return null;
}

function 캐시읽기(파일) { try { return JSON.parse(fs.readFileSync(파일, 'utf8')); } catch { return {}; } }
function 쓰기(파일, 값) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  const 임시 = `${파일}.${process.pid}.tmp`;
  fs.writeFileSync(임시, JSON.stringify(값, null, 1));
  fs.renameSync(임시, 파일);
}

/** 범위를 걸어 내보낼 목록과 뺀 목록을 만든다. 크기 · 수정 시각이 같고 정책이 같으면 다시 읽지 않는다. */
function 고르기(자리, 도구, 표, 옛캐시, 모음지문, 모음) {
  const 내보냄 = new Map(), 뺌 = [], 빈필수 = [], 새캐시 = {};
  const 판 = `${도구.POLICY_FINGERPRINT || ''}|${모음지문}`;
  const 같은판 = 옛캐시.판 === 판;
  for (const 줄 of 표) {
    if (!줄.뿌리 || !fs.existsSync(줄.뿌리)) { if (줄.필수) 빈필수.push(줄.곳); continue; }
    let 뿌리 = 줄.뿌리;
    if (줄.링크풀기) { try { 뿌리 = fs.realpathSync.native(뿌리); } catch { continue; } }
    let 수 = 0;
    for (const f of 걷기(뿌리, 줄.안봄)) {
      if (!줄.고름(f.rel)) continue;
      const 거울경로 = `${줄.곳}/${f.rel}`;
      const 옛 = 같은판 && 옛캐시.파일 && 옛캐시.파일[거울경로];
      let 결과;
      if (옛 && 옛.크기 === f.크기 && 옛.수정 === f.수정) 결과 = 옛.결과;
      else 결과 = 판정(줄, f, 도구, 모음);
      새캐시[거울경로] = { 크기: f.크기, 수정: f.수정, 결과 };
      if (결과) { if (결과.갈곳) 뺌.push({ 경로: 거울경로, source: f.절대, 까닭: 결과.까닭, 갈곳: 결과.갈곳 }); continue; }
      내보냄.set(거울경로, { ...f, 줄 });
      수++;
    }
    if (줄.필수 && !수) 빈필수.push(줄.곳);
  }
  return { 내보냄, 뺌, 빈필수, 새캐시: { 판, 파일: 새캐시 } };
}

function git(거울, args, 옵션 = {}) {
  return execFileSync('git', ['-C', 거울, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, ...옵션 });
}

function 거울준비(거울, 원격주소, 받기 = true) {
  if (fs.existsSync(path.join(거울, '.git'))) return false;
  fs.mkdirSync(path.dirname(거울), { recursive: true });
  if (받기) execFileSync('git', ['clone', '--quiet', 원격주소, 거울], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  else {
    fs.mkdirSync(거울, { recursive: true });
    execFileSync('git', ['init', '--quiet', '-b', 'master', 거울], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    git(거울, ['remote', 'add', 'origin', 원격주소]);
  }
  for (const [k, v] of [['core.autocrlf', 'false'], ['core.safecrlf', 'false'], ['core.longpaths', 'true'], ['core.quotepath', 'false'], ['user.name', 'SYNK 복원'], ['user.email', 'noreply@synk.im'], ['commit.gpgsign', 'false'], ['gc.auto', '200']]) {
    git(거울, ['config', k, v]);
  }
  return true;
}

/** 거울의 관리 파일 목록(.git과 맨 위 안내 · 복원 파일 빼고 전부 관리 대상). */
function 거울파일들(거울) {
  const 모음 = new Set();
  const 더미 = [['', 거울]];
  while (더미.length) {
    const [상대, 여기] = 더미.pop();
    for (const e of fs.readdirSync(여기, { withFileTypes: true })) {
      if (!상대 && e.name === '.git') continue;
      const rel = 상대 ? `${상대}/${e.name}` : e.name;
      if (e.isDirectory()) 더미.push([rel, path.join(여기, e.name)]);
      else 모음.add(rel);
    }
  }
  return 모음;
}

/**
 * 거울을 내보낼 목록에 맞춘다. 복사 · 지우기 수와 쓰기 직전 검사에 걸린 줄을 돌려준다.
 * 읽은 바이트를 그 자리에서 다시 검사하고 그 바이트만 쓴다 — 고르기와 복사 사이에 다른 세션이 파일에 비밀을 넣어도 나가지 않는다.
 */
function 맞추기(거울, 내보냄, 덧붙임, 검사 = () => null) {
  let 복사 = 0, 지움 = 0;
  const 걸림 = [];
  const 있던것 = 거울파일들(거울);
  for (const [경로, f] of [...내보냄]) {
    const 곳 = path.join(거울, ...경로.split('/'));
    let 같음 = false;
    try {
      const st = fs.statSync(곳);
      같음 = st.size === f.크기 && Math.abs(st.mtimeMs - f.수정) < 2;
    } catch {}
    if (같음) continue;
    let 데이터;
    try { 데이터 = fs.readFileSync(f.절대); } catch { 내보냄.delete(경로); continue; }
    const 결과 = 검사(f, 데이터);
    if (결과) {
      내보냄.delete(경로);
      if (결과.갈곳) 걸림.push({ 경로, source: f.절대, 까닭: 결과.까닭, 갈곳: 결과.갈곳 });
      continue;
    }
    fs.mkdirSync(path.dirname(곳), { recursive: true });
    fs.writeFileSync(곳, 데이터);
    const t = new Date(f.수정);
    try { fs.utimesSync(곳, t, t); } catch {}
    복사++;
  }
  for (const [경로, 내용] of 덧붙임) {
    const 곳 = path.join(거울, ...경로.split('/'));
    let 같음 = false;
    try { 같음 = fs.readFileSync(곳).equals(Buffer.from(내용)); } catch {}
    if (!같음) {
      fs.mkdirSync(path.dirname(곳), { recursive: true });
      fs.writeFileSync(곳, 내용);
      복사++;
    }
  }
  const 남길 = new Set([...내보냄.keys(), ...덧붙임.keys()]);
  for (const 경로 of 있던것) {
    if (남길.has(경로)) continue;
    fs.rmSync(path.join(거울, ...경로.split('/')), { force: true });
    지움++;
  }
  // 빈 폴더 정리(git에는 어차피 안 남지만 다음 비교를 빠르게 한다)
  const 비우기 = (폴더) => {
    for (const e of fs.readdirSync(폴더, { withFileTypes: true })) {
      if (e.isDirectory() && e.name !== '.git') {
        const p = path.join(폴더, e.name);
        비우기(p);
        if (!fs.readdirSync(p).length) fs.rmdirSync(p);
      }
    }
  };
  비우기(거울);
  return { 복사, 지움, 걸림 };
}

/** 예약 작업 XML · 설치 목록 · 연결 목록. 하루에 한 번 만든다(거울의 기록을 그대로 두면 변경 없음으로 본다). */
function 윈도우기록(거울, 자리, 지금, 상태파일, 돌림 = spawnSync) {
  const 상태 = 캐시읽기(상태파일);
  const 덧 = new Map();
  const 옛것 = (rel) => { try { 덧.set(rel, fs.readFileSync(path.join(거울, ...rel.split('/')))); } catch {} };
  if (상태.at && 지금 - 상태.at < 설치목록주기ms) {
    for (const rel of 상태.files || []) 옛것(rel);
    return 덧;
  }
  const 실행 = (cmd, args, timeout = 180000) => {
    const r = 돌림(cmd, args, { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 32 << 20 });
    return r.status === 0 ? String(r.stdout || '') : null;
  };
  const 예약 = 실행('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); Get-ScheduledTask | Where-Object { $_.TaskName -match "SYNK|Hermes|hermes|헤르메스" } | ForEach-Object { $x = Export-ScheduledTask -TaskName $_.TaskName -TaskPath $_.TaskPath; [pscustomobject]@{ 이름=$_.TaskName; 상태=[string]$_.State; xml=$x } } | ConvertTo-Json -Depth 3 -Compress']);
  if (예약) {
    let 줄 = [];
    try { 줄 = JSON.parse(예약.replace(/^\uFEFF/, '')); } catch {}
    for (const t of Array.isArray(줄) ? 줄 : [줄]) {
      if (!t || !t.이름 || !t.xml) continue;
      덧.set(`윈도우/예약작업/${t.이름.replace(/[\\/:*?"<>|]/g, '_')}.xml`, t.xml);
    }
    덧.set('윈도우/예약작업/목록.json', JSON.stringify((Array.isArray(줄) ? 줄 : [줄]).filter(Boolean).map((t) => ({ 이름: t.이름, 상태: t.상태 })), null, 1));
  }
  const 임시 = path.join(os.tmpdir(), `synk-winget-${process.pid}.json`);
  if (실행('winget', ['export', '-o', 임시, '--accept-source-agreements', '--disable-interactivity'], 240000) !== null || fs.existsSync(임시)) {
    try { 덧.set('윈도우/winget.json', fs.readFileSync(임시, 'utf8')); } catch {}
    fs.rmSync(임시, { force: true });
  }
  const npm = process.platform === 'win32' ? 실행('cmd.exe', ['/c', 'npm', 'ls', '-g', '--depth=0', '--json']) : 실행('npm', ['ls', '-g', '--depth=0', '--json']);
  if (npm) 덧.set('윈도우/npm-global.json', npm);
  const pip = 실행('python', ['-m', 'pip', 'freeze']);
  if (pip) 덧.set('윈도우/pip.txt', pip);
  const 연결 = 실행('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $roots=@($env:USERPROFILE, (Join-Path $env:USERPROFILE 'Documents'), (Join-Path $env:USERPROFILE '.cache'), (Join-Path $env:USERPROFILE '.claude\\skills'), 'C:\\'); $rows=foreach($r in $roots){ Get-ChildItem -LiteralPath $r -Force -ErrorAction SilentlyContinue | Where-Object { $_.LinkType -in 'Junction','SymbolicLink' -and $_.Name -notin 'Documents and Settings','My Music','My Pictures','My Videos' } | ForEach-Object { [pscustomobject]@{ 자리=$_.FullName; 대상=($_.Target -join ';'); 종류=[string]$_.LinkType } } }; ConvertTo-Json -InputObject @($rows) -Compress`]);
  if (연결) 덧.set('윈도우/연결목록.json', 연결.replace(/^\uFEFF/, ''));
  쓰기(상태파일, { at: 지금, files: [...덧.keys()] });
  return 덧;
}

/** 복원 입구 파일을 거울 맨 위에 둔다(GitHub Download ZIP · 드라이브 zip을 풀자마자 더블클릭하도록). */
function 복원입구(코드뿌리) {
  const 덧 = new Map();
  for (const 이름 of ['restore.ps1', '복원풀기.cjs', '복원점검.cjs', '암호묶음.py', '드라이브.py', '암호흐름.cjs', '암호.js', '작업방식.cjs']) {
    try { 덧.set(`복원/${이름}`, fs.readFileSync(path.join(코드뿌리, 이름))); } catch {}
  }
  for (const [원본, 자리] of [['복원 시작.cmd', '복원 시작.cmd'], ['먼저 읽기.md', 'README.md']]) {
    try { 덧.set(자리, fs.readFileSync(path.join(코드뿌리, 원본))); } catch {}
  }
  return 덧;
}

function 영수증쓰기(파일, 값) { 쓰기(파일, 값); }

/** 본 흐름. 시험이 가짜 도구 · 가짜 원격을 넣을 수 있게 의존을 받는다. */
function 돌리기(옵션 = {}, 의존 = {}) {
  const 자리 = 의존.자리 || 집자리();
  const 도구 = 의존.도구 || require(path.join(코드, '..', '이어하기꾸러미.js'));
  const 거울 = 옵션.거울 || 의존.거울 || path.join(자리.집, 'AppData', 'Local', 'synk', '작업방식');
  const 원격주소 = 의존.원격 || 원격;
  const 표 = 의존.표 || 범위표(자리);
  const 지금 = Date.now();
  const 상태 = 자리.상태;
  const 영수증 = path.join(상태, '작업방식.json');
  const 옛영수증 = 캐시읽기(영수증);
  const 끝 = (status, 더) => {
    const 값 = { schemaVersion: 1, status, checkedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), lastSuccessAt: status === 'success' ? new Date().toISOString() : 옛영수증.lastSuccessAt || null, ...더 };
    if (!옵션.재기) 영수증쓰기(영수증, 값);
    return 값;
  };
  if (!옵션.재기) 쓰기(영수증, { ...옛영수증, schemaVersion: 1, status: 'running', pid: process.pid, startedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString(), issues: [] });
  const { 모음, 지문 } = 열쇠토큰모음(자리);
  const 캐시파일 = path.join(상태, '작업방식_캐시.json');
  const 옛캐시 = 캐시읽기(캐시파일);
  const { 내보냄, 뺌, 빈필수, 새캐시 } = 고르기(자리, 도구, 표, 옛캐시, 지문, 모음);
  const 뺀까닭 = {};
  for (const r of 뺌) 뺀까닭[r.까닭] = (뺀까닭[r.까닭] || 0) + 1;
  const 크기합 = [...내보냄.values()].reduce((a, f) => a + f.크기, 0);
  const 요약 = { 파일: 내보냄.size, 원문바이트: 크기합, 뺌: 뺌.length, 뺀까닭 };
  if (옵션.재기) return { status: 'dry-run', ...요약, 빈필수, 큰것: [...내보냄.entries()].sort((a, b) => b[1].크기 - a[1].크기).slice(0, 5).map(([k, f]) => `${k} ${f.크기}`), 뺀것: 뺌.map((r) => `${r.까닭} ${r.경로}`) };
  if (빈필수.length) return 끝('failed', { ...요약, issues: [{ code: 'WORKMETHOD_REQUIRED_ROOT_EMPTY' }], 빈필수 });
  const 처음 = 거울준비(거울, 원격주소, 의존.받기 !== false);
  const 기록상태 = path.join(상태, '작업방식_기록.json');
  const 기록들 = 의존.윈도우기록 ? 의존.윈도우기록(거울) : 윈도우기록(거울, 자리, 지금, 기록상태);
  // 예약 작업 XML · 설치 목록도 파일과 같은 검사를 받는다. 걸리면 평문에 안 두고 보호 폴더(열쇠 묶음이 잠가 보낸다)에 둔다.
  const 덧붙임 = new Map(복원입구(의존.코드뿌리 || 코드));
  const 보호폴더 = path.join(상태, '보호');
  for (const [경로, 내용] of 기록들) {
    const 데이터 = Buffer.from(내용);
    const 결과 = 판정({ 곳: '', 검사: 'md' }, { rel: 경로, 절대: 경로, 크기: 데이터.length }, 도구, 모음, 데이터);
    if (!결과) { 덧붙임.set(경로, 데이터); continue; }
    if (결과.갈곳) {
      const 곳 = path.join(보호폴더, ...경로.split('/'));
      fs.mkdirSync(path.dirname(곳), { recursive: true });
      fs.writeFileSync(곳, 데이터);
      뺌.push({ 경로, source: 곳, 까닭: 결과.까닭, 갈곳: '열쇠' });
    }
  }
  // 드라이브의 파일 위치(비밀 아님) — 새 노트북에서 찾는 데 쓴다
  try { 덧붙임.set('위치.json', JSON.stringify({ 원격: 원격주소, 드라이브폴더: 'SYNK_복원', 묶음: 캐시읽기(path.join(상태, '위치.json')) }, null, 1)); } catch {}
  const 직전수 = Number(옛캐시.수 || 0);
  if (!처음 && 직전수 && 내보냄.size < 직전수 * (1 - 줄어듦한도)) {
    return 끝('failed', { ...요약, issues: [{ code: 'WORKMETHOD_SHRINK_GUARD' }], 직전수 });
  }
  const 맞춤 = 맞추기(거울, 내보냄, 덧붙임, (f, 데이터) => 판정(f.줄, f, 도구, 모음, 데이터));
  for (const r of 맞춤.걸림) {
    뺌.push(r);
    if (새캐시.파일[r.경로]) 새캐시.파일[r.경로].결과 = { 까닭: r.까닭, 갈곳: r.갈곳 };
  }
  쓰기(캐시파일, { ...새캐시, 수: 내보냄.size });
  쓰기(path.join(상태, '작업방식_제외.json'), { at: new Date().toISOString(), 파일: 뺌 });
  git(거울, ['add', '-A']);
  const 바뀜 = !!git(거울, ['status', '--porcelain']).trim();
  let 커밋 = false;
  if (바뀜) {
    const 때 = new Date(지금 + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
    git(거울, ['commit', '--quiet', '-m', `auto: 작업 방식 ${때} KST`]);
    커밋 = true;
  }
  const 문제 = [];
  const 머리 = git(거울, ['rev-parse', 'HEAD']).trim();
  const 표식 = path.join(상태, '다른PC가앞섬');
  let 거절됨 = false;
  if (!옵션.push안함) {
    const r = (의존.돌림 || spawnSync)('git', ['-C', 거울, 'push', '--quiet', 'origin', 'HEAD:master'], { encoding: 'utf8', windowsHide: true, timeout: 600000 });
    거절됨 = r.status !== 0 && /non-fast-forward|rejected|fetch first/.test(String(r.stderr));
    if (r.status !== 0) 문제.push({ code: 거절됨 ? 'WORKMETHOD_PUSH_REJECTED' : 'WORKMETHOD_PUSH_FAILED' });
    // 거절 = 다른 노트북이 앞섰다. 이 PC가 옛 노트북이면 드라이브 최신판을 덮으면 안 되니 표식을 세운다(암호묶음.py가 읽는다). 고칠 때는 사람이 본다.
    if (거절됨) fs.writeFileSync(표식, new Date().toISOString());
    else if (r.status === 0) fs.rmSync(표식, { force: true });
  }
  // 드라이브는 암호묶음.py가 판단한다(판이 바뀌었고 3시간이 지났을 때, 같은 판의 재시도는 바로). 실패해도 다음 회차가 다시 한다.
  const 파이썬 = (명령) => (의존.돌림 || spawnSync)(process.env.SYNK_복원_파이썬 || 'python', ['-X', 'utf8', '-B', path.join(코드, '암호묶음.py'), 명령, ...(명령 === '작업방식' ? ['--거울', 거울] : [])], { encoding: 'utf8', windowsHide: true, timeout: 1800000 });
  let 드라이브결과 = null;
  // 통합 감시는 숨소리가 15분 끊기면 「중단」으로 본다 — 오래 걸리는 단계 앞에서 남긴다.
  const 숨소리 = () => { try { 쓰기(영수증, { ...옛영수증, schemaVersion: 1, status: 'running', pid: process.pid, startedAt: new Date(지금).toISOString(), heartbeatAt: new Date().toISOString(), issues: [] }); } catch {} };
  숨소리();
  if (!옵션.드라이브안함 && !의존.드라이브끔 && !거절됨) {
    const r = 파이썬('작업방식');
    드라이브결과 = r.status === 0 ? 'ok' : 'failed';
    if (r.status !== 0) 문제.push({ code: 'WORKMETHOD_DRIVE_FAILED' });
    const k = 파이썬('열쇠');
    if (k.status !== 0) 문제.push({ code: 'KEYS_BUNDLE_FAILED' });
  }
  return 끝(문제.length ? 'partial_failure' : 'success', { ...요약, 복사: 맞춤.복사, 지움: 맞춤.지움, 커밋, 머리, 드라이브: 드라이브결과, issues: 문제 });
}

if (require.main === module) {
  let 값;
  try {
    const 옵션 = 인자(process.argv.slice(2));
    값 = 돌리기(옵션);
    console.log(옵션.json || 옵션.재기 ? JSON.stringify(값, null, 1) : `${값.status} 파일 ${값.파일} · 뺌 ${값.뺌}${값.커밋 ? ' · 커밋' : ''}`);
    process.exitCode = ['success', 'dry-run'].includes(값.status) ? 0 : 1;
  } catch (e) {
    const 자리 = 집자리();
    const 옛 = 캐시읽기(path.join(자리.상태, '작업방식.json'));
    try { 쓰기(path.join(자리.상태, '작업방식.json'), { ...옛, schemaVersion: 1, status: 'failed', checkedAt: new Date().toISOString(), issues: [{ code: 'WORKMETHOD_RUN_FAILED' }] }); } catch {}
    console.error(`실패: ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { 범위표, 판정, 고르기, 맞추기, 돌리기, 집자리, 열쇠값이들었나, 열쇠토큰인가, 토큰해시, 거울준비, 더한서명 };
