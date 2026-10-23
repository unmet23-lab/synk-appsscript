#!/usr/bin/env node
// deploy-security-check — 배포 **표면** 불변식 검사 (구문·테스트가 못 보는 층)
//
// 2026-08-02 실사고에서 나왔다. 임시 원격 실행 러너가 `doGet`에 들어갔는데,
//   ① 인증이 소스에 박힌 고정 토큰 하나뿐이었고(같은 파일 5줄 아래에 ScriptProperties 정본 패턴이 있었다)
//   ② GET 한 번으로 deleteRow가 돌았고(링크 미리보기 봇이 URL을 fetch하면 그대로 실행된다)
//   ③ 웹앱이 ANYONE_ANONYMOUS·executeAs=USER_DEPLOYING이라 익명 호출이 소유자 권한으로 돌았다.
// 구문검사도 안전 테스트도 전부 초록이었다 — 재는 층이 달랐기 때문이다.
//
// 코드에 적힌 "끝나면 제거한다"는 **사람의 약속이지 장치가 아니다.** 그래서 장치로 옮긴다.
// 의도된 예외 절차(임시 doGet 러너 운용 중)는 CLASP_GUARD_BYPASS=1 로 의식적으로 우회한다
// — clasp-guard가 그 시점에 이 검사까지 통째로 건너뛴다(우회 레버를 늘리지 않는다).
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

/* 검사 대상 = 실제 배포되는 파일. 목록을 베끼지 않고 .claspignore에서 읽는다.
 * (clasp-guard가 08-01에 하드코딩 목록 때문에 파일 절반을 못 보던 것과 같은 함정 — [[guard-must-check-result]])
 *
 * ⚠ 2026-08-04(F061): 이 저장소에는 clasp 프로젝트가 **둘**이다(루트 · crewcard/).
 *   ROOT를 상수로 박아 두면 크루카드를 배포할 때 **메인 코드를 검사하고 크루카드 코드는
 *   한 줄도 안 본다** — 오탐(무관한 파일에 막힘)과 미탐(배포되는 코드가 검사 밖)이 동시에 났다.
 *   그래서 프로젝트 루트를 인자로 받는다. 기본값은 ROOT라 기존 호출부(/deploy·CLI)는 그대로다. */
function deployTargets(root = ROOT) {
  try {
    const pats = fs.readFileSync(path.join(root, '.claspignore'), 'utf8')
      .split(/\r?\n/).map((l) => l.trim())
      .filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim()).filter(Boolean);
    if (pats.length) return pats;
  } catch (_) {}
  return ['*.js']; // 폴백은 항상 '더 많이 검사하는' 쪽(crewcard처럼 .claspignore가 없는 프로젝트가 여기로 온다)
}
function globToRe(g) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
}
function targetJsFiles(root = ROOT) {
  const pats = deployTargets(root), res = pats.map(globToRe);
  return fs.readdirSync(root, { recursive: pats.some(p => p.includes('/')) }).map(f => f.replace(/\\/g, '/'))
    .filter(f => /\.(?:js|gs)$/.test(f) && res.some(re => re.test(f)));
}

/* 최상위 함수 단위로 자른다. Apps Script 파일은 평평해서 `function foo(` 가 항상 1열에서 시작한다.
 * 중괄호 세기보다 이쪽이 튼튼하다 — 문자열·주석·정규식 리터럴 안의 중괄호에 속지 않는다. */
function topLevelFunctions(src) {
  const out = [];
  const re = /^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  const hits = [];
  let m;
  while ((m = re.exec(src)) !== null) hits.push({ name: m[1], start: m.index });
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].start : src.length;
    out.push({ name: h.name, body: src.slice(h.start, end), line: src.slice(0, h.start).split('\n').length });
  });
  return out;
}
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/* 시크릿인가, 사람이 지은 이름인가 — 길이로는 못 가른다.
 * 실측(08-02): 길이 16자만 보게 했더니 `p.op === 'purgeTestCheckins'`(연산 이름 18자)이 걸렸다.
 * 난수 토큰은 문자 종류가 섞이고 사람이 지은 camelCase는 안 섞인다는 차이로 가른다.
 *   'Xk7Qm2Vt-9RbLpZa4wNc0HsE_JyU1oGf' → 소문자·대문자·숫자·구분자 4종 = 시크릿
 *   'purgeTestCheckins'                → 소문자·대문자 2종 = 이름
 * ⚠ 위 예시는 **합성 문자열이다.** 탐지기의 예시·픽스처에 실제로 쓰였던 토큰을 박지 않는다 —
 *   폐기된 토큰이면 무해하지만, 같은 관행이 살아 있는 토큰에 적용되는 순간 그게 사고다.
 * 대소문자 없는 hex 다이제스트는 이 규칙에 안 걸리므로 따로 태운다. */
