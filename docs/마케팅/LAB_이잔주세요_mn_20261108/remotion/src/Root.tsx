import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m33/Film';
import { FPS, SCENE_FRAMES, TOTAL_FRAMES } from './m33/timeline';

const Scene: React.FC = () => <Film scene />;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="m33" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="m33-scene" component={Scene} durationInFrames={SCENE_FRAMES} fps={FPS} width={1080} height={1920} />
  </>
);
