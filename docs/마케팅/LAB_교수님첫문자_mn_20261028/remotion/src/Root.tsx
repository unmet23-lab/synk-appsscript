import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './chat/Film';
import { FPS, TOTAL_FRAMES } from './chat/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="prof-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 10-28 두 채널 판(기획장부/LAB.md 머리말 「두 채널 판」 2번) — 샤오훙수 간체 · 틱톡 버마어(@synklab.mm). 판별 글은 data.ts LOCS */}
    <Composition id="prof-zhs" component={Film} defaultProps={{ loc: 'zhs' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="prof-mm" component={Film} defaultProps={{ loc: 'mm' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
