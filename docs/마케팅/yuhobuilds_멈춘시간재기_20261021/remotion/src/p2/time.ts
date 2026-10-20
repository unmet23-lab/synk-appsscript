// 박자표(30fps). 목소리 줄은 차례대로 잇고, 줄 사이 숨은 GAP(문단 끝은 더 길게). 장면은 낱말 시각에 붙인다.
import { VOICE } from './vo.generated';

export const ORDER = ['h1', 'h2', 'b1', 'b2', 'b3', 'f1', 'f2', 'f3', 'b5', 'c0', 'cta', 'fo'] as const;
export type Spoken = (typeof ORDER)[number];

/** 이 줄 앞의 숨(프레임). 없으면 6(0.2초). 문단이 바뀌는 자리만 길게. */
const BREATH: Partial<Record<Spoken, number>> = { h2: 6, b1: 9, b2: 8, b3: 8, f1: 10, f2: 7, f3: 7, b5: 9, c0: 10, cta: 9 };
const FIRST = 3;
const END_GAP = 12; // cta 끝 → 끝 카드
const FO_AFTER_END = 12; // 끝 카드 → 「팔로우하면」

const dur = (id: Spoken) => Math.round(VOICE[id].dur * 30);
const build = () => {
  const vo = {} as Record<Spoken, number>;
  let t = FIRST;
  for (const id of ORDER) {
    if (id === 'fo') break;
    t += id === 'h1' ? 0 : BREATH[id] ?? 6;
    vo[id] = t;
    t += dur(id);
  }
  const end = t + END_GAP;
  vo.fo = end + FO_AFTER_END;
  return { vo, end };
};
const B = build();
export const VO = B.vo;

type W = readonly [string, number, number];
const words = (id: Spoken) => VOICE[id].words as readonly W[];
/** id 줄의 i번째 낱말이 시작하는 프레임. */
export const wd = (id: Spoken, i: number) => VO[id] + Math.round(words(id)[i][1] * 30);
/** id 줄에서 text를 품은 첫 낱말(from번째부터)이 시작하는 프레임. 없으면 렌더를 멈춘다(대본이 바뀌면 바로 알게). */
export const at = (id: Spoken, text: string, from = 0) => {
  const ws = words(id);
  for (let i = from; i < ws.length; i++) if (ws[i][0].includes(text)) return VO[id] + Math.round(ws[i][1] * 30);
  throw new Error(`낱말을 못 찾음: ${id} 「${text}」 — ${ws.map((w) => w[0]).join(' ')}`);
};
export const lineEnd = (id: Spoken) => VO[id] + dur(id);

export const S = { end: B.end };
export const TOTAL = lineEnd('fo') + 33; // 끝 화면 4초 안팎(제작 방식 v2 §2-4)
