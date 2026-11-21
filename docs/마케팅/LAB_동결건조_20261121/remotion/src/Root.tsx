import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './e58/Film';

// 11-21 LAB 영어 E58 「엄마 동결건조하고 싶다」 — 원본 같은분야 「시험 날 한국 할머니가 '엿 먹어라!'」(기획.md 「원본 1:1」).
// 영어 판(e58-en), 장면 심사용(e58-scene — 표지 · 꼬리표 · 머리 줄 없이 그림 · 말풍선 · 소리만).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e58-en" component={Film} defaultProps={{ loc: 'en' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e58-scene" component={Film} defaultProps={{ loc: 'en' as const, bare: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
