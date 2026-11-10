// 틀이 쓰는 진행 글(편마다 바뀌지 않는 글) — 판본 언어마다. 글 정본은 ui.json(ko = 원문, 언어마다 그 나라 말로 다시 쓴 글).
// 편마다 바뀌는 글(다리 글 · 보기 · 왜 · 풀이 · 끝 질문)은 episode.json. 새 언어는 ui.json에 한 칸을 더하고 세 겹 검수를 거친다.
import data from './ui.json';

export type Ui = {
  series: string; // 위 알약 연재 이름
  bridgeLabel: string; // 다리 글 첫 줄 「글자 그대로 옮기면:」
  but: string; // 「하지만 뜻은 전혀 달라요!」
  stamp: string; // 「글자 그대로」 줄에 찍는 도장
  question: string; // 보기 위 질문
  countLabel: string; // 보기 판 아래 한 줄
  right: string; // 정답 순간
  sayIt: string; // 따라 말하기 알약 이름
  sayHow?: string; // v6e: 첫 문제 따라 말하기 알약 「말할 때는 이렇게:」 — 제목(사전 꼴 「되다」)과 따라 말할 문장(「됐어요」)의 말끝이 왜 다른지(v5 GPT · 그록, v6d GPT)
  yourTurn: string; // 네 차례
  next: string; // 다음 문제 미리보기
  scoreNext: string; // 마지막 문제 미리보기(점수)
  level: (n: number) => string; // 동그라미 전환
  finish: string;
  hooks: [string, string]; // 둘째 · 셋째 문제 머리 알약
  duelHook: string; // 「둘 중 하나」 문제 머리 알약(v4 — 「다음은 더 어려워요」 뒤 보기가 둘로 줄어 오히려 쉬워 보였다, v3 opus)
  howMany: string;
  comment: string; // 끝 댓글 부탁
  seeYou: string; // 끝 인사
  koCount: [string, string, string]; // 한국어로 들리는 셋 · 둘 · 하나(숫자 옆 이름표)
  recapTitle: string; // 끝 복습 위 제목 「진짜 뜻은:」
};

type Raw = Omit<Ui, 'level'> & { level: string };

export const uiFor = (code: string): Ui => {
  const u = (data as unknown as Record<string, Raw | undefined>)[code];
  if (!u || code === 'ko' || code.startsWith('_')) throw new Error(`틀 진행 글(src/ui.json)에 ${code} 칸이 없다 — 그 언어 줄을 더하고 세 겹 검수를 거친다`);
  return { ...u, level: (n: number) => u.level.replace('{n}', String(n)) };
};
