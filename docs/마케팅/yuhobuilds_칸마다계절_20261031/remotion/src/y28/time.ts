// Y28 박자표(30fps). 원본 VMwrKqlumr4(50.3초) 컷 0 · 10.7 · 14.6 · 33.9 · 44.4와 박자 0.3 · 2.4 · 4.9 · 8.7 · 9.3 · 10.7 · 14.6 · 16.9 ·
// 18.1 · 20.0 · 22.2 · 25.3 · 26.3 · 27.5 · 29.9 · 30.5 · 31.0 · 33.9 · 34.5 · 39.5 · 43.3 · 44.4 · 45.3 · 47.8에 우리 장면을 놓았다(../../오마주.json).
import { VOICE } from './vo.generated';

export type Spoken = keyof typeof VOICE;
const F = (s: number) => Math.round(s * 30);

export const B = {
  hook: F(0.3), // 「이상한 데 하나, 보이세요?」(원본 0.3초 제목 카드)
  read: F(2.4), // 칸 1 → 칸 4로 읽어 내려감(원본 2.4초)
  game: F(4.9), // 다시 네 칸 — 3초 찾기(원본 4.9초)
  tree: F(8.7), // 칸 1 나무 가까이(원본 8.7초 숨은 것 카드)
  ring: F(9.3), // 돋보기 자리 — 원(원본 9.3초 돋보기)
  win: F(10.7), // 컷 — 네 칸 창밖에 표시(원본 10.7초 점이 드러남)
  pair: F(14.6), // 컷 — 칸 1 나무 · 칸 4 창밖 나란히(원본 14.6초)
  apart: F(16.9), // 칸마다 따로(원본 16.9초)
  tags: F(18.1), // 칸마다 다른 계절 꼬리표(원본 18.1초)
  story: F(20.0), // 제 웹툰 작업(원본 20.0초)
  story2: F(22.2),
  storyZoom: F(23.0), // r7: 칸 4 창밖으로 다가감(한 구성 4초 안)
  card: F(25.3), // 지시문 카드(원본 25.3초 「3가지」)
  type: F(26.3), // 계절 줄이 쳐진다(원본 26.3 · 27.0초)
  h1: F(27.5), // 삼월 첫 주 · 맨가지(원본 27.5초)
  h2: F(29.9), // 창밖 나무도(원본 29.9 · 30.5초)
  h3: F(31.0), // 초록 잎 · 벚꽃 없음(원본 31.0초)
  result: F(33.9), // 컷 — 같은 네 칸이 계절 줄 판으로(원본 33.9초)
  wipeDone: F(34.5),
  lower: F(37.0), // r7: 아래 줄로(한 구성 4초 안)
  bag: F(39.5), // 물건(원본 39.5초)
  bag2: F(43.3),
  end: F(44.4), // 컷 — 끝: 같은 칸 둘 나란히(원본 44.4초)
  end2: F(45.3),
  fin: F(47.3), // 끝 — 계절 한 줄 칸에 테(원본 47.8 · 끝 49)
  brand: F(47.8),
  last: F(49.0), // 한 줄 칸 쪽으로 다가감(원본 49.0)
} as const;
// r3: 원본과 같은 길이 — 나란히가 길이 비율로 원본 초를 줄여 견줘, 96% 판은 뒤쪽 박자가 밀렸다.
export const TOTAL = F(50.3);

/** 목소리 줄이 시작하는 프레임. */
export const VO: Record<Spoken, number> = {
  v1: F(0.1),
  v2: F(8.7),
  v3: F(14.6),
  v4: F(20.0),
  v5: F(25.45),
  v6: F(34.0),
  v7: F(39.6),
  v8: F(44.6),
};
export const ORDER = Object.keys(VO) as Spoken[];

export const words = (id: Spoken) => VOICE[id].words as unknown as ReadonlyArray<readonly [string, number, number]>;
/** 줄 안에서 낱말이 시작하는 프레임. 못 찾으면 줄 시작. */
export const at = (id: Spoken, w: string) => {
  const hit = words(id).find((x) => x[0].includes(w));
  return VO[id] + Math.round((hit ? hit[1] : 0) * 30);
};
export const lineEnd = (id: Spoken) => VO[id] + Math.round(VOICE[id].dur * 30);
