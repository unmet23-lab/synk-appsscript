import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './e32/Film';
import { FPS, TOTAL_FRAMES } from './e32/timeline';

// 장면 심사(e32-scene)는 머리 글 · 풀이 없이 장면의 말 · 소리만
const Scene: React.FC = () => <Film lang="en" scene />;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e32-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'en' as const }} />
    <Composition id="e32-cn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'cn' as const }} />
    <Composition id="e32-mm" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'mm' as const }} />
    {/* 장면 심사: npx remotion render e32-scene --frames=9-188 */}
    <Composition id="e32-scene" component={Scene} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
