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
    return { 다름, 라이브없음, 저장소없음, 총: 집합.length };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* ── 판정 (순수 함수) ────────────────────────────────────────────────────────
 * 네트워크·파일시스템을 안 탄다 — **탐지력은 여기서 픽스처로 못박는다.**
 * 실저장소·라이브를 요구하는 검사는 CI 에서 못 돌고, 그걸 탐지력의 근거로 삼으면
 * 「자격증명이 없어서 초록」이 된다. */
function 판정({ 이름, 경로, fp, deployments, 대조 }) {
  const 고정 = (deployments || []).filter((d) => d.ver !== 'HEAD' && !d.temp);
  if (!고정.length) {
    /* 🔴 `대조` 가 없으면 이 갈래는 **아무것도 안 잰 것**이다. 문장을 그렇게 쓴다 —
     *   level 은 'ok' 로 둔다: 이 갈래를 밟는 유일한 상시 호출자가 `clasp push` **직후**에
     *   도는 deploy-freshness 훅이고, 그 순간엔 라이브가 실제로 최신이라 경보가 거짓이 된다.
     *   측정은 `라이브대조()` 를 들고 오는 호출자(rot-check 주간·`--라이브`)가 한다. */
    if (!대조) {
      return {
        level: 'ok', 이름, 측정: false,
        lines: [`${이름}: 고정 버전 배포 없음(@HEAD) — 지문을 심을 자리가 없어 **이 층은 안 쟀다**(재려면 --라이브)`],
      };
    }
    const { 다름 = [], 라이브없음 = [], 저장소없음 = [], 총 = 0 } = 대조;
    if (!다름.length && !라이브없음.length && !저장소없음.length) {
      return { level: 'ok', 이름, 측정: true, lines: [`${이름}: 라이브 = 저장소 (@HEAD · 배포집합 ${총}개 바이트 동일)`] };
    }
    const lines = [`🔴 ${이름} 라이브가 저장소와 다르다 (@HEAD · 배포집합 ${총}개) — **push 가 빠졌다**`];
    const 보고 = (제목, 목록) => { for (const r of 목록) lines.push(`   ${제목} ${r}`); };
    보고('내용 다름:', 다름);
    보고('라이브에 없음(push 된 적 없다):', 라이브없음);
    보고('라이브에만 있음(지웠는데 계속 돈다):', 저장소없음);
    /* 처방 줄에 금지된 명령을 **글자로도** 안 적는다 — 설명이어도 눈은 명령으로 읽고 복사한다
     * (회귀가 이 줄을 잡았다: 처음엔 "손 clasp push 는 …가 막는다"라고 적어 뒀었다). */
    lines.push(`   → cd ${경로 || '.'} && /deploy   (손으로 미는 통로는 clasp-guard 가 막는다)`);
    /* 파일 목록을 **구조로도** 낸다 — 호출부가 「push 가 빠졌다」와 「지금 누가 고치는 중이다」를
     * 가르려면 이 목록이 필요한데, 문장에서 되뽑으면 문구가 바뀌는 날 조용히 안 갈린다. */
    return { level: 'stale', 이름, 측정: true, lines, 파일들: [...다름, ...라이브없음, ...저장소없음] };
  }

  const 낡음 = [], 모름 = [], 최신 = [];
  for (const d of 고정) {
    const m = FP_RE.exec(d.desc || '');
    if (!m) 모름.push(d);
    else if (m[1] === fp) 최신.push(d);
    else 낡음.push(d);
  }

  if (!낡음.length && !모름.length) {
    return { level: 'ok', 이름, lines: [`${이름}: 라이브 최신 (${지문표기(fp)} · 배포 ${최신.length}건)`] };
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
  return { level: 낡음.length ? 'stale' : 'unknown', 이름, lines };
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
  return 판정({ 이름, 경로, fp: 지문(projRoot, root), deployments, 대조 });
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
 * 재료 = **마지막 배포 커밋**(제목이 `[vN]` 으로 시작). 태그는 못 쓴다 — bump-version 이
 *   origin 에 원자 채번하느라 태그가 배포와 무관한 커밋에 붙는다(실측 2026-08-08:
 *   `synk-v9.192` 는 배포 커밋 `1c683fd` 가 아니라 그 뒤 보드 문서 커밋 `6f6ac43` 에 붙어
 *   있었다 — 태그로 재면 마지막 배포가 늘 「안 나간 것」으로 잡혀 상시 거짓양성이 된다).
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
function 안나간변경(root = ROOT, 프로젝트들목록 = null) {
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
  const 마지막 = git(['log', '-E', '--grep', '^\\[v', '-n', '1', '--format=%H %s']);
  if (마지막 === null) return null;
  if (!마지막.length) return { 배포커밋: null };
  const 줄 = String(마지막[0]);
  const 빈칸 = 줄.indexOf(' ');
  const sha = 빈칸 < 0 ? 줄 : 줄.slice(0, 빈칸);
  const 제목 = 빈칸 < 0 ? '' : 줄.slice(빈칸 + 1);
  const 바뀜 = git(['diff', '--name-only', sha, 'HEAD']);
  const 센것 = git(['rev-list', '--count', `${sha}..HEAD`]);
  if (바뀜 === null || 센것 === null) return null;
  const 프로젝트들 = [];
  for (const p of 프로젝트들목록 || claspProjects()) {
    const 이름 = path.relative(root, p).replace(/\\/g, '/');
    const 파일들 = 바뀜.filter((f) => 프로젝트.isDeployFile(f, p, root));
    if (파일들.length) 프로젝트들.push({ 이름: 이름 || '(루트)', 경로: 이름 || '.', 파일들 });
  }
  return { 배포커밋: sha.slice(0, 7), 제목, 커밋수: Number(센것[0]) || 0, 프로젝트들 };
}

module.exports = { 배포집합, 지문, 배포목록, 라이브대조, 못읽음, 판정, 점검, 지문표기, FP_RE, claspProjects, 안나간변경 };

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
