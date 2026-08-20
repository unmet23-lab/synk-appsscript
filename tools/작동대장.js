#!/usr/bin/env node
/**
 * 작동 대장 — 「매주 무엇을 뜯어고칠 것인가」를 고르는 한 장.
 *
 * 왜 있나 (2026-08-17 유호님: 「주마다 전체 시스템을 점검하고 발전시키고 재설계하려면
 *   작동 원리를 집요할 정도로 완벽히 파악한 장부가 필요하다 · 이해대장보다 가독성을 높여
 *   내가 한눈에 확인할 수 있어야 한다」):
 *
 *   장부는 이미 셋이었고, **축이 셋 다 달랐다.**
 *     · `docs/시스템_대장.md`  → 「무엇이 있나」 (명사 47줄 · 대외 설명용)
 *     · `docs/이해대장.html`   → 「학생을 얼마나 이해하나」 (성과 · 학생 축)
 *     · `docs/운영_한눈에.html` → 「지금 운영 숫자」 (현황)
 *   비어 있던 넷째 축 = **「무엇이 실제로 도나 · 뜯으면 뭐가 같이 죽나」**(동사·결합).
 *   재설계 판정에 필요한 것은 정확히 이 축이다 — 「발화 퀄리티 엔진이 있다」를 알아도
 *   *그걸 뜯을지*는 못 정한다. 정하려면 지금 도는지, 회귀가 지키는지, 자꾸 깨지는지가 있어야 한다.
 *
 *   그리고 실측된 사실 하나 — **시스템은 이미 많이 재고 있는데, 그 값이 전부 SessionStart 훅
 *   출력으로 흘러가 스크롤에 묻힌다.** 유호님은 그것을 한 화면에서 본 적이 없다.
 *   이 도구는 새로 재는 것이 아니라 **흩어진 실측을 한 장으로 모으고 「지난주 대비」를 붙인다.**
 *
 * 설계 넷 — 이해대장(`tools/이해대장.js`)의 것을 그대로 상속한다:
 *   ① **정본에서 «파싱»한다 — 사본을 두지 않는다.** 베끼면 정본 개정 때 화면만 낡는다.
 *   ② **색은 브랜드 킷에서만**(유호 확정) · DESIGN.md 대비 규칙.
 *   ③ **못 읽으면 조용히 넘어가지 않는다** — 「비었다」와 「못 읽었다」가 같은 모양이면 안 된다(F207).
 *   ④ **주소는 «내용»이 아니라 «자리»에 붙는다** — 층 기호 + 순번.
 *
 * 그리고 F537 을 물려받지 않기 위한 못 셋 (이해대장은 두 번 돌리면 값이 달라진다 — 진동):
 *   ⑤ **입력은 repo 안 · 커밋된 판만.** 형제 저장소 작업본을 물지 않는다(그것이 F537 의 원인 후보).
 *      형제 값이 필요해지면 `git show origin/master:<경로>` 로만 읽는다 — 지금 v0 은 아예 안 읽고,
 *      「안 잰 축」 절에 그 사실을 적는다(모르는 것을 0 으로 그리지 않는다).
 *   ⑥ **시각 의존 값에는 「측정 시각」을 붙인다** — 지금 이해대장은 그런 값이 *판정처럼* 보인다.
 *   ⑦ **생성기가 자기 수렴을 스스로 검사한다**(`--수렴검사`) — 두 번 돌려 다르면 fail.
 *      F537 에 대한 직접적인 기계 답이다. 「다시 그려 담아라」는 따를 수 없는 처방이었다(F103 의 모양).
 *
 * 쓰기:
 *   node tools/작동대장.js              → docs/작동대장.html 생성
 *   node tools/작동대장.js --기록       → 그 주의 사진을 장부에 «덧붙인다»(주간 재심의 재료)
 *   node tools/작동대장.js --바로가기   → 생성 + 바탕화면 「SYNK 코어」에 .lnk (이해대장 옆)
 *   node tools/작동대장.js --수렴검사   → 두 번 그려 같은지 검사(다르면 exit 1)
 *   node tools/작동대장.js --요약       → 화면 없이 네 통 개수만 (보드·보고용)
 *
 * ■ 기록은 **자동으로 발동한다** — 유호 픽 ㉱ 2026-08-17 (「자동이 기본, 재심이 분모를 덮는다」)
 *   발동 조건 = **주기(수요일) 재심이 도래한 세션 시작** · 부르는 곳 = `tools/대기열.js` 의 `자동기록()`.
 *   위 `--기록` 은 이제 «손으로도 칠 수 있는 같은 통로»이고, 판정은 `기록하기()` 한 곳이 진다.
 *   🔑 왜 자동이냐 — 발동을 사람 손에 걸어 둔 유호 상시 지시가 08-10 이후 **네 층 전수 0번** 돌았다
 *      (`tools/lib/재심신호.js` 머리말 실측). 그리고 기록은 **놓치면 소급이 안 된다** — 지나간 주의
 *      마찰 건수·통 분포는 되살릴 방법이 없어 그 주가 장부에서 영구 결번이 된다.
 *      화면은 안 봐도 다시 그리면 되므로, 자동/손의 실패 비용이 애초에 비대칭이다.
 *   ⚠ 대가 둘: ①훅은 **커밋하지 않는다**(커밋 주인·범위가 흐려진다 · F041) — 박힌 줄은 미커밋으로
 *      남아 다음 커밋 때 주워간다. ②그 주에 세션을 한 번도 안 열면 그 주는 여전히 빈다(0 은 아니다).
 *
 * ■ 그리고 재심이 **분모를 덮는다** — `--재심완료` 가 그 주의 사진에 「본것·뒤집음」을 잇는다.
 *   덮어쓰기가 아니라 **보강 줄 덧붙이기**다(append-only 규약). 화면이 읽을 때 합쳐 그린다.
 *
 * 🔑 두 자리를 가른다 — **화면은 「지금」, 장부는 「움직임」**:
 *   화면은 매번 다시 그려져 낡을 수 있지만, 장부에 박힌 그 주의 사진은 다시 계산하지 않으니
 *   원리상 안 낡는다. 그래서 주간 재심은 화면 전량이 아니라 **Ⅱ절(지난 기록 대비)만** 읽으면 된다.
 *   유호 지시 08-17: 「도전안 좋다 · 기록용으로 사용하면 너무 좋을 것 같다.」
 */
'use strict';

const fs = require('node:fs');

/* ── Loom — 이 지면이 부품을 «입는» 통로 (2026-08-18 · ④ 지면 배선) ──────────────
 * 판정(훅 게이트·얹을 자리·멱등·범위진단)은 전부 `tools/lib/loom얹기.js` 하나가 진다.
 * 여기서 고르는 것은 프리셋 하나뿐 — `부품만` = 지면이 자기 디자인을 지고 부품만 얹는 판.
 * 🔴 훅이 0 이면 통로가 «안 얹는다». 그래야 「마커만 켜진 초록」이 안 생긴다(F517②). */
const loom얹기모듈 = require('./lib/loom얹기.js');
function loom태우기(html) {
  const r = loom얹기모듈.얹기(html, { 지면: '부품만' });
  if (!r.얹힘 && r.범위흠) console.error('   ⚠ Loom 미적용 — ' + r.범위흠);
  else if (r.얹힘) console.error(`   ✅ Loom 부품 ${r.훅.length}종 — ${r.훅.join('·')}`);
  return r.html;
}

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { 칸나누기 } = require('./lib/표.js');   // 날 split 은 백틱 안 파이프에서 칸을 민다(F119·F253)

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..');
const 산출경로 = process.env.SYNK_작동대장_산출 || path.join(ROOT, 'docs', '작동대장.html');

/** 기록 장부 — **append-only**. 유호 지시 08-17(「도전안 좋다 · 기록용으로 쓰면 너무 좋겠다」).
 *
 * 🔑 왜 상시 화면과 «따로» 두나: 상시 화면은 매번 다시 그려져 낡고 진동할 수 있지만(F537),
 *    **그 주의 사진은 원리상 안 낡는다** — 다시 계산하지 않으니 뒤집힐 값이 없다.
 *    그래서 「지금 상태」는 화면이 지고, 「무엇이 어떻게 움직였나」는 이 장부가 진다.
 * 🔑 그리고 한 겹이 아니라 **여러 주가 쌓여야** 답이 나오는 질문이 있다 —
 *    「보드 계열 42건」이 다음 달에 늘었나 줄었나는 diff 절 하나로는 영원히 못 답한다.
 * ⚠ 행 삭제 금지(CLAUDE.md append-only 장부 규약) — `tests/작동대장.test.js` 가 형식을 지킨다. */
const 기록경로 = process.env.SYNK_작동대장_기록 || path.join(ROOT, 'docs', '_ops', '작동대장_기록.jsonl');

