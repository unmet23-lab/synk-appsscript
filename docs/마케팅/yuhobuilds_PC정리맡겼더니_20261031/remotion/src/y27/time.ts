// Y27 박자표(30fps). 원본 UzmsVkfKjbg(28.1초) 뼈대 — 큰 주장 · 큰 숫자 그림 · 출처 화면 · 전후 · 공개 · 질문 밈 · 실제 표 · 범위 확장 · 반응 · 정리 카드
// (../../오마주.json — 뼈대 훅 1.2 · 끝 27.2). 우리 끝 말이 길어 전체가 110%라 뒤쪽 박자는 그 비율로 늦췄다.
import { VOICE } from './vo.generated';

export type Spoken = keyof typeof VOICE;
export const F = (s: number) => Math.round(s * 30);

export const B = {
  fall: F(1.2), // 벽이 무너진다(원본 1.2초 첫 그림 바뀜) — 0.9초는 실제 옮긴 시간
  empty: F(2.1), // 다 비었다
  night: F(4.3), // 그날 밤
  stop: F(5.35), // 회사 업데이트 멈춤(원본 4.5초)
  real: F(6.0), // 실제 폴더 창 한 컷
  days: F(7.46), // 사흘 — 날짜를 긁기 시작(원본 6.2초)
  why: F(10.85), // 왜 멈췄나(원본 9.6초 컷)
  gone: F(12.95), // 폴더 하나가 빠지고 벽이 빨개진다(원본 11초 컷 뒤)
  ne1: F(13.6), // 안 건드렸다(원본 14.1)
  ne2: F(14.5), // ≠(원본 14.7)
  ne3: F(14.75), // 안 쓴다(원본 15.2 컷)
  moved: F(15.8), // 옮겨만 뒀다 — 실제 주소 줄
  drag: F(17.04), // 노란 커서가 폴더 이름을 긁는다(원본 18초)
  back0: F(19.95), // 초록이 돌아온다(원본 19.9 컷)
  back1: F(22.45), // 둘째 덩이(원본 21.2)
  back2: F(23.5), // 남은 부스러기(원본 22.3)
  lone: F(25.12), // 6.7(원본 23.9 컷)
  ifDel: F(26.5), // 바로 지웠으면(원본 25.2 컷)
  end: F(28.25), // 끝 장면 — 핵심 장면이 한 번 더
} as const;
export const TOTAL = F(31.1);

/** 목소리 줄이 시작하는 프레임. */
export const VO: Record<Spoken, number> = {
  v1: F(0.05),
  v2: F(3.05),
  v3: F(6.1),
  v3b: F(9.8),
  v4: F(10.85),
  v5: F(13.5),
  v6: F(15.95),
  v7b: F(19.0),
  v7: F(22.4),
  v8: F(24.2),
  v9: F(26.5),
  v10: F(28.25),
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
