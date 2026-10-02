import React,{useId,useState,useEffect} from 'react';
import {Img,staticFile,useCurrentFrame,useVideoConfig,interpolate,delayRender,continueRender,cancelRender} from 'remotion';
import assetMap from '../../public/firstposts20260910/assets.json';
import {theme as t} from './theme';
const source=(key:string)=>staticFile('firstposts20260910/'+(assetMap as any)[key]);
const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};

export const LabMascot:React.FC<{scene:any}>=({scene})=>{
 const f=useCurrentFrame(),{fps}=useVideoConfig(),id=useId().replaceAll(':',''),a=scene.mascotAnimation,time=f/fps;
 const [handle]=useState(()=>delayRender('Approved LAB mascot images'));
 useEffect(()=>{const keys=a?[a.baseAsset,a.closedAsset,a.smileAsset,a.eyeMaskAsset||'mong-eye-union']:[scene.asset];
  Promise.all(keys.map(key=>new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve();img.onerror=()=>reject(new Error('Missing mascot image: '+key));img.src=source(key);}))).then(()=>continueRender(handle)).catch(cancelRender);
 },[a,scene.asset,handle]);
 if(!a)return <Img src={source(scene.asset)} style={{width:'100%',height:'100%',objectFit:'contain'}}/>;
 const smiling=time>=a.smile.fromSeconds&&time<a.smile.toSeconds;
 const blinkActive=a.blinks.some((b:any)=>time>=b.atSeconds&&time<b.atSeconds+b.durationSeconds);
 // A two-frame closed-eye pose joins open/smile states without ever blending
 // a glass pupil with a stitched eyelid. Body movement remains continuous.
 const blink=Number(blinkActive||(smiling&&(time<a.smile.fromSeconds+2/fps||time>=a.smile.toSeconds-2/fps)));
 const smile=Number(smiling&&!blink);
 const reaction=interpolate(time,[a.bodyReactionAtSeconds,a.bodyReactionAtSeconds+.12,a.bodyReactionAtSeconds+.38,a.bodyReactionAtSeconds+.66],[0,-5,-1,0],clamp);
 return <div style={{position:'absolute',left:0,top:'50%',width:'100%',aspectRatio:'1',transform:`translateY(calc(-50% + ${reaction}px))`}}>
  <svg width="100%" height="100%" viewBox="0 0 4096 4096" style={{display:'block'}}>
   <defs>
    <filter id={id+'-opaque'} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB"><feComponentTransfer><feFuncA type="table" tableValues="1 1"/></feComponentTransfer></filter>
    <mask id={id+'-body'} maskUnits="userSpaceOnUse" x="0" y="0" width="4096" height="4096" style={{maskType:'alpha'}}><image href={source(a.baseAsset)} width="4096" height="4096"/><image href={source(a.eyeMaskAsset||'mong-eye-union')} width="4096" height="4096"/></mask>
    <mask id={id+'-eyes'} maskUnits="userSpaceOnUse" x="0" y="0" width="4096" height="4096" style={{maskType:'alpha'}}><image href={source(a.eyeMaskAsset||'mong-eye-union')} width="4096" height="4096"/></mask>
   </defs>
   {/* Apply one common alpha, with only the original eye-highlight holes filled.
       The Paper underlay retains the open-eye highlights without leaving holes
       in the closed/smiling stitch. Outside the two eye unions nothing changes. */}
   <g mask={`url(#${id}-body)`}>
    <image href={source(a.baseAsset)} width="4096" height="4096" filter={`url(#${id}-opaque)`}/>
    <g mask={`url(#${id}-eyes)`}>
     <rect width="4096" height="4096" fill={t.paper}/>
     <image href={source(a.baseAsset)} width="4096" height="4096"/>
     <image href={source(a.smileAsset)} width="4096" height="4096" filter={`url(#${id}-opaque)`} opacity={smile}/>
     <image href={source(a.closedAsset)} width="4096" height="4096" filter={`url(#${id}-opaque)`} opacity={blink}/>
    </g>
   </g>
  </svg>
 </div>;
};