/** 브랜드 킷 — DESIGN.md §1 이 정본. 여기 있는 것은 «인용»이고 새 색을 만들지 않는다. */
const 킷 = {
  paper: '#FAFAF9', ink: '#1B1B1A', navy: '#262626', navy2: '#08090C', navy3: '#373737',
  cream: '#E4E4E7', cream3: '#D1D2D4', slate2: '#666666',
  coral: '#FF6B5C', coral3: '#E8543F', coralWash: '#FFE9E4',
  sun: '#FFD447', emerald: '#13724A',
};

/* ── 공용 ──────────────────────────────────────────────────────────────── */

const 있나 = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const 읽기 = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 못 읽은 입력은 «조용히 0» 이 아니라 목록으로 쌓인다(설계 ③ · F207). */
const 못읽음 = [];
function 입력(이름, 경로, 읽개) {
  const 절대 = path.isAbsolute(경로) ? 경로 : path.join(ROOT, 경로);
  if (!있나(절대)) { 못읽음.push(`${이름} — 파일이 없다 (${경로})`); return null; }
  try { return 읽개(절대); } catch (e) { 못읽음.push(`${이름} — 읽다 실패: ${e.message}`); return null; }
}

/* ── ① 부품 — docs/시스템_대장.md ──────────────────────────────────────── */

function 부품읽기() {
  const md = 입력('시스템 대장', 'docs/시스템_대장.md', (p) => fs.readFileSync(p, 'utf8'));
  if (md == null) return null;
  const 구역들 = [];
  let 현재 = null;
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+?)\s+\((대외|내부)\)\s*$/);
    if (h) { 현재 = { 이름: h[1], 노출: h[2], 행들: [] }; 구역들.push(현재); continue; }
    if (!/^\|/.test(line) || !현재) continue;
    const cells = 칸나누기(line);   // 양끝 파이프는 이 통로가 뗀다
    if (cells.length !== 5) continue;
    if (cells[0] === '상태' || /^-+$/.test(cells[0].replace(/\s/g, ''))) continue;
    현재.행들.push({ 상태: cells[0], 시스템: cells[1], 한줄: cells[2], 시작: cells[3], 최근: cells[4] });
  }
  return 구역들;
}

/* ── ② 이해 사슬 — docs/SYNK_철학.md 부록 A-1 ─────────────────────────────
 * 여기서 «다시 판정하지 않는다» — 정본 표의 ㉠㉡㉢ 행에서 「엔진에 닿는가」 열만 읽어
 * 초록/빨강만 가른다. 판정의 주인은 철학 정본이고 이 화면은 인용이다(설계 ①). */

function 사슬읽기() {
  const md = 입력('철학 정본', 'docs/SYNK_철학.md', (p) => fs.readFileSync(p, 'utf8'));
  if (md == null) return null;
  const 층들 = [];
  for (const line of md.split(/\r?\n/)) {
    if (!/^\|\s*\*\*㉠|^\|\s*\*\*㉡|^\|\s*\*\*㉢/.test(line)) continue;
    // 🔑 이 줄이야말로 날 split 이 못 쓰이는 자리다 — A-1 의 칸 안에는 `talk_index_log` 같은
    //    백틱 코드가 잔뜩 있고, 그 안에 파이프가 하나만 들어와도 칸이 통째로 밀린다(F119·F253).
    const cells = 칸나누기(line);
    if (cells.length < 5) continue;
    const 기호 = (cells[0].match(/[㉠㉡㉢]/) || [''])[0];
    const 이름 = cells[0].replace(/\*\*/g, '').trim();
    const 닿는가 = cells[4];
    const 돈다 = cells[1];
    층들.push({
      기호,
      이름,
      돈다없음: /🔴/.test(돈다),
      닿음: /^✅/.test(닿는가.replace(/\*\*/g, '').trim()),
      끊김: /🔴/.test(닿는가),
    });
  }
  return 층들.length ? 층들 : null;
}

/* ── ③ 장치 — tools/·hooks/ 그리고 그것을 지키는 회귀 ──────────────────── */

function 목록(폴더, 필터) {
  const 절대 = path.join(ROOT, 폴더);
  if (!있나(절대)) return [];
  try {
    return fs.readdirSync(절대, { withFileTypes: true })
      .filter((d) => d.isFile() && (!필터 || 필터(d.name)))
      .map((d) => `${폴더}/${d.name}`);
  } catch { return []; }
}

function 장치읽기() {
  const 도구 = 목록('tools', (n) => n.endsWith('.js'));
  const 라이브 = 목록('tools/lib', (n) => n.endsWith('.js'));
  const 훅 = 목록('.claude/hooks', (n) => !n.startsWith('.'));
  return [...도구, ...라이브, ...훅];
}

/** 말뭉치 — 「이 장치를 누가 부르나」를 재기 위해 저장소의 글을 한 번만 훑어 든다.
 *  ⚠ 이름 일치는 «느슨한» 판정이다(스쳐 지나간 언급도 센다). 그래서 이 축은
 *  「지킨다/부른다」 쪽이 아니라 **「아무도 안 부른다」** 쪽만 신호로 쓴다 —
 *  거짓 초록(이름만 스친 것)보다 거짓 빨강이 안전하기 때문이다. */
function 말뭉치() {
  const 조각 = [];
  const 담기 = (목록들, 라벨) => {
    for (const f of 목록들) {
      const s = 읽기(path.join(ROOT, f));
      if (s == null) { 못읽음.push(`${라벨} ${f} — 읽다 실패`); continue; }
      조각.push({ 경로: f, 본문: s });
    }
  };
  const 테스트들 = 목록('tests', (n) => n.endsWith('.test.js'));
  담기(테스트들, '회귀');
  담기(목록('tools', (n) => n.endsWith('.js')), '도구');
  담기(목록('tools/lib', (n) => n.endsWith('.js')), '도구');
  담기(목록('.claude/hooks', (n) => !n.startsWith('.')), '훅');
  담기(목록('docs', (n) => n.endsWith('.md')), '문서');
  담기(목록('docs/_ops', (n) => n.endsWith('.md')), '문서');
  const 설정 = 읽기(path.join(ROOT, '.claude/settings.json'));
  if (설정 == null) 못읽음.push('훅 등록층(.claude/settings.json) — 읽다 실패');
  else 조각.push({ 경로: '.claude/settings.json', 본문: 설정 });
  const 지침 = 읽기(path.join(ROOT, 'CLAUDE.md'));
  if (지침 != null) 조각.push({ 경로: 'CLAUDE.md', 본문: 지침 });

  const 회귀합본 = 조각.filter((c) => c.경로.startsWith('tests/')).map((c) => c.본문).join('\n');
  return { 조각, 회귀개수: 테스트들.length, 회귀합본 };
}

/** 장치 이름 → 그 이름을 «자기 자신 말고» 언급하는 파일 수. 0 이면 부르는 데가 없다. */
function 참조지도(장치들, 말) {
  const 지도 = new Map();
  for (const p of 장치들) {
    const 이름 = path.basename(p).replace(/\.js$/, '');
    let n = 0;
    for (const c of 말.조각) {
      if (c.경로 === p) continue;           // 자기 자신은 안 센다
      if (c.본문.includes(이름)) n++;
    }
    지도.set(p, n);
  }
  return 지도;
}

/* ── ④ 마찰 — docs/_ops/장부/F*.md ────────────────────────────────────────
 * 「자꾸 깨지는 자리」는 손으로 세지 않는다. 장부 본문이 인용한 **파일 경로**를 세면
 * 어느 부품이 반복해서 아팠는지가 나온다. 이것이 재설계 1순위의 실측 근거다. */

function 마찰읽기() {
  const 파일들 = 목록('docs/_ops/장부', (n) => /^F\d+\.md$/.test(n));
  const 언급 = new Map();      // 경로 → Set(F번호)
  const 날짜별 = new Map();    // YYYY-MM-DD → 건수
  let 읽은수 = 0;
  for (const f of 파일들) {
    const s = 읽기(path.join(ROOT, f));
    if (s == null) { 못읽음.push(`장부 ${f} — 읽다 실패`); continue; }
    읽은수++;
    const 번호 = path.basename(f, '.md');
    const d = s.match(/\b(20\d\d-\d\d-\d\d)\b/);
    if (d) 날짜별.set(d[1], (날짜별.get(d[1]) || 0) + 1);
    for (const m of s.matchAll(/(?:tools\/(?:lib\/)?[\w가-힣.-]+\.js|\.claude\/hooks\/[\w가-힣.-]+|tests\/[\w가-힣.-]+\.test\.js)/g)) {
      const 경로 = m[0].replace(/\\/g, '/');
      if (!언급.has(경로)) 언급.set(경로, new Set());
      언급.get(경로).add(번호);
    }
  }
  return { 전체: 파일들.length, 읽은수, 언급, 날짜별 };
}

