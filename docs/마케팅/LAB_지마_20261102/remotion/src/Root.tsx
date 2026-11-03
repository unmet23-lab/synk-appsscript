import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './e21/Film';
import { FPS, TOTAL_FRAMES } from './e21/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e21" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 11-03 두 채널 판 — 샤오훙수 간체 · 틱톡 버마어(같은 정본 · 같은 소리) */}
    <Composition id="e21-zhs" component={Film} defaultProps={{ loc: 'zhs' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="e21-my" component={Film} defaultProps={{ loc: 'my' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
