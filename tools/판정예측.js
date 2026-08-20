#!/usr/bin/env node
/* 판정예측 — 유호님께 «묻기 전에» 내 답을 봉인하고, 답이 오면 대조해 재현율을 낸다.
 *
 * 유호 확정 2026-08-17(메모리 `prediction-verification-loop`): AI 활용 ⑤층(배우는)의
 * 실측이 **0**이다. 저장되는 것은 「유호님이 X를 기각했다」(결과)뿐이고 **「어떤 축으로
 * 기각했나」(규칙)는 어디에도 안 남는다.** 그래서 새 질문마다 처음부터 묻는다.
 * 그 메모리의 처방 3단계 중 **①봉인 예측**이 이 파일이다(②백테스트·③위임선은 이것의 뒤).
 *
 * 🔑 왜 «봉인»이어야 하나 — 사후 대조는 원리상 못 한다.
 *   이미 답이 온 결정으로 재현율을 재려면 예측자가 답을 안 봐야 하는데, 답은 메모리 인덱스에
 *   실려 매 세션 상주한다. 즉 **과거 판정으로는 내가 나를 못 가린다.** 답이 아직 «없는» 질문에
 *   미리 적어 두는 것만이 오염이 원리적으로 불가능한 유일한 통로다. 유호님 손은 0 —
 *   이미 큐에 나가는 질문에 내 답을 함께 적는 것뿐이다.
 *
 * 설계 급소 다섯:
 *   ① **키 = 결정큐와 같은 지문**(`decision-queue.지문(raw)`). 새 식별자를 안 만든다 —
 *      두 곳에 적으면 갈라진다(CLAUDE.md 신뢰성 ④). 덕분에 「봉인했는데 큐에 없다」가
 *      기계로 나온다 = 채점 대기.
 *   ② 🔴 **「큐에서 사라졌다」는 「유호님이 답했다」가 아니다.** 지문은 줄 원문의 해시라
 *      **문구만 고쳐도 달라진다.** 기계는 둘을 못 가른다 — 그래서 이 도구는 사라진 것을
 *      「채점 대기」로만 올리고 판정은 사람이 그 줄을 열어서 한다(`무효` 가 그 자리다).
 *      이 한계를 매 출력에 인쇄한다(가드 맹점 ④ — 장치는 「맞는 얼굴로 틀린 값」 쪽으로 샌다).
 *   ③ **채점엔 유호님 «원문 인용»이 필수다.** 없으면 안 쓴다. 재현율은 자기가 자기를 채점하는
 *      숫자라, 인용이 없으면 그건 관측이 아니라 자평이다(자율기록 `--근거` 와 같은 축).
 *      🔴 메모리 `prediction-verification-loop` 이 지목한 위험 「아첨으로 수렴」이 여기서 샌다.
 *   ④ **모양이 분모를 가른다.** 답이 닫힌 집합(열거·예아니오·대립)인 것만 채점이 문자열
 *      비교로 선다. 자유서술은 봉인은 하되 **재현율 분모에서 뺀다** — 안 그러면 「부분 적중」이
 *      마음대로 늘어난다. 실측 08-17: 열린 큐 92 = 닫힌 47(51%) + 자유 45.
 *   ⑤ **확신도를 같이 봉인한다.** 재현율만 재면 「유호님을 얼마나 아는가」만 나오는데,
 *      처방 ③(정확도로 위임선)이 실제로 요구하는 것은 **「내가 모른다는 것을 아는가」**다 —
 *      재현율 60% 라도 「확신 상 구간에서 95%」면 그 구간은 위임되고, 80% 라도 어디서 틀릴지
 *      모르면 아무것도 못 넘긴다. 그래서 축은 둘(재현율 · 눈금맞음)이다.
 *
 * 쓰기:
 *   node tools/판정예측.js                              현황(봉인·채점대기·재현율)
 *   node tools/판정예측.js --대상                        아직 안 봉인한 큐 항목 = 오늘 적을 것
 *   node tools/판정예측.js --봉인 --파일 예측.json       한 건 또는 배열
 *   node tools/판정예측.js --채점 <지문> --실제 "…" --인용 "유호님 원문" --판정 적중|빗나감|부분|무효
 *   node tools/판정예측.js --재현율                      축별·확신별로 쪼갠 표
 *
 * 봉인 JSON 한 건:
 *   { "지문":"a1b2c3d4e5", "예측":"㉮", "축":"기술", "확신":"상",
 *     "갈래":["㉮","㉯","㉰"], "왜":"…", "근거":"권고있음" }
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 큐 = require(path.join(ROOT, 'tools', 'decision-queue.js'));
const 메모리 = require(path.join(ROOT, 'tools', 'memory-graph.js'));
// 세션 id 는 한 통로에서만 뽑는다 — 축이 셋이라 직독하면 갈라진다(F634).
const 보드id = require('../.claude/hooks/lib/board-id.js');
const 정본 = path.join(ROOT, 'docs', '_ops', '판정예측.jsonl');

/* ── 닫힌 어휘 ────────────────────────────────────────────────────────────
 * 산문으로 두면 회차마다 낱말이 갈리고, 갈린 축은 집계가 원리상 안 선다.
 * (형제 저장소 `차단자갈래` 가 같은 이유로 닫힌 어휘다 — 메모리 ⑫.) */

