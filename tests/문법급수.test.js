/**
 * **TOPIK 급수 태그 회귀 — `GRAMMAR_BANK` 칸 4·5·6이 정본과 갈라지지 않는다.**
 *
 * 왜 기계로 막나 (유호님 확정 2026-08-12 갈래㉡): 「레벨별 교재 진도에 맞게 TOPIK을 앱에 반영한다」의
 *   첫 고리가 급수 태그다. 이 태그는 두 정본에서 파생된다 — 레벨↔급 대응은 `docs/커리큘럼_정본_v1.md`
 *   v1.2 ⓪표, 문형별 급수는 같은 문서 §3 문법 요목([도입]/[심화]/[확장] 태그). **파생물은 원본이
 *   개정되면 조용히 낡는다.** 낡은 급수 태그는 「Lv3 학생에게 1급 문항만 나가는」 상태를 만들면서
 *   화면에는 아무 표시도 안 낸다 — 미실행과 통과가 같은 모양이 되는 그 자리다.
 *
 * 구조 (CLAUDE.md 가드 3맹점):
 *   ①**탐지력은 픽스처가 진다** — 실저장소가 초록인 것만으로는 검사가 도는지 알 수 없어서,
 *     망가진 뱅크 6모양을 만들어 검사가 실제로 잡는지 여기서 실증한다.
 *   ②**실저장소에는 거짓양성만** 검사한다 — 값 계약 + 정본 동기화. 「버그가 아직 있을 것을 요구」하지 않는다.
 *   ③**자기 처방을 막지 않는지** — 실패 메시지가 시키는 것(정본을 열어 대조)이 실제로 가능한 지시다.
 *
 * ⚠ 이 파일은 「어느 문형이 몇 급인가」를 스스로 판정하지 않는다 — 그것은 교육 전문 영역이고,
 *   여기가 하는 일은 **뱅크가 자기 근거(`요`/`표`)와 모순되지 않는지**만 보는 것이다.
 *   `요`(요목 직결)라고 적어 놓고 정본에 그 문형이 없으면 그게 결함이다. `표`(표준 배정)는
 *   정본 밖 근거라 문형 실재를 요구하지 않는다 — 교재 6권 확정 시 재검토할 대상이라는 표시다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
/* 부정 단언의 주어만 정제한다 — 주석이 금지 패턴을 «설명»하면 그 설명이 위반으로 잡힌다(대기열 #Q72). */
const { 코드만 } = require('./lib/소스검사.js');
const { ROOT, engineSource } = require('./_engine-source');
const { 뱅크읽기 } = require('../tools/lib/문법뱅크.js');

const code = engineSource();
const 커리큘럼 = fs.readFileSync(path.join(ROOT, 'docs', '커리큘럼_정본_v1.md'), 'utf8');

/* 상수 실값 로드 — 테스트가 값을 하드코딩하면 정본이 바뀔 때 검사만 조용히 낡는다(safety.test.js groupConsts와 같은 축).
 * 🔑 자르는 규칙은 **여기 안 적는다** — 계약 생성기(`tools/문법급수계약.js`)가 같은 구간을 자르므로
 *   둘이 각자 앵커를 들면 한쪽만 낡고, 낡은 쪽은 「엉뚱한 구간을 조용히 통과」로 샌다(2026-08-12 통로 1벌). */
const 뱅크상수 = () => 뱅크읽기(code);

/* 뱅크 한 벌을 값 계약으로 검사한다 — 실저장소와 픽스처가 **같은 함수**를 지난다.
 * 두 벌로 적으면 픽스처만 통과하는 검사가 생기고, 그건 탐지력 실증이 아니라 알리바이다.
 * @returns {string[]} 위반 메시지 (빈 배열 = 통과) */
function 위반들(bank) {
  const out = [];
  const 본ID = new Set();
  bank.forEach((g, i) => {
    const 자리 = `${g && g[0] ? g[0] : `#${i}`}`;
    if (!Array.isArray(g) || g.length !== 6) { out.push(`${자리}: 칸이 6개가 아니다(${g && g.length})`); return; }
    if (본ID.has(g[0])) out.push(`${자리}: ID 중복`);
    본ID.add(g[0]);
    const [, , , 도입, 재출현, 근거] = g;
    // 도입급 — 6급은 «없어야 한다». 자체 콘텐츠 상한이 5급이다(커리큘럼 v1.2 ⓪ · 「6급 반은 열지 않는다」).
    if (!Number.isInteger(도입) || 도입 < 1 || 도입 > 5) out.push(`${자리}: 도입급이 1~5가 아니다(${도입}) — 6급 반은 열지 않는다`);
    // 재출현급 — null 이거나, 도입급보다 «위»여야 한다. 같거나 아래면 「다시 다룬다」가 성립하지 않는다.
    if (재출현 != null) {
      if (!Number.isInteger(재출현) || 재출현 < 1 || 재출현 > 5) out.push(`${자리}: 재출현급이 1~5가 아니다(${재출현})`);
      else if (재출현 <= 도입) out.push(`${자리}: 재출현급(${재출현})이 도입급(${도입}) 이하다 — 상위 급 재출현만 적는다`);
    }
    if (근거 !== '요' && 근거 !== '표') out.push(`${자리}: 근거가 요/표가 아니다(${근거}) — 지어낸 것과 정본을 옮긴 것은 갈려야 한다`);
  });
  return out;
}

