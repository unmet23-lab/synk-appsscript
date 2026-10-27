import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './film/Film';
import { FPS, TOTAL_FRAMES } from './film/timeline';
import { Film as Film2 } from './film2/Film';
import { TOTAL_FRAMES as TOTAL_FRAMES2 } from './film2/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="name-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* 다시 살림(10-28) — 예시 둘 · 한 칸씩 세기 */}
    <Composition id="name-en-v2" component={Film2} durationInFrames={TOTAL_FRAMES2} fps={FPS} width={1080} height={1920} />
  </>
);