/** 판정의 «성격». 메모리 처방 ②가 「단일 숫자로 안 나온다 — 축별로 갈린다」고 못박은 자리다.
 *  기술은 재료가 repo 안에 있어 맞히기 쉽고, 취향·돈·사람은 유호님 머릿속에만 있다. */
const 축값 = ['기술', '취향', '돈', '사람', '방향'];
const 축뜻 = {
  기술: '무엇이 옳게 도는가 — 재료가 저장소 안에 있다',
  취향: '무엇이 더 좋아 보이는가 — 재료가 유호님 눈에만 있다',
  돈: '얼마를 쓸 것인가 — 재료가 유호님 지갑에만 있다',
  사람: '누구와 어떻게 할 것인가 — 재료가 유호님 관계에만 있다',
  방향: '무엇을 하는 회사인가 — 재료가 유호님 뜻에만 있다',
};

/** 답이 닫힌 집합인가. **자유는 재현율 분모에서 빠진다**(급소 ④). */
const 모양값 = ['열거', '예아니오', '대립', '자유'];
const 닫힌모양 = ['열거', '예아니오', '대립'];

const 확신값 = ['상', '중', '하'];

/** 예측이 어디서 나왔나. 이미 내가 «권고»를 적어 둔 질문을 맞히는 것은 냉정하게 추론해
 *  맞히는 것보다 쉽다 — 안 가르면 재현율이 부풀려진 채로 위임선(처방 ③)의 근거가 된다. */
const 근거값 = ['권고있음', '추론'];

const 판정값 = ['적중', '빗나감', '부분', '무효'];
const 판정뜻 = {
  적중: '유호님 답이 봉인한 예측과 같다',
  빗나감: '다르다',
  부분: '갈래는 맞고 조건·범위가 갈렸다 — 닫힌 모양에서만 쓴다',
  무효: '채점할 수 없다(질문 자체가 사라졌거나 문구만 바뀌었다) — 분모에서 뺀다',
};

/* ── 순수 함수 (회귀가 이것들을 붙든다) ─────────────────────────────── */

/** jsonl → 레코드. **못 읽은 줄은 버리지 않는다** — 조용히 사라지면 장부가 준 걸 아무도 모른다. */
function 파싱(텍스트) {
  const out = [];
  const 줄들 = String(텍스트 || '').split(/\r?\n/);
  for (let i = 0; i < 줄들.length; i += 1) {
    const s = 줄들[i].trim();
    if (!s || s.startsWith('#')) continue;
    try {
      const r = JSON.parse(s);
      if (r && typeof r === 'object') out.push(r);
      else out.push({ 깨짐: i + 1, 원문: s });
    } catch {
      out.push({ 깨짐: i + 1, 원문: s });
    }
  }
  return out;
}

