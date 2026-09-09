import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, staticFile, useVideoConfig} from 'remotion';
import {Background, Finish} from './Frame';
import {ContentScene} from './ContentScene';
import {ListeningScene} from './ListeningScene';
import {theme} from './theme';
import type {ContentItem} from './types';

export const AccountVideo: React.FC<{item: ContentItem}> = ({item}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const listening = item.id === '01-lab-youtube';
  let offset = 0;
  const soundtrack = listening ? 'BGM_산뜻.wav' : 'BGM_60초.wav';
  return <AbsoluteFill>
    {listening ? <ListeningScene item={item} /> : <>
      <Background />
      {item.scenes.map((scene, index) => {
        const from = offset;
        const duration = Math.round(scene.duration * fps);
        offset += duration;
        return <Sequence key={index} from={from} durationInFrames={duration} premountFor={fps}><ContentScene scene={scene} item={item} index={index} /></Sequence>;
      })}
      <Finish />
    </>}
    <Audio src={staticFile(`계정별20260909/${soundtrack}`)} volume={(f) => interpolate(f,
      [0, fps * 0.6, durationInFrames - fps * 0.8, durationInFrames - 1],
      [0, listening ? 0.72 : 0.31, listening ? 0.72 : 0.31, 0],
      {easing: theme.ease.inOut, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
  </AbsoluteFill>;
};
