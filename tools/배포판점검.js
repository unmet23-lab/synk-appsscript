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
 * ■ 실제 확인과 간접 증거 (2026-09-11)
 *   --라이브는 고정 배포 유무와 관계없이 프로젝트 HEAD와 각 상시 고정 버전의 원문을 받는다.
 *   설명 지문만 읽는 기본 모드는 측정:false다. 모든 내용을 읽은 뒤에만 실측 도장을 남긴다.
 *   clasp가 줄바꿈을 바꿔 내려준 경우 내용 일치와 원문 바이트 불일치를 따로 표시한다.
 *   CRLF/LF 차이를 영구 뒤처짐으로 만들지 않으며, 줄끝 공백을 포함한 나머지 차이는 남긴다.
 *   받는 곳은 작업본 밖의 임시 디렉터리다. 현재 운영 원칙에 따라 작업본에 pull로 덮어쓰지 않는다.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
/* 표기 접기 정의는 저장소에 하나뿐이다 — `tests/lib/소스검사.js`. 손으로 접으면 CRLF 축만 막히고
 * 줄끝 공백 축은 샌다(도구층 실측 08-17: 손 접기 12벌 **전부** 그 반쪽 · #Q101). 여기서 새면
 * 라이브 판 대조가 「모름」으로 접히고, 모름은 침묵이라 통과와 같은 모양이 된다. */
const { 표기접기 } = require('../tests/lib/소스검사.js');

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
  // 2026-10-02 crewcard 처럼 지운 프로젝트는 올릴 파일이 없다(옛 커밋을 다시 판정할 때 이 경로로 온다).
  if (!fs.existsSync(projRoot)) return out;
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

/* 수동 배포 검사의 실측 기록을 사용한다. */
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
function 배포목록(projRoot, { timeout = 20000 } = {}) {
  const isWin = process.platform === 'win32';
  const bin = isWin ? path.join(process.env.APPDATA || '', 'npm', 'clasp.cmd') : 'clasp';
  const file = isWin ? (process.env.ComSpec || 'cmd.exe') : bin;
  const args = isWin ? ['/c', bin, 'deployments'] : ['deployments'];
  const out = execFileSync(file, args, {
    cwd: projRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout, windowsHide: true,
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
  const n = 표기접기;
  const 라이브 = n(라이브내용);
  let 줄들;
  try {
    줄들 = execFileSync('git', ['log', `-${창}`, '--format=%H %s', '--', rel], {
      cwd: root, encoding: 'utf8', maxBuffer: 8 << 20, timeout: 15000, windowsHide: true,
    }).trim().split(/\r?\n/).filter(Boolean);
  } catch (_) { return { 종류: '모름', 사유: 'git 이력을 못 읽었다' }; }

  for (const l of 줄들) {
    const sha = l.slice(0, 40);
    let 옛;
    try {
      옛 = execFileSync('git', ['show', `${sha}:${rel}`], { cwd: root, maxBuffer: 64 << 20, timeout: 15000, windowsHide: true }).toString('utf8');
    } catch (_) { continue; }               // 그 판엔 그 경로가 없었다 — 다음 판으로
    if (n(옛) === 라이브) return { 종류: '뒤처짐', sha: sha.slice(0, 8), 제목: l.slice(41) };
  }
  return { 종류: '모름', 사유: `이 경로의 최근 ${창}판 중 같은 것이 없다` };
}

/* 파일별 「라이브 = 어느 판」을 **한 칸으로 접는다** — 아래 층(`안나간변경`)이 기준선으로 쓸 값이다.
 * 접는 방향이 곧 새는 방향이라 여기서 못박는다 (F474 · 2026-08-15):
 *   · 파일별 sha 는 「그 파일이 라이브와 같은 **가장 최근** 판」이라 참값(=실제로 밀린 커밋 C)보다
 *     언제나 **뒤**다(C 이후로 그 파일이 안 바뀐 구간의 끝). 그래서 **가장 오래된 것**을 고른다 —
 *     그보다 뒤를 고르면 안 나간 파일을 놓치고(거짓음성 · 이 트랙이 고치는 병 그 자체),
 *     앞을 고르면 검토 파일이 몇 개 느는 것뿐이다(거짓양성 · 이 도구가 스스로 싸다고 적어 둔 쪽).
 *   · 한 파일이라도 판을 **못 찾으면 통째로 모름**이다 — 못 찾은 그것이 하필 가장 오래된 판일 수
 *     있고, 그러면 남은 것으로 고른 기준선은 그 파일을 조용히 뺀다(침묵 = 통과).
 * ⚠ 「라이브에 없음(push 된 적 없다)」은 여기서 안 본다 — 그 파일이 이 기준선 뒤에 태어났으면
 *   diff 가 그대로 잡고, 앞에서 태어났으면 못 잡는다. 못 잡는 쪽은 채번 기준선도 똑같이 못 잡으므로
 *   **오늘보다 좁아지지 않는다**(아래 `안나간변경` 의 「더 오래된 쪽」 규칙이 그것을 보증한다). */
function 라이브판접기(다름, 방향, root = ROOT) {
  const git1 = (args) => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 15000, windowsHide: true }).trim(); }
    catch (_) { return null; }
  };
  const shas = [];
  for (const rel of 다름) {
    const d = 방향 && 방향[rel];
    if (!d || d.종류 !== '뒤처짐' || !d.sha) return { 종류: '모름', 사유: `${rel} 의 라이브 판을 못 찾았다` };
    if (!shas.includes(d.sha)) shas.push(d.sha);
  }
  if (!shas.length) return { 종류: '모름', 사유: '내용이 다른 파일이 없다' };
  /* 「가장 오래된」을 거리로 잰다 — HEAD 까지의 커밋 수가 가장 큰 것. 못 재면 모름이다. */
  let 고름 = null, 최대 = -1;
  for (const s of shas) {
    const n = Number(git1(['rev-list', '--count', `${s}..HEAD`]));
    if (!Number.isFinite(n)) return { 종류: '모름', 사유: `${s} 까지의 거리를 못 쟀다` };
    if (n > 최대) { 최대 = n; 고름 = s; }
  }
  return { 종류: '뒤처짐', sha: 고름 };
}

