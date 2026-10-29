import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './wayo/Film';
import { FPS, TOTAL_FRAMES } from './wayo/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="wayo-mn" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
