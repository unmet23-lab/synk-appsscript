import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Video, Cover} from './Video';
const defaults={timing:{fps:30,durationInFrames:2400,audioFile:'yuho-journey-01/narration.wav',audioStartFrame:0,scenes:[]},captions:[],words:[]};
registerRoot(()=> <>
  <Composition id="YuhoJourney01" component={Video} width={1080} height={1920} fps={30} durationInFrames={2400} defaultProps={defaults} calculateMetadata={({props})=>({durationInFrames:props.timing.durationInFrames})}/>
  <Composition id="YuhoJourney01Cover" component={Cover} width={1080} height={1920} fps={30} durationInFrames={1}/>
</>);
