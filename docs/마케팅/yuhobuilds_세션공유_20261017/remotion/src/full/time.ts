// 본편 박자표(A판 프레임, 30fps). 배경음은 음악.mjs가 잘라 붙인 bgm_a — 박 격자가 끊기지 않아 beat(k)를 그대로 쓴다.
// 음악 사건: 12박 드럼 빠짐 · 16박 다시 터짐 · 44~55박 조용한 구간 · 56박 다시 터짐 · 68박 드럼 빠짐 · 72박 다시 터짐 · 100박 끝맺음.
// 유튜브 E판은 훅이 2박(29프레임) 길다. 훅 뒤 장면은 Sequence로 29프레임 밀어 같은 A판 프레임으로 짠다.
import { beat } from '../lib/beat';
import { VOICE } from './vo.generated';

export const TOTAL_A = 1626; // 54.2초(10-18 끝을 댓글 「세션」 + 팔로우로 바꿔 4초 남짓 늘어남)
export const E_SHIFT = beat(8) - beat(6); // 29
export const TOTAL_E = TOTAL_A + E_SHIFT;

/** 장면 시작(A판). */
export const S = {
  s02: beat(6), // 90 「다섯 시간 한도가 차면」
  s03: beat(16), // 236 다시 터지는 박 「대화가 지워진 건」
  s04: beat(25), // 368 「그래서 꼼수를」
  s05: beat(36), // 529 「목록은 보였는데」
  s06: beat(44), // 646 조용한 구간 「로그엔 같은 거절이」
  s07: beat(57), // 837 「다행히」
  s08: beat(64), // 939 넘김 「결국 링크는」
  s09: beat(74), // 1086 하드 컷 「대신 한 곳이」
  s10a: beat(82), // 1203 「이제 어느 계정으로」
  s10b: beat(88), // 1291 말 없이 음악만(계정 넷 · 76), 한 마디
  s11: beat(92), // 1349 넘김 「방법만 글로」(마디 첫 박)
  end: TOTAL_A,
};

/** 목소리가 시작하는 프레임(A판). 줄 사이는 0.27초 이상. A판은 h1(사라짐) → sum2(그대로)로 열고(10-18 「사라짐 → 그대로」), E판은 h1e(훅) 뒤 s1로 연다. */
export const VO = { h1: 3, sum2: 100, s1: 94, c1: 242, t1: 372, t2: 535, t3: 658, r1: 840, m1: 946, m2: 1090, e1: 1207, f1: 1353, f1a: 1353, cta: 1484 } as const;
/** 판마다 쓰는 줄(h1e는 E판 앞에 따로). A판 끝은 f1을 「공개했어요.」에서 자른 f1a + 댓글·팔로우 줄 cta(10-18). */
export const LINES_A = ['h1', 'sum2', 'c1', 't1', 't2', 't3', 'r1', 'm1', 'm2', 'e1', 'f1a', 'cta'] as const;
export const LINES_E = ['s1', 'c1', 't1', 't2', 't3', 'r1', 'm1', 'm2', 'e1', 'f1'] as const;
export type Line = keyof typeof VO;

/** 줄 id의 i번째 낱말이 시작하는 프레임. */
export const wd = (id: Line, i: number) => VO[id] + Math.round(VOICE[id].words[i][1] * 30);
/** 줄이 끝나는 프레임. */
export const lineEnd = (id: Line) => VO[id] + Math.round(VOICE[id].dur * 30);

/** E판 훅 목소리 낱말(E판 프레임, 3에서 시작). */
export const wdE = (i: number) => 3 + Math.round(VOICE.h1e.words[i][1] * 30);

/** A판 00 훅(0~89, 시험판 S22의 01A 그대로): 칩을 누르자마자 목록이 위에서부터 빠져 5박에 텅 빈다. */
export const A1 = {
  click: beat(2), // 31 「바꿨더니,」 끝
  drain: beat(3), // 46 「세션이」
  accent: beat(4), // 60 「다 사라졌어요」 버터
  empty: beat(5), // 75 마지막 줄이 빠짐
};
/**
 * A판 01 그대로(90~235, 10-18 유호님 「후킹능력이 좀 떨어져 … 조금 더 궁금하게 시작」 → 「사라짐 → 그대로 3초 오프닝」).
 * 6박에 되감겨 빠진 줄이 거꾸로 돌아오고 칩이 계정 1로. 이번엔 한도 막대가 찬 뒤 칩을 두 번 눌러도 목록이 그대로다.
 * 「그대로」는 드럼이 빠지는 12박(177)에 떨어진다(조용해지는 자리에서 낱말만 남게).
 */