/* ── ⑤ 손댐 — git 한 번만 훑는다(파일당 git log 는 136번 프로세스라 안 쓴다) ──
 * 🔴 **재는 층이 값을 깨뜨린다** — 실측 2026-08-17: `git log --name-only` 는 비ASCII 경로를
 *   `"tools/lib/\353\263\264\353\223\234.js"` 로 **8진 이스케이프 + 따옴표** 해서 낸다(`core.quotepath` 기본값).
 *   이 저장소는 파일명이 거의 다 한글이라, 안 풀면 **전건이 조용히 「모름」**이 되고
 *   「⚪ 오래 안 봤다 = 0」이라는 **거짓 초록**이 나온다 — 원본은 멀쩡한데 자가 깨진 자리다(CLAUDE.md 판정·검증).
 *   그래서 못을 둘 친다: ① `-c core.quotepath=false` 로 애초에 raw 로 받고
 *   ② 그래도 따옴표꼴이 오면 손으로 푼다(설정이 어딘가에서 되살아나도 안 샌다).
 *   회귀 = `tests/작동대장.test.js` 의 픽스처(한글 파일명) — 실저장소가 깨끗해도 탐지력이 안 죽는다. */

/** `"a/\353\263\264.js"` → `a/보.js`. 따옴표가 없으면 그대로 돌려준다. */
function 경로풀기(s) {
  if (!s.startsWith('"') || !s.endsWith('"')) return s;
  const 속 = s.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < 속.length; i++) {
    if (속[i] !== '\\') { bytes.push(속.charCodeAt(i)); continue; }
    const 팔진 = 속.slice(i + 1, i + 4);
    if (/^[0-7]{3}$/.test(팔진)) { bytes.push(parseInt(팔진, 8)); i += 3; continue; }
    const 다음 = 속[i + 1];
    const 표 = { n: 10, t: 9, r: 13, '\\': 92, '"': 34 };
    if (다음 in 표) { bytes.push(표[다음]); i += 1; continue; }
    bytes.push(92);
  }
  return Buffer.from(bytes).toString('utf8');
}

/* 🔴 **못 셋째 — 시계가 둘이다**(F600 · 실측 2026-08-18):
 *   `--date=short` 는 **작성자 타임존**으로 날짜를 렌더한다. 그런데 `오늘`(:773)은 **UTC 날짜**라,
 *   한국(UTC+9)에서는 **매일 00:00~09:00 KST 동안 두 축이 하루 갈리고** 그 창에 손댄 파일이
 *   전부 `-1일`로 인쇄됐다(실측: `codex-review`·`대기열` 이 `2026-08-18 · -1일`).
 *   이 파일 머리말(:468~472)이 「이 저장소엔 「오늘」이 둘이다」를 이미 경고했는데, 그 못은
 *   **기록 이음**에만 박혔고 여기 나이 계산엔 안 닿아 있었다 — git 이 «세 번째 시계»를 들고
 *   들어오는 자리를 안 본 것이다.
 *   ▶ 그래서 **git 에서 축을 없앤다**: `--date=unix`(타임존 없는 epoch)로 받아 JS 가 UTC 로 접는다.
 *     `--date=format-local` 이나 `TZ=` 는 **repo 밖 환경에 기대는 검사**라 CI 에서 갈린다(F296).
 *   ⚠ 대가: 08:00 KST 커밋이 화면에 «어제»로 적힌다. 참고 열이라 감당하되, 축은 열 이름이 말한다. */

/** epoch 초 → UTC 날짜 `YYYY-MM-DD`. 숫자가 아니면 null(조용히 0 으로 접지 않는다).
 *  🔑 `Number('')` 은 **0** 이라 빈 문자열이 `1970-01-01` 로 «맞는 얼굴»을 하고 들어온다 —
 *     그래서 빈 값·공백은 숫자로 세기 «전에» 거른다(F207: 못 읽은 것과 0 은 다른 말이다). */
function UTC날짜(초) {
  if (typeof 초 === 'string' && !/^\s*-?\d+\s*$/.test(초)) return null;
  const n = Number(초);
  if (!Number.isFinite(n)) return null;
  return new Date(n * 1000).toISOString().slice(0, 10);
}

/** git 출력 → `경로 → 최근 UTC 날짜` 지도. **순수 함수** — 픽스처가 탐지력을 진다(맹점 ②).
 *  실저장소는 지금 안 깨져 있어, 실저장소만 검사하면 이 파서가 눈이 멀어도 초록이다. */
function 손댐파싱(out) {
  const 지도 = new Map();   // 경로 → 최근 YYYY-MM-DD (UTC · 첫 등장이 최신)
  let 현재날짜 = null;
  for (const line of out.split(/\r?\n/)) {
    /* 도장 줄은 `@<epoch>` — **숫자를 못박는다**. 두 방향을 다 막는다:
     *   ㉠ `@types/index.js` 같은 «파일»을 날짜로 안 읽는다.
     *   ㉡ 포맷이 옛 `--date=short` 로 되돌아가면 `@2026-08-18` 이 도장으로 «안» 잡혀
     *      지도가 통째로 비고, 아래 `size === 0` 못이 **소리내어** 잡는다.
     * 🔑 못 푼 도장을 세는 칸은 **일부러 안 둔다** — `\d+` 는 언제나 파싱되므로 그 계수기는
     *    원리상 0 을 벗어날 수 없다. 못 도는 계수기는 분모의 얼굴을 한 장식이다(F543). */
    if (/^@\d+$/.test(line)) { 현재날짜 = UTC날짜(line.slice(1)); continue; }
    const p = 경로풀기(line.trim());
    if (!p || !현재날짜) continue;
    if (!지도.has(p)) 지도.set(p, 현재날짜);
  }
  return { 지도 };
}

