/* SYNK WORLD 공통 소리·진동·연출 설정 (2026-10-14 2차)
 * 조사(월드_시그널/조사 §5-1 ⑤·⑥, §5-2)에서 칭찬이 더 많은 유일한 기능이 소리였다. 효과음은 짧고 낮게, 목소리보다 작게,
 * 따로 끌 수 있게. 「보상 연출」과 「캐릭터 반응」은 한 덩어리가 아니라 각각 끈다(Finch 「다 끄면 앱이 죽은 것 같다」).
 * 소리는 파일 없이 WebAudio로 합성한다(단추 ≤40ms, 판정 ≤220ms). 게임·레슨·시트는 모두 이 모듈 하나를 부른다.
 * 사용: import {play,haptic,getPref,setPref,bindTaps} from '../brand-opening/world-sound.mjs'; play('ok'); */

export const PREF_KEYS=Object.freeze({sound:'synk.world.sound',haptic:'synk.world.haptic',celebrate:'synk.world.celebrate',reactions:'synk.world.reactions'});
export const PREF_LABELS=Object.freeze({
  sound:{title:'효과음',note:'단추·정답·완료의 짧은 소리예요. 목소리보다 작게 울려요.'},
  haptic:{title:'진동',note:'정답과 완료 때 아주 짧게 한 번 울려요.'},
  celebrate:{title:'보상 연출',note:'끝났을 때 한 장으로 보여 주는 짧은 축하예요. 꺼도 결과는 똑같이 보여요.'},
  reactions:{title:'친구들의 반응',note:'정답·오답에 친구들이 자세를 한 번 바꿔요. 끄면 가만히 있어요.'}
});
const DEFAULTS={sound:true,haptic:true,celebrate:true,reactions:true};
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

/* ── 합성 소리 ── 모두 낮고 짧다. 이름은 뜻으로 부른다. */
const VOICES={
  tap:   [{f:330,t:'triangle',d:.045,g:.05}],
  select:[{f:392,t:'triangle',d:.06,g:.06},{f:523,t:'sine',d:.07,g:.04,at:.03}],
  open:  [{f:262,t:'sine',d:.11,g:.06,slide:330}],
  close: [{f:330,t:'sine',d:.10,g:.05,slide:247}],
  ok:    [{f:440,t:'triangle',d:.09,g:.07},{f:659,t:'sine',d:.16,g:.06,at:.07}],
  miss:  [{f:196,t:'sine',d:.20,g:.07,slide:165}],
  done:  [{f:392,t:'triangle',d:.10,g:.06},{f:523,t:'triangle',d:.10,g:.06,at:.09},{f:659,t:'sine',d:.26,g:.07,at:.18}],
  reward:[{f:523,t:'sine',d:.12,g:.06},{f:659,t:'sine',d:.12,g:.06,at:.1},{f:784,t:'sine',d:.3,g:.07,at:.2}],
  tick:  [{f:880,t:'sine',d:.02,g:.025}]
};
let context=null,master=null,unlocked=false;
function ensure(){
  if(context)return context;
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)return null;
  try{context=new AC({latencyHint:'interactive'});}catch{return null;}
  master=context.createGain();master.gain.value=.9;
  const low=context.createBiquadFilter();low.type='lowpass';low.frequency.value=2400;low.Q.value=.6;
  master.connect(low);low.connect(context.destination);
  return context;
}
function unlock(){
  if(unlocked)return;const ctx=ensure();if(!ctx)return;unlocked=true;
  if(ctx.state==='suspended')ctx.resume().catch(()=>{});
}
for(const type of ['pointerdown','keydown','touchstart']){try{addEventListener(type,unlock,{capture:true,passive:true});}catch{}}

/** 이름으로 짧은 소리를 낸다. 꺼져 있거나 오디오가 없으면 조용히 넘어간다. 돌려주는 값은 실제로 울렸는지. */
export function play(name){
  if(!getPref('sound'))return false;
  const voice=VOICES[name];if(!voice)return false;
  const ctx=ensure();if(!ctx)return false;
  if(ctx.state==='suspended'){ctx.resume().catch(()=>{});if(ctx.state==='suspended')return false;}
  const now=ctx.currentTime;
  for(const n of voice){
    const osc=ctx.createOscillator(),gain=ctx.createGain(),start=now+(n.at||0),end=start+n.d;
    osc.type=n.t;osc.frequency.setValueAtTime(n.f,start);if(n.slide)osc.frequency.exponentialRampToValueAtTime(n.slide,end);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(n.g,start+.008);gain.gain.exponentialRampToValueAtTime(.0001,end);
    osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(end+.02);
  }
  return true;
}

/** 아주 짧은 진동. 정답·완료 정도에만 쓴다. */
export function haptic(kind='ok'){
  if(!getPref('haptic'))return false;
  const pattern=kind==='done'?[14,40,18]:kind==='miss'?[22]:[10];
  try{return Boolean(navigator.vibrate?.(pattern));}catch{return false;}
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

export default {play,haptic,getPref,setPref,onPref,bindTaps,verdict,PREF_KEYS,PREF_LABELS};
