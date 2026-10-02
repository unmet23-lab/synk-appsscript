import React,{useEffect,useState} from 'react';
import {AbsoluteFill,Composition,Img,Loop,OffthreadVideo,cancelRender,continueRender,delayRender,registerRoot,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {theme} from './theme';
import pixels from './pixels.cjs';

type Plan={faces:number[];duration:number;masterDuration:number;fps:number};
type Sprites={water:string[];field:string[]};
type Props={scene:'water'|'field';plan:Plan;still?:boolean};
// Render with --public-dir=public/radioDreams20260910; do not copy unrelated public assets.
const src=(name:string)=>staticFile(name);
let spritePromise:Promise<Sprites>|undefined;
const load=async(name:string)=>{
 const im=new Image();im.src=src(name);await im.decode();
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(im,0,0);
 return ctx.getImageData(0,0,1024,1024).data;
};
const spriteData=()=>{
 if(!spritePromise)spritePromise=Promise.all(['water-0.webp','water-1.webp','water-2.webp','leaf-base.webp'].map(load)).then(async(all)=>{
  const result=pixels.build(all.slice(0,3),all[3]);
  const encode=(data:Uint8ClampedArray)=>{
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
   canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data),1024,1024),0,0);
   return canvas.toDataURL('image/png');
  };
  const urls={water:result.water.map(encode),field:result.field.map(encode)};
  await Promise.all([...urls.water,...urls.field].map(async(url)=>{const im=new Image();im.src=url;await im.decode();}));return urls;
 });
 return spritePromise;
};
function useSprites(){
 const [handle]=useState(()=>delayRender('Approved fixed-fur display composition'));
 const [sprites,setSprites]=useState<Sprites|null>(null);
 useEffect(()=>{spriteData().then(value=>{setSprites(value);continueRender(handle);}).catch(cancelRender);},[handle]);
 return sprites;
}

const Film:React.FC<Props>=({scene,plan,still=false})=>{
 const frame=useCurrentFrame(),{fps}=useVideoConfig(),t=frame/fps,sprites=useSprites();
 const water=scene==='water';
 const pose=water?{left:330,top:265,size:570,contact:840}:{left:455,top:305,size:580,contact:886};
 // Long low-amplitude breath, anchored at the ground. It is independent of expression changes.
 const breath=Math.sin(2*Math.PI*t/12),breathe=1+breath*.0016,dy=water?-.7*Math.sin(2*Math.PI*t/15):-.35*breath;
 const face=plan.faces[Math.min(frame,plan.faces.length-1)]||0;
 const image=sprites?.[scene][face];
 const foot=pose.top+pose.contact/1024*pose.size;
 const shadowWidth=water?255:240;
 return <AbsoluteFill style={{background:theme.paper}}>
  {still?<Img src={src(scene+'-still.png')} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:
   <Loop durationInFrames={15*fps}><OffthreadVideo src={src(scene+'-loop.mp4')} muted style={{width:1920,height:1080,objectFit:'cover'}}/></Loop>}
  {/* Grounding is a scene-specific contact, not a dark sticker outline. */}
  <div style={{position:'absolute',left:pose.left+pose.size*.43-shadowWidth/2,top:foot-(water?15:18),width:shadowWidth,height:water?31:45,borderRadius:'50%',background:`radial-gradient(ellipse at center,${theme.shadow(water?.17:.60)} 0%,${theme.shadow(water?.07:.26)} 34%,transparent 74%)`}}/>
  {water&&image&&<div style={{position:'absolute',left:pose.left,top:foot+1,width:pose.size,height:230,overflow:'hidden',opacity:.15,maskImage:'linear-gradient(to bottom,rgba(0,0,0,.78),transparent 85%)'}}>
   <Img src={image} style={{position:'absolute',top:-(1024-pose.contact)/1024*pose.size*.52,width:pose.size,height:pose.size*.52,transform:'scaleY(-1)',filter:'blur(1.8px)'}}/>
  </div>}
  {image&&<Img src={image} style={{position:'absolute',left:pose.left,top:pose.top+dy,width:pose.size,height:pose.size,transform:`scaleY(${breathe})`,transformOrigin:`43% ${pose.contact/1024*100}%`}}/>}
 </AbsoluteFill>;
};

const metadata=async({props}:{props:Props})=>{
 const response=await fetch(src('plan.json'));if(!response.ok)throw Error('Missing scene plan');
 const plan:Plan=await response.json();return {props:{...props,plan},durationInFrames:Math.round(plan.duration*plan.fps)};
};
const defaults={faces:[0],duration:61.6,masterDuration:60,fps:30};
registerRoot(()=><>
 <Composition id="water-dream" component={Film} width={1920} height={1080} fps={30} durationInFrames={1848} defaultProps={{scene:'water' as const,plan:defaults}} calculateMetadata={metadata}/>
 <Composition id="field-dream" component={Film} width={1920} height={1080} fps={30} durationInFrames={1848} defaultProps={{scene:'field' as const,plan:defaults}} calculateMetadata={metadata}/>
 <Composition id="water-layout" component={Film} width={1920} height={1080} fps={30} durationInFrames={1848} defaultProps={{scene:'water' as const,plan:defaults,still:true}} calculateMetadata={metadata}/>
 <Composition id="field-layout" component={Film} width={1920} height={1080} fps={30} durationInFrames={1848} defaultProps={{scene:'field' as const,plan:defaults,still:true}} calculateMetadata={metadata}/>
</>);
