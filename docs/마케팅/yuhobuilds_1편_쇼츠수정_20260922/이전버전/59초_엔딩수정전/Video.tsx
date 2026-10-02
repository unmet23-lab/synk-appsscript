import React from 'react';
import {AbsoluteFill,Audio,Img,Sequence,interpolate,spring,staticFile,useCurrentFrame} from 'remotion';
import {본문스택} from '../킷/폰트';
import {색} from '../킷/색';
const ink=색('Black'),paper=색('Paper'),blue=색('Lapis');
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const pop=(f:number,d=0)=>spring({fps:30,frame:Math.max(0,f-d),config:{damping:13,stiffness:230,mass:.65}});
const font=본문스택;
type Props={timing:any;captions:any[];words?:any[]};
const heads:Record<string,string[]>={
 hook:['번역만 하려다','앱 만드는 사람 됨'],setting:['몽골 학원 부원장','그런데… 심심함'],payment:['첫 결제의 목적','딱, 번역!'],inquiries:['학생 문의가','갑자기 늘었다!'],purpose:['출석 앱 하나로','도움이 된다면?'],tools:['일단 만들어보자!','Glide + 구글 시트'],zero:['개발 실력','ZERO'],screenshots:['찍고! 물어보고!','따라 하고!'],loop:['오! 다음 화면!','…이건 또 뭐야?'],hours:['하나만 더 하다가','17~18시간'],joke:['심심함 해결!','앱은 만드는 중'],lesson:['다시 시작한다면','출석 하나부터!'],prompt:['처음이라면','이렇게 물어보세요'],action:['거창한 아이디어?','불편한 일 하나면 돼요'],ending:['다음 편','켜는 것부터 막혔다']};
const labels:Record<string,string>={hook:'번역 → 첫 앱',setting:'6월의 시작',payment:'2026.06.02',inquiries:'첫 번째 필요',purpose:'그때의 구상',tools:'첫 시도',zero:'완전 초보',screenshots:'초보자의 생존법',loop:'무한 반복',hours:'당시의 회고',joke:'뜻밖의 성과',lesson:'지금 다시 한다면',prompt:'오늘의 첫 질문',action:'나도 해보기',ending:'EP.02 예고'};

