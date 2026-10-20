// v7 박자표(30fps). 배경음은 음악_v7.mjs가 자른 bgm_v7.wav(122.863 BPM): 12 드럼 빠짐 · 16 다시 터짐 · 44~48 드럼 빠짐(「사용량 한도에 걸렸는데」) ·
// 48 다시 터짐(「다시 이었어요」) · 84 끝맺음(프로필 카드). 줄 사이 숨은 0.4초 안팎(말이 끊기지 않게), 화면은 1.5~2초마다 바뀐다.
import { beat } from '../lib/beat';
import { VOICE } from './vo.generated';

export const VO = {
  h1: 3, // 「SNS 업로드 자동화, 사람이 할 일은 "올려" 한 마디」 — 0프레임부터 머리글(유호님 20:5x 「sns 업로드 자동화, 이렇게 표현하는게」)
  h2: 106, // 「첫날인 오늘 세 편. 따라 하실 수 있게 세 단계로, 끝엔 체크리스트」
  s1: 235, // 「첫째, 소재는 월요일에 …」
  s1b: 407, // 「예약이 텅 비어도, 만들 건 이 후보에서 골라요」
  s2: 489, // 「둘째, 제작은 매일 아침 일곱 시로 걸어 뒀어요 …」
  s2b: 628, // 「오늘은 셋 다 사용량 한도에 멈췄는데 …」 — 44박(646) 드럼 빠짐이 「사용량」, 48박(705)이 「다시 이었어요」 무렵
  s3: 750, // 「셋째, 게시는 "올려" 한 마디 …」
  s3b: 892, // 「채널마다 예약 화면이 달라서 …」
  c1: 1027, // 「정리하면 넷 …」
  cta: 1154, // 「저장해 두고 하나씩 따라 해 보세요」
  fo: beat(84) + 14, // 「팔로우하면 다음 편도 보여 드릴게요」(프로필 카드)
} as const;

export type Spoken = keyof typeof VO;
export const LINES = Object.keys(VO) as Spoken[];

type W = readonly [string, number, number];
export const wd = (id: Spoken, i: number) => VO[id] + Math.round((VOICE[id].words[i] as W)[1] * 30);
export const wdEnd = (id: Spoken, i: number) => VO[id] + Math.round((VOICE[id].words[i] as W)[2] * 30);
export const lineEnd = (id: Spoken) => VO[id] + Math.round(VOICE[id].dur * 30);

/** 장면(판이 바뀌는 프레임). */
export const S = {
  cards: VO.h2, // 세 편의 실제 0초 화면
  s1: VO.s1, // ① 소재: 월요일 스캔 작업 → 후보 7개 문서
  s1b: VO.s1b, // 채널 12칸(예약 0) → ✕
  s2: VO.s2, // ② 제작: 매일 작업 세 줄 → 최종본
  s2b: VO.s2b, // 세션 셋 멈춤 → 「이어서 해」
  s3: VO.s3, // ③ 게시: 14:00 작업 → 예약 큐
  s3b: VO.s3b, // 실제 캡처 넷 → 한 곳
  c1: VO.c1, // 체크리스트 카드
  end: beat(84), // 위로 넘김: 프로필 카드(끝맺음)
};

export const TOTAL = lineEnd('fo') + 15; // 끝 여운 0.5초(조율 세션 검수: 1.1초는 길다)
