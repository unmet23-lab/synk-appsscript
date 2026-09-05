#!/usr/bin/env node
// rot-check — 「조용한 부패」를 주기적으로 한 번에 훑는다.
//
// 왜 있나 (2026-08-03 루프 진단): 하네스에 **트리거 층이 통째로 없었다.**
// 훅 4종은 전부 PreToolUse = 내 행동을 **막는 게이트**지, 무언가를 **띄우는 트리거**가 아니다.
// 그래서 도구는 만들어졌는데 아무도 돌리지 않았다 — 실측 두 개가 그 증거였다:
//   · 마찰 신호가 3건 쌓였다(지침의 /evolve 발동 조건은 2건). 세는 도구는 있는데 아무도 안 봤다.
//   · 급여 정본이 v1.3인데 파생 3종이 v1.1 수치를 인용 중이었다. 엣지는 멀쩡히 붙어 있었다.
// 공통점: 실패가 **에러가 아니라 침묵**으로 나타난다. 침묵은 아무도 안 읽으면 영원히 침묵이다.
//
// 설계 판정 — 루프 담론은 "cron으로 에이전트를 상시 돌려라"라고 하지만 여기선 틀린 처방이다.
//   ① 이 하네스는 상주 프로세스가 없다(세션이 켜질 때만 존재한다). 세션 밖 cron은 읽는 사람이 없다.
//   ② 유호님 병목은 「일감 발견」이 아니라 **「결정 대기」**다. 일감을 더 찾아내는 루프는 큐에 기름을 붓는다.
// → 그래서 트리거는 **SessionStart + 주기 스로틀**이고, 산출은 **새 일감이 아니라 부패와 결정 순위**다.
//
// 정지 조건은 무르지 않다 — 검사 결과가 0건이면 **아무것도 출력하지 않는다**.
// ("코드를 개선하라"는 정지 조건이 될 수 없지만 "깨진 링크 0건"은 된다.)
//
// 사용법:
//   node tools/rot-check.js            전체 리포트(0건이어도 「부패 없음」 한 줄은 찍는다)
//   node tools/rot-check.js --quiet    0건이면 완전 침묵 (사람이 손으로 돌릴 때)
//   node tools/rot-check.js --json     기계 판독용
//   node tools/rot-check.js --hook     SessionStart 훅 모드(스로틀 + additionalContext)
//   node tools/rot-check.js --hook --force   스로틀 무시(테스트·수동 확인용)
//   SYNK_ROT_INTERVAL_DAYS=7  주기(기본 7일) · SYNK_ROT_STATE=<경로>  상태 파일 위치
//   SYNK_ROT_LIVE=0           라이브 대조를 끈다(≈15초 pull). 끄면 「초록」이 아니라 **미측정**으로 낸다.
//                             `collect()` 를 직접 부르면 기본이 꺼짐이다 — 회귀·CI 가 네트워크를 안 타야 하므로.
//
// 🔴 2026-08-29 개정 — **적색은 주간 축에 갇히지 않는다.**
//   실측(같은 날): 전체 findings 30건 중 «배포»·«장부» 표식이 붙은 것이 0건이라, `축만()` 을 지나면
//   적색 11건이 **통째로** 사라졌다. 주간 도장이 08-26 에 찍혀 있어 그 열하나는 09-02 까지 어느 화면에도
//   안 뜬다. 실물 피해: 제미나이LM 자동 갱신 실패가 **한 달 내내** 이 화면 밖에 있었다.
//   🔑 08-30 재실측(`tools/geminilm-drive.log` 전량 · 이 자리는 앞판이 세 번 틀린 값을 적었다):
//      기록 **29**회 중 성공 **5**(08-04 12:56 · 08-11 12:41 · 08-16 21:01 · **08-25 1:09** · 08-29 21:01) ·
//      실패 **24**. 즉 실패는 08-17 이 아니라 **08-04 부터**고, 그동안 세션에도 유호님 화면에도 한 번도 안 올라왔다.
//      (08-29 21:01 예약 실행이 성공해 지금은 적색이 아니다 — 「예약 시각이 늘 죽는다」도 참이 아니다.)
//      ⚠ 08-30 정정 — 앞판이 「08-25 1:09 OK 줄은 로그에 없다」며 그 앞 검증을 뒤집었는데 **그 줄은 실재한다.**
//        한 자리 시각이 공백 **둘**로 패딩돼(`08-25··1:09`) 한 칸 공백을 전제한 자름이 그 줄만 흘렸다.
//        그래서 여기 적힌 수는 「날짜줄 전량을 뽑아 꼬리(OK/FAILED)로 가른」 값이다 — 날짜를 눈으로 훑어 세지 않는다.
//   그래서 **적색은 축과 무관하게 늘 통과시킨다.**
//   대신 원칙 4(우는 검사는 꺼진다)를 지킨다 — **같은 적색은 하루 한 번**만 말한다(`말한` 도장 ·
//   열쇠는 `부패키()` = kind + 대상 경로. 메시지 전문을 열쇠로 쓰면 문구를 한 글자 고칠 때 하루
//   눌림이 통째로 풀린다). `--force` 는 눌림을 무시한다(사람이 손으로 확인하는 자리라서).
//
// 2026-08-29 신설 절 넷 — 「자를 새로 만들지 않는다」. 이미 매 세션 도는 이 파일에 얹는다.
//   ③ `이름부름Section`  이름은 부르는데 없는 파일(tests·hooks·tools)
//   ④ `남은손Section`    사람 손을 기다리는 «반복» 칸(몽골어 검수 확정 칸 · codex 미처분)
//   ⑤ `상주Section`      매 세션 컨텍스트에 실리는 문서의 **선언 크기 ↔ 실측 크기** 어긋남
//   ⑥ `게이트Section`·`밤굽기Section`  다른 트랙이 «적는» 장부를 여기서 «읽는다»(장부만 자라면 무의미)
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INTERVAL_DAYS = 7;
const 배포_주기_일 = 1;        // 라이브 드리프트만 하루 (F244 — 왜인지는 `배포Section` 머리말)
const 장부_주기_일 = 0.25;     // 회차 장부는 6시간 (조용한 실패 장부 ④-㉡ — `장부Section` 머리말)
/* 프로젝트당 clasp pull 상한(실측 8.5s). 훅 예산 «안»에서 끝나야 한다 —
 * 🔴 08-30: 여기 적혀 있던 「60초」를 뺐다. 그 값의 정본은 `.claude/settings.json` SessionStart
 * 훅의 `timeout` 이고(08-29 에 100 으로 섰다), 같은 값을 주석에도 적어 두자 그날로 갈렸다
 * (한 값을 두 곳이 알면 반드시 갈린다). 예산을 알고 싶으면 그 파일을 본다. */
const 배포_대조_한도 = 20000;
const stateFile = () =>
  process.env.SYNK_ROT_STATE || path.join(ROOT, '.claude', 'state', 'rot-check.json');

/* ── 수집 ────────────────────────────────────────────────────────────────── */
// 각 검사는 **독립적으로** 실패할 수 있어야 한다. 하나가 터져서 나머지가 통째로 침묵하면
// 「부패 없음」과 「검사기가 죽었음」이 또 똑같이 생긴다 — 이 도구가 고치려는 바로 그 병이다.
function attempt(name, fn) {
  try {
    return { name, ok: true, value: fn() };
  } catch (e) {
    return { name, ok: false, error: (e && e.message) || String(e) };
  }
}

function memorySection() {
  const M = require('./memory-graph.js');
  const dir = M.memoryDir();
  const nodes = M.load(dir);
  if (!nodes) throw new Error(`메모리 디렉터리를 못 찾음: ${dir}`);
  const d = M.diagnose(nodes);
  const dec = M.decisions(nodes);

  // 그래프 밖의 결정 부채 — 본문에 ⏳는 있는데 [[막힘>…]] 엣지가 없는 토픽.
  // 이게 왜 중요한가: 결정 큐 위상정렬은 **엣지로만** 순위를 매긴다. 글로만 있는 ⏳는
  // 큐에 아예 안 잡히므로, 「차단자 2개」가 「대기 2건」을 뜻한다고 오해하게 만든다.
  const unwired = [];
  for (const n of nodes.values()) {
    if (n.isIndex) continue;
    let text = '';
    try { text = fs.readFileSync(n.full, 'utf8'); } catch (_) { continue; }
    if (!text.includes('⏳')) continue;
    if (n.links.some((l) => l.type === '막힘')) continue;
    unwired.push(n.slug);
  }

  const totalLinks = [...nodes.values()].reduce((a, n) => a + n.links.length, 0);
  const typed = [...nodes.values()]
    .reduce((a, n) => a + n.links.filter((l) => l.type !== '관련').length, 0);

  return { dir, count: nodes.size - 1, totalLinks, typed, diagnose: d, decisions: dec, unwired };
}

function docSection() {
  const D = require('./doc-graph.js');
  const g = D.build();
  if (!g.docs.size) throw new Error('문서를 하나도 못 읽었다 — SKIP 규칙이 docs를 통째로 걸렀을 수 있다');
  return {
    docs: g.docs.size,
    broken: g.broken,
    stale: g.stale,
    staleHeld: g.staleHeld,
    canonUnknown: g.canonUnknown,
    unversioned: g.unversioned.length,
    mapGaps: g.mapGaps,
  };
}

/* ── 엔진 소개서 대조 — 「상태는 도구가 안다」를 소개서 층까지 (2026-08-24 신설) ──────
 * 왜 이 검사인가(실측 08-24): 소개서 7벌(6 소개서 + 지도)의 상태 절이 전부 08-15 사진에 얼어
 * 있었고, 하필 그 9일이 가장 많이 움직인 구간이라 — Temper 는 자기 존재 이유(§10 규격)가
 * 완료된 것을 몰랐고, Core 는 엔진 점수를 아홉 점 낮게 싣고 있었다. 다른 층은 전부 기계가
 * 지키는데(래칫·왕복·부품대조) 소개서 층만 사람 기억이 지켰다 — 지도 footer 가 낡음 감시를
 * «바탕화면 _지금상태»에 위임했지만 그건 경로 생사만 보지 내용 낡음은 못 본다.
 * 검사는 좁고 정확하게 — 날짜 도장은 검사하지 않는다(날짜가 낡아도 값이 참이면 소음이다).
 * 재는 것은 «기계로 판정 가능한 값» 넷뿐이다. */
function 소개서Section() {
  const os = require('os');
  const 펠트 = require('./펠트문서.js');
  const r = { 갈라짐: [], 판모순: [], 점수낡음: [], 철학낡음: [], 지도판모순: null, 잰벌: 0 };

  // ① 원고↔산출물 재현 — 원고가 정본인가(갈라지면 재굽기가 손 수정을 삼킨다 · F544)
  const 임시방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-소개서대조-'));
  for (const p of 펠트.재현대조(임시방)) {
    r.잰벌++;
    if (p.상태 !== '재현') r.갈라짐.push(`${p.이름}(${p.상태})`);
  }

  // ② 표지 메타 판 vs footer 판 — 한 파일 안에서 판이 갈리면 어느 쪽도 못 믿는다
  //    (실측 08-24: 3벌이 footer 갱신을 세 번 연속 빠뜨렸다)
  const 판 = (s, 자리) => {
    const m = 자리.exec(s);
    return m ? (/소개서 v([\d.]+)/.exec(m[0]) || [])[1] : null;
  };
  for (const p of 펠트.지면짝들()) {
    const s = fs.readFileSync(p.원고, 'utf8');
    const 메타판 = 판(s, /<p class="메타">[\s\S]*?<\/p>/);
    const 발판 = 판(s, /<footer>[\s\S]*?<\/footer>/);
    if (메타판 && 발판 && 메타판 !== 발판) r.판모순.push(`${p.이름} 메타 v${메타판} ≠ footer v${발판}`);

    // ③ 엔진 점수 사진 vs 실값(엔진점수.jsonl 마지막 유효 회차 — 무응답 과반 회차는 제외)
    //    ⚠전량을 본다(matchAll) — 첫 매치만 보면 한 문서 안에서 §6은 맞고 §7만 낡은 경우를
    //    맞은 쪽이 가려 준다(신설 당일 반대 시험이 실제로 이 맹점을 잡았다).
    //    분모 표기(「시험지 102문항」)는 점수가 아니므로 건너뛴다.
    if (실점수) {
      for (const 점수 of s.matchAll(/(\d+)\s*\/\s*102(?!\s*문항)/g)) {
        // 「직전 v6 판은 89/102」 같은 **이력 언급**은 낡음이 아니다 — 앞 문맥의 「직전」이 표지다
        // (이력을 적을 땐 「직전」을 붙이는 것이 표기 규약이 된다 · 신설 당일 거짓 양성 실측).
        if (/직전[^.]{0,25}$/.test(s.slice(Math.max(0, 점수.index - 30), 점수.index))) continue;
        if (Number(점수[1]) !== 실점수.전체) {
          r.점수낡음.push(`${p.이름} ${점수[1]}/102 → 실값 ${실점수.전체}/102(${실점수.판} · ${실점수.날짜})`);
        }
      }
    }

    // ④ 철학 판 인용 vs 정본 선언 — doc-graph 의 인용 패턴(vX.Y 단독)과 달라 여기서 잰다.
    //    footer 는 `</code>(v1.12 · 판단 정본)` 꼴이라 태그 닫힘을 허용한다(첫 판의 사각 — 08-24 실측).
    if (철학판) {
      for (const 철 of s.matchAll(/SYNK_철학\.md(?:<\/code>)?\(v([\d.]+)[)\s·]/g)) {
        if (철[1] !== 철학판) r.철학낡음.push(`${p.이름} 철학 v${철[1]} 인용 → 정본 v${철학판}`);
      }
    }
  }

  // ⑤ 지도 판 — meta 와 footer 가 갈리면(실측 08-24: v2.3 vs v2.1) 판 자체가 자기모순
  try {
    const 지도 = fs.readFileSync(path.join(ROOT, 'docs', '엔진', 'SYNK_엔진_지도.html'), 'utf8');
    const meta = /class="meta">지도 v([\d.]+)/.exec(지도);
    const foot = /지도 v([\d.]+)[^<]*<\/footer>/.exec(지도) || /·\s*지도 v([\d.]+)\s*·\s*\d{4}-\d{2}-\d{2}/.exec(지도.slice(지도.lastIndexOf('<footer')));
    if (meta && foot && meta[1] !== foot[1]) r.지도판모순 = `지도 meta v${meta[1]} ≠ footer v${foot[1]}`;
  } catch (_) { /* 지도가 없으면 doc-graph 깨진 참조가 따로 운다 */ }

  return r;
}

// 소개서Section 이 쓰는 실값 둘 — 모듈 로드시 1회만 읽는다(검사마다 파일을 다시 열지 않는다)
const 실점수 = (() => {
  try {
    const 줄들 = fs.readFileSync(path.join(ROOT, 'docs', '_ops', '엔진점수.jsonl'), 'utf8')
      .trim().split('\n').map((l) => JSON.parse(l));
    for (let i = 줄들.length - 1; i >= 0; i--) {
      const x = 줄들[i];
      if ((x.무응답 || 0) < (x.분모 || 102) / 2) return x; // 무응답 과반 회차는 「점수 없음」 — 이해대장.js 와 같은 판정
    }
  } catch (_) { /* 이력이 없으면 ③은 조용히 쉰다 */ }
  return null;
})();
const 철학판 = (() => {
  try {
    const m = /<!--\s*정본:\s*v([\d.]+)\s*-->/.exec(
      fs.readFileSync(path.join(ROOT, 'docs', 'SYNK_철학.md'), 'utf8').slice(0, 300));
    return m ? m[1] : null;
  } catch (_) { return null; }
})();

/* 지침의 마지막 개정 날짜 — 개정 제안 문턱(마찰 2건)의 **기준점**이다.
 * 지침은 「굵직한 마찰 신호 2건이면 개정을 제안한다」고 하는데, 그 2건은 **새로 난** 둘이지
 * 누적 열림 둘이 아니다. 기준점 없이 누적을 세면 40건이 쌓인 지금 알림이 영구히 켜지고,
 * 켜져 있는 알림은 안 읽힌다(F386 · F370 과 같은 병). 날짜는 기계가 정확히 안다. */
