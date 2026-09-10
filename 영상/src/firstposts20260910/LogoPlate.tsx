import React from 'react';
import {Composition,Img,Sequence,interpolate,registerRoot,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {theme as t} from './theme';
import assetMap from '../../public/firstposts20260910/assets.json';

// The original six films keep their complete encoded scenes. This small plate
// repeats only the original FirstScene logo/background area at the original clock.
export const logoRect=(wide:boolean)=>wide?{left:95,top:35,width:360,height:160}:{left:75,top:166,width:370,height:174};
const PlateScene:React.FC<{item:any;scene:any}>=({item,scene:s})=>{
 const f=useCurrentFrame(),{fps}=useVideoConfig(),wide=item.orientation==='landscape',r=logoRect(wide),width=wide?1920:1080,height=wide?1080:1920;
 const enter=interpolate(f,[0,.26*fps],[0,1],{easing:t.ease,extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const out=interpolate(f,[(s.duration-.18)*fps,s.duration*fps],[0,1],{easing:t.exit,extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const full:React.CSSProperties={position:'absolute',inset:0};
 return <div style={{position:'absolute',left:-r.left,top:-r.top,width,height,background:t.paper,isolation:'isolate',overflow:'hidden'}}>
  <div style={{...full,background:`radial-gradient(ellipse at 88% 68%,${t.oat}98,transparent 65%)`}}/>
  <div style={{position:'absolute',width:1000,height:1000,bottom:-540,right:-380,background:`radial-gradient(circle,${t.stitch}22,transparent 69%)`,transform:`translateY(${Math.sin(f/fps*.3)*10}px)`}}/>
  <Img src={staticFile('firstposts20260910/'+(assetMap as any)['logo-'+item.brand.toLowerCase()])} style={{position:'absolute',left:wide?100:80,top:wide?45:176,width:wide?350:355,height:112,objectFit:'contain',objectPosition:'left center',opacity:enter*(1-out),transform:`translateY(${(1-enter)*22-out*8}px) scale(${.988+.012*enter})`}}/>
  <div style={{...full,background:t.oat,mixBlendMode:'multiply',opacity:.025}}/>
  <div style={{...full,backgroundImage:`radial-gradient(${t.ink}35 .6px,transparent .9px)`,backgroundSize:'7px 7px',opacity:.055}}/>
  <div style={{...full,background:`radial-gradient(ellipse at center,transparent 62%,${t.shadow(.035)} 100%)`}}/>
 </div>;
};
const LogoPlate:React.FC<{item:any}>=({item})=>{let from=0;return <>{item.scenes.map((s:any,i:number)=>{const at=from,frames=Math.round(s.duration*30);from+=frames;return <Sequence from={at} durationInFrames={frames} key={i}><PlateScene item={item} scene={s}/></Sequence>})}</>};
const fallback={orientation:'portrait',brand:'LAB',scenes:[{duration:1}]};
registerRoot(()=> <Composition id="FirstPostLogoPlate" component={LogoPlate} width={370} height={174} fps={30} durationInFrames={30} defaultProps={{item:fallback}} calculateMetadata={({props})=>({...logoRect(props.item.orientation==='landscape'),durationInFrames:props.item.scenes.reduce((n:number,s:any)=>n+Math.round(s.duration*30),0)})}/>);
