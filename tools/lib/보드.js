/* 보드 — 세션보드의 **정본은 세션별 파일**이고, 표는 읽을 때 조립한다 (마찰 F250).
 *
 * 왜 있나 (2026-08-08 · 유호님 지시 「공유 파일 쪼개기 — 충돌의 뿌리 제거」):
 *   `docs/세션보드.md` 는 한 파일인데 상시 3~7개 세션이 자기 줄을 넣고 고치고 지웠다.
 *   그 한 파일이 낳은 마찰이 **장부에 14건**이다(F203·F204·F229·F233·F234·F235·F241 …).
 *   지금까지의 처방은 전부 「가드가 남의 줄을 재지 않게」 하는 특례였다 — board-guard 의
 *   편집 전 판 대조, git-scope-guard 의 상시공유 목록, track-collision·handoff-store 의
 *   제외 목록. CLAUDE.md 신뢰성 조항이 말하는 **3번째 = 원인을 쓸 수 없게 만든다** 자리다.
 *
 * 🔑 파생 파일을 만들지 **않는다.** 여기가 이 설계의 급소다.
 *   인계문(`docs/_ops/인계문/`)은 세션별 파일로 이미 갈랐는데 파생 목차
 *   `docs/_ops/인계문.md` 를 git 에 두는 바람에 **그 목차에서 그대로 충돌한다**
 *   (실측 08-08: 폰 브랜치 반입 충돌 6파일 중 3개가 공유 선언판이고 그 목차가 그 안에 있다).
 *   파일을 갈라도 합쳐 쓰는 파일이 git 에 있으면 충돌은 자리만 옮긴다.
 *   그래서 `텍스트()` 는 **디스크에 안 쓴다** — 부르는 쪽 메모리에서만 조립한다.
 *
 * ⚠ 그렇다고 읽는 쪽을 다 고치지도 않는다. `텍스트()` 가 옛 `세션보드.md` 와 **같은 모양**을
 *   내므로 파싱하는 네 곳(session-report·track-collision·board-move·board-guard)은
 *   읽는 자리 한 줄만 바꾸면 되고 파싱 코드는 그대로다. 파싱을 네 번 고치면 네 번 갈라진다.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const 보드id = require(path.join(__dirname, '..', '..', '.claude', 'hooks', 'lib', 'board-id.js'));

const 머리말 = [
  '# 세션보드 — Claude Code 멀티 세션 선언판',
  '',
  '> **이 표는 파일이 아니다** — `docs/_ops/보드/<지문>.md` 들을 읽을 때 조립한 것이다.',
  '> 내 줄은 **내 파일에만** 쓴다 — `docs/_ops/보드/<내 지문 8자리>.md`. 남의 파일은 열지 않는다.',
  '> 칸 200자·활성 12줄·전체 18줄은 `board-guard` 가 기계 차단한다. 완료 줄은',
  '> `node tools/board-move.js "문구"` 로 `docs/세션보드_아카이브.md` 에 옮긴다.',
  '',
  '| 날짜 | 트랙/작업 | 만지는 파일 | 상태 |',
  '|---|---|---|---|',
];

/** 세션 파일들이 사는 폴더. */
function 폴더(root) {
  return path.join(String(root || '.'), 'docs', '_ops', '보드');
}

/** 그 세션이 쓸 파일. 이름 = 보드 지문(8자리) — 줄 안에 적는 지문과 **같은 규칙**이라
 *  파일명과 줄 내용이 갈라지지 않는다(board-id 가 그 한 곳). */
function 내파일(root, sid) {
  const 지문 = 보드id.지문(sid);
  if (!지문) return null;
  return path.join(폴더(root), `${지문}.md`);
}

/** 데이터 행인가 — 머리글·구분선도 `|` 로 시작하므로 날짜 칸으로 가른다(보드 1열 = 날짜). */
function 데이터행(line) {
  return line[0] === '|' && /\b20\d\d-\d\d-\d\d\b/.test(line);
}

/**
 * 폴더의 모든 세션 파일에서 표 행을 모은다.
 *
 * ⚠ 정렬은 **날짜 칸**으로만 한다. 파일 mtime 은 git 체크아웃·반입에서 통째로 새로 찍혀
 *   다른 기계에서 순서가 뒤집힌다 — 그러면 「내 줄이 어디 있나」가 기계마다 달라진다.
 *   같은 날짜끼리는 파일명(지문) 순 — 안정 정렬이라 어느 기계에서나 같은 표가 나온다.
 *
 * 🔑 폴더 자체를 못 읽으면 **null** 이다 — 「비었다」와 다르다. 부르는 쪽 중 하나(인계문)는
 *   그 차이로 「내 줄이 정말 없다」와 「보드를 못 봤다」를 가르고, 전자일 때만 다음 세션에게
 *   「보드를 다시 열 필요 없다」고 말한다. 둘을 같은 `[]` 로 뭉개면 못 본 것을 없다고 단정한다.
 */
function 줄들(root) {
  const dir = 폴더(root);
  let names;
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort(); } catch (_) { return null; }

  const 모음 = [];
  for (const name of names) {
    let txt;
    try { txt = fs.readFileSync(path.join(dir, name), 'utf8'); } catch (_) { continue; }
    txt.split(/\r?\n/).forEach((line) => {
      const l = line.replace(/\s+$/, '');
      if (데이터행(l)) 모음.push({ 줄: l, 파일: name, 날짜: (l.match(/\b20\d\d-\d\d-\d\d\b/) || [''])[0] });
    });
  }
  모음.sort((a, b) => (a.날짜 < b.날짜 ? -1 : a.날짜 > b.날짜 ? 1 : a.파일 < b.파일 ? -1 : a.파일 > b.파일 ? 1 : 0));
  return 모음;
}

/** 옛 `세션보드.md` 와 **같은 모양**의 전문. 디스크에 쓰지 않는다(위 머리말 🔑).
 *  폴더를 못 읽으면 `null` — 「못 봤다」를 「비었다」로 번역하지 않는다(`줄들` 🔑). */
function 텍스트(root) {
  const rows = 줄들(root);
  if (rows === null) return null;
  return 머리말.concat(rows.map((r) => r.줄)).join('\n') + '\n';
}

module.exports = { 폴더, 내파일, 줄들, 텍스트, 데이터행, 머리말 };