test('[급수①] 뱅크 72종이 값 계약을 지킨다 (칸 6개·도입 1~5·재출현 상위·근거 요/표)', () => {
  const { GRAMMAR_BANK } = 뱅크상수();
  assert.strictEqual(GRAMMAR_BANK.length, 72, '문법 뱅크가 72종이 아니다 — 개수가 바뀌었으면 Code.js CONTENT_EXPECT.grammar 도 함께 본다');
  assert.deepStrictEqual(위반들(GRAMMAR_BANK), [], '값 계약 위반');
});

test('[급수②] 탐지력 — 망가진 뱅크 6모양을 실제로 잡는다', () => {
  const 성한줄 = ['G201', '이/가', '주격 조사', 1, null, '요'];
  const 모양들 = [
    [['G201', '이/가', '주격 조사'], '칸 3개(태그 이전 판)'],
    [['G201', '이/가', '주격 조사', 6, null, '요'], '6급 — 상한 위반'],
    [['G201', '이/가', '주격 조사', null, null, '요'], '도입급 비었음'],
    [['G201', '이/가', '주격 조사', 3, 2, '요'], '재출현급이 도입급보다 아래'],
    [['G201', '이/가', '주격 조사', 3, 3, '요'], '재출현급이 도입급과 같음'],
    [['G201', '이/가', '주격 조사', 1, null, 'O'], '근거 코드 오타']
  ];
  모양들.forEach(([나쁜줄, 이름]) => {
    assert.notStrictEqual(위반들([나쁜줄]).length, 0, `못 잡았다: ${이름}`);
  });
  assert.deepStrictEqual(위반들([성한줄]), [], '성한 줄을 거짓양성으로 잡는다');
  assert.notStrictEqual(위반들([성한줄, 성한줄]).length, 0, 'ID 중복을 못 잡는다');
});

test('[급수③] LEVEL_TOPIK_BAND 가 커리큘럼 정본 ⓪표와 일치한다', () => {
  const { LEVEL_TOPIK_BAND } = 뱅크상수();
  /* 정본의 ⓪표를 «읽어» 대조한다 — 여기 값을 베끼면 정본 개정 때 이 검사만 낡는다.
   * 표 모양: | **TOPIK** | 1급 | 2급 | 2~3급 | 3급 | 3~4급 | 4~5급 | */
  const m = 커리큘럼.match(/\|\s*\*\*TOPIK\*\*\s*\|([^\n]+)\|/);
  assert.ok(m, '커리큘럼 정본에서 ⓪ TOPIK 대응표 행을 못 찾았다 — 표가 개정됐으면 이 앵커부터 고쳐라: docs/커리큘럼_정본_v1.md');
  const 정본밴드 = m[1].split('|').map((s) => s.trim()).filter(Boolean)
    .map((칸) => 칸.replace(/급/g, '').split('~').map(Number));
  assert.strictEqual(정본밴드.length, 6, `정본 표가 6레벨이 아니다(${정본밴드.length})`);
  정본밴드.forEach((밴드, i) => {
    const lv = i + 1;
    const 기대 = 밴드.length === 1 ? 밴드 : [밴드[0], 밴드[1]];
    assert.deepStrictEqual(LEVEL_TOPIK_BAND[lv], 기대,
      `Lv${lv} 밴드가 정본과 다르다 — 코드 ${JSON.stringify(LEVEL_TOPIK_BAND[lv])} vs 정본 ${JSON.stringify(기대)}`
      + ' (정본이 옳다: docs/커리큘럼_정본_v1.md v1.2 ⓪표)');
  });
});