function 마지막개정(파일) {
  let 최대 = null;
  /* ⚰ docs/지침_이력.md — 09-02 삭제(CLAUDE.md v10 이 「근거는 git 이력」으로 대체했고 08-22 뒤 등재가 0이라
   *   이력 구실을 이미 잃었었다). 그래서 기준점의 «유일한» 원천은 아래 CLAUDE.md 머리다 — 판올림 때
   *   `vX.Y · YYYY-MM-DD` 꼴을 깨면 마찰 전량이 「새로 난 것」으로 세진다(08-22 사고 재현).
   *   인자 `파일` 은 호환용 — 주면 그 파일의 `## vX (날짜)` 머리도 같이 본다. */
  if (파일) {
    try {
      const text = fs.readFileSync(파일, 'utf8');
      for (const m of text.matchAll(/^##\s+v[\d.]+[^\n]*?(\d{4}-\d{2}-\d{2})/gm)) {
        if (!최대 || m[1] > 최대) 최대 = m[1];
      }
    } catch (_) { /* 없으면 정본만으로 판정한다 */ }
  }

  /* 정본 자신의 머리도 본다 — 08-22 실측: v10.0 개편(08-19)이 이력에 «등재만» 안 됐는데,
   * 그 하나로 기준점이 08-13 에 얼어붙어 그 뒤 마찰 14건이 전부 「새로 난 것」으로 세졌고
   * 매 세션 「지침 개정 제안 조건 도달」이 떴다. 개편을 해도 시스템은 개편 전으로 안다 —
   * 유호님이 「개편이 체감 안 된다」고 하신 자리의 기계적 뿌리다.
   * 이력 등재는 사람이 잊지만 정본은 자기 개정일을 머리에 이고 다닌다(둘 중 늦은 쪽을 쓴다). */
  try {
    const 머리 = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8').slice(0, 600);
    const m = 머리.match(/v[\d.]+\s*·\s*(\d{4}-\d{2}-\d{2})/);
    if (m && (!최대 || m[1] > 최대)) 최대 = m[1];
  } catch (_) { /* 정본이 없으면 이력 값만 쓴다 */ }

  return 최대;
}

function frictionSection() {
  const F = require('./friction.js');
  /* 정본은 조각 폴더다 — 옛 단일 아카이브(마찰신호.md)는 압축 08-20 은퇴. 그 파일을 요구하면
   * 장부 26벌이 멀쩡히 있는데도 영구 「검사기 고장」이 된다(실측 08-20 — 이 줄이 그랬다). */
  if (!fs.existsSync(F.FOLDER)) throw new Error(`장부가 없다: ${F.FOLDER}`);
  const { rows } = F.read();
  /* 판정 술어는 friction.js 하나에서 온다 — 여기서 `!r.resolved` 를 다시 적으면 보류가
   * 「열림」으로 새고, 새는 방향은 언제나 「통과」가 아니라 여기선 «영구 알림»이다. */
  const open = rows.filter(F.열렸나);
  const 기준 = 마지막개정();
  return {
    open,
    보류: rows.filter(F.보류인가),
    total: rows.length,
    기준,
    /* 새로 난 것 = 마지막 개정 뒤에 신고된 열림 행. 기준점을 못 읽으면 전량으로 되돌린다
     * (모름을 「0건」으로 접지 않는다 — 그건 미실행을 통과로 세는 것이다 · F207). */
    새로: 기준 ? open.filter((r) => (r.date || '') > 기준) : open,
    묵은: 기준 ? open.filter((r) => (r.date || '') <= 기준) : [],
  };
}

/* 재질의 금지 — 유호님이 이미 답한 주제가 **메모리**에 대기로 되살아나지 않았나 (F126 · F389).
 * 왜 여기인가: 이 검사의 실물(메모리 폴더)은 repo 밖이라 CI 에도, CI 를 모사하는 배포 게이트에도
 * 없다. F389 실측 — 게이트가 실 HOME 으로 스위트를 돌던 시절 이 검사가 **게이트에서만** 켜져
 * 남의 배포를 막았고, 정작 그 줄을 적은 세션은 자기 test-ci 가 초록(skip)이라 볼 통로가 없었다.
 * 그래서 발동 자리를 옮겼다: 실물이 있는 기계에서 · 고칠 수 있는 사람(이 기계의 세션)에게 ·
 * 배포를 막지 않는 층(warn)으로. repo 안(보드·docs)·형제 실물은 스위트가 계속 지고,
 * 탐지력은 픽스처가 진다 — 판정은 lib/재질의금지.js **한 벌**이다(사본 금지). */
function 재질의Section() {
  const 금지 = require('./lib/재질의금지.js');
  const M = require('./memory-graph.js');
  const dir = M.memoryDir();
  if (!dir || !fs.existsSync(dir)) {
    // 메모리 없는 기계(CI·폰·새 기계)는 실물이 없다 — 위반도 없고, 탐지력은 픽스처 몫이다.
    return { 측정: false, 사유: '메모리 폴더 없음: ' + (dir || '(경로 미해석)') };
  }
  return { 측정: true, 위반: 금지.폴더검사(dir, 'memory') };
}

/* 절단문서(소급불가 정본)는 **다른 저장소의 커밋으로 닫힌다.** 항목을 실제로 끝내는 코드는
 * 거의 전부 형제(SYNK-talk)에 있고, 닫은 세션은 보드·메모리를 갱신하면서 이 문서는 자주 빠뜨린다.
 * 실측 2026-08-08: 문서 마지막 갱신 `be34610`(08-07 15:57) 뒤 `58eaf68`(21:25)이 ①-2·①-12 를
 * 닫았는데 진행표는 5시간 반 동안 둘 다 「남음」으로 들고 있었다. 그 문서는 「지금 안 모으면 영원히
 * 잃는 것」의 정본이라, 낡으면 없는 지도보다 나쁘다 — 여는 사람에게 **확신에 찬 오답**을 준다.
 *
 * 🔑 표와 본문이 **함께** 낡아서 문서 안을 아무리 대조해도 안 잡힌다 — 재료가 문서 밖에 있다.
 *   (그래서 「진행표 ↔ 본문」 일관성 검사는 짓지 않았다. 오늘의 낡음에 안 울리는 장치다.)
 * 왜 CI 가 아니라 주간 점검인가: 재료가 **git 이력 + 형제 저장소**라 CI 에는 원리상 없다
 *   (CLAUDE.md 「repo 밖 환경에 기대는 검사는 CI 에서 깨진다」). 탐지력은 픽스처가 진다
 *   (`tests/절단문서.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)`). 못 재면 **미측정**으로 낸다 — 통과와 미실행이 같은 모양이면
 *   이 도구가 고치려는 바로 그 병이다. */
// git pathspec 과 fs 경로에 같은 문자열을 쓴다. (`path.join` 으로 바꿔 역슬래시로 만들어도 이 기계의
// git 은 그대로 받는다 — 변이로 확인했다. 그러니 「역슬래시면 깨진다」고 적지 않는다.)
const 절단문서 = 'docs/_ops/심문_P0_소급불가_절단.md';
const 항목표기 = /[①②]-\d+|절단문서/;

function git(뿌리, args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args],
    { cwd: 뿌리, encoding: 'utf8', timeout: 10000, windowsHide: true });
  return (r.error || r.status !== 0) ? null : String(r.stdout || '');
}

/** 그 시각 **뒤에** 난 커밋만. `--since` 는 경계를 포함하고 git 시각은 초 단위라, 1초 밀지 않으면
 *  문서를 담은 그 커밋과 **같은 초**의 형제 커밋이 「뒤」로 딸려 들어온다(F062 계열 · 회귀가 잠근다).
 *  ⚠ 아래 구분자는 제어문자 0x1F 다 — 커밋 제목엔 한글·`|`·`·` 가 흔해 보이는 문자를 못 쓴다. */
function 뒤커밋들(뿌리, 시각) {
  const o = git(뿌리, ['log', `--since=@${시각 + 1}`, '--format=%h%x1f%s']);
  if (o === null) return [];
  return o.split('\n').filter(Boolean).map((l) => {
    const [해시, 제목] = l.split('\u001f');
    return { 해시, 제목: 제목 || '' };
  });
}

function 절단문서Section(뿌리 = ROOT) {
  if (!fs.existsSync(path.join(뿌리, 절단문서))) return { present: false }; // 없는 것은 부패가 아니다
  const o = git(뿌리, ['log', '-1', '--format=%ct', '--', 절단문서]);
  const 갱신 = o === null ? NaN : Number(String(o).trim());
  if (!Number.isFinite(갱신) || 갱신 <= 0) {
    return { present: true, 측정: false, 사유: '문서의 마지막 커밋 시각을 못 읽었다(아직 미커밋이거나 git 이 없다)' };
  }

  // 형제 좌표는 여기서 다시 적지 않는다 — 갈라지면 「형제 없음 = 조용」 쪽으로 샌다(맹점 ④).
  const store = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'handoff-store.js'));
  const 형제들 = store.siblings(뿌리);
  if (!형제들.length) return { present: true, 측정: false, 사유: '형제 저장소가 없다 — 이 문서를 닫는 커밋은 거기서 난다' };

  const 뒤 = [];
  for (const { 뿌리: 형제, 저장소 } of 형제들) {
    for (const c of 뒤커밋들(형제, 갱신)) if (항목표기.test(c.제목)) 뒤.push({ 저장소, ...c });
  }
  return { present: true, 측정: true, 갱신, 뒤 };
}

function harnessSection() {
  // 이식 폴더(바탕화면 SYNK_하네스)는 머리말에 정본 버전을 박아 「스스로 낡음을 말하는」 생성물이지만,
  // 여는 사람이 없으면 그 고백도 침묵이다 — 실측: v6.12 개정 당일, 폴더는 v6.11인 채로 하루를 보냈다(08-03).
  // 폴더가 없으면 부패가 아니다(아직 안 꺼낸 것) — 「없음」과 「낡음」을 같은 모양으로 만들지 않는다.
  const H = require('./harness-export.js'); // require는 생성기를 실행하지 않는다 — 경로·정본 버전만 얻는다
  const dir = process.env.SYNK_HARNESS_OUT || H.DEFAULT_OUT;
  const readme = path.join(dir, 'README.md');
  if (!fs.existsSync(readme)) return { present: false, canonical: H.VER };
  const m = fs.readFileSync(readme, 'utf8').match(/지침 \*\*(v[\d.]+)/);
  const stamp = m ? m[1] : null;
  return { present: true, canonical: H.VER, stamp, stale: !stamp || stamp !== H.VER };
}

function 바탕화면Section() {
  /* 유호님이 실제로 여는 화면은 저장소가 아니라 **바탕화면 두 폴더**다(「SYNK 방향」·「SYNK 자산」).
   * 거기 링크가 무덤(`docs/_archive`)이나 죽은 자리를 가리키면 저장소가 아무리 최신이어도
   * 유호님 눈에는 영원히 옛판만 온다 — 그리고 그 실패는 에러가 아니라 **침묵**이다.
   *
   * 실측 08-24: 「오프라인 신규 등록서」 바로가기가 08-04 판 `_archive` PDF 를 가리킨 채
   *   `--지금상태` 표에서 «✅ 낡을 수 없다»로 스무 날을 서 있었다(바로가기이기만 하면 초록이었다).
   *   잡아낸 것은 그물이 아니라 유호님이었다 — 「왜 새 로고가 반영이 안 되지」.
   *
   * 판정을 여기 다시 적지 않는다 — `운영자료.js --지금상태` 를 부르고 **결과만** 읽는다.
   * 두 곳에 적으면 한쪽만 고치는 날 판정이 갈린다(가드 맹점 ④). 곁들여 이 호출은
   * `_지금상태.html` 을 다시 굽는다 = 유호님 화면도 같이 최신이 된다(부작용이 아니라 목적).
   * 바탕화면이 없는 기계(CI·다른 노트북)면 부패가 아니라 **없음**이다. */
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', '운영자료.js'), '--지금상태'],
    { encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (r.error || r.status !== 0) {
    return { present: false, 사유: r.error ? String(r.error.message) : `종료코드 ${r.status}` };
  }
  const out = String(r.stdout || '');
  const 요약 = out.match(/🔴\s*(\d+)\s*·/);
  if (!요약) return { present: false, 사유: '바탕화면 폴더를 못 찾았다(요약줄 없음)' };
  /* 요약줄(「🔴 1 · ❔ 7 …」)이 아니라 «항목» 줄만 걷는다.
   * ⚠「가운뎃점이 있으면 요약」으로 가르지 말 것 — 이 폴더의 이름들이 바로 그 모양이다
   *   (「급여·인센티브 정본」·「사업·운영」). 요약은 **숫자가 먼저 오는 것**으로만 가른다. */
  const 줄 = out.split('\n').map((x) => x.trim())
    .filter((x) => x.startsWith('🔴') && !/^🔴\s*\d+\s*·/.test(x))
    .map((x) => x.replace(/^🔴\s*/, ''));
  return { present: true, 건수: Number(요약[1]), 줄 };
}

function 배포Section(라이브, 시간제한) {
  /* 「커밋은 했는데 `clasp push` 를 안 했다」 — 루트(유호님이 매일 쓰는 라이브 학원 시스템)는
   * @HEAD 를 서빙해서 배포 설명에 심는 **지문이 원리상 안 선다**(배포판점검 머리말). 그래서
   * `deploy-freshness` 훅은 루트에 영원히 침묵하고, `/deploy` 를 안 부른 커밋의 드리프트는
   * 아무 층에서도 안 보인다 — **스킬은 불러야 적용된다.** 여기서 라이브를 받아 바이트로 잰다.
   * 왜 여기만 **하루**인가(F244): 저장소 쪽 부패는 느리게 생기지만 라이브 드리프트는 소급 불가
   *   데이터가 걸린 하루짜리 손실이고, 네트워크 0 층(`안나간변경`)이 이 형태를 **원리상 못 잰다**
   *   — 기준선으로 쓰는 마지막 `[vN]` 커밋 자신이 push 안 된 판이면 기준선이 통째로 거짓이다.
   *   실측 2026-08-08: 루트 8.5s + crewcard 3.9s = 12.4초. 하루 1회면 무시할 만하다.
   * 왜 `/deploy` 안이 아닌가: /deploy 는 끝에 push 를 하므로 재는 순간 답이 늘 「같음」이다.
   * 🔴 라이브를 안 재는 호출(테스트·CI·`SYNK_ROT_LIVE=0`)은 **초록이 아니라 미측정**으로 낸다. */
  const D = require('./배포판점검.js');
  /* 🔴 2026-08-29 수리 — 위 머리말과 파일 머리말이 둘 다 「끄면 초록이 아니라 **미측정**」이라고
   *   약속하는데, 옛 판은 `{측정:false, 결과:[]}` 를 냈고 보고 블록이 `if (dep.ok && dep.value.측정)`
   *   로 잠겨 **메모 한 줄도 안 나왔다.** 문서가 코드보다 앞서 말한 자리 = 이 도구가 고치려는 병이
   *   감시기 자신에게 난 자리다. 사유를 실어 보내고, `collect()` 가 그것을 메모로 드러낸다.
   *   (`재질의Section` 의 `측정:false` 와는 다르다 — 그쪽은 메모리 없는 기계가 «정상»인 자리라
   *    일부러 침묵시킨다. 여기는 라이브가 꺼진 것이 정상이 아니라 **안 잰 것**이다.) */
  if (!라이브) return { 측정: false, 사유: '라이브 대조가 꺼져 있었다(SYNK_ROT_LIVE=0 이거나 이 실행이 배포 차례가 아니었다)', 결과: [] };
  const 미커밋 = D.미커밋집합();
  return {
    측정: true,
    결과: D.claspProjects().map((p) => {
      const r = D.점검(p, ROOT, { 라이브: true, 시간제한 });
      /* 잰 값을 **아래 층에 물려준다**(F244 후속 · 2026-08-10): 네트워크 0 층 `안나간변경()` 은
       * `[vN]` 기준선이 양방향으로 틀려 매 SessionStart 마다 거짓 🔴 를 낼 수 있는데, 여기서
       * 실제로 잰 「초록 + 그때의 배포집합 지문」을 남겨 두면 그 층이 자기 거짓양성을 재운다.
       * 지문을 같이 남기는 이유는 배포판점검 `라이브도장` 머리말 — 시각만으로는 거짓음성이 된다. */
      /* `라이브판` 도 같이 남긴다(F474) — 아래 층의 기준선이 「마지막 채번 커밋」 하나뿐이라,
       * 채번 «뒤»에 배포가 끊기면 기준선이 페이로드 자신이 되어 그 층이 0건을 낸다. 여기가 라이브를
       * **실제로 재는 유일한 자리**이므로, 「라이브가 서 있는 판」을 아는 것도 여기뿐이다. */
      const 실측 = { 지문: (() => { try { return D.지문(p, ROOT); } catch (_) { return null; } })(), 초록: r.level === 'ok' && r.측정 === true, 라이브판: r.라이브판 || null };
      return r.level === 'stale' ? { ...r, 실측, 편집중: 편집중인가(r.파일들, p, 미커밋) } : { ...r, 실측 };
    }),
  };
}

/* 🔴 라이브대조는 **작업본**을 잰다(clasp 가 미는 것이 작업본이라서다). 그래서 옆 세션이 배포집합
 * 파일을 고치는 중이면 라이브와 다른 게 **정상**인데, 그걸 「push 가 빠졌다」로 내면 이 알림은
 * 하루에 한 번 거짓말을 하고 거짓말하는 가드는 곧 무시당한다(F113). 주간일 땐 드물어 안 보였고
 * 하루로 당기는 순간 흔해진다 — 실측 2026-08-08: 남이 12:44 에 고친 `Code.js`·`엔진_운영배치.js`
 * 두 파일이 12:51 대조에서 그대로 🔴 로 나왔다. 가르는 재료는 git 이 이미 준다.
 * (미커밋을 재는 통로는 배포판점검.미커밋집합 하나다 — 여기 사본이 있었는데 F310 트랙이 합쳤다.) */
function 편집중인가(파일들, projRoot, 미커밋) {
  if (!미커밋 || !파일들 || !파일들.length) return false;
  const 앞 = path.relative(ROOT, projRoot).replace(/\\/g, '/');
  // **전부** 미커밋일 때만 보류다 — 하나라도 깨끗하면 그건 진짜 안 나간 것이다
  return 파일들.every((f) => 미커밋.has(앞 ? `${앞}/${f}` : f));
}

/* 🔗 형제(`SYNK-talk`)의 «회차 장부» — cron 이 무엇을 냈나 (조용한 실패 장부 ④-㉡).
 *
 * ■ 왜 여기인가 — 장부 자신이 「부르면 답할 뿐」이라 **아무도 안 부르면 조용하다**(④ 종결 시점의
 *   남은 칸). 실측 08-15: radio 잡이 `url` NULL 로 **16회 전부** 죽었는데 15시간 아무도 몰랐다.
 *   새 훅을 세우지 않고 이 도구에 축 하나로 얹은 이유는 셋이다 —
 *     ① 이 도구엔 **키별 스로틀이 이미 있다**(F244). 6시간에 한 번만 네트워크를 쓴다.
 *     ② 세션 시작에서 먼저 말하는 자리가 이미 이것이다(장치를 안 늘린다 · 경량 원칙).
 *     ③ `작업본소유자 --hook` 은 **지금 다른 세션이 비용을 깎는 중**이라(#Q95) 얹으면 안 된다.
 *
 * ⚠ **판정은 형제 소유다** — 여기서 요약·대조를 다시 계산하지 않고 `판정`·`안적힘`·`이상` 을
 *   옮기기만 한다(`형제배포빚` 과 같은 규칙 · 같은 판정을 두 곳에 적으면 갈라진다).
 * ⚠ **종료 코드로 갈래를 정하지 않는다** — 그쪽 1·2 는 고장이 아니라 판정이다. 갈라내는 재료는
 *   stdout 의 JSON 유무 하나뿐이다. `status!==0` 을 「못 잼」으로 읽으면 진짜 적색이 통째로 사라진다.
 * ⚠ 도구가 없으면 **모름이 아니라 «해당 없음»** 이다(그냥 건너뛴다) — 형제 없는 클론·CI 에서
 *   영구 경보가 되고, 따를 수 없는 경보는 통로를 끈다(F103·F296).
 *
 * 비용 실측(2026-08-15 · 판 미적용 상태 = HTTP 1회): 828ms. 판이 서면 2회라 ~1.7초로 본다.
 *   6시간 스로틀이라 세션 시작 평균 비용은 그 1/N 이다. */
const 장부_시간제한 = 10000;
/* 그쪽(`회차장부.js --json`)이 낼 수 있는 «판정» 전부. 0=이상 없음 · 1=이상 있음 · 2=판을 못 봤다.
 * 🔑 목록으로 두는 이유는 아래 문에서 **모르는 값을 닫기** 위해서다 — 그쪽이 상태를 늘리면
 *   여기부터 열어야 하고, 안 열면 그 상태는 「못 잼」으로 드러난다(조용한 통과가 아니라).
 * 🔴 08-24 까지 0 이 빠져 있었다 — 장부가 «건강해지는 순간» 다리가 «못 잼»을 내는 결함인데,
 *   다리가 태어난 뒤 리허설 장부가 건강했던 적이 없어서(잔존 cron 침묵 9일) 한 번도 안 튀었다.
 *   리허설 잔존을 걷어 처음으로 판정 0 이 나온 날 그 자리에서 드러났다. */
const 아는판정 = new Set([0, 1, 2]);

function 장부Section(잰다, 형제들) {
  if (!잰다) return { 측정: false, 사유: '차례 아님' };
  let 목록 = 형제들;   // 픽스처가 주입하는 자리 — 탐지력은 실저장소가 아니라 픽스처가 진다(F296)
  if (!목록) {
    try { 목록 = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'handoff-store.js')).siblings(ROOT); } catch (_) { return { 측정: false, 사유: '형제 목록을 못 읽었다' }; }
  }
  const 결과 = [];
  for (const { 뿌리, 저장소 } of 목록) {
    const 도구 = path.join(뿌리, 'tools', '회차장부.js');
    if (!fs.existsSync(도구)) continue;                       // 해당 없음 — 0건도 모름도 아니다
    /* 과녁 둘 — 기본(.env = 리허설)과 운영(08-24). 리허설만 보던 9일 동안 운영 장부는 reader 0
     * 이었고, 그 사이 운영 대조 뷰의 영구 오탐(ops-harvest 288/일)도 아무에게도 안 보였다.
     * ref 는 그쪽 정본(lib/자격증명.js)에서 읽는다 — 여기 박아 두면 두 정본이 된다. */
    const 과녁들 = [{ 이름: '', env: undefined }];
    try {
      const { 운영REF } = require(path.join(뿌리, 'lib', '자격증명.js'));
      if (운영REF) 과녁들.push({ 이름: '운영', env: { ...process.env, SUPABASE_PROJECT_REF: 운영REF } });
    } catch (e) {
      결과.push({ 저장소, 과녁이름: '운영', 못잼: true,
        사유: `운영 ref 를 못 읽었다(lib/자격증명.js): ${String((e && e.message) || e).slice(0, 80)}` });
    }
    for (const 과 of 과녁들) {
    const r = spawnSync(process.execPath, [도구, '--json'], {
      cwd: 뿌리, encoding: 'utf8', timeout: 장부_시간제한, windowsHide: true, env: 과.env,
    });
    /* 마지막 줄만 읽는다 — 그쪽이 stdout 을 JSON 한 줄로 지키지만, 옛 체크아웃(`--json` 을 모르는
     * 판)은 **사람글**을 낸다. 그때 `JSON.parse` 가 던지고 아래가 «못 잼»으로 받는다 — 그게 옳다. */
    const 줄 = String(r.stdout || '').trim().split('\n').filter(Boolean).pop();
    let o = null;
    try { o = 줄 ? JSON.parse(줄) : null; } catch (_) { o = null; }
    /* 모양 검사를 따로 두는 이유는 `형제배포빚` 머리말 ⓑ 와 같다 — 파싱을 통과하는 «다른 모양»은
     * 아래에서 `판정 === 2` 도 `=== 1` 도 아니라 **조용히 통과**한다. 여기가 유일한 문이다.
     * 🔴 그래서 «값 집합»까지 닫는다 — `typeof number` 만 보면 이 문은 열린 채였다(①배포 검수 P1):
     *   `판정:99` 가 여기를 지나면 `장부판정` 은 1·2 만 보므로 적색도 메모도 안 내고, 훅은
     *   `측정:true` 를 받아 도장을 찍는다 ⇒ **모르는 상태 하나가 6시간 창을 통째로 재운다.**
     *   모르는 값은 「통과」가 아니라 「못 잼」이다 — 새 상태가 생기면 `아는판정` 부터 연다. */
    const 모르는판정 = !!o && typeof o.판정 === 'number' && !아는판정.has(o.판정);
    if (!o || typeof o.판정 !== 'number' || 모르는판정) {
      const 사유 = r.error ? String(r.error.message || r.error).slice(0, 120)
        : 모르는판정 ? `모르는 판정 ${o.판정} — 아는 값은 ${[...아는판정].join('·')} 뿐이다(그쪽이 상태를 늘렸으면 rot-check 의 \`아는판정\` 을 연다)`
          : `stdout 에 판정이 없다(exit ${r.status})`;
      결과.push({ 저장소, 과녁이름: 과.이름, 못잼: true, 사유 });
      continue;
    }
    결과.push({ 저장소, 과녁이름: 과.이름, 판정: o.판정, 판: o.판, 과녁: o.과녁 || null, 안적힘: Number(o.안적힘) || 0, 이상: Number(o.이상) || 0, 사유: o.사유 || null, 최근이상: Array.isArray(o.최근이상) ? o.최근이상 : [] });
    }
  }
  return { 측정: true, 결과, 섰던적: !!상태().장부섰나 };
}

