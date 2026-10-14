/* SYNK WORLD 공통 소리·진동·연출 설정 (2026-10-14 2차 · 10-15 펠트 소리)
 * 조사(월드_시그널/조사 §5-1 ⑤·⑥, §5-2)에서 칭찬이 더 많은 유일한 기능이 소리였다. 효과음은 짧고 낮게, 목소리보다 작게,
 * 따로 끌 수 있게. 「보상 연출」과 「캐릭터 반응」은 한 덩어리가 아니라 각각 끈다(Finch 「다 끄면 앱이 죽은 것 같다」).
 * 소리는 파일 없이 WebAudio로 합성한다(단추 ≤40ms, 판정 ≤220ms). 게임·레슨·시트는 모두 이 모듈 하나를 부른다.
 * 10-15 유호님 「시안 1~8번 모두 앱에」(이야기 화면 디테일 시안): 전자음(삼각파·사인파)을 천·종이·나무를 두드린 펠트 소리로 바꾸고
 * 누를 때마다 높이·세기를 조금씩 달리한다. 세기는 바꾸기 전 전자음과 귀 세기(K 가중, 100ms 창 최대)가 ±3dB 안에 들게 쟀다.
 * 이야기 글에는 친구마다 다른 말소리(마스코트는 목소리 합성을 쓰지 않는다)와 해설 타자 소리를 낸다.
 * 사용: import {play,haptic,getPref,setPref,bindTaps} from '../brand-opening/world-sound.mjs'; play('ok'); */

export const PREF_KEYS=Object.freeze({sound:'synk.world.sound',storyVoice:'synk.world.story-voice',haptic:'synk.world.haptic',celebrate:'synk.world.celebrate',reactions:'synk.world.reactions'});
export const PREF_LABELS=Object.freeze({
  sound:{title:'효과음',note:'단추·정답·완료의 짧은 소리예요. 목소리보다 작게 울려요.'},
  storyVoice:{title:'이야기 말소리',note:'이야기 글이 나타날 때 친구마다 다른 짧은 말소리와 해설 타자 소리가 나요.'},
  haptic:{title:'진동',note:'넘기기·정답·완료 때 아주 짧게 한 번 울려요.'},
  celebrate:{title:'보상 연출',note:'끝났을 때 한 장으로 보여 주는 짧은 축하예요. 꺼도 결과는 똑같이 보여요.'},
  reactions:{title:'친구들의 반응',note:'정답·오답에 친구들이 자세를 한 번 바꿔요. 끄면 가만히 있어요.'}
});
const DEFAULTS={sound:true,storyVoice:true,haptic:true,celebrate:true,reactions:true};
const listeners=new Set();

export function getPref(name){
  if(!(name in DEFAULTS))return true;
  try{const raw=localStorage.getItem(PREF_KEYS[name]);if(raw==='true')return true;if(raw==='false')return false;}catch{}
  return DEFAULTS[name];
}
export function setPref(name,value){
  if(!(name in DEFAULTS))return;
  const next=Boolean(value);
  try{localStorage.setItem(PREF_KEYS[name],String(next));}catch{}
  for(const fn of listeners){try{fn(name,next);}catch{}}
  try{window.dispatchEvent(new CustomEvent('synk-world-pref',{detail:{name,value:next}}));}catch{}
}
export function onPref(fn){listeners.add(fn);return()=>listeners.delete(fn);}

