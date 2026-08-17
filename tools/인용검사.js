#!/usr/bin/env node
/* 문서가 대는 `파일:줄` 인용이 **거짓인지** 기계가 본다 — F350 처방.
 *
 * 발단(2026-08-12 · 장부 F348→F350): 「file:line 을 인용한 실측 주장」이 **세 번째로** 거짓이었다.
 *   ① F348 — 설계문의 「`출처` 는 어디에도 안 착지한다」를 한 층만 열고 ✅로 통과시켰다.
 *   ② 그 정정으로 나온 처분표가 또 틀렸다 — 「`estimator_version`·`estimator_confidence`·
 *      `as_of`·`창일수` 는 `learning_events` 에 물리 열로 이미 있다(L0_스키마.sql:2881~2883)」.
 *      그 줄이 실제로 여는 열은 `source_kind`·`estimator_confidence`·`estimator_version`·
 *      `evidence_refs` 넷이고 **`as_of` 는 그 파일 전체에 0건**이었다.
 *   🔴 위험한 이유는 틀렸다는 것 자체가 아니라 **`파일:줄` 을 달고 있어서 다음 독자가 재지 않고
 *      그대로 인용한다**는 데 있다. 실제로 처분표 §5 의 면적 산술이 그 위에 서 있었다.
 *   CLAUDE.md 신뢰성: 「3번째 = 원인을 쓸 수 없게 만든다」 — 그래서 프로즈가 아니라 기계다.
 *
 * 무엇을 재나 (F350 이 특정한 두 축 그대로):
 *   ① 그 파일에 **그 줄이 있는지** — 파일 부재 · 줄 번호가 파일 줄 수를 넘음
 *   ② 그 줄 근처에 **인용된 식별자가 실제로 있는지**
 *
 * 🔑 **「파일 전체에 0건」과 「자리만 다름」을 가른다.** 줄번호는 코드가 바뀌면 «저절로» 낡는다 —
 *   그걸 적색으로 내면 저장소가 통째로 빨개지고, 빨간 검사는 꺼진다. 반면 「그 파일 어디에도
 *   그 식별자가 없다」는 코드가 움직여도 안 생기는 신호라 **거의 전부 진짜**다(F350 의 `as_of` 가
 *   정확히 이 축이다). 그래서 🔴 는 부재에만 주고, 자리 어긋남은 🟡 로 따로 센다.
 *
 * 🔑 **범위를 「지금 쓰는 인용」으로 좁힌다.** 실측 2026-08-12 = as `docs/` 에만 272건이고
 *   대부분은 이미 낡았다. 전수 교정은 이 트랙의 일이 아니다 — 기본 과녁은 **작업본이 지금
 *   건드린 문서**이고, 역사 문서(심문결과·아카이브·이력·장부·보드·인계문)는 면제한다.
 *   그것들은 「그때 그랬다」의 기록이라 지금 줄번호와 안 맞는 것이 **정상**이다.
 *
 * ⚠ 형제 저장소(SYNK-talk)가 없으면 그 인용은 **`못잼`** 이지 「파일 없음」이 아니다(F207 —
 *   미실행을 통과로도, 실패로도 읽지 않는다). 분모를 항상 같이 낸다.
 *
 * 쓰기:
 *   node tools/인용검사.js              # 작업본이 건드린 문서만(기본)
 *   node tools/인용검사.js --전량        # 저장소 문서 전부 — 보고용
 *   node tools/인용검사.js --파일 docs/a.md docs/b.md
 *   종료 코드: 🔴 가 있으면 1
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { 저장소들 } = require('./lib/보드낡음.js');

/* ROOT 는 **이 파일이 속한 저장소**다 — `CLAUDE_PROJECT_DIR` 을 얹지 않는다(회귀 `tests/게이트뿌리`).
 * 이 검사기는 pre-commit 이 `$ROOT/tools/인용검사.js --스테이징` 으로 부르는데, 그 변수가 다른
 * 저장소를 가리키면 **옆 저장소의 스테이징**을 재고 「새 인용 0건」으로 통과한다 — 워크트리는
 * 이 저장소가 실제로 쓰는 층이다(F403). 옆 게이트에서 같은 모양이 실측돼 여기까지 같이 닫았다. */
const ROOT = path.resolve(__dirname, '..');

/* 인용으로 읽을 확장자. 좁게 연다 — 새는 방향이 「통과」인 자리가 아니라 「거짓 적색」인 자리라
 * 모르는 확장자는 조용히 넘긴다(`.mn` 같은 낱말이 파일로 읽히면 소음만 는다). */
