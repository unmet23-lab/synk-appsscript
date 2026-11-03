import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './e20/Film';
import { FPS, TOTAL_FRAMES } from './e20/timeline';

export const RemotionRoot: React.FC = () => <Composition id="e20" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />;
