import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './e36/Film';
import { FPS, TOTAL_FRAMES } from './e36/timeline';

// 장면 심사(e36-scene)는 화면 글 없이 장면의 말 · 소리만 — npx remotion render e36-scene --frames=<SCENE.from×30>-<SCENE.to×30 − 1>
const Scene: React.FC = () => <Film scene />;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e36-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{}} />
    <Composition id="e36-scene" component={Scene} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
