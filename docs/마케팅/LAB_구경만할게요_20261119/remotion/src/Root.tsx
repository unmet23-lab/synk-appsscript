import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './e48/Film';

// 11-19 LAB 영어 E48 「구경만 할게요」 — 원본 같은분야 Koreanadda 「쇼핑 낱말」 뼈대(기획.md 「원본 1:1」).
// 영어 판(e48-en), 장면 심사용(e48-scene — 머리 글 · 카드 없이 그림 · 말풍선 · 소리만).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e48-en" component={Film} defaultProps={{ loc: 'en' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e48-scene" component={Film} defaultProps={{ loc: 'en' as const, bare: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