/* ── 펠트 소리 ── 잡음 + 필터(천·종이 결) + 낮은 몸통음(나무). 이름은 뜻으로 부른다. */
const noiseBuffers=new WeakMap();
function noise(ctx){
  let buffer=noiseBuffers.get(ctx);
  if(!buffer){const length=Math.floor(ctx.sampleRate*.6);buffer=ctx.createBuffer(1,length,ctx.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=Math.random()*2-1;noiseBuffers.set(ctx,buffer);}
  const source=ctx.createBufferSource();source.buffer=buffer;return source;
}
const vary=amount=>1+(Math.random()*2-1)*amount;
function envelope(gain,t,peak,attack,decay){gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(peak,.0002),t+attack);gain.gain.exponentialRampToValueAtTime(.0001,t+attack+decay);}
function tone(ctx,dest,{type='sine',f,f2=0,glide=.04,t,peak,att=.004,dec=.08}){
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(f,t);if(f2)osc.frequency.exponentialRampToValueAtTime(f2,t+glide);
  envelope(gain,t,peak,att,dec);osc.connect(gain);gain.connect(dest);osc.start(t);osc.stop(t+att+dec+.03);
}
function burst(ctx,dest,{t,peak,att=.001,dec=.03,filters=[]}){
  const source=noise(ctx),gain=ctx.createGain();let node=source;
  for(const [type,f,q=.7,f2=0,dur=0] of filters){const filter=ctx.createBiquadFilter();filter.type=type;filter.frequency.setValueAtTime(f,t);if(f2)filter.frequency.exponentialRampToValueAtTime(f2,t+dur);filter.Q.value=q;node.connect(filter);node=filter;}
  node.connect(gain);gain.connect(dest);envelope(gain,t,peak,att,dec);source.start(t,Math.random()*.3);source.stop(t+att+dec+.03);
}
// 나무 실로폰 한 음과 오르골 한 음
function marimba(ctx,dest,t,f,v=1){tone(ctx,dest,{f,t,peak:.1*v,att:.002,dec:.42});tone(ctx,dest,{f:f*3.99,t,peak:.025*v,att:.001,dec:.06});burst(ctx,dest,{t,peak:.18*v,att:.0008,dec:.007,filters:[['bandpass',2200,1]]});}
function bell(ctx,dest,t,f,v=1){tone(ctx,dest,{f,t,peak:.05*v,att:.002,dec:.7});tone(ctx,dest,{f:f*1.0023,t,peak:.03*v,att:.002,dec:.6});tone(ctx,dest,{f:f*2,t,peak:.012*v,att:.001,dec:.18});}
const FELT={
  // 단추: 펠트를 손끝으로 톡
  tap(ctx,d,t){burst(ctx,d,{t,peak:.55*vary(.12),att:.0015,dec:.038,filters:[['bandpass',1150*vary(.08),.9],['lowpass',2800]]});tone(ctx,d,{f:175*vary(.05),f2:118,glide:.05,t,peak:.085,att:.002,dec:.06});},
  // 고르기: 펠트 톡 + 작은 나무 한 음
  select(ctx,d,t){FELT.tap(ctx,d,t);marimba(ctx,d,t+.02,659.25*vary(.02),.55);},
  // 쪽 넘김: 종이가 스치고 탁 내려앉음
  page(ctx,d,t){burst(ctx,d,{t,peak:.42,att:.05,dec:.16,filters:[['bandpass',620*vary(.06),.8,2600,.17],['highpass',300]]});burst(ctx,d,{t:t+.14,peak:.3,att:.002,dec:.05,filters:[['bandpass',900,.9],['lowpass',2200]]});tone(ctx,d,{f:132,f2:92,glide:.07,t:t+.14,peak:.08,att:.003,dec:.07});},
  // 이름표·안내판: 나무 패를 손톱으로 딱
  sign(ctx,d,t){const f=1240*vary(.03);tone(ctx,d,{f,t,peak:.05,att:.001,dec:.05});tone(ctx,d,{f:f*2.76,t,peak:.018,att:.001,dec:.018});burst(ctx,d,{t,peak:.32,att:.0008,dec:.01,filters:[['bandpass',2600,1.2]]});},
  open(ctx,d,t){burst(ctx,d,{t,peak:.5,att:.012,dec:.1,filters:[['lowpass',1000,.7,1800,.08]]});tone(ctx,d,{f:220,f2:330,glide:.09,t,peak:.05,att:.01,dec:.1});},
  close(ctx,d,t){burst(ctx,d,{t,peak:.4,att:.006,dec:.08,filters:[['lowpass',1500,.7,700,.07]]});tone(ctx,d,{f:300,f2:215,glide:.08,t,peak:.045,att:.006,dec:.08});},
  // 정답: 나무 실로폰 두 음 · 다시: 부드러운 툭툭 · 끝: 오르골 네 음 · 선물: 실로폰 세 음 위에 오르골
  ok(ctx,d,t){marimba(ctx,d,t,523.25);marimba(ctx,d,t+.09,783.99);},
  miss(ctx,d,t){const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=900;low.connect(d);tone(ctx,low,{f:196,f2:160,glide:.1,t,peak:.09,att:.004,dec:.12});tone(ctx,low,{f:175,f2:140,glide:.1,t:t+.13,peak:.08,att:.004,dec:.14});burst(ctx,low,{t,peak:.25,att:.002,dec:.04,filters:[['bandpass',500,.8]]});},
  done(ctx,d,t){[1046.5,1318.5,1568,2093].forEach((f,i)=>bell(ctx,d,t+i*.085,f,i===3?1.1:1));},
  reward(ctx,d,t){[523.25,659.25,783.99].forEach((f,i)=>marimba(ctx,d,t+i*.1,f,.9));bell(ctx,d,t+.3,1568,1.2);},
  // 시계 바늘 한 칸: 아주 작은 나무 딱
  tick(ctx,d,t){tone(ctx,d,{f:1480*vary(.02),t,peak:.04,att:.001,dec:.03});burst(ctx,d,{t,peak:.2,att:.0008,dec:.008,filters:[['bandpass',3000,1.2]]});}
};
// 소리마다 세기: 바꾸기 전 전자음과 귀 세기가 ±3dB 안(쪽 넘김·이름표는 단추보다 조금 크게). 다시 잴 때는 renderSound로 오프라인 렌더.
const LEVEL={tap:.25,select:.3,page:.21,sign:.56,open:.44,close:.5,ok:.4,miss:.83,done:.39,reward:.45,tick:.32};

