'use strict';
/**
 * 대외 문안 목록 — «학원 밖 사람이 읽는 글»이 어디에 있나. 이 한 곳만 안다.
 *
 * 읽는 쪽 둘
 *   · tools/글검사.js              — 손으로 전량을 잴 때
 *   · .claude/hooks/voice-guard.js — 그 파일을 고치는 순간
 * 🔴 목록을 두 곳에 베끼지 않는다 — 한 값을 두 곳이 알면 갈린다(constant-known-in-two-places).
 *
 * 넣는 자 = **학원 밖 사람이 읽는가.** 학부모·학생·강사 지원자·기관이 읽으면 넣는다.
 * 빼는 자 = 내부 기록(트랙·결정·판정 지면·인계문)과 몽골어판.
 *   몽골어(_mn)를 빼는 까닭 — 검사기는 한국어 자라, 몽골어에 대면 뜻 없는 수가 나온다.
 */

/** 손으로 전량을 잴 때 여는 파일들 */
const 파일들 = [
  'docs/기업철학_홈페이지_v1.md',
  'docs/강사공고_정본_v1.md',
  'docs/강사채용_부트캠프_v1.md',
  'docs/강사훈련_온라인자료_v1.md',
  'docs/홍보_트리오_정본_v1.md',
  'docs/학생_페르소나_v1.md',
  'docs/연재16편_선생님.md',
  'docs/DM상담_Phase0_절차서.md',
  'docs/SHIFT/원장편지_실행지.md',
  'docs/SYNK_이야기.html',
  'docs/홈페이지_시안/병합판.html',
  'docs/홈페이지_시안/병합판_자립형.html',
  'docs/발표물/_src_01_설명회_덱_16x9.html',
  'docs/발표물/_src_02_학부모_안내문_A4_kr.html',
  'docs/발표물/_src_03_상담브로셔_A4_12쪽.html',
  'docs/발표물/_src_05_커리큘럼_로드맵_A3.html',
  'docs/발표물/_src_11_AI활용_학부모안내_A4_kr.html',
  '캐러셀/원고/LAB004_dorow_tuvshin.한국어.md',
];

/** 고치는 순간 잡는 무늬 — 위 목록에 아직 없는 «새 파일»도 잡히게 무늬로도 둔다 */
const 무늬들 = [
  /(^|\/)docs\/기업철학_홈페이지[^/]*\.md$/,
  /(^|\/)docs\/강사(공고|채용|훈련)[^/]*\.md$/,
  /(^|\/)docs\/홍보_트리오[^/]*\.md$/,
  /(^|\/)docs\/학생_페르소나[^/]*\.md$/,
  /(^|\/)docs\/연재[^/]*\.md$/,
  /(^|\/)docs\/SHIFT\/원장편지[^/]*\.md$/,
  /(^|\/)docs\/SYNK_이야기\.html$/,
  /(^|\/)docs\/홈페이지_시안\/[^/]*\.html$/,
  /(^|\/)docs\/발표물\/_src_[^/]*_(kr|A3|A4|16x9|12쪽)[^/]*\.html$/,
  /(^|\/)캐러셀\/원고\/[^/]*\.한국어\.md$/,
];

/** 몽골어판은 한국어 자로 재지 않는다 */
const 몽골어인가 = (p) => /_mn\.|\.mn\.|몽골어/.test(p);

const 대외문안인가 = (p) => {
  const 길 = String(p || '').replace(/\\/g, '/');
  if (몽골어인가(길)) return false;
  return 무늬들.some((re) => re.test(길));
};

/**
 * 글 조각(파일 전체가 아닌 «이번에 새로 넣는 줄»)에도 믿을 수 있는 규칙만.
 * 문맥·구조를 보는 규칙은 조각에 대면 헛것을 잡는다 — 앞 문장이 없으니 당연히 「가리킬 것이 없다」가 된다.
 */
const 조각에믿을규칙 = new Set([
  'dash', 'hardWord', 'longSentence', 'translationese', 'doublePassive',
  'doubleNegative', 'euiChain', 'nounPile', 'cliche', 'japaneseLoan',
  'redundantPair', 'imperativePeriod',
]);

module.exports = { 파일들, 무늬들, 대외문안인가, 몽골어인가, 조각에믿을규칙 };
