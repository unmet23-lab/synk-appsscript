#!/usr/bin/env node
'use strict';
/* 배포판 점검 — 「`clasp push` 는 성공했는데 라이브는 옛 코드」를 잡는다.
 *
 * ■ 왜 있나 (2026-08-05 실사고)
 *   브랜드 키트 수리를 `clasp push` 로 올리고 「라이브 반영 완료」라 말할 뻔했다. 실제로는
 *   접수 URL 이 물고 있던 **고정 버전 배포 @16** 이 v9.186 시점 코드에 못박힌 채 **옛 카드를
 *   계속 서빙**하고 있었다. push 는 프로젝트 파일만 갱신한다 — 웹앱은 그 파일이 아니라
 *   **배포 스냅샷**을 서빙한다. 같은 `deploymentId` 로 다시 deploy 해야 주소를 유지한 채 바뀐다.
 *   기존 `clasp-guard` 는 커밋·push·구문·배포 표면을 전부 보지만 **이 자리만 안 봤고**,
 *   새는 방향은 언제나 「통과」였다 — push 성공 = 배포 완료로 읽힌다.
 *
 * ■ 왜 시각 비교가 아니라 지문인가
 *   `clasp deployments` 도 `clasp versions` 도 **시각을 주지 않는다**(2026-08-05 실측).
 *   버전 번호도 못 쓴다 — `clasp deploy` 는 배포와 동시에 버전을 만들기 때문에, push 만 하고
 *   말아도 「배포판 버전 == 최신 버전」이 그대로 유지된다. 즉 번호로는 이 사고가 안 보인다.
 *   그래서 **내용 지문을 배포 설명에 심는다.** 저장할 곳을 로컬 상태 파일로 두지 않은 이유는
 *   이 저장소가 계정·기계를 갈아타며 도는 곳이라서다 — 로컬 상태는 갈아타는 순간 끊긴다.
 *   배포 설명은 **라이브 안에** 살아서 누가 어디서 물어도 같은 답을 준다(현재를 읽어 판정).
 *
 * ■ 경계 — 이 검사가 말하지 않는 것
 *   지문이 같다 = 「내가 마지막으로 심은 내용과 지금 파일이 같다」다. 설명에 지문이 **없는**
 *   옛 배포는 「낡음」이 아니라 **「모름」**으로 낸다. 모름을 통과로 접으면 그게 이 도구가
 *   없애려던 형태 그 자체다.
 *
 * ■ 「바이트 동일」의 뜻은 「라이브=작업본」까지다 — 그래서 미커밋을 같이 잰다 (2026-08-10 · F309·F310)
 *   clasp 는 HEAD 가 아니라 **작업본**을 민다. 배포집합에 미커밋이 있으면 push 가 그것을 실어
 *   나가고, 그 직후의 바이트 대조는 「동일」= 초록이 된다 — 유출이 초록의 모습으로 지나간다
 *   (08-10 실측 2회: `[vNEXT]` 자리표와 트랙 중간 상태가 그렇게 라이브에 나갔다). 그래서 모든
 *   판정이 배포집합 미커밋을 함께 받아, 초록이 「라이브=HEAD」까지 말할 수 있을 때만 그렇게
 *   말한다. 미커밋을 **못 쟀으면**(git 실패 = null) 0 으로 접지 않고 초록의 뜻을 낮춰 적는다.
 *
 * ■ @HEAD 만 서빙하는 프로젝트는 이 층이 **원리상 아무것도 못 잰다** (2026-08-07)
 *   지문은 **배포 설명**에 심는데 고정 배포가 없으면 심을 자리가 없다. 그래서 루트(유호님이
 *   매일 쓰는 라이브 학원 시스템)에 대해 이 도구는 「@HEAD 라 push 가 곧 라이브다」를 낸다 —
 *   그건 **기전 진술이지 측정이 아니다.** `clasp push` 를 빼먹으면 영원히 같은 문장이 나온다
 *   (`deploy-freshness` 훅도 level==='ok' 면 침묵하므로 루트에는 원리상 발화하지 않는다).
 *   `/deploy` 가 늘 push 로 끝나서 안 보였을 뿐이고, **스킬은 불러야 적용된다.**
 *   → `라이브대조()` 가 라이브를 **작업본 아닌 임시 디렉터리**로 받아 바이트로 잰다.
 *     지문이 아니라 내용을 직접 보므로 심어 둔 것이 없어도 선다.
 *     (작업본에 `clasp pull` 하는 것은 F040 실사고다 — 처방 출처 = clasp-guard 규칙 0-A 안내문.)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const { claspProjects, parseDeploymentLine } = require(path.join(ROOT, 'tools', 'deploy-security-check.js'));
const 프로젝트 = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'clasp-project.js'));

/* 지문 표기 — 설명에 섞여도 사람이 읽는 문장을 해치지 않는 짧은 꼬리표.
 * 8자리면 이 저장소 규모(배포 수십 건)에서 충돌이 실질적으로 없고, 사람이 눈으로 대조할 수 있다. */
const FP_RE = /#fp:([0-9a-f]{8})\b/;
const 지문표기 = (fp) => `#fp:${fp}`;

/* clasp 가 실제로 올리는 파일 집합.
 * 목록을 새로 적지 않고 `isDeployFile`(= .claspignore 정본)에서 파생시킨다 —
 * 같은 판정을 두 곳에 적으면 갈라지고, 갈라지는 방향은 언제나 「통과」다. */
