import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film, FPS, TOTAL_FRAMES } from './e40/Film';

// 11-16 LAB 영어 E40 「전기장판」 — 원본 같은분야 TTMIK 「My kids didn't know this Korean word」 뼈대(기획.md 「원본 1:1」).
// 영어 판(e40-en)과 두 채널 판(e40-zhs · e40-my — 글이 다 찬 판만 쓴다), 장면 심사용(e40-scene — 글 없이 그림과 소리만).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e40-en" component={Film} defaultProps={{ loc: 'en' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e40-zhs" component={Film} defaultProps={{ loc: 'zhs' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e40-my" component={Film} defaultProps={{ loc: 'my' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e40-scene" component={Film} defaultProps={{ loc: 'en' as const, bare: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