function 손댐지도() {
  let out;
  try {
    out = execFileSync('git',
      ['-c', 'core.quotepath=false', 'log', '--since=1 year ago', '--date=unix', '--format=@%ad', '--name-only'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  } catch (e) { 못읽음.push(`git 이력 — 읽다 실패: ${e.message}`); return null; }
  const { 지도 } = 손댐파싱(out);
  if (지도.size === 0) 못읽음.push('git 이력 — 경로를 하나도 못 읽었다(0건). 「오래 안 봤다」는 판정이 아니다.');
  return 지도;
}

/* ── ⑥ 적체 — 열린 일감·결정 ──────────────────────────────────────────── */

function 적체읽기() {
  const 결과 = { 일감: null, 점수: null };
  /* 🔑 2026-08-20 위임 2단계 — 열린 일감의 정본이 `docs/_ops/작업대기열.md` 에서 **열린 PR** 로 옮겼다.
   *   그 파일은 08-19 철거 때 이미 지워졌고, 여기만 남아 매 실행마다 「읽다 실패」를 냈다(거짓 못읽음).
   * ⚠ 여기서 gh 를 부르지 않는다 — 이 도구는 **네트워크 0**이 규약이다. 열린 트랙 수는 `gh pr list` 로 따로 본다. */
  결과.일감 = null;

  /* 엔진점수.jsonl 도 같은 자리다 — e75fc7fc(08-19 자기검증 층 철거)가 자료를 지웠는데 읽는 쪽이
   * 남아 매 실행 「읽다 실패」를 냈다(거짓 못읽음 · F207 의 역방향). 성능 축이 되살아나면 그때 새로 단다. */
  결과.점수 = null;
  return 결과;
}

/* ── 판정: 네 통 ──────────────────────────────────────────────────────────
 * ⚫ 아무도 안 부른다 — 회귀·다른 도구·훅·문서·설정 어디에도 이름이 없다 → **삭제 후보**
 * 🟠 자꾸 깨진다     — 마찰 장부 N건 이상이 그 파일을 인용 → **재설계 후보**
 * 🔴 맨몸이다        — 남들은 부르는데 회귀가 없다 → **뜯으면 위험**
 * 🟢 나머지
 *
 * ⚠ **시간 축(「오래 안 봤다」)은 일부러 뺐다** — 유호 확정 08-17: 「낡음」은 시간이 아니라
 *   **지금 방향과의 정합**이다. 시간으로 낡음을 그리면 이 화면이 그 확정의 반대를 가르친다.
 *   (겸해서 실측상 신호도 없다 — 저장소 최고령 도구가 14일이라 어떤 임계값도 0 아니면 전부다.)
 *   대신 「마지막 손댐」은 **판정이 아니라 참고 열**로만 남긴다.
 *
 * ⚠ 이 판정은 **장치 층**(도구·라이브러리·훅)만 본다 — 부품(대외 45줄)은 파일 매핑이
 *   자동으로 안 서서 v0 에서 뺐다(버전 태그→커밋 사슬이 실측에서 끊겼다 · 「안 잰 축」에 적었다). */

/** 마찰 인용 몇 건부터 「자꾸 깨진다」로 볼 것인가.
 *  실측 분포 2026-08-17 (장치 136): 0건 71 · 1건 23 · 2건 14 · 3건 7 · 4건 6 · 5건 이상 15.
 *  2 로 끊으면 42건이라 «주간에 읽는 목록»이 못 된다. 5 = 읽히는 길이이자 분포의 꼬리다.
 *  임계값은 숨기지 않는다 — 화면이 분포를 통째로 싣는다(0 은 분모와 함께 · 유호 확정 08-14). */
const 깨짐기준 = 5;

function 분류(장치들, 말, 참조, 마찰, 손댐, 오늘) {
  const 통 = { 안불림: [], 깨짐: [], 맨몸: [], 괜찮음: [] };
  const 분포 = new Map();
  for (const p of 장치들) {
    const 이름 = path.basename(p).replace(/\.js$/, '');
    const 회귀있음 = 말 ? 말.회귀합본.includes(이름) : null;
    const 참조수 = 참조 ? (참조.get(p) ?? null) : null;
    const F들 = 마찰 ? (마찰.언급.get(p) || new Set()) : new Set();
    const 날 = 손댐 ? 손댐.get(p) || null : null;
    const 지난날 = 날 ? Math.round((오늘 - Date.parse(날 + 'T00:00:00Z')) / 86400000) : null;
    분포.set(F들.size, (분포.get(F들.size) || 0) + 1);

    const 줄 = { 경로: p, 이름, 회귀있음, 참조수, 마찰수: F들.size, F: [...F들].sort(), 날, 지난날 };
    if (참조수 === 0) 통.안불림.push(줄);
    else if (F들.size >= 깨짐기준) 통.깨짐.push(줄);
    else if (회귀있음 === false) 통.맨몸.push(줄);
    else 통.괜찮음.push(줄);
  }
  통.깨짐.sort((a, b) => b.마찰수 - a.마찰수 || a.경로.localeCompare(b.경로));
  통.맨몸.sort((a, b) => (b.참조수 || 0) - (a.참조수 || 0) || a.경로.localeCompare(b.경로));
  통.안불림.sort((a, b) => a.경로.localeCompare(b.경로));
  return { 통, 분포 };
}

/* ── 모으기 ──────────────────────────────────────────────────────────────── */

function 재기(오늘) {
  못읽음.length = 0;
  const 부품 = 부품읽기();
  const 사슬 = 사슬읽기();
  const 장치들 = 장치읽기();
  const 말 = 말뭉치();
  const 참조 = 참조지도(장치들, 말);
  const 마찰 = 마찰읽기();
  const 손댐 = 손댐지도();
  const 적체 = 적체읽기();
  const { 통, 분포 } = 분류(장치들, 말, 참조, 마찰, 손댐, 오늘);
  const 기록 = 기록읽기();
  // ⚠ 못읽음을 «먼저» 붙인다 — 스냅샷이 그것을 세므로, 순서가 뒤면 기록이 통째로 죽는다.
  const d = { 부품, 사슬, 장치들, 말, 참조, 마찰, 손댐, 적체, 통, 분포, 기록, 못읽음: [...못읽음] };
  // ⚠ 「지금」 스냅샷의 날짜는 견주기에 안 쓴다 — 쓰면 화면이 시각에 물려 수렴이 깨진다(F537 의 축).
  d.움직임 = 기록.줄들.length ? 움직임(스냅샷(d, '(지금)'), 기록.줄들.at(-1)) : null;
  return d;
}

/* ── 기록 장부 — 그 주의 사진 (append-only) ─────────────────────────────── */

/** 한 회차를 «다시 계산할 필요 없는 모양»으로 접는다 — 이것이 장부에 실릴 전부다. */
function 스냅샷(d, 날짜) {
  const 짧게 = (줄들) => 줄들.map((r) => [r.경로, r.마찰수]);
  return {
    날짜,
    장치: d.장치들.length,
    회귀: d.말 ? d.말.회귀개수 : null,
    마찰: d.마찰 ? d.마찰.전체 : null,
    통: {
      깨짐: d.통.깨짐.length, 맨몸: d.통.맨몸.length,
      안불림: d.통.안불림.length, 괜찮음: d.통.괜찮음.length,
    },
    깨짐: 짧게(d.통.깨짐),
    맨몸: d.통.맨몸.map((r) => r.경로),
    안불림: d.통.안불림.map((r) => r.경로),
    못읽음: d.못읽음.length,
  };
}

/** 장부를 읽는다. **못 읽은 줄은 조용히 버리지 않는다** — 몇 줄이 깨졌는지 함께 낸다(F207).
 *
 * 🔑 **두 종류의 줄을 가른다**(유호 픽 ㉱ 08-17 — 「자동이 기본, 재심이 분모를 덮는다」):
 *    ㉠ 사진 줄 = `스냅샷()` 이 박은 그 주의 상태.  ㉡ 보강 줄 = `사건:'재심'` — 그 주에 재심을
 *    «실제로 돌렸다»는 분모(본것·뒤집음).
 *    안 가르면 `줄들.at(-1)` 이 보강 줄을 「지난 사진」으로 집어 **움직임 절이 통째로 거짓**이 된다 —
 *    보강 줄엔 `통` 이 없어 델타가 죄다 NaN 으로 새는데, 화면은 멀쩡한 얼굴로 뜬다(맞는 얼굴로 틀린 값).
 *    ⚠ 옛 줄에는 `사건` 필드가 없다 → 사진으로 분류된다(하위호환 — 08-17 첫 기록 1건이 그 모양이다). */
function 기록읽기() {
  if (!있나(기록경로)) return { 줄들: [], 보강: [], 깨진줄: 0, 있나: false };
  const s = 읽기(기록경로);
  if (s == null) { 못읽음.push('작동대장 기록 장부 — 읽다 실패'); return { 줄들: [], 보강: [], 깨진줄: 0, 있나: true }; }
  const 줄들 = []; const 보강 = []; let 깨진줄 = 0;
  for (const line of s.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r && r.사건 === '재심') 보강.push(r); else 줄들.push(r);
    } catch { 깨진줄++; }
  }
  if (깨진줄) 못읽음.push(`작동대장 기록 장부 — 파싱 안 되는 줄 ${깨진줄}건`);
  return { 줄들, 보강, 깨진줄, 있나: true };
}

/** 지난 사진과 지금을 견준다. 「무엇이 새로 들어왔나 · 무엇이 빠졌나」가 재심의 실제 재료다. */
function 움직임(지금, 지난) {
  if (!지난) return null;
  const 집합 = (v) => new Set((v || []).map((x) => (Array.isArray(x) ? x[0] : x)));
  const 갈래 = (이름) => {
    const a = 집합(지난[이름]); const b = 집합(지금[이름]);
    return { 들어옴: [...b].filter((x) => !a.has(x)), 빠짐: [...a].filter((x) => !b.has(x)) };
  };
  const 지난깨짐 = new Map((지난.깨짐 || []).map(([p, n]) => [p, n]));
  const 오름 = (지금.깨짐 || [])
    .filter(([p, n]) => 지난깨짐.has(p) && n > 지난깨짐.get(p))
    .map(([p, n]) => ({ 경로: p, 전: 지난깨짐.get(p), 후: n }));
  return {
    지난날짜: 지난.날짜,
    델타: {
      깨짐: 지금.통.깨짐 - 지난.통.깨짐, 맨몸: 지금.통.맨몸 - 지난.통.맨몸,
      안불림: 지금.통.안불림 - 지난.통.안불림, 괜찮음: 지금.통.괜찮음 - 지난.통.괜찮음,
      장치: 지금.장치 - 지난.장치, 마찰: (지금.마찰 || 0) - (지난.마찰 || 0),
    },
    깨짐: 갈래('깨짐'), 맨몸: 갈래('맨몸'), 안불림: 갈래('안불림'), 마찰오름: 오름,
  };
}

/** 장부에 한 줄 덧붙인다 — **덧붙이기만 한다**(고치거나 지우지 않는다 · append-only 규약).
 *  꼬리 개행을 먼저 보는 이유: 앞 줄이 개행 없이 끝나 있으면 두 줄이 한 줄로 붙어 **둘 다 깨진다.** */
function 장부에덧붙이기(줄) {
  fs.mkdirSync(path.dirname(기록경로), { recursive: true });
  const 앞 = 있나(기록경로) ? 읽기(기록경로) : '';
  fs.appendFileSync(기록경로, `${앞 && !앞.endsWith('\n') ? '\n' : ''}${줄}\n`, 'utf8');
}

/** 그 주의 사진을 장부에 박는다 — **CLI 와 훅이 함께 쓰는 통로 하나.**
 *  유호 픽 ㉱ 08-17 로 부르는 곳이 둘이 됐다. 둘로 갈라 적으면 판정이 갈라진다
 *  (CLAUDE.md 신뢰성: 호출부마다 고치는 대신 «잘못 쓸 수 없는 공용 통로»).
 *  🔑 이 함수는 **말을 안 한다** — 「무슨 일이 있었나」만 돌려주고 화면에 옮기는 것은 부르는 쪽이다
 *     (훅은 한 줄로, CLI 는 여러 줄로 낸다). 그래야 같은 판정이 두 곳에서 갈리지 않는다. */
