// 색과 글자 — v6(2026-11-10). v5까지는 만족 사례 S17 · S29의 「만화 글자(흰 글자 + 두꺼운 남색 테 + 그림자) · 물방울 바탕 ·
// 두꺼운 테 상자」였다. 미학 맹검(11-10 음식 편 — 넷 가운데 셋 기각)이 그 겉모습을 「굵은 테두리 글꼴 · 구식 학습지 보기 판」으로 짚었고,
// 영상 글자 정본(docs/브랜드_폰트_정본.md §10)도 「흰 굵은 글자 + 검은 테 · 그림자」를 버렸다(11-03).
// v6: 테 · 그림자 없는 글자를 색 판(남색 · 크림) 위에 올리고, 바탕은 문제마다 깊은 펠트 색 한 면(물방울 무늬 뺌), 위계는 크기 · 색으로.
import type React from 'react';
import { KO, LOC } from './fonts';

export const K = {
  navy: '#1B2A5A',
  ink: '#141F45',
  white: '#FFFFFF',
  cream: '#FFF6DC',
  paper: '#FFFBEF',
  coral: '#F96859',
  butter: '#F5C445',
  meadow: '#4E9A50',
  pop: '#E05C97',
  sky: '#C9D8F6',
  grey: '#9AA3BD',
};

/** 무대 색 이름 → 바탕 두 색(가운데 · 가장자리). 은행 「개그 무대」의 색 칸이 이 이름을 쓴다(설계 23 — 문제마다 돌린다).
 *  크림 글자가 테 없이 읽히게 v5보다 깊다. */
export const STAGE_BG: Record<string, [string, string]> = {
  청금석: ['#3A62BC', '#27458F'],
  청록: ['#25796F', '#185850'],
  자두: ['#7449A8', '#52317F'],
  노을: ['#BC5334', '#8C3A22'],
  숲: ['#417E3C', '#2C5C2A'],
  밤하늘: ['#34438A', '#1F275C'],
  딸기: ['#BB4664', '#8D2F49'],
  겨자: ['#A87A14', '#7C590A'],
};
export const stageBg = (name?: string): [string, string] => STAGE_BG[name ?? ''] ?? STAGE_BG['청금석'];

/** 글자 한 줄(테 · 그림자 없음). font 'loc'은 그 판본 언어 글꼴(fonts.ts LOC). */
export const type = (size: number, opts: { color?: string; font?: 'ko' | 'loc'; weight?: number; line?: number } = {}): React.CSSProperties => ({
  font: `${opts.weight ?? 800} ${size}px/${opts.line ?? 1.14} ${opts.font === 'loc' ? LOC : KO}`,
  color: opts.color ?? K.cream,
  letterSpacing: opts.font === 'loc' ? '0.004em' : '-0.025em',
});

/** 색 판(테 없이 — 아래로 떨어지는 옅은 그늘 하나). */
export const plate = (bg: string = K.navy, radius = 28, depth = 6): React.CSSProperties => ({
  background: bg,
  borderRadius: radius,
  boxShadow: depth ? `0 ${depth}px 0 rgba(13, 20, 48, 0.28)` : 'none',
});

/** 펠트 조각처럼 — 가장자리 안쪽에 실땀 한 줄(점선). 장면 카드 · 복습 그림에 쓴다. */
export const stitch = (inset = 12, color = 'rgba(255, 246, 220, 0.85)', radius = 26): React.CSSProperties => ({
  position: 'absolute',
  inset,
  borderRadius: radius,
  border: `3px dashed ${color}`,
  pointerEvents: 'none',
});
