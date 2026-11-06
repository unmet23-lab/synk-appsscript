import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m19/Film';
import { FPS, TOTAL_FRAMES } from './m19/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="m19" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 11-06 두 채널 판 — 샤오훙수 간체 · 틱톡 버마어(같은 정본 · 같은 소리) */}
    <Composition id="m19-zhs" component={Film} defaultProps={{ loc: 'zhs' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="m19-my" component={Film} defaultProps={{ loc: 'my' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
