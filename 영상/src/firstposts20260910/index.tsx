import React from 'react';
import {AbsoluteFill,Composition,registerRoot} from 'remotion';
import {Film} from './Film';
import {FilmAudio} from './FilmAudio';
import {LabMascot} from './LabMascot';
const fallback={id:'preview',brand:'SHIFT',orientation:'landscape',account:'@yuhobuilds',scenes:[{title:'SYNK SHIFT',duration:1,layout:'cover'}]};
const MascotDebug:React.FC<{scene:any}>=({scene})=><AbsoluteFill><LabMascot scene={scene}/></AbsoluteFill>;
const Root=()=> <>
 <Composition id="FirstPost" component={Film} width={1920} height={1080} fps={30} durationInFrames={30} defaultProps={{item:fallback}} calculateMetadata={({props})=>({width:props.item.orientation==='landscape'?1920:1080,height:props.item.orientation==='landscape'?1080:1920,durationInFrames:props.item.scenes.reduce((n:number,s:any)=>n+Math.round(s.duration*30),0)})}/>
 <Composition id="FirstPostAudio" component={FilmAudio} width={1920} height={1080} fps={30} durationInFrames={30} defaultProps={{item:fallback}} calculateMetadata={({props})=>({width:props.item.orientation==='landscape'?1920:1080,height:props.item.orientation==='landscape'?1080:1920,durationInFrames:props.item.scenes.reduce((n:number,s:any)=>n+Math.round(s.duration*30),0)})}/>
 <Composition id="LabMascotDebug" component={MascotDebug} width={4096} height={4096} fps={30} durationInFrames={180} defaultProps={{scene:{asset:'mong'}}}/>
 </>;
registerRoot(Root);
