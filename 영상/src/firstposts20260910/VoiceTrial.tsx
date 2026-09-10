import React from 'react';
import {AbsoluteFill,Audio,Composition,Img,Sequence,interpolate,registerRoot,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {FirstScene} from './FirstScene';
import {Captions} from './Captions';
import {theme as t} from './theme';
import timing from './voice-trial-timing.json';

const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};
const asset=(name:string)=>staticFile('firstposts20260910/'+name);
const Ending:React.FC=()=>{
 const f=useCurrentFrame(),{fps}=useVideoConfig();
 const enter=interpolate(f,[0,.55*fps],[0,1],{...clamp,easing:t.ease});
 const text=interpolate(f,[.28*fps,.65*fps],[0,1],{...clamp,easing:t.ease});
 const exit=interpolate(f,[(timing.endingSeconds-timing.fadeOutSeconds)*fps,timing.endingSeconds*fps],[1,0],{...clamp,easing:t.drift});
 return <AbsoluteFill style={{background:t.ink,color:t.paper,fontFamily:t.font,overflow:'hidden'}}>
  <Img src={asset('felt-dark.webp')} style={{width:'100%',height:'100%',objectFit:'cover',scale:interpolate(f,[0,timing.endingSeconds*fps],[1.04,1.015],{...clamp,easing:t.drift})}}/>
  <AbsoluteFill style={{background:t.ink,opacity:.22}}/>
  <div style={{position:'absolute',left:110,right:110,top:690,textAlign:'center',opacity:exit}}>
   <Img src={asset('logo-shift-paper.png')} style={{width:590,height:210,objectFit:'contain',opacity:enter,transform:`translateY(${16*(1-enter)}px) scale(${.98+.02*enter})`}}/>
   <div style={{fontSize:37,fontWeight:500,lineHeight:1.4,marginTop:52,opacity:text,transform:`translateY(${10*(1-text)}px)`}}>만드는 과정까지, 함께.</div>
   <div style={{fontSize:28,marginTop:66,opacity:.68*text,letterSpacing:'.02em'}}>@yuhobuilds</div>
  </div>
  <AbsoluteFill style={{pointerEvents:'none',background:`radial-gradient(ellipse at center,transparent 55%,${t.shadow(.2)} 100%)`}}/>
 </AbsoluteFill>;
};

const ActualWave:React.FC<{levels:number[];duration:number}>=({levels,duration})=>{
 const f=useCurrentFrame(),{fps}=useVideoConfig();
 const intro=interpolate(f,[9.68*fps,10.05*fps],[0,1],{...clamp,easing:t.ease});
 const outro=interpolate(f,[13.35*fps,13.6*fps],[1,0],{...clamp,easing:t.exit});
 return <div style={{position:'absolute',left:96,right:142,top:950,opacity:intro*outro,transform:`translateY(${18*(1-intro)}px)`}}>
  <svg viewBox="0 0 820 210" style={{width:'100%',height:210}} aria-label="실제 적용 음원의 파형">
   {Array.from({length:76},(_,i)=>{
    const sample=Math.max(0,Math.min(levels.length-1,Math.floor((f/fps-1.5+i/75*1.5)/duration*levels.length)));
    const h=7+Math.pow(levels[sample]||0,.6)*175;
    return <rect key={i} x={i*10.8} y={(210-h)/2} width={4.8} height={h} rx={2.4} fill={t.shift} opacity={.35+.65*i/75}/>;
   })}
  </svg>
  <div style={{fontSize:29,fontWeight:400,lineHeight:1.5,letterSpacing:'-.02em',color:t.muted,marginTop:28}}>선택한 목소리 · 음질 보정</div>
 </div>;
};

const Trial:React.FC<{item:any;captions:any[];levels:number[]}>=({item,captions,levels})=>{
 const {fps}=useVideoConfig();let at=0;
 return <AbsoluteFill>
  <Audio src={staticFile('voice.wav')}/>
  <Audio src={staticFile('bed-ending.wav')}/>
  {item.scenes.map((scene:any,i:number)=>{
   const from=at,frames=Math.round(scene.duration*fps);at+=frames;
   return <Sequence key={i} from={from} durationInFrames={frames} premountFor={Math.round(.35*fps)} name={scene.title}>
    <FirstScene scene={scene} item={item} index={i} count={item.scenes.length} layoutProfile="balanced-portrait"/>
   </Sequence>;
  })}
  <ActualWave levels={levels} duration={13.6}/>
  <Captions cues={captions} layoutProfile="balanced-portrait"/>
  <Sequence from={Math.round(timing.bodySeconds*fps)} durationInFrames={Math.round(timing.endingSeconds*fps)} premountFor={Math.round(.4*fps)} name="SHIFT 엔딩"><Ending/></Sequence>
 </AbsoluteFill>;
};

const fallback={item:{brand:'SHIFT',account:'@yuhobuilds',scenes:[]},captions:[],levels:[]};
registerRoot(()=> <Composition id="ShiftVoiceTrial" component={Trial} width={1080} height={1920} fps={timing.fps} durationInFrames={Math.round((timing.bodySeconds+timing.endingSeconds)*timing.fps)} defaultProps={fallback}/>);