function 배포집합(projRoot, root = ROOT) {
  const out = [];
  const 하위 = claspProjects().filter((p) => p !== projRoot && p.startsWith(projRoot + path.sep));
  /* 글롭의 `*` 는 `/` 를 안 넘는다. 그래서 패턴에 `/` 가 하나도 없으면 하위 디렉터리 파일은
   * **원리상** 대상이 될 수 없다 — 그 경우 훑기를 최상위로 줄인다(같은 답, 훨씬 싸다). */
  const 최상위만 = !프로젝트.deployTargets(projRoot).some((p) => p.includes('/'));

  const 훑기 = (dir) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, d.name);
      if (d.isDirectory()) {
        if (최상위만 || d.name.startsWith('.') || d.name === 'node_modules') continue;
        if (하위.includes(abs)) continue; // 남의 프로젝트 파일을 내 지문에 섞지 않는다(F061)
        훑기(abs);
        continue;
      }
      // clasp 설정 파일은 clasp 가 올리지 않는다 — 지문에 넣으면 없는 변경이 생긴다
      if (d.name === '.clasp.json' || d.name === '.claspignore') continue;
      const rel = path.relative(root, abs).replace(/\\/g, '/');
      if (프로젝트.isDeployFile(rel, projRoot, root)) out.push(rel);
    }
  };
  훑기(projRoot);
  return out.sort();
}

/* 작업본의 미커밋 경로 집합(저장소 상대 · 스테이징·비스테이징·미추적 전부 · rename 은 새 경로).
 * `null` = git 을 못 읽었다(모름) — 0 으로 접지 않는다(새는 방향은 언제나 「통과」다).
 * `-uall` 인 이유: 기본값은 미추적 **디렉터리**를 한 줄로 접어 그 안의 새 배포 파일이 안 보인다.
 * `quotepath=false` 인 이유: 끄면 한글 배포 파일명(`엔진_*.js`)이 8진수로 깨져 아래 대조가
 * 전부 빗나간다 — 재는 층이 값을 깨뜨리면 원본이 멀쩡해도 초록이 된다(F281 계열).
 * rot-check 의 「편집 중 보류」 판정도 이 한 벌을 쓴다 — 같은 판정을 두 곳에 적으면 갈라진다. */
function 미커밋집합(root = ROOT) {
  let out;
  try {
    out = execFileSync('git', ['-c', 'core.quotepath=false', 'status', '--porcelain', '-uall'],
      { cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true });
  } catch (_) { return null; }
  const 집합 = new Set();
  for (const l of out.split(/\r?\n/).filter(Boolean)) {
    let p = l.slice(3);
    const 화살 = p.indexOf(' -> ');            // rename 은 새 경로가 작업본의 실체다
    if (화살 >= 0) p = p.slice(화살 + 4);
    집합.add(p.trim().replace(/^"|"$/g, '').replace(/\\/g, '/'));
  }
  return 집합;
}

/* 배포집합 중 미커밋인 것 — F309·F310 의 재료. `null` = 모름(git 실패).
 * ⚠ 미커밋 «삭제»는 못 본다(디스크에 없어 배포집합 훑기 밖) — 그 형태는 라이브 대조의
 * 저장소없음 갈래가 잡는다. */
function 배포집합미커밋(projRoot, root = ROOT, 집합 = 미커밋집합(root)) {
  if (집합 === null) return null;
  return 배포집합(projRoot, root).filter((rel) => 집합.has(rel));
}

/* 내용 지문 — 경로와 **바이트**를 함께 넣는다.
 * 바이트로 재는 이유: clasp 는 작업본을 그대로 민다. 줄끝(CRLF/LF)이 바뀌면 라이브도 바뀐다. */
function 지문(projRoot, root = ROOT) {
  const h = crypto.createHash('sha256');
  for (const rel of 배포집합(projRoot, root)) {
    h.update(rel);
    h.update('\0');
    h.update(fs.readFileSync(path.join(root, rel)));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 8);
}

/* 라이브 배포 목록 조회(네트워크). 실패는 「통과」가 아니라 **확인 불가**로 돌려준다 —
 * 통과와 미실행이 같은 모양이면 안 된다. */
function 배포목록(projRoot) {
  const isWin = process.platform === 'win32';
  const bin = isWin ? path.join(process.env.APPDATA || '', 'npm', 'clasp.cmd') : 'clasp';
  const file = isWin ? (process.env.ComSpec || 'cmd.exe') : bin;
  const args = isWin ? ['/c', bin, 'deployments'] : ['deployments'];
  const out = execFileSync(file, args, {
    cwd: projRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000,
  });
  return out.split(/\r?\n/).map(parseDeploymentLine).filter(Boolean);
}

/* 라이브 내용이 이 저장소의 **어느 판**인가 — 바이트가 다르다는 것만으로는 ①저장소가 앞선다
 * ②라이브에 편집기 손편집이 있다 를 못 가른다. 둘은 대조에서 같은 모양인데 처방은 정반대다
 * (앞은 「밀어라」, 뒤는 밀면 그 편집이 **사라진다**). 그래서 라이브 판을 이력에서 되찾는다.
 * ⚠ **git 이력에 기대는 검사다** — 얕은 클론(CI)에선 못 찾는다. 그래서 못 찾음은 「라이브 전용」이
 *   아니라 **모름**으로 낸다: 모름을 단정으로 접으면 거짓양성이 쏟아지고 그런 가드는 곧 꺼진다.
 * 🔑 창은 **경로로 거른 이력**이다 — 전체 이력에서 N 개를 보면 문서 커밋이 창을 다 먹어,
 *   실제로는 뒤처짐일 뿐인데 「모름」이 나온다(이 함수를 손으로 짜 본 첫 판이 정확히 그랬다). */
