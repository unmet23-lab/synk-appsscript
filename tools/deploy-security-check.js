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
  const res = deployTargets(root).map(globToRe);
  return fs.readdirSync(root).filter((f) => f.endsWith('.js') && res.some((re) => re.test(f)));
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

// 오탐/미탐이 갈리는 지점은 테스트가 직접 잡는다(tests/배포표면.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다))
module.exports = { check, checkCode, checkDeployments, claspProjects, looksSecret, topLevelFunctions, parseDeploymentLine };

if (require.main === module) {
  // CLI는 **프로젝트 전부**를 본다 — 하나만 보고 통과라 말하면 F061의 미탐 쪽이다.
  const projects = claspProjects();
  const p = projects.flatMap((r) => check(r));
  const 이름 = projects.map((r) => path.relative(ROOT, r) || '(루트)').join(' · ');
  if (p.length) {
    console.error('[deploy-security-check] 배포 표면 위반 ' + p.length + '건:\n- ' + p.join('\n- '));
    process.exit(1);
  }
  console.log(`[deploy-security-check] 통과 — 배포 표면 이상 없음(프로젝트 ${projects.length}: ${이름})`);
}