function geminilmSection() {
  // 하네스 폴더와 결정적으로 다른 점: 제미나이LM 묶음은 **올린 뒤 손이 닿지 않는다.**
  // 자료는 구글 계정 안으로 복사돼 버려서, 저장소가 아무리 바뀌어도 그쪽은 그대로다.
  // 즉 「스스로 낡음을 말하는」 배너조차 올라간 사본에는 만든 날짜로 굳어 있다 —
  // 낡음을 알려야 할 상대는 폴더가 아니라 **올린 사람**이다. 그래서 주간 점검이 진다.
  const N = require('./geminilm-export.js'); // require는 생성기를 실행하지 않는다
  const dir = process.env.SYNK_GEMINILM_OUT || N.DEFAULT_OUT;
  const readme = path.join(dir, 'README_먼저읽기.md');
  if (!fs.existsSync(readme)) return { present: false }; // 아직 안 쓰는 것 = 부패 아님
  const madeAt = fs.statSync(readme).mtimeMs;
  // 앵커는 굵기표시(**)를 건너뛰고 날짜만 본다 — 문구 앵커는 문구가 바뀌면 죽고,
  // 죽어도 경고는 그대로 떠서 「(날짜 미검출)」이라는 쓸모없는 값으로 조용히 낡는다.
  // 생성기와 이 앵커가 어긋나는지는 tests/노트북LM묶음.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)가 왕복으로 검사한다.
  const m = fs.readFileSync(readme, 'utf8').match(/만든 날\s*\**\s*(\d{4}-\d{2}-\d{2})/);
  const changed = [];
  for (const { root } of N.SOURCE_ROOTS) {
    for (const f of N.walk(root)) {
      if (fs.statSync(f).mtimeMs > madeAt) changed.push(path.basename(f));
    }
  }
  return { present: true, made: m ? m[1] : '(날짜 미검출)', changed };
}

function geminilmDriveSection() {
  /* 제미나이LM **자동 갱신** 배선(예약 작업 SYNK_GeminiLM · 구 SYNK_NotebookLM)의 감시.
   *
   * 왜 필요한가 — 자동화를 붙이면 「안 도는 것」이 「아무 일도 안 일어남」으로 나타난다.
   * 드라이브가 꺼져 있거나 크롬이 실패하면 생성기는 정직하게 멈추고 로그만 남기는데,
   * **그 로그를 아무도 안 연다.** 장치를 만들고 발동 조건을 안 만든 형태(F026)의 재발이라
   * 여기서 읽는다 — 「자동이니까 되겠지」가 정확히 조용한 실패의 모양이다.
   *
   * 로그가 없으면 부패가 아니다(아직 한 번도 안 돌았거나 이 기계가 아니다). */
  const log = path.join(__dirname, 'geminilm-drive.log');
  if (!fs.existsSync(log)) return { present: false };
  const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter((l) => /\bOK\b|FAILED/.test(l));
  if (!lines.length) return { present: true, unknown: true };
  const last = lines[lines.length - 1];
  const failed = /FAILED/.test(last);
  const 마지막성공 = [...lines].reverse().find((l) => /\bOK\b/.test(l)) || null;
  // 로그 줄머리 = `%date% %time%` (예: 2026-08-04 12:24:57.19)
  const 날짜 = (s) => (s && s.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
  const 성공일 = 날짜(마지막성공);
  const 지난날 = 성공일 ? Math.floor((Date.now() - new Date(성공일 + 'T00:00:00').getTime()) / 86400000) : null;
  /* 「왜 실패했나」와 **「지금 고칠 수 있나」는 다른 질문이다.** 로그만 읽으면 앞의 것만 안다.
   * F318 실측: 처방(`node tools/geminilm-drive.js`)을 그대로 따라 돌렸다가 같은 자리에서
   * 막혔다 — 마운트가 없으면 그 도구는 정지하도록 설계돼 있고, 마운트를 켜는 건 유호님
   * 몫이라 세션이 몇 번을 돌려도 안 된다. 그래서 지금 상태를 같이 재서 처방을 가른다.
   * 판정은 생성기의 것을 그대로 부른다(사본을 만들면 드라이브 문자 목록이 갈라진다). */
  let 마운트 = null;
  try { 마운트 = !!require('./geminilm-drive.js').findDriveRoot(); } catch (_) { 마운트 = null; }
  return { present: true, failed, last, 성공일, 지난날, 마운트 };
}

function mapSection() {
  /* 바탕화면 SYNK_지도 폴더 — 유호님이 실제로 여는 사본이 repo 정본과 갈라졌는지.
   * 도구(tools/지도대장.js)는 e27a93a 로 들어왔는데 **발화 지점이 0**이었다(「장치와
   * 발동 조건은 같은 커밋에서」 미충족 · 커밋 메시지에 미완성으로 명시). 여기가 그 발동
   * 조건이다 — 주간 점검이 돌 때마다 같이 잰다(2026-08-04).
   * 폴더가 없으면 부패가 아니라 미실행이다(CI·클라우드·다른 기계). */
  const M = require('./지도대장.js');
  const 결과 = M.훑기();
  if (!결과.있음) return { present: false, dir: 결과.dir };
  const 문제지도 = 결과.지도들.filter((m) => m.문제.length);
  return {
    present: true,
    지도수: 결과.지도들.length,
    문제수: 문제지도.reduce((a, m) => a + m.문제.length, 0),
    지도들: 문제지도.map((m) => ({ 이름: m.이름, 첫문제: (m.문제[0] || '').split('\n')[0] })),
  };
}

function toilSection() {
  /* 손일 장부(docs/_ops/손일장부.md(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다))가 자라고 있는지.
   *
   * 다른 섹션과 성격이 다르다 — 여기서 썩는 것은 파일이 아니라 **기억**이다.
   * 손일을 없애는 순간 「그게 얼마나 자주·몇 분이었나」를 잴 마지막 기회가 지나가고,
   * 그 뒤에는 아무도 되살릴 수 없다(소급 불가). 그래서 검사 대상은 「낡았나」가 아니라
   * **「기입 통로가 아직 도는가」**다.
   *
   * ⚠ 매 릴리스가 손일을 없애는 것은 아니므로 임계를 날짜로 둔다 — 버전 수로 재면
   *   개원 전처럼 릴리스가 잦은 구간에서 경고가 노이즈가 되고, 노이즈가 되면 꺼진다.
   * 장부가 없거나 한 줄도 없으면 부패가 아니다(아직 안 쓰는 것). */
  const T = require('./toil.js');
  if (!fs.existsSync(T.ledgerPath())) return { present: false };
  const { rows } = T.read();
  const idle = T.daysSinceLast(rows);
  const limit = Number(process.env.SYNK_TOIL_IDLE_DAYS || 30);
  return { present: true, count: rows.length, idle, limit, stale: idle !== null && idle >= limit };
}

/* ── ③ 이름은 부르는데 없는 파일 (2026-08-29 신설) ──────────────────────────
 * 왜 이 검사인가 — 저장소는 코드 파일 안에서 «없는 검사기»의 이름을 계속 부른다. 그 부름은 읽는
 * 사람에게 「그 자리는 지켜지고 있다」는 확신을 주는데, 파일이 없으면 그 확신이 거짓이다.
 * 🔑 08-30 실측(분모째 · 이 수는 «그날의 값»이지 지금 값이 아니다 — 지금 값은 `--json` 의 `이름부름`):
 *   판 파일 285벌에서 부름 **191종** = 여기 실재 151 + 형제 `SYNK-talk` 실재 12(정당한 교차참조)
 *   + **어디에도 없는 것 28종 / 35줄**. 삭제 표식이 붙은 줄은 이미 «알고 남긴 기록»이라 세기 전에 빠진다.
 *   ⚠ 앞판 머리말이 든 「155 중 34 · 형제 33 · 없는 것 94」는 과녁이 `tests/` 하나였을 때의 값이라
 *     지금 분모(tests·tools·hooks 셋)와 견줄 수 없다 — 분모를 안 적은 수는 남기지 않는다.
 *
 * 무엇이 부패인가 — 「어느어느 회귀가 이 자리를 잡는다」고 적힌 주석은 **읽는 사람에게 지켜지고
 * 있다는 확신을 준다.** 그 파일이 없으면 그 문장은 거짓이고, 거짓인 줄 모르는 사람은 그 자리를 다시
 * 안 짓는다. 실물: 이 파일 자신의 훅 블록이 「배선은 부패점검 회귀가 본다」고 적어 두고 괄호로
 * 「지금 없다」를 달고 있었다 — 지킨다고 적힌 검사가 없는 상태.
 * ⚠ 이 머리말에 예시 경로를 «그대로» 적지 않는다 — 신설 당일 실측: 예시로 쓴 `tests/X…` 한 줄이
 *   자기 자신에게 잡혀 없는 파일 한 종을 만들어 냈다(검사기가 제 꼬리를 문 자리).
 *
 * 면제 둘(원칙 4 — 첫날부터 수십 줄 우는 자는 꺼진다):
 *   ㉮ **형제 저장소에 실재하면 초록.** 좌표는 여기서 다시 적지 않고 `handoff-store.siblings` 에서
 *      받는다 — 형제 경로를 박으면 워크트리에서 `..` 이 어긋나 형제가 통째로 빠지고, 그러면 이 절이
 *      정당한 교차참조 33건을 전부 적색으로 낸다. 🔴 그래서 **형제를 못 찾으면 «0건»이 아니라
 *      «확인 불가»** 다(못 재고 조용한 것이 이 도구가 고치려는 병).
 *   ㉯ 같은 줄에 삭제 표식(⚠삭제됨·⚰·걷혔다·철거됐다·은퇴·옛 회귀·지금 없다)이 있으면 면제.
 * 거짓양성 셋도 걸러 낸다(경로를 예시로 «적지 않고» 말로 적는다 — 위 ⚠):
 *   · **시험 파일 안에서 홑·겹따옴표로 싸인 경로는 픽스처 «값»**이지 부름이 아니다. 앞판 검증이 잡은
 *     한 건은 한 글자짜리 이름의 가짜 시험 파일이었는데, 실은 assert 의 인자 문자열이었다.
 *     🔴 08-30 좁힘 — **백틱은 여기서 뺀다.** 처음엔 따옴표 셋을 다 면제했는데, 재 보니 그 규칙이
 *     거짓양성 6줄을 걸러 내려고 **진짜 신호 7줄을 같이 걷고 있었다**: 시험 파일 주석의 산문 강조가
 *     전부 백틱이라서다. 대표 무늬(경로는 위 ⚠ 대로 말로만 적는다) — 안전 회귀 한 곳이 「이 탐지력은
 *     옛글자 런타임 회귀가 따로 진다」고 백틱으로 적어 뒀는데 그 회귀는 여기에도 형제에도 없다.
 *     그게 정확히 이 절의 과녁이다. 픽스처 «값»은 코드라 홑·겹따옴표로 적히고, 백틱 템플릿은
 *     `${…}` 를 물어 이 정규식에 애초에 안 걸린다.
 *   · `.js` 뒤에 글자가 이어지면 다른 확장자다 — 이 문(`(?![\w.])`)이 없으면 `…/이름.json` 이
 *     `…/이름.js` 로 잡힌다(신설 당일 실측 · 펠트천 파일에서 났다).
 *   · `settings.local.json` 은 하네스가 관리하는 허용 목록이지 저장소가 «부르는» 코드가 아니다.
 * 실측 08-30(면제·거짓양성을 다 걷은 뒤): 남은 28종 / 35줄 — 화면엔 접혀서 «한 줄»로 나간다. */
/* 🔴 2026-09-01 넓힘 둘 — 「알고 남긴 기록」의 실제 말투를 못 담고 있었다.
 *   ① **「지어진 적이 없다」** — 삭제된 것과 **애초에 없던 것**은 다른 사실인데 표식 낱말이 없어서,
 *      정직하게 「애초에 지어진 적이 없다」고 적은 자리가 계속 적색이었다(실측 09-01 · 검수꾸러미.js:27).
 *      «없앴다»로 바꿔 적게 만드는 것은 기록을 거짓으로 만드는 길이라 **자를 넓혔다.**
 *   ② **「안 쓴다」·「부르는 검사를 잃은」** — 파일이 사라져 이 쪽이 죽은 코드가 됐다고 적은 자리. */
/* 🔴 2026-09-03 넓힘 ③ — **어미 하나에 면제가 갈리고 있었다.**
 *   실측: 안전 회귀 한 곳(`tools/발표물린트.js:44`)이 「이 계약을 지키던 …는 08-19 대청소에
 *   삭제«됐고», 설계 §12-c 처방대로 이 절이 그 한 줄이다」로 **정직하게** 적었는데, 표에 든 것은
 *   「삭제됐«다»」뿐이라 적색이었다. 사람은 표식을 문장 «중간»에 이어 쓰지 종결형으로 안 끝낸다.
 *   ⇒ 종결 「다」를 떼어 활용형까지 잡는다(삭제됐고·걷혔고·없앴는데 …).
 *   ⚠ 여기서 더 넓히지 않는다. 「막던」 같은 **흔한 낱말**을 표에 넣으면 무관한 문장이 옆 부름을
 *     덮어 «면제가 병»이 된다(위 ㉯ 머리말과 같은 축). 그런 자리는 자를 늘릴 게 아니라
 *     부르는 쪽이 표식을 달아 고친다 — 표식은 자를 위한 것이 아니라 «읽는 사람»을 위한 것이다. */
const 이름부름_표식 = /⚠?삭제됨|삭제됐|지금 없다|⚰|걷혔|철거됐|은퇴|옛 회귀|없앴|지어진 적이 없|부르는 검사를 잃은|지금 아무도 안 쓴다/;
const 이름부름_과녁 =
  /(?:tests|tools)\/[^\s'"`)\]},:;<>|*?\\]+?\.js(?![\w.])|\.claude\/hooks\/[^\s'"`)\]},:;<>|*?\\]+?\.js(?![\w.])/g;
const 이름부름_건너뛸폴더 = new Set(['node_modules', '.git', '_archive', 'worktrees', 'dist', 'build', 'coverage']);

/* 🔴 «앞으로 지을 것»은 «잃어버린 것»이 아니다 (2026-09-03 신설 · 09-03 검수에서 잡혔다).
 * 무슨 일이 났나 — 09-03 낮에 이 검사를 「38종 → 0」으로 청소했는데, 그날 저녁 커밋 하나로
 * 다시 **35종 594줄**이 됐다. 새로 잡힌 것은 전부 `docs/_ops/엔진7종_상향_fable/{재료,비교}/`
 * 였다: 엔진 설계를 다시 굽는 판이 낸 **초안 JSON** 안에 「이 자리는 `tests/prism계약.test.js`
 * 가 지킨다」 같은 «지을 것»의 이름이 적혀 있었고(그 파일은 **지어진 적이 없다**),
 * 이 자는 그것을 «잃은 파일»로 셌다.
 * 🔑 그 둘은 방향이 반대다 — 「있었는데 사라졌다」는 고칠 결함이고, 「아직 안 지었다」는 설계다.
 *    섞이면 이 절의 값이 통째로 죽는다: 진짜 하나가 초안 서른넷에 묻히고, 읽는 사람은
 *    이 자를 「원래 시끄러운 것」으로 배운다(그 다음부터는 진짜도 안 본다).
 * ⚠ 여기서 더 넓히지 않는다 — 「재료」·「비교」라는 흔한 이름을 폴더 집합에 넣으면 저장소 어디의
 *    같은 이름도 같이 빠진다. 과녁은 **판 작업 폴더 한 겹 밑의 그 둘**뿐이다. */
const 이름부름_초안폴더 = /^docs\/_ops\/[^/]+\/(재료|비교)(\/|$)/;

/* 🔴 못 읽은 폴더를 «세어서» 돌려준다(2026-08-30 · codex 지적 `0039dd311006`).
 * 앞판은 `catch (_) { return 모음; }` 로 읽기 실패를 통째로 삼켰다 — 뿌리를 못 읽어도
 * 「부름 0종 · 없는 파일 0건」을 **측정 성공으로** 냈다. 이 절이 스스로 내세우는
 * 「못 잰 것과 0건을 구분한다」 계약을 그 자리에서 어긴 것이고, 무늬로는
 * memory `zero-is-a-success-face-taxonomy` 의 「자가 태어나기 전에 끝난 0」이다.
 * 이제 실패를 모아 올리고, 판정은 부르는 쪽이 한다(뿌리째 못 읽었나 · 일부만인가). */
function 훑기(뿌리, 모음 = [], 못읽음 = []) {
  let 목록;
  try {
    목록 = fs.readdirSync(뿌리, { withFileTypes: true });
  } catch (e) {
    못읽음.push(`${path.basename(뿌리)}: ${String((e && e.message) || e).slice(0, 60)}`);
    return 모음;
  }
  for (const e of 목록) {
    if (이름부름_건너뛸폴더.has(e.name)) continue;
    const p = path.join(뿌리, e.name);
    if (e.isDirectory()) {
      if (이름부름_초안폴더.test(path.relative(ROOT, p).replace(/\\/g, '/'))) continue; // 위 머리말
      훑기(p, 모음, 못읽음);
    }
    else if (/\.(js|json|ya?ml)$/.test(e.name) && !/settings\.local\.json$/.test(e.name)) 모음.push(p);
  }
  return 모음;
}

/** 줄에서 홑·겹따옴표로 «열고 닫힌» 구간 [시작,끝) 목록. 백틱은 뺀다(산문 강조라 부름이다).
 *  이스케이프(`\'`)는 건너뛴다 — 안 건너뛰면 닫는 따옴표를 잘못 잡아 뒤 구간이 통째로 밀린다. */
function 문자열구간(줄) {
  const 밖 = [];
  let 따 = null;
  let 시작 = -1;
  for (let i = 0; i < 줄.length; i++) {
    const c = 줄[i];
    if (c === '\\') { i++; continue; }
    if (따) { if (c === 따) { 밖.push([시작, i]); 따 = null; } }
    else if (c === '"' || c === "'") { 따 = c; 시작 = i; }
  }
  return 밖;  // 안 닫힌 따옴표는 버린다 — 구간이 아니다
}

function 이름부름Section(뿌리 = ROOT) {
  let 형제들 = [];
  try {
    형제들 = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'handoff-store.js')).siblings(뿌리);
  } catch (e) {
    return { 측정: false, 사유: `형제 목록을 못 읽었다(handoff-store): ${String((e && e.message) || e).slice(0, 80)}` };
  }
  if (!형제들.length) {
    // 형제가 없으면 교차참조를 «없음»으로 세게 된다 — 그건 0건이 아니라 못 잰 것이다.
    return { 측정: false, 사유: '형제 저장소를 못 찾았다 — 교차참조를 가릴 수 없어 판정을 안 한다' };
  }
  const 부름 = new Map();
  const 못읽은폴더 = [];
  const 판파일들 = 훑기(뿌리, [], 못읽은폴더);
  // 🔴 뿌리째 못 읽었으면 「0건」이 아니라 **못 잰 것**이다 — 위 훑기 머리말 참조.
  if (!판파일들.length) {
    return {
      측정: false,
      사유: 못읽은폴더.length
        ? `저장소를 훑지 못했다(폴더 ${못읽은폴더.length}곳 읽기 실패) — ${못읽은폴더.slice(0, 3).join(' · ')}`
        : '훑을 파일이 0개다 — 이 저장소 모양이 아니다(부름 0종과 다르다)',
    };
  }
  let 못읽은파일 = 0;
  let 기록JSON = 0;   // 면제 ㉰ 로 건너뛴 운영 기록 — 분모를 밝히려고 센다
  for (const f of 판파일들) {
    let t;
    // 파일 하나를 못 읽는 것도 「그 파일엔 부름이 없다」가 아니다 — 세어서 화면에 올린다.
    try { t = fs.readFileSync(f, 'utf8'); } catch (_) { 못읽은파일++; continue; }
    const rel = path.relative(뿌리, f).replace(/\\/g, '/');
    /* 면제 ㉰ — **`docs/_ops/` 밑 JSON 은 «코드»가 아니라 «기록»이다.**
     *   이 절의 과녁은 머리말대로 «코드 파일 안 주석이 없는 검사기를 부르는 것»이다. 운영 기록
     *   폴더의 JSON 은 그날 낸 판정·감사·심사·인계 산출물이고, 그 안의 이름은 부름이 아니라
     *   ⓐ「이런 검사를 지어라」는 미래형 일감이거나 ⓑ「그 파일이 없다」를 지적한 인용이다.
     *   둘 다 지금 없는 것이 «정상»이고, 없는 파일로 세면 그 기록은 **원리상 영영 적색**이다
     *   (고치려면 과거 기록을 조작해야 한다).
     * 🔑 2026-09-04 합침 — 앞판은 같은 병을 폴더 이름으로 두 번 따로 막고 있었다
     *   (`감사조스펙/` 09-01 · `…인계/재료/` 09-03). 그런데 09-04 실측에서 **세 번째 모양**이
     *   또 나왔다: `엔진7종_상향_비교_0903/심사.json` 한 벌이 **91줄 중 81줄(89%)**을 냈다.
     *   그 안은 심사자가 설계 초안을 인용한 문장이다 — 「세는 자 = …·**짓는다**」·
     *   「회귀 0(… **MISSING**)」·「실물이 없는 자리를 «있는» 시제로 적지 않는다」.
     *   폴더 이름을 하나씩 쫓는 한 다음 판 작업에서 같은 병이 또 돌아온다 ⇒ 무늬를 «기록 JSON»
     *   으로 올려 셋을 한 줄로 합친다. `docs/_ops/` 밑 **.js 는 그대로 검사한다**(그건 코드다).
     *   🔴 이게 왜 «수리»인가: 그 81줄이 **진짜 결함 1건**을 소음으로 덮고 있었다 — 모델 배치표가
     *   굽기 통로 경로를 한 겹 틀리게 적어 둔 자리다(경로는 위 ⚠ 대로 여기 안 적는다 — 적으면
     *   이 주석이 제 꼬리를 문다). 안 걸러지는 경고는 안 읽힌다.
     *   ⚠ 건너뛴 수를 «세어서» 돌려준다 — 분모를 안 밝히고 조용해지는 것이 이 도구가 고치려는 병이다. */
    if (/^docs\/_ops\/.+\.json$/.test(rel)) { 기록JSON++; continue; }
    const 시험파일 = /(^|\/)tests\//.test(rel);
    const 줄들 = t.split('\n');
    줄들.forEach((줄, i) => {
      /* 🔴 2026-09-04 고침 — 픽스처 면제가 «매치 앞뒤 한 글자»만 봐서 새고 있었다.
       *   실측 둘(경로는 위 ⚠ 대로 말로만 적는다 — 적으면 이 주석이 제 꼬리를 문다):
       *   ⓐ 시험이 따옴표 안에 «경로 + 공백 + 괄호말»을 한 문자열로 담으면 뒤 글자가 공백이라
       *      면제가 풀렸다(가짜 시험 이름 뒤에 「(고쳤다)」를 붙인 기대값 줄). ⓑ 픽스처가 앞에
       *      한 겹을 더 붙인 경로면 매치가 중간부터라 앞 글자가 빗금이다. 여섯 줄이 그렇게
       *      «지어진 적도 없는 이름»으로 적색을 만들고 있었다.
       *   ⇒ 「앞뒤 글자」가 아니라 «문자열 리터럴 구간 안인가»로 잰다. 백틱은 여전히 뺀다
       *     (08-30 좁힘 — 시험 주석의 산문 강조가 전부 백틱이라 진짜 신호가 거기 산다). */
      const 리터럴 = 시험파일 ? 문자열구간(줄) : [];
      for (const m of 줄.matchAll(이름부름_과녁)) {
        const 이름 = m[0];
        const 끝 = m.index + 이름.length;
        // 구간은 [여는따옴표, 닫는따옴표] 라 «내용»은 그 사이다 — 끝은 닫는 자리까지 허용한다(`<` 면 딱 맞는 픽스처가 샌다).
        if (리터럴.some(([a, b]) => m.index > a && 끝 <= b)) continue;  // 픽스처 값이지 부름이 아니다
        /* 🔴 2026-09-01 넓힘 — 표식을 «같은 줄»이 아니라 «같은 주석 문단»에서 찾는다.
         *   실측 둘: ⓐ 안전 회귀 한 곳이 **바로 윗줄에** 「⚠삭제됨 e75fc7fc — 지금 없다」를 달아
         *   놓고도 적색이었다. ⓑ 엔진 주석 한 곳은 **다음 줄에** 「08-19 대철거(e75fc7fc)로 걷혔다」를
         *   적어 두었는데도 적색이었다 — 문장이 줄을 넘어가면 표식은 자연히 뒤에 온다.
         *   사람은 표식을 «문단»에 달지 «그 낱말이 든 줄»에 안 단다.
         *   앞 3줄 · 뒤 2줄까지만 본다 — 더 넓히면 무관한 문단의 표식이 옆 부름을 덮는다(면제가 병이 된다). */
        const 이웃 = 줄들.slice(Math.max(0, i - 3), i + 3).join('\n');
        if (이름부름_표식.test(이웃)) continue;                // 알고 남긴 기록 = 면제
        if (!부름.has(이름)) 부름.set(이름, []);
        부름.get(이름).push(`${rel}:${i + 1}`);
      }
    });
  }
  const 없는것 = [];
  let 실재 = 0;
  let 형제실재 = 0;
  for (const [이름, 자리들] of [...부름].sort()) {
    if (fs.existsSync(path.join(뿌리, 이름))) { 실재++; continue; }
    if (형제들.some(({ 뿌리: 형 }) => fs.existsSync(path.join(형, 이름)))) { 형제실재++; continue; }
    없는것.push({ 이름, 자리들 });
  }
  return {
    측정: true,
    판파일: 판파일들.length,
    형제: 형제들.map((x) => x.저장소),
    종수: 부름.size,
    실재,
    형제실재,
    없는것,
    줄수: 없는것.reduce((a, x) => a + x.자리들.length, 0),
    // 부분 실패 — 측정은 했지만 **분모가 온전하지 않다.** 화면이 이걸 말해야 「0건」이 안 는다.
    못읽은폴더: 못읽은폴더.length,
    못읽은파일,
    기록JSON,   // 면제 ㉰ — «못 읽은 것»이 아니라 «일부러 뺀 것». 둘을 갈라 적는다
  };
}

