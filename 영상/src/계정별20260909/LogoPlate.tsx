import React from 'react';
import {Composition,interpolate,registerRoot,useCurrentFrame,useVideoConfig} from 'remotion';
import {Background,Finish,Entrance,BrandLockup} from './Frame';
import {theme} from './theme';
// 264x152 crop contains only the common SYNK wordmark. Division pixels are outside.
const Plate:React.FC=()=>{const frame=useCurrentFrame(),{fps}=useVideoConfig();return <div style={{position:'absolute',left:-95,top:-245,width:1080,height:1920}}>
 <Background/>
 <div style={{position:'absolute',inset:0,opacity:interpolate(frame,[.8*fps,fps-1],[1,0],{easing:theme.ease.in,extrapolateLeft:'clamp',extrapolateRight:'clamp'}),translate:`0 ${interpolate(frame,[.8*fps,fps-1],[0,-8],{easing:theme.ease.in,extrapolateLeft:'clamp',extrapolateRight:'clamp'})}px`}}><Entrance><BrandLockup brand="SYNK"/></Entrance></div>
 <Finish/>
 </div>};
registerRoot(()=> <Composition id="AccountLogoPlate" component={Plate} width={264} height={152} fps={30} durationInFrames={30}/>);