/* 프로젝트 HEAD 또는 지정한 고정 버전을 임시 디렉터리로 받아 **원문 바이트로** 대조한다.
 * versionNumber 생략 = 프로젝트 HEAD. 설명 지문은 실제 버전 내용의 증거로 쓰지 않는다.
 * ⚠ `cwd` 는 반드시 작업본 **밖**이다. 작업본에 pull 하면 옆 세션의 커밋이 라이브 판으로
 *   되돌아간다(F040). 임시 디렉터리는 끝나면 지운다. */
function 라이브대조(projRoot, root = ROOT, { timeout = 120000, versionNumber } = {}) {
  if (versionNumber !== undefined && !/^[1-9]\d*$/.test(String(versionNumber))) throw new Error('고정 버전 번호가 올바르지 않다');
  const cfg = JSON.parse(fs.readFileSync(path.join(projRoot, '.clasp.json'), 'utf8'));
  const 임시기준 = fs.realpathSync(os.tmpdir());
  const tmp = fs.mkdtempSync(path.join(임시기준, 'synk-live-'));
  const 저장소접두 = path.relative(root, projRoot);
  const 원격경로 = (rel) => path.relative(projRoot, path.join(root, rel));
  const 저장소경로 = (rel) => path.join(저장소접두, rel).replace(/\\/g, '/');
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
    const 명령 = ['pull', ...(versionNumber === undefined ? [] : ['--versionNumber', String(versionNumber)])];
    execFileSync(isWin ? (process.env.ComSpec || 'cmd.exe') : bin, isWin ? ['/c', bin, ...명령] : 명령, {
      cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout, windowsHide: true,
    });

    const 집합 = 배포집합(projRoot, root);
    const 다름 = [], 라이브없음 = [];
    for (const rel of 집합) {
      const 라이브 = path.join(tmp, 원격경로(rel));
      if (!fs.existsSync(라이브)) { 라이브없음.push(rel); continue; }
      if (!fs.readFileSync(path.join(root, rel)).equals(fs.readFileSync(라이브))) 다름.push(rel);
    }
    /* 반대 방향도 본다 — 저장소에서 지운 파일이 라이브에 남아 있으면 그 코드는 **계속 돈다.**
     * 한 방향만 재면 「지웠다」가 「안 돈다」로 읽힌다. */
    const 저장소없음 = fs.readdirSync(tmp, { recursive: true })
      .filter((p) => p !== '.clasp.json' && fs.lstatSync(path.join(tmp, p)).isFile())
      .map(저장소경로)
      .filter((p) => !집합.includes(p));
    /* 내용이 다른 것만 방향을 잰다 — 라이브없음·저장소없음 은 존재 자체가 이미 방향이다. */
    const 방향 = {}, 표기차이 = [];
    for (const rel of 다름) {
      const 원격 = fs.readFileSync(path.join(tmp, 원격경로(rel)), 'utf8');
      // 줄끝 공백은 템플릿 문자열의 내용일 수 있어 지우지 않는다. 내려받으며 바뀌는 CRLF/LF만 구분한다.
      if (원격.replace(/\r\n/g, '\n') === fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n')) {
        표기차이.push(rel);
        방향[rel] = { 종류: '표기차이', 사유: 'CRLF/LF만 바꾸면 같음(원문 바이트는 다름)' };
      } else 방향[rel] = 라이브판찾기(rel, 원격, root);
    }
    /* 뒤처졌을 때만 접는다 — 「바이트 전부 동일」이면 라이브 = 작업본이라 넓힐 것이 없고(아래
     * 「더 오래된 쪽」 규칙이 언제나 채번을 고른다), 그 갈래에서 HEAD 를 적으면 미커밋이 있을 때
     * 「라이브 = HEAD」라는 안 잰 주장이 도장에 박힌다(F310 이 정확히 그 자리다). */
    const 라이브판 = 다름.length ? 라이브판접기(다름, 방향, root) : null;
    return { 다름, 라이브없음, 저장소없음, 방향, 라이브판, 표기차이, 총: 집합.length, versionNumber: versionNumber === undefined ? null : Number(versionNumber) };
  } finally {
    // 우리가 생성한 임시 디렉터리 하나만 지운다. 작업본·계산된 상위 경로는 삭제 대상이 아니다.
    if (path.dirname(path.resolve(tmp)) !== 임시기준 || !path.basename(tmp).startsWith('synk-live-')) throw new Error('임시 디렉터리 정리 경로 확인 실패');
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* ── 판정 (순수 함수) ────────────────────────────────────────────────────────
 * 네트워크·파일시스템을 안 탄다 — **탐지력은 여기서 픽스처로 못박는다.**
 * 실저장소·라이브를 요구하는 검사는 CI 에서 못 돌고, 그걸 탐지력의 근거로 삼으면
 * 「자격증명이 없어서 초록」이 된다. */
function 판정({ 이름, 경로, fp, deployments, 대조, 미커밋, 대상 = '프로젝트 HEAD' }) {
  const 고정 = (deployments || []).filter((d) => d.ver !== 'HEAD' && !d.temp);
  if (!고정.length) {
    /* 수동 배포 검사의 실측 기록을 사용한다. */
    if (!대조) {
      const lines = [`${이름}: 고정 버전 배포 없음(@HEAD) — 지문을 심을 자리가 없어 **이 층은 안 쟀다**(재려면 --라이브)`];
      if (미커밋 && 미커밋.length) {
        lines.push(`⚠ 배포집합에 **미커밋 ${미커밋.length}건** — push 는 HEAD 가 아니라 작업본을 민다(F310): 직전 push 가 이 내용을 실었을 수 있다`);
        for (const f of 미커밋) lines.push(`   미커밋: ${f}`);
        lines.push('   → 실렸는지는 원문 바이트로 잰다: node tools/배포판점검.js --라이브 · 진행 중인 담당 작업과 변경 소유를 확인한다');
        return { level: 'warn', 이름, 측정: false, 미커밋, lines };
      }
      return { level: 'ok', 이름, 측정: false, 미커밋: 미커밋 || null, lines };
    }
    const { 다름 = [], 라이브없음 = [], 저장소없음 = [], 총 = 0 } = 대조;
    const 표기차이 = 대조.표기차이 || [];
    const 원문바이트일치 = !다름.length && !라이브없음.length && !저장소없음.length;
    if (!다름.some((f) => !표기차이.includes(f)) && !라이브없음.length && !저장소없음.length) {
      const 같은범위 = 원문바이트일치 ? `배포집합 ${총}개 원문 바이트 동일`
        : `배포집합 ${총}개 내용 일치(CRLF/LF 차이만) · 원문 바이트 불일치 ${표기차이.length}개`;
      const 표기줄 = 표기차이.map((f) => `   줄바꿈 차이: ${f} — CRLF/LF만 바꾸면 같음(원문 바이트는 다름)`);
      /* 🔴 F310 실측 갈래 — 「바이트 동일」인데 그 바이트가 미커밋이다: 라이브 = 작업본 ≠ HEAD.
       *   이 초록의 원래 문장이 정확히 그 유출을 덮던 자리다(F309: push 직후 배포집합 미커밋 0 을
       *   확인해야 「라이브=작업본」이 비로소 「라이브=HEAD」를 뜻한다). */
      if (미커밋 && 미커밋.length) {
        return {
          level: 'stale', 이름, 측정: true, 미커밋, 원문바이트일치, 표기차이,
          lines: [
            `🔴 ${이름}: ${대상} ${같은범위} — 그러나 그 중 **미커밋 ${미커밋.length}건**: Git HEAD와 같다고 할 수 없다`,
            ...표기줄,
            ...미커밋.map((f) => `   미커밋: ${f}`),
            '   → 변경 소유와 완성 상태를 확인한다. 승인된 자기 변경만 검증·커밋하고, 다른 담당의 미커밋은 보존한다.',
          ],
        };
      }
      const 꼬리 = 미커밋 ? ' · 미커밋 0' : ' · ⚠미커밋 못 잼: Git HEAD와의 일치는 미확인';
      return { level: 'ok', 이름, 측정: true, 미커밋: 미커밋 || null, 원문바이트일치, 표기차이,
        lines: [`${이름}: ${대상} ${같은범위}${꼬리}`, ...표기줄] };
    }
    /* 🔑 「다르다」는 방향이 아니다 — 저장소가 앞선 것과 라이브에 손편집이 있는 것이 같은 모양이다.
     *   방향을 못 재고 「push 가 빠졌다」로 단정하면, 처방(=밀어라)이 남의 편집을 지우라는 말이 된다.
     *   그래서 셋으로 나눠 적는다: 실측 뒤처짐 · 방향 미측정(옛 호출자) · 못 가름. */
    const 방향 = 대조.방향 || null;
    const 못가름 = 방향 ? 다름.filter((r) => !방향[r] || !['뒤처짐', '표기차이'].includes(방향[r].종류)) : [];
    const 꼬리 = !다름.length ? ''
      : !방향 ? ' — 방향 미측정'
        : 못가름.length ? ' — 🔴 **방향을 못 갈랐다**'
          : ' — 아래 파일별 차이 참조';
    const lines = [`🔴 ${이름}: ${대상}가 작업본과 다르다 (배포집합 ${총}개 원문 바이트 대조)${꼬리}`];
    const 보고 = (제목, 목록) => { for (const r of 목록) lines.push(`   ${제목} ${r}`); };
    for (const r of 다름) {
      const d = 방향 && 방향[r];
      lines.push(`   내용 다름: ${r}`
        + (!d ? ''
          : d.종류 === '표기차이' ? `  ← ${d.사유}`
            : d.종류 === '뒤처짐' ? `  ← 줄바꿈·줄끝 공백을 접은 원격 내용 = ${d.sha} ${d.제목}`
            : `  ← 🔴 라이브 판을 못 찾았다(${d.사유})`));
    }
    보고('원격에 없음:', 라이브없음);
    보고('원격에만 있음(현재 배포집합 밖):', 저장소없음);
    /* 미커밋 두 갈래(F310) — 배포집합의 미커밋 파일은 라이브와 ①다르거나 ②같거나 둘뿐이다.
     * ①은 「지금 누가 고치는 중」일 수 있어 처방(/deploy)을 그대로 따르면 남의 반쪽 작업을 밀고,
     * ②는 이미 실려 나간 것이다 — 어느 쪽도 조용히 지나가면 안 된다. */
    if (미커밋 && 미커밋.length) {
      const 겹침 = 미커밋.filter((f) => 다름.includes(f) || 라이브없음.includes(f));
      const 유출 = 미커밋.filter((f) => !다름.includes(f) && !라이브없음.includes(f) && !저장소없음.includes(f));
      if (유출.length) lines.push(`   🔴 미커밋인데 라이브와 **바이트 동일** ${유출.length}건 — 이미 실려 나갔다(F310): ${유출.join(' · ')}`);
      if (겹침.length) lines.push(`   ⚠ 위 목록 중 미커밋 ${겹침.length}건(${겹침.join(' · ')}) — 진행 중인 담당 작업과 변경 소유를 확인하고 보존한다`);
    }
    /* 못 가른 파일이 있으면 처방을 **밀기 전 확인**으로 한 칸 앞당긴다 — 그냥 /deploy 를 주면
     * 이 경고는 읽히지 않고 넘어간다(경고가 처방과 어긋나면 사람은 처방만 따른다). */
    if (못가름.length) {
      lines.push('   ⚠ 밀기 전에 확인한다 — 위 🔴 파일의 라이브 내용이 이 저장소 이력 어디에도 없다.');
      lines.push('     ①이력이 얕거나(CI·얕은 클론) ②라이브에 편집기 손편집이 있다 — ②면 미는 순간 그것이 사라진다.');
      lines.push('     원격 원문과 담당 작업을 먼저 대조한다. 작업본에 clasp pull로 덮어쓰지 않는다.');
    }
    /* 처방 줄에 금지된 명령을 **글자로도** 안 적는다 — 설명이어도 눈은 명령으로 읽고 복사한다
     * (회귀가 이 줄을 잡았다: 처음엔 "손 clasp push 는 …가 막는다"라고 적어 뒀었다). */
    lines.push(`   → ${경로 || '.'}의 승인된 배포 범위를 기존 deploy 스킬·도구로 반영한 뒤 --라이브로 다시 확인한다`);
    /* 파일 목록을 **구조로도** 낸다 — 호출부가 「push 가 빠졌다」와 「지금 누가 고치는 중이다」를
     * 가르려면 이 목록이 필요한데, 문장에서 되뽑으면 문구가 바뀌는 날 조용히 안 갈린다.
     * `못가름` 도 같은 이유로 구조다 — 문장에서 🔴 를 세는 호출부는 문구가 바뀌는 날 조용해진다. */
    /* `라이브판` 도 구조로 낸다 — 이 값이 아래 층(`안나간변경`)의 **기준선**이 된다. 문장에서
     * 되뽑으면 문구가 바뀌는 날 조용히 기준선이 채번으로 되돌아가고, 그 되돌아감이 곧 F474 다. */
    return { level: 'stale', 이름, 측정: true, lines, 못가름, 원문바이트일치: false, 표기차이, 미커밋: 미커밋 || null, 라이브판: 대조.라이브판 || null, 파일들: [...다름, ...라이브없음, ...저장소없음] };
  }

  const 낡음 = [], 모름 = [], 최신 = [];
  for (const d of 고정) {
    const m = FP_RE.exec(d.desc || '');
    if (!m) 모름.push(d);
    else if (m[1] === fp) 최신.push(d);
    else 낡음.push(d);
  }

  // 설명은 갱신자가 적은 간접 증거다. 실제 버전 내용을 읽지 않은 것을 최신·유출로 단정하지 않는다.
  const lines = [`${이름}: 배포 설명 지문만 대조(간접 증거) — 프로젝트 HEAD·고정 버전 실제 내용은 미확인`];
  for (const d of 최신) lines.push(`   @${d.ver}: 설명 지문 일치 ${지문표기(fp)}`);
  for (const d of 낡음) lines.push(`   🔴 @${d.ver}: 설명 지문 불일치 ${FP_RE.exec(d.desc)[1]} ≠ 현재 ${fp}`);
  for (const d of 모름) lines.push(`   ⚠ @${d.ver}: 설명 지문 없음`);
  if (미커밋 && 미커밋.length) lines.push(`   ⚠ 배포집합 미커밋 ${미커밋.length}건(${미커밋.join(' · ')}) — 원격 반영 여부는 미확인, 담당 작업의 변경 소유를 확인한다`);
  lines.push('   → 실제 내용을 확인한다: node tools/배포판점검.js --라이브');
  return {
    level: 낡음.length ? 'stale' : 모름.length ? 'unknown' : 미커밋 && 미커밋.length ? 'warn' : 'ok',
    이름, 측정: false, 근거: '배포설명지문', 미커밋: 미커밋 || null, lines,
  };
}

/* 세 원인(오프라인·미로그인·clasp 없음)을 한 문장으로 접으면 어느 것인지 아무도 못 가른다 —
 * 하나는 30초면 고쳐지고 하나는 그냥 기다리면 된다. 원문 끝 줄을 함께 낸다. */
const 못읽음 = (이름, 무엇, e) => ({
  level: 'unreachable',
  측정: false,
  이름,
  lines: [
    `⚠ ${이름}: ${무엇}(오프라인·미로그인·clasp 없음) — **확인 불가**지 통과가 아니다`,
    `   ${String((e && (e.stderr || e.message)) || e).trim().split(/\r?\n/).filter(Boolean).slice(-1)[0] || '(원문 없음)'}`,
  ],
});

/* --라이브는 프로젝트 HEAD와 활성 고정 버전 전부를 읽는다. 같은 버전의 여러 배포는 한 번만 받는다.
 * 기존 level·측정·파일들·라이브판을 유지하고, 프로젝트HEAD·고정버전들에 각각의 결과를 남긴다. */
function 점검(projRoot, root = ROOT, { 라이브 = false, 시간제한 } = {}) {
  const 이름 = path.relative(root, projRoot).replace(/\\/g, '/') || '(루트)';
  const 경로 = path.relative(root, projRoot).replace(/\\/g, '/') || '.';
  let fp, 미커밋;
  try {
    fp = 지문(projRoot, root);
    미커밋 = 배포집합미커밋(projRoot, root);
  } catch (e) { return 못읽음(이름, '로컬 배포집합을 못 읽었다', e); }
  let deployments = [], 목록실패 = null;
  try { deployments = 배포목록(projRoot, { timeout: 시간제한 }); }
  catch (e) { 목록실패 = 못읽음(이름, '배포 목록을 못 읽었다', e); }
  if (!라이브) return 목록실패 || 판정({ 이름, 경로, fp, deployments, 미커밋 });

  const 재기 = (versionNumber, 배포들 = []) => {
    const 대상 = versionNumber === undefined ? '프로젝트 HEAD' : `고정 버전 @${versionNumber}`;
    let r;
    try {
      const 대조 = 라이브대조(projRoot, root, { timeout: 시간제한, versionNumber });
      r = 판정({ 이름, 경로, fp, deployments: [], 대조, 미커밋, 대상 });
    } catch (e) { r = 못읽음(이름, `${대상} 내용을 임시 디렉터리로 못 받았다`, e); }
    return { ...r, 대상, versionNumber: versionNumber === undefined ? null : Number(versionNumber), 배포들 };
  };
  // 목록 조회가 실패해도 프로젝트 HEAD는 잰다. 목록 미확인은 전체 초록 도장을 막는다.
  const 프로젝트HEAD = 재기();
  const 버전들 = new Map();
  for (const d of deployments.filter((d) => d.ver !== 'HEAD' && !d.temp)) {
    const v = String(d.ver);
    if (!버전들.has(v)) 버전들.set(v, []);
    버전들.get(v).push(d.id);
  }
  const 고정버전들 = [...버전들].map(([v, ids]) => 재기(v, ids));
  const 결과 = [프로젝트HEAD, ...고정버전들];
  const 작업본유지 = 지문못하면널(projRoot, root) === fp;
  const 측정 = !목록실패 && 작업본유지 && 결과.every((r) => r.측정 === true);
  const level = 결과.some((r) => r.level === 'stale') ? 'stale' : !측정 ? 'unreachable' : 'ok';
  const 달라진것 = 결과.filter((r) => r.파일들 && r.파일들.length);
  const 방향 = Object.fromEntries(달라진것.map((r, i) => [String(i), r.라이브판]));
  const 라이브판 = 측정 && 달라진것.length ? 라이브판접기(Object.keys(방향), 방향, root) : null;
  const 요약 = (r) => r.측정 !== true ? '미확인' : r.level === 'ok' ? '일치' : '차이 있음';
  return {
    level, 이름, 측정, 미커밋, 라이브판, localFp: fp, 근거: '원격내용대조', 프로젝트HEAD, 고정버전들, 배포목록확인: !목록실패,
    원문바이트일치: 측정 ? 결과.every((r) => r.원문바이트일치 === true) : null,
    파일들: [...new Set(결과.flatMap((r) => r.파일들 || []))],
    못가름: [...new Set(결과.flatMap((r) => r.못가름 || []))],
    lines: [
      `${이름}: 프로젝트 HEAD ${요약(프로젝트HEAD)} · 고정 버전 ${목록실패 ? '목록 미확인' : 고정버전들.length + '종'}`,
      ...결과.flatMap((r) => r.lines),
      ...(목록실패 ? 목록실패.lines : []),
      ...(!작업본유지 ? ['⚠ 대조 중 로컬 배포집합이 바뀌었거나 다시 읽지 못했다 — 전체 일치 여부 미확인'] : []),
    ],
  };
}

/* 수동 배포 검사의 실측 기록을 사용한다. */

/** 채번 정본 — `bump-version.js` 가 기계로 쓰는 자리 그대로다(그 파일 `CODE`·`codePath()`).
 *  ⚠ 이름을 여기 한 벌만 둔다: 같은 판정을 두 곳에 적으면 갈라지고, 갈라진 쪽은 기준선을 못 찾아
 *  **조용히** 「잴 기준이 없다」로 떨어진다(맹점 ④ — 새는 방향은 언제나 침묵이다). */
const 채번파일 = 'Code.js';
/** `git log -G` 는 기본 정규식(BRE)이고 `^` 는 diff 줄 **내용**에 걸린다(2026-08-14 실측 — 앵커
 *  유무 둘 다 같은 커밋을 골랐고, 선언만 잡도록 앵커 쪽을 쓴다: 주석·문자열 속 언급을 뺀다). */
const 채번줄RE = "^const SYNK_VERSION = '";

/* 수동 배포 검사의 실측 기록을 사용한다. */
const 도장키 = '배포실측';
// 기존 실측 기록 위치는 유지하고, 실행기·주기적 감사와의 의존성은 없앤다.
const 실측기록경로 = () => process.env.SYNK_ROT_STATE || path.join(ROOT, '.claude', 'state', 'rot-check.json');
function 배포도장(now, dep) {
  const 프로젝트들 = {};
  for (const r of (dep && dep.결과) || []) {
    if (!r || !r.이름 || !r.실측 || !r.실측.지문) continue;
    프로젝트들[r.이름] = { 지문: r.실측.지문, 초록: !!r.실측.초록 };
    if (r.실측.라이브판?.종류 === '뒤처짐' && r.실측.라이브판.sha) {
      프로젝트들[r.이름].라이브판 = { 종류: '뒤처짐', sha: r.실측.라이브판.sha };
    }
  }
  return Object.keys(프로젝트들).length ? { [도장키]: { at: now, 프로젝트들 } } : {};
}

/** 마지막 라이브 실측 도장. `null` = 없거나 못 읽음(= 모름 → 아무것도 안 재운다). */
function 라이브도장(root = ROOT) {
  const f = 실측기록경로();
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

/* 수동 배포 검사의 실측 기록을 사용한다. */

/** 도장에 실을 한 칸. 측정 뒤 파일이 바뀌면 새 지문에 옛 초록을 붙이지 않는다. */
function 실측접기(r, projRoot, root = ROOT) {
  const 현재지문 = 지문못하면널(projRoot, root);
  const 검증지문 = typeof r.localFp === 'string' ? r.localFp : null;
  const 측정 = r.측정 === true && 검증지문 !== null && 현재지문 === 검증지문;
  return {
    지문: 검증지문 || 현재지문,
    측정,
    초록: r.level === 'ok' && 측정,
    라이브판: r.라이브판 || null,
  };
}

/**
 * 잰 결과를 도장으로 남긴다 — `배포실측` 키 **하나만** 병합한다.
 * @param {Array<{이름:string,실측:object}>} 잰것들 `점검()` 결과 + `실측접기()`
 * @returns {{찍음:number, 전체:number, 사유?:string}} 0 은 분모와 함께 낸다(유호 확정 08-14)
 */
function 도장찍기(잰것들, { now = Date.now(), root = ROOT } = {}) {
  const 전체 = (잰것들 || []).length;
  const f = 실측기록경로();
  const 몫 = (배포도장(now, { 결과: 잰것들 }) || {})[도장키];
  if (!몫 || !몫.프로젝트들 || !Object.keys(몫.프로젝트들).length) {
    return { 찍음: 0, 전체, 사유: '지문을 잰 프로젝트가 0' };
  }
  let 옛 = {};
  try { 옛 = JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (_) { 옛 = {}; }   // 없거나 깨졌으면 새로 쓴다
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ ...옛, [도장키]: 몫 }, null, 1), 'utf8');
  } catch (_) { return { 찍음: 0, 전체, 사유: '상태 파일을 못 썼다' }; }
  return { 찍음: Object.keys(몫.프로젝트들).length, 전체 };
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
  const 마지막 = git(['log', '-G', 채번줄RE, '-n', '1', '--format=%H %ct %s', '--', 채번파일]);
  if (마지막 === null) return null;
  if (!마지막.length) return { 배포커밋: null };
  const 줄 = String(마지막[0]);
  const 빈칸 = 줄.indexOf(' ');
  const sha = 빈칸 < 0 ? 줄 : 줄.slice(0, 빈칸);
  const 뒤 = 빈칸 < 0 ? '' : 줄.slice(빈칸 + 1);
  const 빈칸2 = 뒤.indexOf(' ');
  /* `%ct` 는 초, 도장 `at` 은 밀리초다 — 단위를 안 맞추면 비교가 **언제나 참**이 되고,
   * 그 침묵은 「도장을 늘 믿는다」로 새서 배포 직후 상시 거짓 🔴 가 된다(F113). */
  const 채번시각 = Number(빈칸2 < 0 ? 뒤 : 뒤.slice(0, 빈칸2)) * 1000;
  const 제목 = 빈칸2 < 0 ? '' : 뒤.slice(빈칸2 + 1);
  const 센것 = git(['rev-list', '--count', `${sha}..HEAD`]);
  if (센것 === null) return null;
  const 찍힘 = 도장 ? 라이브도장(root) : null;

  /* 수동 배포 검사의 실측 기록을 사용한다. */
  const 캐시 = new Map();
  const 바뀜을 = (base) => {
    if (!캐시.has(base)) 캐시.set(base, git(['diff', '--name-only', base, 'HEAD']));
    return 캐시.get(base);
  };
  const 거리캐시 = new Map();
  /** HEAD 까지의 커밋 수 — **클수록 오래된 판**이다. 못 재면 `null`(모름 → 갈아끼우지 않는다). */
  const 거리 = (base) => {
    if (!거리캐시.has(base)) {
      const r = git(['rev-list', '--count', `${base}..HEAD`]);
      거리캐시.set(base, r === null ? null : Number(r[0]));
    }
    const v = 거리캐시.get(base);
    return Number.isFinite(v) ? v : null;
  };
  거리캐시.set(sha, Number(센것[0]) || 0);
  const 도장믿음 = !!(찍힘 && Number.isFinite(채번시각) && 채번시각 <= (찍힘.at || 0));
  /** 이 프로젝트의 기준선 — `{sha, 종류}`. 도장을 못 믿거나 못 재면 채번으로 떨어진다. */
  const 기준고르기 = (실측) => {
    const 라 = 도장믿음 && 실측 && 실측.라이브판;
    if (!라 || 라.종류 !== '뒤처짐' || !라.sha) return { sha, 종류: '채번' };
    const a = 거리(라.sha), b = 거리(sha);
    if (a === null || b === null || a <= b) return { sha, 종류: '채번' };   // 더 오래된 쪽만 갈아낀다
    return { sha: 라.sha, 종류: '라이브실측', 잰때: 찍힘.at || null };
  };

  const 프로젝트들 = [];
  const 가라앉힘 = [];
  const 기준선 = [];
  for (const p of 프로젝트들목록 || claspProjects()) {
    const 상대 = path.relative(root, p).replace(/\\/g, '/');
    const 이름 = 상대 || '(루트)';
    const 기준 = 기준고르기(찍힘 && 찍힘.프로젝트들[이름]);
    기준선.push({ 이름, ...기준 });
    const 바뀜 = 바뀜을(기준.sha);
    if (바뀜 === null) return null;                       // 못 잼은 「변경 0」이 아니다
    const 파일들 = 바뀜.filter((f) => 프로젝트.isDeployFile(f, p, root));
    if (!파일들.length) continue;
    const 항 = { 이름, 경로: 상대 || '.', 파일들, 기준 };
    /* 도장 이름은 `점검()` 이 쓰는 것과 **같은 규칙**으로 만들어진다(`path.relative || '(루트)'`).
     * 규칙이 갈리면 조회가 늘 빗나가 이 배선이 통째로 죽는데, 죽는 모양이 「옛 동작」이라 안 보인다. */
    const 실측 = 찍힘 && 찍힘.프로젝트들[항.이름];
    const fp = 실측 && 실측.초록 ? 지문못하면널(p, root) : null;
    if (fp && 실측.지문 === fp) { 가라앉힘.push({ ...항, 잰때: 찍힘.at || null, 지문: fp }); continue; }
    프로젝트들.push(항);
  }
  /* 가라앉힌 것을 **구조로** 돌려준다 — 조용히 지우면 호출부가 「이게 전부」로 읽고, 그건 이
   * 도구가 고치려는 병(침묵과 통과가 같은 모양)을 자리만 옮긴 것이다. */
  /* `기준선` 도 구조로 낸다 — **0 을 분모와 함께 읽으려면 「무엇에 견줘 0인가」가 필요하다**
   * (유호 확정 08-14). 이걸 안 내면 위층은 옛날처럼 「채번」이라고만 적고, 라이브 기준선으로
   * 갈아낀 날에도 같은 문장이 나와 갈아낀 사실이 아무 데도 안 보인다. */
  return { 배포커밋: sha.slice(0, 7), 제목, 커밋수: Number(센것[0]) || 0, 프로젝트들, 가라앉힘, 기준선 };
}

