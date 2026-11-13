import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './e37/Film';
import { FPS, TOTAL_FRAMES } from './e37/timeline';

// 장면 심사(e37-scene)는 화면 글 없이 장면 · 조각의 한글 · 소리만 — npx remotion render e37-scene --frames=<SCENE.from×30>-<SCENE.to×30 − 1>
const Scene: React.FC = () => <Film scene />;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e37-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{}} />
    <Composition id="e37-zhs" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ loc: 'zhs' as const }} />
    <Composition id="e37-my" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ loc: 'my' as const }} />
    <Composition id="e37-scene" component={Scene} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
