import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './price/Film';
import { FPS, TOTAL_FRAMES } from './price/timeline';

export const RemotionRoot: React.FC = () => (
  <Composition id="price-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
);
