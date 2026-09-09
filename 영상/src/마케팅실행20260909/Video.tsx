import React from 'react';
import {AbsoluteFill,Audio,Img,interpolate,Sequence,staticFile,useVideoConfig} from 'remotion';
import {Background,Finish,file} from './Frame';
import {ShortScene} from './ShortScene';
import {LectureScene} from './LectureScene';
import {theme} from './theme';
import type {ContentItem} from './types';
export const MarketingVideo:React.FC<{item:ContentItem}>=({item})=>{
 const {fps,durationInFrames}=useVideoConfig(),listening=item.id==='01-lab-youtube',long=(item.width||1080)>1080;
 let offset=0;
 return <AbsoluteFill>
 {listening?<AbsoluteFill style={{background:theme.ink}}><Img src={file('night')} style={{position:'absolute',width:1920,height:1920,left:-200,top:0,objectFit:'cover'}}/></AbsoluteFill>:<>
 <Background/>
 {item.scenes.map((scene,index)=>{
  const from=offset,frames=Math.round(scene.durationSec*fps);offset+=frames;
  return <Sequence key={index} from={from} durationInFrames={frames} premountFor={fps}>
   {long?<LectureScene scene={scene} item={item} index={index}/>:<ShortScene scene={scene} item={item} index={index}/>}
   {scene.audioFile&&<Audio src={staticFile(`마케팅실행20260909/${scene.audioFile}`)} volume={.8}/>}
  </Sequence>;
 })}
 <Finish/>
 </>}
 <Audio src={staticFile(`마케팅실행20260909/${listening?'BGM_30.wav':'BGM_60.wav'}`)} loop volume={(f)=>interpolate(f,[0,.6*fps,Math.max(.7*fps,durationInFrames-.8*fps),durationInFrames-1],[0,listening?.72:long?.045:.27,listening?.72:long?.045:.27,0],{easing:theme.ease.inOut,extrapolateLeft:'clamp',extrapolateRight:'clamp'})} loopVolumeCurveBehavior="extend"/>
 </AbsoluteFill>;
};