/* ── ④ 「남은 손」 — 사람이 채워야 하는데 안 채워진 칸 (2026-08-29 신설) ────────
 * 🔴 손 기입 칸 **0개**로 짓는다(원칙 2) — 재료가 전부 기계 판독 가능하다. 사람이 갱신하는 표를
 * 하나 더 만들면 그 표 자신이 곧 「남은 손」이 된다.
 *
 * 과녁은 **운영에서 «반복»되는 손**이다. 일회성 결정·서명·송금은 여기서 안 센다 — 그 축은 이미
 * 두 곳이 쥐고 있고(`docs/정본/SYNK 보안/개원_뼈대_체크리스트.txt` · memory `yuho-open-decisions.md`),
 * 같은 판정을 세 곳에서 재면 반드시 갈린다.
 *
 * 재료 셋:
 *   ㉠ 몽골어 검수 TSV 의 «확정» 칸 — `docs/_ops/검수꾸러미/*.tsv`.
 *      🔑 분모는 **머리글이 정한다**: 확정 칸(`Монгол — баталгаажсан`)이 없는 파일은 데이터 시트가
 *      아니라 «안내문»이라 분모에서 뺀다(`검수_Эхлэх.tsv` = 2열). 앞판이 그것까지 세어 414 를 만들었다 —
 *      머리글로 가르면 그 오차가 원리상 안 난다. 실측 08-29: 데이터 370행 · 채워진 확정 0.
 *      회수 폴더가 없으면 **왕복 0회**(꾸러미를 낸 적은 있어도 돌아온 적은 없다).
 *   ㉡ codex 미처분 — 세는 법을 여기 다시 적지 않고 `tools/codex-review.js --미처분` 을 **부른다**
 *      (원칙 5 · 실측 84ms). 그쪽 요약줄 한 줄만 읽는다. 못 읽으면 0건이 아니라 «못 잼»이다.
 *   ㉢ 이름만 남은 검사기 — ③ 이 이미 셌다. 여기서 다시 세지 않고 그 값을 옮긴다. */
function 남은손Section(뿌리 = ROOT) {
  const r = { 검수: null, codex: null, 예약: null };

  /* ㉢ 예약 등록 — 🔴 **이 자는 「등록됐나」를 원리상 못 본다.**
   *   폴더(`~/.claude/scheduled-tasks/<이름>/SKILL.md`)는 파일로 남지만 «등록»은 하네스 안에만 있고,
   *   SKILL.md 머리말에도 언제 도는지가 안 적힌다(name·description 뿐). 그래서 여기서 하는 일은 하나다 —
   *   **폴더가 있으면 「되읽어 보라」고 말한다.**
   * 🔴 왜 그 한 줄이 필요한가: 등록은 **두 번 전량 증발했다**(09-01 일곱 중 0 · 09-04 아홉 중 0).
   *   폴더가 온전해도 아무 일도 안 일어나고 화면에 아무 표시도 안 뜬다 — 조용한 죽음이라 몇 주가 지나도 모른다.
   *   09-04 에 증발해 있던 아홉 안에 **부가가치세 폐업확정신고 기한 알림(09-25)**이 들어 있었다.
   *   무실적이어도 신고해야 가산세가 안 붙는 자리라, 안 울면 돈이 나간다. */
  try {
    const 방 = path.join(require('os').homedir(), '.claude', 'scheduled-tasks');
    if (fs.existsSync(방)) {
      const 폴더 = fs.readdirSync(방, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(방, d.name, 'SKILL.md')))
        .map((d) => d.name);
      r.예약 = { 측정: true, 폴더: 폴더.length };
    } else r.예약 = { 측정: false, 사유: '예약 폴더 자리가 없다' };
  } catch (e) {
    r.예약 = { 측정: false, 사유: `예약 폴더를 못 읽었다: ${String((e && e.message) || e).slice(0, 60)}` };
  }

  // ㉠ 검수 꾸러미
  const 꾸러미 = path.join(뿌리, 'docs', '_ops', '검수꾸러미');
  try {
    if (!fs.existsSync(꾸러미)) r.검수 = { 측정: false, 사유: '검수꾸러미 폴더가 없다' };
    else {
      let 분모 = 0;
      let 찬칸 = 0;
      const 시트 = [];
      const 안내문 = [];
      for (const f of fs.readdirSync(꾸러미).filter((x) => x.toLowerCase().endsWith('.tsv'))) {
        const 줄 = fs.readFileSync(path.join(꾸러미, f), 'utf8').split(/\r?\n/).filter((l) => l.trim());
        if (!줄.length) continue;
        const 머리 = 줄[0].split('\t');
        const 칸 = 머리.findIndex((h) => /баталгаажсан/i.test(h));
        if (칸 < 0) { 안내문.push(f); continue; }             // 데이터 시트가 아니다 — 분모 밖
        const 행 = 줄.slice(1);
        분모 += 행.length;
        찬칸 += 행.filter((l) => String(l.split('\t')[칸] || '').trim()).length;
        시트.push(f);
      }
      const 회수 = path.join(꾸러미, '회수');
      const 왕복 = fs.existsSync(회수)
        ? fs.readdirSync(회수).filter((x) => !x.startsWith('.')).length : 0;
      r.검수 = { 측정: true, 분모, 찬칸, 남음: 분모 - 찬칸, 시트: 시트.length, 안내문: 안내문.length, 왕복 };
    }
  } catch (e) {
    r.검수 = { 측정: false, 사유: `검수 꾸러미를 못 읽었다: ${String((e && e.message) || e).slice(0, 80)}` };
  }

  // ㉡ codex 미처분 — 세는 함수를 부른다(사본 금지)
  const 검수도구 = path.join(뿌리, 'tools', 'codex-review.js');
  if (!fs.existsSync(검수도구)) r.codex = { 측정: false, 사유: 'tools/codex-review.js 가 없다' };
  else {
    const p = spawnSync(process.execPath, [검수도구, '--미처분'],
      { cwd: 뿌리, encoding: 'utf8', timeout: 20000, windowsHide: true });
    const out = String(p.stdout || '');
    // 「미처분 285건 (전체 지적 369건 중 …」 또는 「미처분 0건 (전체 지적 369건 …」 둘 다 받는다
    const m = out.match(/미처분\s+(\d+)건\s*\(전체 지적\s+(\d+)건/);
    r.codex = m
      ? { 측정: true, 미처분: Number(m[1]), 총지적: Number(m[2]) }
      : { 측정: false, 사유: `--미처분 요약줄을 못 읽었다(exit ${p.status}${p.error ? ' · ' + String(p.error.message).slice(0, 50) : ''})` };
  }
  return r;
}

/* ── ⑤ 상주 총량 — 선언 ↔ 실측 (2026-08-29 신설 · 철학 Ⅰ-9 ④⑤ 의 자) ──────────
 * 🔴 왜 이 검사인가(실물): 세션 카드 훅이 철학 정본의 크기를 «자·KB»로 적어 두고 그 수로
 * 「전문을 싣지 않는다」를 정당화하는데, 정본이 그 선언의 **세 배**가 되는 동안 아무 자도 안 울었다.
 * 같은 줄의 `CLAUDE.md` 선언도 v10.0 축약 뒤 실물의 네 배로 남아 있었다(과대 선언).
 * 선언이 틀리면 그 설계 판정 자체의 근거가 거짓이 된다.
 * 🔑 그때의 수들을 여기 안 적는다 — 그 수가 며칠 새 또 움직인 것이 이 검사가 생긴 이유 그 자체다.
 *   지금 값은 늘 아래 `실측` 이 낸다(`--json` 의 `상주총량.실측`).
 *
 * 🔑 **값을 여기 베끼지 않는다**(원칙 5). 표가 아는 것은 «선언이 어느 파일 어느 모양으로 있나»뿐이고,
 *   값은 그 파일에서 읽는다. 그래서 선언을 고치면 이 검사가 곧바로 따라온다.
 * 🔴 **앵커가 죽으면 조용히 0건이 되면 안 된다** — 뽑기가 실패한 선언은 「선언을 못 읽었다」로 따로 낸다.
 *   (이 절이 잡으려는 병이 정확히 그 모양이다.)
 * ⚠ 임계는 지어내지 않되 «어긋남»의 눈금은 있어야 한다 — 선언은 유효숫자 서넛으로 적히므로
 *   1% 미만은 반올림이다. 눈금의 조건: 읽는 사람의 «싣느냐 마느냐» 판단이 바뀌는 폭이면서
 *   편집 한 번의 흔들림에는 안 걸릴 것. 그 수를 아는 곳은 **바로 아래 상수 하나**다(여기 다시 안 적는다 —
 *   08-30 에 주석과 상수가 같은 값을 따로 알고 있었다). 절대 상한(「N KB 를 넘지 마라」)은 여기서
 *   안 정한다 — 그건 유호님 판정거리다.
 * 🔴 이 표가 «비면» 이 절은 영원히 초록이다(분모가 조용히 0이 되는 자리). 그래서 빈 표는
 *   «어긋남 0건»이 아니라 「선언을 못 읽었다」로 낸다 — 아래 `상주Section` 첫 줄. */
const 상주_어긋남_비 = 0.2;
/* 🔴 08-30 — 표가 다섯에서 **하나**로 줄었다. 분모가 조용히 주는 자리라 왜 뺐는지를 여기 남긴다.
 *   과녁은 «지금 이렇다»고 현재형으로 말하는 선언뿐이다. 날짜 박힌 «그때의 실측»은 부패가 아니다.
 *   ㉮ `tools/결정.js` 두 줄(CLAUDE.md · MEMORY.md) — **뺐다. 이 검사가 틀렸던 자리다.**
 *      그 문장은 「08-22 실측 … **그때** 상주가 27.6KB 로 개편 전 지침 하나(22.7KB)보다 커졌다」다 =
 *      날짜 붙은 과거 기록이고, 게다가 네 수가 서로 더해져 맞물린다(4.2 + 12.7 + 10.7 = 27.6).
 *      한 칸만 오늘 값으로 갈면 그 산수가 깨진다 — 「고치는 것」이 아니라 기록을 부수는 것이다.
 *   ㉯ 철학 정본의 자수·KB 두 줄 — **선언 쪽에서 수를 걷었다.** 그 문장이 그 수로 하는 일은
 *      「정본이 상주보다 훨씬 크다 → 전문 대신 두 자리만 싣는다」 하나뿐이라 «배수»면 충분한데,
 *      정본은 오늘도 옆 트랙이 고치는 중이라 어떤 수를 박아도 그 편집이 끝나는 순간 다시 거짓이 된다.
 *      (실측이 이틀 새 39,539 → 43,434자였다.) 대신 그 크기는 아래 `실측` 에 늘 실려 `--json` 으로 보인다.
 *   ⚠ 그러니 남은 하나가 죽으면 이 절은 통째로 눈이 먼다 — 빈 표를 초록으로 넘기지 않는 이유. */
