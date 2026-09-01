#!/usr/bin/env node
// doc-graph — 정본과 그 파생 문서 사이의 엣지를 읽는다.
//
// 왜 있나: doc-audit(2026-07-28)의 발견 — "정본 개정이 대외 문서에 전파 안 된다".
// 급여 정본 v1.3을 36종 문서에 손으로 전파한 게 그 대가였다(synk-docs-overhaul).
// 정본→파생 엣지가 없으니 정본이 바뀌어도 **무엇이 낡았는지 알 방법이 없었다.**
//
// 표기 — 파생 쪽 문서 아무 곳에 한 줄:
//   <!-- 파생: docs/브랜드_폰트_정본.md -->
// 여러 정본을 따르면 줄을 여러 개 두거나 쉼표로 나열한다.
// **정본 쪽은 손대지 않는다** — 정본이 자기 파생을 나열하면 파생이 늘 때마다 정본을 고쳐야 하고,
// 그 갱신을 잊는 것이 바로 지금 고치려는 문제다. 엣지는 항상 파생이 선언한다.
//
// [2026-08-03] 시간축 — 엣지 뒤에 @버전을 붙이면 "이 파생은 정본의 그 버전을 보고 썼다"가 된다:
//   <!-- 파생: docs/정본/…/급여 인센티브 정본.txt@v1.1 -->
// 정본이 v1.3으로 오르는 순간 이 엣지는 저절로 '낡음'이 된다. 사실이 **모순되는 대신 만료**된다.
// 왜 필요한가: 엣지만 있으면 "누가 이 정본을 따르나"는 알아도 **"그 파생이 아직 맞나"는 모른다.**
// 실측(2026-08-03) — 급여 정본은 v1.3인데 파생 3종이 본문에서 v1.1 수치를 인용 중이었고,
// 엣지는 셋 다 멀쩡히 붙어 있었다. 즉 연결은 참인데 내용이 거짓인 상태를 그래프가 못 봤다.
// 버전이 없는 엣지는 '최신'이 아니라 **'모름'**으로 집계한다(모름을 정상으로 바꾸지 않는다).
//
// 사용법:
//   node tools/doc-graph.js              리포트(정본별 파생·깨진 참조·낡은 인용·지도 누락·심을 후보)
//   node tools/doc-graph.js --of <파일>  그 정본을 따르는 파생 목록만(훅이 쓴다)
//   node tools/doc-graph.js --add <파생> <정본[@v1.1]>...   엣지 심기
//   node tools/doc-graph.js --stamp <파생>  그 파생의 엣지를 정본 현재 버전으로 = "지금 맞다" 선언
//   node tools/doc-graph.js --json
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['docs'];
const SKIP = [/[\\/]_archive[\\/]/, /[\\/]worktrees[\\/]/, /세션보드_아카이브/, /[\\/]_구본[\\/]/, /[\\/]pixelart_draft[\\/]/];
/* [2026-08-09] `.html`이 빠져 있었다. 새는 방향이 **「통과」가 아니라 「0」**이라 더 나빴다:
 * `docs/홈페이지_시안/시안.html`·`시안.tpl.html`은 `<!-- 파생: docs/SYNK_철학.md@v1.0 -->`를
 * **이미 선언해 놓았는데** 스캔 확장자 밖이라 파서가 그 파일을 아예 열지 않았다. 결과 —
 * 철학 정본의 파생 엣지가 **0종**(전체 33종 중)이고, 정본 머리는 그 엣지 수를 두고
 * 「전 문서 리라이팅의 진행을 세는 유일한 자리」라고 적어 두었다. 계기판이 0을 가리키는데
 * 「전파 안 됨」과 「계기판이 안 봄」이 같은 모양이라 아무도 못 갈랐다(유호님 질문 08-09에서 실측).
 * 엣지 표기 `<!-- … -->`는 원래 HTML 주석이라 형식은 그대로 쓰고, 확장자만 넓힌다.
 * ⚠ **타깃은 존재만 확인하고 소스는 스캔돼야 한다** — 이 비대칭이 함정의 정체다:
 * `crewcard/카드_kr.html`은 남이 **가리켜서** 그래프에 있었고, 그래서 「html 도 보인다」로 오독됐다. */
const TEXT_EXT = /\.(md|txt|html)$/i;
/* [2026-08-08] 정본을 **구현하는 코드**도 파생이다. F243 실측: 급여 정본 v1.6(08-04)이 재등록 배점을
 * 30점으로 올렸는데 `엔진_운영배치.js`는 20점 고정인 채 4일을 갔다. 그때 문서 파생 5종은 전부 @v1.6으로
 * 최신이었다 — 낡은 것은 **엣지가 없어 그래프 밖에 있던 코드 하나**뿐이었고, 그래서 아무도 안 울렸다.
 * 새는 방향이 나쁘다: 비율은 옳고 점수만 낮은 형태라 화면으로는 안 보이고 급여가 조용히 깎인다.
 * 저장소 **루트의 .js만** 본다 — 엔진·콘텐츠가 전부 거기 있고, 재귀로 넓히면 node_modules·.git을
 * 걷어내는 규칙을 새로 져야 한다(SKIP은 그 둘을 아직 모른다). 읽기 비용 실측 +12ms(87→99ms). */
