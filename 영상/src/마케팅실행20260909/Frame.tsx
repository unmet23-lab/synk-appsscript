import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from './theme';
export const file = (key: string) => staticFile(`마케팅실행20260909/${key}.webp`);
export const Entrance: React.FC<{children:React.ReactNode;delay?:number;style?:React.CSSProperties}> = ({children,delay=0,style}) => {
 const frame=useCurrentFrame(), {fps}=useVideoConfig();
 const p=spring({frame:frame-Math.round(delay*fps),fps,config:theme.spring,durationInFrames:Math.round(.3*fps)});
 return <div style={{...style,opacity:p,translate:`0 ${18*(1-p)}px`,scale:String(.99+.01*p)}}>{children}</div>;
};
export const Artifact: React.FC<{asset:string;width:number;height:number;duration:number}> = ({asset,width,height,duration}) => {
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 return <div style={{position:'relative',width,height}}><Img src={file(asset)} style={{width:'100%',height:'100%',objectFit:'contain',
 scale:interpolate(frame,[0,.8*fps,Math.max(.9*fps,duration*fps-1)],[.985,1,1],{easing:theme.ease.inOut,extrapolateLeft:'clamp',extrapolateRight:'clamp'}),
 translate:`0 ${interpolate(frame,[0,.8*fps],[6,0],{easing:theme.ease.out,extrapolateLeft:'clamp',extrapolateRight:'clamp'})}px`}}/></div>;
};
export const BrandLockup: React.FC<{brand?:string;left?:number;top?:number;scale?:number}> = ({brand='SYNK',left=100,top=260,scale=1}) => {
 const sizes:Record<string,{width:number;height:number}>={LAB:{width:1951*58/775,height:823*58/775},SHIFT:{width:1936*58/552,height:600*58/552},PULSE:{width:1987*58/529,height:577*58/529}};
 return <div data-critical="brand-lockup" style={{position:'absolute',left,top,width:530*scale,height:120*scale}}>
 <Img src={file('brand-synk')} style={{position:'absolute',left:0,top:0,width:248*scale,height:248*1218/2820*scale,objectFit:'contain'}}/>
 {sizes[brand]&&<Img src={file(`brand-${brand.toLowerCase()}`)} style={{position:'absolute',left:274*scale,top:24*scale,width:sizes[brand].width*scale,height:sizes[brand].height*scale,objectFit:'contain'}}/>}
 </div>;
};
export const Background:React.FC=()=> <AbsoluteFill style={{background:theme.paper}}>
 <AbsoluteFill style={{background:`radial-gradient(ellipse at 90% 80%, ${theme.shadow(.024)}, transparent 62%)`}}/>
</AbsoluteFill>;
export const Finish:React.FC=()=> <AbsoluteFill style={{pointerEvents:'none'}}>
 <AbsoluteFill style={{background:theme.light(.014)}}/>
 <div style={{position:'absolute',left:0,right:0,bottom:0,height:110,boxShadow:`0 -20px 100px ${theme.shadow(.022)}`}}/>
</AbsoluteFill>;
export const Headline:React.FC<{text:string;size?:number}> = ({text,size=84}) => <div data-critical="title" style={{fontSize:size,fontWeight:theme.headingWeight,lineHeight:1.15,letterSpacing:theme.tracking,whiteSpace:'pre-line',wordBreak:'keep-all',overflowWrap:'break-word'}}>{text}</div>;
export const Progress:React.FC<{count:number;index:number;label:string}> = ({count,index,label}) => <div style={{position:'absolute',top:1495,left:100,width:820,display:'flex',justifyContent:'space-between',alignItems:'center',color:theme.muted}}>
 <span style={{fontSize:22,fontWeight:500,letterSpacing:.5}}>{label}</span><div style={{display:'flex',gap:10}}>{Array.from({length:count},(_,i)=><div key={i} style={{height:3,width:i===index?38:14,background:theme.ink,opacity:i===index?.8:.13}}/>)}</div>
 </div>;
export const CheckedScene:React.FC<{children:React.ReactNode;id:string;index:number;duration:number;landscape?:boolean}> = ({children,id,index,duration,landscape=false}) => {
 const frame=useCurrentFrame(),{fps}=useVideoConfig(),ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(!ref.current||frame<Math.round(fps*.8))return;
  for(const el of ref.current.querySelectorAll<HTMLElement>('[data-critical]')){
   const r=el.getBoundingClientRect(),right=landscape?1810:935,bottom=landscape?998:1532;
   if(el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2||r.right>right||r.bottom>bottom||r.left<(landscape?85:95))throw new Error(`Critical text overflow: ${id} scene ${index+1} ${el.dataset.critical}`);
  }
 },[frame,fps,id,index,landscape]);
 return <AbsoluteFill ref={ref} style={{fontFamily:theme.fonts.body,color:theme.ink,opacity:interpolate(frame,[Math.max(0,duration*fps-.2*fps),duration*fps-1],[1,0],{easing:theme.ease.in,extrapolateLeft:'clamp',extrapolateRight:'clamp'}),translate:`0 ${interpolate(frame,[Math.max(0,duration*fps-.2*fps),duration*fps-1],[0,-8],{easing:theme.ease.in,extrapolateLeft:'clamp',extrapolateRight:'clamp'})}px`}}>{children}</AbsoluteFill>;
};