function 라이브판찾기(rel, 라이브내용, root = ROOT, 창 = 40) {
  const n = (s) => s.replace(/\r\n/g, '\n');
  const 라이브 = n(라이브내용);
  let 줄들;
  try {
    줄들 = execFileSync('git', ['log', `-${창}`, '--format=%H %s', '--', rel], {
      cwd: root, encoding: 'utf8', maxBuffer: 8 << 20,
    }).trim().split(/\r?\n/).filter(Boolean);
  } catch (_) { return { 종류: '모름', 사유: 'git 이력을 못 읽었다' }; }

  for (const l of 줄들) {
    const sha = l.slice(0, 40);
    let 옛;
    try {
      옛 = execFileSync('git', ['show', `${sha}:${rel}`], { cwd: root, maxBuffer: 64 << 20 }).toString('utf8');
    } catch (_) { continue; }               // 그 판엔 그 경로가 없었다 — 다음 판으로
    if (n(옛) === 라이브) return { 종류: '뒤처짐', sha: sha.slice(0, 8), 제목: l.slice(41) };
  }
  return { 종류: '모름', 사유: `이 경로의 최근 ${창}판 중 같은 것이 없다` };
}

/* 라이브를 임시 디렉터리로 받아 배포집합과 **바이트로** 대조한다(네트워크).
 * 지문 대조가 안 서는 @HEAD 프로젝트용 — 심어 둔 표식이 없어도 내용을 직접 보면 답이 나온다.
 * ⚠ `cwd` 는 반드시 작업본 **밖**이다. 작업본에 pull 하면 옆 세션의 커밋이 라이브 판으로
 *   되돌아간다(F040). 임시 디렉터리는 끝나면 지운다. */
