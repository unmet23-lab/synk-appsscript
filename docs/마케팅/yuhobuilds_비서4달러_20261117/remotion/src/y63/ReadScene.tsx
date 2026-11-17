// 핵심 장면 — 게시물 하나를 보내면, 비서가 10월 21일부터 쌓인 대화를 맨 아래 장부터 다시 훑고(53만 토큰), 4.18달러 꼬리표가 찍힌다.
// t = 이 장면 안의 초. 편에서는 이 장면을 그대로 넣고 끝 3초에 다시 부른다.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { IN_OUT, mix } from '../lib/motion';
import { BEFORE_IN, SHARES } from './data';
import { Counter, DayChip, followPan, N, NewBubble, PAN_BOTTOM, PriceTag, STAGE, Tower } from './Tower';

export const READ = {
  drop: 0.0, // 새 말풍선이 탑 꼭대기에 떨어진다
  fall: 0.75, // 카메라가 맨 아래로 떨어진다
  scan: 1.3, // 맨 아래 장부터 다시 훑기 시작
  top: 4.3, // 꼭대기에 닿음 — 꼬리표 쿵
  len: 5.6,
};

const ease = (t: number, a: number, b: number, e = IN_OUT) => (t <= a ? 0 : t >= b ? 1 : e((t - a) / (b - a)));

/** 훑는 자리 — 처음엔 천천히, 가운데 빠르게, 끝에서 조금 늦춘다. */
const scanAt = (t: number) => ease(t, READ.scan, READ.top, (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)) * N;

export const ReadScene: React.FC<{ t: number; label?: string; showCounter?: boolean; tagUsd?: number; counterTop?: number }> = ({ t, label = 'AI 비서가 다시 읽은 양', showCounter = true, tagUsd = SHARES[4].usd, counterTop = 540 }) => {
  const drop = ease(t, READ.drop, READ.drop + 0.45, (x) => 1 - Math.pow(1 - x, 3));
  const fall = ease(t, READ.fall, READ.scan - 0.05);
  const s = t < READ.scan ? 0 : Math.min(N, scanAt(t));
  // 카메라 — 맨 위(0) → 맨 아래로 떨어짐 → 띠를 따라 올라감 → 꼭대기
  const pan = t < READ.scan ? mix(0, PAN_BOTTOM, fall) : followPan(Math.min(N - 1, s));
  const tag = t >= READ.top ? ease(t, READ.top, READ.top + 0.22, (x) => 1 - Math.pow(1 - x, 3)) : 0;
  const slam = t >= READ.top ? Math.max(0, 1 - (t - READ.top) / 0.35) : 0;
  const value = Math.round((s / N) * BEFORE_IN);
  // 꼭대기에 닿는 순간 꼬리표 쪽으로 한 번에 다가가는 컷(원본 박자 자리), 그 뒤 천천히 물러남. 계기판은 그대로 둔다.
  const cut = t >= READ.top ? 1.12 - 0.07 * ease(t, READ.top + 0.03, READ.len) : 1;
  const shake = slam > 0 ? Math.sin((t - READ.top) * 70) * 7 * slam : 0;
  return (
    <AbsoluteFill style={{ transform: `translateY(${shake}px)` }}>
      <AbsoluteFill style={{ transform: `scale(${cut})`, transformOrigin: '62% 54%' }}>
        <Tower pan={pan} s={s} extraTop={<NewBubble p={drop} />} picGlowAll={t >= READ.top ? 0.6 * slam : 0} />
        <DayChip s={s} pan={pan} p={t >= READ.scan ? Math.min(1, (t - READ.scan) / 0.15) * (1 - ease(t, READ.top - 0.2, READ.top)) : 0} />
        <PriceTag usd={tagUsd} p={tag} left={400} top={950} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 860, background: `linear-gradient(180deg, ${STAGE} 0%, ${STAGE} 86%, rgba(236,233,225,0) 100%)` }} />
      {showCounter ? <Counter value={value} label={label} top={counterTop} flash={slam * 0.9} scale={1 + 0.08 * slam} /> : null}
    </AbsoluteFill>
  );
};
