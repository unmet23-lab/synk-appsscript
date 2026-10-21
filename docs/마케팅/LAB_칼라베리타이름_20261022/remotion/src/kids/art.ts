// 키즈판 그림: GPT 이미지 2.5(ChatGPT 구독 · Codex CLI)로 이 편을 위해 한 판에 구워 오린 펠트 그림.
// 칼라베리타(10-22): 판·지시문은 ../판/(판1 — 위 줄 이름이 틀어진 칼라베리타 셋 · 아래 줄 금박 띠가 반듯한 칼라베리타 셋, 띠는 비워 두고 이름은 화면 글로 얹는다), 오리기는 tools/펠트_흰바탕오리기.py(3×2 판 모드).
// 진행자 몽글은 퀴즈 #2(S23, 10-17 구움)의 여섯 표정 컷과 눈 감은 컷을 그대로 쓴다 — 연재 진행자라 표정·소품(돋보기·땀·모래시계·폭죽·버저)이 이 편에도 맞고, 판 한 장을 아낀다.
import { T } from '../film/timeline';

export const KIDS_ART = [
  { literal: 'img/kids/lit_juan.webp', meaning: 'img/kids/mean_juan.webp' },
  { literal: 'img/kids/lit_regina.webp', meaning: 'img/kids/mean_regina.webp' },
  { literal: 'img/kids/lit_guillermo.webp', meaning: 'img/kids/mean_guillermo.webp' },
];

/** 정답 그림의 금박 띠 자리(그림 크기 w×h 기준 비율 — 오린 그림에 격자를 대고 잰 값, 10-22). 이름 글은 KidsQuestion이 그림과 같은 상자 안에 얹어 그림과 함께 움직인다. */
export const NAME_SPOT = [
  { w: 487, h: 442, cx: 0.497, cy: 0.245, sw: 0.6, sh: 0.16 },
  { w: 505, h: 491, cx: 0.503, cy: 0.428, sw: 0.53, sh: 0.13 },
  { w: 487, h: 446, cx: 0.5, cy: 0.243, sw: 0.6, sh: 0.16 },
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
