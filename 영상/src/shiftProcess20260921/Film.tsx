import React from 'react';
import {Audio,Sequence,staticFile,useCurrentFrame} from 'remotion';
import captions from './captions.json';
import {theme} from './theme';
import {Scene01Hook} from './Scene01Hook';
import {Scene02Problem} from './Scene02Problem';
import {Scene03Keep} from './Scene03Keep';
import {Scene04Gather} from './Scene04Gather';
import {Scene05Lower} from './Scene05Lower';
import {Scene06Compare} from './Scene06Compare';
import {Scene07Close} from './Scene07Close';
import fallback from './timing.json';
export type Timing=Omit<typeof fallback,'audioFile'>&{audioFile:string|null};
export const Film:React.FC<{timing?:Timing}>=({timing=fallback})=>{
  const frame=useCurrentFrame();const ms=frame/30*1000;
  const caption=captions.find(c=>ms>=c.startMs&&ms<c.endMs);
  const current=timing.scenes.findIndex(s=>frame>=s.start&&frame<s.start+s.duration);
  const dark=[2,4,6].includes(current);
  const t=timing.scenes;return <>
    <Sequence from={t[0].start} durationInFrames={t[0].duration} name="01 · 커버를 올리려다"><Scene01Hook/></Sequence>
    <Sequence from={t[1].start} durationInFrames={t[1].duration} name="02 · 미리보기에서 발견"><Scene02Problem/></Sequence>
    <Sequence from={t[2].start} durationInFrames={t[2].duration} name="03 · 그림과 문구 보존"><Scene03Keep/></Sequence>
    <Sequence from={t[3].start} durationInFrames={t[3].duration} name="04 · 중앙 배치"><Scene04Gather/></Sequence>
    <Sequence from={t[4].start} durationInFrames={t[4].duration} name="05 · 아래로 이동"><Scene05Lower/></Sequence>
    <Sequence from={t[5].start} durationInFrames={t[5].duration} name="06 · 원본 전후 비교"><Scene06Compare/></Sequence>
    <Sequence from={t[6].start} durationInFrames={t[6].duration} name="07 · 실제 노출 확인"><Scene07Close/></Sequence>
    {timing.audioFile?<Sequence from={timing.audioStartFrame}><Audio src={staticFile(timing.audioFile)}/></Sequence>:null}
    {caption?<div data-caption="true" style={{position:'absolute',left:80,right:150,top:1490,fontFamily:theme.font,fontSize:46,lineHeight:1.38,fontWeight:600,letterSpacing:'-.025em',wordBreak:'keep-all',color:dark?theme.paper:theme.black}}>{caption.text}</div>:null}
  </>;
};