const 확장자 = ['js', 'ts', 'tsx', 'jsx', 'sql', 'json', 'html', 'css', 'md', 'sh', 'yml', 'yaml'];

/* 한 정규식이 사람이 실제로 쓰는 표기를 **다** 읽는다(가드 맹점 ① · 실측 변이 그대로):
 *   `Code.js:2900` · `Code.js:210·220` · `Code.js:2474~2475` · `엔진_폼리포트.js:674-675`
 *   `review/index.ts:572` · `lib/학습자상태.js:147` · `docs/제품방향.md:62`
 * 앞 경계는 「경로 글자가 아닌 것」 — `a/b/Code.js:1` 의 `b/Code.js` 만 잘라 읽으면 안 된다. */
const 인용식 = new RegExp(
  '(?:^|[^\\w/.\\-가-힣])' +
  '((?:[\\w가-힣.\\-]+/)*[\\w가-힣.\\-]+\\.(?:' + 확장자.join('|') + '))' +
  ':(\\d+(?:\\s*[~\\-–]\\s*\\d+)?(?:\\s*[·,]\\s*\\d+(?:\\s*[~\\-–]\\s*\\d+)?)*)',
  'g'
);

/** 「2881~2883」·「210·220」·「674-675」 를 실제 줄 번호 집합으로 편다. */
function 줄펴기(꼬리) {
  const out = [];
  for (const 조각 of String(꼬리).split(/[·,]/)) {
    const m = 조각.trim().match(/^(\d+)(?:\s*[~\-–]\s*(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    /* 뒤집힌 범위(`10~3`)는 사람 오타지 뜻이 아니다 — 접어서 읽되 지어내지 않는다. */
    const [시, 끝] = a <= b ? [a, b] : [b, a];
    if (끝 - 시 > 400) { out.push(시, 끝); continue; }   // 터무니없이 넓은 범위는 양 끝만
    for (let i = 시; i <= 끝; i += 1) out.push(i);
  }
  return [...new Set(out)];
}

/**
 * 본문에서 인용을 뽑는다. **코드 펜스 안은 면제** — 거긴 붙여넣은 출력·예제라
 * 「지금 그 자리에 있다」는 주장이 아니다.
 */
function 인용들(본문) {
  const 줄들 = String(본문).split(/\r?\n/);
  const out = [];
  let 펜스 = false;
  for (let i = 0; i < 줄들.length; i += 1) {
    const 줄 = 줄들[i];
    if (/^\s*(```|~~~)/.test(줄)) { 펜스 = !펜스; continue; }
    if (펜스) continue;
    인용식.lastIndex = 0;
    let m;
    while ((m = 인용식.exec(줄)) !== null) {
      const 줄번호들 = 줄펴기(m[2]);
      if (!줄번호들.length) continue;
      out.push({
        경로: m[1],
        줄들: 줄번호들,
        원문: `${m[1]}:${m[2]}`,
        줄안위치: m.index + m[0].indexOf(m[1]),
        문서줄: 줄,
        문서줄번호: i + 1,
      });
    }
  }
  return out;
}

/**
 * 그 인용이 **낫표 안에 옮겨 적힌 남의 말**인가.
 *
 * ☠️ 실측(전량 마지막 1건)이 이걸 요구했다 — `상태기반_과제선택_설계.md:99` 는 F350 의 거짓
 *   주장을 「…」 로 옮겨 적고 바로 옆 칸에서 반박하는 **처분표 행**이다. 그걸 거짓 인용으로 세면
 *   **정정을 정직하게 기록한 문서가 벌받는다** — F384 가 적은 그 병(정직하게 적을수록 벌받으면
 *   관습이 죽는다)과 같은 형태다. 옮겨 적은 말은 「그때 그렇게 적혀 있었다」의 기록이지 주장이
 *   아니고, 그 기록이야말로 이 저장소가 낡음을 추적하는 방식이다.
 */
function 낫표안인가(줄, 위치) {
  for (const [열, 닫] of [['「', '」'], ['『', '』']]) {
    const 앞열림 = 줄.lastIndexOf(열, 위치);
    if (앞열림 < 0) continue;
    if (줄.lastIndexOf(닫, 위치) > 앞열림) continue;   // 이미 닫혔다 — 이 인용은 밖이다
    if (줄.indexOf(닫, 위치) > 위치) return true;
  }
  return false;
}

/* 백틱 토큰 — 인용 주변에서 「이 주장이 대는 이름들」을 뽑는다. */
function 백틱토큰들(text) {
  const out = [];
  for (const m of String(text).matchAll(/`([^`\n]+)`/g)) out.push(m[1].trim());
  return out;
}

/** 그 토큰을 「파일에서 찾아볼 식별자」로 볼 것인가. 좁게 연다 — 거짓 적색이 곧 폐기다.
 *
 * ☠️ 실측(전량 1판)이 낸 거짓 적색 둘이 여기서 걸러진다 — **영수증을 식별자로 셌다**:
 *   `src/말하기화면.js:311` 곁의 `local_99032bdf`(세션 지문) · `엔진_수집.js:1085` 곁의
 *   `a482b4c`(커밋 해시). 둘 다 「그 파일에 있을 리 없는 것」이라 100% 거짓 적색을 낸다.
 *   이 저장소 문서는 근거로 **지문·해시를 늘 곁들이므로** 이건 우연이 아니라 구조다. */
function 식별자인가(t) {
  const s = String(t).trim();
  if (s.length < 3) return false;                       // 한두 글자는 산문 강조다
  if (/[\s()[\]{}<>"'|]/.test(s)) return false;         // 구절·문장은 식별자가 아니다
  if (/^\d+$/.test(s)) return false;
  if (new RegExp(`\\.(?:${확장자.join('|')})(?::|$)`).test(s)) return false;  // 파일 인용 자체
  if (s.includes('/')) return false;                    // 경로
  if (/^(?:local_)?[0-9a-f]{7,40}$/i.test(s)) return false;   // 커밋 해시 · 세션 지문 = 영수증
  if (/^v?\d+(?:\.\d+)+$/.test(s)) return false;              // 버전 번호(`v9.220`)
  return /^[\w$가-힣]+(?:\.[\w$가-힣]+)*_?$/.test(s);
}

/* 절 경계 — 창을 여기서 자른다.
 * ☠️ 첫 판은 앞 140자를 통째로 읽었다가 **거짓 적색 2건**을 냈다(실측 처분표 v2):
 *   「`deliver` 가 `engine.submissions` 에 … 넣고(…), 그 `호흡[]` 칸에 `출처` 가 실재(`오늘과제.js:172·218`)」
 *   — `engine.submissions` 는 **앞 절**이 대는 이름인데 뒷 절의 인용에 매달렸다. 인용이 뒷받침하는 것은
 *   자기 절뿐이다. 쉼표·표 구분자·em dash 로 끊으면 진짜 양성(`as_of`·`창일수`)은 그대로 남는다. */
const 절경계 = /[,、|]|\s[—–]\s|[.!?]\s/g;

/**
 * 인용 주변 «창»의 식별자들. 창 안에 **다른 인용**이 있으면 거기서 자른다 —
 * 남의 인용이 대는 이름을 내 것으로 세면 그 자체가 거짓 판정이다.
 */
function 창식별자들(문서줄, 인용) {
  const 줄 = String(문서줄);
  const 시 = Math.max(0, 인용.줄안위치 - 140);
  let 앞 = 줄.slice(시, 인용.줄안위치);
  const 직후 = 줄.slice(인용.줄안위치 + 인용.원문.length);

  /* ☠️ **인용을 감싼 백틱이 짝을 민다** — `` `가나다` 는 `a.js:10` `` 에서 앞 조각이
   *   ``` ` 는 ` ``` 로 끝나 백틱 파서가 「는」을 토큰으로 읽고 「가나다」를 놓쳤다. 회귀 ④-c 가
   *   잡았다. 인용에 붙은 백틱은 인용의 일부지 문맥이 아니다 — 떼고 본다. */
  if (앞.endsWith('`')) 앞 = 앞.slice(0, -1);

  /* 앞쪽은 **가장 가까운** 다른 인용 뒤부터 — 그 인용에 «붙은 괄호 근거»까지 함께 넘긴다.
   * ☠️ 실측 거짓 적색: 한 줄에 `` `Code.js:2357`(`gatedIdx_`) … `엔진_콘텐츠AI.js:55`(…) `` 가
   *   나란히 있을 때, 앞 인용의 괄호 근거 `gatedIdx_` 가 뒤 인용의 창으로 흘러들어
   *   「`엔진_콘텐츠AI.js` 에 `gatedIdx_` 가 없다」는 거짓 적색이 났다. 근거는 자기 인용의 것이다.
   * 🔑 `` `:952` `` 꼴(앞 파일을 이어받는 짧은 인용)도 **경계로만** 쓴다 — 판정은 안 하되
   *   「여기부터는 남의 절」임은 알려야 한다(실측 거짓 적색 `need`). */
  const 다른인용 = new RegExp(`${인용식.source}|\`:\\d+\``, 'g');
  let m, 마지막 = -1;
  while ((m = 다른인용.exec(앞)) !== null) {
    let 끝 = m.index + m[0].length;
    const 괄 = 앞.slice(끝).match(/^`?\s*[(（][^)）]*[)）]/);
    if (괄) 끝 += 괄[0].length;
    마지막 = 끝;
  }
  if (마지막 >= 0) 앞 = 앞.slice(마지막);

  /* 그다음 절 경계까지 좁힌다 — 인용이 뒷받침하는 것은 «자기 절»뿐이다. */
  절경계.lastIndex = 0;
  let 경계 = -1, e;
  while ((e = 절경계.exec(앞)) !== null) 경계 = e.index + e[0].length;
  if (경계 >= 0) 앞 = 앞.slice(경계);

  /* ☠️ 자르고 나면 **백틱 짝이 또 밀린다** — 앞 인용의 닫는 백틱만 조각에 남기 때문이다
   *   (`` ` 이고 `라마바` 는 `` → 「 이고 」가 토큰이 되고 「라마바」를 놓친다). 홀수면 첫 백틱을
   *   뗀다. 같은 병이 자르기 «전»과 «후» 두 번 나므로 두 자리 다 막는다(회귀 ④-c 가 잡았다). */
  if (((앞.match(/`/g) || []).length % 2) === 1) 앞 = 앞.replace('`', '');

  /* 🔑 **뒤쪽은 「바로 뒤 괄호」뿐이다.** 실측 관례가 `Code.js:2357`(`gatedIdx_`) 꼴이라
   *   그 자리는 봐야 하고, 그 밖은 이미 다음 절이다 — 넓게 두면 `A 는 `x.js:1` 이고 B 는 …`
   *   에서 B 의 이름을 A 의 근거로 센다(회귀 ④-c). 한국어 연결어미는 절경계로 못 가른다. */
  const 괄호 = 직후.match(/^`?\s*[(（]([^)）]*)[)）]/);
  const 뒤 = 괄호 ? 괄호[1] : '';

  const out = new Set();
  for (const t of [...백틱토큰들(앞), ...백틱토큰들(뒤)]) {
    if (식별자인가(t)) out.add(t);
  }
  return [...out];
}

/* ── 파일 해석 ────────────────────────────────────────────────────────────── */

/* 🔑 `worktrees` 는 **저장소 자체의 복제본**이라 반드시 뺀다 — 안 빼면 모든 파일이 4벌로 보여
 *   전부 「모호」로 접히고, 도구가 답을 못 내는 것이 「깨끗함」과 같은 모양이 된다(실측 ❔ 2→11). */
const 건너뛸디렉 = new Set(['.git', 'node_modules', 'dist', 'build', '.expo', '.venv', 'coverage', 'worktrees']);
/* 🔑 `.claude` 는 **건너뛰지 않는다** — 훅(`voice-guard.js`·`clasp-guard.js`)은 실재 파일이고
 *   문서가 정당하게 인용한다. 첫 판이 그걸 빼는 바람에 「파일이 두 저장소 어디에도 없다」는
 *   거짓 적색 3건이 났다. 색인이 좁으면 새는 방향은 **적색**이다. */
const 숨은디렉허용 = new Set(['.claude', '.github']);

/** 저장소별 basename → 상대경로[] 색인. 한 번만 만든다. */
function 색인만들기(저) {
  const 색인 = new Map();
  for (const r of 저.목록) {
    const 훑기 = (디렉) => {
      let 항목;
      try { 항목 = fs.readdirSync(디렉, { withFileTypes: true }); } catch (_) { return; }
      for (const e of 항목) {
        if (e.name.startsWith('.') && !숨은디렉허용.has(e.name) && e.isDirectory()) continue;
        if (건너뛸디렉.has(e.name)) continue;
        const p = path.join(디렉, e.name);
        if (e.isDirectory()) 훑기(p);
        else {
          const 목록 = 색인.get(e.name) || [];
          목록.push({ 저장소: r.이름, 뿌리: r.뿌리, 상대: path.relative(r.뿌리, p) });
          색인.set(e.name, 목록);
        }
      }
    };
    훑기(r.뿌리);
  }
  return 색인;
}

/**
 * 인용 경로를 실제 파일로 푼다.
 * @returns {{종류:'찾음'|'모호'|'없음'|'못잼', 후보?:Array, 절대?:string, 저장소?:string, 사유?:string}}
 */
function 파일풀기(경로, 저, 색인) {
  const 접두 = String(경로).match(/^SYNK-(talk|appsscript)\//);
  const 상대 = 접두 ? 경로.slice(접두[0].length) : 경로;
  const 후보저장소 = 접두
    ? 저.목록.filter((r) => r.이름 === (접두[1] === 'talk' ? 'talk' : 'as'))
    : 저.목록;

  /* ① 적어 준 경로 그대로 — 가장 강한 증거다. */
  for (const r of 후보저장소) {
    const p = path.join(r.뿌리, 상대);
    try { if (fs.statSync(p).isFile()) return { 종류: '찾음', 절대: p, 저장소: r.이름 }; } catch (_) { /* 계속 */ }
  }

  /* ② 경로 꼬리로 맞춰 본다 — 문서는 `review/index.ts` 처럼 **일부만** 적는 것이 관례다. */
  const base = path.basename(상대);
  let 동명 = (색인.get(base) || []).filter((c) => 후보저장소.some((r) => r.이름 === c.저장소));

  /* ②-b **이름 접미**까지 넓힌다 — 마이그레이션은 `20260806…_c6.sql` 인데 문서는 `_c6.sql` 로
   *   부른다(실측 거짓 적색 2건). 후보가 여럿이면 아래에서 「모호」로 접히니 안전하다. */
  if (!동명.length && /^[._-]/.test(base)) {
    for (const [키, 목록] of 색인) {
      if (!키.endsWith(base)) continue;
      for (const c of 목록) if (후보저장소.some((r) => r.이름 === c.저장소)) 동명.push(c);
    }
  }

  const 꼬리 = 상대.replace(/\\/g, '/');
  const 꼬리일치 = 동명.filter((c) => c.상대.replace(/\\/g, '/').endsWith(꼬리));
  const 최종 = 꼬리일치.length ? 꼬리일치 : 동명;

  if (최종.length === 1) return { 종류: '찾음', 절대: path.join(최종[0].뿌리, 최종[0].상대), 저장소: 최종[0].저장소 };
  if (최종.length > 1) return { 종류: '모호', 후보: 최종 };

  /* ③ 없다 — 단 형제가 통째로 없으면 그건 「없다」가 아니라 **못 쟀다**다(F207). */
  if (!저.형제있음 && !접두) return { 종류: '못잼', 사유: '형제 저장소(SYNK-talk)가 없다' };
  if (접두 && 접두[1] === 'talk' && !저.형제있음) return { 종류: '못잼', 사유: '형제 저장소(SYNK-talk)가 없다' };
  return { 종류: '없음' };
}

/* ── 판정 ────────────────────────────────────────────────────────────────── */

const 창줄수 = 8;   // 「그 줄 근처」의 반경. F350 은 ±2 를 적었지만 실측 인용은 함수 머리를 가리키는 일이 잦다.

/**
 * 문서 한 벌을 판정한다. 파일 읽기는 `읽기` 로 주입받는다 —
 * 회귀가 픽스처만으로 탐지력을 못박을 수 있어야 한다(가드 맹점 ②).
 *
 * @returns {Array} 판정들 — {수준:'적색'|'주의'|'통과'|'못잼', 사유, 인용, ...}
 */
function 문서판정(본문, 풀기, 읽기) {
  const out = [];
  for (const 인용 of 인용들(본문)) {
    if (낫표안인가(인용.문서줄, 인용.줄안위치)) {
      out.push({ 수준: '통과', 사유: '낫표 안에 «옮겨 적은» 남의 말 — 지금 주장이 아니다', 인용 });
      continue;
    }
    const 푼것 = 풀기(인용.경로);
    if (푼것.종류 === '못잼') { out.push({ 수준: '못잼', 사유: 푼것.사유, 인용 }); continue; }
    if (푼것.종류 === '모호') {
      /* 후보가 여럿이면 **판정하지 않는다** — 어느 쪽을 골라도 그건 지어낸 판정이다. */
      out.push({ 수준: '못잼', 사유: `같은 이름 파일 ${푼것.후보.length}개 — 경로를 더 적어야 가른다`, 인용 });
      continue;
    }
    if (푼것.종류 === '없음') {
      out.push({ 수준: '적색', 사유: '그 파일이 두 저장소 어디에도 없다', 인용 });
      continue;
    }

    const 대상 = 읽기(푼것.절대);
    if (대상 === null) { out.push({ 수준: '못잼', 사유: '파일을 못 읽었다', 인용 }); continue; }
    const 줄들 = 대상.split(/\r?\n/);

    const 넘친줄 = 인용.줄들.filter((n) => n > 줄들.length);
    if (넘친줄.length) {
      out.push({
        수준: '적색',
        사유: `줄 ${넘친줄.join('·')} 이 파일 줄 수(${줄들.length})를 넘는다`,
        인용, 대상: 푼것,
      });
      continue;
    }

    const 식별자 = 창식별자들(인용.문서줄, 인용);
    if (!식별자.length) { out.push({ 수준: '통과', 사유: '줄은 실재 · 대조할 식별자가 인용 곁에 없다', 인용, 대상: 푼것 }); continue; }

    const 없는것 = [];
    const 자리다름 = [];
    for (const id of 식별자) {
      if (!대상.includes(id)) { 없는것.push(id); continue; }
      const 가까운가 = 인용.줄들.some((n) => {
        const 시 = Math.max(0, n - 1 - 창줄수);
        const 끝 = Math.min(줄들.length, n + 창줄수);
        return 줄들.slice(시, 끝).some((l) => l.includes(id));
      });
      if (!가까운가) 자리다름.push(id);
    }

    if (없는것.length) {
      out.push({
        수준: '적색',
        사유: `그 파일 **전체**에 없는 이름: ${없는것.join(' · ')}`,
        인용, 대상: 푼것, 없는것, 자리다름,
      });
    } else if (자리다름.length) {
      out.push({
        수준: '주의',
        사유: `파일엔 있지만 인용한 줄 ±${창줄수} 밖: ${자리다름.join(' · ')}`,
        인용, 대상: 푼것, 자리다름,
      });
    } else {
      out.push({ 수준: '통과', 인용, 대상: 푼것 });
    }
  }
  return out;
}

/* ── 과녁 고르기 ──────────────────────────────────────────────────────────── */

/* 역사 문서 — 「그때 그랬다」의 기록이라 지금 줄번호와 안 맞는 것이 **정상**이다.
 * 🔑 목록은 여기 하나에서 파생시킨다(둘에 적으면 갈린다 · 가드 맹점 ④). */
const 면제 = [
  'docs/_ops/심문결과/', 'docs/_ops/보드/', 'docs/_ops/인계문/', 'docs/_ops/장부/',
  'docs/_archive/', 'docs/노션_대조_', 'docs/_ops/검수결과/',
  'docs/세션보드_아카이브.md', 'docs/지침_이력.md', 'docs/_ops/마찰신호.md',
  'docs/_ops/인계문.md', 'docs/COWORK_지침.md', 'docs/버전_이력.md',
];
/* 항목이 `.md` 로 끝나면 **그 파일 하나**, 아니면 **접두**(폴더·이름 앞머리)로 읽는다. */
const 면제인가 = (rel) => 면제.some((p) => (p.endsWith('.md') ? rel === p : rel.startsWith(p)));

/* ☠️ `-c core.quotepath=false` 는 장식이 아니다 — 기본값이면 git 이 비ASCII 경로를 통째로
 *   `"docs/_ops/\354\236\245\353\266\200/F1.md"` 로 뱉는다(따옴표까지 붙는다). 그러면 아래 `담기` 의
 *   `rel.endsWith('.md')` 가 **영원히 거짓**이라 그 문서는 과녁에 아예 안 들어온다.
 *   🔴 실측 2026-08-17(F527 분모 세기 중 발각): 검사 과녁 168벌 중 **143벌이 그렇게 통째로 빠졌다**
 *   — 보이던 것은 25벌(14.9%)뿐이고, `docs/SYNK_철학.md` 같은 정본이 그 사각에 있었다.
 *   새는 방향이 「초록」이라 안 띄었다: 화면에는 늘 「문서 N벌 · 새 인용 0건」이 찍혔다(맹점 ④).
 *   회귀 = `tests/인용검사_한글경로.test.js`(픽스처가 한글 경로 문서를 실제로 잡는지 못박는다). */
function git(args) {
  try {
    return String(execFileSync('git', ['-c', 'core.quotepath=false', ...args],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch (_) { return null; }
}

/** 작업본이 «지금» 건드린 문서 — 기본 과녁. `스테이징` 이면 커밋에 실릴 것만. */
function 작업본문서들(스테이징) {
  const 모음 = new Set();
  const 담기 = (txt) => {
    if (txt === null) return false;
    for (const l of txt.split(/\r?\n/)) {
      const rel = l.trim().replace(/\\/g, '/');
      if (rel.endsWith('.md')) 모음.add(rel);
    }
    return true;
  };
  const a = 담기(git(스테이징 ? ['diff', '--cached', '--name-only', 'HEAD'] : ['diff', '--name-only', 'HEAD']));
  /* 스테이징 과녁에서도 **미추적 파일은 본다** — `git add` 로 갓 올린 새 문서가 정확히 그 꼴이고,
   * 그게 새 인용이 들어오는 주된 통로다. `--cached` 목록에 이미 들어오면 Set 이 접는다. */
  const b = 담기(git(['ls-files', '--others', '--exclude-standard']));
  return { 목록: [...모음], 잰것: a && b };
}

/**
 * 그 문서에서 **이번에 새로 추가된 줄 번호**들. 커밋 훅이 이걸로 과녁을 좁힌다.
 *
 * 🔑 이게 없으면 장치가 못 선다 — 저장소엔 이미 낡은 인용이 있고(실측 🟡10·🔴2), 전량을 막으면
 *   **남의 낡은 인용 때문에 내 커밋이 막힌다**. 그건 따를 수 없는 처방이라 우회가 정상 통로가
 *   된다(F103). 새로 «쓰는» 인용만 막으면 F350 이 겨눈 자리를 정확히 덮는다.
 *
 * @returns {Set<number>|null} null = 못 쟀다(그때는 막지 않는다)
 */
function 새줄들(rel, 스테이징) {
  const 추적 = git(['ls-files', '--error-unmatch', '--', rel]);
  if (추적 === null) {
    /* 미추적 = 통째로 새것. 줄 수를 세어 전부 담는다. */
    try {
      const n = fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/).length;
      return new Set(Array.from({ length: n }, (_, i) => i + 1));
    } catch (_) { return null; }
  }
  const args = ['diff', '-U0'];
  if (스테이징) args.push('--cached');
  args.push('HEAD', '--', rel);
  const out = git(args);
  if (out === null) return null;
  const 집합 = new Set();
  for (const m of out.matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const 시 = Number(m[1]);
    const 수 = m[2] === undefined ? 1 : Number(m[2]);
    for (let i = 0; i < 수; i += 1) 집합.add(시 + i);
  }
  return 집합;
}

function 전량문서들() {
  const out = [];
  const 훑기 = (디렉) => {
    let 항목;
    try { 항목 = fs.readdirSync(디렉, { withFileTypes: true }); } catch (_) { return; }
    for (const e of 항목) {
      if (e.name.startsWith('.') || 건너뛸디렉.has(e.name)) continue;
      const p = path.join(디렉, e.name);
      if (e.isDirectory()) 훑기(p);
      else if (e.name.endsWith('.md')) out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  };
  훑기(ROOT);
  return out;
}

/* ── 출력 ────────────────────────────────────────────────────────────────── */

function 출력() {
  const argv = process.argv.slice(2);
  const 전량 = argv.includes('--전량');
  const 스테이징 = argv.includes('--스테이징');
  const 새것만 = argv.includes('--새것') || 스테이징;
  const 파일자리 = argv.indexOf('--파일');
  let 대상들, 과녁이름, 잰것 = true;

  if (파일자리 >= 0) {
    대상들 = argv.slice(파일자리 + 1).filter((a) => !a.startsWith('--')).map((a) => a.replace(/\\/g, '/'));
    과녁이름 = '지정 파일';
  } else if (전량) {
    대상들 = 전량문서들();
    과녁이름 = '저장소 문서 전량';
  } else {
    const r = 작업본문서들(스테이징);
    대상들 = r.목록; 잰것 = r.잰것;
    과녁이름 = 스테이징 ? '스테이징된 문서' : '작업본이 건드린 문서';
  }
  if (새것만) 과녁이름 += ' — **이번에 새로 쓴 줄만**';

  /* 🔑 면제는 **자동 과녁**에만 건다 — 사람이 `--파일` 로 콕 집어 물었는데 조용히 0건을 내면
   * 그 침묵이 「깨끗하다」로 읽힌다(F207). 물으면 잰다. */
  const 면제된 = 파일자리 >= 0 ? [] : 대상들.filter(면제인가);
  if (파일자리 < 0) 대상들 = 대상들.filter((rel) => !면제인가(rel));
  const 면제인데물음 = 파일자리 >= 0 ? 대상들.filter(면제인가) : [];

  /* 커밋 훅이 부르는 자리 — 통과면 **한 줄**만 찍는다. 다만 침묵은 안 된다:
   * 미실행과 통과가 같은 모양이면 안 된다(F207). */
  const 간결 = 스테이징 && !argv.includes('--자세히');
  if (!간결) console.log('■ 인용 검사 — 문서가 대는 `파일:줄` 이 실제로 그것을 가리키나 (F350)\n');
  if (!잰것) {
    console.log('❔ **못 쟀다** — git 을 못 읽었다(과녁을 고르지 못했다). `--전량` 이나 `--파일` 로 지정한다.\n');
    return 0;
  }

  const 저 = 저장소들(ROOT);
  const 색인 = 색인만들기(저);
  const 읽기캐시 = new Map();
  const 읽기 = (절대) => {
    if (읽기캐시.has(절대)) return 읽기캐시.get(절대);
    let v;
    try { v = fs.readFileSync(절대, 'utf8'); } catch (_) { v = null; }
    읽기캐시.set(절대, v);
    return v;
  };
  const 풀기 = (경로) => 파일풀기(경로, 저, 색인);

  const 셈 = { 적색: 0, 주의: 0, 통과: 0, 못잼: 0 };
  let 인용수 = 0, 문서수 = 0, 새것못잼 = 0;
  const 적색줄 = [], 주의줄 = [], 못잼줄 = [];

  for (const rel of 대상들) {
    let 본문;
    try { 본문 = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (_) { continue; }
    문서수 += 1;
    let 새줄 = null;
    if (새것만) {
      새줄 = 새줄들(rel, 스테이징);
      /* 못 쟀으면 **거르지 않는다** — 걸러서 0건이 되면 그 침묵이 통과로 읽힌다(F207). */
      if (새줄 === null) 새것못잼 += 1;
    }
    for (const p of 문서판정(본문, 풀기, 읽기)) {
      if (새줄 && !새줄.has(p.인용.문서줄번호)) continue;
      인용수 += 1;
      셈[p.수준] += 1;
      const 한줄 = `   · ${rel} → \`${p.인용.원문}\`\n       ${p.사유 || ''}`;
      if (p.수준 === '적색') 적색줄.push(한줄);
      else if (p.수준 === '주의') 주의줄.push(한줄);
      else if (p.수준 === '못잼') 못잼줄.push(한줄);
    }
  }

  if (간결 && !셈.적색) {
    console.log(`[인용검사] 문서 ${문서수}벌 · 새 인용 ${인용수}건 — 🔴0 · 🟡${셈.주의} · ❔${셈.못잼}`);
    if (새것못잼) console.log(`   ⚠ ${새것못잼}벌은 「새 줄」을 못 쟀다 — 그 벌은 전량 봤다.`);
    return 0;
  }
  if (간결) console.log('■ 인용 검사 — 문서가 대는 `파일:줄` 이 실제로 그것을 가리키나 (F350)\n');

  console.log(`과녁: ${과녁이름} — 문서 ${문서수}벌 · 인용 ${인용수}건${면제된.length ? ` (역사 문서 ${면제된.length}벌 면제)` : ''}`);
  if (!저.형제있음) console.log('⚠ 형제 저장소(SYNK-talk)가 없다 — 그쪽 인용은 「없음」이 아니라 **못잼**으로 센다.');
  if (면제인데물음.length) {
    console.log(`⚠ 역사 문서 ${면제인데물음.length}벌을 **물었으니 잰다**(자동 과녁에서는 면제된다) — 줄번호가 낡은 것이 그쪽에선 정상이다.`);
  }
  console.log('');

  if (적색줄.length) { console.log(`🔴 거짓 인용 ${적색줄.length}건 — 그 이름이 그 파일에 **없다**`); console.log(적색줄.join('\n')); console.log(''); }
  if (주의줄.length) { console.log(`🟡 자리 어긋남 ${주의줄.length}건 — 이름은 있고 줄만 낡았다(코드가 움직이면 저절로 난다)`); console.log(주의줄.join('\n')); console.log(''); }
  if (못잼줄.length && (전량 || 파일자리 >= 0)) { console.log(`❔ 못 쟀다 ${못잼줄.length}건`); console.log(못잼줄.join('\n')); console.log(''); }

  /* 🔑 분모 — 이 줄이 없으면 「0건」이 통과와 같은 모양이 된다(F207). */
  console.log(`■ 셈: 🔴${셈.적색} · 🟡${셈.주의} · ❔${셈.못잼} · ⚪${셈.통과}  (분모 ${인용수})`);
  if (!인용수) console.log('   인용이 0건이다 — **통과가 아니라 「잴 것이 없었다」**다.');
  if (새것못잼) console.log(`   ⚠ 문서 ${새것못잼}벌은 「새 줄」을 못 쟀다 — 그 벌은 **거르지 않고 전량** 봤다.`);
  if (셈.적색) console.log('\n→ 🔴 는 고치거나, 인용을 지우거나, 「그 층엔 없다」까지만 적는다(F350 규칙 후보).');
  return 셈.적색 ? 1 : 0;
}

module.exports = {
  인용들, 줄펴기, 창식별자들, 식별자인가, 문서판정, 파일풀기, 색인만들기,
  면제인가, 면제, 창줄수, 인용식, 새줄들, 낫표안인가,
};

if (require.main === module) process.exit(출력());
