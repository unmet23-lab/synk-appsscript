import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './name/Film';
import { FPS, T, fr } from './name/data';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="name-mn" component={Film} durationInFrames={fr(T.total)} fps={FPS} width={1080} height={1920} />
  </>
);
