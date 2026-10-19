// 키즈판 그림: GPT 이미지 2.5(ChatGPT 구독 · Codex CLI)로 이 편을 위해 한 판에 구워 오린 펠트 그림.
// 관용구 퀴즈 #3(10-19): 판·지시문은 ../판/(판1 민트 요리사 모자 몽글 진행자 6컷 · 판2 그림 개그·뜻 그림 6개), 오리기는 tools/펠트판_칸오리기.py(bake2 계정).
// 흰 요리사 모자 판(판1_074138)은 흰 바탕과 함께 깎여서 버리고 민트 모자로 다시 구웠다(판1_075145).
import { T } from '../film/timeline';

export const KIDS_ART = [
  { literal: 'img/kids/lit_seaweed.webp', meaning: 'img/kids/mean_fail.webp' },
  { literal: 'img/kids/lit_porridge.webp', meaning: 'img/kids/mean_easy.webp' },
  { literal: 'img/kids/lit_kimchi.webp', meaning: 'img/kids/mean_early.webp' },
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
