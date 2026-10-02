import React from 'react';
import {Img,interpolate,staticFile,useCurrentFrame} from 'remotion';
import {Page,Headline,Note,Label,clamp,ease} from './shared';
import {ASSET,theme} from './theme';
export const Scene05Lower:React.FC=()=>{const f=useCurrentFrame();const dy=interpolate(f,[25,110],[0,40],{...clamp,easing:ease});return <Page step="05" dark>
  <Headline>{'전체 위치도\n조금 아래로'}</Headline>
  <div style={{position:'absolute',top:655,left:0,width:1080,height:570,overflow:'hidden'}}>
    <Img src={staticFile(ASSET+'felt-dark.webp')} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    <Img src={staticFile(ASSET+'after-content.png')} style={{position:'absolute',left:58,top:145+dy*.72,width:955,height:276,objectFit:'contain'}}/>
    <div style={{position:'absolute',right:135,top:56,fontSize:72,color:theme.paper,opacity:interpolate(f,[20,60],[0,1],clamp),translate:`0 ${dy*.5}px`}}>↓</div>
  </div>
  <Label top={1250} dark>위치 이동 설명 · 배치 변화 재구성</Label>
  <Label top={1320} dark>원본 기준 40px 아래로</Label>
</Page>;};
