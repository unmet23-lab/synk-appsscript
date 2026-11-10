import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m40/Film';
import { FPS, TOTAL_FRAMES } from './m40/timeline';

// 장면 심사(m40-scene)는 위 띠 글 · 풀이 카드 없이 장면 · 대화 · 소리만 — npx remotion render m40-scene --frames=0-155
const Scene: React.FC = () => <Film lang="mn" scene />;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="m40-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'mn' as const }} />
    <Composition id="m40-cn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'cn' as const }} />
    <Composition id="m40-mm" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'mm' as const }} />
    <Composition id="m40-scene" component={Scene} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
