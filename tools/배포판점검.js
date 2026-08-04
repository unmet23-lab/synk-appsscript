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
 */

const fs = require('fs');
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

/* ── 판정 (순수 함수) ────────────────────────────────────────────────────────
 * 네트워크·파일시스템을 안 탄다 — **탐지력은 여기서 픽스처로 못박는다.**
 * 실저장소·라이브를 요구하는 검사는 CI 에서 못 돌고, 그걸 탐지력의 근거로 삼으면
 * 「자격증명이 없어서 초록」이 된다. */
function 판정({ 이름, 경로, fp, deployments }) {
  const 고정 = (deployments || []).filter((d) => d.ver !== 'HEAD' && !d.temp);
  if (!고정.length) {
    return { level: 'ok', 이름, lines: [`${이름}: 고정 버전 배포 없음 — @HEAD 를 서빙하므로 push 가 곧 라이브다`] };
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

/* 프로젝트 하나를 실제로 본다(네트워크 포함). 조회 실패는 확인 불가로 드러낸다. */
function 점검(projRoot, root = ROOT) {
  const 이름 = path.relative(root, projRoot).replace(/\\/g, '/') || '(루트)';
  const 경로 = path.relative(root, projRoot).replace(/\\/g, '/') || '.';
  let deployments;
  try {
    deployments = 배포목록(projRoot);
  } catch (e) {
    return {
      level: 'unreachable',
      이름,
      lines: [`⚠ ${이름}: 배포 목록을 못 읽었다(오프라인·미로그인·clasp 없음) — **확인 불가**지 통과가 아니다`],
    };
  }
  return 판정({ 이름, 경로, fp: 지문(projRoot, root), deployments });
}

module.exports = { 배포집합, 지문, 배포목록, 판정, 점검, 지문표기, FP_RE, claspProjects };

if (require.main === module) {
  const 결과 = claspProjects().map((p) => 점검(p));
  결과.forEach((r) => r.lines.forEach((l) => console.log(l)));
  const 나쁨 = 결과.filter((r) => r.level === 'stale');
  if (process.argv.includes('--check') && 나쁨.length) process.exit(1);
  process.exit(0);
}
