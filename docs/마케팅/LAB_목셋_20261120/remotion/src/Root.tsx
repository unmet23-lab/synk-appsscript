import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './e57/Film';

// 11-20 LAB 영어 E57 「목 · 손목 · 발목」 — 원본 같은분야 「낱말을 글자 그대로 옮긴 장면」 여섯 개 잇기(기획.md 「원본 1:1」).
// 영어 판(e57-en), 장면 심사용(e57-scene — 머리 글 · 낱말 카드 · 이름표 없이 그림 · 말풍선 · 소리만).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e57-en" component={Film} defaultProps={{ loc: 'en' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e57-scene" component={Film} defaultProps={{ loc: 'en' as const, bare: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