function 기록하기({ 강제 = false, 오늘: 오늘값, 날짜 } = {}) {
  const 기준 = 오늘값 ?? Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const 그날 = 날짜 || new Date(기준).toISOString().slice(0, 10);
  const d = 재기(기준);
  /* 🔴 못 읽은 판은 **박지 않는다** — 거짓 사진 한 장이 다음 주 「움직임」을 통째로 속인다.
   *   ⚠ 자동 발동에서는 이 거부가 **조용해진다**(아무도 exit code 를 안 본다) — 그래서 부르는 쪽이
   *   빨간 줄로 낸다. 유호 픽 ㉱ 의 「한 수 더」가 이것이다. */
  if (d.못읽음.length) return { 상태: '거부', 사유: d.못읽음.slice(), 날짜: 그날 };
  const 기존 = d.기록.줄들;
  if (기존.some((r) => r.날짜 === 그날) && !강제) return { 상태: '중복', 날짜: 그날, 번째: 기존.length };
  장부에덧붙이기(JSON.stringify(스냅샷(d, 그날)));
  return { 상태: 'ok', 날짜: 그날, 번째: 기존.length + 1, 통: d.통 };
}

/** 재심을 **실제로 돌렸다**는 분모를 그 주의 사진에 잇는다(유호 픽 ㉱ 08-17 — 「재심이 덮어쓴다」).
 *
 * 🔑 **덮어쓰기가 아니라 덧붙이기다** — append-only 장부라 기존 줄은 못 고친다(CLAUDE.md 규약 ·
 *    `tests/장부유실.test.js`). 합치는 것은 읽는 쪽(화면)이 한다.
 * 🔑 **날짜로 잇지 않는다 — 이 저장소엔 「오늘」이 둘이다.** 작동대장은 UTC 날짜를 쓰고
 *    (`toISOString().slice(0,10)`), `lib/재심신호.js` 는 로컬 날짜를 쓴다(F 계열 시간대 사고 예방으로
 *    일부러 그렇게 짰다). 한국은 UTC+9 라 **09시 이전엔 두 통로의 「오늘」이 하루 갈린다** —
 *    날짜로 이으면 그 시간대에 돌린 재심이 조용히 안 붙는다(맞는 얼굴로 틀린 값).
 *    그래서 잇는 것은 **장부의 마지막 사진 줄**이고, 그 날짜를 `대상` 에 박아 둔다. */
function 재심보강({ 본것, 뒤집음 = 0, 지금 = new Date() } = {}) {
  const { 줄들, 보강 } = 기록읽기();
  if (!줄들.length) return { 상태: '사진없음' };
  const 대상 = 줄들.at(-1).날짜;
  if (보강.some((r) => r.대상 === 대상)) return { 상태: '이미있음', 대상 };
  const 줄 = {
    날짜: 지금.toISOString().slice(0, 10), 사건: '재심', 대상,
    본것: Number(본것) || 0, 뒤집음: Number(뒤집음) || 0,
  };
  장부에덧붙이기(JSON.stringify(줄));
  return { 상태: 'ok', 대상, 본것: 줄.본것, 뒤집음: 줄.뒤집음 };
}

module.exports = {
  재기, 분류, 경로풀기, 깨짐기준, 스냅샷, 기록읽기, 움직임, 기록경로,
  기록하기, 재심보강, 손댐파싱, UTC날짜, 나이꼬리,
};

/* ── 그리기 ──────────────────────────────────────────────────────────────── */

function 통칸(색, 기호, 제목, 수, 뜻) {
  return `<div class="tong" style="--c:${색}">
    <div class="tong-h"><span class="tong-i">${기호}</span><span class="tong-n">${esc(제목)}</span></div>
    <div class="tong-v">${수}</div>
    <div class="tong-d">${esc(뜻)}</div>
  </div>`;
}

/** 나이 꼬리. **음수를 0 으로 안 접는다**(F480·F207) — 축을 하나로 맞춘 뒤에도
 *  시계 어긋남·리베이스로 «미래 날짜» 커밋은 실재한다. 접으면 그때 아무 말도 안 하는
 *  «맞는 얼굴»이 되므로, 접는 대신 **다른 이름으로 드러낸다**. */
function 나이꼬리(지난날) {
  if (지난날 == null) return '';
  if (지난날 < 0) return ` <span class="pill unk">앞선 날짜 ${-지난날}일</span>`;
  return `<span class="dim"> · ${지난날}일</span>`;
}

function 줄표(줄들, 상한) {
  if (!줄들.length) return '<p class="none">해당 없음 — 이 통은 비었다.</p>';
  const 보임 = 줄들.slice(0, 상한);
  const 남음 = 줄들.length - 보임.length;
  const tr = 보임.map((r) => `<tr>
      <td class="mono">${esc(r.경로)}</td>
      <td class="c">${r.마찰수 ? `<span class="pill warn">${r.마찰수}건</span> <span class="fs">${r.F.slice(0, 7).map(esc).join(' ')}</span>` : '—'}</td>
      <td class="c">${r.회귀있음 === false ? '<span class="pill bad">없다</span>' : r.회귀있음 === true ? '있다' : '<span class="pill unk">모름</span>'}</td>
      <td class="c">${r.참조수 == null ? '<span class="pill unk">모름</span>' : r.참조수 === 0 ? '<span class="pill bad">0곳</span>' : `${r.참조수}곳`}</td>
      <td class="c">${r.날 ? `${esc(r.날)}${나이꼬리(r.지난날)}` : '<span class="pill unk">모름</span>'}</td>
    </tr>`).join('\n');
  return `<table class="t">
    <thead><tr><th>파일</th><th>깨진 이력</th><th>회귀</th><th>부르는 곳</th><th>마지막 손댐 <span class="dim">(참고 · UTC)</span></th></tr></thead>
    <tbody>${tr}</tbody></table>
    ${남음 > 0 ? `<p class="more">…외 ${남음}건 — 전량은 <code>node tools/작동대장.js --요약</code></p>` : ''}`;
}

/** 마찰 인용 분포를 통째로 싣는다 — 임계값을 숨기면 「15건」이 참인지 아무도 못 잰다. */
function 분포막대(분포) {
  const 키 = [...분포.keys()].sort((a, b) => a - b);
  if (!키.length) return '';
  const 최대 = Math.max(...분포.values());
  return `<div class="hist">${키.map((k) => {
    const v = 분포.get(k);
    const 넘 = k >= 깨짐기준;
    return `<div class="hb"><div class="hb-bar" style="height:${Math.max(3, (v / 최대) * 84)}px;background:${넘 ? 킷.coral3 : 킷.cream3}"></div>
      <div class="hb-v">${v}</div><div class="hb-k">${k}${k === 0 ? '건' : ''}</div></div>`;
  }).join('')}</div>
  <p class="more">가로 = 그 도구가 마찰 장부에 인용된 건수 · 세로 = 도구 개수 · <b style="color:${킷.coral3}">빨강 = ${깨짐기준}건 이상</b>(「자꾸 깨진다」로 세는 구간).</p>`;
}

/** ±N 을 색으로 — 🟠🔴⚫ 는 줄면 좋고, 🟢 는 늘면 좋다. */
function 델타(n, 늘면좋나) {
  if (!n) return '<span class="d0">±0</span>';
  const 좋음 = 늘면좋나 ? n > 0 : n < 0;
  return `<span class="${좋음 ? 'dg' : 'db'}">${n > 0 ? '+' : ''}${n}</span>`;
}

function 목록칩(제목, 항목들, 색) {
  if (!항목들.length) return '';
  return `<div class="chip-row"><span class="chip-t" style="color:${색}">${esc(제목)}</span>
    ${항목들.slice(0, 10).map((s) => `<code>${esc(s)}</code>`).join(' ')}
    ${항목들.length > 10 ? `<span class="dim">…외 ${항목들.length - 10}</span>` : ''}</div>`;
}

