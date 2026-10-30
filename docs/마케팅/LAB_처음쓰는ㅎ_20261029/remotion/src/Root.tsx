import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './film/Film';
import { FPS, TOTAL_FRAMES } from './film/timeline';
import { Film4 } from './film4/Film4';
import { TOTAL_FRAMES as TOTAL4 } from './film4/timeline4';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="hieut-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 두 채널 판(기획장부/LAB.md 머리말) — 샤오훙수 간체. 영어 목소리 없이 「히읗.」만 */}
    <Composition id="hieut-zhs" component={Film} defaultProps={{ loc: "zhs" as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* v4(10-30 다시 살림) 「haha → 하하」 — 원본 sJgXggLWheU 「Print vs. Cursive」 */}
    <Composition id="haha-en" component={Film4} durationInFrames={TOTAL4} fps={FPS} width={1080} height={1920} />
    {/* 두 채널 판 — 샤오훙수 간체(영어 목소리 없이 그 말을 화면 글로, 「하하.」만 소리) */}
    <Composition id="haha-zhs" component={Film4} defaultProps={{ loc: 'zhs' as const }} durationInFrames={TOTAL4} fps={FPS} width={1080} height={1920} />
  </>
);