const CODE_EXT = /\.js$/i;
const EDGE_RE = /<!--\s*파생\s*:\s*([^>]+?)\s*-->/g;
/** `.txt` 는 주석 문법이 없어 엣지 줄이 사람 눈에 그대로 보인다 — 그래서 무엇인지 한 줄로 밝힌다. */
const TXT_EDGE_NOTE = '※ 위 한 줄은 doc-graph 가 읽는 기계 표기다 — 이 문서가 따르는 정본과 그 판번호. 정본이 개정되면 이 문서가 「낡음」으로 떠서 갱신 대상이 된다.';

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

/** 제외 판정 — 반드시 **상대경로**를 받는다(절대경로를 넣으면 저장소 위치가 규칙을 바꾼다). */
const shouldSkip = (relPath) => SKIP.some((r) => r.test(relPath));

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    /* [2026-08-03] SKIP은 **저장소 기준 상대경로**에 걸어야 한다 — 절대경로에 걸면 저장소가 놓인
     * 자리가 규칙을 바꾼다. 실제 사고: Claude Code 세션 worktree는 `.claude/worktrees/<이름>/`에
     * 만들어지는데, 그 절대경로에 `worktrees`가 들어 있어 `/worktrees/` 규칙이 **docs 전체**를
     * 걸러냈다. 결과는 에러가 아니라 침묵 — 그래프가 0개로 build되고, 정본을 고쳐도 파생 알림이
     * 안 뜬다. 「장치가 죽었다」가 「알릴 게 없다」와 똑같이 생겼다. */
    if (shouldSkip(rel(full))) continue;
    if (e.isDirectory()) walk(full, out);
    else if (TEXT_EXT.test(e.name)) out.push(full);
  }
  return out;
}

/** 저장소 루트의 코드 파일만 **얕게**. 하위 폴더로 안 내려간다(위 CODE_EXT 주석의 이유). */
function rootCode() {
  let entries;
  try { entries = fs.readdirSync(ROOT, { withFileTypes: true }); } catch (_) { return []; }
  return entries
    .filter((e) => e.isFile() && CODE_EXT.test(e.name) && !shouldSkip(e.name))
    .map((e) => path.join(ROOT, e.name));
}

// 정본 판별 — 파일명에 '정본'이 있거나 docs/정본/ 아래에 있으면 정본.
function isCanon(relPath) {
  return /정본/.test(path.basename(relPath)) || relPath.startsWith('docs/정본/');
}

/** `경로@v1.1` → {target, version}. '@'가 없으면 version=null(= 모름). */
function splitVersion(raw) {
  const s = String(raw).trim().replace(/\\/g, '/');
  const at = s.lastIndexOf('@');
  // 경로 안의 '@'(폴더명 등)를 버전으로 오인하지 않게 — 뒤가 v숫자 꼴일 때만 버전으로 본다.
  if (at > 0 && /^v\d+(\.\d+)*$/i.test(s.slice(at + 1))) {
    return { target: s.slice(0, at).trim(), version: s.slice(at + 1).trim() };
  }
  return { target: s, version: null };
}

/** 타깃이 «경로 모양»인가 — 아니면 `파생:` 목록에 **산문이 섞인** 것이다.
 * [2026-08-15] 왜 가르나: 둘 다 「깨진 참조」로 뭉쳐 있었고 문구가 「가리키는 정본이 없다」 하나뿐이라,
 * 산문이 섞였을 때 읽는 사람이 **없는 파일을 찾으러 간다.** 실측 — `docs/브랜드킷.html:4` 의 `파생:` 이
 * 경로 둘 뒤에 산문을 이어 붙여 적색이 났는데(`2fa44a03` 이 수리), 그 적색을 본 세션은 「대상 파일은
 * 실재한다」를 확인하는 데 시간을 쓰고 **그 오진을 인계문에 실어 다음 세션까지 보냈다.** 탐지는 옳았고
 * 처방만 없었다 — 주인 없는 적색은 모두의 배포를 막으므로(clasp-guard) 처방 없는 적색은 오래 앉아 있는다.
 * ⚠ 판정은 **보수적으로** 둘만 본다. 이 저장소의 정본 경로 29종엔 공백이 6건 실재하므로(`SYNK LAB …`)
 *   공백은 근거로 못 쓴다. 새는 방향도 적는다 — 산문이 한 줄이고 확장자로 끝나면 「없는 파일」로 샌다.
 *   그래도 적색은 그대로 뜨고 건수도 같다(갈래 이름만 틀린다) — 숨기는 방향이 아니다. */
function looksLikePath(target) {
  if (/[\r\n]/.test(target)) return false;          // 경로는 줄을 넘지 않는다
  return /\.[A-Za-z0-9]{1,5}$/.test(target);        // 확장자로 끝난다(실측 29종 = .md/.txt/.js/.html/.json)
}

/* 코드 구역을 **길이를 보존한 채** 지운다.
 * [2026-08-03] 두 번째로 물린 함정이다. memory-graph는 이미 stripCode를 갖고 있었는데
 * doc-graph는 없었고, 표기법을 **설명하는** 문서(`docs/_ops/부패점검.md(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)`)를 쓰자마자
 * 코드 펜스 안의 예시 `<!-- 파생: …정본.txt@v1.1 -->`가 진짜 엣지로 새어
 * 그 문서가 「낡은 인용」으로 잡혔다. 그래프에 대해 쓴 글이 그래프를 오염시키면
 * 도구가 자기 자신을 못 믿는다.
 * 길이를 보존하는 이유 — addEdge가 이 결과의 **인덱스로 원문을 자른다**.
 * 공백으로 안 채우고 삭제하면 치환이 엉뚱한 자리를 먹는다. */
