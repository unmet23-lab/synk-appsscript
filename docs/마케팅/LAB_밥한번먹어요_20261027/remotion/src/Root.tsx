import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './film/Film';
import { FPS, TOTAL_FRAMES } from './film/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="bap-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 10-27 두 채널 판(기획장부/LAB.md 머리말 3번) — 샤오훙수 간체만. 영어 해설 셋 없이 한국어 소리만(locale.ts) */}
    <Composition id="bap-zhs" component={Film} defaultProps={{ loc: 'zhs' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
