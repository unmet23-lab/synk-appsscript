import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {file} from './Frame';
import {theme} from './theme';
import type {ContentItem} from './types';

// A standalone listening vignette, not a recording of or mutation to the live radio.
export const ListeningScene: React.FC<{item: ContentItem}> = ({item}) => {
  return <AbsoluteFill style={{background: theme.ink, color: theme.paper, fontFamily: theme.fonts.body}}>
    <Img src={file('night')} style={{position: 'absolute', width: 1920, height: 1920, left: -200, top: 0, objectFit: 'cover'}} />
  </AbsoluteFill>;
};
