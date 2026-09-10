import React from 'react';
import {useCurrentFrame,useVideoConfig} from 'remotion';
import {theme as t} from './theme';
export const Captions:React.FC<{cues:any[];layoutProfile?:'standard'|'balanced-portrait'}> = ({cues,layoutProfile='standard'})=>{
 const f=useCurrentFrame(),{fps,width,height}=useVideoConfig();
 const cue=cues.find(c=>f/fps*1000>=c.startMs&&f/fps*1000<c.endMs);
 if(!cue)return null;
 const wide=width>height;
 const balanced=!wide&&layoutProfile==='balanced-portrait';
 if(balanced)return <div style={{position:'absolute',left:96,right:130,bottom:418,display:'flex',justifyContent:'center'}}>
  <div style={{width:780,height:176,boxSizing:'border-box',padding:'24px 40px',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:t.font,fontSize:42,lineHeight:1.45,letterSpacing:'-.02em',fontWeight:400,color:t.ink,whiteSpace:'pre',textAlign:'center',background:t.paper,borderRadius:16,boxShadow:`inset 0 0 0 1px ${t.shadow(.035)}, 0 3px 6px ${t.shadow(.025)}, 0 12px 28px ${t.shadow(.04)}`}}>{cue.text}</div>
 </div>;
 return <div style={{position:'absolute',left:wide?100:80,right:wide?100:130,bottom:wide?92:328,minHeight:wide?75:90,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:t.font,fontSize:wide?36:35,lineHeight:1.4,fontWeight:500,color:t.ink,whiteSpace:'pre-line',textAlign:'center',background:t.paper,padding:'12px 22px',borderTop:`2px solid ${t.oat}`}}>{cue.text}</div>;
};