let context=null,master=null;
function ensure(){
  if(context)return context;
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return null;
  try{context=new AC({latencyHint:'interactive'});}catch{return null;}
  master=context.createGain();master.gain.value=1;master.connect(context.destination);
  return context;
}
// 아이폰은 touchend·click 안에서만 소리를 깨울 수 있어, 깨어날 때까지 누를 때마다 다시 시도한다.
function unlock(){
  const ctx=ensure();if(!ctx||ctx.state==='running')return;
  try{const source=ctx.createBufferSource();source.buffer=ctx.createBuffer(1,1,22050);source.connect(ctx.destination);source.start(0);}catch{}
  ctx.resume().catch(()=>{});
}
for(const type of ['pointerdown','touchend','click','keydown']){try{addEventListener(type,unlock,{capture:true,passive:true});}catch{}}

/* ── 오디오 세션(아이폰 사파리) ── 효과음·말소리는 듣던 음악 위에 섞이고 무음 모드에서는 조용히(ambient).
 * 낱말·목소리 같은 오디오 파일이 나는 동안만 무음 모드에서도 들리게(playback) 둔다. audioSession이 없는 브라우저에서는 아무것도 하지 않는다. */
// 한 문서에 이 모듈이 둘 들어와도(바로 연 home.html의 묶음 + 낱개 모듈) 지금 나는 오디오 파일 목록은 하나로 본다.
const playingMedia=globalThis.__synkPlayingMedia||(globalThis.__synkPlayingMedia=new Set());
function session(type){try{const value=navigator.audioSession;if(value&&value.type!==type)value.type=type;}catch{}}
function guardMedia(){
  const proto=globalThis.HTMLMediaElement?.prototype;if(!proto||!globalThis.navigator?.audioSession||proto.__synkAudioSession)return;
  const native=proto.play;Object.defineProperty(proto,'__synkAudioSession',{value:true});
  proto.play=function(...args){
    let done=null;
    if(!this.muted){
      playingMedia.add(this);session('playback');
      done=()=>{for(const type of ['pause','ended','error'])this.removeEventListener(type,done);playingMedia.delete(this);};
      for(const type of ['pause','ended','error'])this.addEventListener(type,done);
    }
    const result=native.apply(this,args);
    // 재생이 거절되면(누르기 전 자동 재생 등) pause·ended가 오지 않으니 여기서 정리한다(목록에 남으면 playback에 묶인다).
    if(done&&result?.then)result.then(null,()=>{if(this.paused)done();});
    return result;
  };
}
guardMedia();
const ambient=()=>{if(!playingMedia.size)session('ambient');};

/** 시험·측정용: 이름의 소리를 주어진 오디오 그래프(OfflineAudioContext 등)에 그린다. 설정은 보지 않는다. */
export function renderSound(name,ctx,dest,when=0){const make=FELT[name];if(!make)return false;const out=ctx.createGain();out.gain.value=LEVEL[name];out.connect(dest);make(ctx,out,when);return true;}