function maskCode(text) {
  return String(text).replace(/```[\s\S]*?```|`[^`\n]*`/g, (m) => ' '.repeat(m.length));
}

/** 엣지 전문(버전 포함). build()가 쓴다. */
function parseEdgesFull(text) {
  const out = [];
  let m;
  const masked = maskCode(text);
  EDGE_RE.lastIndex = 0;
  while ((m = EDGE_RE.exec(masked)) !== null) {
    /* [2026-08-14] 구분자는 쉼표«와» 가운뎃점 둘 다 받는다 — 이 저장소는 ` · ` 를 **어디서나** 쓰는데
     *   이 한 칸만 쉼표를 요구했다. 그래서 두 문서가 `A@v1.9 · B` 로 적었고, 파서가 통째로 한 경로로
     *   읽어 「깨진 참조」가 됐다(주인 없는 적색 = 그 뒤 커밋하는 모든 세션의 배포 정지).
     *   ⚠ 새는 방향을 봤다: 더 쪼개는 쪽이라 **없던 엣지가 생길 뿐 있던 것이 숨지 않는다.** 경로에
     *   ` · ` 가 든 파일은 없다. 「경로가 아닌 글」은 여전히 깨진 참조로 남는다 — 그건 숨기면 안 된다. */
    for (const part of m[1].split(/,|\s·\s/)) {
      if (!part.trim()) continue;
      const e = splitVersion(part);
      if (e.target) out.push(e);
    }
  }
  return out;
}

/** 대상 경로만. 버전 표기가 생기기 전부터 있던 호출자·훅이 그대로 쓴다. */
function parseEdges(text) {
  return parseEdgesFull(text).map((e) => e.target);
}

/* 정본의 **현재** 버전을 정본 자신에게서 읽는다.
 * 파일명에서 읽지 않는다 — 「문서 파일명에 버전을 박지 않는다」가 규약이고,
 * 실제로 `반편성_정본_v2.md`의 본문은 v2.3이다(파일명을 믿으면 0.3만큼 틀린다).
 * 못 찾으면 null을 돌려주고 '미상'으로 리포트한다 — 못 읽은 것을 '최신'으로 바꾸지 않는다. */
/* [2026-09-01] 머리에서 못 읽으면 **꼬리**도 본다 — 이 저장소의 정본 다수가 판을 끝에 적는다.
 * 실측: `docs/정본/SYNK LAB/…/SYNK_리라이팅_v2/` 14벌 중 **머리에 적은 것은 셋뿐**이고
 * 나머지 열하나는 마지막 줄의 `v3 · 2026-08-26` 꼴이 유일한 판 표기다. 머리만 보던 자는
 * 그 열하나의 판을 **원리상** 못 읽어 전부 '미상'으로 냈고, 그래서 그 정본들을 인용하는
 * 파생의 낡음이 아무 데서도 안 잡혔다 — 급여 인센티브 정본이 08-26 에 v1.8 → v3 가 된 것을
 * 파생 일곱이 엿새 동안 모른 채 v1.6·v1.7·v1.8 을 「현행」이라 부르고 있었다(09-01 발견).
 * ⚠ 꼬리는 아무 vN 이나 줍지 않는다 — **줄이 판 표기로 «시작»할 때만**(`^v3 · …`).
 *   본문 한가운데의 「철학 v1.8 이 …」 같은 인용을 판으로 오독하지 않으려는 것이고,
 *   이 도구의 오탐 0 설계를 지키는 자리다. 머리가 이긴다(둘 다 적은 셋은 값이 같다 — 실측). */
const VERSION_SCAN_LINES = 12;
const VERSION_TAIL_LINES = 5;
const TAIL_VERSION_RE = /^v(\d+(?:\.\d+)*)(?=\s|·|$)/i;
function canonVersion(text) {
  const lines = String(text).split('\n');
  const head = lines.slice(0, VERSION_SCAN_LINES).join('\n');
  const m = head.match(/\bv\d+(?:\.\d+)*\b/i);
  if (m) return m[0].toLowerCase();
  for (const line of lines.slice(-VERSION_TAIL_LINES).reverse()) {
    const t = line.trim().replace(/^[#>*\-\s]+/, '');
    const tm = t.match(TAIL_VERSION_RE);
    if (tm) return `v${tm[1]}`.toLowerCase();
  }
  return null;
}

/* [2026-08-09] 정본 지위를 **정본 자신이 선언**하는 통로.
 * 왜 있나: 이 저장소에서 가장 넓게 전파되는 정본 — `docs/SYNK_철학.md`(유호님 확정 08-09 ·
 * 「이 문서가 전 정본 문서 리라이팅의 기준이다」) — 가 그래프에 **통째로 없었다.**
 * isCanon 이 파일명의 '정본' 글자와 `docs/정본/` 경로만 봤기 때문이다.
 * 실측 08-09: 정본 42·파생 엣지 33 인데 **철학 몫은 0종**. 그래서 철학이 하루에 15번 개정되는
 * 동안 「무엇이 낡았는지」를 아는 자리가 아무 데도 없었다 — F243 과 같은 병이고 층만 위다.
 *
 * 개명은 처방에서 뺐다. 그 파일명은 인쇄본 매니페스트·바탕화면 PDF·철학열람빌드가 이미
 * 물고 있어서, 그래프를 고치자고 **유호님 눈에 보이는 산출물 이름**을 흔드는 꼴이 된다.
 * 파일명 규칙을 넓히는 것(예: 머리말에 '정본' 글자가 있으면 정본)도 뺐다 — 그건 옵트인이
 * 아니라 **수확**이고, 이 도구의 오탐 0 설계를 깬다.
 *
 * 그래서 파생이 `<!-- 파생: … -->` 로 선언하듯 정본은 `<!-- 정본: v1.0 -->` 로 선언한다.
 * ⚠ maskCode 를 반드시 거친다 — 이 표기법을 **설명하는** 문서가 자기 예시 때문에 정본이
 * 되는 함정은 doc-graph 가 엣지 쪽에서 이미 한 번 밟았다(위 maskCode 주석). */
const SELF_CANON_RE = /<!--\s*정본:\s*(v\d+(?:\.\d+)*)\s*-->/i;
function selfDeclaredCanon(text) {
  const head = maskCode(String(text)).split('\n').slice(0, VERSION_SCAN_LINES).join('\n');
  const m = head.match(SELF_CANON_RE);
  return m ? m[1].toLowerCase() : null;
}

const sameVersion = (a, b) =>
  String(a).toLowerCase().replace(/^v/, '') === String(b).toLowerCase().replace(/^v/, '');

/* [2026-08-10] 전파 보류 — `<!-- 전파보류: v1.3 -->`. 「낡았다」와 **축이 다르다.**
 * 그건 *아직 안 고쳤다*, 이건 *유호님이 지금 고치지 말라고 세워 뒀다*.
 *
 * 왜 있나 (실측 08-10): `docs/SYNK_철학.md` 가 v1.0→v1.3 으로 오르면서 파생 25종이 stale 로
 * 떨어졌는데, 그 전파는 **유호님이 보류시킨 것**이다(정본 머리 명문 「파생 25종 전파는 유호
 * 지시로 보류」 · memory smart-definition 「범위가 너무 커 토큰 낭비 … 일괄 리라이팅을 지시
 * 없이 착수하지 않는다」). 그런데 rot-check 는 stale 을 전부 🔴 로 올려서, 매 세션 시작마다
 * **적색 27건 중 25건이 「고치지 말라고 정해 둔 것」**이었다. 두 사고가 같이 난다:
 *   ① 진짜 적색 2건(라이브 낡음·제미나이LM)이 25건의 소음에 묻힌다 — 적색이 신호를 잃는다.
 *   ② 세션이 그 25건을 「놓친 일감」으로 읽고 집었다가 정본을 읽고서야 되돌린다(이번 세션이
 *      실제로 그랬다). 유호님 확정을 지시 없이 뒤집을 뻔한 자리이기도 하다.
 *
 * 🔑 **만료가 이 설계의 급소다.** 도장에 버전을 박아, 보류는 **그 판에 대해서만** 유효하다.
 *   정본이 v1.4 로 더 오르면 도장(v1.3)은 낡고 파생은 **다시 적색**이 된다. 버전 없는
 *   「보류」 도장이었으면 이 통로는 영구 은폐 장치가 된다 — 한 번 찍으면 그 정본의 낡음이
 *   영원히 안 보인다. 보류는 유호님이 본 그 판에 대한 판단이지 문서에 대한 면제가 아니다.
 *
 * 🚫 보류를 **파생 쪽**에 적지 않는다. 25곳에 같은 도장을 찍으면 형식이 흔들리고, 흔들린
 *   형식은 파서가 조용히 놓친다(addEdge 주석과 같은 이유). 판단의 주인은 정본 하나다. */
const SELF_HOLD_RE = /<!--\s*전파보류:\s*(v\d+(?:\.\d+)*)\s*-->/i;
function selfDeclaredHold(text) {
  const head = maskCode(String(text)).split('\n').slice(0, VERSION_SCAN_LINES).join('\n');
  const m = head.match(SELF_HOLD_RE);
  return m ? m[1].toLowerCase() : null;
}

/* [2026-08-07] 지도 누락 — 「낡은 인용」과 **축이 다르다.** 그건 *연결이 낡았다*, 이건 *연결이 아예 없다*.
 * 왜 있나: 08-05에 신설된 `docs/제품방향.md`가 스스로 「제품 방향 공용 정본」을 선언하는데
 * `docs/문서_지도.md`는 여전히 「제품 방향의 최신 정본 = SYNK_CONTEXT.md」라고 말하고 있었다.
 * 정본 지목이 두 갈래로 갈라진 채 사흘을 갔고, 색인 밖 신설 문서가 12종이었다.
 * **엣지 검사로는 영원히 안 잡힌다** — 색인에 없는 문서는 애초에 아무 선언도 안 하기 때문이다.
 * 오탐 0 설계(파생이 선언한 것만 본다)의 그림자가 정확히 이 자리다.
 *
 * 최상위 `docs/*.md`만 본다 — 하위 폴더(`_ops/`·`정본/`·`tools/`)는 지도가 **폴더 단위**로 적는다.
 * 판정은 파일명 문자열 포함 — 사람이 실제로 지도에 쓰는 표기다(표 칸의 `**제품방향.md**`).
 * 천장: `대장.md` 같은 짧은 이름이 `시스템_대장.md` 안에 묻히면 미탐이 난다.
 * 미탐 쪽으로 기울인 것은 의도다 — 오탐이 나면 이 알림 전체가 신뢰를 잃는다. */
const DOC_MAP = 'docs/문서_지도.md';
const TOP_LEVEL_MD = /^docs\/[^/]+\.md$/;

function findMapGaps(docs) {
  const map = docs.get(DOC_MAP);
  // 지도가 없는 것과 「누락 0」을 같은 모양으로 두지 않는다 — 미실행이 통과처럼 보이면 안 된다.
  if (!map) return { noMap: true, missing: [] };
  const missing = [...docs.keys()]
    .filter((r) => r !== DOC_MAP && TOP_LEVEL_MD.test(r) && !map.text.includes(path.basename(r)))
    .sort();
  return { noMap: false, missing };
}

function build() {
  const files = [...SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d))), ...rootCode()];
  const docs = new Map(); // relPath -> {rel, full, canon, follows:[], text}
  for (const full of files) {
    const r = rel(full);
    let text = '';
    try { text = fs.readFileSync(full, 'utf8'); } catch (_) { continue; }
    // 정본 지위는 경로 규칙 **또는** 자기 선언. 선언이 있으면 버전도 그쪽이 이긴다 —
    // 명시한 값이 머리말에서 주워 온 값보다 정확하다.
    const 선언 = selfDeclaredCanon(text);
    const canon = isCanon(r) || !!선언;
    docs.set(r, {
      rel: r, full, canon,
      edges: parseEdgesFull(text),
      follows: parseEdges(text),
      version: canon ? (선언 || canonVersion(text)) : null,
      hold: canon ? selfDeclaredHold(text) : null,
      text,
    });
  }

  const derivedOf = new Map(); // 정본 relPath -> [파생 relPath...]
  const broken = [];
  const stale = [];        // 정본이 그 뒤로 올라갔다 — 파생이 낡은 판을 인용 중
  const staleHeld = [];    // 낡았지만 그 판의 전파를 유호님이 보류시켰다(SELF_HOLD_RE) — 적색 아님
  const unversioned = [];  // 버전 미기입 = 맞는지 **모른다**(최신이 아니다)
  const canonUnknown = []; // 정본에서 버전을 못 읽었다 — 판정 자체가 불가
  for (const d of docs.values()) {
    for (const e of d.edges) {
      const target = e.target;
      if (!docs.has(target) && !fs.existsSync(path.join(ROOT, target))) {
        broken.push({ from: d.rel, target, kind: looksLikePath(target) ? '없는파일' : '산문' });
        continue;
      }
      if (!derivedOf.has(target)) derivedOf.set(target, []);
      derivedOf.get(target).push(d.rel);

      // 시간축 판정
      const canonDoc = docs.get(target);
      const now = canonDoc ? canonDoc.version : null;
      if (!e.version) unversioned.push({ from: d.rel, target, now });
      else if (!now) canonUnknown.push({ from: d.rel, target, cited: e.version });
      else if (!sameVersion(e.version, now)) {
        // 보류 도장은 **찍힌 그 판에서만** 산다 — 정본이 더 오르면 도장이 낡아 다시 적색이 된다.
        const held = canonDoc.hold && sameVersion(canonDoc.hold, now);
        (held ? staleHeld : stale).push({ from: d.rel, target, cited: e.version, now, ...(held ? { hold: canonDoc.hold } : {}) });
      }
    }
  }

  // 심을 후보 — 본문이 정본을 이름으로 언급하는데 파생 선언이 없는 문서.
  // 자동으로 심지 않는다(오탐이 엣지를 오염시키면 알림 전체가 신뢰를 잃는다). 후보만 보여준다.
  const canons = [...docs.values()].filter((d) => d.canon);
  const candidates = [];
  for (const d of docs.values()) {
    if (d.canon) continue;
    for (const c of canons) {
      const stem = path.basename(c.rel).replace(TEXT_EXT, '');
      if (d.follows.includes(c.rel)) continue;
      if (d.text.includes(stem)) candidates.push({ doc: d.rel, canon: c.rel });
    }
  }
  return {
    docs, derivedOf, broken, candidates, canons, stale, staleHeld, unversioned, canonUnknown,
    mapGaps: findMapGaps(docs),
  };
}