function 움직임절(움, 기록) {
  if (!기록.있나) {
    return `<div class="warnbox"><b>아직 기록이 없다.</b> <code>node tools/작동대장.js --기록</code> 를
      한 번 돌리면 그 순간이 장부에 박히고, <b>다음 판부터 여기에 「무엇이 움직였나」가 뜬다.</b>
      기록은 지우지 않는다(append-only) — 그래서 몇 주가 쌓이면 추세가 보인다.</div>`;
  }
  if (!움) {
    return `<div class="warnbox">장부 파일은 있는데 <b>읽을 수 있는 줄이 0</b>이다 — 「움직임 없음」이 아니라
      <b>「못 읽었다」</b>다(F207). <code>docs/_ops/작동대장_기록.jsonl</code> 을 연다.</div>`;
  }
  const D = 움.델타;
  const 조용 = !움.깨짐.들어옴.length && !움.깨짐.빠짐.length && !움.맨몸.들어옴.length
    && !움.맨몸.빠짐.length && !움.안불림.들어옴.length && !움.안불림.빠짐.length && !움.마찰오름.length;
  return `<table class="t"><thead><tr><th>통</th><th>지난 기록 (${esc(움.지난날짜)})</th><th>지금</th><th>움직임</th></tr></thead><tbody>
    <tr><td>🟠 자꾸 깨진다</td><td class="c">${기록.줄들.at(-1).통.깨짐}</td><td class="c"><b>${기록.줄들.at(-1).통.깨짐 + D.깨짐}</b></td><td class="c">${델타(D.깨짐, false)}</td></tr>
    <tr><td>🔴 맨몸이다</td><td class="c">${기록.줄들.at(-1).통.맨몸}</td><td class="c"><b>${기록.줄들.at(-1).통.맨몸 + D.맨몸}</b></td><td class="c">${델타(D.맨몸, false)}</td></tr>
    <tr><td>⚫ 아무도 안 부른다</td><td class="c">${기록.줄들.at(-1).통.안불림}</td><td class="c"><b>${기록.줄들.at(-1).통.안불림 + D.안불림}</b></td><td class="c">${델타(D.안불림, false)}</td></tr>
    <tr><td>🟢 괜찮다</td><td class="c">${기록.줄들.at(-1).통.괜찮음}</td><td class="c"><b>${기록.줄들.at(-1).통.괜찮음 + D.괜찮음}</b></td><td class="c">${델타(D.괜찮음, true)}</td></tr>
    <tr><td class="dim">장치 · 마찰 장부</td><td class="c dim">—</td><td class="c dim">—</td><td class="c">${델타(D.장치, true)} · ${델타(D.마찰, true)}</td></tr>
  </tbody></table>
  ${조용 ? '<p class="none">통을 드나든 파일은 없다 — 숫자가 같으면 <b>진짜로</b> 같다(이 절이 0 을 0 이라고 말할 수 있는 이유는 위 장부에 지난 목록이 통째로 있기 때문이다).</p>' : `
  ${목록칩('🟠 새로 들어옴', 움.깨짐.들어옴, 킷.coral3)}
  ${목록칩('🟠 빠짐', 움.깨짐.빠짐, 킷.emerald)}
  ${목록칩('🔴 맨몸 새로', 움.맨몸.들어옴, 킷.coral3)}
  ${목록칩('🔴 맨몸 벗어남', 움.맨몸.빠짐, 킷.emerald)}
  ${목록칩('⚫ 삭제 후보 새로', 움.안불림.들어옴, 킷.navy)}
  ${목록칩('⚫ 삭제 후보 벗어남', 움.안불림.빠짐, 킷.emerald)}
  ${움.마찰오름.length ? `<div class="chip-row"><span class="chip-t" style="color:${킷.coral3}">📈 또 아팠다</span>
    ${움.마찰오름.map((x) => `<code>${esc(x.경로)}</code><span class="dim"> ${x.전}→${x.후}</span>`).join(' · ')}</div>` : ''}`}`;
}

function 추세표(기록) {
  const 줄들 = 기록.줄들.slice(-8);
  if (줄들.length < 2) return '';
  /* 재심 분모를 그 주의 사진 **옆에** 붙인다(유호 픽 ㉱ 08-17). 같은 줄에 있어야
   *  «통은 움직였는데 그 주에 아무도 판을 다시 안 봤다»가 눈에 걸린다 — 그게 이 표의 쓸모다.
   *  「—」 는 「재심을 안 돌렸다」이고, 0 이 아니라 빈칸인 이유는 «분모가 없다»여서다. */
  const 보강 = new Map((기록.보강 || []).map((r) => [r.대상, r]));
  return `<table class="t"><thead><tr><th>기록</th><th class="c">🟠</th><th class="c">🔴</th><th class="c">⚫</th><th class="c">🟢</th><th class="c">장치</th><th class="c">마찰 장부</th><th class="c">그 주 재심</th></tr></thead><tbody>
  ${줄들.map((r) => {
    const b = 보강.get(r.날짜);
    return `<tr><td class="mono">${esc(r.날짜)}</td>
    <td class="c">${r.통.깨짐}</td><td class="c">${r.통.맨몸}</td><td class="c">${r.통.안불림}</td>
    <td class="c">${r.통.괜찮음}</td><td class="c dim">${r.장치}</td><td class="c dim">${r.마찰 ?? '?'}</td>
    <td class="c dim">${b ? `${b.본것}건 보고 <b>${b.뒤집음}</b> 뒤집음` : '—'}</td></tr>`;
  }).join('')}
  </tbody></table>
  <p class="more">기록 ${기록.줄들.length}건 중 최근 ${줄들.length}건 · 전량 = <code>docs/_ops/작동대장_기록.jsonl</code>
  ${기록.보강 && 기록.보강.length ? ` · 재심 분모 ${기록.보강.length}건이 붙어 있다` : ' · <b>재심 분모는 아직 0건</b>(«안 돌렸다»이지 «0건 봤다»가 아니다)'}</p>`;
}

