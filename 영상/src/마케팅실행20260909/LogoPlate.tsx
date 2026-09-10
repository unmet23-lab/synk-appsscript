import React from 'react';
import {AbsoluteFill,Composition,interpolate,registerRoot,useCurrentFrame,useVideoConfig} from 'remotion';
import {Background,BrandLockup,Entrance,Finish} from './Frame';
import {theme} from './theme';

// Preserve the existing film. This plate contains only the existing SYNK box
// and its original background, entry and exit; business-name stitches stay put.
export const logoRect=(wide:boolean)=>wide
 ? {left:100,top:64,width:232,height:136}
 : {left:92,top:246,width:268,height:146};
const LogoPlate:React.FC<{wide:boolean}>=({wide})=>{
 const frame=useCurrentFrame(),{fps,durationInFrames}=useVideoConfig(),r=logoRect(wide);
 return <div style={{position:'absolute',left:-r.left,top:-r.top,width:wide?1920:1080,height:wide?1080:1920,overflow:'hidden'}}>
  <Background/>
  <AbsoluteFill style={{opacity:interpolate(frame,[durationInFrames-.2*fps,durationInFrames-1],[1,0],{easing:theme.ease.in,extrapolateLeft:'clamp',extrapolateRight:'clamp'}),translate:`0 ${interpolate(frame,[durationInFrames-.2*fps,durationInFrames-1],[0,-8],{easing:theme.ease.in,extrapolateLeft:'clamp',extrapolateRight:'clamp'})}px`}}>
   <Entrance><BrandLockup brand="SYNK" left={wide?110:100} top={wide?82:260} scale={wide?.85:1}/></Entrance>
  </AbsoluteFill>
  <Finish/>
 </div>;
};
registerRoot(()=> <Composition id="MarketingLogoPlate" component={LogoPlate} width={268} height={146} fps={30} durationInFrames={30} defaultProps={{wide:false}} calculateMetadata={({props})=>logoRect(props.wide)}/>);
