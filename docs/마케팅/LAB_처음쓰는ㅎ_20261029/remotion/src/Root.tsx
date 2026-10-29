import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './film/Film';
import { FPS, TOTAL_FRAMES } from './film/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="hieut-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 두 채널 판(기획장부/LAB.md 머리말) — 샤오훙수 간체. 영어 목소리 없이 「히읗.」만 */}
    <Composition id="hieut-zhs" component={Film} defaultProps={{ loc: "zhs" as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
