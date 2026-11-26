import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { Film, FPS, SceneBare } from './m54/Film';
import { FILM, fr, SCENE_FROM, SCENE_TO } from './m54/data';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="m54" component={Film} durationInFrames={fr(FILM)} fps={FPS} width={1080} height={1920} />
    <Composition id="m54-scene" component={SceneBare} durationInFrames={fr(SCENE_TO - SCENE_FROM)} fps={FPS} width={1080} height={1920} />
  </>
);
