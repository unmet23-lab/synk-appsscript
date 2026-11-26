import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { Film, FPS, SceneBare } from './m82/Film';
import { FILM, fr, SCENE_FROM, SCENE_TO } from './m82/data';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="m82" component={Film} durationInFrames={fr(FILM)} fps={FPS} width={1080} height={1920} />
    {/* 두 채널 판(11-26 15시 회차) — 샤오훙수 간체 · 틱톡 버마어 */}
    <Composition id="m82-CN" component={Film} defaultProps={{ k: 'CN' as const }} durationInFrames={fr(FILM)} fps={FPS} width={1080} height={1920} />
    <Composition id="m82-MM" component={Film} defaultProps={{ k: 'MM' as const }} durationInFrames={fr(FILM)} fps={FPS} width={1080} height={1920} />
    <Composition id="m82-scene" component={SceneBare} durationInFrames={fr(SCENE_TO - SCENE_FROM)} fps={FPS} width={1080} height={1920} />
  </>
);
