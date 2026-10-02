import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {Film,Timing} from './Film';
import timing from './timing.json';
import {Cover} from './Cover';
registerRoot(()=> <><Composition id="ShiftProcess01" component={Film} width={1080} height={1920} fps={30} durationInFrames={timing.durationInFrames} defaultProps={{timing}} calculateMetadata={({props})=>({durationInFrames:(props as {timing:Timing}).timing.durationInFrames})}/><Composition id="ShiftProcessCover" component={Cover} width={1080} height={1920} fps={30} durationInFrames={1}/></>);
