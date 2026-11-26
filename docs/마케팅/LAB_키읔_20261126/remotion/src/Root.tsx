import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { Film, FPS, SceneBare } from './e52/Film';
import { FILM, fr, SCENE_FROM, SCENE_TO } from './e52/data';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="e52" component={Film} durationInFrames={fr(FILM)} fps={FPS} width={1080} height={1920} />
    <Composition id="e52-scene" component={SceneBare} durationInFrames={fr(SCENE_TO - SCENE_FROM)} fps={FPS} width={1080} height={1920} />
  </>
);