function looksSecret(s) {
  if (/^[0-9a-f]{32,}$/i.test(s)) return true;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[-_]/].filter((re) => re.test(s)).length;
  return kinds >= 3;
}

/* `clasp deployments` 한 줄 → {id, ver, desc, temp}. 출력 형식은 "- <배포ID> @<버전> - <설명>",
 * 설명이 없는 @HEAD 줄은 뒤가 비어 있다. 파싱을 따로 뗀 이유: 임시 배포가 하나도 없으면
 * 이 경로는 통째로 안 돌아서 **깨진 채로 영원히 초록**일 수 있다(정리를 잘할수록 검증이 안 된다).
 * 그래서 라이브가 아니라 테스트가 이 판정을 지킨다. */
function parseDeploymentLine(line) {
  const m = /^-\s*(\S+)\s+@(\S+)\s*(.*)$/.exec(String(line).trim());
  if (!m) return null;
  const desc = m[3].replace(/^-\s*/, '').trim();
  return { id: m[1], ver: m[2], desc, temp: /temp|tmp|임시|runner|러너/i.test(desc) };
}

/* ── 검사를 두 갈래로 나눈 이유 (2026-08-02, 옆 세션 지적으로 재설계) ────────────────────
 * 처음엔 셋을 한 함수에 담아 clasp-guard 맨 끝에 붙였다. 그런데 clasp-guard는 맨 앞에서
 * CLASP_GUARD_BYPASS=1 이면 즉시 종료한다 — 그리고 **임시 러너는 언제나 bypass로 push한다**
 * (러너 코드가 미커밋이라 우회하지 않으면 3번 검사에 걸려 애초에 못 나간다).
 * 즉 ①고정 토큰 ②doGet 파괴 연산은 **그것들이 실제로 존재하는 유일한 경로에서 절대 발화하지 않았다.**
 * 가드가 자기가 막으려던 것만 못 보는 형태였다([[guard-must-check-result]]).
 *
 * 가르는 기준은 「끄는 게 정당한가」다.
 *   checkCode()        = **코드의 성질**. 언제 봐도 틀렸다 → bypass가 못 끈다.
 *   checkDeployments() = **순간의 성질**. 러너 도중엔 임시 배포가 있는 게 정상 → bypass가 끈다.
 * 우회 레버는 늘리지 않았다. 대신 기존 레버가 끌 수 있는 범위를 좁혔다.
 * ──────────────────────────────────────────────────────────────────────────────── */
