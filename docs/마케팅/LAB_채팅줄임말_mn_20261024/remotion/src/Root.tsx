import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './chat/Film';
import { FPS, TOTAL_FRAMES } from './chat/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="chat-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 10-27 두 채널 판(기획장부/LAB.md 대기 표 T1) — 틱톡 버마어(@synklab.mm). 판별 글은 data.ts LOCS */}
    <Composition id="chat-mm" component={Film} defaultProps={{ loc: 'mm' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 10-27 15시 회차 — 샤오훙수 간체(대기 표 T1 「간체판만 남음」) */}
    <Composition id="chat-zhs" component={Film} defaultProps={{ loc: 'zhs' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
