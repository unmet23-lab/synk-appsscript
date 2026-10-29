// 시간표 — 원본(CarterPCs 「Can Any AI Answer this question???」 38.45초)의 박자를 우리 길이에 맞게 늘린 자리에 장면을 놓는다.
// 원본 박자 · 뼈대는 ../../오마주.json(확정). 첫 2초(0.6 · 1.9초)는 늘이지 않는다(나란히 검사도 그대로 견준다).
// v3(이해 시험 v2 재미 3 · 3, 「같아 보임」 하나): 훅 「AI가 써 준 리뷰 답글, 그대로 올렸으면 큰일 날 뻔했어요」 · 사장님 한마디 둘 · 입력창 · 좌우 비교 · 끝 화면 뺌.
// v2(10-29 이해 시험 v1 3 · 3점 뒤): 첫 줄에 「하나엔 제가 안 한 말이 들어 있었어요」 약속, AI 낭독은 한 마디씩, 반전 앞에 「리뷰에 없던 사정」(Fable P1 — 「지어냈다 · 핑계」는 깎아내림), 끝은 「그래서 … AI마다 똑같이」.
import { VO } from './vo';

export const FPS = 30;
export const ORIG = 38.45;
export const LEN = 42.6;
const S = LEN / ORIG;
export const TOTAL = Math.round(LEN * FPS);

/** 원본 초 → 우리 초 */
const o = (t: number) => (t <= 2 ? t : +(t * S).toFixed(3));

/** 장면이 바뀌는 자리(초). 이름은 우리 화면, 주석은 원본에서 그 자리가 하는 일. */
export const T = {
  card: o(0.6), // 원본: 첫 AI 이름표가 뜨며 다가감 → 우리: 「Gemini」 이름표
  answer: o(1.9), // 원본: 첫 AI가 답함 → 우리: Gemini 실제 답 화면
  three: o(4.0), // 원본: 넘어가는 추임새 → 우리: 「세 가지 버전」 줄에 다가감 · 형광
  opt1: o(4.9), // 원본: 둘째 AI 이름표 · 질문 → 우리: 답글 1
  opt2: o(9.7), // 원본: 둘째 AI 답 → 우리: 답글 2(아직 표시 없음)
  opt3: o(10.9), // 원본: 사람이 따짐 → 우리: 답글 3
  strip: o(12.5), // 원본: 둘째 AI 답 → 우리: 답 전체 길이 한눈에
  b1: o(14.4), // 원본: 또 따짐(빠른 세 박) → 우리: 답글 세 제목을 크게(실제 글)
  b2: o(14.9),
  b3: o(15.4),
  pick: o(17.0), // 원본: 둘째 AI가 버팀 · 째려봄 → 우리: 「답글 3개」
  gptAsk: o(18.6), // 원본: 「ChatGPT한테 해 봐」 → 우리: ChatGPT 답 화면의 부탁 말풍선
  gptCard: o(19.8), // 원본: 이름표가 ChatGPT로(박자 아님)
  gptAns: o(20.4), // 원본: 셋째 AI의 긴 답 → 우리: ChatGPT 실제 답 화면
  gptZoom: o(23.75), // 원본: 긴 한 구성 시작 → 우리: 답글 하나에 다가가 문단을 훑음
  side: o(28.5), // 원본: 비꼬는 칭찬 → 우리: Gemini 답을 거슬러 올라감(셋째 → 둘째 답글)
  gemCard: o(29.6), // 원본: 이름표가 넷째 AI로 → 우리: 다시 Gemini, 둘째 답글 테
  opt2big: o(30.3), // 원본: 넷째 AI에게 질문 → 우리: 둘째 답글을 크게 다시 짬
  twist: o(33.3), // 원본: 반전 「None.」 → 우리: 「라이더 배차가 지연되면서」 형광 · 다가감
  stamp: o(34.1), // 원본: 정적 → 우리: 빨간 도장 「제가 안 한 말」
  end1: o(35.7), // 원본: 정적 끝 · 항의 시작 → 우리: 지어 넣은 줄에 한 번 더 다가감(이름표 빠짐)
  end2: o(37.4), // 원본: 끝 한 줄(칼컷) → 우리: 「똑같이」에서 도장에 바짝 다가감 → 칼컷(끝 카드 없음)
} as const;

