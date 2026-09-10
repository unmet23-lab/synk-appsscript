import React from 'react';
import {AbsoluteFill,Freeze,Html5Video,Img,OffthreadVideo,Sequence,staticFile,useCurrentFrame,useVideoConfig,interpolate} from 'remotion';
import {FilmAudio} from './FilmAudio';
import {LabPortraitScene} from './LabPortraitScene';
import {QuietEnding} from './QuietEnding';
import {FirstScene} from './FirstScene';
import {LabScene,LabEnding,labMediaRect} from './LabScene';
import {Captions} from './Captions';
import {theme as t} from './theme';
import assetMap from '../../public/firstposts20260910/assets.json';
const musicSource=()=>staticFile('firstposts20260910/pulse-full.mp4');
const MusicBridge:React.FC<{scene:any;item:any;index:number;count:number;decodeInBrowser?:boolean}>=({scene:s,item,index,count,decodeInBrowser})=>{
 const MusicVideo=decodeInBrowser?Html5Video:OffthreadVideo;
 const f=useCurrentFrame(),{fps,width,height}=useVideoConfig(),frames=Math.round(s.duration*fps);
 const lead=Math.round(s.musicLeadSeconds*fps),leadAt=frames-lead,growAt=frames-Math.round(2.8*fps);
 const progress=interpolate(f,[growAt,frames-1],[0,1],{easing:t.drift,extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const rect=labMediaRect(growAt,fps,frames,width,height);
 const smallScale=rect.width/width,startX=rect.left,startY=rect.top;
 return <AbsoluteFill style={{background:t.paper,overflow:'hidden'}}>
  <AbsoluteFill style={{opacity:interpolate(f,[growAt,growAt+.3*fps],[1,0],{easing:t.exit,extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}>
   <LabScene scene={s} item={item}/>
  </AbsoluteFill>
  {f>=growAt&&<AbsoluteFill style={{transformOrigin:'0 0',transform:`translate(${startX*(1-progress)}px,${startY*(1-progress)}px) scale(${smallScale+(1-smallScale)*progress})`}}>
   <Img src={staticFile('firstposts20260910/'+(assetMap as any)[s.asset])} style={{width:'100%',height:'100%',objectFit:'contain'}}/>
   <Sequence from={leadAt} durationInFrames={lead}>
    <MusicVideo src={musicSource()} muted style={{width:'100%',height:'100%',objectFit:'contain',opacity:interpolate(f,[leadAt,leadAt+.6*fps],[0,1],{easing:t.ease,extrapolateLeft:'clamp',extrapolateRight:'clamp'})}}/>
   </Sequence>
  </AbsoluteFill>}
 </AbsoluteFill>;
};
const SceneVisual:React.FC<{scene:any;item:any;index:number;count:number;holdEnd?:boolean}>=({scene,item,index,count,holdEnd})=>item.id==='03-lab-tiktok'?<LabPortraitScene scene={scene} item={item}/>:<FirstScene scene={scene} item={item} index={index} count={count} holdEnd={holdEnd}/>;
export const Film:React.FC<{item:any;decodeInBrowser?:boolean}>=({item,decodeInBrowser=false})=>{
 const MusicVideo=decodeInBrowser?Html5Video:OffthreadVideo;
 const {fps}=useVideoConfig();let at=0;
 const musicIndex=item.scenes.findIndex((s:any)=>s.layout==='music');
 const bridge=musicIndex>0&&item.id==='01-lab-youtube'&&item.scenes[musicIndex-1].layout==='music-bridge'?item.scenes[musicIndex-1]:null;
 const hasEnding=item.scenes.at(-1)?.layout==='ending',count=item.scenes.length-(hasEnding?1:0);
 return <AbsoluteFill><FilmAudio item={item}/>
  {item.scenes.map((s:any,i:number)=>{
  const frames=Math.round(s.duration*fps),start=at;at+=frames;
  return <Sequence key={i} from={start} durationInFrames={frames} name={s.title||s.musicTitle}>
   {s.layout==='music'?<MusicVideo src={musicSource()} startFrom={Math.round((s.sourceStartSeconds||0)*fps)} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<>
    {s===bridge?<MusicBridge scene={s} item={item} index={i} count={item.scenes.length} decodeInBrowser={decodeInBrowser}/>:item.id==='01-lab-youtube'?(s.layout==='ending'?<LabEnding scene={s}/>:<LabScene scene={s} item={item}/>):s.layout==='ending'?<QuietEnding scene={s} item={item} previous={<Freeze frame={Math.round(item.scenes[i-1].duration*fps)-1}><SceneVisual scene={item.scenes[i-1]} item={item} index={i-1} count={count} holdEnd/></Freeze>}/>:<SceneVisual scene={s} item={item} index={i} count={count} holdEnd={hasEnding&&i===count-1}/>}
    {item.brand!=='LAB'&&s.layout!=='ending'&&s.captions?.length?<Captions cues={s.captions}/>:null}
   </>}
  </Sequence>;
 })}</AbsoluteFill>;
};