/** 이름으로 짧은 소리를 낸다. 꺼져 있거나 오디오가 없으면 조용히 넘어간다. 돌려주는 값은 실제로 울렸는지. */
export function play(name){
  if(!getPref('sound'))return false;
  if(!FELT[name])return false;
  const ctx=ensure();if(!ctx)return false;
  if(ctx.state==='suspended'){ctx.resume().catch(()=>{});if(ctx.state==='suspended')return false;}
  ambient();
  return renderSound(name,ctx,master,ctx.currentTime+.005);
}

/* ── 이야기 말소리 ── 글자의 모음(중성)으로 높이를 고르고, 문장 끝 부호로 억양을 준다. 받침 있는 글자는 짧게.
 * 몽글은 둥근 사인파(몽실), 까몽은 삼각파(톡톡), 마린은 사각파 두 음(삐빅). 세 친구의 한 줄 세기가 같게(귀 세기 약 −40dB) 맞췄다. */
const JUNG_SEMI=[2,3,2,3,0,3,0,3,-1,2,3,-1,-1,-3,0,3,-3,-3,-2,-2,5];
function hangul(ch){const code=ch?.codePointAt?.(0);if(!(code>=0xAC00&&code<=0xD7A3))return null;const i=code-0xAC00;return {jung:Math.floor((i%588)/28),jong:i%28};}
const VOICE={
  mongle:{base:494,type:'sine',from:.9,glide:.03,att:.004,dec:.075,peak:.03,lp:1900,harm:.2,jit:25},
  kkamong:{base:587,type:'triangle',from:1.12,glide:.025,att:.002,dec:.05,peak:.044,lp:2600,bp:1300,jit:55},
  marine:{base:370,type:'square',from:1,glide:0,att:.001,dec:.04,peak:.045,lp:1500,step:1.26,jit:0}
};
function blip(ctx,dest,t,who,info){
  const p=VOICE[who],semi=info.semi+(p.jit?(Math.random()*2-1)*p.jit/100:0);
  const f=p.base*Math.pow(2,semi/12),closed=info.jong>0,dec=p.dec*(closed?.72:1),peak=p.peak*info.loud*(closed?.9:1);
  const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=p.lp;low.Q.value=.5;low.connect(dest);
  let out=low;
  if(p.bp){const bump=ctx.createBiquadFilter();bump.type='peaking';bump.frequency.value=p.bp;bump.Q.value=1.4;bump.gain.value=5;bump.connect(low);out=bump;}
  if(p.step){tone(ctx,out,{type:p.type,f,t,peak,att:p.att,dec:dec*.5});tone(ctx,out,{type:p.type,f:f*p.step,t:t+dec*.45,peak:peak*.8,att:p.att,dec:dec*.55});return;}
  tone(ctx,out,{type:p.type,f:f*p.from,f2:p.from!==1?f:0,glide:p.glide,t,peak,att:p.att,dec});
  if(p.harm)tone(ctx,out,{type:'sine',f:f*2*p.from,f2:p.from!==1?f*2:0,glide:p.glide,t,peak:peak*p.harm,att:p.att,dec:dec*.6});
}
// 해설: 아이폰 키보드처럼 짧고 또렷한 딸깍. 해설은 길어서 친구 말소리보다 4dB쯤 작게.
function keyTick(ctx,dest,t){burst(ctx,dest,{t,peak:.112*vary(.15),att:.0006,dec:.014,filters:[['highpass',1500,.7],['bandpass',3300*vary(.07),1.3]]});tone(ctx,dest,{f:1900*vary(.04),t,peak:.005,att:.0005,dec:.009});}
// 문장 억양: ? 끝 세 글자는 올라가고, . 끝은 내려가고, ! 문장은 조금 높고 크게
function contour(chars){
  const n=chars.length,semi=new Array(n).fill(0),loud=new Array(n).fill(1);let start=0;
  for(let k=0;k<n;k++){
    const ch=chars[k];if(!'.!?…'.includes(ch)&&k!==n-1)continue;
    const syllables=[];for(let j=start;j<=k;j++)if(hangul(chars[j]))syllables.push(j);
    const tail=steps=>syllables.slice(-steps.length).forEach((j,q,list)=>{semi[j]+=steps[q+steps.length-list.length];});
    if(ch==='?')tail([2,4,7]);else if(ch==='!'){for(const j of syllables){semi[j]+=1;loud[j]=1.15;}tail([2]);}else if(ch==='.')tail([-1,-2,-3]);else if(ch==='…')tail([-1,-2]);
    start=k+1;
  }
  return {semi,loud};
}
/** 이야기 한 줄의 말소리. 글자가 하나씩 나타날 때 at(글자 번호)를 부른다. who가 세 친구가 아니면 해설 타자 소리(초당 11번까지).
 * 「효과음」과 「이야기 말소리」가 모두 켜져 있고 소리가 이미 깨어 있을 때만 난다(글자 나타나기는 누르는 순간 뒤에 시작한다). */
