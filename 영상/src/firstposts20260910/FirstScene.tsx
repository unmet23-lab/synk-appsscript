import React from 'react';
import {AbsoluteFill,Img,interpolate,useCurrentFrame,useVideoConfig,staticFile} from 'remotion';
import {theme as t} from './theme';
import assetMap from '../../public/firstposts20260910/assets.json';
const source=(key:string)=>staticFile('firstposts20260910/'+(assetMap as any)[key]);
const movement=(frame:number,fps:number,delay:number,duration:number,holdEnd=false)=>{
 const enter=interpolate(frame,[delay*fps,(delay+.26)*fps],[0,1],{easing:t.ease,extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const out=holdEnd?0:interpolate(frame,[(duration-.18)*fps,duration*fps],[0,1],{easing:t.exit,extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 return {opacity:enter*(1-out),transform:`translateY(${(1-enter)*22-out*8}px) scale(${.988+.012*enter})`};
};
export const FirstScene:React.FC<{scene:any;item:any;index:number;count:number;holdEnd?:boolean;layoutProfile?:'standard'|'balanced-portrait'}>=({scene:s,item,index,count,holdEnd=false,layoutProfile='standard'})=>{
 const f=useCurrentFrame(),{fps,width,height}=useVideoConfig(),wide=width>height;
 const balanced=!wide&&layoutProfile==='balanced-portrait';
 const intro=balanced&&index===0;
 const accent=item.brand==='SHIFT'?t.shift:item.brand==='PULSE'?t.pulse:t.lab;
 const brand=item.id==='01-lab-youtube'?'LAB':item.brand;
 const proof=s.asset?.startsWith('proof-'),document=s.asset==='synk-intro';
 const points=(s.items||[]).map((x:any)=>typeof x==='string'?{text:x}:x);
 const hasAsset=s.asset&&(assetMap as any)[s.asset];
 const wideCopy=proof?820:hasAsset?1050:1710;
 const titleSize=s.primary?(wide?48:50):(wide?((s.title?.length||0)>33?76:90):((s.title?.length||0)>35?78:88));
 const dense=points.length>=3||!!(s.body&&s.primary&&s.secondary);
 const imageHeight=balanced?440:wide?620:points.length>=3?190:points.length?290:dense?300:430;
 const drift=interpolate(f,[0,s.duration*fps],[1,1.024],{easing:t.drift,extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const image=(style:React.CSSProperties={})=><Img src={source(s.asset)} style={{width:'100%',height:'100%',objectFit:'contain',transform:`translateY(${Math.sin(f/fps*.55)*1.5}px) scale(${drift})`,...style}}/>;
 return <AbsoluteFill style={{background:t.paper,color:t.ink,fontFamily:t.font,isolation:'isolate',overflow:'hidden'}}>
  <AbsoluteFill style={{background:`radial-gradient(ellipse at 88% 68%,${t.oat}98,transparent 65%)`}}/>
  <div style={{position:'absolute',width:1000,height:1000,bottom:-540,right:-380,background:`radial-gradient(circle,${t.stitch}22,transparent 69%)`,transform:`translateY(${Math.sin(f/fps*.3)*10}px)`}}/>
  <Img src={source('logo-'+brand.toLowerCase())} style={{position:'absolute',left:wide?100:balanced?96:80,top:wide?45:balanced?250:176,width:wide?350:balanced?340:355,height:112,objectFit:'contain',objectPosition:'left center',...movement(f,fps,0,s.duration,holdEnd)}}/>
  <div style={{position:'absolute',right:wide?100:130,top:wide?98:balanced?304:230,fontSize:23,letterSpacing:'.04em',fontVariantNumeric:balanced?'tabular-nums':undefined,color:t.muted,fontWeight:500,...movement(f,fps,.08,s.duration,holdEnd)}}>{String(index+1).padStart(2,'0')} / {String(count).padStart(2,'0')}</div>
  <div data-content="copy" style={{position:'absolute',left:wide?100:balanced?96:80,width:wide?wideCopy:balanced?854:870,top:wide?230:intro?560:balanced?450:350,display:'flex',flexDirection:'column'}}>
   {s.kicker&&<div style={{fontSize:balanced?28:27,lineHeight:1.42,color:t.muted,fontWeight:600,letterSpacing:balanced?'-.02em':undefined,whiteSpace:'pre-line',marginBottom:balanced?36:22,...movement(f,fps,.1,s.duration,holdEnd)}}>{s.kicker}</div>}
   <div data-type="title" style={{fontSize:titleSize,color:s.primary?t.muted:t.ink,lineHeight:balanced?1.2:1.16,letterSpacing:balanced?'-.04em':'-.035em',fontWeight:s.primary?500:800,whiteSpace:'pre-line',wordBreak:'keep-all',overflowWrap:'break-word',...movement(f,fps,.17,s.duration,holdEnd)}}>{balanced?(s.title||'').split('\n').map((line:string,i:number,lines:string[])=>{
    const lead=lines.length>1&&i===0;
    return <div key={i} style={{fontSize:lead?66:intro?116:98,fontWeight:lead?500:800,color:lead?t.muted:t.ink,letterSpacing:lead?'-.02em':'-.04em',lineHeight:1.2,marginTop:i?14:0}}>{line}</div>;
   }):s.title}</div>
   {s.body&&<div data-type="body" style={{fontSize:balanced?34:wide?34:37,fontWeight:balanced?500:undefined,letterSpacing:balanced?'-.02em':undefined,lineHeight:balanced?1.5:1.43,whiteSpace:'pre-line',wordBreak:'keep-all',marginTop:balanced?32:27,color:t.muted,...movement(f,fps,.3,s.duration,holdEnd)}}>{s.body}</div>}
   {s.primary&&<div data-type="primary" style={{fontSize:wide?(proof?64:74):74,lineHeight:1.25,letterSpacing:'-.04em',fontWeight:800,whiteSpace:'pre-line',wordBreak:'keep-all',marginTop:33,color:accent,...movement(f,fps,.46,s.duration,holdEnd)}}>{s.primary}</div>}
   {s.secondary&&<div data-type="secondary" style={{fontSize:wide?34:36,lineHeight:1.43,whiteSpace:'pre-line',wordBreak:'keep-all',marginTop:18,...movement(f,fps,.58,s.duration,holdEnd)}}>{s.secondary}</div>}
   {!!points.length&&<div style={{display:'grid',gap:wide?20:23,marginTop:30}}>{points.map((p:any,i:number)=><div key={i} style={{fontSize:wide?(proof?35:38):40,lineHeight:1.32,whiteSpace:'pre-line',wordBreak:'keep-all',borderTop:`2px solid ${t.oat}`,paddingTop:14,...movement(f,fps,.42+i*.14,s.duration,holdEnd)}}>{p.label&&<div style={{fontSize:wide?25:26,color:t.muted,fontWeight:600,marginBottom:6}}>{p.label}</div>}{p.text}</div>)}</div>}
   {s.note&&<div data-type="note" style={{fontSize:wide?25:27,lineHeight:1.4,whiteSpace:'pre-line',color:t.muted,marginTop:22,...movement(f,fps,.72,s.duration,holdEnd)}}>{s.note}</div>}
   {!wide&&hasAsset&&<div data-content="asset" style={{height:imageHeight,position:'relative',marginTop:balanced?(document?68:112):points.length?25:34,...movement(f,fps,.32,s.duration,holdEnd)}}>{proof?<div style={{width:'100%',height:'100%',overflow:'hidden',position:'relative',border:`2px solid ${t.oat}`}}><Img src={source(s.asset)} style={{width:1045,height:'auto',maxWidth:'none',position:'absolute',left:-90,top:index===2?-1045:-451,transform:`scale(${1+Math.sin(f/fps*.3)*.002})`,transformOrigin:'center top'}}/></div>:image({objectPosition:document?(balanced?'center':'left center'):'center'})}</div>}
   {!wide&&document&&<div style={{fontSize:balanced?25:23,fontWeight:balanced?400:undefined,letterSpacing:balanced?'-.02em':undefined,color:t.muted,marginTop:balanced?20:12,...movement(f,fps,.72,s.duration,holdEnd)}}>직접 만든 LAB 소개서 · 제작 실물</div>}
  </div>
  {wide&&hasAsset&&<div style={{position:'absolute',right:100,top:proof?260:250,width:proof?860:610,height:proof?630:620,...movement(f,fps,.26,s.duration,holdEnd)}}>
   {proof?<div style={{width:'100%',height:'100%',overflow:'hidden',position:'relative',border:`2px solid ${t.oat}`,boxShadow:`0 12px 34px ${t.shadow(.06)}`}}><Img src={source(s.asset)} style={{width:1100,height:'auto',maxWidth:'none',position:'absolute',left:-95,top:index===6?-1040:-475,transform:`scale(${1+Math.sin(f/fps*.3)*.002})`,transformOrigin:'center top'}}/></div>:image()}
   {proof&&<div style={{position:'absolute',top:-42,fontSize:23,color:t.muted}}>직접 입력해 확인한 실습 화면 · 가상 예시</div>}
   {document&&<div style={{fontSize:23,color:t.muted,marginTop:12}}>직접 만든 LAB 소개서 · 제작 실물</div>}
  </div>}
  <div style={{position:'absolute',left:wide?100:balanced?96:80,right:wide?100:130,bottom:wide?45:276,display:'flex',justifyContent:'space-between',fontSize:balanced?26:wide?24:23,fontWeight:balanced?400:undefined,letterSpacing:balanced?'-.02em':undefined,lineHeight:1.4,color:t.muted,...movement(f,fps,.65,s.duration,holdEnd)}}><span>{item.displayAccount||item.account}</span><span>{item.brand==='LAB'?'Солонгос хэл':'직접 쓰는 방법'}</span></div>
  <AbsoluteFill style={{pointerEvents:'none',background:t.oat,mixBlendMode:'multiply',opacity:.025}}/>
  <AbsoluteFill style={{pointerEvents:'none',backgroundImage:`radial-gradient(${t.ink}35 .6px,transparent .9px)`,backgroundSize:'7px 7px',opacity:.055}}/>
  <AbsoluteFill style={{pointerEvents:'none',background:`radial-gradient(ellipse at center,transparent 62%,${t.shadow(.035)} 100%)`}}/>
 </AbsoluteFill>;
};
