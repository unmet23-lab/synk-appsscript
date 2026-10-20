// 키즈판 그림: GPT 이미지 2.5(ChatGPT 구독 · Codex CLI)로 이 편을 위해 한 판에 구워 오린 펠트 그림.
// 관용구 퀴즈 #4(10-20): 판·지시문은 ../판/(판2 그림 개그 셋 · 뜻 그림 셋, bake2 계정 한 장), 오리기는 tools/펠트판_칸오리기.py(3×2).
// 진행자 몽글은 퀴즈 #2(S23, 10-17 구움)의 여섯 표정 컷과 눈 감은 컷을 그대로 쓴다 — 연재 진행자라 표정·소품(돋보기·땀·모래시계·폭죽·버저)이 이 편에도 맞고, 판 한 장을 아낀다.
import { T } from '../film/timeline';

export const KIDS_ART = [
  { literal: 'img/kids/lit_bean.webp', meaning: 'img/kids/mean_scared.webp' },
  { literal: 'img/kids/lit_drop.webp', meaning: 'img/kids/mean_startled.webp' },
  { literal: 'img/kids/lit_big.webp', meaning: 'img/kids/mean_brave.webp' },
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
