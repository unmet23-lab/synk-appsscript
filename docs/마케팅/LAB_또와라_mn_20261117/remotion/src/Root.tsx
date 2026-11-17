import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './m60/Film';

// 11-17 LAB 몽골 M60 「-어라 · 또 와라」 — 우리편 원본 M22 「-지 마」 뼈대(기획.md 「원본 1:1」).
// 몽골 판(m60-mn), 장면 심사용(m60-scene — 위 글 · 카드 없이 그림 · 말풍선 · 소리만).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="m60-mn" component={Film} defaultProps={{ bare: false }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="m60-scene" component={Film} defaultProps={{ bare: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