function checkCode(root = ROOT) {
  const problems = [];
  let anon = false;
  try {
    const m = JSON.parse(fs.readFileSync(path.join(root, 'appsscript.json'), 'utf8'));
    anon = !!(m.webapp && m.webapp.access === 'ANYONE_ANONYMOUS');
  } catch (_) {}

  // 서브 프로젝트면 파일명 앞에 상대 경로를 붙인다 — 어느 프로젝트의 파일인지 안 보이면
  // 「메인 코드가 걸렸나」와 헷갈려 엉뚱한 곳을 고치게 된다.
  const rel = path.relative(ROOT, root).replace(/\\/g, '/');
  const label = (f) => (rel ? `${rel}/${f}` : f);

  for (const f of targetJsFiles(root)) {
    let src;
    try { src = fs.readFileSync(path.join(root, f), 'utf8'); } catch (_) { continue; }

    /* 1) 소스에 박힌 고정 인증 토큰.
     *    조준은 '긴 문자열'이 아니라 **비교**다 — `const SHEET_ID = '1Ze_…'` 같은 대입 상수는
     *    잡지 않고, 외부에서 들어온 값을 상수와 대조하는 `p.key === '…'` 만 잡는다.
     *    이 구분이 없으면 시트 ID·배포 ID가 전부 걸려 가드가 노이즈가 된다. */
    const tok = /\.\w+\s*===?\s*(['"])([A-Za-z0-9_\-]{16,})\1/g;
    let t;
    while ((t = tok.exec(src)) !== null) {
      if (!looksSecret(t[2])) continue; // 연산 이름 등 사람이 지은 식별자는 통과
      problems.push(
        `${label(f)}:${lineOf(src, t.index)} 소스에 박힌 고정 토큰으로 인증(…${t[2].slice(-6)})` +
        (anon ? ' — 웹앱이 ANYONE_ANONYMOUS라 이 문자열 하나가 유일한 방어선이다' : '') +
        ' → PropertiesService.getScriptProperties() 로 옮길 것'
      );
    }

    /* 2) GET에 부작용. doGet은 링크 미리보기 봇·브라우저 prefetch·크롤러가 임의로 부른다 —
     *    공격자가 없어도 URL을 채팅에 붙여넣는 것만으로 실행된다. doPost는 대상 아님(쓰기가 정상). */
    for (const fn of topLevelFunctions(src)) {
      if (fn.name !== 'doGet') continue;
      const bad = /\.(deleteRow|deleteRows|deleteSheet|deleteColumn|deleteColumns|clearContent|clearContents|removeSheet)\s*\(/g;
      let d;
      while ((d = bad.exec(fn.body)) !== null) {
        problems.push(
          `${label(f)}:${fn.line + fn.body.slice(0, d.index).split('\n').length - 1} doGet 안에서 파괴적 연산 ${d[1]}() ` +
          '→ GET은 부작용이 없어야 한다(doPost로 옮길 것)'
        );
      }
    }
  }

  return problems;
}

/* 3) 임시 배포 잔존. **코드를 지워도 라이브는 안 닫힌다** — versioned 배포는 그 시점 코드를
 *    영구 고정해 계속 서빙하므로, 원복 push 뒤에도 그 URL은 살아서 러너를 그대로 응답한다.
 *    조회 실패(오프라인·미로그인)는 위반이 아니라 '확인 불가'라 통과시킨다. */
function checkDeployments(root = ROOT) {
  const problems = [];
  try {
    /* Windows의 clasp는 .cmd 배치라 execFileSync로 직접 못 띄운다. shell:true는 되지만
     * args 배열과 함께 쓰면 Node가 DEP0190(인자 미이스케이프)를 경고한다 — 보안 검사기가
     * 보안 경고를 내면 안 된다. cmd.exe에 /c로 넘겨 이스케이프를 Node에 맡긴다. */
    const isWin = process.platform === 'win32';
    const bin = isWin ? path.join(process.env.APPDATA || '', 'npm', 'clasp.cmd') : 'clasp';
    const file = isWin ? (process.env.ComSpec || 'cmd.exe') : bin;
    const args = isWin ? ['/c', bin, 'deployments'] : ['deployments'];
    const out = execFileSync(file, args, {
      // cwd = 그 프로젝트 — clasp는 cwd의 .clasp.json으로 대상을 정한다.
      // ROOT로 박아 두면 크루카드를 배포하면서 **메인의 배포 목록**을 보게 된다(F061).
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000,
    });
    out.split(/\r?\n/).forEach((l) => {
      const d = parseDeploymentLine(l);
      if (d && d.temp) {
        problems.push(
          `임시 배포가 아직 살아 있다: "${d.desc}" (@${d.ver}) ` +
          `→ clasp undeploy ${d.id} 로 지우고 URL 404 확인까지 해야 닫힌다`
        );
      }
    });
  } catch (_) { /* 확인 불가 → 통과 */ }

  return problems;
}

// check() = 둘 다. /deploy 4단계와 CLI용(사람이 직접 돌릴 땐 전부 본다).
const check = (root = ROOT) => [...checkCode(root), ...checkDeployments(root)];

/* 이 저장소의 clasp 프로젝트 전부(루트 + 하위 .clasp.json). CLI로 사람이 돌릴 때 쓴다 —
 * 프로젝트가 둘인데 하나만 보고 「통과」라 말하면 그게 F061의 미탐 쪽이다. */
function claspProjects() {
  const out = fs.existsSync(path.join(ROOT, '.clasp.json')) ? [ROOT] : [];
  for (const d of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.') || d.name === 'node_modules') continue;
    const p = path.join(ROOT, d.name);
    if (fs.existsSync(path.join(p, '.clasp.json'))) out.push(p);
  }
  return out;
}

// 배포 표면과 검수 반영 경계는 tests/배포표면.test.js·검수배포.test.js에서 확인한다.
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

/** 반영 모드는 현재 정본의 명시 allowlist만 받는다. 해석 못 하는 rootDir·패턴은 추측하지 않는다. */
function 배포후보읽기(root = ROOT) {
  const 설정 = ['.clasp.json', '.claspignore'];
  const 읽기 = p => {
    const f = path.resolve(root, p), rel = path.relative(root, f);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('배포 경로가 프로젝트 밖이다');
    let cur = root;
    for (const part of rel.split(path.sep)) {
      cur = path.join(cur, part);
      if (fs.lstatSync(cur).isSymbolicLink()) throw new Error(`배포 경로에 연결 폴더·파일이 있다: ${p}`);
    }
    const s = fs.lstatSync(f);
    if (!s.isFile() || s.isSymbolicLink()) throw new Error(`배포 파일이 일반 파일이 아니다: ${p}`);
    if (process.platform !== 'win32' && (s.mode & 0o111)) throw new Error(`Apps Script 후보는 일반 파일 모드 100644만 지원한다: ${p}`);
    return fs.readFileSync(f);
  };
  const cfg = JSON.parse(읽기('.clasp.json').toString('utf8'));
  if (!cfg.scriptId || !['', '.'].includes(cfg.rootDir ?? '')) throw new Error('검수 반영은 rootDir가 프로젝트 안의 현재 폴더일 때만 지원한다');
  const 줄 = 읽기('.claspignore').toString('utf8').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#'));
  if (줄.shift() !== '**/*' || !줄.length || 줄.some(x => !/^![^!*?\[\]\\]+\.(?:js|gs|html|json)$/.test(x))) throw new Error('검수 반영은 **/* 뒤 명시 파일을 !로 고른 .claspignore만 지원한다');
  const 업로드 = [...new Set(줄.map(x => x.slice(1)))].sort();
  if (!업로드.includes('appsscript.json') || 업로드.some(p => p.split('/').some(x => !x || x.startsWith('.')))) throw new Error('배포 allowlist에 manifest가 없거나 안전하지 않은 경로가 있다');
  const 파일 = [...업로드, ...설정].sort().map(경로 => ({ 경로, 버퍼: 읽기(경로) }));
  const 후보 = { 판: 1, 종류: 'apps-script', 항목: 파일.map(x => ({ 경로: x.경로, sha256: sha256(x.버퍼), 모드: '100644', 종류: '바꿈' })) };
  return { 후보, 파일, 업로드, cfg };
}

function 후보쓰기(폴더, 자료) {
  const root = path.resolve(폴더);
  if (fs.existsSync(root) && fs.readdirSync(root).length) throw new Error('후보 폴더가 비어 있지 않다 — 새 폴더를 준다');
  fs.mkdirSync(root, { recursive: true });
  for (const x of 자료.파일) { const f = path.join(root, x.경로); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, x.버퍼); }
  fs.writeFileSync(path.join(root, '후보.json'), JSON.stringify(자료.후보, null, 2) + '\n');
  return root;
}

function 같은후보(a, b) {
  if (!a || a.판 !== 1 || a.종류 !== 'apps-script' || !Array.isArray(a.항목)) return false;
  const canon = x => x.항목.map(({ 경로, sha256, 모드, 종류 }) => ({ 경로, sha256, 모드, 종류 })).sort((a, b) => a.경로.localeCompare(b.경로));
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

function clasp실행(args, cwd, timeout = 120000) {
  const win = process.platform === 'win32';
  // .cmd 셸을 거치지 않아 설명의 따옴표·메타문자도 명령이 아니라 인자로 전달한다.
  const entry = path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@google', 'clasp', 'build', 'src', 'index.js');
  if (win && !fs.existsSync(entry)) throw new Error('공식 clasp 설치 진입점을 찾지 못했다');
  return execFileSync(win ? process.execPath : 'clasp', win ? [entry, ...args] : args,
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout, windowsHide: true });
}

/** 이 함수의 실행기는 공식 clasp뿐이다. 시험은 child_process 모의로 원격 호출을 전부 대체한다. */
async function 검수반영({ root = ROOT, 검수, deployment, description }) {
  if (!검수 || !deployment || !description) throw new Error('--push에는 --검수·--deployment <기존ID>·--description이 모두 필요하다');
  if (!/^[A-Za-z0-9_-]+$/.test(deployment)) throw new Error('기존 deployment ID 꼴이 올바르지 않다');
  const 자료 = 배포후보읽기(root);
  const { 검수확인 } = await import(require('url').pathToFileURL(path.join(__dirname, '검수묶음.mjs')).href);
  const 증거 = await 검수확인(검수, { 저장소: root });
  if (!증거.통과) throw new Error(`배포 전 검수: ${(증거.사유 || []).join(' / ')}`);
  if (증거.증명?.정책?.종류 !== '백엔드') throw new Error('Apps Script에는 백엔드 검수 정책이 필요하다');
  if (!같은후보(증거.증명?.배포후보, 자료.후보)) throw new Error('검수한 Apps Script 후보와 현재 배포 파일·설정이 다르다');
  const git = args => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 30000 });
  const 공용 = git(['rev-parse', '--git-common-dir']).toString().trim();
  const 작업 = git(['rev-parse', '--git-dir']).toString().trim();
  if (path.resolve(root, 공용) !== path.resolve(root, 작업)) throw new Error('Apps Script 라이브 반영은 공용 작업본에서 한다');
  git(['fetch', '--no-tags', 'origin', '+refs/heads/master:refs/remotes/origin/master']);
  for (const x of 자료.파일) {
    if (!git(['ls-tree', 'origin/master', '--', x.경로]).toString().startsWith('100644 ') || !git(['ls-files', '--stage', '--', x.경로]).toString().startsWith('100644 ')) throw new Error(`배포 파일 모드가 검수 후보와 다르다: ${x.경로}`);
    if (!git(['cat-file', '--filters', `origin/master:${x.경로}`]).equals(x.버퍼)) throw new Error(`배포 파일이 origin/master와 다르다: ${x.경로}`);
  }
  git(['diff', '--quiet', 'origin/master', '--', 'tools/deploy-security-check.js', 'tools/검수묶음.mjs', 'tools/lib/검수증명.mjs', 'tools/배포판점검.js', '.claude/hooks/lib/clasp-project.js']);
  const 임시기준 = fs.realpathSync(os.tmpdir());
  const snapshot = fs.mkdtempSync(path.join(임시기준, 'synk-reviewed-deploy-'));
  const 상태 = { 단계: '준비', 검수, deployment, versionNumber: null, 설명: description };
  try {
    후보쓰기(snapshot, 자료);
    // clasp가 실제 다시 읽을 디렉터리에서 범위·설정·바이트를 재검사한다.
    if (!같은후보(자료.후보, 배포후보읽기(snapshot).후보)) throw new Error('snapshot 작성 뒤 바이트가 달라졌다');
    const 문제 = checkCode(snapshot);
    if (문제.length) throw new Error(`배포 표면 위반: ${문제.join(' / ')}`);
    const 목록 = () => JSON.parse(clasp실행(['deployments', '--json'], snapshot));
    const 앞 = 목록();
    if (!Array.isArray(앞)) throw new Error('배포 목록 응답을 확인하지 못했다');
    if (앞.some(x => parseDeploymentLine(`- ${x.deploymentId} @${x.versionNumber || 'HEAD'} - ${x.description || ''}`)?.temp)) throw new Error('임시 runner·debug 배포가 아직 살아 있다 — 기존 배포 표면 조건을 먼저 해결한다');
    const 이전 = 앞.find(x => x.deploymentId === deployment);
    if (!이전 || !Number.isInteger(이전.versionNumber) || 이전.versionNumber < 1) throw new Error('해당 프로젝트의 기존 고정 deployment ID가 아니다');
    const { 라이브대조, 지문 } = require('./배포판점검.js');
    const 설명 = `${description} #fp:${지문(snapshot, snapshot)}`;
    // 원격 조회 동안에도 snapshot은 재확인한다. 임시 폴더는 다른 작업과 공유하지 않는다.
    if (!같은후보(자료.후보, 배포후보읽기(snapshot).후보)) throw new Error('clasp 호출 전 snapshot 바이트가 달라졌다');
    const 직전검수 = await 검수확인(검수, { 저장소: root });
    if (!직전검수.통과 || !같은후보(직전검수.증명?.배포후보, 자료.후보)) throw new Error('clasp 호출 전 검수 증거·소스·후보가 바뀌었다');
    상태.단계 = 'HEAD push 시도';
    clasp실행(['push', '--force'], snapshot);
    상태.단계 = 'HEAD push 완료·고정 버전 생성 시도';
    const 판 = JSON.parse(clasp실행(['version', 설명, '--json'], snapshot));
    if (!Number.isInteger(판.versionNumber) || 판.versionNumber < 1) throw new Error('생성된 고정 버전 번호를 확인하지 못했다');
    상태.versionNumber = 판.versionNumber;
    상태.단계 = '고정 버전 생성';
    if (!같은후보(자료.후보, 배포후보읽기(snapshot).후보)) throw new Error('버전 생성 중 검수 snapshot 바이트가 바뀌었다');
    const 대조 = 라이브대조(snapshot, snapshot, { versionNumber: 판.versionNumber });
    if (!같은후보(자료.후보, 배포후보읽기(snapshot).후보)) throw new Error('고정 버전 대조 중 검수 snapshot 바이트가 바뀌었다');
    if (대조.총 !== 자료.업로드.length || 대조.다름.length || 대조.라이브없음.length || 대조.저장소없음.length) throw new Error('생성된 고정 버전 원문이 검수 snapshot과 다르다 — deployment는 갱신하지 않았다');
    const 직전 = 목록().find(x => x.deploymentId === deployment);
    if (!직전 || 직전.versionNumber !== 이전.versionNumber) throw new Error('다른 작업이 기존 deployment를 바꿨다 — 갱신하지 않았다');
    상태.단계 = 'deployment 갱신 시도';
    const 반영 = JSON.parse(clasp실행(['deploy', '-i', deployment, '--versionNumber', String(판.versionNumber), '--description', 설명, '--json'], snapshot));
    상태.단계 = 'deployment 갱신';
    if (반영.deploymentId !== deployment || 반영.versionNumber !== 판.versionNumber || 목록().find(x => x.deploymentId === deployment)?.versionNumber !== 판.versionNumber) throw new Error('갱신 후 기존 deployment의 정확한 버전을 확인하지 못했다');
    return { ...상태, 단계: '완료', 통과: true };
  } catch (e) {
    e.message = `${e.message} (진행: ${상태.단계}${상태.versionNumber ? ` @${상태.versionNumber}` : ''})`;
    throw e;
  } finally {
    if (path.dirname(path.resolve(snapshot)) !== 임시기준 || !path.basename(snapshot).startsWith('synk-reviewed-deploy-')) throw new Error('snapshot 정리 경로 확인 실패');
    fs.rmSync(snapshot, { recursive: true, force: true });
  }
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length) {
    const o = {};
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === '--push') o.push = true;
      else if (['--검수', '--deployment', '--description', '--후보'].includes(a) && argv[i + 1]) o[a.slice(2)] = argv[++i];
      else throw new Error(`모르는 인자 또는 값 없음: ${a}`);
    }
    if (o.push && o.후보) throw new Error('--후보와 --push는 함께 쓰지 않는다');
    if (o.후보) { console.log(`Apps Script 검수 후보: ${후보쓰기(o.후보, 배포후보읽기())}`); return; }
    if (!o.push) throw new Error('--후보 또는 --push를 준다');
    const r = await 검수반영(o);
    console.log(`Apps Script 기존 배포 반영·대조 완료 @${r.versionNumber} · 검수 ${r.검수}`);
    return;
  }
  const projects = claspProjects();
  const p = projects.flatMap((r) => check(r));
  const 이름 = projects.map((r) => path.relative(ROOT, r) || '(루트)').join(' · ');
  if (p.length) throw new Error('[deploy-security-check] 배포 표면 위반 ' + p.length + '건:\n- ' + p.join('\n- '));
  console.log(`[deploy-security-check] 통과 — 배포 표면 이상 없음(프로젝트 ${projects.length}: ${이름})`);
}

module.exports = { check, checkCode, checkDeployments, claspProjects, looksSecret, topLevelFunctions, parseDeploymentLine, 배포후보읽기, 후보쓰기, 같은후보, 검수반영, main };

if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
