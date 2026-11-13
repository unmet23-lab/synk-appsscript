import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m36/Film';
import { FPS, TOTAL_FRAMES } from './m36/timeline';

// 장면 심사(m36-scene)는 화면 글 없이 장면의 말 · 소리만 — npx remotion render m36-scene --frames=<SCENE.from×30>-<SCENE.to×30 − 1>
const Scene: React.FC = () => <Film scene />;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="m36-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{}} />
    <Composition id="m36-scene" component={Scene} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
