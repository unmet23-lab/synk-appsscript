import React, {useEffect} from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {색, 지면, 그늘} from '../킷/색';
import {본문스택} from '../킷/폰트';
import {요소} from '../킷/공방';
import {Reel, Beat, Item, giftPages, seconds} from './타입';

const ink = 지면.글자, paper = 지면.바탕;
const body: React.CSSProperties = {fontFamily: 본문스택, color: ink, backgroundColor: paper};
const fit = (s: string, n: number, min = 52) => Math.max(min, Math.min(n, n * (30 / Math.max(30, s.length)) ** .32));
const accent = (r: Reel) => 색(r.mascot === '까몽' ? 'Lapis Deep' : 'Coral 3');
const index = (r: Reel) => r.id.slice(-2);
const cut = (r: Reel) => `${r.mascot}/본체.png`;
const label: React.CSSProperties = {fontSize: 30, fontWeight: 600, letterSpacing: '.025em'};

function Logo() {
  return <Img src={staticFile('릴10편/로고.png')} style={{width: 242, height: 90, objectFit: 'contain', objectPosition: 'left center'}}/>;
}
function Header({r}: {r: Reel}) {
  return <div style={{position:'absolute',left:72,right:100,top:110,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
    <style>{'*{box-sizing:border-box}'}</style>
    <Logo/><div style={{...label,color:지면.보조글자}}>KOREAN NOTES <span style={{marginLeft:20,color:accent(r)}}>{index(r)}</span></div>
  </div>;
}
function Mascot({r, width=250, style={}}: {r: Reel; width?: number; style?: React.CSSProperties}) {
  // 정본 픽셀을 그대로 놓는다. 몸 흔들림·깜빡임·가짜 입모양 없음.
  return <Img src={staticFile(cut(r))} style={{width,height:width,objectFit:'contain',...style}}/>;
}
function Tile({children, strong=false, r, style={}}: {children: React.ReactNode;strong?:boolean;r:Reel;style?:React.CSSProperties}) {
  return <div style={{padding:'26px 34px',borderRadius:24,background:strong ? accent(r) : 색('Oat'),color:strong?paper:ink,fontSize:52,fontWeight:750,lineHeight:1.3,wordBreak:'keep-all',whiteSpace:'pre-line',...style}}>{children}</div>;
}
function Prop({name, style={}}: {name:string; style?: React.CSSProperties}) {
  return <Img src={staticFile(요소(name))} style={{width:320,height:320,objectFit:'contain',...style}}/>;
}

/** 열 가지 장면을 각기 다른 정보의 변화로 만든다. 학생을 오답 캐릭터로 만들지 않는다. */
function Scene({r, phase}: {r:Reel;phase:number}) {
  const centered: React.CSSProperties = {width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:24};
  switch(r.topic) {
    case 'cafe': return <div style={centered}>
      <div style={{width:320,textAlign:'center'}}><Prop name="찻잔"/><Tile r={r} strong={phase===2} style={{fontSize:48}}>{phase<2?'여기서?':'여기서\n마실게요.'}</Tile></div>
      <div style={{height:340,width:2,background:색('Stitch'),margin:'0 20px'}}/>
      <div style={{width:320,textAlign:'center'}}><div style={{position:'relative'}}><Prop name="찻잔"/><span style={{position:'absolute',right:-20,top:165,fontSize:100,fontWeight:800,color:accent(r)}}>→</span></div><Tile r={r} strong={phase>=3} style={{fontSize:48}}>{phase<2?'포장?':'포장해\n주세요.'}</Tile></div>
    </div>;
    case 'spicy': return <div style={{...centered,flexDirection:'column',gap:40}}>
      <div style={{fontSize:phase>=3?92:120,fontWeight:850,letterSpacing:'-.035em'}}>{phase>=3?'맵지 않은 메뉴?':<>덜 <span style={{color:accent(r)}}>{phase===0?'=':'≠'}</span> 0{phase===0?'?':''}</>}</div>
      {phase<3?<div style={{display:'flex',gap:24,alignItems:'end',height:240}}>{[1,2,3].map(n=><div key={n} style={{width:120,height:60+n*50,borderRadius:24,background:색('Coral'),opacity:phase===0||n===1?1:.15}}/>)}</div>:<Prop name="공책과 연필" style={{width:310,height:300}}/>}
      <Tile r={r} strong>{phase<3?'덜 맵게':'맵지 않은 메뉴가 있어요?'}</Tile>
    </div>;
    case 'chat': return <div style={{...centered,flexDirection:'column',alignItems:'stretch',padding:'15px 36px'}}>
      <Tile r={r} style={{alignSelf:'flex-start',fontSize:42}}>{phase>=3?'오늘 생일이야.':'자료 보냈어.'}</Tile>
      <Tile r={r} strong style={{alignSelf:'flex-end',fontSize:104,minWidth:330,textAlign:'center'}}>{phase<2?'ㄱㅅ':phase===2?'고마워!':'축하해!'}</Tile>
      <div style={{fontSize:64,textAlign:'center',fontWeight:800,color:accent(r)}}>{phase===0?'ㄱ + ㅅ':phase<3?'ㄱㅅ → 감사':'ㅊㅋ → 축하'}</div>
    </div>;
    case 'repeat': return <div style={{...centered,flexDirection:'column',alignItems:'stretch',padding:'0 48px'}}>
      {['내일',phase<3?'?':'3시','도서관 앞'].map((t,i)=><Tile key={i} r={r} strong={i===1} style={{textAlign:'center',fontSize:i===1?92:52}}>{t}</Tile>)}
    </div>;
    case 'meet': if(phase>=3)return <div style={{...centered,flexDirection:'column'}}><Tile r={r} strong style={{fontSize:64,textAlign:'center',minWidth:730}}>2번 출구 밖</Tile><div style={{display:'flex',gap:36,marginTop:20}}><Mascot r={{...r,mascot:'몽글'}} width={270}/><Mascot r={{...r,mascot:'까몽'}} width={270}/></div></div>;
      return <div style={{...centered,gap:52}}>
      {[1,2].map(n=><div key={n} style={{width:350,textAlign:'center'}}><Tile r={r} strong={n===2&&phase>0}>{n}번 출구</Tile><div style={{height:35}}/><Mascot r={{...r,mascot:n===1?'몽글':'까몽'}} width={270}/><div style={{fontSize:46,fontWeight:700,marginTop:20}}>{phase>1&&n===2?'밖에서요.':'도착했어요.'}</div></div>)}
    </div>;
    case 'class': return <div style={{...centered,flexDirection:'column',alignItems:'stretch',padding:'0 28px'}}>
      <div style={{fontSize:35,color:지면.보조글자,paddingLeft:200}}>수업 → 빈 시간 → 수업</div>
      <div style={{display:'grid',gridTemplateColumns:'180px 1fr',gap:18,alignItems:'center'}}><span style={{fontSize:54,fontWeight:800}}>공강</span><Tile r={r} strong={phase===1} style={{height:130,display:'flex',alignItems:'center',justifyContent:'center'}}>—</Tile></div>
      <div style={{display:'grid',gridTemplateColumns:'180px 1fr',gap:18,alignItems:'center'}}><span style={{fontSize:54,fontWeight:800}}>휴강</span><Tile r={r} strong={phase===2} style={{height:130,display:'flex',alignItems:'center',justifyContent:'center'}}>수업 → 휴강</Tile></div>
      {phase>=3&&<div style={{fontSize:58,textAlign:'right',fontWeight:700,marginTop:40,color:accent(r)}}>보강은 언제예요?</div>}
    </div>;
    case 'deadline': return <div style={{...centered,display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,padding:'35px'}}>
      {['무엇을?','언제까지?','어디로?','어떤 형식?'].map((t,i)=><Tile key={t} r={r} strong={phase>0&&i===1} style={{height:190,fontSize:48,display:'flex',flexDirection:'column',justifyContent:'space-between'}}>{t}<span style={{fontSize:56}}>{i===1?(phase<3?'내일까지':r.beats[3].ko.replace(/^예:\s*/,'').replace(/까지요\.?$/,'')):'______'}</span></Tile>)}
    </div>;
    case 'message': return <div style={{...centered,flexDirection:'column',alignItems:'stretch',padding:'10px 24px'}}>
      <Tile r={r} style={{fontSize:46}}>안녕하세요.</Tile>
      <Tile r={r} strong={phase===1||phase===2} style={{fontSize:46}}>{phase>0?'오늘 수업에서 만난':'…'}<br/>{phase>0?'[이름]입니다.':''}</Tile>
      {phase>=3&&<Tile r={r} strong style={{fontSize:44}}>자료를 보내 주실 수 있어요?</Tile>}
    </div>;
    case 'room': return <div style={{...centered,position:'relative'}}>
      <Prop name="내 방 낮" style={{width:760,height:520,objectFit:'cover',borderRadius:30}}/>
      <Tile r={r} strong style={{position:'absolute',right:10,bottom:5,fontSize:46}}>{phase<2?'인터넷?':phase===2?'연결해 봐도 돼요?':'창문도 열어 볼까요?'}</Tile>
    </div>;
    case 'photo': return <div style={centered}>
      <div style={{width:420,height:phase===0?340:570,overflow:'hidden',border:`7px solid ${accent(r)}`,borderRadius:32,position:'relative'}}><Mascot r={r} width={420} style={{position:'absolute',left:-3,top:0,height:570}}/></div>
      <div style={{writingMode:'vertical-rl',fontSize:64,fontWeight:800,color:accent(r)}}>{phase===0?'얼굴만?':'전신!'}</div>
    </div>;
    default: return <div style={centered}><Prop name={r.assetName}/><Mascot r={r}/></div>;
  }
}

function PaperGift({r, tiny=false}: {r:Reel;tiny?:boolean}) {
  return <div style={{width:tiny?560:750,background:paper,border:`2px solid ${색('Stitch')}`,borderRadius:22,padding:tiny?32:44,boxShadow:`0 18px 50px ${그늘(.08)}`}}>
    <div style={{fontSize:tiny?34:45,fontWeight:800,lineHeight:1.18,color:accent(r),marginBottom:32}}>{r.gift.titleMn}</div>
    {r.gift.items.slice(0,r.topic==='message'?1:3).map((item,i)=><div key={i} style={{padding:'20px 0',borderTop:`2px solid ${색('Oat')}`}}><div style={{fontSize:tiny?24:30,color:지면.보조글자,marginBottom:10}}>{item.labelMn}</div><div style={{fontSize:tiny?32:42,fontWeight:750,lineHeight:1.26,wordBreak:'keep-all'}}>{item.ko}</div></div>)}
  </div>;
}

function BeatView({r,b,phase}: {r:Reel;b:Beat;phase:number}) {
  const f=useCurrentFrame(); const {fps}=useVideoConfig();
  const enter = phase===0?1:spring({frame:f,fps,config:{damping:200,stiffness:160,mass:.7},durationInFrames:10});
  const motion={opacity:enter,transform:`translateY(${(1-enter)*14}px)`};
  if(b.type==='gift') return <AbsoluteFill>
    <div data-check="gift-title" style={{position:'absolute',top:290,left:72,right:100,fontSize:fit(r.gift.titleMn,76,58),fontWeight:850,lineHeight:1.08,...motion}}>{r.gift.titleMn}</div>
    <div style={{position:'absolute',top:650,left:100,transform:'rotate(-2deg)'}}><PaperGift r={r}/></div>
    <Mascot r={r} width={255} style={{position:'absolute',right:85,top:1180}}/>
    <div data-check="cta" style={{position:'absolute',left:72,right:120,top:1510,fontSize:48,fontWeight:650,lineHeight:1.24}}>{r.ctaMn}</div>
  </AbsoluteFill>;
  return <AbsoluteFill>
    <div data-check="headline" style={{position:'absolute',top:phase===0?295:275,left:72,right:100,fontSize:fit(phase===0?r.hookMn:b.mn,phase===0?92:65),fontWeight:phase===0?850:700,lineHeight:phase===0?1.08:1.16,letterSpacing:'-.025em',...motion}}>{phase===0?r.hookMn:b.mn}</div>
    <div style={{position:'absolute',left:72,right:100,top:phase===0?790:570,height:560,...motion}}><Scene r={r} phase={phase}/></div>
    {phase>0&&<div data-check="korean" style={{position:'absolute',left:72,right:110,top:1220,color:accent(r),fontSize:fit(b.ko,88,64),lineHeight:1.16,fontWeight:850,letterSpacing:'-.025em',wordBreak:'keep-all',...motion}}>{b.ko}</div>}
    {phase===0&&<Mascot r={r} width={195} style={{position:'absolute',right:110,top:1470}}/>}
  </AbsoluteFill>;
}

export function ReelVideo({r}: {r:Reel}) {
  const f=useCurrentFrame();const end=seconds(r)*30;
  return <AbsoluteFill style={body}>
    <LayoutEvidence id={r.id} frames={r.beats.map(b=>Math.round(b.start*30)+20)}/>
    <Header r={r}/>
    {r.beats.map((b,i)=><Sequence key={i} from={Math.round(b.start*30)} durationInFrames={Math.round(b.seconds*30)}><BeatView r={r} b={b} phase={i}/></Sequence>)}
    <div style={{position:'absolute',left:72,right:120,bottom:165,height:4,background:색('Oat')}}><div style={{height:4,width:`${f/Math.max(1,end-1)*100}%`,background:accent(r)}}/></div>
    <Audio src={staticFile('소리/받은BGM/시티팝_147.wav')} startFrom={Math.round(30*62)} volume={(frame)=>interpolate(frame,[0,12,end-22,end],[0,.60,.60,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}/>
    {r.beats.slice(1,4).map((b,i)=><Sequence key={i} from={Math.round(b.start*30)} durationInFrames={20}><Audio src={staticFile('소리/synk-sound-notify.wav')} volume={.3}/></Sequence>)}
  </AbsoluteFill>;
}

export function ReelCover({r}: {r:Reel}) {
  return <AbsoluteFill style={body}><LayoutEvidence id={`${r.id}-cover`} frames={[0]}/><Header r={r}/>
    <div data-check="cover-hook" style={{position:'absolute',left:72,right:100,top:310,fontWeight:850,fontSize:fit(r.hookMn,98,70),lineHeight:1.07,letterSpacing:'-.025em'}}>{r.hookMn}</div>
    <div style={{position:'absolute',left:72,right:100,top:830,height:520}}><Scene r={r} phase={0}/></div>
    <div data-check="cover-gift" style={{position:'absolute',left:72,right:310,top:1510,fontSize:43,fontWeight:650,lineHeight:1.25,color:accent(r)}}>{r.gift.titleMn}</div>
    <Mascot r={r} width={230} style={{position:'absolute',right:90,top:1460}}/>
  </AbsoluteFill>;
}

export function GiftPage({r,page}: {r:Reel;page:number}) {
  const pages=giftPages(r), items=pages[page];
  return <AbsoluteFill style={body}><LayoutEvidence id={`${r.id}-resource-${page+1}`} frames={[0]}/><Header r={r}/>
    <div style={{position:'absolute',left:72,right:100,top:260,bottom:180,display:'flex',flexDirection:'column'}}>
      <div data-check="resource-title" style={{fontSize:68,fontWeight:850,lineHeight:1.1,color:accent(r)}}>{r.gift.titleMn}</div>
      <div style={{fontSize:33,lineHeight:1.35,marginTop:24,marginBottom:35,color:지면.보조글자}}>{r.gift.introMn}</div>
      <div data-check="resource-items" style={{display:'flex',flexDirection:'column',gap:24}}>{items.map((item,i)=><div key={i} style={{borderTop:`2px solid ${색('Stitch')}`,paddingTop:24}}>
        <div style={{fontSize:30,fontWeight:600,color:지면.보조글자,marginBottom:8}}>{item.labelMn}</div>
        <div style={{fontSize:item.ko.length>140?40:46,fontWeight:780,lineHeight:1.24,whiteSpace:'pre-wrap',wordBreak:'keep-all'}}>{item.ko}</div>
        <div style={{fontSize:34,lineHeight:1.28,marginTop:9}}>{item.mn}</div>
      </div>)}</div>
      <div data-check="resource-note" style={{fontSize:30,lineHeight:1.32,marginTop:32,color:지면.보조글자,wordBreak:'keep-all'}}>{r.gift.noteMn}</div>
    </div>
    <div style={{position:'absolute',left:72,bottom:110,fontSize:28,color:지면.보조글자}}>SYNK LAB · {r.keywordMn}</div><div style={{position:'absolute',right:100,bottom:110,fontSize:28}}>{page+1} / {pages.length}</div>
  </AbsoluteFill>;
}

/** 이번 납품의 화면 경계 실측 기록. 외부 게시 승인이나 언어 검수로 취급하지 않는다. */
function LayoutEvidence({id,frames}:{id:string;frames:number[]}) {
  const frame=useCurrentFrame();
  useEffect(()=>{
    if(!frames.includes(frame))return;
    void document.fonts.ready.then(()=>{
      const boxes=Array.from(document.querySelectorAll('[data-check]')).map(el=>{
        const b=el.getBoundingClientRect();return {name:el.getAttribute('data-check'),x:b.x,y:b.y,right:b.right,bottom:b.bottom,text:el.textContent};
      });
      console.log('REEL_LAYOUT '+JSON.stringify({id,frame,boxes}));
    });
  },[frame,id]);
  return null;
}
