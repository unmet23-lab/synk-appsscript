import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './film/Film';
import { FPS, TOTAL_FRAMES } from './film/timeline';
import { FilmV4 } from './film/FilmV4';
import { TOTAL_FRAMES as TOTAL_V4 } from './film/timelineV4';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ppal-en" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* v4 다시 살림(10-28): 종이 시험을 0초에, 귀 시험은 끝 댓글 놀이로 */}
    <Composition id="ppal-en-v4" component={FilmV4} durationInFrames={TOTAL_V4} fps={FPS} width={1080} height={1920} />
  </>
);
