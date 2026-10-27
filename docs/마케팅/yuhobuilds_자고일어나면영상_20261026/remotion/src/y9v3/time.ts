// 박자표(30fps). 목소리 줄은 차례대로 잇고, 줄 사이 숨은 BREATH. 장면은 낱말 시각에 붙인다.
// ../y9v2/time.ts에서 복사 — v3(10-27 새 꼴)은 말 다섯 줄 + 끝 카드. 끝 말만 판마다 다르다(main: 인스타 · 틱톡 · X · 링크드인 「아래 글에」, yt: 「고정 댓글에」).
import { VOICE } from './vo.generated';

export type Cut = 'main' | 'yt';
export const BODY = ['h1', 'h2', 'r1', 'b1'] as const; // 전후 두 답 → (같은 장면) 한 줄 붙인 답 → 한 줄 크게 → 승인
export type Spoken = (typeof BODY)[number] | 'c1' | 'c1y' | 'fo';
const CTA: Record<Cut, Spoken> = { main: 'c1', yt: 'c1y' };
export const ctaOf = (cut: Cut) => CTA[cut];
export const orderOf = (cut: Cut): Spoken[] => [...BODY, CTA[cut], 'fo'];

/** 이 줄 앞의 숨(프레임). 없으면 6(0.2초). 장면이 바뀌는 자리는 앞 장면 결과가 보이고 넘어가게 길게. */
const BREATH: Partial<Record<Spoken, number>> = { h2: 12, r1: 24, b1: 24, c1: 30, c1y: 30 }; // c1: 첫 렌더 시험 「14초 승인 말풍선이 빨리 지나감」
const FIRST = 3;
const END_GAP = 14; // 끝 말 → 끝 카드
const FO_AFTER_END = 12; // 끝 카드 → 「팔로우하면」

const dur = (id: Spoken) => Math.round(VOICE[id].dur * 30);

export type Timing = { cut: Cut; order: Spoken[]; vo: Record<Spoken, number>; end: number; total: number };
const build = (cut: Cut): Timing => {
  const vo = {} as Record<Spoken, number>;
  let t = FIRST;
  for (const id of orderOf(cut)) {
    if (id === 'fo') break;
    t += id === 'h1' ? 0 : BREATH[id] ?? 6;
    vo[id] = t;
    t += dur(id);
  }
  const end = t + END_GAP;
  vo.fo = end + FO_AFTER_END;
  return { cut, order: orderOf(cut), vo, end, total: vo.fo + dur('fo') + 33 }; // 끝 화면 4초 안팎(제작 방식 v2 §2-4)
};
export const TIMING: Record<Cut, Timing> = { main: build('main'), yt: build('yt') };

type W = readonly [string, number, number];
const words = (id: Spoken) => VOICE[id].words as readonly W[];
/** id 줄의 i번째 낱말이 시작하는 프레임. */
export const wd = (id: Spoken, i: number, t: Timing) => t.vo[id] + Math.round(words(id)[i][1] * 30);
/** id 줄에서 text를 품은 첫 낱말(from번째부터)이 시작하는 프레임. 없으면 렌더를 멈춘다(대본이 바뀌면 바로 알게). */
export const at = (id: Spoken, text: string, t: Timing, from = 0) => {
  const ws = words(id);
  for (let i = from; i < ws.length; i++) if (ws[i][0].includes(text)) return t.vo[id] + Math.round(ws[i][1] * 30);
  throw new Error(`낱말을 못 찾음: ${id} 「${text}」 — ${ws.map((w) => w[0]).join(' ')}`);
};
/** id 줄에서 text를 품은 낱말의 순번(from번째부터). */
export const idx = (id: Spoken, text: string, from = 0) => {
  const ws = words(id);
  for (let i = from; i < ws.length; i++) if (ws[i][0].includes(text)) return i;
  throw new Error(`낱말을 못 찾음: ${id} 「${text}」`);
};
export const lineEnd = (id: Spoken, t: Timing) => t.vo[id] + dur(id);