test('[급수④] 근거 「요」로 적힌 문형은 커리큘럼 §3 요목에 실재한다', () => {
  const { GRAMMAR_BANK } = 뱅크상수();
  /* §3 레벨별 상세 구간만 본다 — 문서 전체를 대상으로 하면 어휘·평가 절의 우연한 문자열이 통과시킨다. */
  const s = 커리큘럼.indexOf('## ③ 레벨별 상세');
  assert.notStrictEqual(s, -1, '커리큘럼 §3(레벨별 상세)을 못 찾았다');
  const 요목 = 정규화(커리큘럼.slice(s));
  const 없는것 = GRAMMAR_BANK.filter((g) => g[5] === '요' && 요목.indexOf(정규화(핵심(g[1]))) < 0);
  assert.deepStrictEqual(없는것.map((g) => `${g[0]} ${g[1]}`), [],
    '「요」(요목 직결)로 적혔는데 정본 §3 요목에서 그 문형을 못 찾았다 — 근거를 「표」로 내리든지, 요목이 개정됐으면 급수를 다시 뜨든지 한다');
});

/* 문형 표기 정규화 — 정본과 뱅크가 같은 문형을 다르게 «쓴다»(요목 '-(으)러 가다/오다' vs 뱅크 '-(으)러 가다').
 * 걷는 것은 셋뿐이다: 공백 · `(으)` 매개모음 표기 · `을`↔`ㄹ` 이형태(요목 '-을수록' = 뱅크 '-(으)ㄹ수록').
 * 🔑 **어간·어미 자체는 안 건드린다** — 거기까지 지우면 서로 다른 문형이 같아져, 검사가 통과하는데
 *   실제로는 대조가 안 된 상태가 된다(느슨한 정규화가 만드는 조용한 초록). 위 셋은 한국어 어미의
 *   **규칙적 교체**라 다른 문형을 같게 만들지 않는다 — 뜻이 갈리는 자리가 아니라 표기가 갈리는 자리다. */
function 정규화(s) { return String(s).replace(/\s+/g, '').replace(/\(으\)/g, '').replace(/을/g, 'ㄹ'); }
/* 뱅크 이름에서 대조에 쓸 조각 — 슬래시 변이형은 첫 갈래만 본다('하고/와/과' → '하고').
 * 정본이 변이형을 다른 순서로 적을 수 있어 전체 문자열 일치를 요구하면 거짓양성이 난다. */
function 핵심(이름) { return String(이름).split('/')[0].split(' ')[0]; }

test('[급수⑤] 급수 조회 함수가 칸 위치를 호출부로 새지 않게 막는다', () => {
  /* 왜: g[3]·g[4] 를 호출부마다 집으면 칸이 하나 늘 때 전 자리를 고쳐야 하고, 그때 한 곳을 빠뜨리면
   *   그 자리만 조용히 옛 칸을 읽는다. 통로는 grammarGrade_·grammarsForLevel_ 셋뿐이어야 한다. */
  /* 판정은 «줄»이 아니라 «구간»으로 한다 — 줄로 보면 함수 «선언 줄»만 허용에 걸리고 그 본문은
   *   자기 자신을 위반으로 잡는다(첫 판이 실제로 그랬다). 통로 세 함수의 구간을 통째로 들어낸
   *   나머지에서 찾는다. */
  const s = code.indexOf('function grammarGrade_');
  const e = code.indexOf('function setupGrammarBank', s);
  assert.ok(s > 0 && e > s, '급수 조회 함수 구간의 앵커를 못 찾았다 — 함수명이 바뀌었으면 여기부터 고쳐라');
  const 밖 = (code.slice(0, s) + code.slice(e)).split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /g\[[345]\]/.test(l) && !/^\s*\*/.test(l));
  assert.deepStrictEqual(밖.map(([, l]) => l.trim()), [],
    '급수 칸을 조회 함수 밖에서 직접 집는다 — grammarGrade_/grammarsForLevel_/grammarGradeCounts_ 를 쓴다');
});

