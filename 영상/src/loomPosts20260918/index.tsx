import React from 'react';
import {AbsoluteFill, Audio, Composition, Img, Sequence, interpolate, registerRoot, staticFile, useCurrentFrame} from 'remotion';
import {한글체, 라틴체} from '../킷/폰트';
import tokens from '../../../docs/디자인_토큰.json';
import {createScene, stepScene, getScenePose} from '../../../tools/lib/loom-scene.mjs';

export const CUT = 78;
export const FPS = 30;
export const TOTAL = CUT * 8;
const color = (name: string) => tokens.색.킷.find(c => c.이름 === name)!.hex;
const paper = color('Paper'), ink = color('Ink'), coral = color('Coral');
const bg = (dark: boolean) => staticFile(`공방/펠트_${dark ? '어두운판' : '종이바탕'}.webp`);
// Sample the same fixed-step Loom scene used by the existing engine. Render order
// cannot change the animation: every output frame indexes this deterministic cache.
const state = createScene({seed: 918, windStrength: 0.15, gustInterval: 6, gustDuration: 2.4, gustPeak: 1.2});
const poses = Array.from({length: TOTAL}, (_, f) => {
  if (f) stepScene(state, 1 / FPS, {pointer: {active: true, x: Math.sin(f / 65) * .5, y: -.2}});
  return getScenePose(state);
});
const ease = (f: number, a: number, b: number) => interpolate(f, [0, 14, CUT - 1], [a, b, b], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

function Mascot({global, kind = '몽글', expression = '본체', x = 120, y = 870, size = 800}: any) {
  const p = poses[global];
  return <Img src={staticFile(`${kind}/${expression}.png`)} style={{position:'absolute',left:x,top:y,width:size,height:size,objectFit:'contain',transformOrigin:'50% 80%',transform:`translate(${p.lookX * 9}px,${-p.breathe * 1800}px) rotate(${p.lean * 90}deg) scale(${1 + p.breathe})`,filter:'drop-shadow(0px 22px 15px rgba(43,35,32,.13))'}}/>;
}
function Title({children, dark = false, small = false, top = 320}: any) {
  return <div style={{position:'absolute',left:88,right:88,top,color:dark?paper:ink,fontSize:small?72:94,lineHeight:1.22,fontWeight:800,letterSpacing:-3,whiteSpace:'pre-line',wordBreak:'keep-all'}}>{children}</div>;
}
function Label({children, dark = false}: any) {
  return <div style={{position:'absolute',left:92,top:260,fontSize:32,fontWeight:600,color:dark?paper:ink,opacity:.65,letterSpacing:1}}>{children}</div>;
}
function Waves({frame, quiet = false}: any) {
  return <div style={{position:'absolute',left:122,right:122,top:700,height:170,display:'flex',alignItems:'center',justifyContent:'center',gap:14}}>{Array.from({length:21},(_,i)=><div key={i} style={{width:22,borderRadius:20,background:coral,height:(quiet?15:45)+Math.abs(Math.sin(frame/(quiet?16:3)+i*.7))*(quiet?22:110),boxShadow:'inset 2px 2px 4px #ffffff55, 2px 5px 5px #2b232022'}}/>)}</div>;
}
function Quote({children, frame}: any) {
  return <div style={{position:'absolute',left:82,top:570,width:916,height:420,transform:`translateY(${ease(frame,25,0)}px) rotate(-2deg)`,backgroundImage:`url("${bg(false)}")`,borderRadius:64,boxShadow:'0 24px 45px #00000035',border:'2px solid #ffffff44',display:'flex',alignItems:'center',justifyContent:'center',padding:'55px 45px',boxSizing:'border-box'}}><div style={{color:ink,fontWeight:800,fontSize:74,lineHeight:1.35,letterSpacing:-2,whiteSpace:'pre-line',textAlign:'center'}}>{children}</div><div style={{position:'absolute',bottom:-28,left:130,width:65,height:65,background:paper,transform:'rotate(45deg)',zIndex:-1}}/></div>;
}
function Lab({shot, frame, global}: any) {
  const answers: Record<number,string> = {2:'죄송해요.\n잘 안 들렸어요.',4:'그게 무슨\n뜻이에요?',6:'조금만 천천히\n말씀해 주세요.'};
  if (shot in answers) return <><Label dark>이렇게 다시 물어보세요</Label><Title dark small top={335}>{shot===2?'소리를 못 들었을 때':shot===4?'뜻을 모를 때':'속도가 빠를 때'}</Title><Quote frame={frame}>{answers[shot]}</Quote><Mascot global={global} expression="안도" x={380} y={1050} size={620}/><div style={{position:'absolute',left:95,top:1420,color:paper,fontSize:38,lineHeight:1.6}}>{shot===2?'01 / 소리':shot===4?'02 / 뜻':'03 / 속도'}</div></>;
  if (shot===0) return <><Label>한국어로 대화하다가</Label><Title>{'못 알아들었을 때,\n뭐라고 하지?'}</Title><div style={{position:'absolute',top:670,left:94,fontSize:42}}>다시 묻는 말 3개</div><Mascot global={global} expression="궁금함" x={-110} y={820} size={1120}/><div style={{position:'absolute',right:145,top:850,fontFamily:라틴체,fontSize:270,fontWeight:700,color:coral,transform:`rotate(${8+poses[global].wind*8}deg)`}}>?</div></>;
  if (shot===1 || shot===5) return <><Label>{shot===1?'상황 01':'상황 03'}</Label><Title>{shot===1?'목소리가\n너무 작으면':'말이 너무\n빠르면'}</Title><Waves frame={frame} quiet={shot===1}/><Mascot global={global} expression="궁금함" x={shot===1?90:230} y={940} size={760}/></>;
  if (shot===3) return <><Label>상황 02</Label><Title>{'모르는 표현이\n나왔다면'}</Title><div style={{position:'absolute',top:670,left:95,right:95,padding:'34px 42px',borderRadius:28,background:ink,color:paper,fontSize:57,transform:`rotate(${ease(frame,-5,-2)}deg)`}}>“배가 출출해요.”</div><Mascot global={global} expression="궁금함" x={-40} y={920} size={850}/><div style={{position:'absolute',right:120,top:1090,fontSize:150,color:coral,fontWeight:800}}>?</div></>;
  return <><Label>한 번에 다 못 알아들어도</Label><Title>{'다시 물어봐도\n괜찮아요.'}</Title><Mascot global={global} expression="눈웃음" x={-60} y={840} size={790}/><Mascot global={global} kind="까몽" x={455} y={1040} size={540}/><div style={{position:'absolute',left:96,top:720,fontSize:40}}>다음 대화에서 써 보세요.</div></>;
}
const shiftCopy = [ ['만들 때마다','AI가 쓴 말이\n자꾸 어색했다.'],['문서를 열어보니','예전 말투가\n계속 따라왔다.'],['쌓여 있던 것들','끝난 작업 지시.\n겹치는 기준.'],['이번에 정리한 양','작업 문서의 글을'],['남겨야 할 것은','계약과 데이터,\n필요한 원본.'],['비워 둔 자리','말투와 제작 방식은\n다시 만들어 간다.'],['정리는 끝났지만','결과가 좋아졌는지는\n아직 모른다.'],['이제 확인할 것','새로 만든\n글과 화면.'] ];
function Sheet({frame, i, text, clearing = false}: any) {
 const x = clearing ? interpolate(frame,[0,50],[0,1250],{extrapolateRight:'clamp'}) : 0;
 return <div style={{position:'absolute',left:145+(i%2)*65+x,top:790+i*140,width:720,height:210,backgroundImage:`url("${bg(false)}")`,borderRadius:14,color:ink,padding:'45px 55px',boxSizing:'border-box',boxShadow:'0 15px 30px #00000033',fontSize:48,fontWeight:600,transform:`rotate(${(i-1)*5 + poses[Math.min(TOTAL-1,frame)].wind}deg)`}}>{text}<div style={{height:9,marginTop:25,width:440,background:ink,opacity:.1,borderRadius:5}}/></div>;
}
function Shift({shot,frame,global,dark}: any) {
 const [label,title] = shiftCopy[shot];
 return <><Label dark={dark}>{label}</Label><Title dark={dark} small={shot===5||shot===6}>{title}</Title>
 {shot===0 && <><Mascot global={global} kind="까몽" expression="궁금함" x={30} y={970} size={820}/><div style={{position:'absolute',top:730,left:110,right:110,padding:36,border:`2px solid ${paper}55`,borderRadius:30,fontSize:51,color:paper,transform:'rotate(-3deg)'}}>“왜 또 이런 말투지?”</div></>}
 {(shot===1||shot===2) && ['오래된 말투 기준','이미 끝난 작업','반복된 지침'].map((s,i)=><Sheet key={i} frame={frame} i={i} text={s}/>)}
 {shot===3 && <><div style={{position:'absolute',left:74,top:675,color:coral,fontFamily:라틴체,fontSize:320,fontWeight:700,letterSpacing:-20,transform:`scale(${ease(frame,.9,1)})`}}>91<span style={{fontSize:160}}>%</span></div><div style={{position:'absolute',top:1100,left:100,fontSize:68,fontWeight:800,color:paper}}>가량 덜어냈다.</div><div style={{position:'absolute',left:100,top:1320,fontSize:31,lineHeight:1.5,color:paper,opacity:.65}}>작업 문서 글자 수 기준 · 91.38% 감소<br/>도구 매뉴얼·라이선스 제외</div></>}
 {shot===4 && ['계약','데이터','원본'].map((s,i)=><div key={s} style={{position:'absolute',left:110,top:785+i*205,width:850,height:162,backgroundImage:`url("${bg(false)}")`,borderRadius:30,boxShadow:'0 12px 20px #2b232022',padding:'43px 55px',boxSizing:'border-box',fontSize:58,fontWeight:600,transform:`translateX(${ease(frame,-(i+1)*40,0)}px)`}}><span style={{color:coral,marginRight:40}}>✓</span>{s}</div>)}
 {shot===5 && <><Img src={staticFile('공방/공방_공책과연필.avif')} style={{position:'absolute',left:80,top:770,width:920,height:920,borderRadius:70,transform:`rotate(-4deg) scale(${1+frame*.0004})`}}/></>}
 {shot===6 && <><div style={{position:'absolute',left:130,top:720,fontSize:280,color:coral,fontFamily:라틴체,fontWeight:700}}>?</div><Mascot global={global} kind="까몽" expression="집중" x={220} y={970} size={790}/></>}
 {shot===7 && <><div style={{position:'absolute',left:112,top:780,width:850,height:430,background:ink,borderRadius:35,boxShadow:'0 18px 25px #2b232033',padding:55,boxSizing:'border-box',transform:`rotate(${ease(frame,-4,-1)}deg)`}}><div style={{width:80,height:12,background:coral,marginBottom:35}}/><div style={{fontSize:63,fontWeight:800,color:paper,lineHeight:1.35}}>하나씩 만들고,<br/>직접 보면서.</div></div><Mascot global={global} kind="까몽" expression="눈웃음" x={430} y={1220} size={450}/></>}
 </>;
}
function Film({channel}: {channel:'LAB'|'SHIFT'}) {
 const global=useCurrentFrame(), shot=Math.floor(global/CUT),frame=global%CUT;
 const dark=channel==='LAB' ? [2,4,6].includes(shot) : [0,2,3,6].includes(shot);
 return <AbsoluteFill style={{backgroundColor:dark?ink:paper,fontFamily:한글체,color:ink,overflow:'hidden'}}>
  <Img src={bg(dark)} style={{position:'absolute',width:'100%',height:'100%',objectFit:'cover'}}/>
  <div style={{position:'absolute',left:85,top:117,display:'flex',alignItems:'center',gap:25}}><Img src={staticFile(`로고/펠트${dark?'다크':'라이트'}.svg`)} style={{width:165,height:65,objectFit:'contain'}}/><span style={{fontFamily:라틴체,fontWeight:600,fontSize:37,color:dark?paper:ink,letterSpacing:3}}>{channel}</span></div>
  <div key={shot} style={{position:'absolute',inset:0,transform:`translateY(${ease(frame,12,0)}px)`}}>{channel==='LAB'?<Lab {...{shot,frame,global}}/>:<Shift {...{shot,frame,global,dark}}/>}</div>
  <div style={{position:'absolute',left:92,right:92,bottom:162,display:'flex',gap:10}}>{Array.from({length:8},(_,i)=><div key={i} style={{height:5,flex:1,background:i===shot?coral:dark?`${paper}44`:`${ink}22`,borderRadius:4}}/>)}</div>
  <Audio src={staticFile(`소리/BGM_${channel==='LAB'?'산뜻':'깔림'}.wav`)} volume={f=>interpolate(f,[0,15,TOTAL-24,TOTAL],[0,.42,.42,0],{extrapolateRight:'clamp'})}/>
  {Array.from({length:8},(_,i)=><Sequence key={i} from={i*CUT} durationInFrames={30}><Audio src={staticFile(`소리/synk-sound-${i===7?'achieve':i%2?'earn':'notify'}.wav`)} volume={.35}/></Sequence>)}
 </AbsoluteFill>;
}
registerRoot(()=> <>{(['LAB','SHIFT'] as const).map(channel=><Composition key={channel} id={`SYNK-${channel}`} component={Film} defaultProps={{channel}} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920}/>)}</>);
