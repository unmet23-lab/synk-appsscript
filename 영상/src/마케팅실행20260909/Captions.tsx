import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import {theme} from './theme';
import type {Cue} from './types';
// Caption JSON follows the Remotion Caption shape. Timings carry an explicit basis in the render plan.
export const Captions:React.FC<{cues?:Cue[]}>=({cues=[]})=>{
 const frame=useCurrentFrame(),{fps}=useVideoConfig(),now=frame/fps*1000;
 const active=cues.find(c=>now>=c.startMs&&now<c.endMs);
 if(!active)return null;
 return <div data-critical="narration-caption" style={{position:'absolute',left:130,top:874,width:1650,height:110,fontFamily:theme.fonts.body,color:theme.ink,fontSize:34,fontWeight:500,lineHeight:1.4,whiteSpace:'pre-line',wordBreak:'keep-all',display:'flex',justifyContent:'center',textAlign:'center',alignItems:'center',background:theme.light(.9)}}>{active.text}</div>;
};