/** 코드 파일의 머리 주석 블록이 끝나는 줄 번호. 셔뱅·`'use strict'`·`//` 줄이 이어지는 동안 내려가고
 *  **빈 줄에서 멈춘다** — 빈 줄까지 삼키면 엣지가 머리에서 떨어져 나와 딴 문단처럼 보인다.
 *  `/*` 블록 주석 앞에서도 멈춘다: 뒤로 밀어 넣으려면 블록의 끝을 세어야 하고, 그 셈이 한 번 틀리면
 *  엣지를 주석 **안**에 심어 파서가 영원히 못 읽는다(조용한 0 — F307 이 새던 그 방향). */
function 코드머리끝(lines) {
  let i = /^#!/.test(lines[0] || '') ? 1 : 0;
  while (i < lines.length) {
    const t = (lines[i] || '').trim();
    if (t.startsWith('//') || /^['"]use strict['"];?$/.test(t)) i += 1;
    else break;
  }
  return i;
}

// 파생 선언을 문서에 심는다. 손으로 10곳에 같은 주석을 붙이면 형식이 흔들리고,
// 흔들린 형식은 파서가 조용히 놓친다 — 그러면 "엣지가 없다"와 "엣지를 못 읽는다"를 구분할 수 없다.
// 제목(첫 # 줄) 바로 다음에 넣어 사람 눈에도 먼저 보이게 한다. 이미 있으면 병합·정렬만 한다.
function addEdge(docRel, canons) {
  const full = path.join(ROOT, docRel);
  const text = fs.readFileSync(full, 'utf8');
  const existing = parseEdgesFull(text);

  // 대상 경로를 키로 병합한다 — 새 지정에 버전이 있으면 그것이 이긴다.
  // (같은 정본이 `x.md`와 `x.md@v1.1` 두 줄로 갈라지면 하나는 영원히 '모름'으로 남는다.)
  const byTarget = new Map();
  for (const e of existing) byTarget.set(e.target, e.version);
  for (const raw of canons) {
    const e = splitVersion(raw);
    const prev = byTarget.get(e.target);
    byTarget.set(e.target, e.version || prev || null);
  }
  const merged = [...byTarget.entries()]
    .map(([t, v]) => (v ? `${t}@${v}` : t))
    .sort();

  const before = existing.map((e) => (e.version ? `${e.target}@${e.version}` : e.target)).sort();
  if (before.length === merged.length && before.every((e, i) => e === merged[i])) return false;

  const line = `<!-- 파생: ${merged.join(', ')} -->`;
  const next = 엣지본문(text, line, docRel);
  if (next === text) return false;
  fs.writeFileSync(full, next, 'utf8');
  return true;
}

/**
 * 엣지 줄을 본문에 넣은 결과를 돌려준다. **순수 함수** — 파일을 안 읽고 안 쓴다.
 *
 * 왜 갈랐나(2026-08-12): 자리·주석 문법 판정이 `addEdge` 안에 있으면 회귀가 이 판정을 재려고
 * **실저장소 파일을 실제로 고쳐야** 하고, 그러면 「버그가 아직 있을 것을 요구하는 회귀」로 굳는다
 * (CLAUDE.md 가드 3맹점 ②). 탐지력은 픽스처 문자열이 지고, 실저장소 검사는 거짓양성만 본다.
 */
function 엣지본문(text, line, docRel) {
  const masked = maskCode(text);
  const spans = [];
  EDGE_RE.lastIndex = 0;
  let mm;
  while ((mm = EDGE_RE.exec(masked)) !== null) spans.push([mm.index, mm.index + mm[0].length]);

  if (spans.length) {
    // 원문에 그냥 replace를 걸면 **코드 펜스 안의 예시**까지 진짜 선언으로 알고 덮어쓴다
    // (표기법을 설명하는 문서를 이 도구로 건드리는 순간 그 문서가 망가진다).
    // 마스킹한 사본에서 자리를 찾고, 그 인덱스로 원문을 자른다 — 길이를 보존했으니 자리가 같다.
    // 🔑 자리만 갈아 끼우므로 `.js` 의 `// ` 감싸개도 그대로 산다(--stamp 가 이 갈래로 온다).
    let out = '';
    let cur = 0;
    spans.forEach(([s, e], i) => {
      out += text.slice(cur, s) + (i === 0 ? line : ''); // 첫 자리만 남기고 나머지는 접는다
      cur = e;
    });
    return out + text.slice(cur);
  }

  {
    /* [2026-08-09] 자리는 **형식마다 다르다.** 원래 규칙은 「첫 `# ` 다음」 하나뿐이라 마크다운만 맞았고,
     * `.txt`·`.html`은 `# `이 없어 전부 `at=0`으로 떨어져 **파일 맨 첫 줄**에 박혔다.
     * `.txt`에서 그건 유호님이 읽는 정본의 첫 줄이 기계 표기가 된다는 뜻이다(눈높이 상시 지시 위반).
     * 쓰기 경로의 사고는 조용하지 않고 **문서에 남는다** — 그래서 형식별로 가른다. */
    /* [2026-08-12] 개행을 파일에서 파생시킨다 — `\n` 으로 자르고 붙이면 CRLF 파일에선 **끼워 넣은 줄만**
     * LF 가 되어 한 파일에 두 개행이 섞인다(`엔진_운영배치.js` 가 CRLF 다). 조용한 오염이라
     * 증상은 다음 사람의 diff 에서야 나온다. */
    const 개행 = /\r\n/.test(text) ? '\r\n' : '\n';
    const lines = text.split(개행);
    const ext = path.extname(docRel).toLowerCase();
    if (ext === '.txt') {
      // .txt 엔 주석 문법이 없다 — 어디에 둬도 사람 눈에 보인다. 그래서 꼬리에 각주로 둔다.
      while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
      lines.push('', line, TXT_EDGE_NOTE, '');
    } else if (ext === '.html') {
      // 진짜 HTML 주석이라 렌더되지 않는다 — doctype 이 있으면 그 다음, 없으면 맨 위.
      lines.splice(/^\s*<!doctype/i.test(lines[0] || '') ? 1 : 0, 0, line);
    } else if (CODE_EXT.test(docRel)) {
      /* [2026-08-12] F307 — `.js` 는 위 두 갈래 어디에도 안 걸려 **마크다운 자리**로 떨어졌고,
       * `# ` 이 없으니 `at = 0` → 파일 맨 앞에 **날 HTML 주석**이 박혔다(실측 `contents_상담AI.js`).
       * 🔴 급소는 「가드가 이걸 통과시킨다」다: `<!--` 는 sloppy 스크립트의 Annex B 한 줄 주석이라
       *   `node --check` 가 exit 0 을 내고, Apps Script 는 모듈이 아니라 스크립트로 돌아 라이브에서도
       *   안 터진다. 배포 전 구문검사(`/deploy` 1단계)가 이 자리에 **눈이 멀어 있고** 증상은 「조용함」뿐 —
       *   대외 카피 원천 파일 맨 앞에 HTML 주석이 박힌 채 배포본에 실려 나간다. CI 모사도 전부 초록이었고
       *   잡은 것은 커밋 직전 사람 눈이었다.
       * 표기 정본 = `엔진_운영배치.js:3` 의 `// <!-- 파생: … -->` — 형식은 그대로 두고 주석으로 감싼다
       *   (EDGE_RE 는 `<!-- 파생: … -->` 만 보므로 파서는 손댈 것이 없다).
       * 자리 = 머리 주석 블록 **바로 다음** — 맨 앞은 그 파일이 무엇인지 말하는 줄의 자리다(`.txt` 를
       *   꼬리로 보낸 것과 같은 축). */
      lines.splice(코드머리끝(lines), 0, `// ${line}`);
    } else {
      let at = lines.findIndex((l) => /^#\s/.test(l));
      at = at === -1 ? 0 : at + 1;
      lines.splice(at, 0, '', line);
    }
    return lines.join(개행);
  }
}

function main() {
  const args = process.argv.slice(2);

  const addIdx = args.indexOf('--add');
  if (addIdx !== -1) {
    const [doc, ...canons] = args.slice(addIdx + 1);
    if (!doc || !canons.length) {
      console.error('사용법: node tools/doc-graph.js --add <파생문서> <정본1> [정본2...]');
      process.exit(1);
    }
    for (const c of canons) {
      const { target } = splitVersion(c); // @버전은 경로가 아니다 — 떼고 실재를 확인한다
      if (!fs.existsSync(path.join(ROOT, target))) {
        console.error(`[doc-graph] 정본이 없다: ${target}  — 오탈자 엣지는 심지 않는다`);
        process.exit(1);
      }
    }
    console.log(addEdge(doc, canons) ? `  + ${doc}  →  ${canons.join(', ')}` : `  = ${doc} (변경 없음)`);
    return;
  }

  // --stamp <파생> : 그 파생의 모든 엣지를 정본의 **현재** 버전으로 갱신한다.
  // 이건 조회가 아니라 **선언**이다 — "이 파생을 지금 정본에 맞춰 읽었다". 확인 없이 찍으면
  // 낡은 문서가 최신이라고 거짓말하게 된다(도구가 잡던 바로 그 사고를 도구로 만드는 셈).
  const stampIdx = args.indexOf('--stamp');
  if (stampIdx !== -1) {
    const doc = args[stampIdx + 1];
    if (!doc) {
      console.error('사용법: node tools/doc-graph.js --stamp <파생문서>');
      process.exit(1);
    }
    const g0 = build();
    const d = g0.docs.get(doc.replace(/\\/g, '/'));
    if (!d) {
      console.error(`[doc-graph] 문서가 없다: ${doc}`);
      process.exit(1);
    }
    const specs = [];
    for (const e of d.edges) {
      const canonDoc = g0.docs.get(e.target);
      const now = canonDoc && canonDoc.version;
      if (!now) { console.log(`  ? ${e.target} — 정본에서 버전을 못 읽었다(그대로 둔다)`); continue; }
      specs.push(`${e.target}@${now}`);
    }
    if (!specs.length) { console.log('  = 찍을 엣지가 없다'); return; }
    console.log(addEdge(doc, specs) ? `  ✔ ${doc}  →  ${specs.join(', ')}` : `  = ${doc} (변경 없음)`);
    console.log('    ↑ 이 파일이 정본의 그 판과 실제로 맞는지는 **사람이 확인한 것**으로 기록된다.');
    return;
  }

  const g = build();

  const ofIdx = args.indexOf('--of');
  if (ofIdx !== -1) {
    const raw = args[ofIdx + 1] || '';
    const target = path.isAbsolute(raw) ? rel(raw) : raw.replace(/\\/g, '/');
    const list = g.derivedOf.get(target) || [];
    if (args.includes('--json')) console.log(JSON.stringify({ canon: target, derived: list }));
    else list.forEach((d) => console.log(d));
    return;
  }

  if (args.includes('--json')) {
    console.log(JSON.stringify({
      derivedOf: Object.fromEntries(g.derivedOf),
      broken: g.broken,
      stale: g.stale,
      staleHeld: g.staleHeld,
      unversioned: g.unversioned,
      canonUnknown: g.canonUnknown,
      mapGaps: g.mapGaps,
      candidates: g.candidates,
      canons: g.canons.map((c) => ({ rel: c.rel, version: c.version })),
    }, null, 2));
    return;
  }

  const totalEdges = [...g.derivedOf.values()].reduce((a, l) => a + l.length, 0);
  console.log(`\n[doc-graph] 문서 ${g.docs.size}개 · 정본 ${g.canons.length}개 · 파생 엣지 ${totalEdges}개\n`);

  if (g.derivedOf.size) {
    console.log('  정본별 파생:');
    for (const [canon, list] of [...g.derivedOf].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`    ${canon}  ←  ${list.length}종`);
      for (const d of list) console.log(`        ${d}`);
    }
  } else {
    console.log('  아직 파생 엣지가 없다. 파생 문서에 다음 한 줄을 넣으면 잡힌다:');
    console.log('    <!-- 파생: docs/브랜드_폰트_정본.md -->');
  }

  if (g.broken.length) {
    const 산문 = g.broken.filter((b) => b.kind === '산문');
    const 없는파일 = g.broken.filter((b) => b.kind !== '산문');
    if (없는파일.length) {
      console.log(`\n  ⚠ 깨진 참조 — ${없는파일.length}건(가리키는 정본이 없다)`);
      for (const b of 없는파일) console.log(`    ${b.from} → ${b.target}`);
    }
    if (산문.length) {
      console.log(`\n  ⚠ 파생 목록에 산문이 섞였다 — ${산문.length}건(**파일이 없는 게 아니다** — 찾으러 가지 말 것)`);
      console.log('     고칠 자리: 그 문서의 `<!-- 파생: … -->` 에서 경로가 아닌 조각을 **별도 주석으로 뗀다**(경로만 남긴다).');
      console.log('     ⚠ 기계 조립물이면 **생성기부터** 고친다 — 산출물만 고치면 다음 재조립이 되살린다.');
      // 줄바꿈이 든 조각은 그대로 찍으면 「여러 건」처럼 보인다 — 한 조각임이 보이게 이스케이프해 찍는다.
      for (const b of 산문) console.log(`    ${b.from} → ${JSON.stringify(b.target)}`);
    }
  }

  if (g.stale.length) {
    console.log(`\n  🔴 낡은 인용 — ${g.stale.length}건(정본은 올라갔는데 파생이 옛 판을 보고 있다)`);
    for (const s of g.stale) {
      console.log(`    ${s.from}`);
      console.log(`        ${s.target}  인용 ${s.cited} → 현재 ${s.now}`);
    }
    console.log('    고친 뒤:  node tools/doc-graph.js --stamp <파생문서>');
  }

  if (g.staleHeld.length) {
    const 정본별 = [...new Set(g.staleHeld.map((s) => `${s.target}@${s.now}`))].join(' · ');
    console.log(`\n  ⏸ 전파 보류 — ${g.staleHeld.length}건(낡았지만 유호님이 그 판에서 세워 뒀다: ${정본별})`);
    console.log('    적색이 아니다. 그 파생을 손댈 일이 생기면 그때 밀린 몫을 같이 반영한다.');
    console.log('    보류를 풀려면 정본 머리의 `<!-- 전파보류: vN -->` 를 지운다(정본이 더 오르면 자동으로 풀린다).');
  }
  if (g.mapGaps.noMap) {
    console.log(`\n  🔴 문서 지도가 없다 — ${DOC_MAP}(색인이 통째로 사라졌다)`);
  } else if (g.mapGaps.missing.length) {
    console.log(`\n  ⚠ 지도 누락 — ${g.mapGaps.missing.length}건(최상위 docs/*.md 인데 ${DOC_MAP} 색인에 없다)`);
    for (const m of g.mapGaps.missing) console.log(`    ${m}`);
    console.log('    → 지도에 한 줄 넣거나, 끝난 문서면 그 자리에서 지운다(보존은 git 이력 — CLAUDE.md v10 「낡은 것은 남기지 않는다」 · _archive 에 새로 넣지 않는다).');
  }

  if (g.canonUnknown.length) {
    console.log(`\n  ⚠ 정본 버전 미상 — ${g.canonUnknown.length}건(정본 머리말에서 vN을 못 읽어 낡음 판정 불가)`);
    for (const c of g.canonUnknown) console.log(`    ${c.target}  ← ${c.from}(인용 ${c.cited})`);
  }
  if (g.unversioned.length) {
    // '최신'이 아니라 '모름'이다. 조용히 통과시키면 그래프가 안심을 지어낸다.
    console.log(`\n  ℹ 버전 미기입 — ${g.unversioned.length}건(맞는지 **모름**. 확인했으면 --stamp)`);
    for (const u of g.unversioned.slice(0, 10)) {
      console.log(`    ${u.from} → ${u.target}${u.now ? ` (정본 현재 ${u.now})` : ''}`);
    }
    if (g.unversioned.length > 10) console.log(`    … 외 ${g.unversioned.length - 10}건`);
  }

  if (g.candidates.length) {
    const byCanon = new Map();
    for (const c of g.candidates) {
      if (!byCanon.has(c.canon)) byCanon.set(c.canon, []);
      byCanon.get(c.canon).push(c.doc);
    }
    console.log(`\n  ℹ 심을 후보 — 정본을 언급하는데 파생 선언이 없는 문서 ${g.candidates.length}건`);
    console.log('    (자동으로 심지 않는다. 진짜 파생인지는 사람이 판정한다.)');
    for (const [canon, docs] of [...byCanon].sort((a, b) => b[1].length - a[1].length).slice(0, 10)) {
      console.log(`    ${canon}`);
      for (const d of docs.slice(0, 8)) console.log(`        ${d}`);
      if (docs.length > 8) console.log(`        … 외 ${docs.length - 8}종`);
    }
  }
  console.log('');
}

if (require.main === module) main();
module.exports = {
  build, parseEdges, parseEdgesFull, splitVersion, canonVersion, selfDeclaredCanon, selfDeclaredHold, sameVersion,
  isCanon, addEdge, 엣지본문, 코드머리끝, rel, shouldSkip, ROOT, findMapGaps, DOC_MAP, looksLikePath,
};
