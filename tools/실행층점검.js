#!/usr/bin/env node
/* 실행층점검 — 「배포 뒤 1회 실행」이 필요한 변경을 배포 시점에 스스로 말하게 한다 (F081)
 *
 * 실사고 2026-08-04 [v9.181]: 회귀 17건·변이 15/15 가 **전부 초록인 채로** 라이브가 예외를 던졌다.
 *   `moveItem(item, toIndex)` 오버로드는 제네릭 Item 을 받는데 `addTextItem()` 이 돌려주는 건
 *   TextItem 이라 "The parameters (FormApp.TextItem,number) don't match the method signature" 로 죽었다.
 *
 * 🔑 재는 층이 달랐다. 이 저장소의 폼 검사는 **전부 소스 텍스트층**이고(tests/마감폼 머리말이
 *   "시트·FormApp 의존이라 실행 불가"라고 적어 뒀다), API 시그니처는 **실행해야만 보이는 층**이다.
 *   더 나쁜 건 실패 지점이었다 — addTextItem 은 이미 성공한 뒤라 라이브 폼에 칸이 엉뚱한 자리에
 *   남았고, 「새로 넣는 경로에서만 자리를 잡는」 설계로는 그 폼이 **영영 안 고쳐졌다**(멱등이 수렴이 아니었다).
 *
 * 그래서 F081 의 결론은 「회귀를 더 짜라」가 아니었다:
 *   **폼·드라이브처럼 실행층에서만 드러나는 API 는 배포 뒤 1회 실행이 유일한 검증이다.**
 * 프로즈로 두면 다음 배포에서 잊는다. 그래서 이 도구가 **배포 게이트에서 스스로 발화**한다
 * (clasp-guard 통과 직전 — 배포 통로가 `/deploy` 하나뿐이라 그 한 자리가 전부다). 차단이 아니라 **할 일 목록**이다 —
 * 배포를 막으면 실행 자체가 불가능해지므로 여기서 막는 건 뜻이 없다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.env.SYNK_EXEC_ROOT || path.resolve(__dirname, '..');

/* 실행해야만 드러나는 서비스 — 스텁으로 흉내 낼 수 없거나, 흉내 내면 **시그니처가 안 맞는 걸 놓치는** 것들.
 * 🔑 목록은 여기 하나뿐이다. 회귀도 이 배열을 require 해서 센다(두 곳에 적으면 갈라진다). */
const API목록 = [
  ['FormApp', '폼 — 문항 추가·이동·삭제는 오버로드가 실행 시점에만 갈린다(F081 이 난 자리)'],
  ['DriveApp', '드라이브 — 권한·공유 범위는 실제 파일에서만 확인된다'],
  ['DocumentApp', '문서 — 본문 조작은 실행해야 자리가 보인다'],
  ['CalendarApp', '캘린더 — 이벤트 생성·수정'],
  ['GmailApp', '지메일 — 발송·라벨'],
  ['MailApp', '메일 발송'],
  ['ScriptApp', '트리거 — 설치·삭제는 프로젝트 상태를 바꾼다'],
];

const 코드파일 = /\.(js|gs)$/i;

const 겹치나 = (집합, a, b) => {
  for (const n of 집합) if (n >= a && n <= b) return true;
  return false;
};

/* 주석을 **줄 수를 보존한 채** 지운다.
 * 왜 필요한가: 이 저장소는 주석에 코드를 그대로 인용한다(이 파일 머리말도 FormApp 을 여러 번 적는다).
 *   줄머리만 보고 거르면 `/* FormApp.openById …` 처럼 블록이 열리는 첫 줄을 놓쳐 **자기 문서가
 *   영원한 오탐**이 된다 — 실제로 회귀가 그렇게 잡았다. 줄 수를 보존하는 이유는 아래 판정이
 *   전부 줄 번호(변경 줄·함수 구간)로 돌기 때문이다. 한 줄만 밀려도 엉뚱한 함수를 가리킨다. */
/* 🔑 [2026-08-13] 지역 사본 → 공용 통로(F401 계열 · 대기열 P3 줄73).
 *   **`줄맞춰코드만` 이어야 한다** — 위 머리말대로 이 파일의 판정이 전부 줄 번호로 돈다.
 *   `코드만` 은 주석만 있던 줄을 «버려서» 함수 구간이 통째로 밀린다.
 *   옛 판의 `(^|[^:])` 는 `https://` 만 지키는 어림법이었다 — 공용 렉서는 문자열·정규식
 *   리터럴 «안»을 원리적으로 안 건드리므로 `'// 주석처럼 생긴 문자열'` 까지 함께 산다.
 *   ⚠ 열 위치는 안 지킨다(옛 판은 지켰다). 여기 소비자는 줄 단위 정규식뿐이라 무해하다. */
