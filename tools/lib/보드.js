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
const 표 = require(path.join(__dirname, '표.js'));

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

/* ── 「보드 줄」의 정의는 **여기 하나뿐이다** (마찰 F322·F330·F331 · 2026-08-12) ─────────
 * 위 머리말은 「파싱을 네 번 고치면 네 번 갈라진다」고 적어 두고도 **판정 자체가 세 벌**로
 * 갈렸다: 여기(엄격 — 날짜 필요) · `.claude/hooks/board-guard.js`(느슨) · `tools/board-move.js`
 * (느슨). 칸 가르기만 한 통로로 모으고 「이게 표 줄인가」는 각자 적은 것이다.
 *
 * 🔑 갈라진 쪽의 증상은 **「없는 줄」**이다 — 새는 방향이 조용하다.
 *   가드는 세고(상한을 먹는다) 조립기는 안 보여준다. 그래서 그 줄은 보드에도, `board-move`
 *   후보에도, 인계문에도 안 뜨는 **유령**이 되고, 쓴 세션은 「선언했다」고 믿는다.
 *   실측 2026-08-12: `fe43f4b4.md:5` 는 ✅종결 줄인데 보드·`board-move`·인계문 어디에도
 *   없었고, 주인이 죽어 치울 길조차 없었다(`board-move` 가 후보를 `줄들` 로 찾는다 · F103).
 *   ⚠ 상한은 **주인 자신에게만** 흔들린다 — `board-guard` 는 남의 줄을 `줄들`(엄격)로
 *   받고 제 파일만 raw 로 세므로, 그 +1 은 fe43f4b4 가 제 파일을 편집할 때만 보인다(20 vs 19).
 *   같은 자리 3번째다(F322 c9eb0956 · F331 fe43f4b4→82e5d71d · F330 d3139ff6) —
 *   CLAUDE.md 신뢰성 조항의 **「3번째 = 원인을 쓸 수 없게 만든다」** 자리라 정의를 하나로 모으고
 *   `board-guard` ⑨ 가 **쓰는 순간** 막는다.
 *
 * 두 이름을 나눠 두는 이유: 넓은 쪽(`표줄`)은 **상한·주인 검사**가 쓰고 — 규격 밖 줄도 자리를
 * 먹으니 세야 한다 — 좁은 쪽(`데이터행`)은 **조립기가 실제로 렌더하는 줄**이다. 둘의 차집합이
 * 곧 유령이라, 이름을 나누되 `데이터행` 을 `표줄` 에서 **파생**시켜 다시는 갈라지지 않게 한다. */

/** 표 1열(날짜) 규격 — `08-11` 같은 짧은 날짜는 정렬 키가 없어 조립에서 통째로 빠진다. */
const ISO날짜 = /^20\d\d-\d\d-\d\d$/;
/** 표 칸 수 — 머리말이 정하는 4칸(날짜·트랙·파일·상태). 5칸이면 상태 칸이 한 칸 밀려
 *  board-guard 의 완료 판정·200자 검사와 track-collision 의 파일 칸이 **엉뚱한 칸**을 잰다. */
const 칸수 = 표.칸나누기(머리말.find((l) => /^\|\s*날짜\s*\|/.test(l))).length;

/** 표에 실린 줄인가 — 머리글·구분선만 뺀 **넓은** 쪽. 상한·주인 검사가 쓴다. */
function 표줄(line) {
  const t = String(line).trim();
  if (!t.startsWith('|')) return false;
  if (/^\|[\s:|-]+\|$/.test(t)) return false;        // 구분선 |---|---|
  if (/^\|\s*날짜\s*\|/.test(t)) return false;        // 머리글
  return true;
}

