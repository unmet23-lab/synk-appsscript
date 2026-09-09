import React from 'react';
import {Artifact,BrandLockup,CheckedScene,Entrance,Headline} from './Frame';
import {Captions} from './Captions';
import {theme} from './theme';
import type {ContentItem,Scene} from './types';
export const LectureScene:React.FC<{scene:Scene;item:ContentItem;index:number}>=({scene,item,index})=>{
 const clinic=item.id.includes('clinic');
 return <CheckedScene landscape id={item.id} index={index} duration={scene.durationSec}>
 <Entrance><BrandLockup brand="SHIFT" left={110} top={82} scale={.85}/></Entrance>
 <div style={{position:'absolute',left:110,top:228,width:1010}}>
 <Entrance delay={.08}><div data-critical="eyebrow" style={{fontSize:26,fontWeight:600,color:theme.lapis,marginBottom:25}}>{clinic?'가상 공개 클리닉':'SYNK SHIFT · 공개 실습'} · {String(index+1).padStart(2,'0')} / {item.scenes.length}</div></Entrance>
 <Entrance delay={.1}><Headline text={scene.title} size={76}/></Entrance>
 <Entrance delay={.35}><div data-critical="body" style={{fontSize:49,lineHeight:1.36,fontWeight:500,whiteSpace:'pre-line',wordBreak:'keep-all',marginTop:60}}>{scene.body}</div></Entrance>
 </div>
 {scene.asset&&<Entrance delay={.55} style={{position:'absolute',left:1200,top:310}}><Artifact asset={scene.asset} width={550} height={400} duration={scene.durationSec}/></Entrance>}
 <Entrance delay={.7} style={{position:'absolute',left:110,top:730,width:1650}}><div data-critical="tip" style={{fontSize:32,lineHeight:1.4,color:theme.muted,whiteSpace:'pre-line',wordBreak:'keep-all'}}>{scene.tip}</div></Entrance>
 <div style={{position:'absolute',left:110,top:822,width:1680,height:2,background:theme.stitch}}/>
 <Captions cues={scene.cues}/>
 </CheckedScene>;
};

