// 박자표(30fps). 목소리 줄은 차례대로 잇고, 줄 사이 숨은 BREATH. 장면은 낱말 시각에 붙인다.
// Y5(10-25) time.ts에서 복사 — 이 편은 끝 말이 모든 판(인스타 · 유튜브 · 틱톡)에 같아 판이 하나다.
import { VOICE } from './vo.generated';

export type Cut = 'main';
export const BODY = ['h1', 'h2', 'a1', 'a2', 'r1', 'p1', 'c1'] as const; // 와 있음 → AI가 만든 것 → 승인 → 알아서 올라감 → 규칙 한 줄 → 그 요청문은 아래 글에 → 끝 질문
export type Spoken = (typeof BODY)[number] | 'fo';
export const orderOf = (): Spoken[] => [...BODY, 'fo'];

/** 이 줄 앞의 숨(프레임). 없으면 6(0.2초). 장면이 바뀌는 자리는 길게. */
const BREATH: Partial<Record<Spoken, number>> = { h2: 16, a1: 14, a2: 10, r1: 24, p1: 12, c1: 22 }; // 장면이 바뀌는 자리는 앞 장면 결과가 보이고 넘어가게
const FIRST = 3;
const END_GAP = 14; // 끝 말 → 끝 카드
const FO_AFTER_END = 12; // 끝 카드 → 「팔로우하면」

const dur = (id: Spoken) => Math.round(VOICE[id].dur * 30);

export type Timing = { cut: Cut; order: Spoken[]; vo: Record<Spoken, number>; end: number; total: number };
const build = (): Timing => {
  const vo = {} as Record<Spoken, number>;
  let t = FIRST;
  for (const id of orderOf()) {
    if (id === 'fo') break;
    t += id === 'h1' ? 0 : BREATH[id] ?? 6;
    vo[id] = t;
    t += dur(id);
  }
  const end = t + END_GAP;
  vo.fo = end + FO_AFTER_END;
  return { cut: 'main', order: orderOf(), vo, end, total: vo.fo + dur('fo') + 33 }; // 끝 화면 4초 안팎(제작 방식 v2 §2-4)
};
export const TIMING: Record<Cut, Timing> = { main: build() };

type W = readonly [string, number, number];
const words = (id: Spoken) => VOICE[id].words as readonly W[];
const T0 = TIMING.main;
export const VO = T0.vo;
/** id 줄의 i번째 낱말이 시작하는 프레임. */
export const wd = (id: Spoken, i: number, t: Timing = T0) => t.vo[id] + Math.round(words(id)[i][1] * 30);
/** id 줄에서 text를 품은 첫 낱말(from번째부터)이 시작하는 프레임. 없으면 렌더를 멈춘다(대본이 바뀌면 바로 알게). */
export const at = (id: Spoken, text: string, from = 0, t: Timing = T0) => {
  const ws = words(id);
  for (let i = from; i < ws.length; i++) if (ws[i][0].includes(text)) return t.vo[id] + Math.round(ws[i][1] * 30);
  throw new Error(`낱말을 못 찾음: ${id} 「${text}」 — ${ws.map((w) => w[0]).join(' ')}`);
};
export const lineEnd = (id: Spoken, t: Timing = T0) => t.vo[id] + dur(id);