module.exports = { 배포집합, 지문, 배포목록, 라이브대조, 라이브판찾기, 라이브판접기, 못읽음, 판정, 점검, 지문표기, FP_RE, claspProjects, 안나간변경, 라이브도장, 도장찍기, 실측접기, 도장키, 미커밋집합, 배포집합미커밋 };

if (require.main === module) {
  const 라이브 = process.argv.includes('--라이브');
  const 프로젝트들 = claspProjects();
  const 결과 = 프로젝트들.map((p) => 점검(p, ROOT, { 라이브 }));
  결과.forEach((r) => r.lines.forEach((l) => console.log(l)));
  /* 잰 자리에서 도장을 남긴다 (#Q97) — 이 갈래만 라이브를 **바이트로** 봤으므로 이 갈래만 찍는다.
   * 안 찍는 갈래에서 침묵하는 게 아니라, 애초에 잴 재료가 없어서 찍을 것이 없다. */
  if (라이브) {
    const 잰것 = 결과.map((r, i) => ({ ...r, 실측: 실측접기(r, 프로젝트들[i], ROOT) }));
    const s = 도장찍기(잰것);
    console.log(`\n🖈 도장 ${s.찍음}/${s.전체}${s.사유 ? ` — ${s.사유}` : ''}`
      + ' (다음 세션의 「배포집합이 마지막 배포보다 앞서 있다」가 이 도장을 읽는다)');
  }
  if (!라이브 && 결과.some((r) => r.측정 === false)) {
    console.log('\n안 잰 프로젝트가 있다 — 라이브 바이트까지 보려면: node tools/배포판점검.js --라이브');
  }
  const 나쁨 = 결과.filter((r) => r.level === 'stale');
  if (process.argv.includes('--check') && 나쁨.length) process.exit(1);
  process.exit(0);
}
