// Y25 박자표(30fps). 원본 Ls0r557jclc(42.5초) 컷 0 · 6.0 · 23.2 · 29.6 · 35.4와 박자 0.3 · 6.7 · 11.9 · 12.8 · 13.3 · 17.8 · 22.3 ·
// 30.2 · 30.7 · 36.4 · 37.1 · 42.0에 우리 장면을 놓았다(../../오마주.json — 뼈대 훅 0.3 · 반전 6.0 · 끝 35.4).
import { VOICE } from './vo.generated';

export type Spoken = keyof typeof VOICE;
const F = (s: number) => Math.round(s * 30);

export const B = {
  hook: F(0.3), // 낮 → 밤 쓸어 덮기 시작(원본 0.3초 큰 결과)
  turn: F(6.0), // 반전 — 이 사진은 밤처럼으로 저녁(원본 6.0초 컷)
  turn2: F(6.7), // 저녁이 나옴(원본 6.7초)
  method: F(11.9), // 방법 — 어둡게 줄 긋기(원본 카드 셋 자리)
  chip1: F(12.8), // 유일한 빛(원본 12.8초)
  chip2: F(13.3), // 그 밖은 거의 검은 형체로(원본 13.3초)
  run: F(17.8), // 실행 — 가까이서 낮이 밤으로(원본 실행 기록 빨리 감기)
  stop: F(22.3), // 창에 표시(원본 22.3초)
  table: F(23.2), // 결과 — 표 대신 두 판을 화면 가득 나란히(원본 23.2초 컷, r4 시험 셋이 작은 표를 짚음)
  more: F(27.4), // 새 사진 셋 — 넷은 0.5초씩 스쳐 지나갔다(r6 심사관), 하나 줄여 한 장씩 오래
  again: F(28.9), // 초
  again1: F(30.5), // 가게 전구(원본 30.2 · 30.7초)
  again2: F(32.1), // 헤드라이트 — 첫 장면의 그 차, 움직이는 판 그대로 끝까지
  end: F(35.0), // 끝 — 통했다(원본 35.4초 컷, 편 길이 98%에 맞춘 자리)
  end1: F(35.0), // 뭐가 빛인지
  end2: F(37.1), // 대신 — 먼 풍경(원본 37.1초)
  off: F(40.7), // 헤드라이트가 꺼진다
} as const;
export const TOTAL = F(41.2);

/** 목소리 줄이 시작하는 프레임. */
export const VO: Record<Spoken, number> = {
  v1: F(0.1),
  v2: F(6.05),
  v3: F(11.95),
  v4: F(17.9),
  v5: F(23.4),
  v6: F(27.6),
  v7: F(35.1),
};
/** v6은 낱말마다 사진이 뒤집혀 소리를 나눠 얹는다(public/vo/v6_<n>.wav — node 음성나누기.mjs). */
export const V6 = [
  { src: 'vo/v6_1.wav', at: VO.v6 },
  { src: 'vo/v6_2.wav', at: B.again - 2 },
  { src: 'vo/v6_3.wav', at: B.again1 - 2 },
  { src: 'vo/v6_4.wav', at: B.again2 - 2 },
];
export const ORDER = Object.keys(VO) as Spoken[];

export const words = (id: Spoken) => VOICE[id].words as unknown as ReadonlyArray<readonly [string, number, number]>;
/** 줄 안에서 낱말이 시작하는 프레임. 못 찾으면 줄 시작. */
export const at = (id: Spoken, w: string) => {
  const hit = words(id).find((x) => x[0].includes(w));
  return VO[id] + Math.round((hit ? hit[1] : 0) * 30);
};
export const lineEnd = (id: Spoken) => VO[id] + Math.round(VOICE[id].dur * 30);
