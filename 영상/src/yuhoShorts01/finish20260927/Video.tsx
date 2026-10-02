import React from 'react';
import {AbsoluteFill,Audio,Img,Sequence,interpolate,spring,staticFile,useCurrentFrame} from 'remotion';
import {본문스택} from '../../킷/폰트';
import {색} from '../../킷/색';
import {Opening} from './Opening';
import {Caption} from './Caption';
import {SceneBridge,focusEnvelope,storyReframe} from './FinishMotion';
const ink=색('Black'),paper=색('Paper'),blue=색('Lapis');
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const pop=(f:number,d=0)=>spring({fps:30,frame:Math.max(0,f-d),config:{damping:22,stiffness:240,mass:.65}});
const font=본문스택;
type Props={timing:any;captions:any[];words?:any[]};
const heads:Record<string,string[]>={
 hook:['번역만 하려다','앱 만드는 사람 됨'],setting:['몽골 학원 부원장','그런데… 심심함'],payment:['첫 결제의 목적','딱, 번역!'],inquiries:['학생 문의가','갑자기 늘었다!'],purpose:['출석 앱 하나로','도움이 된다면?'],tools:['일단 만들어보자!','Glide + 구글 시트'],zero:['개발 실력','ZERO'],screenshots:['찍고! 물어보고!','따라 하고!'],loop:['출석 앱이었는데…','이건… 뭐지?!'],hours:['하나만 더 하다가','17~18시간'],joke:['앱은요…?','고치고 또 고치고'],lesson:['다시 시작한다면','출석 하나부터!'],prompt:['처음이라면','이렇게 물어보세요'],action:['거창한 아이디어?','불편한 일 하나면 돼요'],ending:['다음 편','도구 켜고, 설정부터!'],timesaved:['처음 시작할 때','이 순서만 알았어도'],shortcut:['제가 헤맨 길,','여러분은 건너뛰세요'],signoff:['왕초보에서','1인 기업가까지']};
const labels:Record<string,string>={hook:'번역 → 첫 앱',setting:'6월의 시작',payment:'2026.06.02',inquiries:'첫 번째 필요',purpose:'그때의 구상',tools:'첫 시도',zero:'완전 초보',screenshots:'초보자의 생존법',loop:'어쩌다 이렇게 됐지',hours:'당시의 회고',joke:'끝없는 수정',lesson:'지금 다시 한다면',prompt:'오늘의 첫 질문',action:'나도 해보기',ending:'EP.02 예고',timesaved:'제가 헤맨 시간',shortcut:'함께 가는 지름길',signoff:'다음 편에서 만나요'};

