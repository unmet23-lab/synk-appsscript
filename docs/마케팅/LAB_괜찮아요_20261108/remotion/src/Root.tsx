import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './e31/Film';
import { FPS, fr, SCENE, TOTAL_FRAMES } from './e31/timeline';

// 장면 심사(e31-scene)는 Film을 그 구간만큼 앞당겨 보인다 — 머리 글 · 풀이 없이 장면의 말 · 소리만
const Scene: React.FC = () => <Film lang="en" scene />;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e31-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'en' as const }} />
    <Composition id="e31-cn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'cn' as const }} />
    <Composition id="e31-mm" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'mm' as const }} />
    {/* 장면 심사: npx remotion render e31-scene --frames=<SCENE.from×30>-<SCENE.to×30 − 1> */}
    <Composition id="e31-scene" component={Scene} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ from: fr(SCENE.from) }} />
  </>
);
