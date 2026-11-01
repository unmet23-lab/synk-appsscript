import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './e24/Film';
import { FPS, TOTAL_FRAMES } from './e24/timeline';

export const RemotionRoot: React.FC = () => <Composition id="e24" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />;