/** 표줄인데 조립기가 못 읽는 이유들. 빈 배열 = 규격 통과. 표줄이 아니면 빈 배열(대상 아님). */
function 유령사유(line) {
  const l = String(line);
  if (!표줄(l)) return [];
  const out = [];
  if (l[0] !== '|') out.push('줄이 `|` 로 시작하지 않는다(앞에 공백·들여쓰기)');
  const 칸 = 표.칸나누기(l);
  const 날짜칸 = (칸[0] || '').trim();
  if (!ISO날짜.test(날짜칸)) {
    out.push(`날짜 칸이 네 자리 연도까지 있는 \`YYYY-MM-DD\` 가 아니다: "${날짜칸.slice(0, 24)}"`);
  }
  if (칸.length !== 칸수) out.push(`칸이 ${칸.length}개다(${칸수}개여야 한다: 날짜·트랙/작업·만지는 파일·상태)`);
  return out;
}

/** 표줄인데 규격 밖 — 가드는 세고 조립기는 못 보는 **유령**. */
function 유령(line) {
  return 표줄(line) && 유령사유(line).length > 0;
}

/** 조립기가 렌더하는 데이터 행인가 — `표줄` 에서 **파생**한다(두 곳에 적으면 또 갈라진다). */
function 데이터행(line) {
  return 표줄(line) && 유령사유(line).length === 0;
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
/** 폴더의 **모든 표줄**을 한 번만 훑는다 — `줄들`(렌더 대상)과 `유령들`(규격 밖)이 여기서 갈린다.
 *  두 번 훑으면 두 스캐너가 갈라지고, 그게 지금 고치는 결함 그 자체다. */
function 훑기(root) {
  const dir = 폴더(root);
  let names;
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.md')).sort(); } catch (_) { return null; }

  const 모음 = [];
  for (const name of names) {
    let txt;
    try { txt = fs.readFileSync(path.join(dir, name), 'utf8'); } catch (_) { continue; }
    txt.split(/\r?\n/).forEach((line, i) => {
      const l = line.replace(/\s+$/, '');
      if (!표줄(l)) return;
      const 사유 = 유령사유(l);
      모음.push({
        줄: l, 파일: name, 줄번호: i + 1, 사유,
        날짜: 사유.length ? '' : 표.칸나누기(l)[0].trim(),
      });
    });
  }
  return 모음;
}

function 줄들(root) {
  const 전부 = 훑기(root);
  if (전부 === null) return null;
  const 모음 = 전부.filter((r) => !r.사유.length);
  모음.sort((a, b) => (a.날짜 < b.날짜 ? -1 : a.날짜 > b.날짜 ? 1 : a.파일 < b.파일 ? -1 : a.파일 > b.파일 ? 1 : 0));
  return 모음;
}

/** 조립기가 못 읽는 줄들 — 가드는 세는데 표에는 없는 것. 폴더를 못 읽으면 `null`(「비었다」와 다르다). */
function 유령들(root) {
  const 전부 = 훑기(root);
  if (전부 === null) return null;
  return 전부.filter((r) => r.사유.length)
    .sort((a, b) => (a.파일 < b.파일 ? -1 : a.파일 > b.파일 ? 1 : a.줄번호 - b.줄번호));
}

/** 옛 `세션보드.md` 와 **같은 모양**의 전문. 디스크에 쓰지 않는다(위 머리말 🔑).
 *  폴더를 못 읽으면 `null` — 「못 봤다」를 「비었다」로 번역하지 않는다(`줄들` 🔑). */
function 텍스트(root) {
  const rows = 줄들(root);
  if (rows === null) return null;
  return 머리말.concat(rows.map((r) => r.줄)).join('\n') + '\n';
}

/* ⚠ `텍스트()` 는 **일부러 안 건드린다** — 이 문자열을 파싱하는 곳이 넷이다(session-report·
 *   track-collision·board-move·board-guard). 유령 경고를 표 아래 붙이면 그 넷이 새 줄을
 *   만나게 되고, 새는 방향을 예측할 수 없다. 유령은 **사람이 보는 자리**(`tools/board.js` 의
 *   stderr)와 **쓰는 순간**(board-guard ⑨)에서만 드러낸다. */
module.exports = {
  폴더, 내파일, 줄들, 유령들, 텍스트, 머리말,
  표줄, 데이터행, 유령, 유령사유, ISO날짜, 칸수,
};