/** 봉인 1건 검사. 통과 못 하면 **안 쓴다** — 빈 칸이 든 봉인은 채점이 원리상 안 된다. */
function 봉인검증(p) {
  const 문제 = [];
  if (!p || typeof p !== 'object') return ['봉인이 객체가 아니다'];
  if (!String(p.지문 || '').trim()) 문제.push('「지문」이 비었다 — `--대상` 이 인쇄하는 값을 그대로 쓴다');
  if (!String(p.예측 || '').trim()) 문제.push('「예측」이 비었다');
  if (!축값.includes(p.축)) 문제.push(`「축」은 ${축값.join(' | ')} 중 하나 (지금: ${p.축 || '없음'})`);
  if (!확신값.includes(p.확신)) 문제.push(`「확신」은 ${확신값.join(' | ')} 중 하나 (지금: ${p.확신 || '없음'})`);
  if (!근거값.includes(p.근거)) 문제.push(`「근거」는 ${근거값.join(' | ')} 중 하나 (지금: ${p.근거 || '없음'})`);
  if (p.모양 != null && !모양값.includes(p.모양)) 문제.push(`「모양」은 ${모양값.join(' | ')} 중 하나`);
  /* 「왜」가 필수인 이유는 ②백테스트가 아니라 **나중의 나**다. 예측만 남기면 빗나갔을 때
     «어떤 축으로 잘못 봤는가»를 복원할 수 없고, 그게 정확히 이 루프가 배우려는 것이다. */
  if (!String(p.왜 || '').trim()) 문제.push('「왜」가 비었다 — 빗나갔을 때 복원할 재료가 이것뿐이다');
  return 문제;
}

/** 답이 닫힌 집합인가를 질문 원문으로 가른다.
 *  ⚠ 이 판정은 **봉인하는 사람이 덮어쓸 수 있다**(`모양` 칸) — 자동값은 제안이지 확정이 아니다.
 *  실측 08-17: 첫 판 정규식이 「붙일까요」·「켤까요」·「30 vs 40」을 전부 자유로 흘려
 *  분모를 18% 로 냈다(참값 42%). 그래서 어미가 아니라 **닫힘 신호 셋**으로 잰다. */
function 모양판정(원문) {
  const s = String(원문 == null ? '' : 원문);
  if (/[㉮㉯㉰㉱㉲]|[ⓐⓑⓒⓓ]|[A-B]안(?![가-힣])|㉠[\s\S]{0,200}㉡/.test(s)) return '열거';
  if (/\bvs\b|냐\s+\S+냐|둘\s*중\s*하나|[0-9]+\s*↔\s*[0-9]+/.test(s)) return '대립';
  if (/[가-힣](까요|는지)|둘 것인가|할 것인가|쓸 것인가/.test(s) || ㄹ지형(s)) return '예아니오';
  return '자유';
}

/** 「-ㄹ지」 어미(적용할지·둘지·켤지…)를 **종성으로** 찾는다.
 *  🔴 정규식 `ㄹ지` 로는 원리상 못 맞는다 — 한글은 자모가 한 글자로 «합쳐져» 저장되므로
 *  `할` 안의 ㄹ 은 문자로 존재하지 않는다. 첫 판이 정확히 이 모양으로 샜고(회귀가 잡았다),
 *  새는 방향은 「자유로 떨어진다」= **분모가 조용히 준다**였다.
 *  판정: 「지」 앞 글자가 한글 음절이고 그 **종성이 ㄹ**(조합 인덱스 8)인가. */
function ㄹ지형(s) {
  for (let i = 1; i < s.length; i += 1) {
    if (s[i] !== '지') continue;
    const cp = s.charCodeAt(i - 1);
    if (cp < 0xac00 || cp > 0xd7a3) continue;
    if ((cp - 0xac00) % 28 === 8) return true;
  }
  return false;
}

