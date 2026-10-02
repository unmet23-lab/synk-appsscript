import React from 'react';
import {AbsoluteFill,Img,interpolate,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {한글체,라틴체,몽골어보정} from '../킷/폰트';
import {theme as t} from './theme';
import {LabMascot} from './LabMascot';
import assetMap from '../../public/firstposts20260910/assets.json';

const source=(key:string)=>staticFile('firstposts20260910/'+(assetMap as any)[key]);
const mn=`'${라틴체}',${t.font}`,ko=`'${한글체}',${t.font}`;
const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};
const arrive=(f:number,fps:number,delay:number,duration=.38)=>({
 opacity:interpolate(f,[delay*fps,(delay+duration)*fps],[0,1],{...clamp,easing:t.ease}),
 translate:`0 ${interpolate(f,[delay*fps,(delay+duration)*fps],[15,0],{...clamp,easing:t.ease})}px`,
});

// Shared by the still card and the expansion: no geometry jump at hand-off.
export const labMediaRect=(f:number,fps:number,frames:number,width=1920,height=1080)=>{
 const scale=interpolate(f,[0,frames],[1,1.016],{...clamp,easing:t.drift});
 const baseWidth=640,baseHeight=baseWidth*height/width;
 return {left:1160+(baseWidth-baseWidth*scale)/2,top:365+(baseHeight-baseHeight*scale)/2,width:baseWidth*scale,height:baseHeight*scale};
};