const { 줄맞춰코드만: 주석지우기 } = require('../tests/lib/소스검사.js');

/** 함수 선언 줄 목록 — 한 함수의 구간은 [자기 시작, 다음 함수 시작 - 1] 로 잡는다.
 *  중괄호를 세지 않는 이유: 문자열·정규식 안의 괄호까지 정확히 세려면 파서가 필요한데,
 *  이건 「배포 뒤 무엇을 실행할지」를 고르는 용도라 구간이 조금 넓어도 해가 없다.
 *
 * 🔴 **안쪽 헬퍼는 구간을 열지 않는다**(들여쓰기 0 만 센다). 실측 [v9.184]: `systemWatchdog`
 *   안의 변경을 보고 **`add()` 를 실행하라**고 답했다 — `add` 는 그 함수 **안쪽** 보조 함수(340행)라
 *   Apps Script 편집기 ▶ 로 부를 수가 없다. 게다가 같은 파일에 `add` 가 둘(340·751)이라 이름만으론
 *   어느 쪽인지도 모른다. **실행하라는 지시가 실행 불가능한 이름을 가리키면 그 목록은 안 읽힌다** —
 *   이 도구의 존재 이유가 「읽히는 체크리스트」인데 거기서 무너진다.
 *   안쪽 선언이 구간을 열면 바깥 함수의 구간이 **첫 헬퍼 직전에서 끊겨**, 본문 대부분이
 *   헬퍼 이름으로 귀속된다(넓게 잡는 건 해가 없지만 **엉뚱한 이름으로** 잡는 건 해가 있다). */
