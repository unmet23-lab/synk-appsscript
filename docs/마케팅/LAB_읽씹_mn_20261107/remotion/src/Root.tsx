import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './chat/Film';
import { FPS, TOTAL_FRAMES } from './chat/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ilssip-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 한 장면 먼저(제작 절차 「오마주」 2) — 위 띠 글 · 꼬리표 · 카드 없이 장면만. --frames로 그 구간을 굽는다 */}
    <Composition id="ilssip-scene" component={Film} defaultProps={{ plain: true }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
