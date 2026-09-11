import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {EngineFilm} from './Film';
import timeline from './timeline.json';

registerRoot(() => <Composition id="FeltEngineExplained" component={EngineFilm}
  width={1920} height={1080} fps={30} durationInFrames={timeline.durationInFrames}/>);