function 함수구간(줄) {
  const 시작 = [];
  for (let i = 0; i < 줄.length; i++) {
    /* ⚠ 식별자를 ASCII 로 적으면 이 저장소에선 **아무것도 못 찾는다** — 함수 이름이 한글이다
     *   (`면접URL틀보증_`·`궤적갱신_`). 처음에 `\w` 로 짰다가 F081 이 난 그 커밋을 미탐했다.
     *   가드는 **사람이 실제로 쓰는 표기로** 검사한다(CLAUDE.md 가드 맹점 ①). */
    const m = 줄[i].match(/^([ \t]*)(?:async\s+)?function\s+([\p{L}_$][\p{L}\p{N}_$]*)/u)
      || 줄[i].match(/^([ \t]*)(?:const|let|var)\s+([\p{L}_$][\p{L}\p{N}_$]*)\s*=\s*(?:async\s*)?(?:function|\()/u);
    if (m && m[1].length === 0) 시작.push({ 이름: m[2], 줄: i });
  }
  return 시작.map((s, k) => ({
    이름: s.이름,
    s: s.줄,
    e: k + 1 < 시작.length ? 시작[k + 1].줄 - 1 : 줄.length - 1,
  }));
}

/**
 * 한 파일에서 실행층 API 호출을 찾아 **감싸는 함수 이름**과 함께 돌려준다.
 * 🔴 `바뀐줄` 을 주면 **그 함수 안에 변경이 있을 때만** 담는다.
 *   왜: 파일 하나만 건드려도 그 파일의 모든 API 호출을 늘어놓으면 목록이 길어지고,
 *   긴 목록은 읽히지 않는다 — 안 읽히는 체크리스트는 없는 것과 같다.
 */
function 파일훑기(절대경로, 표시이름, 바뀐줄) {
  let src;
  try { src = fs.readFileSync(절대경로, 'utf8'); } catch (_) { return []; }
  const 줄 = 주석지우기(src).split('\n');
  const 구간 = 함수구간(줄);
  const 결과 = [];
  const 본것 = new Set();
  for (let i = 0; i < 줄.length; i++) {
    for (const [api, 왜] of API목록) {
      if (!new RegExp(`\\b${api}\\s*\\.`).test(줄[i])) continue;
      const f = 구간.find((x) => i >= x.s && i <= x.e);
      if (바뀐줄 && !(f ? 겹치나(바뀐줄, f.s + 1, f.e + 1) : 바뀐줄.has(i + 1))) continue;
      const 함수 = f ? f.이름 : '(톱레벨)';
      const 키 = `${표시이름}|${함수}|${api}`;
      if (본것.has(키)) continue;
      본것.add(키);
      결과.push({ 파일: 표시이름, 함수, api, 왜, 줄: i + 1 });
    }
  }
  return 결과;
}

/* ⚠ `-c core.quotePath=false` 는 장식이 아니다.
 *   이 저장소의 엔진 파일 이름은 한글이다(`엔진_폼리포트.js`). 기본 설정의 git 은 목록에서
 *   그걸 `"\354\227\224..."` 로 이스케이프해 뱉고, 그 문자열로는 파일을 못 연다 →
 *   **읽기 실패가 「해당 없음」으로 보인다.** 실제로 이 도구를 처음 돌렸을 때 F081 이 난
 *   바로 그 커밋을 「실행층 API 변경 없음」이라고 답했다(CLAUDE.md 「재는 층이 값을 깨뜨리지
 *   않는지 본다」의 실측 사례). 새는 방향은 여기서도 통과였다. */
function git(args) {
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** 범위에서 그 파일의 **바뀐 줄 번호**(새 파일 기준). -U0 이라 문맥 줄이 안 섞인다. */
function 바뀐줄들(range, 파일) {
  let d;
  try { d = git(['diff', '-U0', range, '--', 파일]); } catch (_) { return null; }
  const out = new Set();
  const re = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
  let m;
  while ((m = re.exec(d))) {
    const 시작 = Number(m[1]);
    const 개수 = m[2] === undefined ? 1 : Number(m[2]);
    for (let i = 0; i < 개수; i++) out.add(시작 + i);
  }
  return out;
}

/**
 * @param {{range?:string, files?:string[], 프로젝트?:string}} opt
 * @returns {{항목:object[], 범위:string, 기준:string, 잰것:boolean}}
 */
function 훑기(opt = {}) {
  let files = opt.files;
  let 범위 = opt.range || '';
  let 기준 = '지정된 파일 목록(변경 줄을 모르므로 파일 전체를 본다)';
  const 범위모드 = !files;

  let 자동범위 = false;
  if (범위모드) {
    if (!범위) {
      // 직전 배포 기준점이 없으면 **마지막 커밋만** 본다 — 그 사실을 숨기지 않는다
      범위 = 'HEAD~1..HEAD';
      자동범위 = true;
      기준 = '직전 배포 기준점이 없어 **마지막 커밋만** 봤다(더 넓게 보려면 --range 로 준다)';
    } else {
      기준 = `범위 ${범위}`;
    }
    try {
      /* 🔴 09-05: `core.quotepath` 를 안 끄면 git 이 비ASCII 파일 이름을 8진수로 이스케이프해 내놓는다
       *   (원격 실측: `"contents_\354\203\201\353\213\264AI.js"`). 이 저장소는 배포 파일 열여덟 중
       *   대부분이 한글 이름이라, 그대로 두면 아래 층이 «그 파일을 못 알아본다» — 실행층이 바뀌었는데
       *   「안 바뀌었다」로 읽히는 방향이라 새는 쪽이 하필 조용하다. 로컬 git 설정이 이미 꺼 둔 기계에서는
       *   안 터지므로(이 노트북이 그렇다) 원격에서만 갈린다. 같은 사고를 tests/이종검수.test.js 가 먼저 물었다. */
      files = git(['-c', 'core.quotepath=false', 'diff', '--name-only', 범위])
        .split('\n').map((s) => s.trim()).filter(Boolean);
    } catch (e) {
      return {
        항목: [], 범위, 잰것: false, 자동범위,
        기준: `범위(${범위})를 읽지 못했다 — ${String((e && e.message) || e).split('\n')[0]}`,
      };
    }
  }

  const 프로젝트 = opt.프로젝트 ? path.resolve(opt.프로젝트) : null;
  const 항목 = [];
  for (const f of files) {
    if (!코드파일.test(f)) continue;
    if (/(^|[\\/])(tests|tools|\.claude)[\\/]/.test(f)) continue; // 라이브에 안 올라가는 것은 대상이 아니다
    const abs = path.isAbsolute(f) ? f : path.join(ROOT, f);
    if (프로젝트 && path.resolve(abs) !== 프로젝트 && !path.resolve(abs).startsWith(프로젝트 + path.sep)) continue;
    항목.push(...파일훑기(abs, f, 범위모드 ? 바뀐줄들(범위, f) : null));
  }
  return { 항목, 범위, 기준, 잰것: true, 자동범위 };
}

/* 「무엇만 봤는지」 한 줄 — **초록·적색이 같은 문구를 쓴다.**
 *
 * 왜 함수인가(2026-08-05 실측): 이 사실이 두 곳에 각각 적혀 있었고 문구가 갈라져 있었다 —
 * 초록 경로는 「… 만 봤다」, 적색 경로는 「기준: …」. 회귀는 초록 문구만 알아서, 실행층 API 가
 * 실제로 든 정상 커밋을 만나자 **도구는 옳게 동작했는데 테스트가 빨개졌다**(그리고 그 적색이
 * 배포 게이트를 막았다). CLAUDE.md 「같은 판정을 두 곳에 적으면 갈라진다 — 목록은 하나에서 파생시킨다」. */
function 범위주석(r) {
  return r.자동범위
    ? `${r.범위} 만 봤다 — 직전 배포 기준점이 없어 마지막 커밋만이다. 배포 범위가 더 넓으면 --range 로 다시 재라.`
    : `기준: ${r.기준}`;
}

/** 사람이 읽는 체크리스트. 항목이 없으면 빈 문자열(조용). */
function 체크리스트(r) {
  if (!r.잰것) {
    return `[실행층점검] ⚠ ${r.기준} — **검사하지 않았다.** 통과와 미실행을 같은 모양으로 두지 않는다.`;
  }
  if (!r.항목.length) return '';
  const 묶음 = new Map();
  for (const it of r.항목) {
    const k = `${it.파일} · ${it.함수}()`;
    if (!묶음.has(k)) 묶음.set(k, new Set());
    묶음.get(k).add(it.api);
  }
  return [
    '[실행층점검] 🔴 이 배포에는 **실행해야만 드러나는 API** 가 있다 — 배포 뒤 라이브에서 1회 실행할 것 (F081)',
    `  ${범위주석(r)}`,
    '',
    '  ▼ 실행할 함수(Apps Script 편집기 ▶ 또는 시트 메뉴)',
    ...[...묶음.entries()].map(([k, apis]) => `  · ${k} — ${[...apis].join(', ')}`),
    '',
    ...[...new Set(r.항목.map((it) => `  ${it.api}: ${it.왜}`))],
    '',
    '  🔑 F081: 회귀 17건·변이 15/15 가 전부 초록인 채로 라이브가 죽었다. 이 저장소의 폼 검사는',
    '     전부 소스 텍스트층이고 API 시그니처는 실행층이다 — 재는 층이 다르면 초록은 증거가 아니다.',
    '     더 나쁜 건 실패 지점이었다: 앞 호출이 이미 성공한 뒤라 라이브에 반쯤 만든 상태가 남았고,',
    '     「새로 넣을 때만 자리를 잡는」 설계라 재실행해도 안 고쳐졌다(멱등이 수렴이 아니었다).',
    '     → 실행 결과를 **눈으로 확인**하고, 두 번 돌려 같은 상태로 수렴하는지까지 본다.',
  ].join('\n');
}

/* 🔴 인자를 **모르면 막는다.** 실측 [v9.184]: `--from` 이라고 잘못 줬더니 조용히 무시되고
 *   기본값(마지막 커밋)으로 떨어졌는데, 화면엔 「실행층 전용 API 변경 없음」이라는 **초록 한 줄**이
 *   그대로 나왔다 — 나는 그걸 믿었다. 이 파일 머리말이 「통과와 미실행을 같은 모양으로 두지 않는다」고
 *   적어 둔 바로 그 위반이다(오타 하나가 배포 점검을 통째로 거짓 초록으로 만든다).
 *   값을 받는 플래그의 **다음 토큰은 값**이라 검사에서 건너뛴다(`--range HEAD~1..HEAD` 의 범위 문자열). */
const 값플래그 = ['--range', '--files', '--프로젝트', '--project'];
const 단독플래그 = ['--quiet'];
function 인자검사(argv) {
  const 모름 = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (값플래그.includes(t)) { i++; continue; }
    if (단독플래그.includes(t)) continue;
    모름.push(t);
  }
  return 모름;
}

module.exports = { API목록, 훑기, 체크리스트, 범위주석, 파일훑기, 함수구간, 주석지우기, 인자검사, 값플래그, 단독플래그 };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const 모름 = 인자검사(argv);
  if (모름.length) {
    process.stderr.write(`[실행층점검] ⚠ 모르는 인자: ${모름.join(' ')}\n`
      + `  쓸 수 있는 것: ${값플래그.join(' ')} (값 1개씩) · ${단독플래그.join(' ')}\n`
      + '  **검사하지 않았다.** 조용히 기본값으로 떨어지면 오타 하나가 거짓 초록이 된다(F081 계열).\n');
    process.exit(2);
  }
  const 값 = (이름) => {
    const i = argv.indexOf(이름);
    return i > -1 ? argv[i + 1] : undefined;
  };
  const r = 훑기({
    range: 값('--range'),
    files: 값('--files') ? 값('--files').split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    프로젝트: 값('--프로젝트') || 값('--project'),
  });
  const 글 = 체크리스트(r);
  if (글) process.stdout.write(글 + '\n');
  else if (!argv.includes('--quiet')) {
    /* 🔑 항목이 0건일 때야말로 **무엇을 쟀는지** 같이 말해야 한다. 예전엔 여기서 기준을 버려서,
     *   「마지막 커밋만 봤다」는 사실이 **하필 초록일 때만** 사라졌다(경고가 필요한 바로 그 경우다). */
    process.stdout.write('[실행층점검] 실행층 전용 API 변경 없음 — 배포 뒤 필수 실행 없음. '
      + (r.자동범위 ? '⚠ 단 ' : '') + 범위주석(r) + '\n');
  }
  process.exit(0);
}
