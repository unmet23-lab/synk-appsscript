import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { Film, FPS, SceneBare } from './e64/Film';
import { FILM, fr, SCENE } from './e64/data';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e64" component={Film} durationInFrames={fr(FILM)} fps={FPS} width={1080} height={1920} />
    <Composition id="e64-scene" component={SceneBare} durationInFrames={fr(SCENE)} fps={FPS} width={1080} height={1920} />
  </>
);
