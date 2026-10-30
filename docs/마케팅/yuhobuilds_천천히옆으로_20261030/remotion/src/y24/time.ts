// Y24 박자표(30fps). 원본 wS9rrwRImTg(38.9초) 컷 0 · 2.4 · 4.9 · 9.3 · 12.0 · 13.2 · 21.2 · 24.6 · 29.4 · 33.1 · 35.1과
// 박자 4.7 · 6.2 · 9.1 · 12.5 · 22.5에 우리 장면을 놓았다(../../오마주.json — 뼈대 훅 0 · 반전 29.4 · 끝 35.1).
import { VOICE } from './vo.generated';

export type Spoken = keyof typeof VOICE;
const F = (s: number) => Math.round(s * 30);

export const B = {
  bubble: F(0.2), // 지시 슬레이트(원본 0.2~0.45초 말풍선 자리)
  cross: F(1.35), // 빨간 ✕(원본 1.35초)
  dim: F(1.65), // 말풍선이 흐려짐(원본 1.65초)
  real: F(2.4), // 실제 요청 화면 한 컷 그대로(원본 출처 화면 자리)
  whip: F(4.7), // 밀어 넘김(원본 4.7~4.9초)
  play: F(4.9), // V1이 돈다 — 흰 선 「사진 끝」이 따라 들어옴(원본 저장소 화면 자리)
  label: F(6.2), // 「여기까지가 넣은 사진」(원본 6.2초 컷)
  whip2: F(9.1), // 밀어 넘김(원본 9.1~9.3초)
  reveal: F(9.3), // 사진에 없던 기와집(원본 이름 공개 자리)
  big: F(12.0), // 큰 글 「3% → 17%」(원본 큰 숫자 칸)
  bigZoom: F(12.5), // 큰 글이 다가옴(원본 12.5초 확대)
  why: F(13.2), // 왜 — 넣은 사진 / 10초 뒤(원본 문서 카드 + 배지가 쌓임)
  window: F(21.2), // 편집에서 자르는 창(원본 도형)
  slide: F(22.5), // 창이 옆으로(원본 22.5초 바뀜)
  result: F(24.6), // 편집 결과(원본 실제 결과 화면)
  back: F(29.4), // 첫 말풍선이 다시 — 줄 긋기(원본 반전)
  gains: F(33.1), // 얻는 것 칩(원본 반론 목록)
  end: F(35.1), // 끝 장면(원본 끝 장치)
} as const;
export const TOTAL = F(38.9);

/** 목소리 줄이 시작하는 프레임. */
export const VO: Record<Spoken, number> = {
  v1: F(0.05),
  v2: F(3.3),
  v3: F(8.95),
  v4: F(12.1),
  v5: F(15.0),
  v6: F(21.5),
  v7: F(24.75),
  v8: F(29.5),
  v9: F(33.2),
  v10: F(35.4),
};
export const ORDER = Object.keys(VO) as Spoken[];

type W = readonly [string, number, number];
export const words = (id: Spoken) => VOICE[id].words as readonly W[];
export const dur = (id: Spoken) => Math.round(VOICE[id].dur * 30);
export const lineEnd = (id: Spoken) => VO[id] + dur(id);
export const at = (id: Spoken, text: string, from = 0) => {
  const ws = words(id);
  for (let i = from; i < ws.length; i++) if (ws[i][0].includes(text)) return VO[id] + Math.round(ws[i][1] * 30);
  throw new Error(`낱말을 못 찾음: ${id} 「${text}」 — ${ws.map((w) => w[0]).join(' ')}`);
};
