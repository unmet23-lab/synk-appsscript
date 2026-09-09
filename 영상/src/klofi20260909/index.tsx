import React from 'react';
import {AbsoluteFill,Audio,Composition,Img,Loop,OffthreadVideo,interpolate,registerRoot,staticFile,useCurrentFrame} from 'remotion';
import {theme} from '../마케팅실행20260909/theme';

type Plan={title:string;duration:number;faces:string[];files:Record<string,string>;shadow:{bottom:string;color:string}};
const src=(name:string)=>staticFile(`klofi20260909/${name}`);
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:theme.ease.inOut} as const;

const Film:React.FC<{plan:Plan}>=({plan})=>{
 const frame=useCurrentFrame();
 // Body position and expression clock match the approved broadcast, not wardrobe candidates.
 const face=plan.faces[Math.min(frame,plan.faces.length-1)];
 const titleOpacity=interpolate(frame,[0,24,210,240],[0,1,1,0],clamp);
 const titleY=interpolate(frame,[0,30],[12,0],{...clamp,easing:theme.ease.out});
 return <AbsoluteFill style={{background:theme.ink,fontFamily:theme.fonts.body,color:theme.paper}}>
  <Loop durationInFrames={1800}><OffthreadVideo src={src('stage-v4.mp4')} muted style={{width:1920,height:1080}}/></Loop>
  <div style={{position:'absolute',left:652.8,bottom:94.5,width:614.4,height:614.4}}>
   <div style={{position:'absolute',left:'7%',width:'86%',height:'14%',bottom:plan.shadow.bottom,borderRadius:'50%',transform:'translateY(50%)',background:`radial-gradient(ellipse at 50% 50%,${plan.shadow.color} 0%,transparent 70%)`}}/>
   <Img src={src(plan.files[face])} style={{width:'100%',height:'100%',transform:'translateY(-4.17%) scale(1)',transformOrigin:'50% 50%'}}/>
  </div>
  {/* Editorial label also covers the older colored-k imprint baked into the stage.
      Supplied neutral stitched logo is used unchanged; no repainting of bitmap letters. */}
  <div style={{position:'absolute',left:64,bottom:48,width:560,height:222,boxSizing:'border-box',padding:'24px 28px',background:theme.ink,borderRadius:12,boxShadow:`0 8px 28px ${theme.shadow(.16)}`}}>
   <div style={{display:'flex',alignItems:'center',gap:24,height:48}}>
    <Img src={src('synk-paper.webp')} style={{width:115,height:48,objectFit:'contain'}}/>
    <span style={{fontSize:25,letterSpacing:'.08em',fontWeight:600}}>K-LOFI24</span>
   </div>
   <div style={{marginTop:16,fontSize:33,lineHeight:1.3,fontWeight:700,letterSpacing:theme.tracking,whiteSpace:'nowrap'}}>{plan.title}</div>
   <div style={{marginTop:12,fontSize:22,color:theme.paper,opacity:.8}}>FULL TRACK · 01:01.6 · SYNK PULSE</div>
  </div>
  <div style={{position:'absolute',left:72,top:62,opacity:titleOpacity,transform:`translateY(${titleY}px)`,fontSize:52,lineHeight:1.12,fontWeight:700,letterSpacing:theme.tracking,textShadow:`0 2px 14px ${theme.shadow(.55)}`}}>A LIGHT LEFT ON.</div>
  <Audio src={src('song.wav')} volume={1}/>
 </AbsoluteFill>;
};

registerRoot(()=> <Composition id="klofi-full-track" component={Film} width={1920} height={1080} fps={30} durationInFrames={1848} defaultProps={{plan:{title:'',duration:61.6,faces:[],files:{},shadow:{bottom:'20.6%',color:'transparent'}}}}
 calculateMetadata={async()=>{
  const response=await fetch(src('plan.json'));if(!response.ok)throw Error('Missing K-LOFI plan');
  const plan:Plan=await response.json();return {props:{plan},durationInFrames:Math.round(plan.duration*30)};
 }}/>)
