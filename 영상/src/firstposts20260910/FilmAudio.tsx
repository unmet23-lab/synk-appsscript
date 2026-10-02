import React from 'react';
import {Audio,Sequence,staticFile,useVideoConfig,interpolate} from 'remotion';
import {theme as t} from './theme';

// This is the single audio graph used by the video and audio-only compositions.
// No image, mascot SVG or OffthreadVideo is mounted while exporting the WAV.
export const mixOf=(item:any)=>item.audioMix||{};
export const FilmAudio:React.FC<{item:any}>=({item})=>{
 const {fps}=useVideoConfig(),mix=mixOf(item),length=(s:any)=>Math.round(s.duration*fps);
 const offsets:number[]=[];let total=0;for(const s of item.scenes){offsets.push(total);total+=length(s);}
 const musicIndex=item.scenes.findIndex((s:any)=>s.layout==='music'),endingIndex=item.scenes.findIndex((s:any)=>s.layout==='ending');
 const bridge=musicIndex>0&&item.scenes[musicIndex-1].layout==='music-bridge'?item.scenes[musicIndex-1]:null;
 const lead=bridge?Math.round(bridge.musicLeadSeconds*fps):0;
 const bedUntil=musicIndex>=0?offsets[musicIndex]-lead:endingIndex>=0?offsets[endingIndex]:total;
 return <>
  {bedUntil>0&&<Sequence durationInFrames={bedUntil}><Audio src={staticFile('firstposts20260910/'+(item.brand==='LAB'?'bed-lab.wav':'bed-shift.wav'))} volume={f=>{
   const scene=item.scenes.find((s:any,i:number)=>f>=offsets[i]&&f<offsets[i]+length(s));
   const base=scene?.audio?(mix.bedSpeech??.075):(mix.bedSilent??.15);
   return base*Math.min(interpolate(f,[0,.25*fps],[0,1],{easing:t.ease,extrapolateLeft:'clamp',extrapolateRight:'clamp'}),interpolate(f,[bedUntil-.5*fps,bedUntil],[1,0],{easing:t.exit,extrapolateLeft:'clamp',extrapolateRight:'clamp'}));
  }}/></Sequence>}
  {bridge&&<Sequence from={offsets[musicIndex]-lead} durationInFrames={lead+length(item.scenes[musicIndex])} name="연속 원곡 오디오"><Audio src={staticFile('firstposts20260910/pulse-full.mp4')} volume={f=>(mix.music??1)*interpolate(f,[0,.6*fps],[0,1],{easing:t.ease,extrapolateLeft:'clamp',extrapolateRight:'clamp'})}/></Sequence>}
  {item.scenes.map((s:any,i:number)=><Sequence key={i} from={offsets[i]} durationInFrames={length(s)}>
   {s.layout==='music'&&!bridge?<Audio src={staticFile('firstposts20260910/pulse-full.mp4')} startFrom={Math.round((s.sourceStartSeconds||0)*fps)} volume={mix.music??1}/>:null}
   {s.mascotAudio?<Sequence from={Math.round((s.mascotAtSeconds??.45)*fps)}><Audio src={staticFile('firstposts20260910/'+s.mascotAudio)} volume={mix.mascot??.2}/></Sequence>:null}
   {s.audio?<Sequence from={Math.round(.3*fps)}><Audio src={staticFile('firstposts20260910/'+s.audio)} volume={mix.narration??1}/></Sequence>:null}
  </Sequence>)}
 </>;
};