test('[급수⑥] setupGrammarBank 시트 재건이 칸 추가에 안 깨진다', () => {
  /* contents 시트는 6칸 고정이고 E열은 이미지(replaceContentType 보존 병합)다.
   * 재건이 g[3] 이후를 실으면 이미지 칸을 급수로 덮어쓴다 — 그건 되돌릴 수 없다. */
  const s = code.indexOf('function setupGrammarBank');
  assert.notStrictEqual(s, -1, 'setupGrammarBank 를 못 찾았다');
  const 본문 = code.slice(s, code.indexOf('\n}', s));
  assert.ok(/\[g\[0\], 'grammar', g\[1\], g\[2\], '', Number/.test(본문),
    '시트 재건 행 조립이 바뀌었다 — 급수 칸이 E열(이미지)로 새는지 확인하라');
});

/* ── STORY_GRAMMAR(스토리북 월 로테이션 96문형) 급수 태그 ──────────────────
 * 이 배열은 GRAMMAR_BANK 와 «다른 축»이다 — 진화 게이트가 아니라 챕터 문장의 골격이고,
 * 그래서 4~5급을 담을 수 있다(뱅크는 「단계 12개 중 9개」가 문서화된 확정이라 못 늘린다).
 * 겹치는 문형이 20개나 되므로 **두 곳이 갈라지지 않는지**가 여기서 지킬 급소다. */
function 스토리상수() {
  const s = code.indexOf('const STORY_GRAMMAR = [');
  assert.notStrictEqual(s, -1, 'STORY_GRAMMAR 선언을 못 찾았다');
  const e = code.indexOf('\n];', s);
  assert.notStrictEqual(e, -1, 'STORY_GRAMMAR 블록 끝(\\n];)을 못 찾았다');
  const mn = code.indexOf('const MN_STORY_GRAMMAR = [');
  const mnE = code.indexOf('\n];', mn);
  assert.ok(mn > 0 && mnE > mn, 'MN_STORY_GRAMMAR 를 못 찾았다');
  return new Function(`${code.slice(s, e + 3)}\n${code.slice(mn, mnE + 3)}\n return { STORY_GRAMMAR, MN_STORY_GRAMMAR };`)();
}

test('[급수⑧] STORY_GRAMMAR 96문형이 전부 급수 칸을 갖는다 (1~5)', () => {
  const { STORY_GRAMMAR } = 스토리상수();
  const 문형들 = STORY_GRAMMAR.reduce((a, r) => a.concat(r), []);
  assert.strictEqual(문형들.length, 96, `스토리 문형이 96개가 아니다(${문형들.length}) — 월 24행×4`);
  const 나쁜 = 문형들.filter((g) => g.length !== 3 || !Number.isInteger(g[2]) || g[2] < 1 || g[2] > 5);
  assert.deepStrictEqual(나쁜.map((g) => g[0]), [], '급수 칸이 없거나 1~5 밖이다');
});

test('[급수⑨] 두 뱅크에 겹치는 문형은 «같은» 급수를 갖는다', () => {
  /* 🔑 이 검사가 없으면 같은 문형이 한쪽에선 3급, 다른 쪽에선 4급이 되고 — 둘 다 초록이다.
   *   GRAMMAR_BANK 가 급수 정본이므로 어긋나면 스토리 쪽을 뱅크에 맞춘다. */
  const { GRAMMAR_BANK } = 뱅크상수();
  const { STORY_GRAMMAR } = 스토리상수();
  const 뱅크급 = {};
  GRAMMAR_BANK.forEach((g) => { 뱅크급[정규화(g[1])] = { 급: g[3], id: g[0] }; });
  const 어긋남 = [];
  let 겹침 = 0;
  STORY_GRAMMAR.forEach((월) => 월.forEach((g) => {
    const 짝 = 뱅크급[정규화(g[0])];
    if (!짝) return;
    겹침++;
    if (짝.급 !== g[2]) 어긋남.push(`${g[0]}: 스토리 ${g[2]}급 vs 뱅크 ${짝.id} ${짝.급}급`);
  }));
  assert.deepStrictEqual(어긋남, [], '같은 문형의 급수가 두 곳에서 갈렸다 — GRAMMAR_BANK 가 정본이다');
  /* 겹침이 0이면 이 검사는 아무것도 안 본 채 초록이 된다 — 분모를 함께 못박는다(F207). */
  assert.ok(겹침 >= 15, `겹치는 문형이 ${겹침}개뿐이다 — 대조가 사실상 안 돌고 있다(정규화가 깨졌는지 본다)`);
});

test('[급수⑩] 몽골어판이 한국어판과 1:1로 유지된다 (칸 추가가 대응을 안 깬다)', () => {
  const { STORY_GRAMMAR, MN_STORY_GRAMMAR } = 스토리상수();
  assert.strictEqual(MN_STORY_GRAMMAR.length, STORY_GRAMMAR.length, '월 행 수가 어긋났다');
  STORY_GRAMMAR.forEach((월, i) => {
    assert.strictEqual(MN_STORY_GRAMMAR[i].length, 월.length, `${i + 1}월 문형 수가 어긋났다`);
  });
});

test('[급수⑪] 스토리 문형에 4~5급이 실재한다 (뱅크가 못 담는 구간)', () => {
  const { STORY_GRAMMAR } = 스토리상수();
  const 분포 = {};
  STORY_GRAMMAR.forEach((월) => 월.forEach((g) => { 분포[g[2]] = (분포[g[2]] || 0) + 1; }));
  assert.ok((분포[4] || 0) > 0 && (분포[5] || 0) > 0,
    `4·5급이 비었다 — 이 배열의 존재 이유가 사라진다(분포: ${JSON.stringify(분포)})`);
});

test('[급수⑫] 스토리북 소비자가 급수 칸에 안 걸린다', () => {
  /* 배지 조립이 G[i][0]·G[i][1] 만 쓰는지 — [2]를 실으면 학부모 리포트에 급수 숫자가 새어 나간다.
   * (레벨 노출은 별개 설계 판정이고, 지금 계약은 「문형 — 의미」 두 칸이다.) */
  const 배지 = code.split('\n').filter((l) => l.indexOf("const gB = i =>") >= 0)[0];
  assert.ok(배지, '스토리북 문법 배지 조립부(gB)를 못 찾았다');
  assert.ok(!/G\[i\]\[2\]/.test(코드만(배지)), '배지가 급수 칸을 싣는다 — 학부모 리포트에 급수가 노출된다');
});

test('[급수⑬] 출제 풀이 두 배열을 잇는다 — 겹침은 한 번만·게이트와는 갈린다', () => {
  /* 실제 함수를 «그대로» 평가한다 — 여기서 로직을 다시 적으면 검사만 낡는다. */
  const bs = code.indexOf('const GRAMMAR_BANK = ['), be = code.indexOf('function grammarStageOf_', bs);
  const ss = code.indexOf('const STORY_GRAMMAR = ['), se = code.indexOf('\n];', ss);
  const fs_ = code.indexOf('function 급수문형풀_'), fe = code.indexOf('function setupGrammarBank', fs_);
  assert.ok(fs_ > 0 && fe > fs_, '급수문형풀_ 구간을 못 찾았다');
  const { 풀, GRAMMAR_BANK } = new Function(
    `${code.slice(bs, be)}\n${code.slice(ss, se + 3)}\n${code.slice(fs_, fe)}\n return { 풀: 급수문형풀_, GRAMMAR_BANK };`)();

  const lv6 = 풀(6); // Lv6 = TOPIK 4~5급 — 유호님이 겨냥한 구간
  const 뱅크만 = GRAMMAR_BANK.filter((g) => g[3] === 4 || g[3] === 5).length;
  assert.ok(lv6.length > 뱅크만, `출제 풀(${lv6.length})이 뱅크 4~5급(${뱅크만})보다 크지 않다 — 스토리 문형이 안 합쳐졌다`);
  /* 겹침이 두 번 담기면 출제 확률이 그 문형만 두 배가 된다 — 화면엔 안 보이는 편향이다. */
  const 키 = lv6.map((x) => String(x.문형).replace(/\s+/g, ''));
  assert.strictEqual(new Set(키).size, 키.length, '같은 문형이 두 번 담겼다 — 출제 편향이 된다');
  const 출처 = new Set(lv6.map((x) => String(x.출처).split(':')[0]));
  assert.ok(출처.has('bank') && 출처.has('story'), `출처가 한쪽뿐이다(${[...출처].join(',')}) — 잇는 것이 이 함수의 일이다`);
  /* 모르는 레벨은 빈 배열 — 배정이 통째로 죽지 않게(예외 아님). */
  assert.deepStrictEqual(풀(99), [], '모르는 레벨이 빈 배열을 안 낸다');
});

test('[급수⑦] 급수 분포가 세어진다 — 4~5급 빈 곳이 숫자로 드러난다', () => {
  const { GRAMMAR_BANK } = 뱅크상수();
  const 분포 = {};
  GRAMMAR_BANK.forEach((g) => { 분포[g[3]] = (분포[g[3]] || 0) + 1; });
  const 합 = Object.keys(분포).reduce((a, k) => a + 분포[k], 0);
  assert.strictEqual(합, GRAMMAR_BANK.length, '분포 합이 뱅크 크기와 다르다');
  /* 🔴 값을 못박지 않는다 — 4~5급을 채우는 것이 이 트랙의 «다음» 일이라, 숫자를 고정하면
   *   채우는 순간 빨개져서 그 작업을 막는다(「버그가 아직 있을 것을 요구하는 회귀」 금지).
   *   대신 **전 급수가 자리를 갖는지**만 본다 — 어느 급이 0이면 그 급 학생에게 줄 것이 없다. */
  [1, 2, 3, 4, 5].forEach((급) => {
    assert.ok(분포[급] > 0, `${급}급 문법이 0개다 — 그 급 학생에게 배정할 문법이 없다(분포: ${JSON.stringify(분포)})`);
  });
});
