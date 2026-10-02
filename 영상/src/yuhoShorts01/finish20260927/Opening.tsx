import React from 'react';
import {AbsoluteFill,interpolate,spring,useCurrentFrame} from 'remotion';
import {본문스택} from '../../킷/폰트';
import {색} from '../../킷/색';
const blue=색('Lapis'),ink=색('Black'),paper=색('Paper');
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
export const Opening=({scene}:any)=>{
 const f=useCurrentFrame();
 const hit=scene.wordCues.find((w:any)=>w.text==='백').startFrame;
 const answer=scene.wordCues.find((w:any)=>w.text==='아꼈을').startFrame;
 const settle=(at:number)=>spring({fps:30,frame:Math.max(0,f-at),config:{damping:19,stiffness:190,mass:.7}});
 const intro=interpolate(f,[hit-8,hit+1],[1,0],clamp);
 return <AbsoluteFill style={{background:paper,color:ink,fontFamily:본문스택,overflow:'hidden'}}>
  <div style={{position:'absolute',left:86,top:164,fontSize:31,fontWeight:750}}>yuhobuilds <span style={{color:blue,marginLeft:24}}>EP.01</span></div>
  <div style={{position:'absolute',left:86,top:322,fontSize:35,color:blue,fontWeight:750,opacity:interpolate(f,[0,7],[0,1],clamp)}}>AI 초보의 첫 앱 도전</div>
  {['그때','알았더라면…'].map((line,i)=><div key={line} style={{position:'absolute',left:82,top:420+i*140,fontWeight:900,fontSize:i?112:120,letterSpacing:'-.055em',opacity:interpolate(f,[3+i*5,10+i*5],[0,1],clamp),transform:`translateY(${(1-settle(3+i*5))*45}px)`}}>{line}</div>)}
  <div style={{position:'absolute',left:92,right:100,top:795,opacity:intro,transform:`translateY(${(1-intro)*-24}px)`}}>
   {['막히고','고치고','또 고치고'].map((word,i)=><div key={word} style={{fontSize:68,fontWeight:800,marginBottom:20,color:i===2?blue:ink,opacity:interpolate(f,[18+i*12,25+i*12],[0,1],clamp),transform:`translateX(${(1-settle(18+i*12))*50}px)`}}><span style={{fontSize:31,color:blue,marginRight:30}}>0{i+1}</span>{word}<span style={{display:'inline-block',marginLeft:25,width:interpolate(f,[24+i*12,38+i*12],[0,100],clamp),height:5,background:blue,verticalAlign:'middle'}}/></div>)}
  </div>
  <div style={{position:'absolute',left:78,top:805,display:'flex',alignItems:'baseline',letterSpacing:'-.065em',color:blue}}>
   {'100'.split('').map((digit,i)=><span key={i} style={{display:'inline-block',fontSize:248,fontWeight:900,opacity:f>=hit+i*2?1:0,transform:`translateY(${(1-settle(hit+i*2))*70}px) scale(${.83+.17*settle(hit+i*2)})`}}>{digit}</span>)}
   <span style={{fontSize:83,fontWeight:850,marginLeft:25,letterSpacing:'-.045em',opacity:interpolate(f,[hit+3,hit+9],[0,1],clamp),transform:`translateX(${(1-settle(hit+3))*35}px)`}}>시간은</span>
  </div>
  <div style={{position:'absolute',left:94,top:1120,fontSize:69,fontWeight:850,letterSpacing:'-.04em',opacity:interpolate(f,[answer,answer+5],[0,1],clamp),transform:`translateY(${(1-settle(answer))*28}px)`}}>아꼈을 것 같아요.</div>
  <div style={{position:'absolute',left:94,top:1240,width:interpolate(f,[answer+2,answer+13],[0,756],clamp),height:7,background:blue,borderRadius:5}}/>
 </AbsoluteFill>;
};
