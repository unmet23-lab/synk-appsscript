import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './e25/Film';
import { FPS, TOTAL_FRAMES } from './e25/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e25-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'en' as const }} />
    <Composition id="e25-cn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'cn' as const }} />
    <Composition id="e25-mm" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ lang: 'mm' as const }} />
  </>
);
