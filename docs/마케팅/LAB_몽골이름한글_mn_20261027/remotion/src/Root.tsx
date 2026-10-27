import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './name/Film';
import { FPS, T, fr } from './name/data';
import { Film as Film2 } from './name2/Film';
import { TOTAL_FRAMES as TOTAL_FRAMES2 } from './name2/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="name-mn" component={Film} durationInFrames={fr(T.total)} fps={FPS} width={1080} height={1920} />
    {/* 다시 살림(10-28) — 이름표에 바트바야르를 한 칸씩 쓰며 3음절 → 5음절 */}
    <Composition id="name-mn-v2" component={Film2} durationInFrames={TOTAL_FRAMES2} fps={FPS} width={1080} height={1920} />
  </>
);