const 상주선언 = [
  { 선언처: '.claude/hooks/philosophy-card.js', 대상: 'CLAUDE.md', 단위: 'KB',
    뽑기: /매 턴 상주하는 CLAUDE\.md\(([\d.]+)KB\)/ },
];

/** 상주 과녁의 실경로. `(memory)` 접두는 memory-graph 가 아는 폴더에서 푼다(경로를 박지 않는다). */
function 상주경로(대상, 뿌리) {
  if (!대상.startsWith('(memory)')) return path.join(뿌리, 대상);
  const dir = require('./memory-graph.js').memoryDir();
  return dir ? path.join(dir, 대상.slice('(memory)'.length)) : null;
}

function 상주Section(뿌리 = ROOT) {
  const 과녁 = ['CLAUDE.md', 'docs/SYNK_철학.md', 'docs/_ops/결정.md', 'docs/_ops/트랙.md', '(memory)MEMORY.md'];
  const 실측 = {};
  for (const t of 과녁) {
    let p = null;
    try { p = 상주경로(t, 뿌리); } catch (_) { p = null; }
    if (!p || !fs.existsSync(p)) { 실측[t] = null; continue; }
    const s = fs.readFileSync(p, 'utf8');
    실측[t] = { 자: s.length, KB: Buffer.byteLength(s, 'utf8') / 1024 };
  }
  const 어긋남 = [];
  const 못읽음 = [];
  // 표가 비면 이 절은 영원히 «어긋남 0건»이다 = 이 도구가 고치려는 바로 그 얼굴. 0건 대신 신고한다.
  if (!상주선언.length) 못읽음.push('상주선언 표가 비었다 — 잴 선언이 하나도 없으니 이 절의 0건은 «초록»이 아니다');
  for (const d of 상주선언) {
    let 원문 = null;
    try { 원문 = fs.readFileSync(path.join(뿌리, d.선언처), 'utf8'); } catch (_) { /* 아래에서 못읽음 */ }
    if (원문 === null) { 못읽음.push(`${d.선언처}(파일 없음 · ${d.대상} ${d.단위} 선언)`); continue; }
    const m = d.뽑기.exec(원문);
    if (!m) { 못읽음.push(`${d.선언처}(앵커가 안 물었다 · ${d.대상} ${d.단위} 선언)`); continue; }
    const 선언값 = Number(String(m[1]).replace(/,/g, ''));
    const 잰것 = 실측[d.대상];
    if (!잰것) { 못읽음.push(`${d.대상}(실물을 못 읽었다 · ${d.선언처} 가 선언 중)`); continue; }
    const 실값 = d.단위 === '자' ? 잰것.자 : 잰것.KB;
    if (!Number.isFinite(선언값) || 선언값 <= 0) { 못읽음.push(`${d.선언처}(선언값이 수가 아니다: ${m[1]})`); continue; }
    const 비 = Math.abs(실값 - 선언값) / 선언값;
    if (비 >= 상주_어긋남_비) {
      어긋남.push({ 선언처: d.선언처, 대상: d.대상, 단위: d.단위, 선언: 선언값, 실측: 실값, 배: 실값 / 선언값 });
    }
  }
  // `선언수` 를 같이 낸다 — 분모가 조용히 줄면 「어긋남 0」이 초록으로 읽힌다(08-30 에 5→1 로 줄었다).
  return { 측정: true, 선언수: 상주선언.length, 실측, 어긋남, 못읽음 };
}

/* ── ⑥ 다른 트랙이 «적는» 장부를 여기서 «읽는다» (2026-08-29 신설) ──────────────
 * 장부만 자라고 읽는 자가 없으면 그건 장부가 아니라 쓰레기다(원칙 1). R2-4 가 두 벌을 남기고,
 * 읽는 줄은 여기가 짓는다. **아직 파일이 없어도 조용히 넘어간다** — 아직 안 태어난 것은 부패가 아니다.
 *
 * ㉠ `docs/_ops/게이트초.jsonl` — 한 줄이 한 커밋이고 `{시각, 커밋, 게이트:{이름:ms|"해당없음"}, 합}` 이다.
 *    🔴 **이 파일은 git 이 안 쥔다 — 로컬 장부다**(2026-08-30 · 트랙 §0-자 ⓑ). 적는 자가 커밋 «중»에
 *    append 해서 그 줄이 원리상 그 커밋에 못 담기고 **항상 다음 커밋으로 밀렸다** — 추적하는 한
 *    `git status` 가 영영 안 깨끗해진다. 그래서 `.gitignore` 로 뺐다(선례 = `기억래칫.json`).
 *    ⚠ 그러니 **새 체크아웃·다른 기계에는 이 파일이 아예 없다** — 아래 `아직: true` 가 그 자리를
 *    이미 옳게 처리한다(0건이 아니라 「아직 안 태어났다」). 그 갈래를 지우지 말 것.
 *    한도 근거(재는 자리 둘 — 하나만 적으면 다음 사람이 왜 그 수인지 모른다):
 *      · 앞판이 손으로 잰 **바닥값**(6게이트 합) = 아래 `게이트_바닥값_ms`. 그 수는 거기 하나가 안다.
 *      · 장부 자신의 첫 6게이트 줄 = **2,056ms**(08-29 21:10 · 계약동봉 134 · 대장동봉 1,367 · 나머지 넷 555).
 *    바닥값의 세 배쯤(3초)으로 두면 실물 줄 대비 여유가 1.5배뿐이라 «기계가 바쁜 날»에 곧장 거짓 경보가 된다.
 *    한도는 바닥값의 **일곱 배쯤** · 실측 전량 줄의 **두 배쯤**으로 잡는다(값은 아래 `게이트_중앙값_한도_ms`
 *    하나가 안다 — 08-30 에 주석과 상수가 같은 수를 따로 알고 있었다). 게이트 하나가 네트워크나
 *    전수 스캔을 물면 한 자리에서 넘고, 흔들림에는 안 걸린다.
 *    ⚠ 이 눈금은 실측 **두 점**에서 유도한 첫 판이다. 장부가 20커밋 쌓이면 그 분포로 다시 정한다.
 *    ⚠ 그쪽 기록의 «키 이름»을 내가 못 박지 않는다 — `합`·게이트 표 합산·`ms`류를 차례로 받아 보고,
 *    하나도 못 읽으면 0건이 아니라 «확인 불가»로 낸다(그쪽이 모양을 바꾸면 여기가 조용히 죽는다).
 *    ⚠ 커밋 열쇠로 묶지 않는다 — 지금 그 칸은 `"pending"` 이라 묶으면 서로 다른 커밋이 한 벌이 된다.
 * ㉡ `docs/_ops/밤굽기도장.json` — `{ 시각, 무엇, 상태, 완주: true|false, 사유 }` **다섯**
 *    (08-30 정정 — 앞판 규격이 넷이라 쓰는 쪽이 매번 적는 `상태` 를 읽는 쪽이 몰랐다).
 *    `상태` 셋 = **돌는중**(착수 도장이 그대로 = 재부팅·강제 kill 같은 「잡을 수 없는 죽음」) ·
 *    **멈춤**(잡은 죽음) · **완주**. `완주:false` 하나로는 그 셋이 안 갈린다.
 *    없으면 «아직 안 찍힘»(굽기를 안 한 날이 정상이다) · 완주 false 면 그 사유를 말한다.
 *    🔴 단, 도장도 없고 **찍는 쪽 파일도 없으면** 조용히 넘어가지 않는다 — 그건 「안 구운 날」이
 *    아니라 읽는 줄만 남고 쓰는 줄이 걷힌 것이고, 그러면 이 절은 영원히 침묵한다. */
const 게이트_중앙값_한도_ms = 5000;
/** 앞판이 손으로 잰 6게이트 합의 바닥값. 화면의 「몇 배」도 이 수에서 나온다(두 곳에 안 적는다). */
const 게이트_바닥값_ms = 692;

/** 한 줄에서 «그 커밋의 게이트 합 ms» 를 뽑는다. 셋을 차례로 받는다 — 그쪽이 모양을 바꿔도
 *  하나는 물고, 셋 다 안 물면 `null` 을 내서 위쪽이 «확인 불가»로 낸다(조용한 0 금지). */
function 게이트합(o) {
  if (!o || typeof o !== 'object') return null;
  if (typeof o.합 === 'number' && Number.isFinite(o.합)) return o.합;
  if (o.게이트 && typeof o.게이트 === 'object') {
    // 「해당없음」 같은 글자는 0 이 아니라 **안 돈 것**이다 — 더하지 않는다(0으로 세면 합이 낮아진다).
    const 수들 = Object.values(o.게이트).filter((x) => typeof x === 'number' && Number.isFinite(x));
    if (수들.length) return 수들.reduce((a, b) => a + b, 0);
  }
  const 홑 = [o.ms, o.경과, o.경과ms, o.밀리초].find((x) => typeof x === 'number' && Number.isFinite(x));
  return 홑 === undefined ? null : 홑;
}

function 중앙값(수들) {
  if (!수들.length) return null;
  const s = [...수들].sort((a, b) => a - b);
  const 반 = Math.floor(s.length / 2);
  return s.length % 2 ? s[반] : (s[반 - 1] + s[반]) / 2;
}

