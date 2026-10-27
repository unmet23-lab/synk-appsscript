// 다시 살림 v2(10-27) 박자표(30fps). 첫 판 time.ts와 같은 셈이고 줄만 다르다: 질문 → 재기 → 맞히기 → 답 → 정리 → 댓글.
// 판이 하나다 — 끝 말이 댓글이라 인스타 · 유튜브 · 틱톡 · X · 링크드인에 같은 최종본이 간다.
import { VOICE } from './vo.generated';
import type { Timing } from './time';

export const ORDER2 = ['h1', 'h2', 'h3', 'r3', 'w2', 'cm', 'fo'] as const; // r3: 이해 시험 1회 뒤 「10원짜리 동전 하나 값도」(기준이 없다는 답)
export type Spoken2 = (typeof ORDER2)[number];

/** 이 줄 앞의 숨(프레임). 맞히기 뒤 0.6초 멈칫(첫 판 셋째 판과 같음), 9.8원이 선 뒤 한 박. */
const BREATH: Partial<Record<Spoken2, number>> = { h2: 8, h3: 6, r3: 18, w2: 14, cm: 16 };
const FIRST = 3;
const END_GAP = 14; // 끝 말 → 끝 카드
const FO_AFTER_END = 12; // 끝 카드 → 「팔로우하면」

const dur = (id: Spoken2) => Math.round(VOICE[id].dur * 30);

export type Timing2 = { order: Spoken2[]; vo: Record<Spoken2, number>; end: number; total: number };
const build = (): Timing2 => {
  const vo = {} as Record<Spoken2, number>;
  let t = FIRST;
  for (const id of ORDER2) {
    if (id === 'fo') break;
    t += id === 'h1' ? 0 : BREATH[id] ?? 6;
    vo[id] = t;
    t += dur(id);
  }
  const end = t + END_GAP;
  vo.fo = end + FO_AFTER_END;
  return { order: [...ORDER2], vo, end, total: vo.fo + dur('fo') + 43 }; // 끝 화면 4초 안팎(제작 방식 v2 §2-4)
};
export const T2 = build();
export const VO2 = T2.vo;
/** 끝 카드(End.tsx)는 첫 판 Timing 꼴을 받는다 — 쓰는 칸은 vo.fo · end · total뿐이라 그 셋만 맞춰 넘긴다. */
export const END_TIMING = { cut: 'ig', order: ['fo'], vo: { fo: T2.vo.fo }, end: T2.end, total: T2.total } as unknown as Timing;

type W = readonly [string, number, number];
/** id 줄에서 text를 품은 첫 낱말이 시작하는 프레임. 없으면 렌더를 멈춘다(대본이 바뀌면 바로 알게). */
export const at2 = (id: Spoken2, text: string) => {
  const ws = VOICE[id].words as readonly W[];
  for (const w of ws) if (w[0].includes(text)) return T2.vo[id] + Math.round(w[1] * 30);
  throw new Error(`낱말을 못 찾음: ${id} 「${text}」 — ${ws.map((w) => w[0]).join(' ')}`);
};
export const lineEnd2 = (id: Spoken2) => T2.vo[id] + dur(id);
