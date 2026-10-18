// 키즈판 그림: GPT 이미지 2.5(ChatGPT 구독 · Codex CLI)로 이 편을 위해 한 판에 구워 오린 펠트 그림.
// 관용구 퀴즈 #2(10-17): 판·지시문은 ../판/(판1 몽글 진행자 6컷 · 판2 그림 개그·뜻 그림 6개 · 판3 배꼽 다시 굽기), 오리기는 tools/펠트판_칸오리기.py → tools/펠트조각_흰테걷기.py.
import { T } from '../film/timeline';

export const KIDS_ART = [
  { literal: 'img/kids/lit_mouth.webp', meaning: 'img/kids/mean_secret.webp' },
  { literal: 'img/kids/lit_ears.webp', meaning: 'img/kids/mean_ads.webp' },
  { literal: 'img/kids/lit_navel.webp', meaning: 'img/kids/mean_laugh.webp' },
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
