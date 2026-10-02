import React from 'react';
import {AbsoluteFill,Img,interpolate,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {한글체,라틴체,몽골어보정} from '../킷/폰트';
import {LabMascot} from './LabMascot';
import {theme as t} from './theme';
import assetMap from '../../public/firstposts20260910/assets.json';
const source=(key:string)=>staticFile('firstposts20260910/'+(assetMap as any)[key]);
export const LabPortraitScene:React.FC<{scene:any;item:any}>=({scene:s,item})=>{
 const f=useCurrentFrame(),{fps}=useVideoConfig(),cover=s.layout==='cover',practice=!!s.primary;
 const arrive=(delay:number)=>({opacity:interpolate(f,[delay*fps,(delay+.38)*fps],[0,1],{easing:t.ease,extrapolateLeft:'clamp',extrapolateRight:'clamp'}),translate:`0 ${interpolate(f,[delay*fps,(delay+.38)*fps],[15,0],{easing:t.ease,extrapolateLeft:'clamp',extrapolateRight:'clamp'})}px`});
 return <AbsoluteFill style={{background:t.paper,color:t.ink,fontFamily:`'${라틴체}',${t.font}`,overflow:'hidden'}}>
  <AbsoluteFill style={{background:`radial-gradient(ellipse at 76% 70%,${t.oat}88,transparent 64%)`}}/>
  <Img src={source('logo-lab')} style={{position:'absolute',left:80,top:176,width:328,height:102,objectFit:'contain',objectPosition:'left center',...arrive(0)}}/>
  <div style={{position:'absolute',left:80,top:cover?360:370,width:870}}>
   {s.kicker&&<div style={{fontSize:26,fontWeight:500,color:t.muted,lineHeight:1.4,marginBottom:26,...arrive(.04)}}>{s.kicker}</div>}
   <div style={{fontSize:(practice?44:cover?82:72)*몽골어보정,fontWeight:practice?500:700,color:practice?t.muted:t.ink,lineHeight:practice?1.3:1.14,letterSpacing:practice?'-.02em':'-.04em',whiteSpace:'pre-line',wordBreak:'keep-all',...arrive(.08)}}>{s.title}</div>
   {s.primary&&<div style={{fontFamily:`'${한글체}',${t.font}`,fontSize:96,fontWeight:800,lineHeight:1.2,letterSpacing:'-.04em',whiteSpace:'pre-line',wordBreak:'keep-all',marginTop:48,...arrive(.1)}}>{s.primary}</div>}
   {s.secondary&&<div style={{fontSize:46*몽골어보정,fontWeight:500,lineHeight:1.35,letterSpacing:'-.02em',marginTop:28,whiteSpace:'pre-line',...arrive(.24)}}>{s.secondary}</div>}
   {s.body&&<div style={{fontSize:38*몽골어보정,fontWeight:500,lineHeight:1.42,letterSpacing:'-.02em',marginTop:34,color:t.muted,whiteSpace:'pre-line',...arrive(.3)}}>{s.body}</div>}
   {s.items&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:36,marginTop:38}}>{s.items.map((p:any,i:number)=><div key={i} style={{borderTop:`2px solid ${t.oat}`,paddingTop:24,...arrive(.35+i*.12)}}><div style={{fontFamily:t.font,fontSize:46,fontWeight:600,lineHeight:1.3}}>{p.label}</div><div style={{fontSize:38*몽골어보정,marginTop:13,lineHeight:1.35}}>{p.text}</div></div>)}</div>}
   {s.note&&<div style={{fontSize:28,fontWeight:400,lineHeight:1.4,marginTop:32,color:t.muted,whiteSpace:'pre-line',...arrive(.45)}}>{s.note}</div>}
  </div>
  <div style={{position:'absolute',left:cover?193:210,top:cover?870:practice?850:s.items?950:910,width:cover?635:600,height:cover?640:practice?530:500,...arrive(.12)}}>
   {cover&&s.mascotAnimation?<LabMascot scene={s}/>:<Img src={source(s.asset)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>}
  </div>
  <div style={{position:'absolute',left:80,right:130,bottom:276,display:'flex',justifyContent:'space-between',fontSize:25,fontWeight:400,color:t.muted,...arrive(.45)}}><span>{item.account}</span><span>Солонгос хэл</span></div>
 </AbsoluteFill>;
};
