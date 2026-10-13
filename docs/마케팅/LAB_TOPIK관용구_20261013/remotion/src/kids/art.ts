// 키즈판 그림: GPT 이미지 2.5(ChatGPT 구독 · Codex CLI)로 이 편을 위해 한 판에 구워 오린 펠트 그림.
// 판·지시문·오리기: Documents/synk-vendor/lab-topik-kids/ (판1 몽글 진행자 6컷, 판2 그림 개그·뜻 그림 6개, 칸오리기.py — tools/펠트부품_오리기.py 위에 바닥·밑단·되살림).
import { T } from '../film/timeline';

export const KIDS_ART = [
  { literal: 'img/kids/lit_hands.webp', meaning: 'img/kids/mean_table.webp' },
  { literal: 'img/kids/lit_feet.webp', meaning: 'img/kids/mean_network.webp' },
  { literal: 'img/kids/lit_eyes.webp', meaning: 'img/kids/mean_judge.webp' },
];

/** 몽글 표정 컷(자리 고정·움직임 없음). 첫 문제 첫 2초는 표정도 그대로(릴스 훅 규칙). */
export const hostFor = (f: number, index: number) => {
  let face: string;
  if (index === 0 && f < T.card) face = 'curious';
  else if (f < T.guess) face = 'curious';
  else if (f < T.strike) face = 'shocked';
  else if (f < T.card) face = 'deadpan';
  else if (f < T.reveal) face = 'focused';
  else if (f < T.say) face = 'cheering';
  else face = 'happy';
  return `img/kids/host_${face}.webp`;
};

export const HOST_END = 'img/kids/host_cheering.webp';
