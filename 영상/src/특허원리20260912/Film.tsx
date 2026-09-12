import React, {CSSProperties} from 'react';
import {AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {본문스택} from '../킷/폰트';
import {색, 지면, 그늘, 빛} from '../킷/색';
import script from './script.json';
import timeline from './timeline.json';

const T = {
  paper: 지면.바탕, ink: 지면.글자, muted: 지면.보조글자, oat: 색('Oat'), stone: 색('Stone'),
  coral: 지면.신호면, deep: 지면.신호글자, wash: 지면.신호바닥,
  ease: Easing.bezier(.22,1,.36,1), soft: Easing.inOut(Easing.sin),
  shadow: `0 18px 45px ${그늘(.08)}, 0 2px 4px ${그늘(.04)}`,
  font: 본문스택,
};
type Cue = {text:string; file:string; start:number; duration:number; sample?:boolean};
type Scene = {id:string;start:number;duration:number;cues:Cue[];runtimeStart?:number};
const clamp = {extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const tween=(f:number,a:number,b:number,from=0,to=1)=>interpolate(f,[a,b],[from,to],{...clamp,easing:T.ease});
const A=({children,at=0,style={}}:{children:React.ReactNode;at?:number;style?:CSSProperties})=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig();
  const p=spring({frame:f-at*fps,fps,config:{damping:23,stiffness:115,mass:.8}});
  return <div style={{opacity:p,transform:`translateY(${28*(1-p)}px) scale(${.985+.015*p})`,...style}}>{children}</div>;
};
const Pill=({children,accent=false,dark=false}:{children:React.ReactNode;accent?:boolean;dark?:boolean})=><span style={{display:'inline-flex',alignItems:'center',padding:'12px 23px',borderRadius:18,fontSize:28,fontWeight:600,background:accent?T.wash:dark?빛(.10):T.oat,color:accent?T.deep:dark?T.paper:T.ink}}>{children}</span>;
const Panel=({children,style={}}:{children:React.ReactNode;style?:CSSProperties})=><div style={{border:`2px solid ${T.oat}`,borderRadius:32,background:T.paper,boxShadow:T.shadow,...style}}>{children}</div>;
const Icon=({kind='record',size=40,color=T.ink}:{kind?:'record'|'wait'|'arrow'|'help'|'play'|'history';size?:number;color?:string})=>{
  const props={fill:'none',stroke:color,strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round'} as const;
  return <svg width={size} height={size} viewBox="0 0 32 32" {...props}>
    {kind==='record'?<><rect x="7" y="4" width="18" height="24" rx="3"/><path d="M11 11h10M11 16h10M11 21h7"/></>:
    kind==='wait'?<><circle cx="16" cy="16" r="12"/><path d="M16 8v8l5 3"/></>:
    kind==='arrow'?<path d="M4 16h23m-8-8 8 8-8 8"/>:
    kind==='help'?<><rect x="4" y="5" width="24" height="22" rx="4"/><path d="M9 12h14M9 19h10"/></>:
    kind==='play'?<path d="m12 7 13 9-13 9Z" fill={color} stroke="none"/>:
    <><path d="M6 11a11 11 0 1 1-1 10M5 4v8h8M16 9v8l5 2"/></>}
  </svg>;
};
const Mongle=({mood='curious',x=1230,y=290,w=550}:{mood?:string;x?:number;y?:number;w?:number})=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig();
  return <Img src={staticFile(`mascot-${mood}.webp`)} style={{position:'absolute',left:x,top:y,width:w,height:w,objectFit:'contain',filter:`drop-shadow(0 22px 24px ${그늘(.1)})`,transform:`translateY(${Math.sin(f/fps*.8)*4}px) scale(${1+.006*Math.sin(f/fps*.4)})`}}/>;
};
const Waves=({active=false,dark=false,small=false}:{active?:boolean;dark?:boolean;small?:boolean})=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig();
  return <div style={{height:small?63:115,display:'flex',alignItems:'center',justifyContent:'center',gap:small?5:7}}>{Array.from({length:31},(_,i)=>{
    const h=16+(1+Math.sin(i*1.92))*.5*(small?39:81);
    return <div key={i} style={{width:small?6:8,borderRadius:8,background:dark?T.paper:T.coral,height:h*(active?.64+.36*Math.sin(f/fps*5+i*.9)**2:1),opacity:active?1:.78}}/>;
  })}</div>;
};
const AudioCard=({label='처음 말',sub='처음 소리 그대로',active=false,small=false,style={}}:{label?:string;sub?:string;active?:boolean;small?:boolean;style?:CSSProperties})=>
  <Panel style={{width:small?370:435,padding:small?25:32,...style}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:small?32:37,fontWeight:800}}>{label}</span><Icon kind="play" size={small?35:40}/></div><div style={{margin:'20px 0'}}><Waves active={active} small={small}/></div><div style={{fontSize:small?24:29,color:T.muted,display:'flex',gap:12,alignItems:'center'}}><Icon kind="record" size={28}/>{sub}</div></Panel>;