const Face:React.FC<{mood?:string;scale?:number;style?:React.CSSProperties}> = ({mood='normal',scale=1,style})=>{
 const f=useCurrentFrame();const bob=Math.sin(f/7)*5;const shocked=['panic','zero'].includes(mood);const happy=['happy','joke'].includes(mood);
 return <div style={{position:'absolute',width:340,height:430,transform:`translateY(${bob}px) scale(${scale})`,transformOrigin:'center bottom',...style}}>
  <svg viewBox="0 0 340 430" width="100%" height="100%">
   <path d="M65 428V329Q170 268 275 329V428" fill={blue} stroke={ink} strokeWidth="9"/>
   <path d="M140 295V330Q171 349 202 330V292" fill={paper} stroke={ink} strokeWidth="8"/>
   <ellipse cx="169" cy="183" rx="112" ry="125" fill={paper} stroke={ink} strokeWidth="9"/>
   <path d="M56 164Q31 38 160 24Q293 12 285 171L241 111L219 135L187 83L140 123L126 96L70 161Z" fill={ink}/>
   {happy?<><path d="M102 190Q117 169 132 190M201 190Q216 169 231 190" fill="none" stroke={ink} strokeWidth="8" strokeLinecap="round"/></>:<><ellipse cx="118" cy="185" rx={shocked?15:9} ry={shocked?22:13} fill={ink}/><ellipse cx="218" cy="185" rx={shocked?15:9} ry={shocked?22:13} fill={ink}/></>}
   {shocked?<ellipse cx="168" cy="247" rx="20" ry="26" fill={ink}/>:happy?<path d="M126 233Q168 292 211 233Z" fill={ink}/>:<path d="M145 248Q170 261 197 245" fill="none" stroke={ink} strokeWidth="8" strokeLinecap="round"/>}
   {mood==='panic'?<path d="M292 144Q328 194 300 200Q272 195 292 144Z" fill={blue}/>:null}
   <path d="M96 395L99 356M245 395L242 356" stroke={ink} strokeWidth="8"/>
  </svg>
 </div>;
};
const Card:React.FC<React.PropsWithChildren<{x?:number;y?:number;w?:number;h?:number;rotate?:number;dark?:boolean;delay?:number;style?:React.CSSProperties}>>=({children,x=95,y=760,w=835,h=350,rotate=0,dark=false,delay=0,style})=>{
 const f=useCurrentFrame();const p=pop(f,delay);return <div style={{position:'absolute',left:x,top:y,width:w,height:h,background:dark?ink:paper,color:dark?paper:ink,border:`5px solid ${ink}`,borderRadius:28,boxShadow:`12px 14px 0 ${blue}`,transform:`rotate(${rotate}deg) scale(${.78+.22*p})`,opacity:Math.min(1,p),padding:42,boxSizing:'border-box',...style}}>{children}</div>;
};
const Big:React.FC<React.PropsWithChildren<{size?:number;style?:React.CSSProperties}>>=({children,size=76,style})=><div style={{fontSize:size,fontWeight:850,lineHeight:1.22,letterSpacing:'-.045em',whiteSpace:'pre-line',wordBreak:'keep-all',...style}}>{children}</div>;
const Sticker:React.FC<{text:string;x:number;y:number;delay?:number;angle?:number;dark?:boolean}> = ({text,x,y,delay=0,angle=-5,dark=false})=>{
 const f=useCurrentFrame();return <div style={{position:'absolute',left:x,top:y,background:dark?paper:blue,color:dark?ink:paper,padding:'15px 25px',borderRadius:14,fontSize:48,fontWeight:850,transform:`rotate(${angle}deg) scale(${pop(f,delay)})`,border:`3px solid ${dark?ink:paper}`}}>{text}</div>;
};
function Art({s}:any){const f=useCurrentFrame();const halfway=Math.floor(s.duration*.5);switch(s.visual){
 case 'hook':return <><Face mood="panic" scale={1.2} style={{left:342,top:698}}/><Card x={78} y={700} w={365} h={232} rotate={-7}><Big size={80}>번역</Big><div style={{fontSize:33,marginTop:12}}>하러 왔는데</div></Card><Card x={575} y={927} w={350} h={265} rotate={7} delay={28}><Big size={67}>출석 앱?</Big><div style={{fontSize:34,marginTop:14}}>만드는 중!</div></Card></>;
 case 'setting':return <><Card y={725} h={448}><div style={{fontSize:39,letterSpacing:2}}>ULAANBAATAR</div><Big size={78} style={{marginTop:34}}>스카이라인에듀<br/>부원장으로 일하던 때</Big></Card><Face style={{left:620,top:945}} scale={.73}/><Sticker text="친구 없음…" x={102} y={1224} delay={Math.floor(s.duration*.4)}/></>;
 case 'payment':return <><Card y={765} h={400} rotate={-3}><div style={{fontSize:40}}>남아 있는 첫 결제 기록</div><div style={{position:'relative',width:720,height:142,overflow:'hidden',marginTop:35,background:'#1c1c1c',borderRadius:12}}><Img src={staticFile('yuho-journey-01/receipt.png')} style={{position:'absolute',width:1532*3,left:-28*3,top:-494*3,maxWidth:'none'}}/></div></Card><Sticker text="개발? 아직 아님!" x={261} y={1227} delay={30}/></>;
 case 'inquiries':return <><Face mood="panic" scale={1.2} style={{left:327,top:842}}/>{[0,1,2,3].map((n)=><Card key={n} x={91+n*30} y={686+n*110} w={750} h={118} rotate={n%2?3:-3} delay={n*9} style={{padding:'28px 35px'}}><Big size={40}>새로운 학생 문의가 도착했습니다!</Big></Card>)}</>;
 case 'purpose':return <><Card y={703} h={225}><Big size={58}>학생 출석 기록</Big><div style={{fontSize:37,marginTop:18}}>누가 오고, 누가 돌아갔는지</div></Card><Card x={127} y={993} w={772} h={244} delay={32} rotate={3}><Big size={51}>부모님께 알림<br/>선생님은 관리가 편하게</Big></Card><div style={{position:'absolute',left:95,top:1300,fontSize:29,color:blue}}>당시 만들고 싶었던 기능 · 실제 운영 화면 아님</div></>;
 case 'tools':return <><Card x={90} y={773} w={382} h={320} rotate={-5}><Big size={66}>Glide</Big><div style={{fontSize:39,marginTop:35}}>앱 화면</div></Card><Big size={100} style={{position:'absolute',left:499,top:870}}>+</Big><Card x={614} y={773} w={330} h={320} rotate={5} delay={12}><Big size={61}>구글<br/>시트</Big><div style={{fontSize:36,marginTop:14}}>기록 저장</div></Card><Sticker text="근데 내 실력은…?" x={220} y={1210} delay={halfway}/></>;
 case 'zero':return <><Face mood="zero" scale={1.35} style={{left:354,top:836}}/><Big size={240} style={{position:'absolute',left:75,top:639,color:blue,transform:`scale(${pop(f)})`}}>0</Big><Sticker text="Claude Code…?" x={260} y={740} delay={20} dark/><Sticker text="설정부터 막힘" x={115} y={1245} delay={36}/></>;
 case 'screenshots':return <>{['01  화면 찍고','02  클로드에게 묻고','03  따라 해보고'].map((t,n)=><Card key={n} y={681+n*205} h={170} rotate={n%2?2:-2} delay={n*Math.floor(s.duration/3.4)} style={{padding:37}}><Big size={62}>{t}</Big></Card>)}</>;
 case 'loop':{const n=Math.min(2,Math.floor(f/Math.max(1,s.duration/3)));return <><Card y={718} h={477} rotate={n%2?3:-3}><div style={{fontSize:32}}>처음 보는 다음 화면</div><Big size={82} style={{marginTop:69}}>{['오! 넘어갔다!','…이건 또 뭐야?','스크린샷 한 장 더!'][n]}</Big></Card><Face mood="panic" scale={.62} style={{left:641,top:1001}}/><Sticker text="찍기 → 질문 → 또 찍기" x={113} y={1280}/></>;}
 case 'hours':return <><Card y={705} h={494} rotate={-3}><div style={{fontSize:35}}>당시를 돌이켜 보면</div><Big size={176} style={{marginTop:34,color:blue}}>17–18</Big><Big size={67}>시간 붙잡았던 것 같아요</Big></Card><div style={{position:'absolute',left:100,top:1260,fontSize:31,color:paper}}>수업 시간을 제외한 주관적 회고 · 권장 학습량 아님</div></>;
 case 'joke':return <><Face mood="happy" scale={1.15} style={{left:350,top:834}}/><Sticker text="심심함: 해결 ✓" x={145} y={720}/><Card x={130} y={1151} w={776} h={205} dark delay={halfway} rotate={3}><Big size={67}>앱: 아직 만드는 중…</Big></Card></>;
 case 'lesson':return <><Card y={712} h={247} rotate={-3}><Big size={62} style={{textDecoration:'line-through',opacity:.42}}>출석 + 알림 + 관리…</Big></Card><Card y={991} h={259} delay={28} rotate={2}><Big size={70}>학생 출석 하나<br/>남기는 것부터!</Big></Card></>;
 case 'prompt':return <Card y={692} h={659}><div style={{fontSize:31,color:blue,fontWeight:700}}>지금 해볼 첫 질문</div><Big size={65} style={{marginTop:32,lineHeight:1.42}}>나는 개발이 처음이야.<br/>학생 출석을 기록하고 싶어.<br/><span style={{color:blue}}>가장 작은 첫 단계부터<br/>알려줘.</span></Big></Card>;
 case 'action':return <><Face mood="happy" scale={1.2} style={{left:349,top:765}}/><Card x={115} y={1144} w={805} h={192} rotate={-3}><Big size={59}>내가 매번 불편했던 일은?</Big></Card></>;
 case 'ending':return <><Card y={733} h={460} rotate={-3}><div style={{fontSize:39,color:blue,fontWeight:800}}>다음 편 · 완전 초보의 첫 설정</div><Big size={94} style={{marginTop:44}}>만들기 전에<br/>켜는 법부터?!</Big></Card><Sticker text="막혔던 순서대로, 같이." x={121} y={1280} delay={22} dark/></>;
 default:return null;
}}
function Scene({s}:any){const f=useCurrentFrame();const dark=['hook','zero','hours','joke','ending'].includes(s.visual);const h=heads[s.visual]||['',''];const tick=Math.floor(f/45);return <AbsoluteFill style={{background:dark?ink:paper,color:dark?paper:ink,fontFamily:font,overflow:'hidden'}}>
 <div style={{position:'absolute',inset:0,opacity:dark?.13:.08,backgroundImage:`radial-gradient(${dark?paper:ink} 1.8px,transparent 1.8px)`,backgroundSize:'28px 28px'}}/>
 <div style={{position:'absolute',left:83,right:122,top:162,display:'flex',justifyContent:'space-between',fontSize:31,fontWeight:700}}><span>yuhobuilds</span><span>EP.01 · {labels[s.visual]}</span></div>
 <div style={{position:'absolute',left:83,right:115,top:292,transform:`translateY(${interpolate(f,[0,9],[22,0],clamp)}px) scale(${1+(1-Math.min(1,pop(f)))*.12})`,transformOrigin:'left top'}}><Big size={92}>{h[0]}</Big><Big size={100} style={{marginTop:22,color:dark?paper:blue}}>{h[1]}</Big></div>
 <div style={{position:'absolute',inset:0,transform:`scale(${s.visual==='loop'&&tick%2?1.025:1})`,transformOrigin:'center 1000px'}}><Art s={s}/></div>
 <div style={{position:'absolute',left:84,right:115,top:1770,fontSize:28,opacity:.66}}>{s.visual==='hook'?'실화 기반 · 일부 대사와 화면 재구성 · AI 내레이션':'@yuhobuilds · AI 초보부터 하나씩'}</div>
 </AbsoluteFill>}
