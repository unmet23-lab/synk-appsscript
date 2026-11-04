// 말 랠리 — WORLD 캠퍼스 판의 상대 태오(2026-11-04). 동아리 탁구 시합에서 몽글 대신 태오 선배가 말을 걸고 공을 친다.
// 문항 글(content.mjs)은 그대로이고 목소리만 태오다 — 드라마 1화와 같은 배역 목소리(결정 10-30 「1화 두 역 목소리」)로
// 미리 구웠다(qa/world-campus-20261104/목소리굽기.mjs). 태오는 처음 만난 후배에게 해요체를 쓴다(드라마 1화 대본과 같은 말씨).
// LAB 화면은 이 파일의 목소리를 쓰지 않는다.

import { OPPONENT, castDir } from './world-cast.mjs';

export const WHO = OPPONENT.name;
export const WHO_FULL = `${OPPONENT.name} ${OPPONENT.title}`;
export const VOICE_DIR = `${castDir(OPPONENT)}/voice`;
export const itemVoice = (id) => `${VOICE_DIR}/${id}.mp3`;

/** 짧은 반응(11-04 유호님 「정답 맞췄을 때 · 틀렸을 때 · 연속으로 맞췄을 때 상호작용이 다양했으면」): 스매시 · 긴 랠리 · 틀림 · 연달아 틀림 · 오래 기다림마다 다른 말. */
export const REACT = Object.freeze({
  joy1: { text: '나이스!', tag: 'excited' },
  joy2: { text: '와, 잘 받네요!', tag: 'impressed' },
  wow1: { text: '대박! 계속 가요!', tag: 'amazed' },
  wow2: { text: '와, 진짜 잘하네요!', tag: 'amazed' },
  pump1: { text: '최고예요! 선수 같아요!', tag: 'laughing' },
  calm1: { text: '아, 아깝다!', tag: 'sympathetic' },
  calm2: { text: '괜찮아요. 다음 거!', tag: 'encouraging' },
  up1: { text: '괜찮아요. 천천히 해요.', tag: 'gently' },
  up2: { text: '할 수 있어요. 다시 해 봐요!', tag: 'encouraging' },
  wait1: { text: '천천히 골라요. 기다릴게요.', tag: 'gently' },
});
export const reactVoice = (k) => `${VOICE_DIR}/react-${k}.mp3`;

/** 안내 음성(narration.mjs)의 WORLD 판: 같은 자리 · 같은 뜻을 태오가 말한다. 결과 제목도 이 글이다(첫 문장 = 제목). */
export const NARRATION_WORLD = Object.freeze({
  intro: { text: '한 판 할래요? 내가 말하면, 알맞은 대답으로 받아쳐요!', tag: 'playfully' },
  practiceDone: { text: '좋아요! 이제 진짜 시작이에요.', tag: 'excited' },
  dailyIntro: { text: '오늘의 도전이에요! 오늘은 다 같은 공 열두 개예요.', tag: 'friendly' },
  dailyBest: { text: '와, 오늘 최고 기록이에요!', tag: 'excited' },
  result3: { text: '완벽해요! 하나도 안 놓쳤어요.', tag: 'impressed' },
  result2: { text: '아주 잘했어요! 거의 다 받아쳤어요.', tag: 'cheerfully' },
  result1: { text: '잘했어요! 다음엔 더 많이 받아칠 수 있어요.', tag: 'encouraging' },
  result0: { text: '괜찮아요. 한 판 더 해요!', tag: 'warmly' },
});
// narration.mjs의 줄 id(파일 이름)와 같게 둔다
export const NARRATION_FILE_ID = Object.freeze({ intro: 'intro', practiceDone: 'practice-done', dailyIntro: 'daily-intro', dailyBest: 'daily-best',
  result3: 'result-3', result2: 'result-2', result1: 'result-1', result0: 'result-0' });
export const narrationVoice = (key) => `${VOICE_DIR}/nar-${NARRATION_FILE_ID[key]}.mp3`;

/** 문항 한마디의 연기 꼬리표(줄마다 하나, 드라마 1화와 같은 꼴). 묻는 말은 궁금하게, 이어지는 말은 그 장면의 기분으로. */
const TAG = {
  p00: 'friendly', f01: 'cheerfully', f02: 'apologetic', f03: 'warmly', f04: 'warmly', f05: 'politely', f06: 'cheerfully', f07: 'gratefully',
  f08: 'cheerfully', f09: 'softly', f10: 'shyly', f11: 'curious', f12: 'warmly', f13: 'politely', f14: 'happily', f15: 'contentedly',
  f16: 'casually', f17: 'politely', f18: 'politely', f19: 'pleading', f20: 'warmly', f21: 'happily', f22: 'friendly', f23: 'warmly',
  w13: 'playfully', w08: 'curious',
};
export const tagFor = (item) => TAG[item.id] || (item.kind === 'answer' ? 'curious' : 'friendly');