export const Z = {
  rew: beat(6), // 90 되감기
  fill: wd('sum2', 3), // 123 「한도」 막대가 찬다
  click1: beat(10), // 148 「바꿔도」 계정 1 → 2. 목록은 그대로, 막대는 새 계정이라 6%
  click2: beat(11), // 163 계정 2 → 3, 그대로
  accent: wd('sum2', 8), // 177 「그대로」 버터
};
export const A2 = {
  fill: wd('s1', 2), // 「한도가」 막대가 찬다
  click: beat(10), // 「계정을 바꿔」 계정 칩
  drop: beat(12), // 드럼 빠짐: 빈 목록으로 붙는다
  drain: wd('s1', 7), // (E판) 「바꾸자마자」 목록이 빈다
};

/** 03~05: 폴더 셋 → 링크 → 거절. */
export const A3 = { source: S.s03 + 6, cards: wd('c1', 6) }; // 대화 원문 상자 · 「계정마다」 폴더 셋
export const A4 = {
  trick: wd('t1', 1), // 「꼼수를」 폴더 셋으로 다가간다
  all: wd('t1', 5), // 「전부」 링크가 될 두 폴더가 눌린 듯 짙어진다
  home: wd('t1', 6), // 「한」 본거지 테두리
  link1: beat(32), // 470 「가리키게」 첫 선
  link2: beat(34), // 500 「링크를」 둘째 선
};
export const A5 = { rows: wd('t2', 0), log: beat(39), err: beat(40), mark: wd('t2', 6) };

/** 06: 같은 거절 1,086번 → 세션 21개(시험판과 같은 짜임). */
export const B = {
  log: beat(45), // 661 실제 거절 줄이 흐른다
  land: beat(48), // 705 「천팔십육 번」 착지
  range: beat(49), // 720
  focus: beat(50), // 734 끝 세 줄
  fold: beat(51), // 749 세션 줄 21개(「두 시간」 750과 같은 박)
  grey: beat(54), // 793 「저장이」
  stamp: beat(56), // 822 다시 터지는 박
};
export const B_GREY_END = B.stamp - 4;

/** 07: 대화 원문에서 되살림. */
export const R = {
  source: wd('r1', 1), // 「대화」 대화 원문 경로 줄
  lean: wd('r1', 4), // 「있어서」 흐려진 줄로 다가간다
  back: wd('r1', 5), // 「기록을」 줄이 돌아오기 시작(R.done에 다 돌아옴)
  done: beat(63),
};

/** 08: 링크 걷기 → 25곳. */
export const M = { snap: wd('m1', 3), merge: beat(68), rows: beat(68.5), same: beat(72), punch: beat(73.5) };

/** 09: 시험판과 같은 짜임(지금 계정 칸 5.6배 → 물러남 → 물결). */
export const C = { add: beat(75), back: beat(75.5), ripple: beat(76.5) };
export const C_RIPPLE_END = C.ripple + 29;

/** 10a·10b. */
export const D = {
  zoom: beat(81.5), // 09 착지 쉼을 줄이고 지금 계정 칸으로 다시 붙는다
  swap: beat(81.5) + 15, // 칸이 사이드바가 된다
  click1: beat(84),
  click2: beat(86),
  dark: S.s10b,
  lines: [beat(88.25), beat(88.5), beat(88.75), beat(89)], // 넷이 빠르게 쌓이고, 「다른 계정 넷 · 모두 76」을 넘기기 전 1초 넘게 읽게 둔다
};

/** 11. 끝맺음은 104박(1525, 음악.mjs가 한 마디 늘림) = 「(링크) 보내」. */
export const F = {
  doc: S.s11,
  scroll: wd('f1a', 3),
  repo: wd('f1a', 9),
  comment: wd('cta', 0), // 「댓글에」 댓글칸에 불이 들어온다
  type: wd('cta', 1), // 「세션」 두 글자가 쳐진다
  send: beat(104), // 「보내」 = 음악 끝맺음, 댓글이 올라간다
  follow: wd('cta', 6), // 「팔로우하면」 팔로우 → 팔로잉
};
