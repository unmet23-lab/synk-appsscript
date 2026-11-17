import './lib/fonts';
import './lib/편서체';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './film/Film';
import { FPS, TOTAL_FRAMES } from './film/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="memo-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 한 장면 먼저(제작 절차 「오마주」 2) — 위 글 · 이름표 · 목소리 없이 핵심 장면만. --frames로 그 구간을 굽는다 */}
    <Composition id="memo-scene" component={Film} defaultProps={{ plain: true, scene: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
