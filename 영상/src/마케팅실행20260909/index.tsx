import React from 'react';
import {Composition,registerRoot,staticFile} from 'remotion';
import {MarketingVideo} from './Video';
import {videoIds,type ContentItem} from './types';
const Root:React.FC=()=> <>{videoIds.map(id=>{
 const long=id.startsWith('shift-public-');
 const item:ContentItem={id,brand:'SHIFT',format:long?'lecture':'video',width:long?1920:1080,height:long?1080:1920,scenes:[{title:'',durationSec:1}]};
 return <Composition key={id} id={`marketing-${id}`} component={MarketingVideo} defaultProps={{item}} width={item.width!} height={item.height!} fps={30} durationInFrames={30}
 calculateMetadata={async()=>{
  const response=await fetch(staticFile(`마케팅실행20260909/plans/${id}.json`));
  if(!response.ok)throw new Error(`Prepared render plan missing: ${id}`);
  const prepared=await response.json() as ContentItem;
  return {props:{item:prepared},width:prepared.width,height:prepared.height,durationInFrames:prepared.scenes.reduce((n,s)=>n+Math.round(s.durationSec*30),0)};
 }}/>;
 })}</>;
registerRoot(Root);