/** append-only 를 읽는 층에서 접는다 — 지문별 봉인 1건 + **최신 채점**.
 *  중복 봉인은 조용히 덮지 않고 `중복` 으로 드러낸다(같은 질문을 두 세션이 봉인한 지문). */
function 접기(레코드들) {
  const 봉인 = new Map();
  const 채점 = new Map();
  const 깨짐 = [];
  const 중복 = [];
  for (const r of 레코드들 || []) {
    if (r.깨짐) { 깨짐.push(r); continue; }
    const k = String(r.지문 || '').trim();
    if (!k) { 깨짐.push({ 깨짐: 0, 원문: JSON.stringify(r) }); continue; }
    if (r.종류 === '채점') { 채점.set(k, r); continue; }
    if (봉인.has(k)) 중복.push(k);
    else 봉인.set(k, r);
  }
  const 목록 = [...봉인.values()].map((p) => {
    const s = 채점.get(String(p.지문).trim());
    return {
      ...p,
      모양: 모양값.includes(p.모양) ? p.모양 : 모양판정(p.질문),
      판정: (s && 판정값.includes(s.판정) && s.판정) || '',
      실제: (s && s.실제) || '',
      인용: (s && s.인용) || '',
      채점날짜: (s && s.날짜) || '',
    };
  });
  목록.sort((a, b) => String(a.날짜 || '').localeCompare(String(b.날짜 || '')) || String(a.지문).localeCompare(String(b.지문)));
  return { 목록, 깨짐, 중복: [...new Set(중복)] };
}

/** 재현율 — **분모와 함께만 낸다**(메모리 `report-zero-with-denominator`).
 *  「적중 8」만 내면 그게 8/10 인지 8/80 인지 안 갈리고, 위임선의 근거가 될 수 없다. */
function 집계(목록) {
  const 채점된 = 목록.filter((p) => p.판정 && p.판정 !== '무효');
  const 셀수있는 = 채점된.filter((p) => 닫힌모양.includes(p.모양));
  const 적중 = 셀수있는.filter((p) => p.판정 === '적중').length;
  const 부분 = 셀수있는.filter((p) => p.판정 === '부분').length;
  const 빗나감 = 셀수있는.filter((p) => p.판정 === '빗나감').length;

  const 축별 = {};
  for (const a of 축값) {
    const 그축 = 셀수있는.filter((p) => p.축 === a);
    축별[a] = { 분모: 그축.length, 적중: 그축.filter((p) => p.판정 === '적중').length };
  }
  const 확신별 = {};
  for (const c of 확신값) {
    const 그확신 = 셀수있는.filter((p) => p.확신 === c);
    확신별[c] = { 분모: 그확신.length, 적중: 그확신.filter((p) => p.판정 === '적중').length };
  }
  const 근거별 = {};
  for (const g of 근거값) {
    const 그근거 = 셀수있는.filter((p) => p.근거 === g);
    근거별[g] = { 분모: 그근거.length, 적중: 그근거.filter((p) => p.판정 === '적중').length };
  }

  return {
    봉인: 목록.length,
    대기: 목록.filter((p) => !p.판정).length,
    무효: 목록.filter((p) => p.판정 === '무효').length,
    자유제외: 채점된.length - 셀수있는.length,
    분모: 셀수있는.length,
    적중, 부분, 빗나감,
    축별, 확신별, 근거별,
  };
}

/** 봉인했는데 **지금 큐에 없는 것** = 채점 대기.
 *  판정(적중이냐 무효냐)은 사람이 줄을 열어서 하지만, 「채점할 게 생겼다」는 기계가 안다 —
 *  그리고 이 한 줄이 없으면 이 장부는 아무도 안 여는 파일이 된다(CLAUDE.md 「스스로 발화하지
 *  않는 장치는 안 돈다」 · ⑨가 세운 다섯째 칸 「도는데 아무것도 안 바꿈」이 정확히 그 모양이다).
 *  🔑 현황 출력과 SessionStart 훅이 **이 함수 하나**를 쓴다 — 같은 판정을 두 곳에 적으면 갈라진다. */