type Expression='normal'|'smile'|'puzzled'|'surprise';
const Face:React.FC<{mood?:Expression;changes?:{at:number;mood:Expression}[];tearsAt?:number;tearsUntil?:number;accentAt?:number;scale?:number;style?:React.CSSProperties}> = ({mood='normal',changes=[],tearsAt,tearsUntil,accentAt,scale=1,style})=>{
 const f=useCurrentFrame();const bob=Math.sin(f/12)*2.5;
 const cues=[{at:0,mood},...changes];const ci=cues.findLastIndex(c=>f>=c.at);const cue=cues[ci];
 const previous=cues[Math.max(0,ci-1)].mood;const mix=ci===0?1:interpolate(f,[cue.at,cue.at+4],[0,1],clamp);
 const imageName=(m:Expression)=>m==='normal'?'yuho-head.png':`expressions/${m}.png`;
 const tear=tearsAt===undefined?0:interpolate(f-tearsAt,[0,5],[0,1],clamp)*(tearsUntil===undefined?1:interpolate(f,[tearsUntil,tearsUntil+4],[1,0],clamp));
 const blink=tear>0?interpolate(f-(tearsAt||0),[0,3],[0,1],clamp):cue.mood==='normal'?interpolate(f%103,[38,40,43,46],[0,1,1,0],clamp):0;
 const nod=cue.mood==='smile'?Math.sin(f/14)*1.3:cue.mood==='puzzled'?-3:0;
 const accent=accentAt===undefined?-1:f-accentAt;
 return <div style={{position:'absolute',width:340,height:430,transform:`translateY(${bob}px) scale(${scale})`,transformOrigin:'center bottom',...style}}>
  <svg viewBox="0 0 340 430" width="100%" height="100%" style={{overflow:'visible'}}>
   <path d="M65 428V329Q170 268 275 329V428" fill={blue} stroke={ink} strokeWidth="9"/>
   <path d="M140 295V330Q171 349 202 330V292" fill={paper} stroke={ink} strokeWidth="8"/>
   <g style={{transform:`rotate(${nod}deg)`,transformOrigin:'170px 300px'}}>
    {previous!==cue.mood&&mix<1?<image href={staticFile('yuho-journey-01/'+imageName(previous))} x="20" y="-20" width="310" height="344" preserveAspectRatio="xMidYMax meet"/>:null}
    <image href={staticFile('yuho-journey-01/'+imageName(cue.mood))} x="20" y="-20" width="310" height="344" preserveAspectRatio="xMidYMax meet" opacity={mix}/>
    {blink>0?<image href={staticFile('yuho-journey-01/expressions/blink.png')} x="20" y="-20" width="310" height="344" preserveAspectRatio="xMidYMax meet" opacity={blink}/>:null}
    {tear>0?<g opacity={tear}>{[[163,179],[242,191]].map(([x,y],i)=>{
      const length=interpolate(f-(tearsAt||0),[2,12],[3,157],clamp);
      const wave=Math.sin((f+i*3)/2)*2;
      return <g key={i}><path d={`M${x-16} ${y}Q${x} ${y+7} ${x+16} ${y}`} stroke="#2196EF" strokeWidth="7" fill="none" strokeLinecap="round"/>
       <path d={`M${x-10} ${y+2}Q${x-14+wave} ${y+length*.45} ${x-10} ${y+length}Q${x} ${y+length+8} ${x+10} ${y+length}Q${x+14+wave} ${y+length*.45} ${x+10} ${y+2}Z`} fill="#269EF1"/>
       <path d={`M${x-3} ${y+12}V${y+length-5}`} stroke="#B9EBFF" strokeWidth="4" strokeLinecap="round" strokeDasharray="17 14" strokeDashoffset={-f*5}/>
       {[0,1,2].map(n=><ellipse key={n} cx={x+(n-1)*13+Math.sin(f/3+n)*3} cy={y+length+10+(f*4+n*9)%24} rx={n===1?4:3} ry="6" fill="#49B7FF" opacity={.85-(f*4+n*9)%24/40}/>)}</g>;
    })}</g>:null}
   </g>
   <path d="M96 395L99 356M245 395L242 356" stroke={ink} strokeWidth="8"/>
   {accent>=0&&accent<24?<g opacity={interpolate(accent,[0,3,18,24],[0,1,1,0],clamp)} transform={`translate(310 84) rotate(12) scale(${.7+.3*pop(accent)})`}><text x="0" y="0" fill={blue} stroke={paper} strokeWidth="5" paintOrder="stroke" fontFamily={font} fontSize="100" fontWeight="900">!</text><path d="M-4 -98L-14 -114M32 -91L43 -107" stroke={blue} strokeWidth="5" strokeLinecap="round"/></g>:null}
  </svg>
 </div>;
};
const Card:React.FC<React.PropsWithChildren<{x?:number;y?:number;w?:number;h?:number;rotate?:number;dark?:boolean;delay?:number;style?:React.CSSProperties}>>=({children,x=95,y=760,w=835,h=350,rotate=0,dark=false,delay=0,style})=>{
 const f=useCurrentFrame();const p=pop(f,delay);return <div style={{position:'absolute',left:x,top:y,width:w,height:h,background:dark?ink:paper,color:dark?paper:ink,border:`5px solid ${ink}`,borderRadius:28,boxShadow:`12px 14px 0 ${blue}`,transform:`rotate(${rotate}deg) scale(${.78+.22*p})`,opacity:Math.min(1,p),padding:42,boxSizing:'border-box',...style}}><div style={{opacity:interpolate(f,[delay+3,delay+10],[0,1],clamp),transform:`translateY(${interpolate(f,[delay+3,delay+14],[15,0],clamp)}px)`}}>{children}</div></div>;
};
const Big:React.FC<React.PropsWithChildren<{size?:number;style?:React.CSSProperties}>>=({children,size=76,style})=><div style={{fontSize:size,fontWeight:850,lineHeight:1.22,letterSpacing:'-.045em',whiteSpace:'pre-line',wordBreak:'keep-all',...style}}>{children}</div>;
const Sticker:React.FC<{text:string;x:number;y:number;delay?:number;angle?:number;dark?:boolean}> = ({text,x,y,delay=0,angle=-5,dark=false})=>{
 const f=useCurrentFrame();return <div style={{position:'absolute',left:x,top:y,background:dark?paper:blue,color:dark?ink:paper,padding:'15px 25px',borderRadius:14,fontSize:48,fontWeight:850,transform:`rotate(${angle}deg) scale(${pop(f,delay)})`,border:`3px solid ${dark?ink:paper}`}}>{text}</div>;
};
const PromptCard=({typing}:any)=>{
 const f=useCurrentFrame();
 const placeholder='[내가 만들고 싶은 것 입력]';
 const example='학원 출석 앱을 만들고 싶어.';
 const typingStart=typing.startFrame,typingEnd=typing.endFrame;
 const count=typing.keys.filter((key:any)=>f>=key.frame).at(-1)?.count||0;
 const typed=f>=typingStart;
 const identityFocus=focusEnvelope(f,71,106);
 const roadmapFocus=focusEnvelope(f,160,225);
 const cursor=f<typingEnd||Math.floor((f-typingEnd)/10)%2===0;
 return <Card y={655} h={750} style={{padding:'34px 38px'}}>
  <div style={{fontSize:31,color:blue,fontWeight:750}}>내 아이디어로 바꿔 물어보세요</div>
  <Big size={61} style={{marginTop:24,color:identityFocus>.1?blue:ink}}>나는 개발이 처음이야.</Big>
  <div style={{marginTop:22,border:`3px dashed ${blue}`,borderRadius:16,padding:'16px 19px',height:153,boxSizing:'border-box',background:'#EDF2FF'}}>
   <div style={{fontSize:25,fontWeight:750,color:blue,marginBottom:9}}>{typed?'예시 · 직접 바꿔 쓰는 부분':'여기에 내 아이디어 입력'}</div>
   <div style={{fontSize:49,fontWeight:850,letterSpacing:'-.045em',whiteSpace:'nowrap',color:typed?ink:'#76819A'}}>{typed?example.slice(0,count):placeholder}<span style={{borderRight:`3px solid ${blue}`,marginLeft:4,opacity:cursor?1:0}}>&#8203;</span></div>
  </div>
  <Big size={59} style={{marginTop:26,lineHeight:1.28,transformOrigin:"left top",transform:`translateX(${roadmapFocus*5}px)`,borderLeft:`5px solid ${roadmapFocus>.1?blue:"transparent"}`,paddingLeft:12}}>가장 효율적으로<br/>만들 수 있는 <span style={{color:blue}}>로드맵을<br/>추천해 줘.</span></Big>
 </Card>;
};
function Art({s}:any){const f=useCurrentFrame();const halfway=Math.floor(s.duration*.5);switch(s.visual){
 case 'hook':return <><Face mood="normal" changes={[{at:57,mood:'surprise'}]} accentAt={57} scale={1.2} style={{left:342,top:698}}/><Card x={78} y={700} w={365} h={232} rotate={-7}><Big size={80}>번역</Big><div style={{fontSize:33,marginTop:12}}>하러 왔는데</div></Card><Card x={575} y={927} w={350} h={265} rotate={7} delay={28}><Big size={67}>출석 앱?</Big><div style={{fontSize:34,marginTop:14}}>만드는 중!</div></Card></>;
 case 'setting':return <><Card y={725} h={448}><div style={{fontSize:39,letterSpacing:2}}>ULAANBAATAR</div><Big size={78} style={{marginTop:34}}>스카이라인에듀<br/>부원장으로 일하던 때</Big></Card><Face changes={[{at:67,mood:'puzzled'}]} style={{left:620,top:945}} scale={.73}/><Sticker text="친구 없음…" x={102} y={1224} delay={67}/></>;
 case 'payment':return <><Card y={765} h={400} rotate={-3}><div style={{fontSize:40}}>남아 있는 첫 결제 기록</div><div style={{position:'relative',width:720,height:142,overflow:'hidden',marginTop:35,background:'#1c1c1c',borderRadius:12}}><Img src={staticFile('yuho-journey-01/receipt.png')} style={{position:'absolute',width:1532*3,left:-28*3,top:-494*3,maxWidth:'none'}}/></div></Card><Sticker text="개발? 아직 아님!" x={261} y={1227} delay={30}/></>;
 case 'inquiries':return <><Face mood="surprise" changes={[{at:49,mood:'puzzled'}]} scale={.82} style={{left:550,top:1020}}/>{[0,1,2,3].map((n)=><Card key={n} x={91+n*20} y={666+n*91} w={750} h={108} rotate={n%2?3:-3} delay={n*9} style={{padding:'24px 30px'}}><Big size={40}>새로운 학생 문의가 도착했습니다!</Big></Card>)}</>;
 case 'purpose':return <><Card y={703} h={225}><Big size={58}>학생 출석 기록</Big><div style={{fontSize:37,marginTop:18}}>누가 오고, 누가 돌아갔는지</div></Card><Card x={127} y={993} w={772} h={244} delay={33} rotate={3}><Big size={51}>부모님께 알림<br/>선생님은 관리가 편하게</Big></Card><div style={{position:'absolute',left:95,top:1300,fontSize:29,color:blue}}>당시 만들고 싶었던 기능 · 실제 운영 화면 아님</div></>;
 case 'tools':return <><Card x={90} y={773} w={382} h={320} rotate={-5}><Big size={66}>Glide</Big><div style={{fontSize:39,marginTop:35}}>앱 화면</div></Card><Big size={100} style={{position:'absolute',left:499,top:870}}>+</Big><Card x={614} y={773} w={330} h={320} rotate={5} delay={12}><Big size={61}>구글<br/>시트</Big><div style={{fontSize:36,marginTop:14}}>기록 저장</div></Card><Sticker text="근데 내 실력은…?" x={220} y={1210} delay={halfway}/></>;
 case 'zero':return <><Face mood="puzzled" tearsAt={78} scale={1.35} style={{left:354,top:836}}/><Big size={240} style={{position:'absolute',left:75,top:639,color:blue,transform:`scale(${pop(f)})`}}>0</Big><Sticker text="Claude Code…?" x={100} y={760} delay={24} dark/><Sticker text="설정부터 막힘" x={115} y={1245} delay={78}/></>;
 case 'screenshots':return <>{['01  화면 찍고','02  클로드에게 묻고','03  따라 해보고'].map((t,n)=><Card key={n} y={681+n*205} h={170} rotate={n%2?2:-2} delay={[26,45,58][n]} style={{padding:37}}><Big size={62}>{t}</Big></Card>)}</>;
 case 'loop':{
  const reveal=s.wordCues.find((w:any)=>w.text==='괴상한')?.startFrame??55;
  const drift=interpolate(f,[reveal-12,reveal+12],[0,1],clamp);
  return <><Card y={703} h={470} rotate={-2*drift} style={{padding:34}}>
   <div style={{fontSize:34,fontWeight:750,color:blue}}>처음 목표는 분명 출석 앱</div>
   <div style={{position:'relative',height:275,marginTop:30}}>{['출석 기록','등하원 알림','학생 관리'].map((t,n)=><div key={t} style={{position:'absolute',left:drift*[35,210,-15][n],top:n*82+drift*[28,-20,-47][n],width:690-drift*n*110,height:70,background:n===1?'#EDF2FF':paper,border:`3px solid ${ink}`,borderRadius:12,padding:'12px 20px',boxSizing:'border-box',fontSize:37,fontWeight:800,transform:`rotate(${drift*[-9,12,-4][n]}deg)`}}>{f>=reveal+n*4?['출석… 맞나?','이 버튼은 왜 여기?','???'][n]:t}</div>)}</div>
  </Card>
  <Face mood="smile" changes={[{at:Math.max(1,reveal-16),mood:'puzzled'},{at:reveal,mood:'surprise'}]} accentAt={reveal} tearsAt={reveal+16} scale={.91} style={{left:608,top:976}}/>
  <Sticker text="기능은 늘고, 출석은 뒷전…" x={108} y={1275} delay={reveal+8}/>
  </>;
 }
 case 'hours':return <><Card y={705} h={494} rotate={-3}><div style={{fontSize:35}}>당시를 돌이켜 보면</div><Big size={176} style={{marginTop:34,color:blue}}>17–18</Big><Big size={67}>시간 붙잡았던 것 같아요</Big></Card><div style={{position:'absolute',left:100,top:1260,fontSize:31,color:paper}}>수업 시간을 제외한 주관적 회고 · 권장 학습량 아님</div></>;
 case 'joke':return <><Face mood="smile" changes={[{at:43,mood:'puzzled'},{at:138,mood:'surprise'},{at:187,mood:'puzzled'}]} tearsAt={97} tearsUntil={138} accentAt={153} scale={1.15} style={{left:350,top:834}}/>{f<138?<Sticker text={f<61?'심심함: 해결 ✓':'뜯고 → 고치고 → 또…'} x={145} y={720}/>:<Sticker text="탈모빔… 아직이지?" x={135} y={720} delay={138}/>}<Card x={130} y={1151} w={776} h={220} dark delay={43} rotate={3}><Big size={f<138?64:60}>{f<97?'앱은요…?':f<138?'하아… 깊어지는 한숨':'가끔 머리부터\n확인하게 됨'}</Big></Card></>;
 case 'lesson':return <><Card y={712} h={247} rotate={-3}><Big size={62} style={{textDecoration:'line-through',opacity:.42}}>출석 + 알림 + 관리…</Big></Card><Card y={991} h={259} delay={88} rotate={2}><Big size={70}>학생 출석 하나<br/>남기는 것부터!</Big></Card></>;
 case 'prompt':return <PromptCard typing={s.typing}/>;
 case 'action':return <><Face mood="normal" changes={[{at:33,mood:'smile'}]} scale={1.2} style={{left:349,top:765}}/><Card x={115} y={1144} w={805} h={192} rotate={-3}><Big size={59}>내가 매번 불편했던 일은?</Big></Card></>;
 case 'ending':return <><Card y={733} h={460} rotate={-3}><div style={{fontSize:39,color:blue,fontWeight:800}}>다음 편 · 완전 초보의 첫 설정</div><Big size={94} style={{marginTop:44}}>만들기 전에<br/>켜는 법부터?!</Big></Card><Sticker text="막혔던 순서대로, 같이." x={121} y={1280} delay={22} dark/></>;
 case 'shortcut':return <><Card y={707} h={560}><Big size={57}>제가 헤맨 길</Big><svg viewBox="0 0 720 200" style={{width:'100%',height:200,marginTop:20}}><path d="M20 70L150 150L250 40L370 145L485 40L650 110" fill="none" stroke={ink} strokeWidth="9" strokeDasharray="14 14" opacity=".2"/><path d="M20 100H650M612 60L655 100L612 140" fill="none" stroke={blue} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="800" strokeDashoffset={interpolate(f,[38,54],[800,0],clamp)}/></svg><Big size={70} style={{color:blue}}>여러분은 건너뛰세요.</Big></Card></>;
 case 'signoff':return <><div style={{position:'absolute',left:269,top:617,width:496,height:489,border:`5px solid ${paper}`,borderRadius:32,overflow:'hidden',transform:`rotate(-2deg) scale(${.97+.03*pop(f)})`,boxShadow:`12px 14px 0 ${blue}`}}><Img src={staticFile('yuho-journey-01/ending-portrait.jpg')} style={{width:'100%',height:'100%',objectFit:'cover',transform:`scale(${interpolate(f,[0,s.duration],[1,1.055],clamp)})`}}/></div><Card y={1173} h={232} rotate={-2} style={{padding:'25px 42px'}}><Big size={65}>여러분의 시간을<br/><span style={{color:blue}}>아껴드립니다!</span></Big></Card></>;
 default:return null;
}}
function Scene({s}:any){const f=useCurrentFrame();const dark=['hook','zero','hours','joke','ending','signoff'].includes(s.visual);const h=heads[s.visual]||['',''];const camera=storyReframe(s,f);if(s.visual==='timesaved')return <Opening scene={s}/>;return <AbsoluteFill style={{background:dark?ink:paper,color:dark?paper:ink,fontFamily:font,overflow:'hidden'}}>
 <div style={{position:'absolute',inset:0,opacity:dark?.13:.08,backgroundImage:`radial-gradient(${dark?paper:ink} 1.8px,transparent 1.8px)`,backgroundSize:'28px 28px'}}/>
 <div style={{position:'absolute',left:83,right:122,top:162,display:'flex',justifyContent:'space-between',fontSize:31,fontWeight:700}}><span>yuhobuilds</span><span>EP.01 · {labels[s.visual]}</span></div>
 <div style={{position:'absolute',left:83,right:115,top:292}}>{h.map((line,i)=><div key={line} style={{overflow:'hidden',paddingBottom:8,marginTop:i?14:0}}><Big size={i?100:92} style={{color:i?(dark?paper:blue):undefined,opacity:interpolate(f,[i*4,5+i*4],[0,1],clamp),transform:`translateY(${(1-pop(f,i*4))*48}px)`}}>{line}</Big></div>)}</div>
 <div style={{position:'absolute',inset:0,transform:`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`,transformOrigin:'center 1000px'}}><Art s={s}/></div>
 {s.visual!=='hook'?<div style={{position:'absolute',left:84,right:115,top:1770,fontSize:28,opacity:.66}}>@yuhobuilds · AI 초보부터 하나씩</div>:null}
 </AbsoluteFill>}