export const f = (sec: number) => Math.round(sec * FPS);

/** 줄 자리(초). cutFrom/cutTo = 줄 파일 안에서 쓰는 구간(한 마디만 쓰는 AI 낭독). */
export type Clip = { id: string; at: number; cutFrom?: number; cutTo?: number };
const len = (c: Clip) => (c.cutTo ?? VO[c.id].dur) - (c.cutFrom || 0);
const end = (c: Clip) => c.at + len(c);
const after = (prev: Clip, gap: number) => +(end(prev) + gap).toFixed(3);
const r3 = (x: number) => +x.toFixed(3);

const v21: Clip = { id: 'v21', at: 0.05 }; // AI가 써 준 리뷰 답글, 그대로 올렸으면 큰일 날 뻔했어요.(v3 — 「~했더니」 훅이 지난 편과 같아 보였다)
const g01: Clip = { id: 'g01', at: after(v21, 0.15) }; // “세 가지 버전으로 작성했습니다.”
const g02: Clip = { id: 'g02', at: after(g01, 0.25), cutTo: 1.62 }; // “안녕하세요, [상호명]입니다.”(답글 1 첫 줄만)
const v22: Clip = { id: 'v22', at: after(g02, 0.15) }; // 우리 가게 이름이 상호명이 됐네요.
const v23: Clip = { id: 'v23', at: r3(T.opt3 - 1.3) }; // 답글 하나 부탁했는데, 세 개요.
const v12: Clip = { id: 'v12', at: r3(T.strip + 0.2) }; // 제가 안 한 말, 어느 답글에 있는지 보이세요?
const v07: Clip = { id: 'v07', at: r3(T.pick + 0.07) }; // 골라 쓰래요.
const v03: Clip = { id: 'v03', at: r3(T.gptAsk + 0.09) }; // 챗GPT는요?
const c01: Clip = { id: 'c01', at: r3(T.gptAns + 0.1), cutTo: 1.25 }; // “안녕하세요, 고객님.”(첫 마디만)
const v04: Clip = { id: 'v04', at: after(c01, 0.3) }; // 딱 하나. 그대로 쓰면 돼요.
const v13: Clip = { id: 'v13', at: r3(T.gptZoom + 2.1) }; // 없던 사정은 안 넣었어요.
const v14: Clip = { id: 'v14', at: r3(T.side + 0.12) }; // 그런데 두 번째 답글엔, 리뷰에 없던 사정이 있어요.
const G03_FROM = 2.69; // 「배달」 낱말 시작(2.75초) 조금 앞
const g03: Clip = { id: 'g03', at: r3(T.twist - (3.43 - G03_FROM) + 0.05), cutFrom: G03_FROM }; // “배달 라이더 배차가 지연되면서” — 「배차가」가 반전 자리에
const v15: Clip = { id: 'v15', at: after(g03, 0.15) }; // 그래서 AI 고를 땐, 평소 하는 일 하나를 AI마다 똑같이 시켜 보세요.

export const CLIPS: Clip[] = [v21, g01, g02, v22, v23, v12, v07, v03, c01, v04, v13, v14, g03, v15];
export const clipEnd = end;

// 줄끼리 겹치지 않는지 · 끝 줄이 영상 안에 드는지 — 렌더 전에 멈춘다
CLIPS.forEach((c, i) => {
  const n = CLIPS[i + 1];
  if (n && end(c) > n.at - 0.08) throw new Error(`${c.id}(끝 ${end(c).toFixed(2)}) → ${n.id}(${n.at}) 겹침`);
});
if (end(v15) > LEN - 0.2) throw new Error(`끝 줄이 영상 끝을 넘는다: ${end(v15).toFixed(2)} > ${LEN - 0.2}`);
