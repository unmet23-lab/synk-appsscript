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
 * (clasp-guard가 08-01에 하드코딩 목록 때문에 파일 절반을 못 보던 것과 같은 함정 — [[guard-must-check-result]]) */
function deployTargets() {
  try {
    const pats = fs.readFileSync(path.join(ROOT, '.claspignore'), 'utf8')
      .split(/\r?\n/).map((l) => l.trim())
      .filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim()).filter(Boolean);
    if (pats.length) return pats;
  } catch (_) {}
  return ['*.js']; // 폴백은 항상 '더 많이 검사하는' 쪽
}
function globToRe(g) {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
}
function targetJsFiles() {
  const res = deployTargets().map(globToRe);
  return fs.readdirSync(ROOT).filter((f) => f.endsWith('.js') && res.some((re) => re.test(f)));
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
 *   '2Kn1KrbV-NAUVoCxjiGT7It7_-ueMp0_' → 소문자·대문자·숫자·구분자 4종 = 시크릿
 *   'purgeTestCheckins'               → 소문자·대문자 2종 = 이름
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

function check() {
  const problems = [];
  let anon = false;
  try {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'appsscript.json'), 'utf8'));
    anon = !!(m.webapp && m.webapp.access === 'ANYONE_ANONYMOUS');
  } catch (_) {}

  for (const f of targetJsFiles()) {
    let src;
    try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (_) { continue; }

    /* 1) 소스에 박힌 고정 인증 토큰.
     *    조준은 '긴 문자열'이 아니라 **비교**다 — `const SHEET_ID = '1Ze_…'` 같은 대입 상수는
     *    잡지 않고, 외부에서 들어온 값을 상수와 대조하는 `p.key === '…'` 만 잡는다.
     *    이 구분이 없으면 시트 ID·배포 ID가 전부 걸려 가드가 노이즈가 된다. */
    const tok = /\.\w+\s*===?\s*(['"])([A-Za-z0-9_\-]{16,})\1/g;
    let t;
    while ((t = tok.exec(src)) !== null) {
      if (!looksSecret(t[2])) continue; // 연산 이름 등 사람이 지은 식별자는 통과
      problems.push(
        `${f}:${lineOf(src, t.index)} 소스에 박힌 고정 토큰으로 인증(…${t[2].slice(-6)})` +
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
          `${f}:${fn.line + fn.body.slice(0, d.index).split('\n').length - 1} doGet 안에서 파괴적 연산 ${d[1]}() ` +
          '→ GET은 부작용이 없어야 한다(doPost로 옮길 것)'
        );
      }
    }
  }

  /* 3) 임시 배포 잔존. **코드를 지워도 라이브는 안 닫힌다** — versioned 배포는 그 시점 코드를
   *    영구 고정해 계속 서빙하므로, 원복 push 뒤에도 그 URL은 살아서 러너를 그대로 응답한다.
   *    조회 실패(오프라인·미로그인)는 위반이 아니라 '확인 불가'라 통과시킨다. */
  try {
    /* Windows의 clasp는 .cmd 배치라 execFileSync로 직접 못 띄운다. shell:true는 되지만
     * args 배열과 함께 쓰면 Node가 DEP0190(인자 미이스케이프)를 경고한다 — 보안 검사기가
     * 보안 경고를 내면 안 된다. cmd.exe에 /c로 넘겨 이스케이프를 Node에 맡긴다. */
    const isWin = process.platform === 'win32';
    const bin = isWin ? path.join(process.env.APPDATA || '', 'npm', 'clasp.cmd') : 'clasp';
    const file = isWin ? (process.env.ComSpec || 'cmd.exe') : bin;
    const args = isWin ? ['/c', bin, 'deployments'] : ['deployments'];
    const out = execFileSync(file, args, {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000,
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

// 오탐/미탐이 갈리는 지점은 테스트가 직접 잡는다(tests/배포표면.test.js)
module.exports = { check, looksSecret, topLevelFunctions, parseDeploymentLine };

if (require.main === module) {
  const p = check();
  if (p.length) {
    console.error('[deploy-security-check] 배포 표면 위반 ' + p.length + '건:\n- ' + p.join('\n- '));
    process.exit(1);
  }
  console.log('[deploy-security-check] 통과 — 배포 표면 이상 없음');
}
