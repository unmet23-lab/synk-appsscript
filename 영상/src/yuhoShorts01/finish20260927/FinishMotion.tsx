import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {색} from '../../킷/색';

const clamp = {extrapolateLeft:'clamp', extrapolateRight:'clamp'} as const;
const ease = Easing.bezier(.22,.75,.2,1);

// Adapted from the registry directional-wipe primitive. Only the restrained
// panel reveal and depth movement are retained; there is no flash or RGB split.
export const SceneBridge:React.FC<React.PropsWithChildren<{scene:any;next:any}>>=({scene,next,children})=>{
 const frame=useCurrentFrame();
 const {kind='reveal-left',frames=8}=scene.transition||{};
 const p=scene.start===0?1:interpolate(frame,[0,frames],[0,1],{...clamp,easing:ease});
 const exit=next?interpolate(frame,[scene.duration,scene.duration+(next.transition?.frames||8)],[0,1],{...clamp,easing:ease}):0;
 const horizontal=kind==='reveal-left'||kind==='reveal-right';
 const direction=kind==='reveal-right'?-1:1;
 const clip=kind==='reveal-up'?`inset(${(1-p)*100}% 0 0 0)`:
  horizontal?(direction===1?`inset(0 ${(1-p)*100}% 0 0)`:`inset(0 0 0 ${(1-p)*100}%)`):undefined;
 const dark=['hook','zero','hours','joke','ending','signoff'].includes(scene.visual);
 return <AbsoluteFill data-finish-scene={scene.id} style={{background:색(dark?'Black':'Paper'),clipPath:clip,opacity:kind==='soft-zoom'?p:1}}><AbsoluteFill style={{transform:`translate(${horizontal?(1-p)*direction*32-exit*24:0}px,${kind==='reveal-up'?(1-p)*28:0}px) scale(${kind==='soft-zoom'?1+(1-p)*.022-exit*.012:1-exit*.012})`,transformOrigin:'50% 49%'}}>{children}</AbsoluteFill></AbsoluteFill>;
};

export function focusEnvelope(frame:number,start:number,end:number){
 return interpolate(frame,[start-3,start+4,end,end+6],[0,1,1,0],{...clamp,easing:ease});
}

export function storyReframe(scene:any,frame:number){
 const cue=scene.motionCue;
 if(!cue)return {scale:1,x:0,y:0};
 const p=interpolate(frame,[cue.at,cue.at+8],[0,1],{...clamp,easing:ease});
 return {scale:1+(cue.scale-1)*p,x:(cue.x||0)*p,y:(cue.y||0)*p};
}