function 라이브대조(projRoot, root = ROOT, { timeout = 120000 } = {}) {
  const cfg = JSON.parse(fs.readFileSync(path.join(projRoot, '.clasp.json'), 'utf8'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-live-'));
  try {
    fs.writeFileSync(path.join(tmp, '.clasp.json'), JSON.stringify({
      scriptId: cfg.scriptId,
      rootDir: '',
      scriptExtensions: cfg.scriptExtensions,
      htmlExtensions: cfg.htmlExtensions,
      jsonExtensions: cfg.jsonExtensions,
    }));
    const isWin = process.platform === 'win32';
    const bin = isWin ? path.join(process.env.APPDATA || '', 'npm', 'clasp.cmd') : 'clasp';
    execFileSync(isWin ? (process.env.ComSpec || 'cmd.exe') : bin, isWin ? ['/c', bin, 'pull'] : ['pull'], {
      cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout,
    });

    const 집합 = 배포집합(projRoot, root);
    const 다름 = [], 라이브없음 = [];
    for (const rel of 집합) {
      const 라이브 = path.join(tmp, rel);
      if (!fs.existsSync(라이브)) { 라이브없음.push(rel); continue; }
      if (!fs.readFileSync(path.join(root, rel)).equals(fs.readFileSync(라이브))) 다름.push(rel);
    }
    /* 반대 방향도 본다 — 저장소에서 지운 파일이 라이브에 남아 있으면 그 코드는 **계속 돈다.**
     * 한 방향만 재면 「지웠다」가 「안 돈다」로 읽힌다. */
    const 저장소없음 = fs.readdirSync(tmp, { recursive: true })
      .map((p) => String(p).replace(/\\/g, '/'))
      .filter((p) => p !== '.clasp.json' && !집합.includes(p) && !fs.existsSync(path.join(root, p)));
    /* 내용이 다른 것만 방향을 잰다 — 라이브없음·저장소없음 은 존재 자체가 이미 방향이다. */
    const 방향 = {};
    for (const rel of 다름) 방향[rel] = 라이브판찾기(rel, fs.readFileSync(path.join(tmp, rel), 'utf8'), root);
    return { 다름, 라이브없음, 저장소없음, 방향, 총: 집합.length };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* ── 판정 (순수 함수) ────────────────────────────────────────────────────────
 * 네트워크·파일시스템을 안 탄다 — **탐지력은 여기서 픽스처로 못박는다.**
 * 실저장소·라이브를 요구하는 검사는 CI 에서 못 돌고, 그걸 탐지력의 근거로 삼으면
 * 「자격증명이 없어서 초록」이 된다. */
function 판정({ 이름, 경로, fp, deployments, 대조, 미커밋 }) {
  const 고정 = (deployments || []).filter((d) => d.ver !== 'HEAD' && !d.temp);
  if (!고정.length) {
    /* 🔴 `대조` 가 없으면 이 갈래는 **아무것도 안 잰 것**이다. 문장을 그렇게 쓴다 —
     *   level 은 'ok' 로 둔다: 이 갈래를 밟는 유일한 상시 호출자가 `clasp push` **직후**에
     *   도는 deploy-freshness 훅이고, 그 순간엔 라이브가 실제로 최신이라 경보가 거짓이 된다.
     *   측정은 `라이브대조()` 를 들고 오는 호출자(rot-check 주간·`--라이브`)가 한다.
     * ⚠ 단 그 「최신」이 **작업본**이라는 것이 F310 이다 — 배포집합에 미커밋이 있으면 방금 그
     *   push 가 그것을 실었을 수 있으므로 침묵하지 않는다(warn — 라이브를 안 읽었으니 단정은
     *   `--라이브` 몫이고, 이 갈래가 stale 을 내면 --check 게이트가 남의 정상 작업에도 빨개진다). */
    if (!대조) {
      const lines = [`${이름}: 고정 버전 배포 없음(@HEAD) — 지문을 심을 자리가 없어 **이 층은 안 쟀다**(재려면 --라이브)`];
      if (미커밋 && 미커밋.length) {
        lines.push(`⚠ 배포집합에 **미커밋 ${미커밋.length}건** — push 는 HEAD 가 아니라 작업본을 민다(F310): 직전 push 가 이 내용을 실었을 수 있다`);
        for (const f of 미커밋) lines.push(`   미커밋: ${f}`);
        lines.push('   → 실렸는지는 바이트로 잰다: node tools/배포판점검.js --라이브 · 주인 가르기: node tools/작업본소유자.js');
        return { level: 'warn', 이름, 측정: false, 미커밋, lines };
      }
      return { level: 'ok', 이름, 측정: false, 미커밋: 미커밋 || null, lines };
    }
    const { 다름 = [], 라이브없음 = [], 저장소없음 = [], 총 = 0 } = 대조;
    if (!다름.length && !라이브없음.length && !저장소없음.length) {
      /* 🔴 F310 실측 갈래 — 「바이트 동일」인데 그 바이트가 미커밋이다: 라이브 = 작업본 ≠ HEAD.
       *   이 초록의 원래 문장이 정확히 그 유출을 덮던 자리다(F309: push 직후 배포집합 미커밋 0 을
       *   확인해야 「라이브=작업본」이 비로소 「라이브=HEAD」를 뜻한다). */
      if (미커밋 && 미커밋.length) {
        return {
          level: 'stale', 이름, 측정: true, 미커밋,
          lines: [
            `🔴 ${이름}: 배포집합 ${총}개 바이트 동일 — 그러나 그 중 **미커밋 ${미커밋.length}건**: 라이브 = 작업본 ≠ HEAD (미커밋 유출 · F310)`,
            ...미커밋.map((f) => `   미커밋: ${f}`),
            '   → 주인부터 가른다: node tools/작업본소유자.js — 내 것이면 즉시 커밋해 이력에 들인다(그래야 라이브 = HEAD) · 남의 것이면 두고 보고만 한다(F073)',
          ],
        };
      }
      const 꼬리 = 미커밋 ? ' · 미커밋 0 — 라이브 = HEAD' : ' · ⚠미커밋 못 잼: 이 초록은 「라이브=작업본」까지만 말한다';
      return { level: 'ok', 이름, 측정: true, 미커밋: 미커밋 || null, lines: [`${이름}: 라이브 = 저장소 (@HEAD · 배포집합 ${총}개 바이트 동일${꼬리})`] };
    }
    /* 🔑 「다르다」는 방향이 아니다 — 저장소가 앞선 것과 라이브에 손편집이 있는 것이 같은 모양이다.
     *   방향을 못 재고 「push 가 빠졌다」로 단정하면, 처방(=밀어라)이 남의 편집을 지우라는 말이 된다.
     *   그래서 셋으로 나눠 적는다: 실측 뒤처짐 · 방향 미측정(옛 호출자) · 못 가름. */
    const 방향 = 대조.방향 || null;
    const 못가름 = 방향 ? 다름.filter((r) => 방향[r] && 방향[r].종류 !== '뒤처짐') : [];
    const 꼬리 = !다름.length ? ''
      : !방향 ? ' — **push 가 빠졌다**(방향 미측정)'
        : 못가름.length ? ' — 🔴 **방향을 못 갈랐다**'
          : ' — **push 가 빠졌다**(방향 실측 · 라이브에만 있는 편집 0)';
    const lines = [`🔴 ${이름} 라이브가 저장소와 다르다 (@HEAD · 배포집합 ${총}개)${꼬리}`];
    const 보고 = (제목, 목록) => { for (const r of 목록) lines.push(`   ${제목} ${r}`); };
    for (const r of 다름) {
      const d = 방향 && 방향[r];
      lines.push(`   내용 다름: ${r}`
        + (!d ? ''
          : d.종류 === '뒤처짐' ? `  ← 라이브 = ${d.sha} ${d.제목}`
            : `  ← 🔴 라이브 판을 못 찾았다(${d.사유})`));
    }
    보고('라이브에 없음(push 된 적 없다):', 라이브없음);
    보고('라이브에만 있음(지웠는데 계속 돈다):', 저장소없음);
    /* 미커밋 두 갈래(F310) — 배포집합의 미커밋 파일은 라이브와 ①다르거나 ②같거나 둘뿐이다.
     * ①은 「지금 누가 고치는 중」일 수 있어 처방(/deploy)을 그대로 따르면 남의 반쪽 작업을 밀고,
     * ②는 이미 실려 나간 것이다 — 어느 쪽도 조용히 지나가면 안 된다. */
    if (미커밋 && 미커밋.length) {
      const 겹침 = 미커밋.filter((f) => 다름.includes(f) || 라이브없음.includes(f));
      const 유출 = 미커밋.filter((f) => !다름.includes(f) && !라이브없음.includes(f) && !저장소없음.includes(f));
      if (유출.length) lines.push(`   🔴 미커밋인데 라이브와 **바이트 동일** ${유출.length}건 — 이미 실려 나갔다(F310): ${유출.join(' · ')}`);
      if (겹침.length) lines.push(`   ⚠ 위 목록 중 미커밋 ${겹침.length}건(${겹침.join(' · ')}) — 지금 누가 고치는 중일 수 있다: 밀기 전에 node tools/작업본소유자.js 로 주인을 가른다(남의 미커밋을 밀면 그게 F310 이다)`);
    }
    /* 못 가른 파일이 있으면 처방을 **밀기 전 확인**으로 한 칸 앞당긴다 — 그냥 /deploy 를 주면
     * 이 경고는 읽히지 않고 넘어간다(경고가 처방과 어긋나면 사람은 처방만 따른다). */
    if (못가름.length) {
      lines.push('   ⚠ 밀기 전에 확인한다 — 위 🔴 파일의 라이브 내용이 이 저장소 이력 어디에도 없다.');
      lines.push('     ①이력이 얕거나(CI·얕은 클론) ②라이브에 편집기 손편집이 있다 — ②면 미는 순간 그것이 사라진다.');
      lines.push('     편집기에서 그 파일을 열어 눈으로 본 뒤에 민다(작업본으로 되받는 길은 clasp-guard 가 막는다 · F040).');
    }
    /* 처방 줄에 금지된 명령을 **글자로도** 안 적는다 — 설명이어도 눈은 명령으로 읽고 복사한다
     * (회귀가 이 줄을 잡았다: 처음엔 "손 clasp push 는 …가 막는다"라고 적어 뒀었다). */
    lines.push(`   → cd ${경로 || '.'} && /deploy   (손으로 미는 통로는 clasp-guard 가 막는다)`);
    /* 파일 목록을 **구조로도** 낸다 — 호출부가 「push 가 빠졌다」와 「지금 누가 고치는 중이다」를
     * 가르려면 이 목록이 필요한데, 문장에서 되뽑으면 문구가 바뀌는 날 조용히 안 갈린다.
     * `못가름` 도 같은 이유로 구조다 — 문장에서 🔴 를 세는 호출부는 문구가 바뀌는 날 조용해진다. */
    return { level: 'stale', 이름, 측정: true, lines, 못가름, 미커밋: 미커밋 || null, 파일들: [...다름, ...라이브없음, ...저장소없음] };
  }

  const 낡음 = [], 모름 = [], 최신 = [];
  for (const d of 고정) {
    const m = FP_RE.exec(d.desc || '');
    if (!m) 모름.push(d);
    else if (m[1] === fp) 최신.push(d);
    else 낡음.push(d);
  }

  if (!낡음.length && !모름.length) {
    /* 지문 일치 = 배포 스냅샷 == **지금 작업본**. 그 작업본에 미커밋이 있으면 스냅샷도 그 미커밋을
     * 싣고 있다(지문이 작업본 바이트에서 나오므로) — 「최신」이 아니라 F310 유출이다. */
    if (미커밋 && 미커밋.length) {
      return {
        level: 'stale', 이름, 미커밋,
        lines: [
          `🔴 ${이름}: 배포 지문 일치(${지문표기(fp)}) — 그러나 배포집합에 **미커밋 ${미커밋.length}건**: 그 스냅샷은 작업본이지 HEAD 가 아니다(미커밋 유출 · F310)`,
          ...미커밋.map((f) => `   미커밋: ${f}`),
          '   → 주인부터 가른다: node tools/작업본소유자.js — 내 것이면 즉시 커밋해 이력에 들인다 · 남의 것이면 두고 보고만 한다(F073)',
        ],
      };
    }
    return { level: 'ok', 이름, 미커밋: 미커밋 || null, lines: [`${이름}: 라이브 최신 (${지문표기(fp)} · 배포 ${최신.length}건)`] };
  }

  const 처방 = (d) =>
    `     cd ${경로 || '.'} && clasp deploy --deploymentId ${d.id} \\\n` +
    `       --description "${(d.desc || '').replace(/\s*#fp:[0-9a-f]+\b/, '').trim() || '갱신'} ${지문표기(fp)}"`;

  const lines = [];
  for (const d of 낡음) {
    lines.push(
      `🔴 ${이름} @${d.ver} 이 **옛 코드를 서빙한다** — 배포 지문 ${FP_RE.exec(d.desc)[1]} ≠ 현재 ${fp}`,
      `   "${d.desc}"`,
      `   → 같은 주소를 유지한 채 갱신하려면(⛔ --deploymentId 를 빼면 **새 배포 = 접수 주소 2개**가 된다):`,
      처방(d)
    );
  }
  for (const d of 모름) {
    lines.push(
      `⚠ ${이름} @${d.ver} 은 **판정 불가** — 설명에 지문이 없다(지문을 심기 전에 만든 배포다)`,
      `   "${d.desc}"`,
      `   → 다음 배포부터 대조되게 하려면 설명 끝에 지문을 붙인다:`,
      처방(d)
    );
  }
  /* 갱신 처방(clasp deploy)은 **지금 작업본**을 스냅샷한다 — 미커밋이 있는 채로 따르면 그
   * 미커밋까지 실린다. 경고가 처방보다 뒤에 서면 사람은 처방만 따르므로 여기서 같이 적는다. */
  if (미커밋 && 미커밋.length) {
    lines.push(`   ⚠ 배포집합에 미커밋 ${미커밋.length}건(${미커밋.join(' · ')}) — 지금 위 명령으로 갱신하면 **그 미커밋까지 실린다**(F310): 먼저 node tools/작업본소유자.js 로 주인을 가른다`);
  }
  return { level: 낡음.length ? 'stale' : 'unknown', 이름, 미커밋: 미커밋 || null, lines };
}

/* 세 원인(오프라인·미로그인·clasp 없음)을 한 문장으로 접으면 어느 것인지 아무도 못 가른다 —
 * 하나는 30초면 고쳐지고 하나는 그냥 기다리면 된다. 원문 끝 줄을 함께 낸다. */
const 못읽음 = (이름, 무엇, e) => ({
  level: 'unreachable',
  이름,
  lines: [
    `⚠ ${이름}: ${무엇}(오프라인·미로그인·clasp 없음) — **확인 불가**지 통과가 아니다`,
    `   ${String((e && (e.stderr || e.message)) || e).trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] || '(원문 없음)'}`,
  ],
});

/* 프로젝트 하나를 실제로 본다(네트워크 포함). 조회 실패는 확인 불가로 드러낸다.
 * `라이브:true` = 고정 배포가 없는 프로젝트를 지문 대신 **바이트로** 잰다(느리다 — 주간·수동용). */
function 점검(projRoot, root = ROOT, { 라이브 = false, 시간제한 } = {}) {
  const 이름 = path.relative(root, projRoot).replace(/\\/g, '/') || '(루트)';
  const 경로 = path.relative(root, projRoot).replace(/\\/g, '/') || '.';
  let deployments;
  try {
    deployments = 배포목록(projRoot);
  } catch (e) {
    return 못읽음(이름, '배포 목록을 못 읽었다', e);
  }
  let 대조;
  if (라이브 && !deployments.some((d) => d.ver !== 'HEAD' && !d.temp)) {
    try {
      /* 호출부가 상한을 줄 수 있어야 한다 — 훅에서 부를 때 기본 120초는 훅 예산(60초)보다 길어서,
       * 네트워크가 멎으면 훅이 통째로 죽고 **아무것도 안 찍힌다**(새는 방향은 언제나 침묵이다). */
      대조 = 라이브대조(projRoot, root, { timeout: 시간제한 });
    } catch (e) {
      return 못읽음(이름, '라이브를 임시 디렉터리로 못 받았다', e);
    }
  }
  /* 미커밋은 로컬(git)이라 네트워크 갈래와 무관하게 늘 잰다 — 못 재면 null(모름)로 넘겨
   * 판정이 초록의 뜻을 낮춰 적게 한다. 0 으로 접는 순간 F310 이 초록의 모습으로 돌아온다. */
  return 판정({ 이름, 경로, fp: 지문(projRoot, root), deployments, 대조, 미커밋: 배포집합미커밋(projRoot, root) });
}

/* ── 네트워크 0 재료 ─────────────────────────────────────────────────────────
 * 「저장소가 마지막 배포 커밋보다 앞서 있다」를 git 만으로 잰다.
 *
 * 🔴 왜 있나 (F240): 위 `판정()` 은 @HEAD 프로젝트(=이 저장소 메인)에서 `대조` 없이는
 *   `측정:false` 로 답하고, 그 대조를 들고 오는 유일한 상시 호출자가 rot-check 주간(7일
 *   스로틀)이다. 즉 라이브가 뒤처져도 **최대 7일간 아무 화면에도 안 뜬다.**
 *   실측 2026-08-08: 상담AI 채널 칸(`56e7d20` · 소급 불가)이 24시간째 라이브에 없었는데,
 *   그 커밋 본문이 스스로 「다음 배포에 나간다」고 적고도 그 약속을 든 장치가 없었다.
 *
 * 재료 = **마지막 채번 커밋**(`Code.js` 의 `const SYNK_VERSION` 줄이 바뀐 커밋). 제목이 아니라
 *   **내용**에서 센다 — 그 줄은 `bump-version.js` 가 기계로 쓰지만(`:37`·`:263` — 「목록을 못
 *   읽어도 Code.js 는 반드시 본다」) 제목의 `[vN]` 자리는 사람이 정해서 **실제로 갈린다.**
 *   ⚠ 옛 판은 제목을 `--grep '^\[v'` 로 봤고, 그래서 **매 SessionStart 마다 거짓으로 울었다**
 *   (#Q75 · 실측 2026-08-14): 버전 태그를 단 커밋 290 중 머리 255 · **그 밖 35**, 그 「그 밖」의
 *   최신인 `015b9fd4`(「… 개명 — 뜻이 안 서는 낱말 **[v9.231]**」)가 안 걸려 기준선이 한 칸 낡은
 *   `e61ef44`([v9.230])로 잡혔고, 드리프트가 **0인** 저장소가 「커밋 203개 · 배포 파일 4개」로
 *   울었다. 기준선을 `015b9fd4` 로 놓고 재면 배포집합 diff 는 0건이다.
 *   🚫 **정규식을 아무 데나 매칭하도록 넓히는 것이 처방이 아니다** — 그 35 의 다수가 「docs: 보드
 *   … ([v9.227] `dbfa38d2`)」처럼 버전을 **언급만** 하는 커밋이라, 그게 기준선이 되면 진짜
 *   드리프트를 조용히 덮는다(새는 방향 = 언제나 「통과」 · 맹점 ④).
 *   태그도 못 쓴다 — bump-version 이 origin 에 원자 채번하느라 태그가 배포와 무관한 커밋에
 *   붙는다(실측 2026-08-08: `synk-v9.192` 는 배포 커밋 `1c683fd` 가 아니라 그 뒤 보드 문서 커밋
 *   `6f6ac43` 에 붙어 있었다 — 태그로 재면 마지막 배포가 늘 「안 나간 것」으로 잡힌다).
 *   ⚠ **이 재료의 대가**(맹점 ④): 기준선이 `Code.js` 의 그 줄 하나에 걸려 있다 — 상수를 다른
 *   파일로 옮기거나 `Code.js` 를 개명하면 기준선이 `null` 이 되고, 호출부는 「배포 커밋이 없다」를
 *   **말하지 않도록** 되어 있어(`작업본소유자.js` 침묵 조건) 이 층이 **조용히 죽는다.** 그 자리를
 *   `tests/작업본소유자.test.js` 의 「채번 상수가 실저장소에 살아 있나」가 fail 로 잡는다.
 *
 * ⚠ 이건 **간접 증거다.** 라이브를 읽어서 「뒤처졌다」를 아는 게 아니라, 저장소가 배포
 *   커밋보다 앞섰다는 것만 안다 — 호출부는 그 문장 그대로 써야 한다(F030 축).
 *
 * 🔴 이 기준선은 **양방향으로 틀린다**(F244 · 2026-08-08 실측). 배포와 채번은 서로 독립된
 *   사건인데 이 함수는 `[vN]` 커밋 하나로 둘을 대신한다:
 *   ① `[vN]` 을 달고도 clasp push 를 못 한 판 → 기준선이 그 커밋으로 옮겨가 **영원히 침묵**.
 *      실측 `46897fe [v9.193]`(커밋·origin push 완료 · clasp push 만 미실행)에 대해 이 함수는
 *      `커밋수 16 · 프로젝트들 []` 을 냈다. CLAUDE.md 가 커밋 직전 bump-version 을 시키므로
 *      **게이트에 막힌 배포는 거의 늘 `[vN]` 을 단 채 남는다** — 드문 형태가 아니다.
 *   ② 채번 없이 나간 배포 → 그 뒤 커밋이 계속 「안 나갔다」로 잡혀 거짓양성.
 *   🚫 「그건 deploy-freshness 몫」으로 돌리지 않는다 — 그 훅은 PostToolUse 라 clasp push 를
 *      **아예 안 한** 경우엔 원리상 안 뜬다(옛 판이 그렇게 적었고 그 routing 이 틀렸다).
 *   네트워크 0 으로는 「그 `[vN]` 이 라이브에 닿았나」를 원리상 못 가른다(태그·로컬 상태 파일·
 *   origin push 셋 다 죽은 재료다). 그래서 진짜 재료인 `라이브대조()` 를 rot-check 의
 *   **하루 스로틀**로 뗐다 — 이 함수는 그 아래 깔리는 싸고 거친 층(267ms)으로 남는다.
 *
 * 돌려주는 값: `null` = git 을 못 불렀다(모름) · `{배포커밋:null}` = 잴 기준이 없다
 *   · `{배포커밋, 제목, 커밋수, 프로젝트들:[{이름,경로,파일들}]}` — 프로젝트들이 비면 깨끗하다.
 */

/** 채번 정본 — `bump-version.js` 가 기계로 쓰는 자리 그대로다(그 파일 `CODE`·`codePath()`).
 *  ⚠ 이름을 여기 한 벌만 둔다: 같은 판정을 두 곳에 적으면 갈라지고, 갈라진 쪽은 기준선을 못 찾아
 *  **조용히** 「잴 기준이 없다」로 떨어진다(맹점 ④ — 새는 방향은 언제나 침묵이다). */
const 채번파일 = 'Code.js';
/** `git log -G` 는 기본 정규식(BRE)이고 `^` 는 diff 줄 **내용**에 걸린다(2026-08-14 실측 — 앵커
 *  유무 둘 다 같은 커밋을 골랐고, 선언만 잡도록 앵커 쪽을 쓴다: 주석·문자열 속 언급을 뺀다). */
const 채번줄RE = "^const SYNK_VERSION = '";

/* ── 라이브 실측 도장 ────────────────────────────────────────────────────────
 * 위 ②(채번 없이 나간 배포 뒤의 커밋이 계속 「안 나갔다」로 잡히는 거짓양성)만은 재울 재료가
 * 있다 — rot-check 이 하루 1회 `라이브대조()` 로 **실제로 잰** 결과다. ①(거짓음성)은 여전히
 * 이 층의 재료로 못 잰다: 재우는 방향으로만 쓰고 깨우는 방향으로는 쓰지 않는다.
 *
 * 왜 필요한가 (2026-08-10 실측 · `local_a621f018`): 같은 시각에 두 재료가 정반대를 냈다 —
 *   `안나간변경()` = 「엔진_셋업확장.js 안 나갔다」 / `라이브대조()` = 「배포집합 15개 바이트
 *   동일」. 이 층은 **매 SessionStart** 마다 발화하므로 거짓 🔴 도 매번이고, 그러면 진짜
 *   드리프트가 왔을 때 같은 문장이 이미 무시당하고 있다(rot-check 배포 절 머리말 · F113).
 *
 * 🔑 도장에 **그때의 배포집합 지문**을 같이 남기는 것이 급소다. 시각만 남기면 실측 뒤에 배포
 *   파일이 바뀌어도 계속 침묵해서, 거짓양성을 지우는 대신 **거짓음성**을 만든다(더 나쁜 쪽).
 *   지문이 같다 = 그 실측 이후 clasp 가 밀 내용이 한 바이트도 안 바뀌었다.
 * ⚠ 못 덮는 자리: 실측 뒤 **라이브 쪽**이 바뀐 경우(남이 옛 판을 밀거나 편집기 손편집).
 *   그건 이 층의 재료로는 원리상 못 본다 — rot-check 이 다시 재서 잡는다. ⚠ **「하루면 잡힌다」로
 *   읽지 말 것**: rot-check 이 라이브를 못 재는 환경(`SYNK_ROT_LIVE=0`·폰·CI·오프라인)에서는
 *   도장이 갱신되지 않아 **옛 도장이 무기한 유효**하다. 그 자리에서 이 층은 배포집합이 바뀌기
 *   전까지 침묵한다 — 나이 제한을 안 두는 이유는 제한을 넘긴 순간 원래의 상시 거짓 🔴 로
 *   그대로 돌아가기 때문이고, 재료(지문)가 「그 사이 밀 내용이 안 바뀌었다」까지는 보증한다.
 * 🚫 새 상태 파일을 만들지 않는다(그 재제안은 이미 죽었다) — rot-check 이 이미 쓰는 파일에 키
 *   하나로 얹고, **경로도 거기서 파생시킨다.** 두 곳에 경로를 적으면 갈라지고 갈라진 쪽은
 *   조용히 「도장 없음」= 안 재움이 된다(새는 방향이 소음이라 침묵보다는 낫지만 여전히 결함). */
const 도장키 = '배포실측';

/** 마지막 라이브 실측 도장. `null` = 없거나 못 읽음(= 모름 → 아무것도 안 재운다). */
function 라이브도장(root = ROOT) {
  let f;
  /* lazy require — rot-check 은 `배포Section` **안에서** 이 모듈을 부르므로 최상위 순환이 없다.
   * 못 부르면 도장 없음으로 떨어진다: 이 함수가 깨져도 옛 동작(=늘 발화)으로 퇴화할 뿐이다. */
  try { f = require(path.join(__dirname, 'rot-check.js')).stateFile(); } catch (_) { return null; }
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    const d = j && j[도장키];
    return d && d.프로젝트들 && typeof d.프로젝트들 === 'object' ? d : null;
  } catch (_) { return null; }
}

/** 지문은 배포집합 전체를 읽는다 — 그 사이 남이 파일을 지우면 던진다. 못 재면 **안 재운다**. */
function 지문못하면널(projRoot, root) {
  try { return 지문(projRoot, root); } catch (_) { return null; }
}

function 안나간변경(root = ROOT, 프로젝트들목록 = null, { 도장 = true } = {}) {
  /* 프로젝트 목록을 인자로 열어 둔 이유는 **픽스처 하나** 때문이다 — `claspProjects()` 는
   * 자기 ROOT 고정이라, 이걸 안 열면 탐지력을 실저장소로만 잴 수 있고 그건 곧 CI 에서
   * 「자격증명이 없어서 초록」이 되는 그 자리다. 기본값은 그대로라 호출부는 안 바뀐다. */
  const git = (args) => {
    try {
      return execFileSync('git', ['-c', 'core.quotepath=false', ...args],
        { cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true })
        .split(/\r?\n/).filter(Boolean);
    } catch (_) { return null; }   // 실패는 「변경 0」이 아니라 모름이다
  };
  /* 구분자를 안 쓴다 — 커밋 제목엔 한글·가운뎃점·괄호가 흔해 보이는 구분자를 못 쓰고,
   * 안 보이는 제어문자를 소스에 적으면 어느 편집이 지워도 티가 안 난다(F091).
   * sha 는 공백을 못 담으므로 **첫 공백**이 언제나 옳은 경계다. */
  const 마지막 = git(['log', '-G', 채번줄RE, '-n', '1', '--format=%H %s', '--', 채번파일]);
  if (마지막 === null) return null;
  if (!마지막.length) return { 배포커밋: null };
  const 줄 = String(마지막[0]);
  const 빈칸 = 줄.indexOf(' ');
  const sha = 빈칸 < 0 ? 줄 : 줄.slice(0, 빈칸);
  const 제목 = 빈칸 < 0 ? '' : 줄.slice(빈칸 + 1);
  const 바뀜 = git(['diff', '--name-only', sha, 'HEAD']);
  const 센것 = git(['rev-list', '--count', `${sha}..HEAD`]);
  if (바뀜 === null || 센것 === null) return null;
  const 찍힘 = 도장 ? 라이브도장(root) : null;
  const 프로젝트들 = [];
  const 가라앉힘 = [];
  for (const p of 프로젝트들목록 || claspProjects()) {
    const 상대 = path.relative(root, p).replace(/\\/g, '/');
    const 파일들 = 바뀜.filter((f) => 프로젝트.isDeployFile(f, p, root));
    if (!파일들.length) continue;
    const 항 = { 이름: 상대 || '(루트)', 경로: 상대 || '.', 파일들 };
    /* 도장 이름은 `점검()` 이 쓰는 것과 **같은 규칙**으로 만들어진다(`path.relative || '(루트)'`).
     * 규칙이 갈리면 조회가 늘 빗나가 이 배선이 통째로 죽는데, 죽는 모양이 「옛 동작」이라 안 보인다. */
    const 실측 = 찍힘 && 찍힘.프로젝트들[항.이름];
    const fp = 실측 && 실측.초록 ? 지문못하면널(p, root) : null;
    if (fp && 실측.지문 === fp) { 가라앉힘.push({ ...항, 잰때: 찍힘.at || null, 지문: fp }); continue; }
    프로젝트들.push(항);
  }
  /* 가라앉힌 것을 **구조로** 돌려준다 — 조용히 지우면 호출부가 「이게 전부」로 읽고, 그건 이
   * 도구가 고치려는 병(침묵과 통과가 같은 모양)을 자리만 옮긴 것이다. */
  return { 배포커밋: sha.slice(0, 7), 제목, 커밋수: Number(센것[0]) || 0, 프로젝트들, 가라앉힘 };
}

module.exports = { 배포집합, 지문, 배포목록, 라이브대조, 라이브판찾기, 못읽음, 판정, 점검, 지문표기, FP_RE, claspProjects, 안나간변경, 라이브도장, 도장키, 미커밋집합, 배포집합미커밋 };

if (require.main === module) {
  const 라이브 = process.argv.includes('--라이브');
  const 결과 = claspProjects().map((p) => 점검(p, ROOT, { 라이브 }));
  결과.forEach((r) => r.lines.forEach((l) => console.log(l)));
  if (!라이브 && 결과.some((r) => r.측정 === false)) {
    console.log('\n안 잰 프로젝트가 있다 — 라이브 바이트까지 보려면: node tools/배포판점검.js --라이브');
  }
  const 나쁨 = 결과.filter((r) => r.level === 'stale');
  if (process.argv.includes('--check') && 나쁨.length) process.exit(1);
  process.exit(0);
}
