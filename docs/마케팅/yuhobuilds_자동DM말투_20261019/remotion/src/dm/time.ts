// 박자표(30fps). 배경음은 음악.mjs가 「Building Momentum」(122.863 BPM)을 이 편 이야기에 맞춰 마디 단위로 잘라 붙인 bgm.wav.
// 박 격자가 끊기지 않아 beat(k)를 그대로 쓴다. 이 편의 음악 사건: 12 드럼 빠짐 · 16 다시 터짐 · 28~36 조용 · 36 다시 터짐 ·
// 52~56 드럼 빠짐 · 56 다시 터짐 · 76~80 드럼 빠짐 · 80 다시 터짐 · 92 끝맺음.
import { beat } from '../lib/beat';
import { VOICE } from './vo.generated';

export type Line = keyof typeof VOICE;

/** 줄이 시작하는 프레임(범수 실제 길이로 잡음, 줄 사이 0.27초 이상). */
export const VO: Record<Line, number> = {
  h1: 3, // 0~3.6초 「괜찮냐고 물으면 … "아니요"부터」
  sum: beat(9) + 2, // 되감긴 뒤 「지금은 이렇게 답해요」
  c1: beat(14) + 3, // 지금 답이 머문 뒤 바로(검수 P2: 훅 뒤 2.3초 빈칸 → 「평균 18초」 뒤로 숨을 옮김). 「'세션'」은 다시 터지는 16박 뒤
  t1: beat(28) + 3, // 조용한 구간 「그런데」
  d1: beat(36) + 3, // 다시 터지는 박 「받는 사람 화면으로」
  d2: beat(44) + 2, // 예시 셋
  d3: beat(56) + 2, // 다시 터지는 박 「다 고쳤어요」
  e1: beat(60) + 3, // 「그리고 정해진 답에 없는 질문은」
  e2: beat(69) + 3, // 「모르는 건」
  f1: beat(77) + 3, // 드럼 빠짐 안 「AI 티는 기능이 아니라」
  cta: beat(85) + 3, // 「받아 본 자동 DM 중에」 — 끝맺음(92박)이 「주세요」 끝에
  fo: beat(92) + 12, // 「팔로우하면 다음 도구도 보여 드릴게요」(세션 공유 편 줄, 여운 위)
};

export const LINES = Object.keys(VO) as Line[];

type W = readonly [string, number, number];
/** 줄 id의 i번째 낱말이 시작하는 프레임. */
export const wd = (id: Line, i: number) => VO[id] + Math.round((VOICE[id].words[i] as W)[1] * 30);
/** 줄 id의 i번째 낱말이 끝나는 프레임. */
export const wdEnd = (id: Line, i: number) => VO[id] + Math.round((VOICE[id].words[i] as W)[2] * 30);
/** 줄이 끝나는 프레임. */
export const lineEnd = (id: Line) => VO[id] + Math.round(VOICE[id].dur * 30);

/** 장면. */
export const S = {
  rew: beat(8), // 01 되감기(거꾸로 whoosh)
  newAccent: beat(12), // 드럼 빠짐: 지금 답 「걱정하지 않으셔도 돼요」 테두리
  s02: beat(16), // 다시 터지는 박: 판이 보낸 DM 목록으로
  s03: beat(28), // 조용해지는 박: 미리보기가 같은 꼬리 줄로
  s04: beat(36), // 다시 터지는 박: 일곱 줄 점검표
  s05: beat(44), // 예시 셋
  fix: beat(56), // 다시 터지는 박 「다 고쳤어요」: 지금 나가는 정해진 답 셋
  s06: beat(60), // 위로 넘김(「그리고」): 이어 답하기. 넘기는 동안 머리글 자리를 비워 둔다(밝은 판이 흰 머리글 밑을 지나가지 않게)
  s07: beat(69), // 다른 대화: 안내 자료에 없는 질문 → 직접 확인 → 알림
  s08: beat(77), // 두 말풍선만(「AI 티는」)
  s09: beat(85), // 위로 넘김: 프로필 카드
};

/** 끝(마지막 말 뒤 여운 1초). */
export const TOTAL = lineEnd('fo') + 30;
