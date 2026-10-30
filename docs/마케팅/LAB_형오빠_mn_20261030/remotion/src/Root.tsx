import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m19/Film';
import { FPS, TOTAL_FRAMES } from './m19/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="m19" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
