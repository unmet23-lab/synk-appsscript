import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Video} from './Video';
import {Cover} from './Cover';
import {defaultProps} from './defaults';
import {VideoProps} from './types';

registerRoot(() => <>
  <Composition id="YuhoJourney01" component={Video} width={1080} height={1920} fps={30} durationInFrames={defaultProps.timing.durationInFrames} defaultProps={defaultProps} calculateMetadata={({props}) => ({durationInFrames: (props as VideoProps).timing.durationInFrames, fps: (props as VideoProps).timing.fps})}/>
  <Composition id="YuhoJourney01Cover" component={Cover} width={1080} height={1920} fps={30} durationInFrames={1}/>
</>);