function 게이트Section(뿌리 = ROOT) {
  const p = path.join(뿌리, 'docs', '_ops', '게이트초.jsonl');
  if (!fs.existsSync(p)) return { 측정: false, 아직: true, 사유: '게이트 장부가 아직 없다(R2-4 가 적는다)' };
  const 줄들 = fs.readFileSync(p, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  const 합들 = [];
  let 못읽은줄 = 0;
  for (const l of 줄들) {
    let o = null;
    try { o = JSON.parse(l); } catch (_) { 못읽은줄++; continue; }
    const ms = 게이트합(o);
    if (ms === null) { 못읽은줄++; continue; }
    합들.push(ms);
  }
  if (!합들.length) {
    return { 측정: false, 사유: `게이트 장부 ${줄들.length}줄에서 경과 ms 를 한 줄도 못 읽었다(모르는 모양 ${못읽은줄}줄)` };
  }
  const 최근 = 합들.slice(-20);
  return { 측정: true, 커밋수: 합들.length, 잰커밋: 최근.length, 중앙값ms: 중앙값(최근), 못읽은줄, 한도ms: 게이트_중앙값_한도_ms };
}

function 밤굽기Section(뿌리 = ROOT) {
  const p = path.join(뿌리, 'docs', '_ops', '밤굽기도장.json');
  if (!fs.existsSync(p)) {
    /* 🔴 08-30 — 도장이 없을 때 «찍는 쪽»도 없는지 같이 본다.
     * 「한 번도 안 구웠다」(정상)와 「쓰는 자가 아예 사라졌다」(부패)가 지금까지 **같은 화면**이었다.
     * 읽는 줄만 남고 쓰는 줄이 걷히면 이 절은 영원히 조용하다 = 이 도구가 고치려는 얼굴 그대로다. */
    const 쓰는쪽 = fs.existsSync(path.join(뿌리, 'tools', '밤굽기.js'));
    if (!쓰는쪽) {
      return { 측정: false, 아직: false, 쓰는쪽: false,
        사유: '도장도 없고 찍는 쪽(tools/밤굽기.js)도 없다 — «안 구운 날»이 아니라 쓰는 자가 사라진 것이다' };
    }
    return { 측정: false, 아직: true, 쓰는쪽: true, 사유: '아직 안 찍힘(굽기를 안 한 날이 정상이다)' };
  }
  let o = null;
  try { o = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {
    return { 측정: false, 사유: `밤굽기 도장을 못 읽었다(JSON 아님): ${String((e && e.message) || e).slice(0, 60)}` };
  }
  if (!o || typeof o !== 'object' || typeof o.완주 !== 'boolean') {
    return { 측정: false, 사유: '밤굽기 도장에 `완주`(true/false)가 없다 — 규격은 { 시각, 무엇, 완주, 사유 }' };
  }
  /* 🔴 08-30 — **나이를 같이 낸다.** 찍는 쪽(`tools/밤굽기.js`)은 착수하자마자 `완주:false` 를
   * 먼저 박고 끝까지 가면 덮는다. 그래서 `완주:false` 는 «지금 돌고 있다»와 «돌다 죽었다»
   * **둘 다**이고, 시각 없이는 못 가른다. 여기서 **문턱을 지어내지 않는다** — 그쪽 배치 길이는
   * 판마다 다르고(그 파일 실측 ≈8시간), 그 수를 여기 베끼면 한 값을 두 곳이 알게 된다.
   * 대신 나이를 실어 보내 읽는 사람이 가른다(「지금 굽는 중이면 정상」이 문장에 들어간다). */
  const ms = o.시각 ? Date.parse(o.시각) : NaN;
  const 나이시간 = Number.isFinite(ms) ? (Date.now() - ms) / 3600000 : null;
  /* 🔴 08-30(codex 지적 `bf1ea081afd2`) — **규격의 나머지 칸도 센다.** 앞판은 `완주` 하나만 보고
   * `{"완주":true}` 를 완주 성공으로 읽었다. 그러면 이 절이 지키려던 「끝까지 안 간 굽기가
   * «성공한 얼굴»로 남는 것을 막는다」가 **가장 부실한 도장에서** 무너진다 — 시각이 없으면
   * 나이를 못 재고, 나이를 못 재면 「돌는 중」과 「죽었다」를 못 가른다(바로 아래 문단이 그 판정을
   * 나이에 걸고 있다). 판정을 뒤집지는 않는다(있는 정보는 쓴다) — 빠진 칸을 «말한다».
   * ⚠ `시각` 은 파싱까지 본다: 값이 있어도 Date.parse 가 못 읽으면 없는 것과 같다. */
  const 빠진칸 = [];
  if (!o.시각 || !Number.isFinite(ms)) 빠진칸.push(o.시각 ? '시각(못 읽는 꼴)' : '시각');
  if (!o.무엇) 빠진칸.push('무엇');
  if (o.완주 === false && !o.사유) 빠진칸.push('사유(완주 false 인데 까닭이 없다)');
  /* 🔑 08-30 — **`상태` 를 읽는다.** 읽는 쪽 규격이 넷이었는데 쓰는 쪽(`tools/밤굽기.js`·
   * `밤샘_*.js`)은 **다섯**을 매번 쓴다(39 세션 실측). 갈린 채 두면 이 절이 쓰는 쪽이 이미
   * 답해 준 것을 못 본다 — 그 값이 정확히 이 절이 나이로 «추정»하려던 것이다:
   *   돌는중 = 착수 도장이 그대로 남음 = **재부팅·강제 kill 같은 「잡을 수 없는 죽음」**
   *   멈춤  = 잡은 죽음(스스로 적고 끝냈다) · 완주 = 끝까지 갔다
   * `완주:false` 하나로는 「돌고 있다」와 「죽었다」가 안 갈린다. */
  if (o.완주 === false && !o.상태) 빠진칸.push('상태(돌는중/멈춤/완주 — 쓰는 쪽은 매번 적는다)');
  return { 측정: true, 시각: o.시각 || null, 무엇: o.무엇 || null, 상태: o.상태 || null, 완주: o.완주, 사유: o.사유 || null, 나이시간, 빠진칸 };
}

/* ── 판정 ────────────────────────────────────────────────────────────────── */
// 🔴 = 무언가가 이미 거짓을 말하고 있다(고치기 전엔 그래프·문서가 거짓말한다)
// ⚠  = 아직 거짓은 아니지만 방치하면 🔴이 된다
const EVOLVE_THRESHOLD = 2; // 지침: 마찰 신호 2건이면 지침 개정을 **제안**한다(/evolve 스킬은 08-20 은퇴 · 문턱은 산다)

function collect({ 라이브 = false, 시간제한, 장부: 장부잰다 = false } = {}) {
  const mem = attempt('memory', memorySection);
  const doc = attempt('doc', docSection);
  const fri = attempt('friction', frictionSection);
  const har = attempt('harness', harnessSection);
  const nbl = attempt('geminilm', geminilmSection);
  const nbd = attempt('geminilm-drive', geminilmDriveSection);
  const toi = attempt('toil', toilSection);
  const map = attempt('지도', mapSection);
  const 절단 = attempt('절단문서', () => 절단문서Section());
  const dep = attempt('배포판', () => 배포Section(라이브, 시간제한));
  const 재질 = attempt('재질의금지', 재질의Section);
  const 장부 = attempt('회차장부', () => 장부Section(장부잰다));
  const 바탕 = attempt('바탕화면', 바탕화면Section);
  const 소개 = attempt('소개서', 소개서Section);
  const 이름 = attempt('이름부름', () => 이름부름Section());
  const 남은손 = attempt('남은손', () => 남은손Section());
  const 상주 = attempt('상주총량', () => 상주Section());
  const 게이트 = attempt('게이트초', () => 게이트Section());
  const 밤굽기 = attempt('밤굽기도장', () => 밤굽기Section());
  const 트랙수 = attempt('트랙수대조', () => require('./lib/트랙수대조.js').대조하기(ROOT));

  const red = [];
  const warn = [];
  const notes = [];

  // 신설 절 다섯도 이 그물에 넣는다 — 절이 죽으면 「검사기 고장」 적색이 뜨고, 적색은 이제 축을 안 탄다.
  // (`소개` 는 08-29 까지 이 그물 밖이었다 — 소개서 절이 죽으면 아무 소리도 안 났다. 같이 넣는다.)
  for (const s of [mem, doc, fri, har, nbl, nbd, toi, map, 절단, dep, 재질, 장부, 바탕, 소개, 이름, 남은손, 상주, 게이트, 밤굽기]) {
    // `배포:true`·`장부:true` = 각자 스로틀로 따로 도는 항목(F244). 문구가 아니라 이 표식으로
    // 고른다 — 앵커는 문구가 바뀌면 죽고, 죽으면 그 절만 조용히 리포트에서 빠진다.
    if (!s.ok) red.push({ kind: '검사기 고장', text: `${s.name} 검사가 실패했다 — ${s.error}`, 배포: s === dep, 장부: s === 장부 });
  }

  /* 트랙에 적힌 «수»가 그 수의 정본과 어긋나나 — 자가 없으면 수는 조용히 낡는다.
     09-05 실측: 말투 분모가 82 → 99 로, crewcard 배포 지문이 **세 번째로** 낡아 있었고
     둘 다 되잴 자가 없어 아무도 못 알았다. 자 = `tools/lib/트랙수대조.js`(유호 지시 09-05).
     🔴 «못잼»을 침묵시키지 않는다 — 무늬가 죽으면 「어긋남 0」이라는 거짓 초록이 난다. */
  if (트랙수.ok) {
    for (const x of 트랙수.value.어긋남) {
      red.push({ kind: '트랙 수 낡음', text: `${x.이름} — 트랙 ${x.트랙값} ≠ 참 ${x.참값} · ${x.뜻}` });
    }
    for (const x of 트랙수.value.못잼) {
      notes.push({ kind: '트랙 수 못잼', text: `${x.이름} — ${x.사유}` });
    }
  }

  if (절단.ok && 절단.value.present) {
    const v = 절단.value;
    // 못 잰 것은 「부패 없음」이 아니다 — 침묵시키지 않고 메모로 드러낸다(라이브 미측정과 같은 원칙).
    if (!v.측정) notes.push({ kind: '소급불가 정본 미측정', text: `${절단문서} — ${v.사유}` });
    else if (v.뒤.length) {
      const 보임 = v.뒤.slice(0, 4).map((c) => `${c.저장소} ${c.해시} ${c.제목.slice(0, 44)}`);
      // 자른 것은 숫자로 밝힌다 — 조용한 절단은 「이게 전부」로 읽힌다.
      if (v.뒤.length > 보임.length) 보임.push(`외 ${v.뒤.length - 보임.length}건`);
      warn.push({
        kind: '소급불가 정본 낡음 의심',
        text: `${절단문서} 가 마지막으로 담긴 뒤 형제에서 ①②항목을 말한 커밋 ${v.뒤.length}건 — `
          + `${보임.join(' / ')} · 진행표(§진행)를 그 커밋들과 대조한다`,
      });
    }
  }

  if (재질.ok && 재질.value.측정) {
    for (const v of 재질.value.위반) {
      warn.push({
        kind: '재질의 위반(메모리)',
        text: `${v} — 유호님이 이미 답한 주제가 대기 표식을 달고 있다(F126). 그 줄에 ✅/🚫재질의 를 붙이거나 낡은 대기를 지운다`,
      });
    }
  }
  // 재질.측정=false 는 메모조차 아니다 — 메모리 없는 기계(CI·폰)가 정상인 자리라(절단문서 present:false 와 같은 축),
  // 거기서 소음을 내면 진짜 위반 경보까지 같이 꺼진다. 탐지력은 픽스처가 진다.

  if (dep.ok && dep.value.측정) {
    for (const r of dep.value.결과) {
      // 보류는 **경고가 아니라 메모**다 — 남이 손대는 중인 것을 내가 배포할 수는 없다(F073).
      if (r.level === 'stale' && r.편집중) {
        notes.push({
          kind: '라이브 대조 보류',
          text: `${r.이름}: 배포집합 ${r.파일들.join('·')} 이 지금 미커밋이라 라이브와 달라 보인다 — 커밋된 뒤 다시 잰다`,
          배포: true,
        });
      } else if (r.level === 'stale') red.push({ kind: '라이브 낡음', text: r.lines.join('\n      '), 배포: true });
      else if (r.level === 'unknown') warn.push({ kind: '배포 판정 불가', text: r.lines[0], 배포: true });
      // 확인 불가는 **경고가 아니라 메모**다 — 폰·CI엔 자격증명이 없고, 그건 부패가 아니다.
      // 단 침묵시키지도 않는다: 통과와 미실행이 같은 모양이면 이 도구의 존재 이유가 사라진다.
      else if (r.level === 'unreachable') notes.push({ kind: '라이브 미측정', text: r.lines.join(' / '), 배포: true });
    }
  } else if (dep.ok && !dep.value.측정) {
    /* 🔴 08-29 수리 — 머리말이 약속한 「미측정」을 **실제로 드러낸다.** 옛 판은 여기가 없어서
     * 라이브를 안 잰 실행이 「배포 축 이상 없음」과 **한 글자도 다르지 않았다.** */
    notes.push({
      kind: '라이브 대조 미측정',
      text: `${dep.value.사유 || '사유 미상'} — 이건 «초록»이 아니라 안 잰 것이다. 재려면 SYNK_ROT_LIVE 를 끄지 않고 배포 차례에 돌린다`,
      배포: true,
    });
  }

  if (mem.ok) {
    const d = mem.value.diagnose;
    /* 깨진 링크는 **한 줄로 접는다**(08-24) — 08-20 압축이 토픽을 대량 삭제하며 남긴 잔해가
     * 223건이라, 개별 나열이 진짜 신호(그날 기준 29건)를 세 화면 밑으로 밀어냈다(운영 cron
     * 이상이 목록 한가운데 묻혀 있었다 — T12 늑대소년 병이 감시 도구 자신에게 난 것).
     * 건수는 red 로 남는다: 새 깨진 링크가 «늘면» 숫자로 보인다. 전량은 memory-graph 가 낸다. */
    if (d.broken.length) {
      red.push({
        kind: '깨진 링크',
        text: `${d.broken.length}건(접힘 — 대부분 08-20 압축 때 삭제된 토픽을 가리키는 잔해)` +
          ' · 전량: node tools/memory-graph.js',
      });
    }
    for (const g of d.ghostInIndex) red.push({ kind: '인덱스 유령', text: `MEMORY.md가 없는 파일을 가리킨다: ${g}` });
    for (const u of d.unknown) warn.push({ kind: '미지 링크 타입', text: `${u.from}: ${u.type}>${u.target}` });
    /* 「인덱스 누락」·「고아 노드」 검사는 08-20 은퇴 — 옛 규약(토픽 전수를 MEMORY.md 에 등재)의
     * 검사다. 새 규약(08-20 압축: 인덱스는 핵심만 · 토픽 356벌은 이름으로 연다)에서 인덱스 밖은
     * 정상이라, 이 두 경고는 매 실행 «정상을 소음으로» 냈다(실측: 누락 12 · 전부 의도된 비등재).
     * ghostInIndex(인덱스가 죽은 파일을 가리킴)는 남는다 — 그건 새 규약에서도 진짜 부패다. */
  }

  if (doc.ok) {
    for (const b of doc.value.broken) red.push({ kind: '깨진 참조', text: `${b.from} → ${b.target}` });
    /* 낡은 인용은 **같은 정본을 가리키는 4건부터 묶는다**(08-24 · 유호 「발전 가능성이 높은 방향」) —
     * 철학 파생 27건이 개별 나열로 진짜 빨강을 세 화면 밑으로 밀어냈다. 범주는 red 그대로(08-12
     * 유호 확정 「파생은 틀린 것을 싣고 있다 → 🔴가 정확한 표시」 — 뭉개는 건 «표시»가 아니라 «나열»이다).
     * 다른 정본의 «새» 낡음은 3건 이하라 계속 개별로 뜬다 — 접기가 새 신호를 삼키지 않는다. */
    const 정본별 = new Map();
    for (const s of doc.value.stale) {
      const k = s.target;
      if (!정본별.has(k)) 정본별.set(k, []);
      정본별.get(k).push(s);
    }
    for (const [target, 벌] of 정본별) {
      if (벌.length <= 3) {
        for (const s of 벌) red.push({ kind: '낡은 인용', text: `${s.from} — ${path.basename(target)} 인용 ${s.cited} → 현재 ${s.now}` });
      } else {
        const 판들 = [...new Set(벌.map((s) => s.cited))].join('·');
        red.push({
          kind: '낡은 인용',
          text: `${path.basename(target)} 파생 ${벌.length}건(인용 ${판들} → 현재 ${벌[0].now} · 접힘)` +
            ' — 처방: 그 문서를 손댈 때 밀린 판 몫을 같이 반영하고 도장(--stamp)한다 · 전량: node tools/doc-graph.js',
        });
      }
    }
    /* 「정본 버전 미상」도 **인용한 문서별로 4건부터 접는다**(08-29 · 낡은 인용 접기와 같은 규칙).
     * 왜 지금인가: 실측 그날 이 종류 12건이 전부 한 문서(`docs/강사채용_부트캠프_v1.md`)에서 나와
     * `render()` 의 경고 상한 12를 통째로 먹었고, 그 뒤에 선 신설 절들이 「… 외 8건」으로 접혀
     * **한 줄도 못 나왔다.** 원인이 하나인 다발이 상한을 먹으면 다른 축이 통째로 침묵한다. */
    const 미상별 = new Map();
    for (const c of doc.value.canonUnknown) {
      if (!미상별.has(c.from)) 미상별.set(c.from, []);
      미상별.get(c.from).push(c);
    }
    for (const [from, 벌] of 미상별) {
      if (벌.length <= 3) {
        for (const c of 벌) warn.push({ kind: '정본 버전 미상', text: `${c.target}(${c.from}이 ${c.cited} 인용)` });
      } else {
        const 앞 = 벌.slice(0, 3).map((c) => path.basename(c.target)).join('·');
        warn.push({
          kind: '정본 버전 미상',
          text: `${from} 하나가 ${벌.length}건(접힘) — ${앞} 외 · 그 문서가 인용한 정본들이 판을 안 밝힌다` +
            ' · 전량: node tools/doc-graph.js',
        });
      }
    }
    // 색인 밖 문서는 **한 줄로** 올린다 — 12건이 각자 한 줄을 먹으면 warn 렌더 상한(12)을
    // 통째로 차지해 다른 신호를 밀어낸다. 전량은 도구가 갖고 있다.
    const mg = doc.value.mapGaps;
    if (mg.noMap) {
      red.push({ kind: '지도 실종', text: 'docs/문서_지도.md 가 없다 — 색인이 통째로 사라졌다' });
    } else if (mg.missing.length) {
      const 앞 = mg.missing.slice(0, 3).map((m) => path.basename(m)).join('·');
      warn.push({
        kind: '지도 누락',
        text: `${mg.missing.length}종이 문서_지도.md 색인 밖 — ${앞}${mg.missing.length > 3 ? ' 외' : ''}` +
          ' · 색인이 갈라지면 정본 지목이 두 갈래가 된다(08-07 실측) · 전량: node tools/doc-graph.js',
      });
    }
  }

  if (소개.ok) {
    const s = 소개.value;
    for (const g of s.갈라짐) {
      red.push({
        kind: '소개서 원고↔산출물 갈라짐',
        text: `${g} — 지금 재굽기하면 산출물의 손 수정이 사라진다. 수리: node tools/펠트문서.js --재현 (안내를 따른다)`,
      });
    }
    for (const x of s.판모순) red.push({ kind: '소개서 판 자기모순', text: `${x} — footer 갱신이 빠졌다(같은 커밋에서 둘을 같이 올린다)` });
    for (const x of s.점수낡음) red.push({ kind: '소개서 점수 낡음', text: `${x} — 사진이 낡으면 읽는 사람이 틀린 그림을 본다(철학 ⑤)` });
    for (const x of s.철학낡음) red.push({ kind: '소개서 철학판 낡음', text: x });
    if (s.지도판모순) red.push({ kind: '지도 판 자기모순', text: s.지도판모순 });
  }

  if (바탕.ok && 바탕.value.present && 바탕.value.건수 > 0) {
    // 빨강이다 — 유호님이 **지금 눈으로 보는** 물건이 틀렸다는 뜻이라 「나중에」가 없다.
    red.push({
      kind: '바탕화면 빨강 — 유호님 화면이 틀렸다',
      text: `${바탕.value.건수}건 — ${바탕.value.줄.join(' / ') || '(항목 줄 미검출)'}` +
        '\n      수리: 「무덤」이면 링크를 정본으로 돌리고(`docs/_archive` 를 가리키면 안 된다),' +
        '\n            「멈췄다」면 그 산출물을 만드는 배선부터 본다(예약 작업이 부르는 도구가 지워졌을 수 있다).' +
        '\n            표 = node tools/운영자료.js --지금상태',
    });
  }

  if (har.ok && har.value.present && har.value.stale) {
    warn.push({
      kind: '이식 폴더 낡음',
      text: `바탕화면 SYNK_하네스 = ${har.value.stamp || '(스탬프 미검출)'} · 정본 = ${har.value.canonical}` +
        ' — 다른 도구(Codex·Kimi·웹·Obsidian)가 낡은 지침을 읽는다. 수리: node tools/harness-export.js',
    });
  }

  if (nbl.ok && nbl.value.present && nbl.value.changed.length) {
    const n = nbl.value.changed.length;
    warn.push({
      kind: '제미나이LM 묶음 낡음',
      text: `묶음(만든 날 ${nbl.value.made}) 이후 원천 ${n}개가 바뀌었다 — ` +
        `${nbl.value.changed.slice(0, 3).join(', ')}${n > 3 ? ` 외 ${n - 3}건` : ''}. ` +
        '올라간 사본은 저장소가 만질 수 없으므로 스스로 안 낫는다. ' +
        '수리: node tools/geminilm-export.js → 제미나이LM에서 옛 노트북을 지우고 새로 올린다',
    });
  }

  if (nbd.ok && nbd.value.present && !nbd.value.unknown) {
    if (nbd.value.failed) {
      red.push({
        kind: '제미나이LM 자동 갱신 실패',
        text: `예약 작업 SYNK_GeminiLM 마지막 실행이 실패했다 — ${nbd.value.last.trim()}\n` +
          '     드라이브 데스크톱이 꺼졌거나 크롬 실패. 제미나이LM 소스는 그 시점에서 멈춰 있다' +
          '(화면상으론 「있는 것」처럼 보이므로 조용한 낡음이다).\n' +
          (nbd.value.마운트 === false
            // 처방을 갈라 준다 — 마운트가 없는데 도구를 돌리라고 하면 세션은 같은 자리에서
            // 막히고, 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103·F318).
            ? '     🔴 지금도 드라이브 마운트가 없다(G:~K: 전부 훑음) — **도구를 돌려도 같은 자리에서 멈춘다.**\n' +
              '     유호님만 풀 수 있다: 구글 드라이브 데스크톱을 켜고 「내 드라이브」가 보이면 그때 재실행된다' +
              '(예약 작업이 매일 돌므로 켜 두기만 하면 손은 안 간다).'
            : '     수리: node tools/geminilm-drive.js  (마운트는 지금 잡힌다)'),
      });
    } else if (nbd.value.지난날 !== null && nbd.value.지난날 >= 3) {
      warn.push({
        kind: '제미나이LM 자동 갱신 멈춤',
        text: `마지막 성공이 ${nbd.value.성공일}(${nbd.value.지난날}일 전) — 매일 도는 배선인데 안 돌고 있다. ` +
          'PC가 꺼져 있었다면 정상이지만, 켜져 있었다면 예약 작업을 확인하라(schtasks /query /tn SYNK_GeminiLM).',
      });
    }
  }

  if (map.ok && map.value.present && map.value.문제수) {
    warn.push({
      kind: '지도 사본 갈림',
      text: `바탕화면 SYNK_지도 ${map.value.지도수}종 중 문제 ${map.value.문제수}건 — ` +
        map.value.지도들.slice(0, 3).map((m) => `${m.이름}(${m.첫문제})`).join(' · ') +
        ' — 유호님이 여는 사본이 정본과 갈라졌거나 신선도를 모른다.' +
        ' 상세: node tools/지도대장.js · 수리: --bake / --stamp',
    });
  }

  if (toi.ok && toi.value.present && toi.value.stale) {
    warn.push({
      kind: '손일 장부 정체',
      text: `마지막 기입이 ${toi.value.idle}일 전(기준 ${toi.value.limit}일) — 그 사이 사람 일을 없앤 릴리스가 정말 없었나. ` +
        '없앤 뒤에는 「그게 얼마나 자주였나」를 다시 못 잰다(소급 불가). ' +
        '기입: node tools/bump-version.js --desc "..." --toil "없앤 손일::주기::대체 장치"',
    });
  }

  /* /evolve 스킬은 08-20 은퇴(유호 픽 — 개정은 마찰이 쌓이면 그 자리에서 제안한다).
   * 알림 자체는 산다 — 「지침 개정을 제안할 때」의 신호는 스킬이 아니라 이 문턱이었다. */
  if (fri.ok && fri.value.새로.length >= EVOLVE_THRESHOLD) {
    notes.push({
      kind: '지침 개정 제안 조건 도달',
      text: `마지막 개정(${fri.value.기준 || '기준점 못 읽음 — 전량으로 센다'}) 뒤에 난 마찰 신호 ` +
        `${fri.value.새로.length}건(기준 ${EVOLVE_THRESHOLD}건) — ${fri.value.새로.map((r) => r.id).join(', ')} · 유호님 승인 자리다`,
    });
  }

  /* F386 ㉡ — 「지난 개정을 넘겼는데 아직 아무도 판정 안 붙인 행」. 위 알림과 **갈라서** 낸다:
   * 붙여 놓으면 「2건 더 났다」와 「N건이 안 닫혔다」가 한 문장에서 같은 모양이 되고, 그게
   * 정확히 F386 이 신고한 포화다. 처방이 둘로 갈리는데(개정하라 / 대조하라) 문장이 하나면
   * 읽는 쪽은 둘 다 안 한다. 나이는 기계가 정확히 아는 축이라 거짓양성이 0이다. */
  if (fri.ok && fri.value.기준 && fri.value.묵은.length) {
    warn.push({
      kind: '장부 판정 미부착',
      text: `마지막 개정(${fri.value.기준}) 전에 난 마찰 신호 ${fri.value.묵은.length}건이 «판정 없이» 열려 있다 — ` +
        `${fri.value.묵은.map((r) => r.id).join(', ')}. ` +
        '고쳤으면 resolve, 「지금은 안 닫는다」면 defer 로 그 판정을 장부에 적는다(적을 자리가 없어서 ' +
        '같은 대조를 세션마다 다시 하던 자리다 · F386). 처방: node tools/friction.js defer F0NN "왜 · 어디서 판정했나"',
    });
  }

  if (장부.ok && 장부.value.측정) {
    const j = 장부판정(장부.value);
    red.push(...j.red);
    notes.push(...j.notes);
  }

  /* ③ 이름은 부르는데 없는 파일 — **한 줄로 접는다.** 지금 27줄인데 개별로 내면 진짜 적색을
   * 화면 밖으로 밀어낸다(깨진 링크 접기와 같은 판정). 그리고 적색이 아니라 «경고»다 — 이미
   * 지나간 삭제의 잔해라 오늘 당장 거짓말을 하는 것은 아니고, 매일 우는 순간 이 자가 꺼진다. */
  if (이름.ok) {
    const v = 이름.value;
    if (!v.측정) {
      warn.push({ kind: '이름 부름 확인 불가', text: `${v.사유} — 「없다」가 아니라 **못 쟀다**` });
    } else if (v.못읽은폴더 || v.못읽은파일) {
      /* 🔴 08-30 신설 — 훑기가 일부를 못 읽었는데 결과는 「측정 성공」으로 나오는 자리.
       * 「없는것 0」이 **분모가 샌 0** 일 수 있어 그걸 먼저 말한다(0건과 못 잼을 안 뭉갠다). */
      warn.push({
        kind: '이름 부름 — 분모가 온전하지 않다(못 잼)',
        text: `폴더 ${v.못읽은폴더}곳 · 파일 ${v.못읽은파일}개를 못 읽고 ${v.판파일}개만 훑었다` +
          ` — 이 회차의 「없는 파일 ${v.없는것.length}종」은 **그만큼 덜 센 수**다.` +
          '\n      권한·잠금·경로 길이를 먼저 본다. 고치기 전엔 이 절의 0을 «깨끗함»으로 읽지 말 것.',
      });
    }
    if (v.측정 && v.없는것.length) {
      const 앞 = v.없는것.slice(0, 5).map((x) => `${x.이름}←${x.자리들[0]}`).join(' · ');
      warn.push({
        kind: '이름은 부르는데 없는 파일',
        text: `${v.없는것.length}종 / ${v.줄수}줄 — ${앞}${v.없는것.length > 5 ? ` 외 ${v.없는것.length - 5}종` : ''}` +
          `\n      (부름 ${v.종수}종 중 여기 실재 ${v.실재} · 형제[${v.형제.join('·')}] 실재 ${v.형제실재} · 삭제 표식이 붙은 줄은 면제` +
          `${v.기록JSON ? ` · 운영 기록 JSON ${v.기록JSON}벌은 «코드가 아니라 기록»이라 뺐다` : ''})` +
          '\n      처방 둘: 그 자리를 지키는 검사를 다시 짓거나, 그 줄에 「⚠삭제됨」을 달아 «알고 남긴 기록»으로 만든다.' +
          '\n      🔴 그냥 두면 그 주석은 읽는 사람에게 «지켜지고 있다»는 거짓 확신을 준다.',
      });
    }
  }

  /* ④ 남은 손 — **메모**다. 반복되는 손 대기는 부패가 아니라 «상태»라, 적색에 두면 매일 운다.
   * 다만 숨기지도 않는다 — 안 보이면 「0이겠지」가 되고, 그게 이 축을 만든 병이다. */
  if (남은손.ok) {
    const v = 남은손.value;
    const 조각 = [];
    if (v.검수) {
      조각.push(v.검수.측정
        ? `몽골어 검수 확정 칸 ${v.검수.분모}건 중 ${v.검수.남음}건이 비어 있다(데이터 시트 ${v.검수.시트}벌 · 안내문 ${v.검수.안내문}벌은 «확정 칸이 없어» 분모 밖) · 회수 왕복 ${v.검수.왕복}회`
        : `몽골어 검수 **못 잼** — ${v.검수.사유}`);
    }
    if (v.codex) {
      조각.push(v.codex.측정
        ? `codex 미처분 ${v.codex.미처분}/${v.codex.총지적}건(처분 도장이 없으면 다음 런이 같은 지적을 다시 낸다 · node tools/codex-review.js --미처분)`
        : `codex 미처분 **못 잼** — ${v.codex.사유}`);
    }
    if (이름.ok && 이름.value.측정 && 이름.value.없는것.length) {
      조각.push(`이름만 남은 검사기 ${이름.value.없는것.length}종(위 ③)`);
    }
    /* 예약 — 이 자는 「등록됐나」를 원리상 못 본다(위 남은손Section ㉢ 머리말). 되읽어 보라고만 말한다. */
    if (v.예약 && v.예약.측정 && v.예약.폴더) {
      조각.push(`예약 폴더 ${v.예약.폴더}개 — 🔴 **등록됐는지는 이 자가 못 본다**(하네스 안에만 있다).`
        + '\n        `list_scheduled_tasks` 로 되읽어라 — 등록은 **두 번 전량 증발했다**(09-01 일곱 중 0 · 09-04 아홉 중 0).'
        + '\n        09-04 에 증발해 있던 아홉 안에 **부가세 폐업확정신고 기한 알림**이 있었다. 안 울면 가산세가 붙는다.');
    } else if (v.예약 && !v.예약.측정) {
      조각.push(`예약 폴더 **못 잼** — ${v.예약.사유}`);
    }
    if (조각.length) notes.push({ kind: '남은 손(운영에서 반복되는 것)', text: 조각.join('\n      · ') });
  }

  /* ⑤ 상주 총량 — 선언이 실측과 어긋나면 **적색**이다. 이 파일의 정의 그대로: 무언가가 이미
   * 거짓을 말하고 있다. 한 줄로 접는다(하루 한 번 · 한 줄이면 안 꺼진다). */
  if (상주.ok) {
    const v = 상주.value;
    if (v.못읽음.length) {
      warn.push({
        kind: '상주 선언을 못 읽었다',
        text: `${v.못읽음.join(' / ')} — 앵커가 죽으면 이 검사는 «어긋남 0건»과 똑같이 생긴다. 뽑기 정규식(rot-check 의 \`상주선언\`)을 현행 문장에 맞춘다`,
      });
    }
    if (v.어긋남.length) {
      const 보임 = v.어긋남.slice(0, 4).map((x) =>
        `${x.대상} 선언 ${x.선언}${x.단위} → 실측 ${x.단위 === '자' ? x.실측 : x.실측.toFixed(1)}${x.단위}(${x.배.toFixed(1)}배 · 적은 곳 ${x.선언처})`);
      if (v.어긋남.length > 보임.length) 보임.push(`외 ${v.어긋남.length - 보임.length}건`);
      red.push({
        kind: '상주 선언이 실측과 어긋난다',
        text: `${v.어긋남.length}건 — ${보임.join('\n      ')}` +
          '\n      선언이 틀리면 「전문을 안 싣는다」 같은 설계 판정의 **근거 자체가 거짓**이 된다. 그 줄의 숫자를 실측으로 고친다.' +
          `\n      (절대 상한은 여기서 안 정한다 — 유호님 판정거리다. 지금 실측: ${Object.entries(v.실측)
            .map(([k, x]) => `${path.basename(k)} ${x ? x.KB.toFixed(1) + 'KB' : '못읽음'}`).join(' · ')})`,
      });
    }
  }

  /* ⑥-㉠ 게이트 경과 — 다른 트랙이 적는 장부를 읽는 «한 줄». */
  if (게이트.ok) {
    const v = 게이트.value;
    if (!v.측정 && !v.아직) {
      warn.push({ kind: '게이트 장부 확인 불가', text: `${v.사유} — 0건이 아니라 못 읽은 것이다` });
    } else if (v.측정 && v.중앙값ms !== null && v.중앙값ms > v.한도ms) {
      warn.push({
        kind: 'pre-commit 게이트가 느려졌다',
        text: `최근 ${v.잰커밋}커밋 중앙값 ${(v.중앙값ms / 1000).toFixed(1)}초 — 한도 ${(v.한도ms / 1000).toFixed(0)}초를 넘었다` +
          `(바닥값 실측 ${(게이트_바닥값_ms / 1000).toFixed(3)}초의 ${(v.중앙값ms / 게이트_바닥값_ms).toFixed(1)}배).` +
          ' 느린 게이트는 우회를 정상 통로로 만든다 · 전량: docs/_ops/게이트초.jsonl',
      });
    }
  }

  /* ⑥-㉡ 밤 굽기 완주 도장 — 없으면 조용하다(굽기를 안 한 날이 정상). «착수 상태»만 말한다.
   * `완주:true` 는 그 시각이 며칠 지났어도 안 운다 — 안 굽는 날이 정상이므로 «낡은 성공 도장»은
   * 부패가 아니다. 그 값은 `--json` 에 그대로 실려 「정말 0인가」를 볼 수 있다. */
  if (밤굽기.ok) {
    const v = 밤굽기.value;
    if (!v.측정 && !v.아직) {
      warn.push({ kind: '밤굽기 도장 확인 불가', text: `${v.사유}` });
    }
    if (v.측정 && v.빠진칸 && v.빠진칸.length) {
      /* 🔴 08-30 신설 — 도장이 규격을 반만 지켰다. 완주 판정은 살리되 «반쪽»임을 말한다. */
      warn.push({
        kind: '밤굽기 도장이 규격을 덜 지켰다(못 잼)',
        text: `빠진 칸: ${v.빠진칸.join(' · ')} — 규격은 { 시각, 무엇, 상태, 완주, 사유 }` +
          '\n      🔴 특히 `시각` 이 없으면 나이를 못 재고, 나이를 못 재면 아래 «착수 상태» 판정이' +
          ' 「지금 굽는 중」과 「돌다 죽었다」를 **원리상 못 가른다**(찍는 쪽 = tools/밤굽기.js).',
      });
    }
    if (v.측정 && !v.완주) {
      const 나이 = v.나이시간 === null ? '(나이 미상)'
        : v.나이시간 < 1 ? `${Math.round(v.나이시간 * 60)}분 전`
          : `${v.나이시간.toFixed(1)}시간 전`;
      notes.push({
        kind: '밤 굽기 도장이 «착수» 상태다',
        text: `${v.시각 || '(시각 미상)'}(${나이}) · ${v.무엇 || '(무엇 미상)'} · 상태=${v.상태 || '(안 적혔다)'} — 사유: ${v.사유 || '(안 적혔다)'}` +
          '\n      🔑 상태가 가른다: **돌는중** = 착수 도장 그대로(굽는 중이거나 재부팅·강제 kill 로 못 덮은 것) ·' +
          ' **멈춤** = 스스로 적고 끝낸 죽음. 나이는 그 둘 사이를 좁히는 보조자다.' +
          '\n      🔑 읽는 법: **지금 굽는 중이면 정상**이다(찍는 쪽이 착수 때 먼저 박는다).' +
          ' 굽기가 끝났을 시각인데 아직 이 상태면 돌다 죽은 것이다(재부팅·강제 종료는 도장을 못 덮는다).' +
          ' 끝까지 안 간 굽기가 «성공한 얼굴»로 남는 것을 막으려고 이 도장이 있다.',
      });
    }
  }

  return { mem, doc, fri, har, dep, 장부, 이름, 남은손, 상주, 게이트, 밤굽기, red, warn, notes, findings: red.length + warn.length + notes.length };
}

/* ── 출력 ────────────────────────────────────────────────────────────────── */
/** 경고 목록에서 «이름을 내는» 상한. 이 수를 아는 곳은 여기 하나다. */
const 경고_상한 = 12;
/** 「0건이 아니라 못 쟀다」를 말하는 kind — 상한에 안 걸린다(아래 `render` 머리말). */
const 못잼_kind = /확인 불가|못 읽었다|미측정|못 잼|판정 불가/;

function render(r) {
  const out = [];
  const push = (s) => out.push(s);

  if (r.red.length) {
    push(`🔴 수리 필요 ${r.red.length}건`);
    for (const x of r.red) push(`   [${x.kind}] ${x.text}`);
  }
  if (r.warn.length) {
    /* 🔴 08-30 — **「못 쟀다」 계열은 상한에서 면제한다.**
     * 경고는 12건까지만 이름을 내는데, 눈이 먼 검사들의 신고는 `collect()` 꼬리에 붙어
     * 목록 맨 아래다. 검사 여럿이 동시에 눈이 머는 날(= 이 신고가 제일 필요한 날) 그것들이
     * 「… 외 N건」 뒤로 통째로 사라진다 — **자기 침묵을 자기가 숨기는 자리**라 상한보다 무겁다.
     * 오늘(08-30) 여유는 경고 한 건뿐이라 가상 시나리오가 아니다. */
    const 못잼인가 = (x) => 못잼_kind.test(String(x.kind || ''));
    const 못잼 = r.warn.filter(못잼인가);
    const 나머지 = r.warn.filter((x) => !못잼인가(x));
    push(`⚠ 주의 ${r.warn.length}건`);
    for (const x of 못잼) push(`   [${x.kind}] ${x.text}`);
    for (const x of 나머지.slice(0, 경고_상한)) push(`   [${x.kind}] ${x.text}`);
    if (나머지.length > 경고_상한) push(`   … 외 ${나머지.length - 경고_상한}건`);
  }
  for (const n of r.notes) push(`▶ ${n.kind} — ${n.text}`);

  // 전파 보류 — 적색도 경고도 아니다. **세어서 보이기는 한다**: 숨기면 「없는 것」이 되고,
  // 적색에 두면 고치지 말라고 정해 둔 것이 매 세션 27건 중 25건을 차지한다(08-10 실측).
  // 절 하나가 없거나 안 쟀다고 리포트 전체가 죽으면 안 된다 — 그 침묵이 이 도구가 고치려는 병이다.
  if (r.doc && r.doc.ok && r.doc.value && r.doc.value.staleHeld && r.doc.value.staleHeld.length) {
    const h = r.doc.value.staleHeld;
    const 정본별 = [...new Set(h.map((s) => `${path.basename(s.target)}@${s.now}`))].join(' · ');
    push(`   ⏸ 전파 보류 ${h.length}건 — 유호님이 그 판에서 세워 둔 것이다(${정본별}). 손댈 일이 생기면 그때 같이 반영한다.`);
  }

  // 결정 큐 — 부패가 아니라 **순서**다. 이 도구가 존재하는 이유의 절반이 여기에 있다.
  if (r.mem.ok) {
    const dec = r.mem.value.decisions;
    if (dec.ranked.length) {
      push(`\n결정 큐 (막힘> 위상정렬) — 기다리는 항목 ${dec.waiting}개`);
      for (const x of dec.ranked.slice(0, 3)) {
        push(`   ${String(x.unblocks).padStart(2)}건 해소 ← ${x.blocker} [${x.kind}]`);
      }
      if (dec.cycles.length) push(`   ☠️ 순환 대기 ${dec.cycles.length}건 — 서로 기다려 영원히 안 풀린다`);
    }
    const un = r.mem.value.unwired;
    if (un.length) {
      push(`   ℹ 큐 밖의 ⏳ — ${un.length}개 토픽이 글로만 대기 중(막힘> 엣지가 없어 순위에 안 잡힌다)`);
    }
  }
  return out.join('\n');
}

/* ── 스로틀 ──────────────────────────────────────────────────────────────── */
/* 키별로 연 이유(F244): 항목마다 부패 속도가 다르다. 저장소 쪽(메모리·문서·마찰)은 느리게
 * 낡아서 7일이면 충분한데, **라이브 드리프트는 하루가 그대로 소급 불가 손실**이다.
 * 하나의 도장으로 묶으면 둘 중 느린 쪽이 빠른 쪽을 6일간 침묵시킨다. */
function 상태() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) || {}; } catch (_) { return {}; }
}