function 그리기(d, 도장) {
  const 부품수 = d.부품 ? d.부품.reduce((n, g) => n + g.행들.length, 0) : null;
  const 구역표 = d.부품 ? d.부품.map((g) => {
    const 초 = g.행들.filter((r) => r.상태.startsWith('🟢')).length;
    const 노 = g.행들.filter((r) => r.상태.startsWith('🟡')).length;
    const 흰 = g.행들.filter((r) => r.상태.startsWith('⚪')).length;
    const 전 = g.행들.length || 1;
    return `<tr>
      <td>${esc(g.이름)} <span class="dim">(${g.노출})</span></td>
      <td class="c">${g.행들.length}</td>
      <td class="bar">
        <span style="width:${(초 / 전) * 100}%;background:${킷.emerald}"></span
        ><span style="width:${(노 / 전) * 100}%;background:${킷.sun}"></span
        ><span style="width:${(흰 / 전) * 100}%;background:${킷.cream3}"></span>
      </td>
      <td class="c mono">${초} · ${노} · ${흰}</td>
    </tr>`;
  }).join('\n') : '';

  const 사슬띠 = d.사슬 ? d.사슬.map((L) => {
    const 색 = L.닿음 ? 킷.emerald : L.끊김 ? 킷.coral3 : 킷.sun;
    const 말 = L.닿음 ? '닿는다' : L.끊김 ? '끊겼다' : '가는 중';
    return `<div class="chain" style="--c:${색}">
      <div class="chain-k">${esc(L.기호)}</div>
      <div class="chain-n">${esc(L.이름.replace(/^[㉠㉡㉢]\s*/, ''))}</div>
      <div class="chain-s">${L.돈다없음 ? '<span class="pill bad">돈다 = 없음</span>' : '<span class="pill ok">돈다 있음</span>'}</div>
      <div class="chain-r">엔진에 <b>${말}</b></div>
    </div>`;
  }).join('\n') : '<p class="none">철학 정본 A-1 을 못 읽었다.</p>';

  const 안잰축 = [
    '<b>부품 47줄의 개별 작동</b> — 「부품 → 파일」 자동 매핑이 안 선다(대장의 «최근» 버전 태그로 커밋을 못 찾는다 · 실측 08-17: <code>v9.245</code> 실패). 그래서 다섯 통은 <b>장치 층만</b> 본다.',
    '<b>형제 저장소(SYNK-talk)의 엔진 도달</b> — 일부러 안 읽는다. 그 저장소의 <i>작업본</i>을 물면 값이 진동한다(F537 의 원인 후보). 읽어야 할 때는 <code>git show origin/master:</code> 로만.',
    '<b>훅·도구의 실제 발동 횟수</b> — 재는 통로가 없다(측정기 <code>훅발동.js</code> 는 대상 훅과 함께 08-20 은퇴). 이 판은 참조 수만 센다.',
    `<b>「부른다/지킨다」의 정확도</b> — 이름 일치라 <b>스쳐 지나간 언급도 센다</b>. 그래서 이 화면은 초록 쪽을 근거로 안 쓰고 <b>0 인 쪽만</b> 신호로 쓴다(거짓 초록보다 거짓 빨강이 안전하다).`,
    '<b>「오래 안 봤다」 시간 축</b> — <b>일부러 뺐다.</b> 「낡음」은 시간이 아니라 <b>지금 방향과의 정합</b>이다(유호 확정 08-17). 「마지막 손댐」 열은 참고이지 판정이 아니다.',
    '<b>「학생이 실제로 더 잘하게 됐나」</b> — 학생 0명이라 못 잰다(철학 정본이 같은 이유로 게이트에서 뺐다).',
  ];

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SYNK 작동 대장 — 이번 주에 뜯을 것</title>
<style>
  :root{--paper:${킷.paper};--ink:${킷.ink};--navy:${킷.navy};--navy2:${킷.navy2};
    --cream:${킷.cream};--cream3:${킷.cream3};--slate2:${킷.slate2};
    --coral:${킷.coral};--coral3:${킷.coral3};--wash:${킷.coralWash};--sun:${킷.sun};--em:${킷.emerald}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;line-height:1.62;
    -webkit-font-smoothing:antialiased}
  .wrap{max-width:1120px;margin:0 auto;padding:40px 24px 80px}
  h1{font-size:31px;letter-spacing:-.02em;margin:0 0 6px;color:var(--navy)}
  .sub{color:var(--slate2);font-size:15px;margin:0 0 4px}
  .stamp{display:inline-flex;gap:8px;align-items:center;margin:14px 0 0;padding:7px 13px;
    border-radius:999px;background:var(--cream);border:1px solid var(--cream3);font-size:13px}
  h2{font-size:19px;margin:46px 0 4px;color:var(--navy);letter-spacing:-.01em}
  h2 .no{color:var(--coral3);font-variant-numeric:tabular-nums;margin-right:8px}
  .lead{color:var(--slate2);font-size:14px;margin:0 0 16px}
  .tongs{display:grid;grid-template-columns:repeat(auto-fit,minmax(184px,1fr));gap:12px;margin:18px 0 6px}
  .tong{border:1px solid var(--cream3);border-top:4px solid var(--c);border-radius:12px;
    background:#fff;padding:15px 16px}
  .tong-h{display:flex;align-items:center;gap:7px}
  .tong-i{font-size:16px}
  .tong-n{font-weight:700;font-size:14px;color:var(--navy)}
  .tong-v{font-size:36px;font-weight:800;letter-spacing:-.03em;color:var(--c);
    font-variant-numeric:tabular-nums;line-height:1.1;margin:6px 0 2px}
  .tong-d{font-size:12.5px;color:var(--slate2);line-height:1.5}
  .chains{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin:16px 0}
  .chain{border:1px solid var(--cream3);border-left:5px solid var(--c);border-radius:11px;
    background:#fff;padding:14px 16px}
  .chain-k{font-size:20px;color:var(--c);font-weight:700}
  .chain-n{font-weight:700;color:var(--navy);margin:2px 0 8px;font-size:15px}
  .chain-s{margin-bottom:7px}
  .chain-r{font-size:13.5px;color:var(--slate2)}
  .chain-r b{color:var(--c)}
  table.t{width:100%;border-collapse:collapse;margin:10px 0 4px;font-size:13.5px;
    background:#fff;border:1px solid var(--cream3);border-radius:10px;overflow:hidden}
  table.t th{background:var(--cream);text-align:left;padding:9px 12px;font-size:12.5px;
    color:var(--slate2);font-weight:700;border-bottom:1px solid var(--cream3)}
  table.t td{padding:8px 12px;border-bottom:1px solid #F0EADD;vertical-align:top}
  table.t tr:last-child td{border-bottom:none}
  td.c{white-space:nowrap}
  .mono{font-family:Consolas,"D2Coding",monospace;font-size:12.5px}
  .bar{width:230px}
  .bar span{display:inline-block;height:9px;border-radius:2px;vertical-align:middle}
  .pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11.5px;font-weight:700}
  .pill.bad{background:var(--wash);color:var(--coral3)}
  .pill.warn{background:#FFF4D6;color:#8A6400}
  .pill.ok{background:#E4F2EB;color:var(--em)}
  .pill.unk{background:var(--cream);color:var(--slate2)}
  .fs{font-family:Consolas,monospace;font-size:11px;color:var(--slate2)}
  .dim{color:var(--slate2);font-weight:400}
  .none{color:var(--slate2);font-size:13.5px;padding:10px 0}
  .more{color:var(--slate2);font-size:12.5px;margin:4px 0 0}
  .hist{display:flex;align-items:flex-end;gap:9px;margin:20px 0 6px;padding:14px 16px 10px;
    background:#fff;border:1px solid var(--cream3);border-radius:11px;overflow-x:auto}
  .hb{display:flex;flex-direction:column;align-items:center;min-width:30px}
  .hb-bar{width:26px;border-radius:4px 4px 0 0}
  .hb-v{font-size:12px;font-weight:700;color:var(--navy);margin-top:5px;font-variant-numeric:tabular-nums}
  .hb-k{font-size:11px;color:var(--slate2)}
  .d0{color:var(--slate2);font-weight:700}
  .dg{color:var(--em);font-weight:800}
  .db{color:var(--coral3);font-weight:800}
  .chip-row{margin:9px 0;font-size:13px;line-height:2}
  .chip-t{font-weight:800;margin-right:9px;font-size:12.5px}
  .chip-row code{background:var(--cream);border:1px solid var(--cream3)}
  ol.axes{margin:8px 0 0;padding-left:22px}
  ol.axes li{margin:7px 0;font-size:13.5px;color:#3A3F52}
  code{background:var(--cream);padding:1px 6px;border-radius:5px;font-size:12.5px;
    font-family:Consolas,monospace}
  .warnbox{background:var(--wash);border:1px solid #FFD3CB;border-radius:11px;padding:14px 16px;
    margin:14px 0;font-size:13.5px}
  .warnbox b{color:var(--coral3)}
  footer{margin-top:56px;padding-top:18px;border-top:1px solid var(--cream3);
    color:var(--slate2);font-size:12.5px}
</style></head><body><div class="wrap 룸">

<h1>작동 대장</h1>
<p class="sub">이번 주에 <b>무엇을 뜯을 것인가</b>를 고르는 한 장 — 「무엇이 있나」가 아니라 <b>「무엇이 실제로 도나」</b>를 잰다.</p>
<div class="stamp">🕐 측정 ${esc(도장.시각)} · 수렴검사 ${도장.수렴 === true ? '✅ 두 번 돌려 같았다' : 도장.수렴 === false ? '🔴 두 번 돌려 달랐다' : '— 안 돌림'}</div>

<h2><span class="no">Ⅰ</span>이해 사슬 — 학생의 무엇이 엔진까지 닿나</h2>
<p class="lead">판정의 주인은 <code>docs/SYNK_철학.md</code> 부록 A-1 이다. 이 화면은 <b>인용</b>이고 여기서 다시 판정하지 않는다.</p>
${사슬띠}

<h2><span class="no">Ⅱ</span>지난 기록 대비 — <b>주간 재심은 이 절만 읽는다</b></h2>
<p class="lead">「지금 상태」는 이 화면이 지고, <b>「무엇이 어떻게 움직였나」는 기록 장부</b>가 진다 — 그 주의 사진은 다시 계산하지 않으니 뒤집힐 값이 없다. 기록 = <code>node tools/작동대장.js --기록</code>(append-only · 지우지 않는다).</p>
${움직임절(d.움직임, d.기록)}
${추세표(d.기록)}

<h2><span class="no">Ⅲ</span>네 통 — 지금 상태</h2>
<p class="lead">장치 <b>${d.장치들.length}개</b>(도구·라이브러리·훅)를 회귀 ${d.말 ? d.말.회귀개수 : '?'}벌 · 마찰 장부 ${d.마찰 ? d.마찰.읽은수 : '?'}건 · 저장소 글 ${d.말 ? d.말.조각.length : '?'}벌 · git 이력에 대조했다. <b>왼쪽이 급한 순서다.</b></p>
<div class="tongs">
${통칸('#C79200', '🟠', '자꾸 깨진다', d.통.깨짐.length, `마찰 ${깨짐기준}건 이상 — 고쳐도 또 아팠다 · 재설계 후보`)}
${통칸(킷.coral3, '🔴', '맨몸이다', d.통.맨몸.length, '남들은 부르는데 회귀가 없다 · 뜯으면 위험')}
${통칸(킷.navy, '⚫', '아무도 안 부른다', d.통.안불림.length, '저장소 어디에도 이름이 없다 · 삭제 후보')}
${통칸(킷.emerald, '🟢', '괜찮다', d.통.괜찮음.length, '안 건드린다')}
</div>

<h2><span class="no">Ⅳ</span>🟠 자꾸 깨진다 — <b>${d.통.깨짐.length}건</b> <span class="dim">· 재설계 1순위</span></h2>
<p class="lead">수리가 아니라 <b>재설계</b>를 볼 자리다 — 같은 파일이 마찰 장부에 ${깨짐기준}번 넘게 올랐다는 것은 <b>고쳐도 또 아팠다</b>는 뜻이다. 「2번째 = 실수가 아니라 시스템 결함 · 3번째 = 원인을 쓸 수 없게 만든다」(CLAUDE.md).</p>
${줄표(d.통.깨짐, 20)}
${분포막대(d.분포)}

<h2><span class="no">Ⅴ</span>🔴 맨몸이다 — <b>${d.통.맨몸.length}건</b> <span class="dim">· 뜯기 전에 회귀부터</span></h2>
<p class="lead">저장소 여기저기서 부르는데 회귀 ${d.말 ? d.말.회귀개수 : '?'}벌 어디에도 이름이 안 나온다. <b>뜯어도 아무 테스트가 안 빨개진다</b> — 지금 이게 도는지 기계가 모른다.</p>
${줄표(d.통.맨몸, 20)}

<h2><span class="no">Ⅵ</span>⚫ 아무도 안 부른다 — <b>${d.통.안불림.length}건</b> <span class="dim">· 삭제 후보</span></h2>
<p class="lead">회귀·다른 도구·훅·문서·<code>settings.json</code> 어디에도 이름이 없다. 경량 원칙의 과녁이다 — 다만 <b>삭제는 실사용 실측 후 건별</b>이고, 「대장에 떴다」는 삭제 근거가 아니라 <b>열어볼 이유</b>다(유호 08-13).</p>
${줄표(d.통.안불림, 20)}

<h2><span class="no">Ⅶ</span>부품 — 대외 구역별 상태</h2>
<p class="lead">정본 = <code>docs/시스템_대장.md</code> (${부품수 == null ? '못 읽음' : `${부품수}줄`}). 막대 = 🟢 라이브 · 🟡 반영 대기 · ⚪ 설계만.</p>
${d.부품 ? `<table class="t"><thead><tr><th>구역</th><th>줄</th><th>상태 분포</th><th class="mono">🟢·🟡·⚪</th></tr></thead><tbody>${구역표}</tbody></table>` : '<p class="none">시스템 대장을 못 읽었다.</p>'}

<h2><span class="no">Ⅷ</span>안 잰 축 — <b>이 화면이 «모르는» 것</b></h2>
<div class="warnbox"><b>0 과 「안 쟀다」는 다르다.</b> 여기 적힌 것은 이 판에서 <b>일부러 빼거나 못 잰</b> 축이다 — 화면의 초록을 이 목록과 함께 읽는다.</div>
<ol class="axes">${안잰축.map((s) => `<li>${s}</li>`).join('')}</ol>

${d.못읽음.length ? `<h2><span class="no">Ⅸ</span>🔴 못 읽은 입력 — ${d.못읽음.length}건</h2>
<div class="warnbox">입력을 못 읽으면 그 칸은 «비었다»가 아니라 «모른다»다(F207). 아래가 비어야 위 숫자를 믿는다.</div>
<ol class="axes">${d.못읽음.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}

<footer>
  생성 = <code>node tools/작동대장.js</code> · 수렴검사 = <code>--수렴검사</code> · 정본 파싱만 하고 사본을 두지 않는다.<br>
  짝 화면 — <b>이해대장</b>(학생을 얼마나 이해하나) · <b>시스템 대장</b>(무엇이 있나) · 이 화면(<b>무엇이 실제로 도나</b>).
</footer>
</div></body></html>`;
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */

function 본체() {
  const argv = process.argv.slice(2);
  const 오늘 = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');

  if (argv.includes('--요약')) {
    const d = 재기(오늘);
    console.log(`[작동대장] 장치 ${d.장치들.length} = 🟠깨짐 ${d.통.깨짐.length} + 🔴맨몸 ${d.통.맨몸.length} + ⚫안불림 ${d.통.안불림.length} + 🟢괜찮음 ${d.통.괜찮음.length}`);
    console.log(`           회귀 ${d.말.회귀개수}벌 · 마찰 장부 ${d.마찰.읽은수}/${d.마찰.전체} · 말뭉치 ${d.말.조각.length}벌 · 부품 ${d.부품 ? d.부품.reduce((n, g) => n + g.행들.length, 0) : '?'}줄`);
    if (d.통.깨짐.length) {
      console.log(`  🟠 자꾸 깨진다 (마찰 ${깨짐기준}건 이상) — 재설계 1순위:`);
      for (const r of d.통.깨짐) console.log(`     ${String(r.마찰수).padStart(2)}건  ${r.경로.padEnd(34)} ${r.F.slice(0, 7).join(' ')}`);
    }
    if (d.통.맨몸.length) {
      console.log('  🔴 맨몸이다 (부르는 데는 있는데 회귀 0):');
      for (const r of d.통.맨몸.slice(0, 12)) console.log(`     ${String(r.참조수).padStart(3)}곳이 부름  ${r.경로}`);
      if (d.통.맨몸.length > 12) console.log(`     …외 ${d.통.맨몸.length - 12}건`);
    }
    if (d.통.안불림.length) {
      console.log('  ⚫ 아무도 안 부른다 (삭제 후보 — 열어볼 이유이지 삭제 근거는 아니다):');
      for (const r of d.통.안불림) console.log(`     ${r.경로}`);
    }
    if (d.못읽음.length) { console.log(`  🔴 못 읽은 입력 ${d.못읽음.length}건:`); for (const s of d.못읽음) console.log(`     · ${s}`); }
    return 0;
  }

  if (argv.includes('--기록')) {
    /* 통로는 `기록하기()` **하나**다 — 수요일 훅도 같은 함수를 부른다(유호 픽 ㉱ 08-17).
     *  여기 있는 것은 «말»뿐이고, 판정은 저 함수가 진다. */
    const r = 기록하기({ 강제: argv.includes('--강제'), 오늘 });
    if (r.상태 === '거부') {
      console.error(`🔴 [작동대장] 못 읽은 입력 ${r.사유.length}건 — **기록하지 않는다.**`);
      for (const s of r.사유) console.error(`   · ${s}`);
      console.error('   못 읽은 판을 장부에 박으면 다음 주 「움직임」이 통째로 거짓이 된다.');
      return 1;
    }
    if (r.상태 === '중복') {
      console.log(`⏭ [작동대장] ${r.날짜} 기록이 이미 있다 — 건너뛴다(같은 날 두 줄은 추세를 흐린다).`);
      console.log('   같은 날 또 박아야 하면 --강제. 기존 줄은 어느 경우에도 안 지운다.');
      return 0;
    }
    console.log(`✅ [작동대장] 기록 ${r.번째}번째 — ${r.날짜}`);
    console.log(`   🟠${r.통.깨짐.length} · 🔴${r.통.맨몸.length} · ⚫${r.통.안불림.length} · 🟢${r.통.괜찮음.length}`);
    console.log(`   ${path.relative(ROOT, 기록경로)} (append-only · 행 삭제 금지)`);
    return 0;
  }

  if (argv.includes('--수렴검사')) {
    // F537 에 대한 직접적인 기계 답 — 두 번 그려 다르면 이 화면은 판정을 못 낸다.
    const a = 그리기(재기(오늘), { 시각: '고정', 수렴: null });
    const b = 그리기(재기(오늘), { 시각: '고정', 수렴: null });
    if (a === b) { console.log(`✅ [작동대장] 수렴한다 — 두 회차의 출력이 같다 (${a.length}자).`); return 0; }
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    console.error('🔴 [작동대장] 수렴하지 않는다 — 두 회차의 출력이 다르다.');
    console.error(`   첫 갈림 ${i}자째:`);
    console.error(`   1회차: …${a.slice(Math.max(0, i - 60), i + 60)}…`);
    console.error(`   2회차: …${b.slice(Math.max(0, i - 60), i + 60)}…`);
    console.error('   ⚠ 진동하는 화면은 판정을 못 낸다 — 시각·repo 밖 입력이 섞였는지 본다(F537).');
    return 1;
  }

  const d = 재기(오늘);
  // 수렴 도장은 «그리기 직전에» 한 번 찍는다 — 화면이 자기 신뢰도를 스스로 밝힌다.
  const x = 그리기(재기(오늘), { 시각: '고정', 수렴: null });
  const y = 그리기(재기(오늘), { 시각: '고정', 수렴: null });
  const 시각 = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const html = 그리기(d, { 시각, 수렴: x === y });

  fs.mkdirSync(path.dirname(산출경로), { recursive: true });
  fs.writeFileSync(산출경로, loom태우기(html), 'utf8');

  if (argv.includes('--바로가기')) {
    /* 운영자료 폴더 통로는 하나뿐이다(유호 상시 08-09) — 손 경로 금지.
     * 못 찾는 화면은 0 이다: 주간 재심에 쓰라고 지은 것이니 여는 자리가 이해대장 옆이어야 한다.
     * 그 「옆」이 2026-08-17 재편으로 **「SYNK 코어」**가 됐다 — 갈래를 명시해야 따라간다.
     * ⚠ 옛 `--링크` 는 운영자료가 모르는 플래그였다 — 조용히 무시되고 기본 갈래로 떨어졌다. */
    execFileSync(process.execPath,
      [path.join(ROOT, 'tools', '운영자료.js'), 산출경로, '--갈래', '코어'], { stdio: 'inherit' });
  }
  console.log(`✅ [작동대장] ${path.relative(ROOT, 산출경로)} (${html.length}자) · 수렴 ${x === y ? '✅' : '🔴'}`);
  console.log(`   장치 ${d.장치들.length} = 🟠${d.통.깨짐.length} + 🔴${d.통.맨몸.length} + ⚫${d.통.안불림.length} + 🟢${d.통.괜찮음.length}`);
  if (d.못읽음.length) { console.log(`   🔴 못 읽은 입력 ${d.못읽음.length}건 — 화면 Ⅷ 절에 실렸다.`); }
  return 0;
}

if (require.main === module) process.exit(본체());
