import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m28/Film';
import { FPS, TOTAL_FRAMES } from './m28/timeline';

export const RemotionRoot: React.FC = () => (
  <Composition id="m28" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
);