export const Video:React.FC<Props>=({timing,captions,words=[]})=>{const f=useCurrentFrame();const ms=f/30*1000;const active=captions.find(c=>ms>=c.startMs&&ms<c.endMs);const w=words.find(w=>f/30>=w.start&&f/30<w.end);return <AbsoluteFill style={{background:ink}}>
 {timing.scenes.map((s:any,i:number)=>{const next=timing.scenes[i+1];return <Sequence key={s.id} from={s.start} durationInFrames={s.duration+(next?.transition?.frames||0)}><SceneBridge scene={s} next={next}><Scene s={s}/></SceneBridge></Sequence>})}
 <Audio src={staticFile(timing.audioFile)}/>
 {active?<Caption caption={active} ms={ms}/>:null}
 <div style={{position:'absolute',bottom:0,left:0,height:9,width:`${f/timing.durationInFrames*100}%`,background:blue}}/>
 </AbsoluteFill>};
export const Cover=()=> <AbsoluteFill style={{background:paper,fontFamily:font,color:ink}}><div style={{position:'absolute',left:82,top:192,fontSize:36,fontWeight:700}}>YUHO BUILDS · 01</div><Big size={117} style={{position:'absolute',left:82,top:379}}>번역만 하려다<br/><span style={{color:blue}}>앱 만드는<br/>사람 됨.</span></Big><Face mood="surprise" scale={1.5} style={{left:380,top:1005}}/><Sticker text="개발 실력 ZERO" x={98} y={1340}/><div style={{position:'absolute',left:84,top:1760,fontSize:32}}>@yuhobuilds</div></AbsoluteFill>;
