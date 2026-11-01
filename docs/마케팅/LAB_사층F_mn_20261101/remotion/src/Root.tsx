import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m20/Film';
import { FPS, TOTAL_FRAMES } from './m20/timeline';

export const RemotionRoot: React.FC = () => <Composition id="m20" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />;
