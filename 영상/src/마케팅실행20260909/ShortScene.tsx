import React from 'react';
import {Artifact,BrandLockup,CheckedScene,Entrance,Headline,Progress} from './Frame';
import {theme} from './theme';
import type {ContentItem,Scene} from './types';
export const ShortScene:React.FC<{scene:Scene;item:ContentItem;index:number}>=({scene,item,index})=>{
 const isLab=item.brand==='LAB',lines=(scene.lines||[]).flatMap(x=>isLab?x.split(' · '):[x]);
 const label=isLab?'SYNK LAB · @synk.mn':item.id.includes('yuhobuilds')?'YUHO BUILDS · 공개 제작실':'SYNK BRIEF · 실무 도구';
 return <CheckedScene id={item.id} index={index} duration={scene.durationSec}>
 <Entrance><BrandLockup brand={item.brand}/></Entrance>
 <div style={{position:'absolute',top:420,left:100,width:820}}>
 <Entrance delay={.08}><div data-critical="eyebrow" style={{fontSize:27,lineHeight:1.35,color:isLab?theme.coral:theme.lapis,fontWeight:600,marginBottom:26}}>{scene.eyebrow||label}</div></Entrance>
 <Entrance delay={.1}><Headline text={scene.title} size={scene.title.length>28?72:84}/></Entrance>
 </div>
 {isLab?<>
 <div style={{position:'absolute',top:scene.kr?620:lines.length?645:730,left:100,width:820}}>
 {scene.kr&&<Entrance delay={.3}><div data-critical="korean" style={{fontFamily:theme.fonts.korean,fontSize:76,lineHeight:1.28,fontWeight:800,whiteSpace:'pre-line',wordBreak:'keep-all'}}>{scene.kr}</div></Entrance>}
 {scene.mn&&<Entrance delay={.45}><div data-critical="mongolian" style={{fontFamily:theme.fonts.latin,fontSize:41,lineHeight:1.32,fontWeight:500,marginTop:30,whiteSpace:'pre-line'}}>{scene.mn}</div></Entrance>}
 {scene.body&&<Entrance delay={.6}><div data-critical="body" style={{fontSize:37,lineHeight:1.4,marginTop:28,whiteSpace:'pre-line'}}>{scene.body}</div></Entrance>}
 </div>
 {lines.length>0&&<div style={{position:'absolute',left:100,top:765,width:820}}>{lines.map((t,i)=><Entrance key={i} delay={.4+i*.13}><div data-critical={`line-${i}`} style={{fontSize:46,lineHeight:1.35,marginBottom:19}}>{t}</div></Entrance>)}</div>}
 {scene.asset&&<Entrance delay={.65} style={{position:'absolute',left:lines.length?310:160,top:lines.length?1070:930}}><Artifact asset={scene.asset} width={lines.length?400:700} height={lines.length?350:460} duration={scene.durationSec}/></Entrance>}
 </>:<>
 <div style={{position:'absolute',top:730,left:100,width:820}}>
 {scene.body&&<Entrance delay={.28}><div data-critical="body" style={{fontSize:43,lineHeight:1.4,fontWeight:500,whiteSpace:'pre-line',wordBreak:'keep-all'}}>{scene.body}</div></Entrance>}
 {lines.map((t,i)=><Entrance key={i} delay={.45+i*.12}><div data-critical={`line-${i}`} style={{fontSize:37,lineHeight:1.35,marginTop:22}}>{t}</div></Entrance>)}
 </div>
 {scene.asset&&<Entrance delay={.6} style={{position:'absolute',left:165,top:970}}><Artifact asset={scene.asset} width={680} height={370} duration={scene.durationSec}/></Entrance>}
 {scene.tip&&<Entrance delay={.75} style={{position:'absolute',left:100,top:1380,width:820}}><div data-critical="tip" style={{fontSize:30,lineHeight:1.38,color:theme.muted,whiteSpace:'pre-line',wordBreak:'keep-all'}}>{scene.tip}</div></Entrance>}
 </>}
 <Progress count={item.scenes.length} index={index} label={label}/>
 </CheckedScene>;
};

