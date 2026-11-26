import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { Film, FPS } from './e64/Film';
import { FILM, fr } from './e64/data';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e64" component={Film} durationInFrames={fr(FILM)} fps={FPS} width={1080} height={1920} />
  </>
);
