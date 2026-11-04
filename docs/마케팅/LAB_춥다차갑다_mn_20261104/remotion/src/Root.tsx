import './lib/fonts';
import React from 'react';
import { Composition } from 'remotion';
import { Film } from './m29/Film';
import { FPS, TOTAL_FRAMES } from './m29/timeline';

export const RemotionRoot: React.FC = () => <Composition id="m29" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />;
