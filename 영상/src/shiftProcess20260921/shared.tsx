import React from 'react';
import {AbsoluteFill,Img,interpolate,staticFile,useCurrentFrame,Easing} from 'remotion';
import {ASSET,theme} from './theme';
export const ease=Easing.bezier(.18,.8,.24,1);
export const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;

export const Page:React.FC<React.PropsWithChildren<{dark?:boolean;step:string}>>=({children,dark=false,step})=>(
  <AbsoluteFill style={{backgroundColor:dark?theme.black:theme.paper,color:dark?theme.paper:theme.black,fontFamily:theme.font}}>
    <div style={{position:'absolute',left:80,top:166,right:150,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:27,fontWeight:600,letterSpacing:'.03em',opacity:.72}}>
      <span>유호 · SYNK</span><span>만들고 고친 과정 / 01</span>
    </div>
    {children}
    <div style={{position:'absolute',left:80,top:1690,right:150,display:'flex',justifyContent:'space-between',fontSize:26,fontWeight:500,opacity:.62}}><span>@yuhobuilds</span><span>{step} / 07</span></div>
  </AbsoluteFill>
);

export const Headline:React.FC<{children:React.ReactNode;top?:number;size?:number;dark?:boolean}>=({children,top=274,size=90})=>{
  const f=useCurrentFrame();return <div style={{position:'absolute',left:80,right:150,top,fontSize:size,lineHeight:1.18,fontWeight:800,letterSpacing:'-.045em',whiteSpace:'pre-line',opacity:interpolate(f,[0,13],[0,1],clamp),translate:`0 ${interpolate(f,[0,20],[26,0],{...clamp,easing:ease})}px`}}>{children}</div>;
};
export const Note:React.FC<{children:React.ReactNode;top?:number;dark?:boolean;size?:number}>=({children,top=1280,dark=false,size=47})=><div style={{position:'absolute',left:80,right:150,top,fontSize:size,lineHeight:1.38,fontWeight:500,letterSpacing:'-.025em',whiteSpace:'pre-line',color:dark?theme.light(.88):theme.shadow(.82)}}>{children}</div>;
export const Label:React.FC<{children:React.ReactNode;top:number;left?:number;dark?:boolean}>=({children,top,left=80,dark=false})=><div style={{position:'absolute',left,top,fontSize:30,fontWeight:600,letterSpacing:'-.015em',color:dark?theme.light(.7):theme.shadow(.64)}}>{children}</div>;

/** A literal crop from the upload original. No simulated platform chrome or crop. */
export const OriginalWindow:React.FC<{which:'before'|'after';x:number;y?:number;sourceWidth:number;left?:number;top:number;width?:number;height?:number;style?:React.CSSProperties}>=({which,x,y=0,sourceWidth,left=0,top,width=1080,height,style={}})=>{
  const scale=width/sourceWidth;return <div style={{position:'absolute',left,top,width,height:height??410*scale,overflow:'hidden',backgroundColor:theme.black,...style}}>
    <Img src={staticFile(ASSET+which+'.png')} style={{position:'absolute',width:3200*scale,height:410*scale,maxWidth:'none',left:-x*scale,top:-y*scale}}/>
  </div>;
};
export const FullBanner:React.FC<{which:'before'|'after';top:number;width?:number;left?:number;style?:React.CSSProperties}>=({which,top,width=1080,left=0,style={}})=><OriginalWindow which={which} x={0} sourceWidth={3200} top={top} width={width} left={left} style={style}/>;

export const Wipe:React.FC<{x:number;sourceWidth:number;top:number;width?:number;left?:number;start?:number;end?:number}>=({x,sourceWidth,top,width=1080,left=0,start=20,end=125})=>{
  const f=useCurrentFrame();const p=interpolate(f,[start,end],[0,1],{...clamp,easing:ease});const h=410*width/sourceWidth;
  return <>
    <OriginalWindow which="before" x={x} sourceWidth={sourceWidth} top={top} width={width} left={left}/>
    <div style={{position:'absolute',left,top,width,height:h,overflow:'hidden',clipPath:`inset(0 ${(1-p)*100}% 0 0)`}}><OriginalWindow which="after" x={x} sourceWidth={sourceWidth} top={0} width={width}/></div>
    {p>.005&&p<.995?<div style={{position:'absolute',left:left+p*width-1,top,width:3,height:h,backgroundColor:theme.paper,boxShadow:`0 0 14px ${theme.light(.8)}`}}/>:null}
  </>;
};

export const FeltHero:React.FC<{top:number;height:number;which?:'before'|'after';focus?:number;scale?:number}>=({top,height,which='before',focus=2730,scale=1.6})=>{
  const f=useCurrentFrame();const drift=interpolate(f,[0,200],[0,-20],clamp);
  return <div style={{position:'absolute',left:0,top,width:1080,height,overflow:'hidden',backgroundColor:theme.black}}>
    <Img src={staticFile(ASSET+'felt-dark.webp')} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    <div style={{position:'absolute',left:540-focus*scale+drift,top:(height-410*scale)/2,width:3200*scale,height:410*scale}}><Img src={staticFile(ASSET+which+'.png')} style={{width:'100%',height:'100%'}}/></div>
  </div>;
};
