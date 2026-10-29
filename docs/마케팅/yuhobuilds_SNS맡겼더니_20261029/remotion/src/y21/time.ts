// 박자표(30fps). 장면은 원본(1분만 「다이소 가격 왜 이럴까?」, 오마주.json)의 박자 초를 길이 비율 S만큼 늘려 붙이고, 말은 그 박자 앞뒤에 줄마다 놓는다.
// 칸 안에서 더 나오는 것(원본의 컵 · 화살표 · 가격표 자리)도 원본의 같은 자리다(둘 다 ×S). 끝 말만 판마다 다르다(main: 인스타 키워드 DM, yt: 고정 댓글, tt: 틱톡 · X · 링크드인 설명).
// 10-29 첫 렌더 이해 시험(두 시험관 3 · 3점)이 함께 짚은 「무엇을 맡겼나 · 누가 채점했나 · 같은 틀이 뭔가 · 칸표와 뼈대」를 말 · 화면 둘 다에서 고친 판이다.
import { VOICE } from './vo.generated';

export const FPS = 30;
export const f = (s: number) => Math.round(s * FPS);
export type Cut = 'main' | 'yt' | 'tt';
export type LineId = keyof typeof VOICE;

/** 우리 영상은 원본(25.7초)보다 끝말만큼 길다 — 원본 박자를 같은 비율로 늘려 붙인다(오마주.js 나란히가 길이 비율로 견준다). */
export const S = 1.08;
const at = (x: number) => Math.round(x * S * 1000) / 1000;
/** 칸이 시작하는 초(오마주.json 「박자」 + 0초, ×S). 칸 번호는 1부터 — K[0]이 1칸. */
export const K = [0, 0.3, 1.8, 2.4, 4.0, 6.5, 7.1, 11.5, 14.2, 15.2, 16.4, 17.9, 20.8, 22.8].map(at);
/** 칸 안에서 무엇이 더 나오는 초(원본의 같은 자리, ×S). */
export const POP = { heart: at(3.0), question: at(5.6), arrow1: at(8.0), pair2: at(9.5), arrow2: at(10.4), stampShrink: at(16.85) };

/** 말 조각: 줄 id의 [from, to]초를 at초에 튼다. */
export type Seg = { id: LineId; at: number; from?: number; to?: number };
const CTA: Record<Cut, LineId> = { main: 'l8', yt: 'l8y', tt: 'l8t' };
export const CTA_AT = 24.85;
export const segs = (cut: Cut): Seg[] => [
  { id: 'l1', at: 0.05 },
  { id: 'l2', at: 2.0 }, // AI가 만들어서 거의 매일 올렸거든요.(사실 검수 — 7일에 여섯 편)
  { id: 'l3', at: 4.7 }, // 「같은」이 6.75초 — 7.02초 도장이 「틀」에 찍힌다
  { id: 'l4a', at: 7.72 }, // 화면 생김새도 똑같고,
  { id: 'l4b', at: 10.3 }, // 끝 인사는 글자까지 똑같았어요.
  { id: 'l5n', at: 12.47 }, // 나간 여섯 편도 다 이 생김새였고요.(사실 검수 — 끝 인사 예시 두 편은 아직 안 올린 편이라 「생김새」만)
  { id: 'l5', at: 15.38, from: 2.05, to: 3.365 }, // 무슨 말인지는 알겠는데,
  { id: 'l5', at: 17.72, from: 3.42 }, // 재미가 없대요.
  { id: 'l6', at: 18.65 }, // 그래서 터진 영상을 AI한테 주고 이렇게 물었어요. — 12칸(19.33초)보다 조금 먼저 「그래서」
  { id: 'l7', at: 22.5 }, // 장면 순서는 두고, 이야기만 제 걸로. — 「제 걸로」가 24.6초 끝 자리
  ...(cut === 'yt'
    ? [{ id: CTA[cut], at: CTA_AT, to: 0.86 }, { id: CTA[cut], at: CTA_AT + 1.1, from: 1.7 }] // 유튜브 판은 끝말 가운데 0.9초 숨을 줄인다(끝 자리 길이)
    : [{ id: CTA[cut], at: CTA_AT }]),
];

const TAIL = 0.25;
export const totalSec = (cut: Cut) => CTA_AT + VOICE[CTA[cut]].dur + TAIL - (cut === 'yt' ? 0.6 : 0);
export const total = (cut: Cut) => f(totalSec(cut));

/** 자막: [시작초, 끝초, 글]. **…**는 버터. 말과 같은 글만 쓴다(제작 절차 「알아듣기」). */
export type Cap = readonly [number, number, string];
const CAP_END: Record<Cut, string> = {
  main: '댓글에 **「뼈대」** → 이 요청문 드려요',
  yt: '이 요청문은 **고정 댓글**에',
  tt: '이 요청문은 **설명**에',
};
const CAP_END_AT: Record<Cut, number> = { main: 26.05, yt: 25.95, tt: 26.12 };
export const caps = (cut: Cut): Cap[] => [
  [0.05, 1.97, '왜 다 좋아요가 **0개**일까요?'],
  [2.0, 4.6, '**AI가 만들어서** 거의 매일 올렸거든요'],
  [4.7, 6.72, '근데 다른 AI가 **채점**해 보니'],
  [6.72, 7.7, '**같은 틀**이래요'],
  [7.72, 10.28, '화면 **생김새도** 똑같고'],
  [10.28, 12.4, '끝 인사는 **글자까지** 똑같았어요'],
  [12.42, 15.3, '나간 **여섯 편**도 다 이 생김새였고요'],
  [15.33, 17.68, '무슨 말인지는 알겠는데'],
  [17.68, 18.62, '**재미가 없대요**'],
  [18.65, 21.4, '그래서 **터진 영상**을 AI한테 주고'],
  [21.4, 22.46, '**이렇게** 물었어요'],
  [22.5, 23.8, '장면 순서는 **두고**,'],
  [23.8, 24.83, '이야기만 **제 걸로**'],
  [24.85, CAP_END_AT[cut], '**이 영상**처럼요'],
  [CAP_END_AT[cut], totalSec(cut), CAP_END[cut]],
];