export const LabEnding:React.FC<{scene:any}>=({scene:s})=>{
 const f=useCurrentFrame(),{fps}=useVideoConfig();
 const fade=interpolate(f,[(s.duration-1.6)*fps,(s.duration-.12)*fps],[1,0],{...clamp,easing:t.exit});
 return <AbsoluteFill style={{background:t.ink,color:t.paper,fontFamily:mn,overflow:'hidden'}}>
  <Img src={source(s.transitionFromAsset)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>
  <AbsoluteFill style={{opacity:interpolate(f,[0,.95*fps],[0,1],{...clamp,easing:t.drift})}}>
   <Img src={source(s.asset)} style={{width:'100%',height:'100%',objectFit:'cover',scale:interpolate(f,[0,s.duration*fps],[1.04,1.025],{...clamp,easing:t.drift})}}/>
   <AbsoluteFill style={{background:t.ink,opacity:.24}}/>
  </AbsoluteFill>
  <div style={{position:'absolute',left:0,right:0,top:423,display:'flex',alignItems:'center',flexDirection:'column',opacity:fade}}>
   <Img src={source(s.logoAsset)} style={{width:340,height:106,objectFit:'contain',...arrive(f,fps,1.1,1.1)}}/>
   <div data-type="ending-descriptor" style={{fontSize:27*몽골어보정,fontWeight:500,lineHeight:1.35,letterSpacing:'-.02em',marginTop:50,...arrive(f,fps,2.15,.9),opacity:.65*interpolate(f,[2.15*fps,3.05*fps],[0,1],{...clamp,easing:t.ease})}}>{s.title}</div>
   <div data-type="ending-account" style={{fontSize:23,fontWeight:400,lineHeight:1.4,letterSpacing:'-.01em',marginTop:116,opacity:interpolate(f,[3*fps,3.8*fps],[0,.5],{...clamp,easing:t.ease})}}>{s.body}</div>
  </div>
 </AbsoluteFill>;
};

export const LabScene:React.FC<{scene:any;item:any}>=({scene:s,item})=>{
 const f=useCurrentFrame(),{fps,width,height}=useVideoConfig(),cover=s.layout==='cover',bridge=s.layout==='music-bridge';
 const media=labMediaRect(f,fps,s.duration*fps,width,height);
 const sameMeaning=String(s.title||'').replace(/\s+/g,' ').trim()===String(s.secondary||'').replace(/\s+/g,' ').trim();
 return <AbsoluteFill style={{background:t.paper,color:t.ink,fontFamily:mn,overflow:'hidden'}}>
  <AbsoluteFill style={{background:`radial-gradient(ellipse at 85% 63%,${t.oat}88,transparent 62%)`}}/>
  <Img src={source('logo-lab')} style={{position:'absolute',left:116,top:57,width:328,height:102,objectFit:'contain',objectPosition:'left center',...arrive(f,fps,0)}}/>
  {cover?<>
   <div style={{position:'absolute',left:116,top:274,width:1165}}>
    <div style={{fontSize:26,fontWeight:500,letterSpacing:'-.02em',color:t.muted,...arrive(f,fps,.05)}}>{s.kicker}</div>
    <div data-type="lab-cover-title" style={{fontSize:98*몽골어보정,fontWeight:700,lineHeight:1.11,letterSpacing:'-.04em',whiteSpace:'pre-line',marginTop:30,wordBreak:'keep-all',...arrive(f,fps,.12,.46)}}>{s.title}</div>
    <div data-type="lab-cover-body" style={{fontSize:36*몽골어보정,fontWeight:500,lineHeight:1.42,letterSpacing:'-.02em',whiteSpace:'pre-line',marginTop:43,color:t.muted,...arrive(f,fps,.34,.46)}}>{s.body}</div>
   </div>
   <div style={{position:'absolute',left:1215,top:204,width:635,height:680,...arrive(f,fps,.08,.45)}}><LabMascot scene={s}/></div>
  </>:<>
   <div style={{position:'absolute',left:116,top:246,width:1000}}>
    <div style={{fontSize:25,fontWeight:500,lineHeight:1.4,letterSpacing:'-.015em',color:t.muted,...arrive(f,fps,.02)}}>{s.kicker}</div>
    {!sameMeaning&&<div data-type="lab-context" style={{fontSize:42*몽골어보정,fontWeight:500,lineHeight:1.24,letterSpacing:'-.02em',whiteSpace:'pre-line',marginTop:24,color:t.muted,...arrive(f,fps,.06)}}>{s.title}</div>}
    <div data-type="lab-korean" style={{fontFamily:ko,fontSize:bridge?82:108,fontWeight:800,lineHeight:1.2,letterSpacing:'-.04em',whiteSpace:'pre-line',wordBreak:'keep-all',marginTop:sameMeaning?94:36,color:t.ink,...arrive(f,fps,.1,.28)}}>{s.primary}</div>
    {s.secondary&&<div data-type="lab-meaning" style={{fontSize:46*몽골어보정,fontWeight:500,lineHeight:1.3,letterSpacing:'-.02em',marginTop:23,whiteSpace:'pre-line',...arrive(f,fps,.25)}}>{s.secondary}</div>}
    {s.body&&<div style={{fontSize:34*몽골어보정,fontWeight:500,lineHeight:1.4,letterSpacing:'-.02em',marginTop:29,color:t.muted,...arrive(f,fps,.3)}}>{s.body}</div>}
    {s.note&&<div data-type="lab-note" style={{fontSize:28,fontWeight:400,lineHeight:1.4,letterSpacing:'-.015em',marginTop:29,color:t.muted,whiteSpace:'pre-line',...arrive(f,fps,.43)}}>{s.note}</div>}
   </div>
   <Img data-content="lab-media" src={source(s.asset)} style={{position:'absolute',...media,objectFit:'contain',...arrive(f,fps,.06,.34)}}/>
  </>}
  <div style={{position:'absolute',left:116,right:120,bottom:56,display:'flex',justifyContent:'space-between',fontSize:24,fontWeight:400,letterSpacing:'-.015em',color:t.muted,...arrive(f,fps,.45)}}><span>{item.displayAccount||item.account}</span><span>Солонгос хэл · K-LOFI24</span></div>
  <AbsoluteFill style={{pointerEvents:'none',backgroundImage:`radial-gradient(${t.ink}30 .6px,transparent .9px)`,backgroundSize:'7px 7px',opacity:.035}}/>
 </AbsoluteFill>;
};
