// 화면 숫자는 모두 기록 값이다(기획.md 「실화」).
// - 출처: 메신저 AI 비서(헤르메스)의 호출 기록 %LOCALAPPDATA%/hermes/logs/agent.log(.1) — 「API call #」 줄의 in · out · cache · write.
//   대화 하나(10-21 20:00에 새로 시작한 개인 대화)를 11-16까지 이어 썼다.
// - 요금은 그 줄을 Opus 5.5 API 단가로 센 어림이다(입력 4 · 캐시 쓰기 5분 1.25배 · 캐시 읽기 0.05배 · 출력 20달러 / 100만 토큰 — tools/lib/클로드키.js).
//   청구서가 아니고, 무료 API 크레딧에서 나갔다.

export type Share = { when: string; first: number; usd: number };

/** 고치기 전 게시물 받기 다섯 건 — 첫 호출이 다시 읽은 양(in)과 그 한 건(호출 5~16번)의 요금 어림. */
export const SHARES: Share[] = [
  { when: '11월 7일 아침', first: 366065, usd: 2.37 },
  { when: '11월 7일 아침', first: 374938, usd: 2.36 },
  { when: '11월 11일 새벽', first: 432035, usd: 2.8 },
  { when: '11월 11일 오후', first: 443153, usd: 2.86 },
  { when: '11월 15일 밤', first: 533347, usd: 4.18 },
];

/** 고친 뒤(11-16 02:52 공유) — 요약(Haiku) 뒤 호출이 읽은 양 42,002 ~ 44,174. 그 공유의 첫 호출은 옛 대화 그대로 143,727(다시 켠 직후 한 번뿐). */
export const AFTER_IN = 44174;
export const AFTER_MIN = 42002;
export const BEFORE_IN = 533347;

/** 대화가 이어진 날 — 10-21부터 11-15까지(26일째). */
export const DAY_FIRST = '10월 21일';
export const DAY_LAST = '11월 15일';
export const DAY_COUNT = 26;

/** 고친 뒤에도 그림을 다시 연 수 — 11-16 02:52 공유(카드뉴스 일곱 장, vision_analyze). */
export const REOPENED = 7;

export const fmt = (n: number) => n.toLocaleString('en-US');
export const man = (n: number) => `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`;