function dueNow(now, key = 'last', days = Number(process.env.SYNK_ROT_INTERVAL_DAYS || DEFAULT_INTERVAL_DAYS)) {
  const last = 상태()[key] || 0;   // 없는 키 = 한 번도 안 잼 = 돌 차례다
  return now - last >= days * 24 * 60 * 60 * 1000;
}

/* 읽고 합쳐서 쓴다 — 통째로 덮으면 주간 도장이 배포 도장을 지우고(그 반대도) 서로를 되살려
 * 두 스로틀이 다 무의미해진다. */
function stamp(now, patch) {
  const f = stateFile();
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify({ ...상태(), ...patch, at: new Date(now).toISOString() }, null, 1), 'utf8');
  } catch (_) { /* 상태를 못 써도 검사 자체는 성공이다 — 다음 세션에 한 번 더 도는 것뿐 */ }
}

/* 아래 층(`배포판점검.안나간변경`)이 자기 거짓양성을 재우는 데 쓰는 도장 조각.
 * 여기서만 만든다 — **실제로 잰 실행**만 남길 값을 갖기 때문이다(위 stamp 주석과 같은 축:
 * 안 잰 날에 찍으면 그 하루가 조용히 사라진다). 키 이름은 배포판점검에서 파생시킨다:
 * 쓰는 쪽과 읽는 쪽에 글자를 따로 적으면 갈라지고, 갈라진 쪽은 「도장 없음」으로 조용히 죽는다. */
function 배포도장(now, dep) {
  let 키;
  try { 키 = require('./배포판점검.js').도장키; } catch (_) { return {}; }
  if (!키) return {};
  const 프로젝트들 = {};
  for (const r of (dep && dep.결과) || []) {
    if (!r || !r.이름 || !r.실측 || !r.실측.지문) continue;   // 지문을 못 잰 것은 안 남긴다
    /* `라이브판` 은 **뒤처졌다고 실측된 판에만** 실린다(그 갈래에서만 나온다) — 없으면 아래 층이
     * 채번 기준선으로 떨어진다. 「모름」을 값처럼 실으면 그 층이 모름을 기준선으로 쓴다. */
    프로젝트들[r.이름] = { 지문: r.실측.지문, 초록: !!r.실측.초록 };
    if (r.실측.라이브판 && r.실측.라이브판.종류 === '뒤처짐' && r.실측.라이브판.sha) {
      프로젝트들[r.이름].라이브판 = { 종류: '뒤처짐', sha: r.실측.라이브판.sha };
    }
  }
  return Object.keys(프로젝트들).length ? { [키]: { at: now, 프로젝트들 } } : {};
}

/* 배포 절만 남긴 판. `mem`·`doc` 을 죽여 결정 큐 절과 보류 절도 같이 뺀다 — 하루짜리 알림에
 * 주간 리포트가 딸려 오면 그게 곧 소음이고, 소음은 읽히지 않아 침묵과 같은 값이 된다.
 *
 * ⚠ 이 축약 판은 `render()` 가 읽는 **모든** 절 키를 갖고 있어야 한다. 없는 키를 render 가
 *   `r.X.ok` 로 만지면 리포트 전체가 예외로 죽고, 출력은 「부패 점검기 자체가 실패했다」
 *   한 줄이 된다 — 배포 알림 자리에서 그건 침묵과 같다. `{ ok: false }` 는 「이 절은 안
 *   쟀다」는 뜻이고, 절을 늘리는 사람이 여기를 같이 안 늘리면 그 자리에서 터진다(08-10 실측). */
function 축만(r, 축들) {
  const 고른다 = (a) => a.filter((x) => 축들.some((k) => x[k]));
  const [red, warn, notes] = [고른다(r.red), 고른다(r.warn), 고른다(r.notes)];
  return {
    red, warn, notes,
    mem: { ok: false }, doc: { ok: false }, 장부: { ok: false },
    findings: red.length + warn.length + notes.length,
  };
}

/* ── 적색 하루 눌림 (2026-08-29 · ① 과 한 벌) ────────────────────────────────
 * 적색을 축에서 풀면 **매 세션 같은 소리**를 하게 되고, 우는 검사는 꺼진다(원칙 4). 그래서 같은
 * 적색은 하루 한 번만 말한다.
 *
 * 🔑 열쇠는 **메시지 전문이 아니다.** 전문을 열쇠로 쓰면 문구를 한 글자 고치는 날 하루 눌림이
 *   통째로 풀려 「어제 말한 것」이 새 건으로 다시 운다. 안정된 토막 = `kind` + 그 안의 **앞 경로 둘**.
 *   왜 하나가 아니라 둘인가(신설 당일 실측): 「깨진 참조」 본문은 `출처 → 과녁` 인데 첫 경로만 쓰면
 *   한 문서가 낸 서로 다른 깨짐 둘이 한 열쇠로 뭉쳐, 하나를 고쳐도 나머지가 그날 안 뜬다.
 *   경로가 없으면 `kind` **+ 본문 첫 낱말**로 센다 — `kind` 만 쓰면 절 열아홉이 공유하는
 *   「검사기 고장」이 한 열쇠로 뭉쳐, 오늘 둘째로 죽은 절이 조용히 눌린다(08-30 좁힘).
 *   그 kind 는 경로가 **있어도** 첫 낱말(= 절 이름)로 간다 — 아래 `부패키` 머리말.
 * ⚠ 표식(`배포`·`장부`)이 붙은 적색은 **여기 안 걸린다** — 그 둘은 각자 스로틀로 이미 눌려 있고,
 *   특히 장부 축(6시간)에 하루 눌림을 겹치면 cron 침묵 탐지가 6시간에서 하루로 늘어진다. */
const 눌림_보관일 = 7;
/* ⚠ 확장자 대안은 **긴 것부터**다. `js` 를 앞에 두면 `…/이름.jsonl` 이 `…/이름.js` 로 잘려
 *   `X.json` 과 `X.jsonl` 이 한 열쇠가 된다(08-30 실측 · Windows 오류 문면은 역슬래시라 앞
 *   갈래가 안 물고 이 갈래로 온다). */
const 경로꼴 = /[\w가-힣._-]+\/[\w가-힣./_-]+|[A-Za-z가-힣_][\w가-힣_-]*\.(?:jsonl|json|js|md|html|txt|tsv)/g;

function 그날(now) { return new Date(now).toLocaleDateString('sv-SE'); }

function 부패키(x) {
  const 본문 = String(x.text || '');
  const 첫낱말 = (본문.trim().split(/\s+/)[0] || '').slice(0, 40);
  /* 🔴 08-30 — 「검사기 고장」은 **경로 유무와 무관하게** 절 이름으로 가른다.
   * 절이 열아홉인데 이 kind 는 하나다: 오늘 A절이 죽어 도장이 찍힌 뒤 같은 날 B절이 죽으면
   * B가 조용히 눌린다 — 감시기가 자기 고장을 감추는 자리라 제일 나쁜 무늬다.
   * 🔴 08-30 좁힘의 좁힘: 첫 판은 「경로가 없을 때만」 첫 낱말로 갈랐는데, 그 문면은
   * `${절 이름} 검사가 실패했다 — ${오류}` 라 오류가 ENOENT 면 **경로가 딸려 온다**.
   * 그러면 경로 갈래로 새서 절 둘이 같은 파일에 걸려 죽는 날 다시 뭉쳤다(실측으로 재현).
   * 문면 앞머리는 절 이름이라 안정되고, 흔들리는 값(날짜·건수·로그줄·경로)은 뒤에 온다. */
  if (x.kind === '검사기 고장') return `${x.kind}|${첫낱말}`;
  const 경로들 = 본문.match(경로꼴) || [];
  if (경로들.length) return `${x.kind}|${경로들.slice(0, 2).join('>').slice(0, 120)}`;
  /* 경로가 없는 적색(예: 제미나이LM 자동 갱신 실패 — 본문이 날짜·로그줄이다)도 첫 낱말을 붙인다. */
  return `${x.kind}|${첫낱말}`;
}