export const Video:React.FC<Props>=({timing,captions,words=[]})=>{const f=useCurrentFrame();const ms=f/30*1000;const active=captions.find(c=>ms>=c.startMs&&ms<c.endMs);const w=words.find(w=>f/30>=w.start&&f/30<w.end);return <AbsoluteFill style={{background:ink}}>
 {timing.scenes.map((s:any)=><Sequence key={s.id} from={s.start} durationInFrames={s.duration}><Scene s={s}/></Sequence>)}
 <Audio src={staticFile(timing.audioFile)}/>
 {active?<div style={{position:'absolute',left:68,right:111,top:1480,background:ink,color:paper,border:`3px solid ${paper}`,borderRadius:18,padding:'21px 29px',fontFamily:font,fontSize:66,fontWeight:850,letterSpacing:'-.035em',lineHeight:1.24,textAlign:'center',wordBreak:'keep-all',boxShadow:`8px 9px 0 ${blue}`,transform:`scale(${interpolate(ms-active.startMs,[0,90],[.96,1],clamp)})`}}>{active.text}</div>:null}
 <div style={{position:'absolute',bottom:0,left:0,height:9,width:`${f/timing.durationInFrames*100}%`,background:blue}}/>
 </AbsoluteFill>};
export const Cover=()=> <AbsoluteFill style={{background:paper,fontFamily:font,color:ink}}><div style={{position:'absolute',left:82,top:192,fontSize:36,fontWeight:700}}>YUHO BUILDS · 01</div><Big size={117} style={{position:'absolute',left:82,top:379}}>번역만 하려다<br/><span style={{color:blue}}>앱 만드는<br/>사람 됨.</span></Big><Face mood="panic" scale={1.5} style={{left:380,top:1005}}/><Sticker text="개발 실력 ZERO" x={98} y={1340}/><div style={{position:'absolute',left:84,top:1760,fontSize:32}}>@yuhobuilds</div></AbsoluteFill>;