export function storyVoice(who,text,{cps=23,render=null}={}){
  const chars=Array.from(String(text??'')),{semi,loud}=contour(chars),every=Math.max(1,Math.round(cps/11));let syllables=0;
  const draw=(ctx,dest,t,k,h,n)=>{if(VOICE[who]){blip(ctx,dest,t,who,{jong:h.jong,semi:semi[k]+JUNG_SEMI[h.jung],loud:loud[k]});return true;}if(n%every)return false;keyTick(ctx,dest,t);return true;};
  return {chars,at(k,when=null){
    const h=hangul(chars[k]);if(!h)return false;const n=syllables++;
    if(render)return draw(render.ctx,render.dest,when??0,k,h,n);
    if(!getPref('sound')||!getPref('storyVoice'))return false;
    const ctx=context;if(!ctx||ctx.state!=='running')return false;
    ambient();return draw(ctx,master,ctx.currentTime+.004,k,h,n);
  }};
}

/* ── 진동 ── 안드로이드는 vibrate. 아이폰은 vibrate가 없어서 iOS 18의 스위치 체크박스를 눌러 시스템 진동을 빌린다(누르는 처리 안에서만 된다). */
const canVibrate=()=>typeof navigator!=='undefined'&&typeof navigator.vibrate==='function';
// 스위치 진동은 아이폰에만 있다(아이패드·맥 사파리도 스위치 칸은 알지만 울리지 않는다).
function canSwitch(){try{return typeof document!=='undefined'&&'switch' in HTMLInputElement.prototype&&/iPhone/.test(navigator.userAgent||'');}catch{return false;}}
/** 이 기기에서 진동을 낼 수 있는지(설정의 「진동」 줄을 보일지). */
export const hapticAvailable=()=>canVibrate()||canSwitch();
/** 아주 짧은 진동. 넘기기·정답·완료 정도에만 쓴다. */
export function haptic(kind='ok'){
  if(!getPref('haptic'))return false;
  if(canVibrate()){const pattern=kind==='done'?[14,40,18]:kind==='miss'?[22]:kind==='tap'?[8]:[10];try{return Boolean(navigator.vibrate(pattern));}catch{return false;}}
  if(!canSwitch())return false;
  try{
    const label=document.createElement('label'),input=document.createElement('input');
    input.type='checkbox';input.setAttribute('switch','');label.setAttribute('aria-hidden','true');label.style.display='none';label.append(input);
    // 숨긴 단추의 click이 문서의 다른 처리(바깥 누르면 닫기 등)에 닿지 않게 여기서 멈춘다. 진동은 기본 동작이라 그대로 난다.
    label.addEventListener('click',event=>event.stopPropagation());
    document.head.append(label);label.click();label.remove();return true;
  }catch{return false;}
}

/** 단추를 누를 때마다 「tap」을 낸다. 문서(또는 루트)마다 한 번만 부른다. data-sound="none"이면 건너뛴다. */
export function bindTaps(root=document,{selector='button,[role=button],a.felt-button,a.plain-button'}={}){
  if(!root||root.__synkTapsBound)return()=>{};root.__synkTapsBound=true;
  const handler=event=>{if(event.button&&event.button!==0)return;const el=event.target?.closest?.(selector);if(!el||el.disabled||el.closest('[data-sound=none]'))return;play('tap');};
  root.addEventListener('pointerdown',handler,{passive:true});
  return()=>{root.removeEventListener('pointerdown',handler);root.__synkTapsBound=false;};
}

/** 판정 한 번: 소리 + 진동 + (켜져 있으면) 캐릭터 반응 콜백. */
export function verdict(correct,{react=null}={}){
  play(correct?'ok':'miss');haptic(correct?'ok':'miss');
  if(react&&getPref('reactions')){try{react(correct);}catch{}}
}

export default {play,haptic,hapticAvailable,getPref,setPref,onPref,bindTaps,verdict,storyVoice,renderSound,PREF_KEYS,PREF_LABELS};
