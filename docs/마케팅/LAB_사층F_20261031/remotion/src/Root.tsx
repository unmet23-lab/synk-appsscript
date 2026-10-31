import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './e19/Film';
import { FPS, TOTAL_FRAMES } from './e19/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e19" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 두 채널 판(기획장부/LAB.md 머리말) — 샤오훙수 간체 · 틱톡 버마어. 소리는 영어판과 같은 한국어 소진 줄 · 효과음 */}
    <Composition id="e19-zhs" component={Film} defaultProps={{ loc: 'zhs' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e19-my" component={Film} defaultProps={{ loc: 'my' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