const questions=['무슨 말을 했나요?','“친구를”, 혼자 썼나요?','과거형을 썼나요?'];
const RecordRows=({states=['wait','wait','wait'],focus=-1,at=0,compact=false}:{states?:string[];focus?:number;at?:number;compact?:boolean})=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig();
  return <div style={{display:'flex',flexDirection:'column',gap:compact?14:20}}>{questions.map((q,i)=>{
    const state=states[i],ready=state==='record',excluded=state==='excluded';
    return <A at={at+i*.15} key={q}><Panel style={{width:compact?1030:1040,minHeight:compact?116:137,padding:compact?'22px 30px':'28px 32px',display:'flex',alignItems:'center',gap:20,borderColor:focus===i?T.coral:T.oat,background:excluded?T.wash:T.paper,opacity:focus<0||focus===i?1:.52,transform:`translateX(${focus===i?5+2*Math.sin(f/fps):0}px)`}}>
      <span style={{fontSize:25,color:T.muted,minWidth:32}}>0{i+1}</span><span style={{fontSize:compact?36:39,fontWeight:600,flex:1}}>{q}</span>
      <div style={{display:'flex',alignItems:'center',gap:12,color:excluded?T.deep:ready?T.ink:T.muted,fontSize:compact?30:31,fontWeight:ready||excluded?800:500}}><Icon size={34} kind={excluded?'history':ready?'record':'wait'} color={excluded?T.deep:ready?T.ink:T.muted}/>{excluded?'혼자 한 기록 제외':ready?'기록':'확인 중'}</div>
    </Panel></A>;
  })}</div>;
};
const Note=({children,dark=false,style={}}:{children:React.ReactNode;dark?:boolean;style?:CSSProperties})=><div style={{position:'absolute',left:115,right:115,bottom:175,textAlign:'center',fontSize:29,color:dark?T.paper:T.muted,lineHeight:1.5,...style}}>{children}</div>;
const Arrow=({style={},dark=false}:{style?:CSSProperties;dark?:boolean})=><div style={{display:'flex',alignItems:'center',justifyContent:'center',...style}}><Icon kind="arrow" size={62} color={dark?T.paper:T.stone}/></div>;
function Header({id,title,dark=false}:{id:string;title:string;dark?:boolean}){
  const n=Number(id),chapter=n<=8?'01  ·  애매한 부분만 기다리기':n<=10?'02  ·  새 말은 새 기록으로':n<=13?'03  ·  관련된 판단만 고치기':'세 가지로 기억하기';
  return <><div style={{position:'absolute',top:56,left:96,right:96,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
    <Img src={staticFile('logo.webp')} style={{width:220,height:72,objectFit:'contain'}}/>
    <div style={{fontSize:28,fontWeight:600,color:dark?T.paper:T.muted}}>{chapter}</div></div>
    <A at={.12} style={{position:'absolute',left:113,top:163,right:100}}><div style={{fontSize:63,fontWeight:800,letterSpacing:'-.045em',lineHeight:1.2,color:dark?T.paper:T.ink}}>{title}</div></A></>;
}
function Background({dark=false}:{dark?:boolean}){
  const f=useCurrentFrame(),{fps}=useVideoConfig();
  return <AbsoluteFill style={{background:dark?T.ink:T.paper}}>
    <AbsoluteFill style={{background:`radial-gradient(ellipse at ${20+Math.sin(f/fps*.12)*3}% 12%, ${dark?빛(.045):빛(.8)}, transparent 65%), radial-gradient(ellipse at 88% 85%, ${dark?그늘(.18):그늘(.05)}, transparent 65%)`}}/>
    <AbsoluteFill style={{backgroundImage:`url(${staticFile('paper-grain.png')})`,opacity:dark?.025:.06,mixBlendMode:dark?'screen':'multiply'}}/>
    <AbsoluteFill style={{boxShadow:`inset 0 0 180px ${그늘(dark?.12:.025)}`}}/>
  </AbsoluteFill>;
}
function Intro(){return <>
  <A at={.1} style={{position:'absolute',top:77,left:110}}><Img src={staticFile('logo.webp')} style={{width:315,height:105,objectFit:'contain'}}/></A>
  <A at={.35} style={{position:'absolute',top:270,left:120}}><Pill>SYNK CORE · 근거 판단 원리</Pill><div style={{marginTop:35,fontSize:104,lineHeight:1.2,fontWeight:800,letterSpacing:'-.05em'}}>말 한 번,<br/>확인은 세 가지.</div></A>
  <A at={1.1} style={{position:'absolute',left:126,top:660}}><div style={{fontSize:39,color:T.muted,lineHeight:1.5}}>한 문장을 따라가면<br/>왜 이렇게 기록하는지 보여요.</div></A>
  <A at={.6}><Mongle/></A>
  <Note>원리 설명용 예제 · 안내와 예시 발화는 기계 음성입니다.</Note>
  </>}
function Sentence({alt=false,focus='case',size=52}:{alt?:boolean;focus?:string;size?:number}){
  return <div style={{fontSize:size,fontWeight:600,letterSpacing:'-.04em',whiteSpace:'nowrap'}}>친구<span style={{background:focus==='case'?T.wash:'transparent',color:focus==='case'?T.deep:T.ink,borderRadius:10,padding:'4px 5px',borderBottom:focus==='case'?`4px solid ${T.coral}`:'none'}}>{alt?'가':'를'}</span> 만나서 카페에 <span style={{background:focus==='past'?T.wash:'transparent',color:focus==='past'?T.deep:T.ink,borderRadius:10,padding:'4px 6px',borderBottom:focus==='past'?`4px solid ${T.coral}`:'none'}}>갔어요</span></div>;
}
function AudioAndRows({states,focus=-1,note,active=false}:{states:string[];focus?:number;note?:string;active?:boolean}){
  return <><A at={.25} style={{position:'absolute',left:115,top:367}}><AudioCard active={active}/></A><A at={.5} style={{position:'absolute',left:590,top:496}}><Arrow/></A><div style={{position:'absolute',left:740,top:310}}><RecordRows states={states} focus={focus} at={.5}/></div>{note&&<Note>{note}</Note>}</>;
}
function PrincipleScene({s}:{s:Scene}){
  const f=useCurrentFrame(),{fps}=useVideoConfig();const sec=f/fps;
  const cues=s.cues.filter(c=>!c.sample);const cue=(i:number)=>cues[i]?.start/fps??100;
  const title=script.scenes.find(v=>v.id===s.id)!.title;
  const [first,second]=[cue(0),cue(1)];
  if(s.id==='01')return <Intro/>;
  if(s.id==='02'){
    const p=tween(sec,4.5,6.2);return <><Header id={s.id} title={title}/>
      <A at={.2} style={{position:'absolute',left:580-420*p,top:342}}><AudioCard active={sec<4.8} style={{width:700-230*p}}/></A>
      <div style={{position:'absolute',left:735,top:348,opacity:p,transform:`translateX(${70*(1-p)}px)`}}><Panel style={{padding:40,width:1040}}><Pill>옆에 따로 둔 받아쓰기</Pill><div style={{marginTop:42}}><Sentence size={48} focus="none"/></div></Panel><div style={{marginTop:30,fontSize:30,color:T.muted}}>글을 다시 확인해도, 처음 소리는 바뀌지 않아요.</div></div>
      {sec<4.8&&<A at={.5} style={{position:'absolute',top:688,width:'100%',textAlign:'center'}}><Sentence size={60} focus="none"/></A>}
      <Note>문제: 내가 친구를 만나고, 카페에 간 일을 말해 주세요.</Note></>;
  }
  if(s.id==='03'){
    const pos=sec<second+2?0:sec<second+4.6?1:sec<second+7.3?2:-1;
    return <><Header id={s.id} title={title}/><AudioAndRows states={['wait','wait','wait']} focus={sec>second?pos:-1} note="전체 점수 하나로 뭉치지 않고, 질문마다 따로 확인해요."/></>;
  }
  if(s.id==='04')return <><Header id={s.id} title={title}/><A at={.25} style={{position:'absolute',left:115,top:308}}><Pill accent>설명을 위해 정한 두 가지 후보</Pill></A>{[false,true].map((alt,i)=><A key={i} at={.55+i*.65} style={{position:'absolute',left:210,top:415+i*172}}><Panel style={{width:1500,padding:'35px 55px',display:'flex',gap:40,alignItems:'center'}}><span style={{fontSize:27,color:T.muted,minWidth:86}}>후보 {i+1}</span><Sentence alt={alt} size={58}/></Panel></A>)}<Note>실제 음성인식이 낸 결과가 아니라, 차이를 보여주기 위해 정한 예제예요.</Note></>;
  if(s.id==='05')return <><Header id={s.id} title={title}/><AudioAndRows states={['wait','wait','wait']} focus={sec<second?0:1} note="‘를’인지 ‘가’인지에 따라, 이 두 질문의 답이 달라져요."/></>;
  if(s.id==='06'){
    const ready=sec>second+4;
    return <><Header id={s.id} title={title}/><A at={.3} style={{position:'absolute',left:113,top:321}}><Panel style={{width:650,padding:35}}><div style={{fontSize:27,color:T.muted,marginBottom:30}}>달랐던 두 후보에서도</div><div style={{fontSize:41,lineHeight:1.8}}>친구를 … <b style={{color:T.deep}}>갔어요</b><br/>친구가 … <b style={{color:T.deep}}>갔어요</b></div></Panel></A>
      <div style={{position:'absolute',left:830,top:323,width:950}}><A at={second+.2}><Pill accent>과거형 부분을 따로 판단할 수 있어요</Pill></A><A at={second+2.1} style={{marginTop:24}}><Pill>관련된 불확실성·도움·순서도 확인했어요</Pill></A>
      <A at={second+4} style={{marginTop:36}}><Panel style={{padding:32,display:'flex',alignItems:'center',gap:25}}><Icon kind="record" size={54}/><div style={{fontSize:46,fontWeight:800}}>과거형 사용 <span style={{color:T.deep}}>기록</span></div></Panel></A></div>
      <Note>{ready?'이 조건을 모르면, 과거형도 확인 중으로 남겨요.':'같은 부분을 찾고, 따로 기록할 수 있는 조건을 확인해요.'}</Note></>;
  }
  if(s.id==='07')return <><Header id={s.id} title={title}/><AudioAndRows states={['wait','wait','record']}/><Note><b style={{color:T.ink}}>화면의 ‘반영’ = 근거를 남김</b>　·　정답 도장이나 실력 점수가 아니에요.</Note></>;
  if(s.id==='08'){
    const confirmed=sec>second+3;
    return <><Header id={s.id} title={title}/><AudioAndRows states={confirmed?['record','record','record']:['wait','wait','record']} active={sec<second+3}/><div style={{position:'absolute',left:130,top:695,width:425,textAlign:'center'}}><Pill accent>{confirmed?'청취 확인 입력: 친구를':'같은 녹음을 다시 듣기'}</Pill></div><Note>“친구를”로 확인해 준 경우의 시연입니다. 안 들리면 확인 중을 유지해요.</Note></>;
  }
  if(s.id==='09'||s.id==='10'){
    const helpAt=s.id==='09'?.5:0, newAt=s.id==='09'?second+.3:0;
    return <><Header id={s.id} title={title}/><A at={.15} style={{position:'absolute',left:125,top:356}}><AudioCard small/><div style={{marginTop:28,fontSize:28,textAlign:'center',color:T.muted}}>처음 녹음은 그대로 보관</div></A>
      <A at={helpAt} style={{position:'absolute',left:708,top:371}}><Panel style={{width:440,padding:31,background:T.wash}}><div style={{display:'flex',gap:17,alignItems:'center',fontSize:35,fontWeight:800}}><Icon kind="help"/>모범 문장 보기</div><div style={{fontSize:31,lineHeight:1.6,marginTop:25}}>친구를 만나서<br/>카페에 갔어요.</div></Panel></A>
      <A at={newAt} style={{position:'absolute',left:1390,top:356}}><AudioCard small label="도움 뒤 새 말" sub="도움 이후의 별도 기록" active={s.id==='09'&&sec>newAt&&sec<newAt+3}/><div style={{marginTop:28,fontSize:28,textAlign:'center',fontWeight:600,color:T.deep}}>새 말의 자리에 기록</div></A>
      <A at={helpAt+.1} style={{position:'absolute',left:557,top:480}}><Arrow/></A><A at={newAt} style={{position:'absolute',left:1230,top:480}}><Arrow/></A>
      <Note>{s.id==='10'?<><b style={{color:T.deep}}>새 말 → 처음 혼자 한 증거</b>로 옮길 수 없어요.</>:'다시 듣기는 같은 말 확인 · 도움 뒤 다시 말하기는 새 말 생성'}</Note></>;
  }
  if(s.id==='11'){
    const later=sec>second;
    return <><Header id={s.id} title={title}/><A at={.4} style={{position:'absolute',left:115,top:325}}><div style={{fontSize:40,color:T.muted}}>같은 문장, 새로운 시작 조건</div><div style={{marginTop:40}}><Sentence size={54} focus="none"/></div></A>
      {later&&<><A at={second} style={{position:'absolute',left:155,top:527,width:650}}><div style={{fontSize:36,lineHeight:1.65}}>처음 말을 확인했어요.<br/>발화 순서와 도움 범위를 정했고,<br/>과거형은 따로 판단할 수 있어요.</div></A><div style={{position:'absolute',left:830,top:498,transform:'scale(.84)',transformOrigin:'top left'}}><RecordRows states={['record','record','record']} compact at={second}/></div></>}
      {!later&&<Mongle mood="focus" x={1270} y={390} w={380}/>}
      <Note>앞 장면을 이어받지 않은, 조건을 바꾼 별도 통제 예제입니다.</Note></>;
  }
  if(s.id==='12'){
    const p=tween(sec,second+.2,second+1.4);
    return <><Header id={s.id} title={title}/><A at={.4} style={{position:'absolute',left:118,top:310}}><Pill>실제로 일어난 순서</Pill></A><div style={{position:'absolute',left:180,top:560,width:1500,height:3,background:T.stone}}/>
      <div style={{position:'absolute',left:190,top:402,opacity:p,transform:`translateY(${-65*(1-p)}px)`}}><Panel style={{width:440,padding:30,background:T.wash}}><div style={{fontSize:27,color:T.deep,fontWeight:800,marginBottom:18}}>처음 말하기 1분 전</div><div style={{fontSize:42,fontWeight:800}}>“친구를” 보여줌</div></Panel><div style={{marginTop:80,fontSize:30,color:T.muted,textAlign:'center'}}>도움이 있었던 때</div></div>
      <A at={.5} style={{position:'absolute',left:833,top:414}}><Panel style={{padding:'34px 48px',fontSize:43,fontWeight:800}}>처음 말하기</Panel></A>
      <A at={cue(2)} style={{position:'absolute',left:1330,top:407}}><Panel style={{width:440,padding:30}}><div style={{fontSize:27,color:T.muted,marginBottom:18}}>지금</div><div style={{fontSize:41,fontWeight:800}}>도움 사실을 알게 됨</div></Panel><div style={{marginTop:80,fontSize:30,color:T.muted,textAlign:'center'}}>뒤늦게 기록한 때</div></A>
      <Note>이 예제의 도움 범위는 “친구를” 표현입니다. 과거형을 도운 것으로 정하지 않았어요.</Note></>;
  }
  if(s.id==='13'){
    const withdrawn=sec>first+2.8;
    return <><Header id={s.id} title={title}/><A at={.3} style={{position:'absolute',left:115,top:355}}><Panel style={{width:470,padding:32,background:T.wash}}><Pill accent>뒤늦게 안 사실</Pill><div style={{fontSize:41,fontWeight:800,lineHeight:1.5,marginTop:24}}>말하기 전에<br/>“친구를”을 보여줌</div></Panel><div style={{marginTop:30,fontSize:29,color:T.muted}}>처음 소리와 이전 이력은 보관</div></A>
      <A at={first+2.4} style={{position:'absolute',left:626,top:500}}><Arrow/></A><div style={{position:'absolute',left:740,top:310}}><RecordRows states={withdrawn?['record','excluded','record']:['record','record','record']}/></div>
      <Note><b style={{color:T.ink}}>{withdrawn?'1개 철회 · 2개 유지':'새 사실과 관련된 판단을 다시 살펴봐요'}</b>　｜　문장 전체나 과거형도 도왔다면 결과가 달라져요.</Note></>;
  }
  const rt=(s.runtimeStart??99999)/fps;const end=rt+16;
  if(sec>=rt&&sec<end)return <><Header id={s.id} title="실제 작업실에서 바뀌는 순간"/><div style={{position:'absolute',left:128,top:280,width:1664,height:636,overflow:'hidden',border:`2px solid ${T.stone}`,borderRadius:28,boxShadow:T.shadow}}><Sequence from={s.runtimeStart??0} durationInFrames={16*fps} layout="none"><OffthreadVideo src={staticFile('runtime-clip.mp4')} muted style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center'}}/></Sequence></div><div style={{position:'absolute',top:235,right:134,fontSize:26,color:T.muted}}>실제 로컬 작업실 · 통제 예제</div></>;
  if(sec>=end)return <><A at={end} style={{position:'absolute',top:155,left:120}}><Img src={staticFile('logo.webp')} style={{width:320,height:100,objectFit:'contain'}}/><div style={{fontSize:92,lineHeight:1.2,letterSpacing:'-.04em',fontWeight:800,marginTop:54}}>말은 그대로.<br/>판단은 이유와 함께.</div><div style={{fontSize:37,marginTop:35,color:T.muted}}>SYNK Core · 근거 자격·관측·재판정</div></A><Mongle mood="relief" x={1270} y={260} w={540}/><Note>로컬 통제 예제로 원리 설명 · 실제 학생의 학습 성과를 시연한 영상이 아닙니다.</Note></>;
  return <><Header id={s.id} title={title}/><A at={.4} style={{position:'absolute',left:120,top:348}}><AudioCard small/></A><A at={.8} style={{position:'absolute',left:566,top:448}}><Arrow/></A><div style={{position:'absolute',left:741,top:330}}><RecordRows states={['record','excluded','record']} compact at={1}/></div><Note><b style={{color:T.ink}}>처음 소리 보관 → 나누어 확인 → 이유를 남기며 수정</b></Note></>;
}
function Caption({s}:{s:Scene}){
  const f=useCurrentFrame();const active=s.cues.find(c=>f>=c.start&&f<c.start+c.duration+6);
  if(!active)return null;
  return <div style={{position:'absolute',left:110,right:110,bottom:40,minHeight:100,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{fontSize:37,fontWeight:500,lineHeight:1.5,textAlign:'center',maxWidth:1680,textWrap:'balance',color:T.ink,background:빛(.96),padding:'14px 36px',borderRadius:20}}>{active.sample?'“'+active.text+'”':active.text}</div></div>;
}
function SceneView({s}:{s:Scene}){
  const f=useCurrentFrame(),{fps}=useVideoConfig();
  const out=tween(f,s.duration-fps*.25,s.duration,1,0);
  return <AbsoluteFill style={{opacity:out,transform:`translateY(${-8*(1-out)}px)`}}>
    <Background/><PrincipleScene s={s}/><Caption s={s}/>
    {s.cues.map(c=><Sequence key={c.file} from={c.start} durationInFrames={c.duration} premountFor={fps}><Audio src={staticFile(c.file)} volume={f=>Math.min(1,f/3,(c.duration-f)/5)}/></Sequence>)}
  </AbsoluteFill>;
}
export function EngineFilm(){
  const f=useCurrentFrame();
  return <AbsoluteFill style={{background:T.paper,color:T.ink,fontFamily:T.font,wordBreak:'keep-all'}}>
    {timeline.scenes.map(s=><Sequence key={s.id} from={s.start} durationInFrames={s.duration} premountFor={30}><SceneView s={s}/></Sequence>)}
    <div style={{position:'absolute',left:0,bottom:0,width:1920*f/(timeline.durationInFrames-1),height:5,background:T.coral}}/>
  </AbsoluteFill>;
}
