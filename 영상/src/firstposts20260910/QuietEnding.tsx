import React from 'react';
import {AbsoluteFill,Img,interpolate,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {라틴체,몽골어보정} from '../킷/폰트';
import {theme as t} from './theme';
import assetMap from '../../public/firstposts20260910/assets.json';
const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};
export const QuietEnding:React.FC<{scene:any;item:any;previous:React.ReactNode}>=({scene:s,item,previous})=>{
 const f=useCurrentFrame(),{fps,width,height}=useVideoConfig(),wide=width>height;
 const entrance=(delay:number,duration:number)=>interpolate(f,[delay*fps,(delay+duration)*fps],[0,1],{...clamp,easing:t.ease});
 const fade=interpolate(f,[(s.duration-1.6)*fps,(s.duration-.12)*fps],[1,0],{...clamp,easing:t.exit});
 return <AbsoluteFill style={{background:t.ink,color:t.paper,fontFamily:t.font,overflow:'hidden'}}>
  {previous}
  <AbsoluteFill style={{opacity:interpolate(f,[0,.95*fps],[0,1],{...clamp,easing:t.drift})}}>
   <Img src={staticFile('firstposts20260910/'+(assetMap as any)[s.asset])} style={{width:'100%',height:'100%',objectFit:'cover',scale:interpolate(f,[0,s.duration*fps],[1.04,1.025],{...clamp,easing:t.drift})}}/>
   <AbsoluteFill style={{background:t.ink,opacity:.24}}/>
  </AbsoluteFill>
  <div style={{position:'absolute',left:wide?116:80,right:wide?116:130,top:wide?423:720,display:'flex',alignItems:'center',flexDirection:'column',textAlign:'center',opacity:fade}}>
   <Img src={staticFile('firstposts20260910/'+(assetMap as any)[s.logoAsset])} style={{width:wide?340:355,height:wide?106:112,objectFit:'contain',opacity:entrance(1.1,1.1),translate:`0 ${15*(1-entrance(1.1,1.1))}px`}}/>
   <div style={{fontSize:wide?27:31*(item.brand==='LAB'?몽골어보정:1),fontWeight:500,lineHeight:1.4,letterSpacing:'-.02em',marginTop:wide?50:62,opacity:.65*entrance(2.15,.9),whiteSpace:'pre-line',wordBreak:'keep-all'}}>{s.title}</div>
   <div style={{fontFamily:`'${라틴체}',${t.font}`,fontSize:wide?23:28,fontWeight:400,lineHeight:1.4,letterSpacing:'-.01em',marginTop:wide?116:140,opacity:.5*entrance(3,.8)}}>{s.body||item.account}</div>
  </div>
 </AbsoluteFill>;
};
