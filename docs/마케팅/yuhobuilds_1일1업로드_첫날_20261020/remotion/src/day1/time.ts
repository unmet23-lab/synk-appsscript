// 박자표(30fps). 배경음은 음악.mjs가 「Building Momentum」(122.863 BPM)을 이 편 이야기에 맞춰 마디 단위로 잘라 붙인 bgm.wav.
// 박 격자가 끊기지 않아 beat(k)를 그대로 쓴다. 이 편의 음악 사건: 12 드럼 빠짐 · 16 다시 터짐(세 세션 줄) · 24 되감기(비움) ·
// 32 다시 · 56~60 드럼 빠짐 · 60 다시 터짐(「하루 한 편」 장면) · 92 끝맺음.
import { beat } from '../lib/beat';
import { VOICE } from './vo.generated';

export type Line = keyof typeof VOICE;

/** 줄이 시작하는 프레임(범수 실제 길이로 잡음). 끝 줄은 Fable 콘티 검수 H1대로 e1b(「내일부터 매일 한 편씩 올릴게요」). */
export const VO = {
  h1: 3, // 0~4.7초 「예약된 게시물 있냐고 물었더니 … 하나도 없대요」
  h2: beat(11) + 2, // 「그래서 AI 직원 셋에게」 — 「한 편씩」이 16박(다시 터짐)에
  h3: beat(19) + 2, // 「지금 이 영상도 그중 하나예요」
  c1: beat(24) + 3, // 되감기 「답이 오기까지 십칠 분」
  b1: beat(32) + 2, // ① 유튜브
  b2: beat(41) + 1, // ② 인스타(①에 쉼표로 이어 말함)
  b3: beat(49) + 2, // ③ 틱톡·샤오훙수
  t1: beat(60) + 14, // 「답을 듣고 정했어요」 — 위로 넘김(14프레임)이 끝난 뒤. 처음 판의 첫 음절 「그」는 넘김 소리·다시 터지는 박에 묻혀 뺐다(완성본 검수 P2-1)
  s1: beat(67) + 14, // 「월요일 트렌드 스캔에서 둘」 — t1 끝과 숨 0.43초
  s2: beat(77) + 16, // 「올리기만은 한 곳에서」 — s1 끝과 숨 0.43초(완성본 검수 P3)
  e1b: beat(87) + 10, // 「내일부터 매일 한 편씩 올릴게요」 — 장면 소리와 겹치지 않게(완성본 검수 P3)
  fo: beat(93) + 4, // 「팔로우하면 다음 편도 보여 드릴게요」
} as const;

export type Spoken = keyof typeof VO;
export const LINES = Object.keys(VO) as Spoken[];

type W = readonly [string, number, number];
/** 줄 id의 i번째 낱말이 시작하는 프레임. */
export const wd = (id: Spoken, i: number) => VO[id] + Math.round((VOICE[id].words[i] as W)[1] * 30);
/** 줄 id의 i번째 낱말이 끝나는 프레임. */
export const wdEnd = (id: Spoken, i: number) => VO[id] + Math.round((VOICE[id].words[i] as W)[2] * 30);
/** 줄이 끝나는 프레임. */
export const lineEnd = (id: Spoken) => VO[id] + Math.round(VOICE[id].dur * 30);

/** 장면. */
export const S = {
  s01: beat(12), // 드럼 빠짐: 판이 세션 목록으로
  rows: beat(16), // 다시 터짐: 새 세션 세 줄
  rew: beat(24), // 02 되감기: 시계가 거꾸로, 판이 12칸으로
  s03: beat(32), // ① 유튜브 API → 어두운 창
  s04: beat(41), // ② 인스타 실제 화면
  s05: beat(49), // ③ 틱톡 → 샤오훙수
  s06: beat(60), // 위로 넘김: 대화창 「1일 1 컨텐츠」
  s07: beat(67), // 문서 카드: 월요일 스캔
  s08: beat(77), // 세션 목록: 「게시/」가 한 곳으로
  s09: beat(87), // 세션 목록 아래 7칸 달력(오늘 ✓)
  s10: beat(92), // 위로 넘김: 프로필 카드
};

/** 끝(마지막 말 뒤 여운 1초). */
export const TOTAL = lineEnd('fo') + 30;