function 채점대기(목록, 산지문들) {
  const 산것 = new Set((산지문들 || []).map(String));
  return (목록 || []).filter((p) => !p.판정 && !산것.has(String(p.지문)));
}

/** N/M 을 «분모와 함께» 찍는다. 분모 0 이면 퍼센트를 만들지 않는다 —
 *  0/0 을 100% 로도 0% 로도 쓰면 안 재본 것이 잰 것처럼 보인다(F207). */
function 비율(적중, 분모) {
  if (!분모) return '— (분모 0 · 안 재봤다)';
  return `${적중}/${분모} = ${Math.round((적중 / 분모) * 100)}%`;
}

/* ── 여기부터 파일·환경 ──────────────────────────────────────────── */

function 읽기() {
  if (!fs.existsSync(정본)) return [];
  return 파싱(fs.readFileSync(정본, 'utf8'));
}

function 붙이기(줄들) {
  fs.mkdirSync(path.dirname(정본), { recursive: true });
  const 머리 = fs.existsSync(정본) ? '' :
    '# 판정예측 — 유호님께 묻기 전에 봉인한 내 답과 그 채점. append-only(행 삭제 금지).\n' +
    '# 정본 = 이 파일 · 도구 = tools/판정예측.js · 근거 = 메모리 prediction-verification-loop\n';
  fs.appendFileSync(정본, 머리 + 줄들.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

function 오늘(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function 인자값(인자, 이름) {
  const i = 인자.indexOf(이름);
  return i >= 0 ? 인자[i + 1] : null;
}

/** 지금 큐에 살아 있는 ⏳ 항목. **여기 없다 = 답이 왔거나 문구가 바뀌었다**(급소 ②).
 *  ⚠ 메모리 자리는 **손으로 조립하지 않는다** — `memory-graph.memoryDir()` 하나가 정본이다.
 *  첫 판이 `projects/<이 기계 이름>/memory` 를 직접 이어 붙였고 `tests/메모리그래프.test.js`
 *  가 그 자리에서 잡았다(같은 판정을 두 곳에 적으면 갈라진다 · CLAUDE.md 신뢰성 ④). */
function 큐항목들() {
  const dir = 메모리.memoryDir();
  let items;
  try {
    items = 큐.extract(dir);
  } catch (e) {
    console.error(`⚠ 큐를 못 읽었다 — 「대상 0건」과 「메모리 못 찾음」이 같은 모양이 되지 않게 드러낸다.`);
    console.error(`  사유: ${(e && e.message) || e}`);
    return null;
  }
  return items.map((it) => ({ ...it, 지문: 큐.지문(it.raw) }));
}

/** 시점 게이트가 걸린 항목은 «오늘 배달되지 않는다» — 봉인은 되지만 답이 올 리가 없다.
 *  안 가르면 `--대상` 이 103 을 내고 결정큐가 92 를 내서, 같은 것을 재는 두 계기가 다른 말을
 *  한다(F207 「초록은 분모와 함께」의 그 자리). 두 수의 차이가 곧 이 칸이다. */
function 시점갈래(항목, 지금 = Date.now()) {
  const 지금배달 = [];
  const 시점대기 = [];
  for (const it of 항목) {
    if (it.notBefore && it.notBefore > 지금) 시점대기.push(it);
    else 지금배달.push(it);
  }
  return { 지금배달, 시점대기 };
}

/* ── 명령 ─────────────────────────────────────────────────────────── */

/** 아직 안 봉인한 큐 항목 = 오늘 적을 것. 봉인은 **답이 오기 전에만** 뜻이 있다. */
function 대상보기(인자) {
  const 항목 = 큐항목들();
  if (!항목) return 1;
  const { 목록 } = 접기(읽기());
  const 봉인됨 = new Set(목록.map((p) => String(p.지문)));
  const { 지금배달, 시점대기 } = 시점갈래(항목);
  const 남은 = 지금배달.filter((it) => !봉인됨.has(it.지문));
  const 닫힘 = 남은.filter((it) => 닫힌모양.includes(모양판정(it.raw)));
  const 자유 = 남은.length - 닫힘.length;

  console.log(`■ 봉인 대상 — 장부 ${항목.length}건 = 지금 배달 ${지금배달.length} + 시점 대기 ${시점대기.length}(답이 올 리 없어 대상 밖)`);
  console.log(`   지금 배달 ${지금배달.length} = 이미 봉인 ${지금배달.length - 남은.length} + 안 한 것 ${남은.length}`);
  console.log(`   안 한 것 ${남은.length} = 답이 닫힌 집합 ${닫힘.length} + 자유서술 ${자유}(봉인은 하되 재현율 분모 밖)`);
  const 자유도 = 인자.includes('--자유포함');
  const 낼것 = 자유도 ? 남은 : 닫힘;
  if (!낼것.length) {
    console.log(`\n낼 것 0건${자유도 ? '' : ' — 자유서술까지 보려면 --자유포함'}`);
    return 0;
  }
  console.log(`\n${자유도 ? '전량' : '닫힌 것만'} ${낼것.length}건 — 지문을 그대로 봉인 JSON 에 쓴다:\n`);
  for (const it of 낼것) {
    console.log(`  ${it.지문}  [${it.topic}:${it.line}]  (${모양판정(it.raw)})`);
    console.log(`      ${String(it.text || '').replace(/\s+/g, ' ').slice(0, 150)}`);
  }
  return 0;
}

function 봉인(인자) {
  const 파일 = 인자값(인자, '--파일');
  if (!파일) {
    console.error('🔴 `--파일 예측.json` 이 필요하다 — 「왜」 칸에 따옴표·백틱이 들어가므로 셸 인라인에 안 맡긴다(F297 · shell-inline-guard).');
    return 1;
  }
  if (!fs.existsSync(파일)) { console.error(`🔴 없는 파일: ${파일}`); return 1; }
  let 입력;
  try { 입력 = JSON.parse(fs.readFileSync(파일, 'utf8')); }
  catch (e) { console.error(`🔴 JSON 을 읽지 못했다: ${(e && e.message) || e}`); return 1; }

  const 목록입력 = Array.isArray(입력) ? 입력 : [입력];
  const 문제 = [];
  목록입력.forEach((p, i) => 봉인검증(p).forEach((m) => 문제.push(`[${i + 1}번째] ${m}`)));
  if (문제.length) {
    console.error('🔴 필수 칸이 비어 안 쓴다:');
    for (const m of 문제) console.error(`  · ${m}`);
    return 1;
  }

  const 항목 = 큐항목들();
  if (!항목) return 1;
  const 지문표 = new Map(항목.map((it) => [it.지문, it]));
  const 이미 = new Set(접기(읽기()).목록.map((p) => String(p.지문)));

  const 새줄 = [];
  const 거절 = [];
  for (const p of 목록입력) {
    const k = String(p.지문).trim();
    if (이미.has(k)) { 거절.push(`${k} — 이미 봉인돼 있다(덮어쓰기 금지 · append-only)`); continue; }
    const it = 지문표.get(k);
    /* 🔴 큐에 없는 지문은 **안 받는다.** 답이 이미 온 뒤에 봉인하면 그건 예측이 아니라
       베끼기이고, 그 한 줄이 재현율 전체를 거짓으로 만든다. 이 도구의 유일한 존재 이유가
       「오염이 원리적으로 불가능한 통로」인데 여기서 새면 나머지가 다 무의미해진다. */
    if (!it) { 거절.push(`${k} — 지금 큐에 없다. 답이 온 뒤의 봉인은 예측이 아니다(안 받는다)`); continue; }
    새줄.push({
      종류: '봉인',
      지문: k,
      날짜: p.날짜 || 오늘(),
      토픽: it.topic,
      줄: it.line,
      질문: String(it.text || '').replace(/\s+/g, ' ').trim(),
      모양: 모양값.includes(p.모양) ? p.모양 : 모양판정(it.raw),
      갈래: Array.isArray(p.갈래) ? p.갈래 : p.갈래 ? [String(p.갈래)] : [],
      예측: String(p.예측).trim(),
      축: p.축,
      확신: p.확신,
      근거: p.근거,
      왜: String(p.왜).trim(),
      세션: 보드id.세션id() || '',
    });
  }
  if (거절.length) {
    console.error(`⚠ 안 받은 것 ${거절.length}건:`);
    for (const m of 거절) console.error(`  · ${m}`);
  }
  if (!새줄.length) { console.error('🔴 쓸 것이 0건이다.'); return 1; }
  붙이기(새줄);
  for (const r of 새줄) console.log(`🔒 ${r.지문} [${r.토픽}] ${r.모양}/${r.축}/확신${r.확신} → ${r.예측}`);
  console.log(`\n✅ ${새줄.length}건 봉인 — 유호님 답이 오면: node tools/판정예측.js --채점 <지문> …`);
  return 0;
}

function 채점(인자) {
  const k = String(인자값(인자, '--채점') || '').trim();
  const 실제 = String(인자값(인자, '--실제') || '').trim();
  const 인용 = String(인자값(인자, '--인용') || '').trim();
  const v = 인자값(인자, '--판정');
  const { 목록 } = 접기(읽기());
  const 그것 = 목록.find((p) => String(p.지문) === k);
  if (!그것) { console.error(`🔴 봉인 ${k} 가 없다 — 목록: node tools/판정예측.js`); return 1; }
  if (그것.판정) { console.error(`🔴 이미 채점됐다(${그것.판정}) — 덮어쓰기 금지. 정정은 장부에 새 줄로 붙이되 사유를 적는다.`); return 1; }
  if (!판정값.includes(v)) {
    console.error(`🔴 --판정 은 ${판정값.join(' | ')} 중 하나`);
    for (const x of 판정값) console.error(`     ${x} — ${판정뜻[x]}`);
    return 1;
  }
  if (v !== '무효') {
    if (!실제) { console.error('🔴 --실제 가 없다 — 유호님이 실제로 고른 값'); return 1; }
    /* 급소 ③ — 인용 없는 채점은 관측이 아니라 자평이다. 「아첨으로 수렴」이 새는 자리가
       정확히 여기라, 원문이 없으면 안 쓴다. */
    if (!인용) { console.error('🔴 --인용 이 없다 — 유호님 «원문»을 그대로. 인용 없는 채점은 자평이라 안 받는다.'); return 1; }
  }
  if (v === '부분' && !닫힌모양.includes(그것.모양)) {
    console.error('🔴 「부분」은 답이 닫힌 모양에서만 쓴다 — 자유서술에서 쓰면 늘 부분 적중이 된다(급소 ④).');
    return 1;
  }
  붙이기([{ 종류: '채점', 지문: k, 날짜: 오늘(), 판정: v, 실제, 인용, 세션: 보드id.세션id() || '' }]);
  const 표 = { 적중: '🎯', 빗나감: '❌', 부분: '◐', 무효: '⃠' };
  console.log(`${표[v]} ${k} [${그것.토픽}] 예측 ${그것.예측} ↔ 실제 ${실제 || '—'} → ${v}`);
  return 0;
}

/** 못 보는 것을 매 출력에 인쇄한다 — 가드 맹점 ④. */
function 한계인쇄() {
  console.log('\n⚠ 이 계기가 못 보는 것 — 숫자를 그대로 믿지 않는다:');
  console.log('   · 「큐에서 사라짐」 = 답이 왔다 **또는** 문구만 바뀌었다. 지문은 줄 해시라 기계가 못 가른다 → 사람이 줄을 열고 `무효` 로 가른다.');
  console.log('   · 채점은 내가 나를 채점한다 — 막는 것은 `--인용` 필수 하나뿐이고, 인용을 느슨히 고르면 새어 나간다.');
  console.log('   · 자유서술은 분모 밖이라, 어려운 판정이 통째로 재현율에서 빠진다(쉬운 것만 세는 쪽으로 편향된다).');
}

function 현황() {
  const { 목록, 깨짐, 중복 } = 접기(읽기());
  const g = 집계(목록);
  if (!목록.length) {
    console.log('■ 판정예측 — 봉인 0건');
    console.log('   오늘 적을 것: node tools/판정예측.js --대상');
    한계인쇄();
    return 0;
  }
  console.log(`■ 판정예측 — 봉인 ${g.봉인} = 채점 ${g.봉인 - g.대기} + 대기 ${g.대기}`);
  console.log(`   채점 ${g.봉인 - g.대기} = 셀 수 있는 것 ${g.분모} + 무효 ${g.무효} + 자유(분모 밖) ${g.자유제외}`);
  console.log(`   재현율 ${비율(g.적중, g.분모)}  (부분 ${g.부분} · 빗나감 ${g.빗나감})`);

  const 항목 = 큐항목들();
  if (항목) {
    const 대기 = 채점대기(목록, 항목.map((it) => it.지문));
    if (대기.length) {
      console.log(`\n🔔 채점 대기 ${대기.length}건 — 봉인했는데 **큐에서 사라졌다**(답이 왔거나 문구가 바뀌었다):`);
      for (const p of 대기) {
        console.log(`  ${p.지문} [${p.토픽}:${p.줄}] 예측 「${p.예측}」`);
        console.log(`      그 줄을 열어 확인 → node tools/판정예측.js --채점 ${p.지문} --판정 적중|빗나감|부분|무효 --실제 "…" --인용 "…"`);
      }
    }
  }
  if (중복.length) console.error(`⚠ 지문 중복 봉인: ${중복.join(', ')}`);
  if (깨짐.length) console.error(`⚠ 읽지 못한 줄 ${깨짐.length}개`);
  한계인쇄();
  return 0;
}

function 재현율보기() {
  const { 목록 } = 접기(읽기());
  const g = 집계(목록);
  console.log(`■ 재현율 — 「내가 유호님처럼 판단하는가」`);
  console.log(`   전체 ${비율(g.적중, g.분모)}   (봉인 ${g.봉인} · 대기 ${g.대기} · 무효 ${g.무효} · 자유 제외 ${g.자유제외})`);
  console.log('\n  축별 — 재료가 어디 있느냐로 갈린다:');
  for (const a of 축값) console.log(`    ${a.padEnd(3)} ${비율(g.축별[a].적중, g.축별[a].분모).padEnd(22)} ${축뜻[a]}`);
  console.log('\n  확신별 — 여기가 위임선의 재료다(처방 ③). 「확신 상」이 높고 「하」가 낮아야 눈금이 맞다:');
  for (const c of 확신값) console.log(`    확신 ${c}  ${비율(g.확신별[c].적중, g.확신별[c].분모)}`);
  console.log('\n  근거별 — 내 권고를 이미 적어 둔 질문은 맞히기 쉽다. 안 가르면 재현율이 부풀려진다:');
  for (const b of 근거값) console.log(`    ${b.padEnd(6)} ${비율(g.근거별[b].적중, g.근거별[b].분모)}`);
  한계인쇄();
  return 0;
}

function main(argv) {
  const 인자 = argv.slice(2);
  if (인자.includes('--대상')) return 대상보기(인자);
  if (인자.includes('--봉인')) return 봉인(인자);
  if (인자.includes('--채점')) return 채점(인자);
  if (인자.includes('--재현율')) return 재현율보기();
  if (!인자.length || 인자.includes('--목록')) return 현황();
  console.error('사용: --대상 [--자유포함] | --봉인 --파일 x.json | --채점 <지문> --판정 … --실제 "…" --인용 "…" | --재현율');
  return 1;
}

module.exports = {
  파싱, 봉인검증, 모양판정, ㄹ지형, 접기, 집계, 비율, 시점갈래, 채점대기,
  읽기, 큐항목들,
  축값, 축뜻, 모양값, 닫힌모양, 확신값, 근거값, 판정값, 판정뜻,
  정본경로: 정본,
};

if (require.main === module) process.exit(main(process.argv));
