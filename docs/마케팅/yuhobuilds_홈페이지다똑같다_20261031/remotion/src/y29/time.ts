// 박자표(30fps). 원본 nWrk7Z001h4의 컷 [0 · 7.2 · 13.2 · 20.2 · 28.2 · 33.3 · 37.8]과 박자에 화면을 맞추고,
// 한 번에 구운 범수 원고를 나눈 줄(나누기.mjs → vo.generated.ts)은 그 줄의 기준 낱말이 정한 초에 오게 놓는다.
// A판(범수) · B판(내레이션 없음)은 이 박자표 하나를 같이 쓴다 — 화면 · 글 · 박자가 프레임까지 같고, 다른 것은 소리뿐이다.
import { VOICE } from './vo.generated';

export const FPS = 30;
export const s = (sec: number) => Math.round(sec * FPS);
export type Seg = keyof typeof VOICE;
type W = readonly [string, number, number];
const words = (id: Seg) => VOICE[id].words as readonly W[];
const dur = (id: Seg) => VOICE[id].dur;

/** 줄을 놓는 자리 — [줄, 기준 낱말, 그 낱말이 시작할 초]. 초가 null이면 앞 줄 바로 뒤(원고 그대로의 숨). */
const ANCHOR: [Seg, string, number | null][] = [
  ['s1', '에이아이', 0.06],
  ['s1b', '물건', null], // 약속 한 줄 — 원고 그대로의 숨으로 잇는다
  ['s2', '먼저,', null], // 약속 → 방법 2 → 「확」까지 원고 그대로의 숨으로 잇는다
  ['s3a', '확', null],
  ['s3b', '여섯', 10.2],
  ['s4a', '종이는', 12.9],
  ['s4b', '이번엔', 14.45], // v9: 방법 3은 넘김 없이 바로 초록 벽(셋째 시험 여섯 모두 16~20초에서 넘김)
  ['s4c', '에이아이한테', null],
  ['s5a', '그래서', 18.55],
  ['s5b', '세무사', 20.9],
  ['s6', '이번엔', 26.4],
  ['s7', '하늘색', 29.8],
  ['s8', '물건은', 36.0],
];
export const ORDER = ANCHOR.map(([id]) => id);

const START = {} as Record<Seg, number>;
{
  let prevEnd = 0;
  for (const [id, word, sec] of ANCHOR) {
    const w = words(id).find((x) => x[0].includes(word));
    if (!w) throw new Error(`낱말을 못 찾음: ${id} 「${word}」`);
    const st = sec === null ? prevEnd : sec - w[1];
    if (st < prevEnd - 0.001) throw new Error(`줄이 겹침: ${id} 시작 ${st.toFixed(2)}초 < 앞 줄 끝 ${prevEnd.toFixed(2)}초`);
    START[id] = st;
    prevEnd = st + dur(id);
  }
}
/** 줄이 시작하는 프레임. */
export const vo = (id: Seg) => s(START[id]);
/** 줄이 끝나는 프레임. */
export const voEnd = (id: Seg) => s(START[id] + dur(id));
/** id 줄에서 text를 품은 낱말(from번째부터 찾음)이 시작하는 프레임. 없으면 렌더를 멈춘다(원고가 바뀌면 바로 알게). */
export const at = (id: Seg, text: string, from = 0) => {
  const ws = words(id);
  for (let i = from; i < ws.length; i++) if (ws[i][0].includes(text)) return s(START[id] + ws[i][1]);
  throw new Error(`낱말을 못 찾음: ${id} 「${text}」 — ${ws.map((w) => w[0]).join(' ')}`);
};

/** 화면 박자(초 → 프레임). 원본 박자 [3.5 · 6.9 · 7.2 · 9.4 · 13.2 · 20 · 22.8 · 24.4 · 28.2 · 33.2 · 34.3 · 34.8 · 37.8 · 38.8]. */
export const B = {
  riffle: 5, // 방법 1의 일곱 장은 0.17초씩 빠르게 넘긴다(둘째 시험: 「0~2초 볼 이유가 늦다」)
  wall0: at('s1', '색만') - 4, // 색을 빼면 같은 틀 — 일곱 장이 큰 벽으로 펼쳐지며 회색이 된다
  gray0: at('s1', '색만') + 2,
  promise: at('s1b', '물건') - 2, // 약속: 회색 벽 위로 빨간 우체통 한 장(원본 3.5초 「수상작처럼 나옵니다」 자리)
  card1: s(4.3), // 방법 2 — 요청 칸에 「물건 하나도 AI가 알아서」 한 줄을 친다
  typed1: s(5.7),
  send1: at('s3a', '확') - 13,
  result1: at('s3a', '확') - 3, // 한 줄 붙인 빵집이 위에서 덮는다(원본 7.2)
  flipsB: at('s3a', '확') + 9, // 한 줄 붙인 일곱 판이 넘어감
  revealB: at('s3b', '여섯') - 2, // 큰 벽: 7개 중 6개 누런 종이
  card2: s(12.8), // 방법 3 「종이는 빼고」(원본 13.2)
  typed2: s(13.4),
  send2: s(13.9),
  revealD: s(14.15), // 넘김 없이 바로 큰 벽: 초록 · 금색 다섯 — 「AI가 고르면 또 다 비슷해진다」까지 머문다
  thesis: vo('s4c'),
  cut5: s(18.4), // 방법 4 — 물건을 내가 정함
  card3: s(20.9),
  typed3: s(21.7),
  send3: s(22.25),
  result3: s(22.5), // 빨간 우체통 세무사가 덮는다 — 요청 칸은 작게 접혀 위에 남는다
  flipsE: s(26.3), // 일곱 판이 다 그 물건대로
  cut7: s(29.6), // 물건 셋 크게
  chip2: at('s7', '노란'),
  chip3: at('s7', '분홍'),
  end: s(34.4), // 끝: 첫 장면의 회색 일곱 장이 다시 서고 한 장씩 제 물건 색으로 바뀐다(셋째 시험 볼 이유: 우체통을 다시 내려 보는 끝은 여운이 없다)
  endFlip: s(35.0),
  endLine: at('s8', '물건은') - 3,
  total: s(40.0),
};
/** 넘김 간격(프레임). 일곱 판이 0.3초씩. */
export const FLIP = 9;