/** 오늘 말한 적색을 도장에 얹고, 오래된 것은 걷는다(무한히 자라면 상태 파일이 곧 장부가 된다). */
function 눌림갱신(옛것, 적색들, 오늘, 지금 = Date.now()) {
  const 새것 = {};
  const 바닥 = 그날(지금 - 눌림_보관일 * 24 * 60 * 60 * 1000);
  for (const [k, v] of Object.entries(옛것 || {})) if (String(v) >= 바닥) 새것[k] = v;
  for (const x of 적색들) 새것[부패키(x)] = 오늘;
  return 새것;
}

/* 회차 장부 판정 — 네 갈래를 **다른 소리로** 낸다. 하나로 뭉치면 늘 우는 경보가 되고, 늘 우는
 * 경보는 꺼진다(F113). 오늘 정상인 상태(판 미적용)가 그 넷 중 하나라 특히 그렇다.
 * `장부Section`(부르기·파싱)과 갈라 둔 이유는 이 함수가 **네트워크 없이 픽스처로 재지는 층**이라서다. */
function 장부판정(v) {
  const red = [];
  const notes = [];
  for (const g of (v && v.결과) || []) {
    const 이름 = `${g.저장소}${g.과녁이름 ? `(${g.과녁이름})` : ''} 회차 장부`;
    /* 처방은 «그대로 돌아야» 처방이다 — 운영 항목의 cd 명령에 과녁 덮어쓰기를 함께 싣는다(F462 정본 통로). */
    const 전량 = `cd ../${g.저장소} && ${g.과녁이름 === '운영' && g.과녁 ? `SUPABASE_PROJECT_REF=${g.과녁} ` : ''}node tools/회차장부.js --자세히`;
    if (g.못잼) {
      // 미측정은 통과가 아니다 — 다만 적색도 아니다(네트워크가 한 번 끊긴 것과 cron 이 죽은 것은 다르다).
      notes.push({ kind: '회차 장부 미측정', text: `${이름} — ${g.사유}. 그쪽에서 직접: node tools/회차장부.js`, 장부: true });
      continue;
    }
    if (g.판정 === 2) {
      /* 🔑 그쪽 «판정 2» 안에 갈래가 둘이고 **처방이 다르다** — 뭉치면 둘 다 안 하게 된다:
       *   `판 === false` = 판을 열어 봤는데 없다   → 아래 ⏳ 갈래
       *   `판 === null`  = 판을 **열지도 못했다**(자격증명·네트워크) → 미측정. 조용하면 그 창이 통째로 사라진다. */
      if (g.판 !== false) {
        notes.push({ kind: '회차 장부 미측정', text: `${이름} — ${g.사유 || '판을 못 열었다'}. 그쪽에서 직접: node tools/회차장부.js`, 장부: true });
        continue;
      }
      /* 판이 아직 안 부어진 상태 = **오늘의 정상**이다(`20260815080000` 은 companion 승인 묶음에
       * 얹혀 부어진다 · ⏳유호). 여기서 6시간마다 적색을 내면 승인 날까지 거짓 경보만 쌓인다.
       * 🔑 다만 **한 번이라도 섰던 판이 사라진 것**은 전혀 다른 사건이라 적색으로 가른다 —
       *   래치가 없으면 그 사고가 「아직 안 부었네」와 같은 모양이 되어 영영 안 보인다. */
      if (v.섰던적) {
        red.push({
          kind: '회차 장부 판이 사라졌다',
          text: `${이름} — 전에는 \`ops.cron_runs\` 가 섰는데 지금 없다(${g.사유 || '판 미적용'}). `
            + 'cron 은 계속 도는데 장부만 사라진 상태다',
          장부: true,
        });
      }
      continue;
    }
    if (g.판정 === 1) {
      const 꼬리 = (g.최근이상 || []).slice(0, 3).map((x) => `${x.jobname}→${x.outcome}`).join(' · ');
      red.push({
        kind: g.안적힘 > 0 ? '회차 장부가 침묵했다' : 'cron 이 이상을 냈다',
        text: `${이름}(${g.과녁 || '과녁 모름'}) — ${g.안적힘 > 0
          ? `cron 은 돌았는데 안 적힌 회차 ${g.안적힘}건(장부가 안 불렸다 · 요약만 보면 안 보인다)`
          : `이상 ${g.이상}건${꼬리 ? ` — ${꼬리}` : ''}`}. 전량: ${전량}`,
        장부: true,
      });
    }
  }
  return { red, notes };
}

/* 「판이 한 번이라도 섰다」는 **래치**다 — 켜기만 하고 끄지 않는다. 끄는 순간 「판이 사라졌다」는
 * 사고가 「아직 안 부었다」와 같은 모양이 되어 다음 회차부터 영영 안 보인다(그게 이 축을 만든 병). */
function 장부도장(v) {
  return (v.결과 || []).some((g) => g.판 === true) ? { 장부섰나: true } : {};
}

/* 장부 도장 패치 — **스로틀 시계와 래치를 가른다.** 하나로 묶었더니 스로틀이 조용히 리셋됐다
 * (①배포 검수 P1 · F541 트랙). 순수 함수로 떼어 둔 이유는 훅 경로가 형제 저장소를 스폰해서
 * 그 안에선 이 불변식을 «네트워크 없이» 못 재기 때문이다(F296 — 탐지는 픽스처가 진다).
 *   · `장부: now` = 6시간 스로틀의 «시계». 자기 차례였던 실행에만 찍는다.
 *   · `장부섰나` = 「한 번이라도 판이 섰다」 **래치**. 단조 증가라 차례와 무관하게 잰 김에 찍는다.
 * ⚠ 빈 객체를 내면 **부르는 쪽이 stamp 를 아예 건너뛴다** — 빈 패치로 찍으면 최상위 `at` 만
 *   갱신돼 「오늘 점검이 돌았다」로 읽히고 그날 점검이 통째로 사라진다(F482 가 밟은 함정). */
function 장부패치(장부차례, v, now) {
  return { ...(장부차례 ? { 장부: now } : {}), ...장부도장(v) };
}

/* ── 진입점 ──────────────────────────────────────────────────────────────── */
function main() {
  const args = process.argv.slice(2);
  const isHook = args.includes('--hook');
  /* 라이브 대조는 **사람이 부른 실행에서만** 돈다 — `collect()` 기본값이 꺼짐인 이유와 같다.
   * 여기서 켜는 것이 이 장치의 발동 조건이다(장치와 발동 조건은 같은 커밋 · CLAUDE.md 신뢰성). */
  const 라이브 = process.env.SYNK_ROT_LIVE !== '0';
  /* 회차 장부도 같은 문을 둔다 — 회귀·CI 는 네트워크를 안 탄다(그 자리 탐지력은 픽스처가 진다 · F296).
   * ⚠ 끄는 것과 배선이 사라진 것은 다르다 — 배선 자체는 `tests/부패점검.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 등록층 검사가 본다. */
  const 장부켬 = process.env.SYNK_ROT_LEDGER !== '0';

  if (isHook) {
    // 훅은 무슨 일이 있어도 세션을 방해하지 않는다: 항상 exit 0, 예외는 통째로 삼킨다.
    // 단 **삼키되 감추지는 않는다** — 검사기가 고장 났으면 그 사실을 알린다.
    // (침묵으로 죽는 장치를 잡으려고 만든 도구가 침묵으로 죽으면 아무 의미가 없다.)
    try {
      const now = Date.now();
      const 강제 = args.includes('--force');
      const 주간 = 강제 || dueNow(now);
      const 배포차례 = 강제 || dueNow(now, '배포', 배포_주기_일);
      /* 🔑 꺼져 있으면 **차례도 아니다.** 안 그러면 도장을 영영 못 찍어(측정 안 했으니) 이 축이
       *   스로틀 문을 매 세션 열어 둔 채가 되고, 나머지 두 축의 스로틀이 통째로 무의미해진다. */
      const 장부차례 = 장부켬 && (강제 || dueNow(now, '장부', 장부_주기_일));
      /* 🔴 08-29 — **여기 있던 조기 반환을 걷었다.** 옛 판은 세 축 중 하나도 차례가 아니면
       *   `collect()` 를 아예 안 불렀다. 그러면 적색을 축에서 푸는 것이 무의미하다 — 재지도 않은
       *   적색은 통과시킬 수가 없다. 이제 **저장소 층은 늘 잰다**(실측 1.1초 · 네트워크 0).
       *   값비싼 갈래는 그대로 자기 차례에 묶는다:
       *     · 라이브(clasp pull · 12.4초) = 주간·배포 차례
       *     · 회차 장부(형제 스폰 + HTTP) = 세 축 중 하나라도 차례일 때
       *   비차례 세션의 몫은 저장소 스캔 하나뿐이고, 그 값으로 적색이 최대 7일 숨던 구멍을 닫는다. */
      const 어느축이든 = 주간 || 배포차례 || 장부차례;
      /* 여기까지 왔으면 둘 중 하나는 차례다 — 그러면 **재는 건 늘 잰다.** 「배포 차례일 때만
       * 켠다」로 좁혔더니, 주간만 차례인 날 주간 리포트가 「라이브 미측정」이라는 거짓 메모를
       * 달았다(몇 시간 전에 쟀는데도). 아낄 값은 주 1회 12초뿐이라 아낄 이유가 없다. */
      /* 🔴 라이브 대조(clasp pull · 실측 12.4초)는 **자기 차례일 때만** 켠다. 장부 축이 6시간이라
       *   그냥 두면 하루 네 번 clasp 를 당기게 되고, 그 비용은 이 축이 막으려는 손실보다 크다.
       *   위 「재는 건 늘 잰다」와 어긋나지 않는다 — 그 문장의 분모는 «주간·배포 둘» 이었다. */
      const r = collect({ 라이브: 라이브 && (주간 || 배포차례), 시간제한: 배포_대조_한도, 장부: 장부켬 && 어느축이든 });
      if (주간) stamp(now, { last: now, findings: r.findings });
      /* 장부 도장도 **실제로 잰 실행에만** 찍는다(배포 도장과 같은 축) — 못 잰 6시간에 찍으면
       * 그 창이 조용히 사라진다. `측정:false` 는 「차례가 아니었다」이고 여기 오지 않는다.
       * 🔴 그리고 도장을 **둘로 가른다** — 하나로 묶었더니 스로틀이 조용히 리셋됐다(①배포 검수 P1):
       *   · `장부: now` = 6시간 스로틀의 «시계». **자기 차례였던 실행에만** 찍는다. 주간·배포 차례로
       *     들어온 날에도 찍으면, 아래 `볼것` 이 장부 축을 걸러내므로 지적이 «측정·도장까지 되고
       *     보고만 안 된 채» 창이 리셋된다 ⇒ cron 침묵 탐지가 6시간에서 하루로 늘어진다.
       *   · `장부섰나` = 「한 번이라도 판이 섰다」 **래치**. 단조 증가(false→true 뿐)라 차례와 무관하게
       *     잰 김에 찍는다 — 차례에 묶으면 비차례 창에서 섰다 사라진 판을 영영 못 가르고,
       *     그러면 `장부판정` 의 «판이 사라졌다» 적색이 조용히 죽는다(래치가 그 적색의 전제다).
       * ⚠ 빈 패치로 `stamp` 를 부르지 않는다 — 패치가 비어도 최상위 `at` 은 갱신돼(그 함수는 늘 쓴다)
       *   「오늘 점검이 돌았다」로 읽히고 그날 점검이 통째로 건너뛰어진다(F482 가 밟은 그 함정). */
      if (r.장부.ok && r.장부.value.측정) {
        const 패치 = 장부패치(장부차례, r.장부.value, now);
        if (Object.keys(패치).length) stamp(now, 패치);
      }
      /* 배포 도장은 **실제로 잰 날에만** 찍는다(차례였는지가 아니라 쟀는지가 재료다) — 못 잰 날에
       * 찍으면 그 하루가 조용히 사라지고, 그게 이 항목을 하루로 떼어낸 이유(F244)를 무효로 만든다. */
      if (r.dep.ok && r.dep.value.측정) stamp(now, { 배포: now, ...배포도장(now, r.dep.value) });
      /* 🔴 08-29 — **적색은 축에 안 갇힌다.** 옛 판은 축 표식이 없는 적색을 `축만()` 이 전부 걸러
       *   주간 도장이 열릴 때까지(최대 7일) 감췄다. 실측 그날: 적색 11건 중 표식이 붙은 것 0건 —
       *   즉 열하나가 통째로 안 보였고, 그 안에 「검사기 고장」과 「유호님 화면이 틀렸다」가 들어갈
       *   자리였다. 대신 같은 적색은 하루 한 번만 말한다(위 `눌림갱신` 머리말). */
      const 오늘 = 그날(now);
      const 옛눌림 = 상태().말한 || {};
      let 볼것 = r;
      if (!주간) {
        볼것 = 축만(r, [배포차례 && '배포', 장부차례 && '장부'].filter(Boolean));
        const 이미 = new Set(볼것.red);
        const 더할것 = r.red.filter((x) => !이미.has(x) && !x.배포 && !x.장부
          && (강제 || 옛눌림[부패키(x)] !== 오늘));
        볼것.red = [...볼것.red, ...더할것];
        볼것.findings = 볼것.red.length + 볼것.warn.length + 볼것.notes.length;
      }
      /* 도장은 **본 것에만** 찍는다 — 안 보여 준 적색을 「말했다」로 적으면 그 건이 하루 사라진다.
       * 주간 판도 여기서 찍는다: 안 찍으면 같은 날 여섯 시간 뒤 장부 실행이 같은 열하나를 또 낸다. */
      const 눌릴것 = 볼것.red.filter((x) => !x.배포 && !x.장부);
      if (눌릴것.length) stamp(now, { 말한: 눌림갱신(옛눌림, 눌릴것, 오늘, now) });
      if (!볼것.findings) return; // 정지 조건 — 깨끗하면 한 글자도 넣지 않는다
      const 라벨 = 주간 ? '주간 부패 점검'
        : [배포차례 && '라이브 배포 대조(하루)', 장부차례 && '회차 장부 대조(6시간)', 볼것.red.length && '적색(축 무관 · 하루 1회)']
          .filter(Boolean).join(' + ');
      const body =
        `[rot-check · ${라벨}] 이 저장소의 「조용한 부패」 자동 점검 결과다.\n` +
        render(볼것) +
        '\n\n※ 이건 지시가 아니라 관측이다. 지금 트랙과 무관하면 유호님께 한 줄로 알리고 넘어가라.' +
        ' 고칠 때는 해당 도구(tools/memory-graph.js · doc-graph.js · friction.js)를 직접 볼 것.';
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: body },
      }));
    } catch (e) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: `[rot-check] 부패 점검기 자체가 실패했다 — ${(e && e.message) || e}. tools/rot-check.js 확인 필요.`,
        },
      }));
    }
    return;
  }

  const r = collect({ 라이브, 장부: 장부켬 });

  if (args.includes('--json')) {
    console.log(JSON.stringify({
      findings: r.findings, red: r.red, warn: r.warn, notes: r.notes,
      memory: r.mem.ok ? r.mem.value : { error: r.mem.error },
      doc: r.doc.ok ? r.doc.value : { error: r.doc.error },
      friction: r.fri.ok ? { open: r.fri.value.open.length, total: r.fri.value.total } : { error: r.fri.error },
      harness: r.har.ok ? r.har.value : { error: r.har.error },
      장부: r.장부.ok ? r.장부.value : { error: r.장부.error },
      // 신설 절 다섯 — **잰 값을 그대로 싣는다.** 적색·경고가 0건일 때 「정말 0인가」를 여기서 본다
      // (0건이 성공 얼굴을 못 하게 하는 자리 · `측정:false` 면 사유가 같이 실린다).
      이름부름: r.이름.ok ? { ...r.이름.value, 없는것: (r.이름.value.없는것 || []).slice(0, 40) } : { error: r.이름.error },
      남은손: r.남은손.ok ? r.남은손.value : { error: r.남은손.error },
      상주총량: r.상주.ok ? r.상주.value : { error: r.상주.error },
      게이트초: r.게이트.ok ? r.게이트.value : { error: r.게이트.error },
      밤굽기도장: r.밤굽기.ok ? r.밤굽기.value : { error: r.밤굽기.error },
    }, null, 2));
    process.exit(r.red.length ? 1 : 0);
  }

  if (!r.findings) {
    if (!args.includes('--quiet')) console.log('[rot-check] ✅ 부패 없음 — 깨진 링크·낡은 인용·미해소 마찰 0건');
    return;
  }

  // 현지 날짜로 찍는다 — UTC로 찍으면 오전에 「어제」가 나와 로그를 읽는 사람이 판을 헷갈린다.
  console.log(`\n[rot-check] ${new Date().toLocaleDateString('sv-SE')}`);
  console.log(render(r));
  console.log('');
  process.exit(r.red.length ? 1 : 0);
}

if (require.main === module) main();
/* `stamp` 는 **일부러 안 내보낸다.** 인프로세스로 부르면 `SYNK_ROT_STATE` 가 없는 한
 * 실저장소 `.claude/state/rot-check.json` 에 `{findings:0}` 을 찍고, 그러면 이 저장소의
 * 주간 부패 점검이 7일간 침묵한다 — 🔴 를 든 채로. 2026-08-07 실측: 회귀 한 줄이
 * 하루에 세 번(10:04·10:11·10:13) 그 도장을 찍었고 테스트는 내내 초록이었다.
 * 쓰기 실패 내성은 서브프로세스(`SYNK_ROT_STATE`=못 쓰는 경로)로 검사한다. */
/* `뒤커밋들` 을 내보내는 이유 (2026-08-09 · F289): 같은 계산이 `tools/대기열.js(⚠삭제됨 39019553 2026-08-20 — 지금 없다)` 에도 필요해져
 * **두 번째**가 됐다. 특히 저 안의 **1초 밀기**는 실측으로만 아는 규칙이라(F062 계열) 두 곳에
 * 적으면 한쪽이 조용히 옛 규칙으로 남고, 증상은 「갱신했는데 계속 운다」 아니면 「아직인데
 * 조용하다」 — 둘 다 침묵을 닮았다. 그래서 베끼지 않고 **이 한 벌을 빌려 쓴다**(회귀는
 * tests/절단문서.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다) ③ 이 그대로 진다). ⚠ 시각은 안 돌려준다 — 부르는 쪽은 `--since` 로
 * 이미 걸러진 목록을 받으므로 필요 없다. */
module.exports = { collect, render, dueNow, stateFile, harnessSection, toilSection, mapSection, 절단문서Section, 뒤커밋들, 배포Section, 배포도장, 편집중인가, EVOLVE_THRESHOLD, 마지막개정, frictionSection, 장부Section, 장부판정, 장부도장, 장부패치, 축만, 장부_주기_일,
  // 08-29 신설 — 회귀가 픽스처로 재는 자리들(탐지력은 실물이 아니라 픽스처가 진다 · F296).
  이름부름Section, 남은손Section, 상주Section, 게이트Section, 밤굽기Section, 부패키, 눌림갱신, 그날, 상주선언, 게이트_중앙값_한도_ms };
