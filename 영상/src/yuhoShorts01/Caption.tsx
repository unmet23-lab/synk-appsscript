import React from 'react';
import {interpolate} from 'remotion';
import {본문스택} from '../킷/폰트';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
export const Caption=({caption,ms}:any)=>{
 const elapsed=ms-caption.startMs;
 const lines=caption.text.split('\n');
 const longest=Math.max(...lines.map((s:string)=>s.length));
 const size=longest>20?55:longest>16?58:63;
 const emphasis=/((?:100시간은|출석 하나부터|로드맵|제로|건너뛰세요|아껴드립니다))/g;
 return <div style={{position:'absolute',left:74,right:108,top:1510,display:'flex',justifyContent:'center',fontFamily:본문스택,opacity:interpolate(elapsed,[0,75],[0,1],clamp),transform:`translateY(${interpolate(elapsed,[0,130],[13,0],clamp)}px)`}}>
  <div style={{maxWidth:'100%',boxSizing:'border-box',background:'rgba(12,15,21,.96)',color:'#FFF',borderRadius:22,padding:'22px 32px 25px',fontSize:size,fontWeight:800,letterSpacing:'-.035em',lineHeight:1.28,textAlign:'center',boxShadow:'0 7px 20px rgba(0,0,0,.15)'}}>
   {lines.map((line:string,i:number)=><div key={i} style={{whiteSpace:'nowrap'}}>{line.split(emphasis).map((part:string,j:number)=><span key={j} style={{color:j%2?'#A9C2FF':'#FFFFFF'}}>{part}</span>)}</div>)}
  </div>
 </div>;
};
