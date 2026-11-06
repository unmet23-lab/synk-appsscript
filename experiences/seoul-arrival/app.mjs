// 서울행 — WORLD 새 학생 첫 실행(설계 experiences/seoul-arrival/설계.md). 15판 시안을 옮긴 화면이다.
// 앱의 전체 화면 틀(같은 출처 iframe) 안에서 돌고, 저장 · 1화 열기 · 나가기는 부모 창의 SYNKSeoulHost로만 한다.
// 움직임 · 소리 값은 시안에서 재서 정한 값이라 함부로 바꾸지 않는다.
import {THEATER,ARENA,LOOK_FACES as LOOK_FACES_DATA} from './data.mjs';
import {LANG,L,sub,setLang} from './strings.mjs';
import {hangulName,calledName} from './name-hangul.mjs';
import {createNameTrace,nameSyllables,signSvg} from './name-trace.mjs';
const HOST=(()=>{try{if(window.parent!==window&&window.parent.location.origin===location.origin)return window.parent.SYNKSeoulHost||null;}catch{}return null;})();
const A=name=>new URL(`./assets/img/${name}.webp`,import.meta.url).href;
const CONCERT=new URL('../brand-opening/assets/world-title-concert-port-v2.webp',import.meta.url).href;
const IMG={note1:A('note1'),mirror:A('mirror'),desk_idol:A('desk-idol'),desk_actor:A('desk-actor'),note:A('note0'),mom:A('mom'),airport:A('airport'),immigration:A('immigration'),concert:CONCERT,room:A('room'),drama:A('drama'),bag_idol:A('bag-idol'),bag_actor:A('bag-actor'),plane:A('plane'),train:A('train'),gate:A('gate'),booth:A('booth'),idol:A('idol'),actor:A('actor'),idolGoal:CONCERT,actorGoal:A('premiere'),theaterBase:A('theater-base'),theaterSeats:A('theater-seats'),arenaBase:A('arena-base'),arenaSeats:A('arena-seats'),tmoney:A('tmoney'),bus:A('bus')};
const AUD=Object.fromEntries(['amb_airport','amb_cabin','amb_campus','amb_canteen','amb_clock','amb_dawn','amb_hall','amb_room','amb_train','bgm_anthem','bgm_campus','bgm_journey','pix_impact_bass_1','pix_notification','pix_riser','pix_sparkle','pix_whoosh_cinematic','pix_whoosh_short','sfx_applause','sfx_crowd','sfx_imo','sfx_print','sfx_stamp','sfx_walk','sfx_zip'].map(name=>[name,new URL(`./assets/snd/${name}.mp3`,import.meta.url).href]));
/* 곡 안 박 시각(초) */
const ANTHEM_DROP=[3.05,48.16,102.51];
const $=s=>document.querySelector(s);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches||HOST?.reduced?.()===true;
// 기다림은 「읽는 시간」이라 동작 줄이기에서도 줄이지 않는다(줄이는 것은 움직임뿐 —
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* 그림 받기: 차례가 오기 전에 미리 받아 풀어 두고, 컷을 바꿀 때 아직이면 3초까지만 기다린다(그 뒤에는 글과 소리를 먼저 잇는다). */
const pics=new Map();
function pre(name){const src=IMG[name];if(!src)return Promise.resolve(null);if(!pics.has(src))pics.set(src,new Promise(res=>{const i=new Image();i.decoding='async';i.onload=()=>{const d=i.decode?i.decode().catch(()=>{}):Promise.resolve();d.then(()=>res(i));};i.onerror=()=>res(null);i.src=src;}));return pics.get(src);}
const warm=names=>names.forEach(n=>pre(n));
// 화면에 박힌 그림은 차례가 올 때 받는다(타이틀이 떠 있는 동안 받을 양을 줄인다)
const fillLazy=(attr='data-src')=>document.querySelectorAll(`img[${attr}]`).forEach(i=>{i.src=i.getAttribute(attr);i.removeAttribute(attr);});
const WARM={first:['room','drama','mirror'],story:d=>['desk_'+d,'bag_'+d,'mom','airport','note','plane','immigration','train','tmoney','bus','gate','booth'],road:d=>[d+'Goal',d==='actor'?'theaterBase':'arenaBase',d==='actor'?'theaterSeats':'arenaSeats','note1']};
const ready=name=>Promise.race([pre(name),new Promise(r=>setTimeout(r,3000))]);
/* 양옆 흐린 판(넓은 화면): 지금 그림을 칸 밖에도 깐다 */
const ambientImg=document.getElementById('ambientImg');
function ambient(src){if(!ambientImg||!src||ambientImg.dataset.src===src)return;ambientImg.dataset.src=src;ambientImg.src=src;}
/* 저장: 부모 통로로 넘기고 기다리지 않는다(저장이 늦어도 이야기는 간다) */
function save(patch){if(state.replayOf)return;try{Promise.resolve(HOST?.save?.(patch)).catch(()=>{});}catch{}}


/* ══ 소리 ══ 곡 · 배경 소리는 오디오 요소 → 필터 → 버스, 짧은 소리는 미리 푼 버퍼, 단추 · 말소리는 WORLD 펠트 합성(world-sound.mjs와 같은 식) */
const SND=(()=>{
  let ctx=null,master,musicBus,ambBus,sfxBus,on=true;
  try{on=localStorage.getItem('synk.world.seoul.sound')!=='off';}catch{}
  const tracks={},bufs={},loops={},asked=new Set();
  // 짧은 소리는 풀어 둔다. 첫 탭에 쓰는 넷만 미리, 나머지는 시작한 뒤에(warmAll)
  function load(k){if(asked.has(k)||!ctx)return;asked.add(k);fetch(AUD[k]).then(r=>{if(!r.ok)throw 0;return r.arrayBuffer();}).then(a=>ctx.decodeAudioData(a)).then(b=>{bufs[k]=b;}).catch(()=>{asked.delete(k);});}
  function warmAll(){ensure();for(const k of Object.keys(AUD))if(/^(sfx|pix|amb)_/.test(k))load(k);}
  // 페이지를 열 때 미리 만든다(멈춘 AudioContext로도 풀기는 된다) — 첫 탭의 함성이 버퍼를 기다리다 빠지지 않게
  function ensure(){
    if(ctx)return ctx;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
    ctx=new AC({latencyHint:'interactive'});master=ctx.createGain();master.gain.value=on?1:0;master.connect(ctx.destination);
    musicBus=ctx.createGain();ambBus=ctx.createGain();sfxBus=ctx.createGain();musicBus.gain.value=.78;ambBus.gain.value=1;sfxBus.gain.value=.9;
    [musicBus,ambBus,sfxBus].forEach(b=>b.connect(master));
    for(const k of ['sfx_crowd','amb_room','amb_clock','pix_whoosh_short'])load(k);
    track('bgm_anthem');
    return ctx;
  }
  // 첫 탭 안에서 곡 요소를 모두 한 번 깨운다(아이폰은 요소마다 제스처 안의 play가 한 번 필요했다)
  let woke=false;
  function unlock(){const c=ensure();if(c&&c.state!=='running')c.resume().catch(()=>{});try{navigator.audioSession&&(navigator.audioSession.type='playback');}catch{}
    if(woke)return;woke=true;for(const n of ['bgm_anthem','bgm_journey','bgm_campus']){const t=track(n);if(t&&t.el.paused){t.el.play().then(()=>{if(!t.want)t.el.pause();}).catch(()=>{});}}}
  function track(name){
    if(tracks[name])return tracks[name];const c=ctx;if(!c||!AUD[name])return null;
    const el=new Audio(AUD[name]);el.preload=name==='bgm_anthem'?'auto':'metadata';el.loop=/campus|journey/.test(name);
    const src=c.createMediaElementSource(el),hp=c.createBiquadFilter(),lp=c.createBiquadFilter(),g=c.createGain();
    hp.type='highpass';hp.frequency.value=20;lp.type='lowpass';lp.frequency.value=20000;g.gain.value=0;
    src.connect(hp);hp.connect(lp);lp.connect(g);g.connect(musicBus);
    return tracks[name]={el,hp,lp,g,want:false,timer:0};
  }
  const ramp=(p,v,dur)=>{const t=ctx.currentTime;p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.linearRampToValueAtTime(v,t+Math.max(.02,dur));};
  // 배경 소리는 푼 버퍼를 고리로 — MP3 요소 loop는 바퀴마다 이음새가 남는다. 파일 앞뒤 0.1초는 고리의 끝 · 처음을 덧댄 것이라(qa/소리다듬기.py PAD) 건너 돈다
  const AMB_PAD=.1;
  function ambient(name,vol,fade){
    const c=ensure();if(!c)return;let L=loops[name];
    if(L&&L.pending){clearTimeout(L.pending);delete loops[name];L=null;}
    if(!L){if(!bufs[name]){loops[name]={pending:setTimeout(()=>{delete loops[name];ambient(name,vol,fade);},120)};return;}const s=c.createBufferSource(),g=c.createGain();s.buffer=bufs[name];s.loop=true;s.loopStart=AMB_PAD;s.loopEnd=s.buffer.duration-AMB_PAD;g.gain.value=0;s.connect(g);g.connect(ambBus);s.start(0,AMB_PAD);L=loops[name]={s,g};}
    clearTimeout(L.timer);ramp(L.g.gain,vol,fade);
  }
  function play(name,{at=null,vol=1,fade=.6,bus='music'}={}){
    if(bus==='amb'){ambient(name,vol,fade);return null;}
    const t=track(name);if(!t)return null;t.want=true;clearTimeout(t.timer);
    if(at!=null){try{t.el.currentTime=at;}catch{}}
    t.el.play().catch(()=>{});ramp(t.g.gain,vol,fade);return t.el;
  }
  function level(name,vol,dur=.8){const t=tracks[name];if(t&&ctx)ramp(t.g.gain,vol,dur);}
  function stop(name,dur=1){
    if(!ctx)return;const L=loops[name];
    if(L&&L.pending){clearTimeout(L.pending);delete loops[name];return;}
    if(L){ramp(L.g.gain,0,dur);clearTimeout(L.timer);L.timer=setTimeout(()=>{try{L.s.stop();}catch{}delete loops[name];},dur*1000+100);return;}
    const t=tracks[name];if(!t)return;t.want=false;ramp(t.g.gain,0,dur);clearTimeout(t.timer);t.timer=setTimeout(()=>{if(!t.want)t.el.pause();},dur*1000+100);
  }
  // from=true면 먹먹한 상태에서 시작해 열린다(앞 램프를 지우지 않고 값부터 놓는다 —
  function muffle(name,yes,dur=1.2,{from=null}={}){const t=tracks[name];if(!t||!ctx)return;const now=ctx.currentTime;
    for(const [p,v,v0] of [[t.lp.frequency,yes?950:20000,yes?20000:950],[t.hp.frequency,yes?420:20,yes?20:420]]){p.cancelScheduledValues(now);p.setValueAtTime(from?v0:p.value,now);p.exponentialRampToValueAtTime(v,now+dur);}}
  function sfx(name,vol=1,when=0){const c=ensure();if(!c||!bufs[name])return;const s=c.createBufferSource(),g=c.createGain();s.buffer=bufs[name];g.gain.value=vol;s.connect(g);g.connect(sfxBus);s.start(c.currentTime+when);}
  function toggle(){on=!on;try{localStorage.setItem('synk.world.seoul.sound',on?'on':'off');}catch{}if(ctx)ramp(master.gain,on?1:0,.25);return on;}
  /* ── 펠트 합성(world-sound.mjs FELT · storyVoice와 같은 식) ── */
  let nb=null;function noise(){if(!nb){const n=Math.floor(ctx.sampleRate*.6);nb=ctx.createBuffer(1,n,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;}const s=ctx.createBufferSource();s.buffer=nb;return s;}
  const vary=a=>1+(Math.random()*2-1)*a;
  function env(g,t,pk,a,d){g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(pk,.0002),t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);}
  function tone(dest,{type='sine',f,f2=0,glide=.04,t,peak,att=.004,dec=.08}){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+glide);env(g,t,peak,att,dec);o.connect(g);g.connect(dest);o.start(t);o.stop(t+att+dec+.03);}
  function burst(dest,{t,peak,att=.001,dec=.03,filters=[]}){const s=noise(),g=ctx.createGain();let n=s;for(const [ty,f,q=.7,f2=0,du=0] of filters){const fl=ctx.createBiquadFilter();fl.type=ty;fl.frequency.setValueAtTime(f,t);if(f2)fl.frequency.exponentialRampToValueAtTime(f2,t+du);fl.Q.value=q;n.connect(fl);n=fl;}n.connect(g);g.connect(dest);env(g,t,peak,att,dec);s.start(t,Math.random()*.3);s.stop(t+att+dec+.03);}
  function marimba(d,t,f,v=1){tone(d,{f,t,peak:.1*v,att:.002,dec:.42});tone(d,{f:f*3.99,t,peak:.025*v,att:.001,dec:.06});burst(d,{t,peak:.18*v,att:.0008,dec:.007,filters:[['bandpass',2200,1]]});}
  function bell(d,t,f,v=1){tone(d,{f,t,peak:.05*v,att:.002,dec:.7});tone(d,{f:f*1.0023,t,peak:.03*v,att:.002,dec:.6});tone(d,{f:f*2,t,peak:.012*v,att:.001,dec:.18});}
  const FELT={
    tap(d,t){burst(d,{t,peak:.55*vary(.12),att:.0015,dec:.038,filters:[['bandpass',1150*vary(.08),.9],['lowpass',2800]]});tone(d,{f:175*vary(.05),f2:118,glide:.05,t,peak:.085,att:.002,dec:.06});},
    select(d,t){FELT.tap(d,t);marimba(d,t+.02,659.25*vary(.02),.55);},
    page(d,t){burst(d,{t,peak:.42,att:.05,dec:.16,filters:[['bandpass',620*vary(.06),.8,2600,.17],['highpass',300]]});burst(d,{t:t+.14,peak:.3,att:.002,dec:.05,filters:[['bandpass',900,.9],['lowpass',2200]]});tone(d,{f:132,f2:92,glide:.07,t:t+.14,peak:.08,att:.003,dec:.07});},
    open(d,t){burst(d,{t,peak:.5,att:.012,dec:.1,filters:[['lowpass',1000,.7,1800,.08]]});tone(d,{f:220,f2:330,glide:.09,t,peak:.05,att:.01,dec:.1});},
    ok(d,t){marimba(d,t,523.25);marimba(d,t+.09,783.99);},
    done(d,t){[1046.5,1318.5,1568,2093].forEach((f,i)=>bell(d,t+i*.085,f,i===3?1.1:1));},
    reward(d,t){[523.25,659.25,783.99].forEach((f,i)=>marimba(d,t+i*.1,f,.9));bell(d,t+.3,1568,1.2);},
    // 기내 방송 차임: 높은 음 → 낮은 음, 길게 울림
    chime(d,t){[[784,0],[622.25,.62]].forEach(([f,o])=>{tone(d,{f,t:t+o,peak:.09,att:.004,dec:1.6});tone(d,{f:f*2,t:t+o,peak:.02,att:.003,dec:.6});tone(d,{f:f*3.01,t:t+o,peak:.008,att:.002,dec:.25});});},
    // 셔터: 짧은 철컥 두 번
    shutter(d,t){burst(d,{t,peak:.6,att:.0006,dec:.012,filters:[['highpass',1800]]});burst(d,{t:t+.07,peak:.5,att:.0006,dec:.02,filters:[['bandpass',1400,1.2]]});tone(d,{f:180,f2:90,glide:.05,t:t+.07,peak:.06,att:.002,dec:.05});},
    // 심장 한 번: 낮은 두 박
    heart(d,t){[[0,1],[.18,.7]].forEach(([o,v])=>{tone(d,{f:62,f2:40,glide:.12,t:t+o,peak:.45*v,att:.006,dec:.22});burst(d,{t:t+o,peak:.12*v,att:.002,dec:.03,filters:[['lowpass',300]]});});},
    // 연필 사각 · 휴대폰 진동 두 번 · 도장 쾅
    pencil(d,t){burst(d,{t,peak:.22*vary(.25),att:.002,dec:.035,filters:[['highpass',2400,.7],['bandpass',4200*vary(.12),1.1]]});},
    beep(d,t){tone(d,{f:2093,t,peak:.11,att:.002,dec:.11});tone(d,{type:'square',f:2093,t,peak:.016,att:.002,dec:.08});burst(d,{t:t+.17,peak:.22,att:.003,dec:.05,filters:[['bandpass',900,.9],['lowpass',2400]]});tone(d,{f:140,f2:90,glide:.06,t:t+.17,peak:.06,att:.003,dec:.07});},
    buzz(d,t){[0,.24].forEach(o=>{const lo=ctx.createBiquadFilter();lo.type='lowpass';lo.frequency.value=380;lo.connect(d);tone(lo,{type:'sawtooth',f:150,t:t+o,peak:.3,att:.01,dec:.17});});},
    stamp(d,t){tone(d,{f:95,f2:48,glide:.09,t,peak:.7,att:.002,dec:.16});burst(d,{t,peak:.5,att:.001,dec:.05,filters:[['lowpass',1600]]});burst(d,{t:t+.012,peak:.25,att:.001,dec:.02,filters:[['bandpass',2600,1.2]]});},
    focus(d,t){[0,.085].forEach(o=>tone(d,{f:2100,t:t+o,peak:.05,att:.001,dec:.05}));},
    // 카드 프린터: 모터가 한 번 밀 때마다 낮은 웅 + 롤러 사각, 다 나오면 딸깍
    feed(d,t){const lo=ctx.createBiquadFilter();lo.type='lowpass';lo.frequency.value=650;lo.connect(d);tone(lo,{type:'sawtooth',f:88*vary(.03),f2:104,glide:.22,t,peak:.2,att:.025,dec:.22});burst(d,{t,peak:.14,att:.04,dec:.2,filters:[['bandpass',1700*vary(.1),.8],['highpass',900]]});},
    eject(d,t){burst(d,{t,peak:.5,att:.001,dec:.022,filters:[['bandpass',2600,1.4]]});tone(d,{f:240,f2:150,glide:.05,t,peak:.08,att:.002,dec:.06});burst(d,{t:t+.03,peak:.2,att:.03,dec:.16,filters:[['bandpass',900,.7,2400,.15]]});},
    tick(d,t){tone(d,{f:1480*vary(.02),t,peak:.04,att:.001,dec:.03});burst(d,{t,peak:.2,att:.0008,dec:.008,filters:[['bandpass',3000,1.2]]});}
  };
  const LEVEL={pencil:.35,buzz:.5,stamp:.85,tap:.25,select:.3,page:.21,open:.44,ok:.4,done:.39,reward:.45,chime:.5,shutter:.6,heart:.9,tick:.32,focus:.32,feed:.5,eject:.5};
  function felt(name){const c=ensure();if(!c||c.state!=='running'||!FELT[name])return;const o=c.createGain();o.gain.value=LEVEL[name]||.3;o.connect(sfxBus);FELT[name](o,c.currentTime+.005);}
  /* ── 말소리 ── 글자의 모음으로 높이, 문장 끝 부호로 억양. 서하는 밝은 사인, 지호는 낮은 삼각파. 해설은 키보드 딸깍 */
  const JUNG=[2,3,2,3,0,3,0,3,-1,2,3,-1,-1,-3,0,3,-3,-3,-2,-2,5];
  const VOICE={officer:{base:208,type:'triangle',from:.97,glide:.03,att:.004,dec:.075,peak:.042,lp:1500,jit:10},seoha:{base:440,type:'sine',from:1.08,glide:.025,att:.003,dec:.065,peak:.034,lp:2300,harm:.22,jit:30},jiho:{base:262,type:'triangle',from:.94,glide:.03,att:.004,dec:.07,peak:.042,lp:1600,jit:18}};
  function hangul(ch){const c=ch&&ch.codePointAt(0);if(!(c>=0xAC00&&c<=0xD7A3))return null;const i=c-0xAC00;return {jung:Math.floor((i%588)/28),jong:i%28};}
  function contour(chars){const n=chars.length,semi=new Array(n).fill(0),loud=new Array(n).fill(1);let s=0;
    for(let k=0;k<n;k++){const ch=chars[k];if(!'.!?…'.includes(ch)&&k!==n-1)continue;const sy=[];for(let j=s;j<=k;j++)if(hangul(chars[j]))sy.push(j);
      const tail=st=>sy.slice(-st.length).forEach((j,q,l)=>{semi[j]+=st[q+st.length-l.length];});
      if(ch==='?')tail([2,4,7]);else if(ch==='!'){for(const j of sy){semi[j]+=1;loud[j]=1.15;}tail([2]);}else if(ch==='.')tail([-1,-2,-3]);else if(ch==='…')tail([-1,-2]);s=k+1;}
    return {semi,loud};}
  // 해설 · 기내 방송은 소리 없이 글만 나타난다(감성 해설 위의 딸깍은 거슬린다 —. 말소리는 서하 · 지호만.
  function voice(who,text){const chars=Array.from(text),{semi,loud}=contour(chars);
    return k=>{if(!VOICE[who])return;const h=hangul(chars[k]);if(!h||!ctx||ctx.state!=='running')return;const t=ctx.currentTime+.004;
      const p=VOICE[who],sm=semi[k]+JUNG[h.jung]+(p.jit?(Math.random()*2-1)*p.jit/100:0),f=p.base*Math.pow(2,sm/12),closed=h.jong>0,dec=p.dec*(closed?.72:1),pk=p.peak*loud[k]*(closed?.9:1);
      const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=p.lp;low.connect(sfxBus);
      tone(low,{type:p.type,f:f*p.from,f2:p.from!==1?f:0,glide:p.glide,t,peak:pk,att:p.att,dec});
      if(p.harm)tone(low,{type:'sine',f:f*2*p.from,f2:p.from!==1?f*2:0,glide:p.glide,t,peak:pk*p.harm,att:p.att,dec:dec*.6});};}
  return {ensure,unlock,warmAll,stopAll(d=.6){for(const k of Object.keys(loops))stop(k,d);for(const k of Object.keys(tracks))stop(k,d);},play,level,stop,muffle,sfx,felt,voice,toggle,get on(){return on;},get ctx(){return ctx;},tracks,loops};
})();
SND.ensure();
$('#sndBtn').onclick=e=>{e.stopPropagation();const on=SND.toggle(),label=on?'소리 끄기':'소리 켜기';$('#sndBtn').dataset.lAria=label;$('#sndBtn').setAttribute('aria-label',L(label));$('#sndWave').style.display=on?'':'none';$('#sndOff').style.display=on?'none':'';};
if(!SND.on){$('#sndWave').style.display='none';$('#sndOff').style.display='';}
// 다시 들어온 뒤의 첫 누름(로그인 복귀 등)에서도 소리를 깨운다
document.addEventListener('pointerdown',e=>{SND.unlock();if(e.target.closest('button,.opt')&&!e.target.closest('.spot'))SND.felt('tap');},{passive:true});

/* ══ 글자 한 자씩(WORLD 이야기 화면과 같은 규칙: 쉼표 +140ms · 마침표 +230ms · 말줄임 +320ms, 투명도만) ══ */
function typeInto(el,text,{cps=23,who=null,marks=[]}={}){
  return new Promise(res=>{
    el.innerHTML='';const chars=Array.from(text),spans=[];
    let html='';chars.forEach((ch,i)=>{html+=`<span class="c">${ch==='<'?'&lt;':ch}</span>`;});el.innerHTML=html;spans.push(...el.querySelectorAll('.c'));
    const blip=SND.voice(who||'narr',text),base=1000/cps;let k=0,timer=0,done=false;
    const finish=()=>{if(done)return;done=true;clearTimeout(timer);spans.forEach(s=>s.classList.add('on'));
      // 형광펜: 다 나타난 뒤 표시할 낱말을 감싼다
      if(marks.length){let h=el.textContent;for(const m of marks)h=h.replace(m,`<mark class="fresh">${m}</mark>`);el.innerHTML=h;requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll('mark').forEach(x=>x.classList.remove('fresh'))));}
      res();};
    el._finish=finish;
    if(reduce){finish();return;}
    const step=()=>{if(done)return;if(k>=spans.length){finish();return;}spans[k].classList.add('on');blip(k);const ch=chars[k];k++;
      const w=ch===' '?base*.55:ch===','?base+140:'.!?'.includes(ch)?base+230:ch==='…'?base+320:base;timer=setTimeout(step,w);};
    step();
  });
}

/* ══ 컷씬 ══ */
let RUN=0;const SKIP=new Error('skip');
const guard=r=>{if(r!==RUN)throw SKIP;};
let tapWait=null;
function waitTap(ms){return new Promise(res=>{let t=0;const go=()=>{clearTimeout(t);tapWait=null;res();};tapWait=go;if(ms!=null)t=setTimeout(go,ms);});}
$('#s-cut').addEventListener('click',e=>{if(e.target.closest('button'))return;const n=$('#narr'),p=$('#paText');
  if(n._finish&&!n._done){n._finish();return;}if(p._finish&&!p._done){p._finish();return;}if(tapWait)tapWait();});
let layer=0;
const CUT_POS={mirror:'50% 70%'};
function setCut(name,{kb='in',instant=false,hard=false}={}){
  const next=layer?$('#cutA'):$('#cutB'),prev=layer?$('#cutB'):$('#cutA');layer^=1;
  ambient(IMG[name]);const img=next.querySelector('img');img.src=IMG[name];img.getAnimations().forEach(a=>a.cancel());img.style.transform='';img.style.objectPosition=CUT_POS[name]||'';
  if(!reduce&&kb!=='still'){const K={in:['scale(1.0)','scale(1.07) translate(0,-1%)'],out:['scale(1.08)','scale(1.0)'],left:['scale(1.08) translate(1.5%,0)','scale(1.08) translate(-1.5%,0)'],up:['scale(1.06) translate(0,1.5%)','scale(1.06) translate(0,-1.5%)']}[kb];
    img.animate([{transform:K[0]},{transform:K[1]}],{duration:11000,easing:'ease-out',fill:'forwards'});}
  if(instant){next.style.transition='none';if(hard)prev.style.transition='none';next.classList.add('on');prev.classList.remove('on');void next.offsetWidth;next.style.transition='';prev.style.transition='';}
  else{next.classList.add('on');setTimeout(()=>prev.classList.remove('on'),900);}
  return img;
}
// 그림이 풀린 뒤에 컷을 바꾼다
async function cut(name,opt){await ready(name);return setCut(name,opt);}
async function veil(on,{white=false,ms=450}={}){const v=$('#veil');v.classList.toggle('white',white);v.style.transitionDuration=ms+'ms';v.classList.toggle('on',on);await sleep(ms);}
// 이야기 글은 한국어, 그 아래 작은 줄이 화면 언어(한국어 화면이면 없다)
function narrSub(text){const s=$('#narrSub'),v=sub(text);s.classList.remove('out');s.textContent=v;s.hidden=!v;}
async function narrate(r,text,{hold=null,marks=[]}={}){
  guard(r);const n=$('#narr');n.classList.remove('out');n._done=false;narrSub(text);
  await typeInto(n,text,{cps:15,marks});n._done=true;guard(r);
  $('#tapHint').classList.toggle('on',!state.seenHint);
  await waitTap(hold??(1300+text.length*42));guard(r);
  state.seenHint=true;$('#tapHint').classList.remove('on');
  n.classList.add('out');$('#narrSub').classList.add('out');await sleep(380);guard(r);
}
const state={dream:'idol',lights:0,best:{},scenes:[],replayOf:null,prologue:false,seenHint:false,name:null,nameEn:null,sign:null,from:null,call:null,look:null,dreamPicked:false,momSeen:false,momAnswer:null};
function show(id){if(id==='s-path')ambient(IMG[state.dream+'Goal']);else if(id==='s-gate')ambient(IMG.booth);document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));$('#skipBtn').hidden=!(id==='s-cut'&&!state.prologue);}

/* 0 → 1: 입구를 누르면 콘서트가 터지고, 그 화면이 내 방 휴대폰 속이었음이 드러난다 */
async function begin(){
  const t=$('#s-title');if(t.classList.contains('go'))return;t.classList.add('go');
  SND.unlock();SND.warmAll();warm(WARM.first);const el=SND.play('bgm_anthem',{at:ANTHEM_DROP[0]-.04,vol:.95,fade:.05});
  // 번쩍 · 함성 · 박자 깜빡임은 곡이 실제로 울리기 시작한 순간에 맞춘다
  let hit=false;const go=()=>{if(hit)return;hit=true;t.classList.add('hit');SND.sfx('sfx_crowd',.55);};
  if(el){el.addEventListener('playing',go,{once:true});}setTimeout(go,400);
  if(!reduce)$('#titleImg').animate([{transform:'scale(1)'},{transform:`scale(${stageFit().push})`}],{duration:2700,easing:'cubic-bezier(.3,0,.2,1)',fill:'forwards'});
  const r=++RUN;await sleep(2650);if(r!==RUN)return;
  try{await prologue(r);}catch(e){if(e!==SKIP)throw e;}
}
$('#s-title').addEventListener('click',begin);
// 키보드 · 스위치 입력으로도 시작한다(안의 「정문부터」 단추는 제 일을 한다)
$('#s-title').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target===e.currentTarget){e.preventDefault();begin();}});
/* 방 판 자리: 그림(941×1672)을 화면에 덮어 깔고, 휴대폰 화면 사각형이 화면을 꼭 채우는 배율 · 이동을 잰다 */
const RS={l:.3337,t:.2919,w:.3358,h:.3732,ar:941/1672,over:1.06};
function stageFit(){
  const app=$('#app').getBoundingClientRect(),vw=app.width,vh=app.height;let w,h;
  if(vw/vh>RS.ar){w=vw;h=vw/RS.ar;}else{h=vh;w=vh*RS.ar;}
  const st=$('#roomStage'),L=(vw-w)/2,T=(vh-h)/2;Object.assign(st.style,{width:w+'px',height:h+'px',left:L+'px',top:T+'px'});
  const ox=w*(RS.l+RS.w/2),oy=h*(RS.t+RS.h/2);st.style.transformOrigin=`${ox}px ${oy}px`;
  // 휴대폰 화면 사각형이 화면을 덮는 배율(fit)과, 그때 화면 속 그림의 크기에 입구 그림이 닿는 푸시인 배율(push)
  const rw=w*RS.w,rh=h*RS.h,fit=Math.max(vh/rh,vw/rw),title0=Math.max(vw/941,vh/1672),inner0=Math.max(rw/941,rh/1672);
  return {zoom:`translate(${vw/2-(L+ox)}px,${vh/2-(T+oy)}px) scale(${fit*RS.over})`,push:inner0*fit*RS.over/title0};
}
async function prologue(r){
  const st=$('#roomStage'),f=stageFit(),inner=st.querySelector('.screen-in img');
  st.classList.remove('drama','dark');st.classList.add('on');$('#cutA').classList.remove('on');$('#cutB').classList.remove('on');
  st.style.transform=reduce?'none':f.zoom;
  // 입구에서 방으로는 전환 없이 바로 바꾼다 — 같은 그림이 같은 자리에 있어서 이음매가 안 보인다
  for(const id of ['s-title','s-cut'])$('#'+id).style.transition='none';
  show('s-cut');$('#skipBtn').hidden=true;void st.offsetWidth;
  for(const id of ['s-title','s-cut'])$('#'+id).style.transition='';
  // 카메라가 휴대폰에서 멀어지는 동안 곡도 휴대폰 스피커 소리로 바뀐다
  SND.muffle('bgm_anthem',true,2.2);SND.level('bgm_anthem',.55,2.2);SND.play('amb_room',{vol:.8,fade:2.4,bus:'amb'});
  if(!reduce){
    await st.animate([{transform:f.zoom},{transform:'translate(0,0) scale(1)'}],{duration:2300,easing:'cubic-bezier(.65,0,.2,1)',fill:'forwards'}).finished.catch(()=>{});
  }
  guard(r);$('#skipBtn').hidden=false;
  if(!reduce)st.animate([{transform:'translate(0,0) scale(1)'},{transform:'translate(0,0) scale(1.05)'}],{duration:14000,easing:'ease-out',fill:'forwards'});
  await sleep(500);
  await narrate(r,'몇 번을 돌려 봤는지 몰라요.');
  // 둘째 줄과 함께 휴대폰 화면이 무대에서 드라마 한 장면(한강 · 우산)으로 — 배우 갈래의 씨앗
  st.classList.add('drama');
  await narrate(r,'무대 위 노래도, 드라마 속 한 장면도.');
  await narrate(r,'언젠가 꼭, 저 도시에 가 보고 싶었어요.');
  // 휴대폰을 끄고 — 다들 잠든 밤, 거울 앞
  st.classList.add('dark');SND.felt('tap');SND.stop('bgm_anthem',1.4);SND.play('amb_room',{vol:.55,fade:2,bus:'amb'});
  // 다들 잠든 방 — 벽시계 초침이 아주 작게 시작해 9초에 걸쳐 들어온다
  SND.play('amb_clock',{vol:.4,fade:9,bus:'amb'});
  await sleep(reduce?300:1100);guard(r);
  await veil(true,{ms:700});guard(r);
  st.classList.remove('on');await cut('mirror',{kb:'still',instant:true});guard(r);
  await sleep(300);await veil(false,{ms:1100});guard(r);
  await mirrorPart(r);
  await journey(r);
}

/* ══ 꿈 고르기 ══ */
// story = 이야기 안에서 고를 때의 한 줄, line = 꿈을 바꿀 때(이야기 밖)의 설명
const DREAM={
  idol:{ko:'아이돌',title:'무대에 서는 꿈',chip:'아이돌의 꿈',goalEn:'목표',goal:'데뷔 무대',goalSub:'객석이 전부 내 불빛으로 차는 날',
    story:'언젠가 그 무대에 서는 날까지, 여기서부터 시작해요.',
    line:'한국 생활 이야기는 그대로이고, 사이사이 열리는 <em>꿈 장면</em>만 바뀌어요.',
    scenes:['쇼케이스 오디션','2차 오디션','최종 심사','뒤풀이 자리','일정이 바뀐 날','쇼케이스 인터뷰','데뷔 무대 인사'],
    desk:['오디션도, 연습실도, 무대 인사도','전부 한국어로 해야 했어요.'],bag:'연습화랑 이어폰은, 맨 위에.'},
  actor:{ko:'배우',title:'주연으로 서는 꿈',chip:'배우의 꿈',goalEn:'목표',goal:'첫 주연 시사회',goalSub:'레드카펫 끝에 내 이름이 걸리는 날',
    story:'언젠가 주연으로 서는 날까지, 여기서부터 시작해요.',
    line:'한국 생활 이야기는 그대로이고, 사이사이 열리는 <em>꿈 장면</em>만 바뀌어요.',
    scenes:['학생 영화제 오디션','2차 오디션','최종 심사','뒤풀이 자리','일정이 바뀐 날','시사회 간담회','첫 주연 시사회 인사'],
    desk:['오디션도, 대본 리딩도, 무대 인사도','전부 한국어로 해야 했어요.'],bag:'밑줄 친 대본은, 맨 위에.'}
};
function confetti(color){
  if(reduce)return;const c=$('#confetti'),x=c.getContext('2d');const d=devicePixelRatio;c.width=c.offsetWidth*d;c.height=c.offsetHeight*d;
  const P=Array.from({length:120},()=>({x:c.width/2,y:c.height*.42,vx:(Math.random()-.5)*14*d,vy:(-Math.random()*13-4)*d,s:(Math.random()*5+3)*d,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:Math.random()<.5?color:Math.random()<.5?'#fff':'#E9EEF5'}));
  let n=0;(function f(){x.clearRect(0,0,c.width,c.height);for(const p of P){p.vy+=.32*d;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.globalAlpha=Math.max(0,1-n/150);x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore();}if(++n<150)requestAnimationFrame(f);else x.clearRect(0,0,c.width,c.height);})();
}
document.querySelectorAll('.dream').forEach(btn=>btn.addEventListener('click',()=>{
  const s=$('#s-dream');if(s.classList.contains('picked'))return;
  const k=btn.dataset.dream,D=DREAM[k];if(state.prologue&&state.prevDream==null)state.prevDream=state.dream;state.dream=k;document.body.dataset.dream=k;
  btn.classList.add('chosen');s.dataset.pick=k;s.classList.add('picked');
  const fl=$('#flash');fl.classList.remove('go');void fl.offsetWidth;fl.classList.add('go');
  confetti(getComputedStyle(document.body).getPropertyValue('--dream'));
  // 꿈을 고르는 순간 휴대폰 속 소리가 방을 채운다
  SND.felt('reward');SND.sfx('pix_sparkle',.6);
  if(!state.prologue){const r=RUN;SND.muffle('bgm_anthem',false,.5);SND.level('bgm_anthem',.9,.4);setTimeout(()=>{if(r===RUN)SND.level('bgm_anthem',.5,2.4);},2600);}
  $('#sheetEn').textContent=L(D.ko);$('#sheetTitle').textContent=L(D.title);
  // 이야기 안에서는 이야기 한 줄만, 꿈 바꾸기에서는 무엇이 바뀌는지와 꿈 장면
  $('#sheetLine').innerHTML=state.prologue?L(D.line):L(D.story);
  $('#sheetChips').innerHTML=state.prologue?[...D.scenes.slice(0,3),D.goal].map(t=>`<span>${L(t)}</span>`).join(''):'';
  $('#goPath').textContent=state.prologue?L('이 꿈으로 바꾸기'):L('이 꿈을 안고 출발');
  setTimeout(()=>{$('#sheet').classList.add('on');SND.felt('open');},reduce?0:650);
}));
function unpick(){const s=$('#s-dream');$('#sheet').classList.remove('on');s.classList.remove('picked');document.querySelectorAll('.dream').forEach(b=>b.classList.remove('chosen'));}
$('#rePick').onclick=()=>{unpick();if(!state.prologue){SND.level('bgm_anthem',.55,.8);SND.muffle('bgm_anthem',true,.8);}};
let leaving=false;
$('#goPath').onclick=async()=>{
  if(leaving)return;leaving=true;setTimeout(()=>{leaving=false;},1500);
  if(state.prologue){state.prevDream=null;save({dream:state.dream});warm(WARM.road(state.dream));$('#s-dream').classList.remove('change');buildRoad();show('s-path');setTimeout(unpick,600);momMaybe();return;}
  const r=++RUN;try{await journey(r);}catch(e){if(e!==SKIP)throw e;}
};
$('#closeDream').onclick=e=>{e.stopPropagation();if(state.prevDream!=null){state.dream=state.prevDream;document.body.dataset.dream=state.dream;state.prevDream=null;}$('#s-dream').classList.remove('change');unpick();buildRoad();show('s-path');momMaybe();};

/* ══ 거울 앞: 꿈이 생기는 순간(결정 11-03) ══
 * 「어떤 꿈이었나요?」라고 묻는 대신, 다들 잠든 밤 거울 앞 서랍장 위에 몰래 꺼내 보던 물건 둘 중 하나를 누른다:
 * 연습화와 이어폰 = 아이돌, 밑줄 친 대본 = 배우. 고른 물건은 가방 맨 위에 다시 나온다. 색종이 대신 그 물건에만 불빛이 남는다.
 * 고르기 칸 자리는 거울 그림(941×1672)에서 잰 비율이고, 컷 그림과 같은 cover · 위치(가로 50% · 세로 70%) 계산으로 화면에 놓는다. */
const MIRROR={"idol":{"x":0.277,"y":0.679,"w":0.38,"h":0.17},"actor":{"x":0.728,"y":0.697,"w":0.44,"h":0.16}};
const MIRROR_LINE={idol:'거울 앞이, 내 첫 연습실이었어요.',actor:'거울 앞이, 내 첫 촬영장이었어요.'};
function mirrorFit(){
  const s=$('#s-cut').getBoundingClientRect(),iw=941,ih=1672,k=Math.max(s.width/iw,s.height/ih),ox=(s.width-iw*k)/2,oy=(s.height-ih*k)*.7;
  for(const b of document.querySelectorAll('.mr-pick')){const m=MIRROR[b.dataset.dream];
    Object.assign(b.style,{left:ox+(m.x-m.w/2)*iw*k+'px',top:oy+(m.y-m.h/2)*ih*k+'px',width:m.w*iw*k+'px',height:m.h*ih*k+'px'});}
  const c=document.querySelector('.mr-pick.chosen');
  if(c){const m=MIRROR[c.dataset.dream],box=$('#mirror');box.style.setProperty('--mx',ox+m.x*iw*k+'px');box.style.setProperty('--my',oy+m.y*ih*k+'px');box.style.setProperty('--mr',Math.max(m.w*iw*k,m.h*ih*k)*.62+'px');}
}
// 시트가 올라오면 고른 물건이 시트에 가리지 않게 그림과 불빛을 함께 올린다(위로 넘치지는 않게)
function mirrorLift(on){
  const sc=$('#s-cut'),c=document.querySelector('.mr-pick.chosen');
  if(!on||!c){sc.classList.remove('mr-up');return;}
  // 올리기 전 좌표(mirrorFit이 넣은 top · height)로 잰다 — 화면에 보이는 자리는 이미 올라가 있어 다시 재면 번갈아 뒤집힌다
  const s=sc.getBoundingClientRect(),y0=parseFloat(c.style.top),y1=y0+parseFloat(c.style.height),top=s.height-$('#mrSheet').offsetHeight+40;
  const up=Math.min(Math.max(0,y1-top),Math.max(0,y0-12));
  sc.style.setProperty('--mrUp',up+'px');sc.classList.add('mr-up');
}
addEventListener('resize',()=>{if($('#mirror').classList.contains('on')){mirrorFit();if($('#s-cut').classList.contains('mr-up'))mirrorLift(true);}});
async function mirrorPart(r,{intro=true}={}){
  const box=$('#mirror'),hint=$('#mrHint'),sheet=$('#mrSheet'),picks=[...document.querySelectorAll('.mr-pick')];
  box.classList.remove('lit','done');picks.forEach(b=>b.classList.remove('chosen'));sheet.classList.remove('on');mirrorLift(false);
  if(intro){await sleep(500);guard(r);await narrate(r,'다들 잠든 밤이면,',{hold:1000});await narrate(r,'몰래 꺼내 보는 게 있었어요.',{hold:1000});}
  mirrorFit();box.classList.add('on');hint.classList.add('on');$('#skipBtn').hidden=true;
  for(;;){
    const k=await new Promise(res=>picks.forEach(b=>b.onclick=e=>{e.stopPropagation();res(b.dataset.dream);}));guard(r);
    picks.forEach(b=>b.onclick=null);
    const D=DREAM[k],b=picks.find(x=>x.dataset.dream===k);state.dream=k;document.body.dataset.dream=k;
    b.classList.add('chosen');mirrorFit();box.classList.add('lit');hint.classList.remove('on');SND.felt('heart');
    $('#mrEn').textContent=L(D.ko);$('#mrTitle').textContent=L(D.title);$('#mrLine').textContent=L(D.story);
    await sleep(reduce?0:700);guard(r);sheet.classList.add('on');box.classList.add('ask');mirrorLift(true);SND.felt('open');$('#mrGo').focus({preventScroll:true});
    const go=await new Promise(res=>{$('#mrGo').onclick=e=>{e.stopPropagation();res(true);};$('#mrBack').onclick=e=>{e.stopPropagation();res(false);};});guard(r);
    sheet.classList.remove('on');box.classList.remove('ask');mirrorLift(false);
    if(go){state.dreamPicked=true;save({stage:'dream',dream:state.dream});warm(WARM.story(state.dream));fillLazy();warmLooks();break;}
    box.classList.remove('lit');b.classList.remove('chosen');hint.classList.add('on');b.focus({preventScroll:true});
  }
  box.classList.add('done');SND.felt('select');
  await narrate(r,MIRROR_LINE[state.dream],{hold:1400});
  box.classList.remove('on','lit','done');
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#mrSheet').classList.contains('on')){e.preventDefault();$('#mrBack').click();}});

/* 13판 서울의 첫 아침(11-04 유호님 「활기찬 곡으로 바뀌는데 너무 빨리 지나가 아쉽다 — 5~10초라도 이 노래와 설렘을 느끼게」):
 * 「안녕, 서울.」 드롭 뒤 테마 곡의 마디에 맞춰 2마디째 서울역 개찰구 → 5마디째 학교 가는 버스 → 8마디째(마디 묶음 끝) 정문으로 끊어 간다.
 * 개찰구에서는 드라마에서 듣던 교통카드 「삑」, 버스 창밖 간판에서는 책상에서 처음 써 본 「가」를 알아본다.
 * 누를 자리(리더기 · 간판의 「가」)는 눌러도 되고, 안 누르면 그 마디에 저절로 — 박자는 곡의 재생 시각으로 맞추고, 곡이 멈춰 있으면 시계로 간다. */
const BAR=.47*4;
// r(RUN)이 바뀌면(건너뛰기) 기다림도 바로 끝낸다 — 그 마디까지 rAF가 돌지 않게
function atBar(el,t0,n,r){const target=ANTHEM_DROP[1]+n*BAR,wall=t0+n*BAR*1000;
  return new Promise(res=>{(function f(){const now=performance.now(),live=el&&!el.paused&&el.readyState>=3&&el.currentTime>ANTHEM_DROP[1]-3;
    if((r!=null&&r!==RUN)||(live?el.currentTime>=target-.03:now>=wall)||now>=wall+1500)return res();requestAnimationFrame(f);})();});}
function chip(title,when){const p=$('#place'),s=sub(title);p.innerHTML=`<b>${title}</b><span>${s?s+' · ':''}${L(when)}</span>`;p.classList.add('on');}
// 누를 자리: 그림(941×1672) 안의 비율 — 컷 그림과 같은 cover 계산으로 화면에 놓는다
const SPOTS={tmoney:{x:.340,y:.524,w:.37,h:.154,kind:'reader',label:'교통카드 찍기'},bus:{x:.4835,y:.4193,w:.15,h:.085,kind:'glyph',label:'간판의 ‘가’ 누르기'}};
function spotOn(name){
  const S=SPOTS[name],sp=$('#spot'),b=$('#s-cut').getBoundingClientRect(),k=Math.max(b.width/941,b.height/1672),dx=(b.width-941*k)/2,dy=(b.height-1672*k)/2;
  Object.assign(sp.style,{left:dx+S.x*941*k+'px',top:dy+S.y*1672*k+'px',width:S.w*941*k+'px',height:S.h*1672*k+'px'});
  sp.className='spot '+S.kind;sp.setAttribute('aria-label',L(S.label));sp.hidden=false;void sp.offsetWidth;sp.classList.add('on');
  return new Promise(res=>{sp.onclick=e=>{e.stopPropagation();sp.onclick=null;res(true);};});
}
function spotOff(){const sp=$('#spot');sp.onclick=null;sp.classList.remove('on','hit');setTimeout(()=>{if(!sp.classList.contains('on'))sp.hidden=true;},260);}
// 마디를 타는 속마음 한 줄 — 기다리지 않는다(앞 줄이 아직 나오는 중이면 끝까지 보여 주고 바꾼다)
function beatLine(text){const n=$('#narr');if(n._finish&&!n._done)n._finish();n.classList.remove('out');n._done=false;narrSub(text);return typeInto(n,text,{cps:18}).then(()=>{n._done=true;});}
async function seoulMorning(r,el,t0){
  const sp=$('#spot'),n=$('#narr');
  // 서울역 개찰구: 교통카드 「삑」 — 누르면 바로, 안 누르면 3마디 첫 박에(고리를 알아보고 누를 틈 1.9초 —
  SND.stop('amb_train',.6);setCut('tmoney',{kb:'still',instant:true,hard:true});chip('서울역','오전 8시 12분');
  let tap=spotOn('tmoney');
  await Promise.race([tap,atBar(el,t0,3,r)]);guard(r);
  sp.classList.add('hit');SND.felt('beep');
  await sleep(380);guard(r);beatLine('드라마에서만 듣던 그 소리.');
  await atBar(el,t0,5,r);guard(r);
  // 학교 가는 버스: 창밖 간판에서 아는 글자 — 책상에서 처음 써 본 「가」.
  // 「어? 저 글자, 나 아는데.」가 다 나온 뒤에 「가」 고리를 켠다(먼저 누르면 그 줄을 읽을 틈이 없었다 —
  spotOff();n.classList.add('out');$('#narrSub').classList.add('out');
  setCut('bus',{kb:'still',instant:true,hard:true});chip('학교 가는 버스','오전 8시 40분');
  await sleep(250);guard(r);await beatLine('어? 저 글자, 나 아는데.');guard(r);
  await sleep(350);guard(r);tap=spotOn('bus');
  await Promise.race([tap,atBar(el,t0,6.5,r)]);guard(r);
  sp.classList.add('hit');SND.felt('reward');
  await sleep(300);guard(r);beatLine('‘가’. 밤마다 쓰던 바로 그 글자.');
  await atBar(el,t0,8,r);guard(r);
  spotOff();n.classList.add('out');$('#narrSub').classList.add('out');$('#place').classList.remove('on');
}
/* 2: 유학 준비 · 한국어 → 합격 → 짐 → 기내 방송 → 한강의 「안녕」 → 정문 */
async function journey(r){
  const D=DREAM[state.dream];$('#roomStage').classList.remove('on');
  SND.stop('bgm_anthem',1.6);SND.stop('amb_room',1.6);SND.stop('amb_clock',1.6);SND.sfx('pix_whoosh_cinematic',.4);
  await veil(true,{ms:700});guard(r);setTimeout(unpick,300);
  $('#narr').innerHTML='';$('#narrSub').hidden=true;await cut('desk_'+state.dream,{kb:'in',instant:true});guard(r);show('s-cut');
  SND.play('bgm_journey',{at:0,vol:.8,fade:1.2});SND.play('amb_dawn',{vol:.7,fade:2,bus:'amb'});
  await sleep(500);await veil(false,{ms:1100});guard(r);
  await narrate(r,D.desk[0]);
  await narrate(r,D.desk[1]);
  await narrate(r,'한국에서 오디션을 보려면, 먼저 한국에 가야 했어요.');
  await narrate(r,'그래서 유학을 준비했어요.');
  await narrate(r,'엄마한테는, 공부하러 간다고만 했어요.');
  await narrate(r,'한국어는 매일 밤, 한 줄씩.');
  await traceGa(r);
  await narrate(r,'가, 나, 다… 그렇게 밤마다.',{hold:1500});
  await sleep(400);guard(r);
  banner('mail');SND.sfx('pix_notification',.7);
  await sleep(1600);guard(r);
  await narrate(r,'그리고 봄을 앞둔 어느 새벽.',{hold:1700});
  await narrate(r,'합격이었어요.',{hold:2200});
  $('#banner').classList.remove('on');
  // 짐
  SND.stop('amb_dawn',1.5);await cut('bag_'+state.dream,{kb:'out'});guard(r);await sleep(900);guard(r);
  await narrate(r,'짐은 가방 하나.');
  await narrate(r,D.bag,{hold:1200});
  SND.sfx('sfx_zip',.8);await sleep(1500);guard(r);
  // 떠나기 전날 밤 — 엄마가 앞주머니에
  await cut('mom',{kb:'in'});guard(r);SND.play('amb_room',{vol:.45,fade:1.5,bus:'amb'});SND.level('bgm_journey',.6,2);await sleep(1000);guard(r);
  await narrate(r,'떠나기 전날 밤, 엄마가 가방 앞주머니에 뭔가를 넣었어요.');
  await narrate(r,'모른 척했어요.',{hold:1900});
  // 출국장 — 돌아보지 않았다, 그리고 메시지
  SND.stop('amb_room',1.2);await cut('airport',{kb:'out'});guard(r);SND.play('amb_airport',{vol:.75,fade:1.5,bus:'amb'});SND.level('bgm_journey',.75,2);await sleep(1000);guard(r);
  await narrate(r,'공항에서는 뒤돌아보지 않았어요. 돌아보면 못 갈 것 같아서.');
  SND.felt('buzz');await sleep(350);guard(r);banner('mom');await sleep(1700);guard(r);
  await narrate(r,'엄마 목소리였어요. “앞주머니 열어 봐.”',{hold:1800});
  $('#banner').classList.remove('on');
  await narrate(r,'쪽지 한 장.',{hold:900});
  await narrate(r,'엄마가 번역기를 보며 한 글자씩 따라 그린 한글이었어요.',{hold:1500});
  SND.felt('page');$('#note').classList.add('on');$('#tapHint').classList.add('on');narrSub('도착하면 전화해. 밥 잘 먹어. 사랑해.');$('#narr').innerHTML='';
  // 엄마의 쪽지는 가장 감정적인 장면이라 읽을 만큼 둔다(누르면 넘어감 —
  await waitTap(9000);guard(r);$('#tapHint').classList.remove('on');$('#note').classList.remove('on');$('#narrSub').hidden=true;await sleep(400);guard(r);
  SND.stop('amb_airport',1.2);
  // 하늘
  SND.sfx('pix_whoosh_cinematic',.45);await veil(true,{ms:600});guard(r);
  await cut('plane',{kb:'up',instant:true});guard(r);SND.play('amb_cabin',{vol:.85,fade:1.2,bus:'amb'});SND.level('bgm_journey',.6,1.5);
  await veil(false,{ms:900});guard(r);await sleep(700);guard(r);
  SND.felt('chime');await sleep(1300);guard(r);
  $('#pa').classList.add('on');const p=$('#paText');p._done=false;
  $('#paSub').textContent=sub('손님 여러분, 우리 비행기는 잠시 후 인천국제공항에 도착하겠습니다.');$('#paSub').hidden=!$('#paSub').textContent;
  await typeInto(p,'손님 여러분, 우리 비행기는 잠시 후 인천국제공항에 도착하겠습니다.',{cps:17,marks:['도착']});p._done=true;guard(r);
  await sleep(900);guard(r);
  await narrate(r,'엄마 쪽지에 있던 그 말, ‘도착’.',{hold:1800,marks:['도착']});
  await narrate(r,'자막 없이 처음 알아들은 한국어였어요.',{hold:2600});
  $('#pa').classList.remove('on');
  // 입국심사 — 처음으로 한국어로 말이 통한다
  await veil(true,{ms:600});guard(r);SND.stop('amb_cabin',.6);
  await cut('immigration',{kb:'in',instant:true});guard(r);SND.play('amb_hall',{vol:.7,fade:1,bus:'amb'});SND.level('bgm_journey',.4,1.5);
  await veil(false,{ms:900});guard(r);await sleep(500);guard(r);
  await immigration(r);
  $('#vn').className='vn';SND.level('bgm_journey',.85,2);
  await narrate(r,'처음으로, 한국어로 말이 통했어요.',{hold:2200});
  SND.stop('amb_hall',1.6);
  // 서울 — 휴대폰 속 그 강가가 창밖에. 상승음 정점(2.2초)이 하얀 번쩍임에 오게
  SND.sfx('pix_riser',.4);await sleep(1500);guard(r);
  await veil(true,{white:true,ms:700});guard(r);
  await cut('train',{kb:'left',instant:true});guard(r);SND.play('amb_train',{vol:.75,fade:.8,bus:'amb'});
  await veil(false,{white:true,ms:1300});guard(r);
  await narrate(r,'화면 속 그 강가가,',{hold:900});
  await narrate(r,'창밖에 있었어요.',{hold:600});
  // 드롭 2.1초 전부터 테마를 다시 틀어 「안녕, 서울.」을 드롭에 앉힌다(t0 = 드롭의 시계 시각 — 곡이 멈춰 있으면 마디를 이걸로 센다)
  SND.stop('bgm_journey',2.2);const pre=2.1,el=SND.play('bgm_anthem',{at:ANTHEM_DROP[1]-pre,vol:.9,fade:.8}),t0=performance.now()+pre*1000;SND.muffle('bgm_anthem',false,.05);
  // 「안녕,」은 0.2초, 「서울.」은 0.28초에 앉는다 — 0.3초 먼저 띄워 둘째 낱말 · 빛 · 베이스 한 방이 드롭에 함께 오게
  await sleep(pre*1000-360);guard(r);const bt=$('#bigTitle');bt.classList.remove('lit');bt.classList.add('on');
  if(reduce)bt.classList.add('lit');else setTimeout(()=>{if(bt.classList.contains('on'))bt.classList.add('lit');},300);
  await sleep(300);guard(r);SND.sfx('pix_impact_bass_1',.5);SND.sfx('sfx_crowd',.25);
  // 13판: 드롭 뒤 두 마디는 「안녕, 서울.」, 이어서 서울의 첫 아침(개찰구 · 버스)을 곡의 마디에 맞춰
  await atBar(el,t0,2,r);guard(r);bt.classList.remove('on','lit');
  await seoulMorning(r,el,t0);
  // 정문 — 곡은 그대로 이어지다 「그런데…」에서 뚝 끊긴다(설렘에서 현실로 한 박)
  await cut('gate',{kb:'in',instant:true,hard:true});guard(r);SND.sfx('sfx_walk',.6);chip('새솔대학교 정문','기숙사 들어가는 날 · 오전 9시');
  await sleep(1500);guard(r);
  await narrate(r,'오늘부터, 여기가 내 학교.',{hold:1600});
  $('#place').classList.remove('on');
  SND.stop('bgm_anthem',.3);SND.play('amb_campus',{vol:.6,fade:.8,bus:'amb'});
  await narrate(r,'그런데… 기숙사가 어느 쪽이지?',{hold:1300});
  SND.play('bgm_campus',{at:0,vol:.5,fade:2.5});SND.play('amb_campus',{vol:.8,fade:1.5,bus:'amb'});
  await gate(r);
}
/* 엄마의 쪽지: 한글을 막 배운 사람의 글씨처럼 글자마다 조금씩 기울고 크기 · 높이가 들쭉날쭉(새 글꼴 없이) */
(()=>{const p=$('#noteText');if(!p)return;let seed=7;const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
  p.innerHTML=p.textContent.split('\n').map(line=>Array.from(line).map(ch=>ch===' '?' ':`<i style="transform:translateY(${(rnd()*4-2).toFixed(1)}px) rotate(${(rnd()*8-4).toFixed(1)}deg);font-size:${(19+rnd()*3).toFixed(1)}px;margin-right:${(rnd()*2).toFixed(1)}px">${ch}</i>`).join('')).join('<br>');})();
/* 알림 카드 두 가지 */
function banner(kind){
  const B={mail:{icon:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>',cls:'',app:L('메일'),title:'새솔대학교 입학처',body:'[합격] 2027학년도 봄학기 국제학부 입학을 축하합니다.'},
    mom:{icon:'<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 4C7 4 3 7.2 3 11.2c0 2.3 1.3 4.3 3.4 5.6L5.6 20l3.9-2.1c.8.2 1.6.3 2.5.3 5 0 9-3.2 9-7S17 4 12 4z"/></svg>',cls:'msg',app:L('메시지'),title:L('엄마'),body:L('음성 메시지 · 0:06')}}[kind];
  const i=$('#bnIcon');i.className=B.cls;i.innerHTML=B.icon;$('#bnApp').textContent=B.app;$('#bnTitle').textContent=B.title;$('#bnBody').textContent=B.body;$('#bnSub').textContent=kind==='mail'&&sub(B.body)?sub(B.title)+' · '+sub(B.body):'';$('#bnSub').hidden=!$('#bnSub').textContent;
  $('#banner').classList.add('on');
}
/* 책상: 「가」 따라 쓰기 — ㄱ · ㅏ를 각각 얼마나 덮었는지와 글자 밖으로 얼마나 나갔는지로 본다.
 * 8판까지는 획 길이가 칸의 1.1배만 넘으면 끝나, ㄱ 한 획을 길게 그어도 다음 장면으로 넘어갔다(11-03 유호님 「다 쓰지도 않았는데 넘어가져」).
 * 이제 둘 다 덮고 펜(손가락 · 펜슬)을 뗀 뒤 0.7초 동안 새 획이 없을 때 끝난다. 안내 글자를 같은 캔버스 글꼴로 그려 표본과 자리가 꼭 맞는다.
 * 13판(11-04 유호님 「처음 본 사람은 그림 그리듯 할 텐데 — 쓰는 순서 · 방향을 깔끔하게」 · 「손이라는 말은 빼 줘 — 펜슬 쓰는 사람도 있다」):
 * 글자 표본에서 획마다 가운데 선을 찾아, 칸이 열리면 붉은 펜이 1 · 2 · 3 순서로 한 번 써 보이고, 그다음엔 지금 쓸 획만 점선 길 · 번호 · 움직이는 펜촉으로 짚는다.
 * 순서를 어겨도 막지 않는다 — 쓴 획은 쓴 것으로 치고 안내는 아직 안 쓴 가장 앞 획으로 옮긴다(엄격한 관문은 스트레스). 거꾸로 그은 획은 한 번 알려만 준다.
 * 펜으로 쓰는 동안(마지막 펜 닿음에서 2.5초 안)은 손바닥 · 손가락 닿음을 잉크로 치지 않는다 — 펜슬을 쥔 손이 칸에 닿아도 헛선이 안 생기고, 펜을 내려놓으면 손가락으로도 쓴다. */
const SO_TIP=['ㄱ — 오른쪽으로 긋고, 꺾어 내려요','ㅣ — 위에서 아래로','짧은 선 — 왼쪽에서 오른쪽으로'];
const SO_REV=['ㄱ은 왼쪽 위에서 시작해요','ㅣ는 위에서 아래로 써요','짧은 선은 왼쪽에서 오른쪽으로 써요'];
function traceGa(r){return new Promise(async res=>{
  const box=$('#trace'),pad=$('#tracePad'),cv=$('#traceInk'),x=cv.getContext('2d'),gc=$('#traceGuide'),hint=$('#traceHint'),so=$('#traceOrder'),HINT=L('번호 순서대로 ‘가’를 써 보세요');
  box.classList.remove('done');hint.textContent=HINT;
  const d=devicePixelRatio||1;let last=null,lastT=0,done=false,W=0,lw=10,timer=0,glyph=[],split=0,stubX=0,strokes=[],cur=null,pid=null,ptype='',penT=-1e9;
  let SP=[],soLen=[],soCur=0,soFoc=-1,soDone=[false,false,false],soRaf=0,demoRun=0,demoing=true,demoStarted=false,revT=0;const revShown=[false,false,false];
  const FONT=w=>`500 ${Math.round(w*.64)}px ${getComputedStyle(document.body).fontFamily}`;
  try{await document.fonts.load(FONT(300),'가');}catch{}
  function redraw(){x.setTransform(d,0,0,d,0,0);x.lineCap='round';x.lineJoin='round';x.lineWidth=lw;x.strokeStyle='#1d2333';x.clearRect(0,0,W,W);
    for(const s of strokes){x.beginPath();s.forEach(([u,v],i)=>i?x.lineTo(u*W,v*W):x.moveTo(u*W,v*W));if(s.length===1)x.lineTo(s[0][0]*W+.1,s[0][1]*W);x.stroke();}}
  function fit(){
    W=pad.offsetWidth;lw=Math.max(9,W*.05);   // 배치 크기로 잰다 — 칸이 커지며 나타나는 동안(scale .96)의 화면 크기로 재면 글자 표본과 그림이 어긋난다
    for(const c of [cv,gc]){c.width=Math.round(W*d);c.height=Math.round(W*d);}
    const g=gc.getContext('2d');g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,W,W);g.font=FONT(W);g.textAlign='center';g.textBaseline='alphabetic';g.fillStyle='#1d2333';
    const m=g.measureText('가');g.fillText('가',W/2,W/2+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2);
    // 표본: 글자 안의 점(3px 간격, 화면 px 좌표)
    const a=g.getImageData(0,0,gc.width,gc.height).data,st=Math.max(1,Math.round(3*d));glyph=[];
    for(let yy=0;yy<gc.height;yy+=st)for(let xx=0;xx<gc.width;xx+=st)if(a[(yy*gc.width+xx)*4+3]>140)glyph.push([xx/d,yy/d]);
    // ㄱ · ㅏ 가르기: 글자 가운데쯤에서 가장 넓은 빈 세로 띠
    const xs=glyph.map(p=>p[0]),x0=Math.min(...xs),x1=Math.max(...xs),n=Math.ceil(x1-x0)+1,cols=new Array(n).fill(0);for(const v of xs)cols[Math.round(v-x0)]++;
    let best=-1,bl=0;for(let i=Math.round(n*.35);i<Math.round(n*.85);i++){if(!cols[i]){let j=i;while(j<n&&!cols[j])j++;if(j-i>bl){bl=j-i;best=i+(j-i)/2;}i=j;}}
    split=x0+(best>0?best:n*.6);
    // ㅏ의 짧은 가로선: 오른쪽에서 가장 촘촘한 세로줄(ㅣ)보다 오른쪽 — 「기」(ㄱ+ㅣ)가 「가」로 통과하지 않게 따로 본다
    {const rc={};for(const [gx] of glyph)if(gx>=split){const k=Math.round(gx);rc[k]=(rc[k]||0)+1;}const vx=+Object.entries(rc).sort((a,b)=>b[1]-a[1])[0][0];stubX=vx+lw*.9;}
    SP=lines();soBuild();redraw();if(demoing&&demoStarted)soDemo();
  }
  // 획의 가운데 선(칸 px): 표본 점을 줄 · 칸으로 묶어 굵은 띠의 가운데를 잇는다 — 글꼴이 바뀌어도 글자 위에 꼭 맞는다
  function lines(){
    const L=glyph.filter(p=>p[0]<split),Rt=glyph.filter(p=>p[0]>=split);
    const bin=(a,key)=>{const m=new Map();for(const p of a){const k=Math.round(p[key]/3);let o=m.get(k);if(!o)m.set(k,o=[]);o.push(p[1-key]);}return m;};
    // ㄱ 가로: 위쪽 35% 안에서 점이 가장 많은 줄들(가장 많은 줄의 60% 이상)
    const lr=bin(L,1),lk=[...lr.keys()],k0=Math.min(...lk),k1=Math.max(...lk);
    const top=[...lr].filter(([k])=>k<=k0+(k1-k0)*.35),mx=Math.max(...top.map(([,v])=>v.length)),bar=top.filter(([,v])=>v.length>=mx*.6);
    const ty=bar.reduce((s,[k])=>s+k*3,0)/bar.length,barB=Math.max(...bar.map(([k])=>k)),bx0=Math.min(...bar.flatMap(([,v])=>v));
    // ㄱ 내림: 가로 아래 줄마다 띠의 가운데(두 줄씩 묶고 앞뒤를 고르게)
    const raw=[];for(let k=barB+1;k<=k1;k++){const v=[...(lr.get(k)||[]),...(lr.get(k+1)||[])];if(v.length)raw.push([(Math.min(...v)+Math.max(...v))/2,k*3+1.5]);}
    const desc=raw.map((p,i)=>{const q=raw.slice(Math.max(0,i-2),i+3);return [q.reduce((s,a)=>s+a[0],0)/q.length,p[1]];}).filter((_,i,a)=>i%2===0||i===a.length-1);
    const cx=desc.length?desc[0][0]:bx0+lw;
    const s1=[[bx0+lw*.45,ty],[cx,ty],...desc.slice(1)];const e1=s1[s1.length-1];e1[1]-=lw*.35;
    // ㅣ: 오른쪽에서 점이 가장 많은 칸들의 가운데
    const rc=bin(Rt,0),mc=Math.max(...[...rc.values()].map(v=>v.length)),vcol=[...rc].filter(([,v])=>v.length>=mc*.6);
    const vx=vcol.reduce((s,[k])=>s+k*3,0)/vcol.length,vy=vcol.flatMap(([,v])=>v),vy0=Math.min(...vy),vy1=Math.max(...vy);
    // 짧은 가로선: ㅣ 오른쪽에서 점이 가장 많은 줄들
    const sr=bin(Rt.filter(p=>p[0]>vx+lw*.75),1),ms=Math.max(...[...sr.values()].map(v=>v.length)),srow=[...sr].filter(([,v])=>v.length>=ms*.6);
    const sy=srow.reduce((s,[k])=>s+k*3,0)/srow.length,sx1=Math.max(...srow.flatMap(([,v])=>v));
    return [s1,[[vx,vy0+lw*.45],[vx,vy1-lw*.45]],[[vx+lw*.3,sy],[sx1-lw*.4,sy]]];
  }
  const NS='http://www.w3.org/2000/svg',dstr=pts=>pts.map(([a,b],i)=>(i?'L':'M')+a.toFixed(1)+' '+b.toFixed(1)).join('');
  function arrowD(pts){const [ex,ey]=pts[pts.length-1];let j=pts.length-2;while(j>0&&Math.hypot(ex-pts[j][0],ey-pts[j][1])<8)j--;const [px,py]=pts[Math.max(0,j)],t=Math.atan2(ey-py,ex-px),a=7;
    const tx=ex+Math.cos(t)*3,ty=ey+Math.sin(t)*3;return `M${(tx-a*Math.cos(t-.55)).toFixed(1)} ${(ty-a*Math.sin(t-.55)).toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}L${(tx-a*Math.cos(t+.55)).toFixed(1)} ${(ty-a*Math.sin(t+.55)).toFixed(1)}`;}
  // 번호: 획이 시작하는 곳 바로 바깥(ㄱ은 왼쪽, ㅣ는 위, 짧은 선은 오른쪽 위) — 획을 가리지 않게(짧은 선은 ㅣ에서 더 떼어 —
  const badgeAt=(i,[sx,sy])=>{const o=[[-15,0],[0,-16],[24,-22]][i],cl=v=>Math.min(W-11,Math.max(11,v));return [cl(sx+o[0]),cl(sy+o[1])];};
  function soBuild(){
    so.setAttribute('viewBox',`0 0 ${W} ${W}`);so.innerHTML='';
    SP.forEach(pts=>{const g=document.createElementNS(NS,'g');g.setAttribute('class','so-s');
      g.innerHTML=`<path class="so-route" d="${dstr(pts)}"/><path class="so-run" d="${dstr(pts)}" style="stroke-width:${(lw*.42).toFixed(1)}px"/><path class="so-arrow" d="${arrowD(pts)}"/>`;so.appendChild(g);});
    const nib=document.createElementNS(NS,'circle');nib.setAttribute('class','so-nib');nib.setAttribute('r','5.5');so.appendChild(nib);
    SP.forEach((pts,i)=>{const [bx,by]=badgeAt(i,pts[0]),o=document.createElementNS(NS,'g');o.setAttribute('transform',`translate(${bx.toFixed(1)} ${by.toFixed(1)})`);
      o.innerHTML=`<g class="so-badge"><circle r="9.5"/><text y=".6">${i+1}</text></g>`;so.appendChild(o);});
    soLen=[...so.querySelectorAll('.so-run')].map(p=>p.getTotalLength());
    if(!demoing)soShow(true);
  }
  // 지금 쓸 획: 점선 길 + 끝 화살 + 처음부터 끝까지 가는 펜촉(1.1초 쓰고 0.65초 쉼). 동작 줄이기면 펜촉 없이 길 · 화살만
  function soLoop(i){
    cancelAnimationFrame(soRaf);soFoc=i;const nib=so.querySelector('.so-nib');if(!nib)return;
    so.querySelectorAll('.so-run').forEach(p=>{p.style.opacity=0;});nib.style.opacity=0;
    if(reduce||done||demoing||i<0)return;
    const run=so.querySelectorAll('.so-run')[i],L=soLen[i],T=1100,P=650,t0=performance.now();run.style.strokeDasharray=`${L} ${L}`;
    (function f(t){if(done||demoing||soFoc!==i)return;const k=(t-t0)%(T+P),u=Math.min(1,k/T),e=u<.5?2*u*u:1-Math.pow(-2*u+2,2)/2,pt=run.getPointAtLength(e*L),fade=k>T?1-(k-T)/P:1;
      nib.setAttribute('cx',pt.x.toFixed(1));nib.setAttribute('cy',pt.y.toFixed(1));nib.style.opacity=fade;run.style.strokeDashoffset=(L*(1-e)).toFixed(1);run.style.opacity=(.75*fade).toFixed(3);
      soRaf=requestAnimationFrame(f);})(t0);
  }
  function soShow(quiet,focus){
    soCur=soDone.indexOf(false);const f=focus??soCur;
    so.querySelectorAll('.so-s').forEach((g,i)=>g.classList.toggle('cur',i===f));
    so.querySelectorAll('.so-badge').forEach((b,i)=>{b.classList.add('show');b.classList.toggle('cur',i===soCur);b.classList.toggle('done',soDone[i]);});
    if(!quiet&&soCur>=0)tip(soCur);
    soLoop(f);
  }
  const tip=(i,t)=>{hint.innerHTML=`<b class="so-n">${i+1}</b>${L(t||SO_TIP[i])}`;};
  // 처음 한 번(과 「획순 보기」): 붉은 펜이 1 · 2 · 3을 차례로 써 보인다. 쓰기 시작하면 바로 멈춘다
  async function soDemo(){
    const my=++demoRun;demoing=true;demoStarted=true;cancelAnimationFrame(soRaf);clearTimeout(revT);
    const runs=[...so.querySelectorAll('.so-run')],badges=[...so.querySelectorAll('.so-badge')],nib=so.querySelector('.so-nib');nib.style.opacity=0;
    so.querySelectorAll('.so-s').forEach(g=>g.classList.remove('cur'));badges.forEach(b=>b.classList.remove('show','cur','done'));
    runs.forEach((p,i)=>{p.getAnimations().forEach(a=>a.cancel());p.style.strokeDasharray=`${soLen[i]} ${soLen[i]}`;p.style.strokeDashoffset=soLen[i];p.style.opacity=.9;});
    hint.textContent=L('이 순서로 써요');
    await sleep(reduce?0:260);
    for(let i=0;i<3;i++){
      if(my!==demoRun)return;
      badges[i].classList.add('show','cur');
      if(reduce){runs[i].style.strokeDashoffset=0;continue;}
      const an=runs[i].animate([{strokeDashoffset:soLen[i]},{strokeDashoffset:0}],{duration:520,easing:'cubic-bezier(.45,0,.25,1)',fill:'forwards'});
      for(let k=0;k<5;k++)setTimeout(()=>{if(my===demoRun)SND.felt('pencil');},k*95);
      try{await an.finished;}catch{return;}
      if(my!==demoRun)return;badges[i].classList.remove('cur');await sleep(150);
    }
    await sleep(reduce?900:420);if(my!==demoRun)return;
    if(!reduce){const fades=runs.map(p=>p.animate([{opacity:.9},{opacity:0}],{duration:320,fill:'forwards'}));try{await Promise.all(fades.map(a=>a.finished));}catch{return;}}
    if(my!==demoRun)return;soStop(true);
  }
  function soStop(fromDemo){if(!demoing&&!fromDemo)return;demoRun++;demoing=false;so.querySelectorAll('.so-run').forEach(p=>{p.getAnimations().forEach(a=>a.cancel());p.style.opacity=0;});soShow(false);}
  fit();box.classList.add('on');setTimeout(()=>{if(!done&&!strokes.length)soDemo();},420);
  // 덮음: 글자 점마다 잉크가 lw*1.25 안에 있나(ㄱ을 곧게 꺾어 쓰거나 조금 작게 써도 덮이게) · 벗어남: 잉크 점이 글자에서 lw*1.6 밖인가
  function score(){
    const pts=[];for(const s of strokes)for(const [u,v] of s)pts.push([u*W,v*W]);
    if(!pts.length)return {all:0,L:0,R:0,S:0,V:0,in:1,inkL:0,inkR:0};
    const R2=(lw*1.25)**2,O2=(lw*1.6)**2;let cl=0,cr=0,cs=0,cvv=0,nl=0,nr=0,ns=0,nv=0,inn=0;
    for(const [gx,gy] of glyph){const left=gx<split,stub=gx>stubX,vert=!left&&!stub;if(left)nl++;else nr++;if(stub)ns++;if(vert)nv++;
      for(const [u,v] of pts){const dx=u-gx,dy=v-gy;if(dx*dx+dy*dy<=R2){if(left)cl++;else cr++;if(stub)cs++;if(vert)cvv++;break;}}}
    for(const [u,v] of pts)for(const [gx,gy] of glyph){const dx=u-gx,dy=v-gy;if(dx*dx+dy*dy<=O2){inn++;break;}}
    const inkR=pts.filter(q=>q[0]>=split).length/pts.length;
    return {all:(cl+cr)/(glyph.length||1),L:cl/(nl||1),R:cr/(nr||1),S:cs/(ns||1),V:cvv/(nv||1),in:inn/pts.length,inkL:1-inkR,inkR};
  }
  // 방금 그은 획이 어느 획을 따라갔고, 거꾸로였는지(시작점이 그 획의 끝 쪽)
  function which(s){
    const near=(p,pts)=>{let b=1e9;for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i],dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((p[0]-ax)*dx+(p[1]-ay)*dy)/(dx*dx+dy*dy||1)));b=Math.min(b,Math.hypot(p[0]-ax-t*dx,p[1]-ay-t*dy));}return b;};
    const pts=s.map(([u,v])=>[u*W,v*W]);if(pts.length<4)return {k:-1};
    const fr=SP.map(P=>pts.filter(p=>near(p,P)<lw*1.6).length/pts.length),k=fr.indexOf(Math.max(...fr));if(fr[k]<.6)return {k:-1};
    const P=SP[k],a=pts[0],z=pts[pts.length-1],D=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
    return {k,rev:D(a,P[P.length-1])+D(z,P[0])<D(a,P[0])+D(z,P[P.length-1])};
  }
  const pos=e=>{const b=cv.getBoundingClientRect(),k=W/(b.width||W);return {x:(e.clientX-b.left)*k,y:(e.clientY-b.top)*k};};
  const finish=ok=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(revT);demoRun++;demoing=false;cancelAnimationFrame(soRaf);cleanup();if(ok){box.classList.add('done');hint.textContent=L('잘 썼어요!');SND.felt('ok');}setTimeout(()=>{box.classList.remove('on');setTimeout(()=>{strokes=[];x.clearRect(0,0,W,W);box.classList.remove('done');hint.textContent=HINT;so.innerHTML='';},500);res();},ok?1300:200);};
  // 한 번에 한 획만 — 펜이 닿은 뒤로는 손바닥 · 손가락은 잉크가 아니고, 손가락으로 긋던 중 펜이 닿으면 그 손가락 획을 지우고 펜으로 잇는다
  const down=e=>{
    if(e.pointerType==='pen')penT=performance.now();else if(e.pointerType==='touch'&&performance.now()-penT<2500)return;
    if(last){if(e.pointerType==='pen'&&ptype!=='pen'){strokes.pop();redraw();last=null;pid=null;}else return;}
    e.preventDefault();clearTimeout(timer);clearTimeout(revT);if(demoing)soStop();else if(soFoc!==soCur)soShow(true);
    pid=e.pointerId;ptype=e.pointerType;last=pos(e);cur=[[last.x/W,last.y/W]];strokes.push(cur);try{cv.setPointerCapture(e.pointerId);}catch{}
    x.beginPath();x.moveTo(last.x,last.y);x.lineTo(last.x+.1,last.y);x.stroke();};
  const move=e=>{if(!last||e.pointerId!==pid)return;if(ptype==='pen')penT=performance.now();if(e.pointerType==='mouse'&&!e.buttons){up();return;}const p=pos(e),dist=Math.hypot(p.x-last.x,p.y-last.y);if(dist<1.5)return;
    x.beginPath();x.moveTo(last.x,last.y);x.lineTo(p.x,p.y);x.stroke();
    for(let k=1,n=Math.ceil(dist/3);k<=n;k++)cur.push([(last.x+(p.x-last.x)*k/n)/W,(last.y+(p.y-last.y)*k/n)/W]);   // 3px마다 잉크 점
    last=p;const now=performance.now();if(now-lastT>45){SND.felt('pencil');lastT=now;}};
  // 안내: 다 쓰면 끝, 글자 밖이면 「흐린 글자 위로」, 거꾸로 그은 획은 한 번만 알려 주고, 그 밖에는 아직 안 쓴 가장 앞 획을 짚는다
  const up=e=>{if(!last||(e&&e.pointerId!=null&&e.pointerId!==pid))return;if(ptype==='pen')penT=performance.now();last=null;pid=null;const s=score(),w=which(strokes[strokes.length-1]||[]);traceGa.last=s;
    soDone=[soDone[0]||s.L>=.5,soDone[1]||s.V>=.55,soDone[2]||s.S>=.45];soShow(true);
    // 안쪽(글자 근처 잉크) .6: 바르게 쓴 글씨는 .86 위, 칸 전체 지그재그는 .5 안팎
    if(s.L>=.5&&s.R>=.55&&s.S>=.45&&s.all>=.58&&s.in>=.6){hint.textContent=L('좋아요, 다 썼어요!');timer=setTimeout(()=>finish(true),700);}
    else if(s.in<.6)hint.textContent=L('흐린 글자 위를 따라 써 보세요');
    else if(w.k>=0&&w.rev&&!revShown[w.k]){revShown[w.k]=true;soShow(true,w.k);tip(w.k,SO_REV[w.k]);clearTimeout(revT);const n0=strokes.length;revT=setTimeout(()=>{if(!done&&!last&&strokes.length===n0)soShow(false);},1800);}
    else if(soCur>=0)tip(soCur);
    else hint.textContent=L('흐린 글자를 따라 조금만 더 써 보세요');};
  const clear=e=>{e.stopPropagation();clearTimeout(timer);clearTimeout(revT);if(demoing)soStop(true);strokes=[];last=null;pid=null;x.clearRect(0,0,W,W);soDone=[false,false,false];revShown.fill(false);soShow();SND.felt('page');};
  const again=e=>{e.stopPropagation();soDemo();};
  const skip=e=>{e.stopPropagation();finish(false);};
  const cancel=e=>{if(e.pointerId===pid){last=null;pid=null;}};
  const cleanup=()=>{cv.removeEventListener('pointerdown',down);cv.removeEventListener('pointermove',move);removeEventListener('pointerup',up);cv.removeEventListener('pointercancel',cancel);removeEventListener('resize',fit);$('#traceSkip').removeEventListener('click',skip);$('#traceClear').removeEventListener('click',clear);$('#traceOrderBtn').removeEventListener('click',again);};
  cv.addEventListener('pointerdown',down);cv.addEventListener('pointermove',move);addEventListener('pointerup',up);cv.addEventListener('pointercancel',cancel);addEventListener('resize',fit);$('#traceSkip').addEventListener('click',skip);$('#traceClear').addEventListener('click',clear);$('#traceOrderBtn').addEventListener('click',again);
  traceGa.cancel=()=>finish(false);
  // 시험용: 획의 가운데 선(화면 px) — 시험 스크립트가 실제로 쓰듯 세 획을 긋는다 · 안내 상태
  traceGa.paths=()=>{const b=cv.getBoundingClientRect(),k=b.width/W;return SP.map(P=>P.map(([u,v])=>[b.left+u*k,b.top+v*k]));};
  traceGa.order=()=>({cur:soCur,focus:soFoc,done:soDone.slice(),demo:demoing,hint:hint.textContent});
});}
/* 입국심사: 여권 → 「한국에 왜 왔어요?」(틀리면 한 번 더) → 「어느 학교예요?」 → 도장 */
async function immigration(r){
  await say(r,'officer','안녕하세요. 여권 주시겠어요?');
  await pick(panel(`<button type="button" class="opt" data-n>${L('여권 건네기')}</button>`),'[data-n]',()=>{});guard(r);
  SND.felt('page');await sleep(500);guard(r);
  await say(r,'officer','한국에 무슨 일로 오셨어요?');
  let tries=0;
  for(;;){
    const opts=[['공부하러 왔어요.','study'],['여행하러 왔어요.','trip'],['일하러 왔어요.','work']];
    const v=await pick(panel(opts.map(([a,k])=>`<button type="button" class="opt" data-k="${k}">${a}${optSub(a)}</button>`).join('')),'[data-k]',b=>b.dataset.k);guard(r);
    await me(r,opts.find(o=>o[1]===v)[0]);
    if(v==='study')break;
    tries++;
    if(tries<2){await say(r,'officer','음… 학생 비자인데요?');continue;}
    await say(r,'officer','학생 비자네요. 공부하러 오신 거죠?');await me(r,'…네, 공부하러 왔어요.');break;
  }
  await say(r,'officer','학교는 어디예요?');
  await pick(panel(`<button type="button" class="opt" data-n>새솔대학교예요.${optSub('새솔대학교예요.')}</button>`),'[data-n]',()=>{});guard(r);
  await me(r,'새솔대학교예요.');
  await say(r,'officer','네, 됐습니다. 가셔도 돼요.');
  $('#vn').classList.remove('on');const st=$('#stamp');st.classList.remove('hit');st.classList.add('on');await sleep(450);guard(r);
  void st.offsetWidth;st.classList.add('hit');SND.felt('stamp');SND.sfx('sfx_stamp',.6);setTimeout(()=>SND.felt('ok'),260);
  await sleep(1700);guard(r);st.classList.remove('on','hit');await sleep(300);guard(r);
}
/* 두 번째 실행부터: 입구에서 이야기를 건너뛰고 정문으로 */
$('#titleSkip').onclick=async e=>{
  e.stopPropagation();const t=$('#s-title');if(t.classList.contains('go'))return;t.classList.add('go');
  SND.unlock();SND.warmAll();warm(WARM.story(state.dream));fillLazy();warmLooks();
  state.dreamPicked=true;document.body.dataset.dream=state.dream;
  const r=++RUN;SND.play('bgm_campus',{at:0,vol:.5,fade:1});SND.play('amb_campus',{vol:.8,fade:1,bus:'amb'});
  try{await gate(r);}catch(err){if(err!==SKIP)throw err;}
};
$('#skipBtn').onclick=async e=>{
  e.stopPropagation();const r=++RUN;
  ['amb_dawn','amb_cabin','amb_train','amb_airport','amb_hall','amb_clock'].forEach(n=>SND.stop(n,.4));
  ['banner','pa','place','bigTitle','trace','note','stamp','mrSheet','mrHint'].forEach(id=>$('#'+id).classList.remove('on'));spotOff();$('#mirror').classList.remove('on','lit','done','ask');$('#s-cut').classList.remove('mr-up');$('#vn').className='vn';closePanel();$('#narr').innerHTML='';$('#narrSub').hidden=true;$('#tapHint').classList.remove('on');
  if(!$('#s-dream').classList.contains('picked')&&$('#s-dream').classList.contains('on'))return;
  if(!state.dreamPicked){SND.stop('bgm_journey',.4);SND.stop('bgm_anthem',.6);SND.play('amb_room',{vol:.55,fade:.6,bus:'amb'});SND.play('amb_clock',{vol:.4,fade:4,bus:'amb'});await veil(true,{ms:200});if(r!==RUN)return;$('#roomStage').classList.remove('on');await cut('mirror',{kb:'still',instant:true});if(r!==RUN)return;show('s-cut');
    try{await veil(false,{ms:400});guard(r);await mirrorPart(r,{intro:false});await journey(r);}catch(err){if(err!==SKIP)throw err;}return;}
  SND.stop('amb_room',.4);SND.stop('amb_clock',.4);$('#roomStage').classList.remove('on');SND.stop('bgm_anthem',.4);SND.stop('bgm_journey',.4);SND.play('bgm_campus',{at:0,vol:.5,fade:1});SND.play('amb_campus',{vol:.8,fade:1,bus:'amb'});
  try{await gate(r);}catch(err){if(err!==SKIP)throw err;}
};
document.querySelectorAll('.dream').forEach(b=>b.addEventListener('click',()=>{state.dreamPicked=true;}));

/* ══ 정문: 국제학부 신입생 맞이 부스의 선배 둘이 이야기 안에서 이름 · 나라 · 부르는 말을 묻는다 ══
 * 동아리가 학생증을 만들지는 않으니, 명단 · 학생증을 다루는 「신입생 맞이 도우미」로 둔다. */
const WHO={officer:{n:'입국심사관',r:''},seoha:{n:'서하',r:'국제학부 2학년 · 신입생 도우미',ft:'translate(5%,2%) scale(1.07)'},jiho:{n:'지호',r:'국제학부 3학년 · 학생회',ft:'translate(-5%,3%) scale(1.07)'}};
const COUNTRY=['몽골','베트남','우즈베키스탄','중국','일본','미국'];
const HELLO={'몽골':'와, 몽골! 여기 봄은 몽골보다 따뜻하죠?','베트남':'베트남! 따뜻한 나라에서 왔네요. 여기 아침은 좀 춥죠?','우즈베키스탄':'우즈베키스탄! 멀리서 왔네요. 비행기 오래 탔죠?','중국':'와, 중국! 가까워서 금방 왔죠?','일본':'와, 일본! 한국은 처음이에요?','미국':'미국! 정말 멀리서 왔네요. 시차 괜찮아요?'};
const hasBatchim=w=>{const c=w.charCodeAt(w.length-1)-0xAC00;return c>=0&&c<11172&&c%28!==0;};
// 한글 이름으로 받는 것: 한글(띄어쓰기 허용) 10자까지, 「몰라요 · 없어요」 같은 대답 꼴만 이름으로 보지 않는다
const okHangulName=v=>/^[가-힣]+( [가-힣]+)*$/.test(v)&&v.replace(/ /g,'').length>=1&&v.length<=10&&!/(아요|어요|해요|네요|니다|는다|았다|었다|몰라요|모르겠|아니요)$/.test(v)&&!/^(네|예|응|아니)$/.test(v);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let vnWait=null;
$('#vn').addEventListener('click',()=>{const t=$('#vnText');if(t._finish&&!t._done){t._finish();return;}if(vnWait)vnWait();});
$('#app').addEventListener('click',e=>{if(!$('#vn').classList.contains('on')||e.target.closest('.vn,.panel,button,input,form,.hud,.trace'))return;const t=$('#vnText');if(t._finish&&!t._done){t._finish();return;}if(vnWait)vnWait();});
function plate(name,role,cls=''){$('#vn').className='vn on '+cls;$('#vnName').innerHTML=`<b>${esc(L(name))}</b>${role?`<span>${esc(L(role))}</span>`:''}`;}
// 단추 안 작은 번역(학생이 하는 말은 한국어 그대로 둔다)
const optSub=ko=>{const v=sub(ko);return v?`<small>${esc(v)}</small>`:'';};
function vnSub(text){const s=$('#vnSub'),v=text?sub(text):'';s.textContent=v;s.hidden=!v;}
/* 부스 그림 판: 그림 비율 그대로 화면을 덮는다(탁자 앞 안내문이 그림과 같이 움직이게) */
function gstageFit(){const app=$('#app').getBoundingClientRect(),vw=app.width,vh=app.height,ar=941/1672;let w,h;
  if(vw/vh>ar){w=vw;h=vw/ar;}else{h=vh;w=vh*ar;}Object.assign($('#gstage').style,{width:w+'px',height:h+'px',left:(vw-w)/2+'px',top:(vh-h)/2+'px'});}
addEventListener('resize',()=>{gstageFit();});
async function say(r,who,text){
  guard(r);const W=WHO[who],g=$('#s-gate');
  if(W.ft){g.style.setProperty('--ft',W.ft);g.classList.add('focus');}
  plate(W.n,W.r);const t=$('#vnText');t._done=false;vnSub(text);
  await typeInto(t,text,{cps:23,who});t._done=true;guard(r);
  $('#vn').classList.add('wait');
  await new Promise(res=>{vnWait=()=>{vnWait=null;res();};});guard(r);
  $('#vn').classList.remove('wait');SND.felt('page');
}
async function me(r,text){guard(r);$('#s-gate').classList.remove('focus');plate('나','','me');const t=$('#vnText');t.textContent=text;t._done=true;vnSub(text);SND.felt('select');await sleep(1100);guard(r);}
// 고르기 판은 늘 대화창(이름표 포함) 바로 위에 뜨고, 그동안 그림을 올려 두 선배 얼굴이 판 위에 남게 한다
function panel(html){const p=$('#panel');p.innerHTML=html;const app=$('#app').getBoundingClientRect(),v=$('#vn').getBoundingClientRect();
  p.style.bottom=Math.max(150,app.bottom-v.top+40)+'px';document.querySelector('.screen.on')?.classList.add('ask');requestAnimationFrame(()=>p.classList.add('on'));return p;}
function closePanel(){const p=$('#panel');p.classList.remove('on');document.querySelectorAll('.screen.ask').forEach(x=>x.classList.remove('ask'));setTimeout(()=>{if(!p.classList.contains('on'))p.innerHTML='';},300);}
function pick(p,sel,map){return new Promise(res=>{p.querySelectorAll(sel).forEach(b=>b.onclick=e=>{e.stopPropagation();SND.felt('select');closePanel();res(map(b));});});}
function chooseCountry(){
  const main=COUNTRY.map(x=>({html:x+optSub(x),v:x})),extra=[{html:L('다른 나라'),v:'?'},{html:L('나중에 말할래요'),cls:'quiet',v:null}],all=[...main,...extra];
  const p=panel(`<div class="opts2">${main.map((x,i)=>`<button type="button" class="opt" data-i="${i}">${x.html}</button>`).join('')}</div>`+extra.map((x,j)=>`<button type="button" class="opt ${x.cls||''}" data-i="${main.length+j}">${x.html}</button>`).join(''));
  return pick(p,'[data-i]',b=>all[+b.dataset.i]);
}
function pad({title,label,ph,later=true}){return new Promise(res=>{
  const p=panel(`<div class="sheetpad"><span class="lab">${L('새솔대 국제학부 · 신입생 맞이')}</span><h3>${L(title)}</h3><label>${L(label)}</label><form><input autocomplete="off" maxlength="40" placeholder="${L(ph)}" aria-label="${L(label)}"><button class="ok" type="submit">${L('확인')}</button></form>${later?`<button type="button" class="later" data-later="1">${L(typeof later==='string'?later:'나중에 말할래요')}</button>`:''}</div>`);
  const done=v=>{SND.felt('select');closePanel();res(v);};
  p.querySelector('form').onsubmit=e=>{e.preventDefault();const v=p.querySelector('input').value.trim();if(v)done(v);};
  const l=p.querySelector('[data-later]');if(l)l.onclick=e=>{e.stopPropagation();done(null);};});}
/* ══ 부스 · 한글 이름 후보와 이름 손글씨(설계 이름손글씨.md) ══ */
const nameTrace=createNameTrace({$,L,SND,reduce,sleep});
// 후보 판: 지호가 명단에 소리 나는 대로 적어 준 이름 — 「좋아요」 · 「다르게 쓸래요」(한글 타자) · 「한글 이름은 나중에」
function offerName(ko){
  const p=panel(`<div class="sheetpad"><span class="lab">${L('새솔대 국제학부 · 신입생 맞이')}</span><h3>${L('신입생 명단')}</h3><label>${L('한글 이름')}</label><p class="ko-cand">${esc(ko)}</p><p class="ko-note">${L('소리 나는 대로 적었어요')}</p><div class="ko-row"><button type="button" class="ok" data-a="ok">${L('좋아요')}</button><button type="button" class="ko-other" data-a="other">${L('다르게 쓸래요')}</button></div><button type="button" class="later" data-a="later">${L('한글 이름은 나중에')}</button></div>`);
  return pick(p,'[data-a]',b=>b.dataset.a);
}
// 이름 손글씨: 쓰는 동안 말풍선을 내리고(390 폭에서 칸과 겹치지 않게), 다 쓰면 학생증 글씨로 남긴다. 넘어가면 서명 없이 지금 학생증 그대로
async function writeName(r,ko,knows,raw){
  const called=calledName(ko,raw),{word,syl}=nameSyllables(ko,called);
  if(!syl.length)return;
  await say(r,'seoha','학생증에 들어갈 이름, 한글로 직접 써 볼래요?');
  if(word!==ko)await say(r,'seoha',`이름이 길어서, 오늘은 ${word}만 써 봐요.`);
  await say(r,'seoha',knows?'여기 칸에 써 주면 돼요.':'제가 흐리게 써 둘게요. 위에 따라 써 봐요.');
  $('#vn').classList.remove('on');$('#s-gate').classList.remove('focus');$('#s-gate').classList.add('writing');
  const res=await nameTrace.run(ko,{knows,called}).finally(()=>$('#s-gate').classList.remove('writing'));guard(r);
  if(res.sign){state.sign=res.sign;save({sign:res.sign});await say(r,'seoha',knows?'글씨 예쁘다! 학생증에 이대로 넣을게요.':'와, 처음 쓴 거 맞아요? 학생증에 이대로 넣을게요.');}
  else await say(r,'seoha','괜찮아요. 쓰는 건 다음에 같이 해 봐요.');
}
async function gate(r){
  state.prologue=true;$('#skipBtn').hidden=true;traceGa.cancel?.();nameTrace.cancel();warm(WARM.road(state.dream));fillLazy();
  // 정문 그림 위에서 옆쪽 누군가가 부른다 → 고개를 돌리면 부스
  const g=$('#s-gate'),bg0=$('#gateBg'),gst=$('#gstage');
  g.classList.remove('focus','ask');$('#vn').className='vn';$('#vnText').textContent='';
  gstageFit();bg0.getAnimations().forEach(a=>a.cancel());bg0.style.opacity='1';gst.style.opacity='0';
  const cutImg=document.querySelector('#s-cut .cut-img.on img');bg0.style.transform=cutImg&&$('#s-cut').classList.contains('on')?getComputedStyle(cutImg).transform:'none';
  for(const id of ['s-cut','s-gate'])$('#'+id).style.transition='none';
  show('s-gate');void g.offsetWidth;for(const id of ['s-cut','s-gate'])$('#'+id).style.transition='';
  await sleep(200);guard(r);
  plate('누군가','','off');const t=$('#vnText');t._done=false;await typeInto(t,'저기요! 혹시 신입생이에요?',{cps:23,who:'seoha'});t._done=true;guard(r);
  await sleep(800);guard(r);
  SND.sfx('pix_whoosh_short',.7);$('#vn').classList.remove('on');
  if(!reduce){
    const t0=bg0.style.transform&&bg0.style.transform!=='none'?bg0.style.transform:'scale(1)';
    // 부스 판(gstage)은 화면보다 넓게 깔리므로 둘 다 화면 폭만큼 민다 — 제 폭만큼 밀면 두 장 사이에 틈이 벌어진다
    const whip={duration:560,easing:'cubic-bezier(.7,0,.25,1)'},W=$('#app').clientWidth;
    bg0.animate([{transform:t0},{transform:`translateX(${-W}px) ${t0}`}],{...whip,fill:'forwards'});
    gst.style.opacity='1';
    await gst.animate([{transform:`translateX(${W}px)`},{transform:'none'}],whip).finished.catch(()=>{});
  }else{bg0.style.opacity='0';gst.style.opacity='1';}
  guard(r);
  await say(r,'seoha','역시! 캐리어 보고 딱 알았어요.');
  await say(r,'seoha','반가워요! 저는 국제학부 2학년 서하예요. 오늘 신입생 도우미예요.');
  await say(r,'jiho','안녕하세요, 학생회 지호예요.');
  await say(r,'jiho','여기 신입생 명단에 이름 좀 적어 줄래요?');
  state.name=null;state.nameEn=null;state.sign=null;state.from=null;state.call=null;
  const raw=await pad({title:'신입생 명단',label:'이름 (영어나 내 나라 글자로)',ph:'예: Bolor'});guard(r);
  if(raw){
    await me(r,raw);
    // 한글 이름(설계 이름손글씨.md 3절): 한글로 적었으면 그대로(아는 학생), 아니면 후보(사전 · 규칙)를 보여 고르게, 후보가 없으면 지금처럼 묻는다
    const hn=hangulName(raw);let ko=null,knows=false;
    const askKo=async()=>{const v=await pad({title:'신입생 명단',label:'한글 이름',ph:'한글로 써 보기',later:'아직 모르겠어요'});guard(r);if(v&&okHangulName(v)){await me(r,v);return v;}return null;};
    if(hn?.via==='hangul'&&okHangulName(hn.ko)){ko=hn.ko;knows=true;}
    else if(hn&&okHangulName(hn.ko)){
      await say(r,'jiho',`${raw}… 한글로는 이렇게 쓰면 돼요.`);
      const a=await offerName(hn.ko);guard(r);
      if(a==='ok')ko=hn.ko;
      else if(a==='other'){const v=await askKo();if(v){ko=v;knows=true;}else ko=hn.ko;}   // 「아직 모르겠어요」면 후보로 돌아간다(설계 검토 F1-4)
    }else{await say(r,'jiho',`${raw}… 한글로는 어떻게 써요?`);const v=await askKo();if(v){ko=v;knows=true;}}
    state.name=ko||raw;state.nameEn=raw;save({name:state.name,nameEn:raw,sign:null});
    if(!ko){await say(r,'seoha',`${raw} 씨! 반가워요. 한글로 쓰는 건 다음에 같이 해 봐요.`);}
    else{
      await say(r,'seoha',`${ko} 씨! 반가워요.`);
      await writeName(r,ko,knows,raw);
      const b=hasBatchim(ko);
      const p=panel(`<div class="learn"><span class="mono">${L('이렇게 말해 봐요')}</span><b>제 이름은 ${esc(ko)}<em>${b?'이에요':'예요'}</em>.</b><p>${esc(L(b?'받침있음':'받침없음',{ch:ko.slice(-1)}))}<br>${L('소리 내어 말해 보세요.')}</p><button type="button" class="opt" data-n>${L('말해 봤어요')}</button></div>`);
      await pick(p,'[data-n]',()=>{SND.felt('ok');});guard(r);
      await me(r,`제 이름은 ${ko}${b?'이에요':'예요'}.`);
      await say(r,'jiho','오, 발음 좋은데요?');
    }
  }else{await me(r,'이름은 나중에 말해도 돼요?');await say(r,'seoha','그럼요! 나중에 알려 줘요.');}
  // 나라는 지호가 묻는다 — 서하 혼자 말을 거는 모양이 연애 게임처럼 읽히지 않게
  await say(r,'jiho',`${state.name?state.name+' 씨는':'그럼'} 어디서 왔어요?`);
  const c=await chooseCountry();guard(r);
  let from=c.v;
  if(from==='?'){from=await pad({title:'신입생 명단',label:'나라',ph:'나라 이름',later:true});guard(r);}
  if(from){state.from=from;save({from});await me(r,`${from}에서 왔어요.`);await say(r,'seoha',`${HELLO[from]||`${from}! 멀리서 왔네요.`} 나중에 ${from} 이야기 많이 들려줘요.`);}
  else{await me(r,'나중에 말해도 돼요?');await say(r,'jiho','네, 괜찮아요.');}
  await say(r,'seoha','앞으로 자주 볼 텐데, 저는 뭐라고 부를래요?');
  const p2=panel(`<div class="memo"><span class="mono">${L('한국어 메모')}</span><p>${L('부르는 말 메모')}</p></div><div class="opts3">`+['누나|남자가','언니|여자가','선배|누구나'].map(x=>{const [a,b]=x.split('|');return `<button type="button" class="opt" data-k="${a}">${a}<small>${L(b)}</small></button>`;}).join('')+'</div>');
  const k=await pick(p2,'[data-k]',b=>b.dataset.k);guard(r);
  state.call=k;save({call:k});await me(r,`서하 ${k}! 잘 부탁해요.`);
  await say(r,'seoha','네! 저도 잘 부탁해요.');
  await lookPart(r);
}
async function lookPart(r){
  await say(r,'jiho','자, 학생증은 여기서 바로 뽑아 줄게요. 사진만 하나 찍으면 돼요.');
  await say(r,'seoha','학생증에 들어갈 사진이니까 제일 멋지게 찍어 봐요!');
  const lk=await pickLook();guard(r);state.look=lk;save({look:lk?lk.id:null});
  if(lk){
    await shootLook(r);
    await say(r,'seoha','오, 잘 나왔다!');
    $('#vn').classList.remove('on');
    await revealCard(r,lookRects.vf());
  }else{
    await me(r,'사진은 나중에 찍어도 돼요?');
    await say(r,'jiho','네, 괜찮아요. 사진은 나중에 넣어도 돼요.');
    $('#vn').classList.remove('on');
    await revealCard(r,null);
  }
}

/* ══ 내 모습 고르기 ══
 * 얼굴 조각을 태블릿 카메라 화면에서 고르고 셔터로 정한다. 시작부터 골라 둔 얼굴은 없다(기본값이 곧 「이 앱의 주인공」으로 읽힌 시험 결과).
 * 순서만 앞서 말한 나라 · 부르는 말(누나 · 언니)에 맞춘다 — 사진을 올리는 길은 열지 않는다. 얼굴 재기는 얼굴재기.py. */
const LOOK_FACES=LOOK_FACES_DATA;
const LOOKS=[
  {id:'mn_m',c:'몽골',g:'m',src:A('look-mn-m')},{id:'mn_f',c:'몽골',g:'f',src:A('look-mn-f')},
  {id:'vn_m',c:'베트남',g:'m',src:A('look-vn-m')},{id:'vn_f',c:'베트남',g:'f',src:A('look-vn-f')},
  {id:'uz_m',c:'우즈베키스탄',g:'m',src:A('look-uz-m')},{id:'uz_f',c:'우즈베키스탄',g:'f',src:A('look-uz-f')},
  {id:'us_m',c:'미국',g:'m',src:A('look-us-m')},{id:'us_f',c:'미국',g:'f',src:A('look-us-f')},
  {id:'cn_m',c:'중국',g:'m',src:A('look-cn-m')},{id:'cn_f',c:'중국',g:'f',src:A('look-cn-f')},
  {id:'jp_m',c:'일본',g:'m',src:A('look-jp-m')},{id:'jp_f',c:'일본',g:'f',src:A('look-jp-f')}
].map(x=>Object.assign(x,LOOK_FACES[x.id]));
const warmLooks=()=>LOOKS.forEach(l=>{const i=new Image();i.decoding='async';i.src=l.src;});
const lookById=id=>LOOKS.find(l=>l.id===id)||null;
function lookOrder(){
  const g=state.call==='누나'?'m':state.call==='언니'?'f':null;
  return LOOKS.map(x=>[x,(x.c===state.from?2:0)+(g&&x.g===g?1:0)+Math.random()*.5]).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
}
// 사진을 칸에 덮을 때(cover)와 얼굴을 칸에 맞춰 자를 때의 그림 자리
const lookRects={
  cover(l,w,h){const s=Math.max(w/l.w,h/l.h),iw=l.w*s,ih=l.h*s;return {left:(w-iw)/2,top:(h-ih)*.3,width:iw,height:ih};},
  crop(l,w,h,share){const iw=Math.max(w*share/l.fw,w),ih=iw*l.h/l.w;
    const left=Math.min(0,Math.max(w-iw,w/2-l.fx*iw)),top=Math.min(0,Math.max(h-ih,h*.46-l.fy*ih));return {left,top,width:iw,height:ih};},
  vf(){const b=$('#lkVf').getBoundingClientRect(),a=$('#app').getBoundingClientRect();return {left:b.left-a.left,top:b.top-a.top,width:b.width,height:b.height};}
};
const px=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v+'px']));
function faceTile(l,w,h,share){const r=lookRects.crop(l,w,h,share);return `<i style="left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;background-image:url(${l.src});background-size:100% 100%"></i>`;}
let lookFit=null;
addEventListener('resize',()=>{lookFit?.();});
function pickLook({change=false}={}){return new Promise(res=>{
  const box=$('#look'),vf=$('#lkVf'),rail=$('#lkRail'),shoot=$('#lkShoot'),hint=$('#lkHint'),af=$('#lkAf'),order=lookOrder();
  let cur=-1;
  warmLooks();
  $('#lkBlank').style.backgroundImage=`url(${IMG.gate})`;
  $('#lkLater').textContent=change?L('그대로 둘래요'):L('나중에 찍을래요');
  $('#vn').classList.remove('on');box.classList.remove('shoot');vf.classList.remove('has');vf.querySelectorAll('img').forEach(x=>x.remove());af.classList.remove('go');shoot.disabled=true;hint.textContent=L('마음이 바뀌면 나중에 다시 고를 수 있어요');
  rail.innerHTML=order.map((l,i)=>`<button class="lk-th" type="button" data-i="${i}" aria-label="${L('모습 번호',{n:i+1})}" aria-pressed="false">${faceTile(l,60,60,.62)}</button>`).join('');
  const press=sel=>rail.querySelectorAll('.lk-th').forEach(t=>t.setAttribute('aria-pressed',t===sel?'true':'false'));
  function place(l,im){const b=vf.getBoundingClientRect(),r=lookRects.cover(l,b.width,b.height);Object.assign(im.style,px(r));
    const side=l.fw*r.width*1.3;Object.assign(af.style,px({left:r.left+l.fx*r.width-side/2,top:r.top+l.fy*r.height-side*.56,width:side,height:side*1.16}));}
  lookFit=()=>{const im=vf.querySelector('img:last-of-type');if(cur>=0&&im)place(order[cur],im);};
  function showFace(src,after){const old=[...vf.querySelectorAll('img')],im=new Image();im.alt='';im.src=src;vf.insertBefore(im,af);after(im);
    requestAnimationFrame(()=>requestAnimationFrame(()=>im.classList.add('in')));setTimeout(()=>old.forEach(x=>x.remove()),460);
    vf.classList.add('has');shoot.disabled=false;af.classList.remove('go');void af.offsetWidth;af.classList.add('go');}
  function go(i){
    if(i===cur)return;cur=i;const l=order[i];
    showFace(l.src,im=>place(l,im));hint.textContent=L('마음에 들면 셔터를 눌러요');setTimeout(()=>{if(cur===i)SND.felt('focus');},300);
    const t=rail.querySelector(`[data-i="${i}"]`);press(t);t.scrollIntoView({inline:'center',block:'nearest',behavior:reduce?'auto':'smooth'});
  }
  rail.onclick=e=>{const t=e.target.closest('.lk-th');if(!t)return;go(+t.dataset.i);};
  // 칸 위에서 좌우로 넘기기
  let x0=null;
  vf.onpointerdown=e=>{if(e.target.closest('button'))return;x0=e.clientX;};
  vf.onpointerup=e=>{if(x0==null)return;const d=e.clientX-x0;x0=null;if(Math.abs(d)<36)return;SND.felt('tap');go(cur<0?0:(cur+(d<0?1:-1)+order.length)%order.length);};
  vf.onpointercancel=()=>{x0=null;};
  const done=v=>{lookFit=null;shoot.onclick=$('#lkLater').onclick=rail.onclick=vf.onpointerdown=vf.onpointerup=null;res(v);};
  shoot.onclick=()=>{if(cur>=0)done(order[cur]);};
  $('#lkLater').onclick=()=>{box.classList.remove('on');done(null);};
  rail.scrollLeft=0;box.classList.add('on');SND.sfx('pix_whoosh_short',.4);
});}
async function shootLook(r){
  const box=$('#look'),t=$('#vnText');box.classList.add('shoot');
  plate(WHO.jiho.n,WHO.jiho.r);t._done=false;await typeInto(t,'자, 여기 보세요.',{cps:23,who:'jiho'});t._done=true;guard(r);
  await sleep(460);guard(r);
  t.textContent='';vnSub('하나, 둘, 셋!');for(const w of ['하나,',' 둘,',' 셋!']){t.append(w);SND.felt('tick');await sleep(620);guard(r);}
  SND.felt('shutter');const f=$('#lkFlash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');$('#lkAf').classList.remove('go');
  await sleep(760);guard(r);
}
/* ══ 학생증 발급: 인쇄(11-03 유호님 「A 인쇄로」) ══
 * 찍은 사진이 부스 프린터 윗틈으로 들어가고, 학생증이 두 번 끊겨 반쯤 나오면 내가 당겨 꺼낸다 → 내 쪽으로 들린다.
 * 움직임 값은 11-03 모션 조사에서 가져왔다: 옮겨 가는 움직임은 M3 Expressive 스프링(강성 · 감쇠비), 기울기는 손가락 자리 기준 최대 14도 ·
 * 놓으면 0.5초 안에 제자리, 저절로 도는 반짝임은 두지 않고 손에 쥔 뒤 손가락(안드로이드는 기울기 센서도)에 답할 때만 빛과 은박이 움직인다. */
const LIN=!!(window.CSS&&CSS.supports&&CSS.supports('animation-timing-function','linear(0, 1)'));
// 스프링(강성 k · 감쇠비 z)을 WAAPI · transition에 넣는 linear() 곡선과 길이로 바꾼다. at(v)는 처음 v에 닿는 시각(ms)
function spring(k,z,fallback='cubic-bezier(.3,1.25,.4,1)'){
  const c=2*z*Math.sqrt(k),dt=1/240;let x=0,v=0,t=0;const pts=[0],ts=[0];
  for(let i=1;i<2400;i++){v+=(-k*(x-1)-c*v)*dt;x+=v*dt;t=i*dt;if(i%4===0){pts.push(x);ts.push(t);}if(t>.12&&Math.abs(1-x)<.0015&&Math.abs(v)<.02)break;}
  pts.push(1);ts.push(t);
  return {duration:Math.round(t*1000),easing:LIN?`linear(${pts.map(p=>+p.toFixed(4)).join(', ')})`:fallback,at:val=>{const i=pts.findIndex(p=>p>=val);return Math.round((i<0?t:ts[i])*1000);}};
}
// 앱 전체의 옮겨 가는 움직임은 이 세 스프링만 쓴다(M3 fast · default · slow). 색 · 투명도는 튕기지 않는다
const SP={fast:spring(800,.6),def:spring(380,.8),slow:spring(200,.8)};
for(const [k,s] of Object.entries(SP))document.documentElement.style.setProperty('--sp-'+k,s.easing);

/* 카드의 빛 · 기울기. 한 프레임 그리기에 transform과 변수 몇 개만 바꾸고, 목표에 닿아 가만하면 그리기도 쉰다 */
const CardFX=(()=>{
  let raf=0,last=0,quiet=0,hold=null,hover=null,gyro=null,g0=null,pullFn=null,bound=false,live=false;
  const T={rx:0,ry:0,vx:0,vy:0,tx:0,ty:0};   // 기울기(도)
  const el={};
  const cl=(v,a)=>Math.max(-a,Math.min(a,v));
  function grab(){for(const k of ['cardRig','cardTilt','idcard','s-card'])el[k]=document.getElementById(k);}
  function paint(){
    const {rx,ry}=T,s=el.idcard.style,m=Math.min(1,(Math.abs(rx)+Math.abs(ry))/16);
    el.cardTilt.style.transform=`rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    s.setProperty('--gx',(50+ry*2.8).toFixed(1)+'%');s.setProperty('--gy',(50-rx*2.8).toFixed(1)+'%');s.setProperty('--go',(.08+m*.92).toFixed(3));s.setProperty('--hr',(ry*9-rx*6).toFixed(1));s.setProperty('--sh',(50+ry*4-rx*2).toFixed(1));s.setProperty('--ga',(Math.atan2(ry,rx)*180/Math.PI).toFixed(1));s.setProperty('--gs',Math.min(.24,m*.28).toFixed(3));
    el.cardRig.style.setProperty('--sx',(-ry*1.2).toFixed(1)+'px');el.cardRig.style.setProperty('--sy',(rx*.9).toFixed(1)+'px');
  }
  function step(t){
    const dt=Math.min(.033,Math.max(.001,(t-last)/1000));last=t;
    const src=live?(hold||hover):null;   // 손에 쥐기 전(당기는 중 · 틈에 걸린 동안)에는 기울이지 않는다
    if(src){const b=el.cardRig.getBoundingClientRect(),nx=cl((src.x-(b.left+b.width/2))/(b.width/2),1),ny=cl((src.y-(b.top+b.height/2))/(b.height/2),1);T.ty=nx*14;T.tx=-ny*14;}
    else if(gyro){T.ty=gyro.x;T.tx=gyro.y;}else{T.tx=0;T.ty=0;}
    T.vx+=(180*(T.tx-T.rx)-19*T.vx)*dt;T.vy+=(180*(T.ty-T.ry)-19*T.vy)*dt;T.rx+=T.vx*dt;T.ry+=T.vy*dt;
    paint();
    const still=!src&&Math.abs(T.tx-T.rx)+Math.abs(T.ty-T.ry)<.05&&Math.abs(T.vx)+Math.abs(T.vy)<.1;
    quiet=still?quiet+dt:0;
    if(quiet>.4){raf=0;return;}
    raf=requestAnimationFrame(step);
  }
  function wake(){if(reduce||raf)return;last=performance.now();quiet=0;raf=requestAnimationFrame(step);}
  function bind(){
    const s=el['s-card'];
    s.addEventListener('pointerdown',e=>{
      if(reduce||e.target.closest('button'))return;
      const onCard=!!e.target.closest('.card-rig');   // 기울어진 카드는 바깥 틀이 먼저 잡힐 때가 있어 카드 자리 전체로 본다
      if(pullFn?!onCard:!live)return;
      hold={x:e.clientX,y:e.clientY,x0:e.clientX,y0:e.clientY,id:e.pointerId,pull:!!pullFn};
      try{s.setPointerCapture(e.pointerId);}catch{}wake();
    });
    s.addEventListener('pointermove',e=>{
      if(hold&&e.pointerId===hold.id){hold.x=e.clientX;hold.y=e.clientY;if(hold.pull&&pullFn)pullFn.move(hold.y-hold.y0);return;}
      if(e.pointerType!=='mouse'||reduce||!live)return;
      const b=el.cardRig.getBoundingClientRect();
      if(e.clientX>b.left-24&&e.clientX<b.right+24&&e.clientY>b.top-24&&e.clientY<b.bottom+24){hover={x:e.clientX,y:e.clientY};wake();}else if(hover){hover=null;wake();}
    });
    const up=e=>{if(!hold||e.pointerId!==hold.id)return;const h=hold;hold=null;
      // 꾹 눌렀다 떼도 꺼낸다
      if(h.pull&&pullFn&&pullFn.end(e.clientY-h.y0,Math.hypot(e.clientX-h.x0,e.clientY-h.y0)<10))pullFn=null;
      wake();};
    s.addEventListener('pointerup',up);s.addEventListener('pointercancel',up);
    s.addEventListener('pointerleave',()=>{if(hover){hover=null;wake();}});
    el.cardRig.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();if(pullFn&&pullFn.end(999,true))pullFn=null;});
    // 기울기 센서: 허락 창 없이 오는 기기(안드로이드)에서만 쓴다 — iOS의 권한 창을 첫 화면에 띄우지 않는다
    if(!reduce&&'DeviceOrientationEvent' in window&&typeof DeviceOrientationEvent.requestPermission!=='function')
      addEventListener('deviceorientation',e=>{if(e.beta==null||e.gamma==null||!live||!s.classList.contains('on'))return;if(!g0)g0={b:e.beta,g:e.gamma};
        const g={x:cl((e.gamma-g0.g)*.7,14),y:cl(-(e.beta-g0.b)*.7,14)};
        if(!gyro||Math.abs(g.x-gyro.x)+Math.abs(g.y-gyro.y)>.3){gyro=g;wake();}});
  }
  return {
    setup(){grab();if(!bound){bind();bound=true;}hold=hover=null;gyro=null;g0=null;pullFn=null;live=false;
      Object.assign(T,{rx:0,ry:0,vx:0,vy:0,tx:0,ty:0});el.cardTilt.style.transform='';paint();},
    kick(vx,vy){T.vx+=vx;T.vy+=vy;wake();},
    onPull(f){pullFn=f;},
    live(on){live=on;if(on)wake();},
    stop(){if(raf)cancelAnimationFrame(raf);raf=0;hold=hover=null;gyro=null;pullFn=null;live=false;}
  };
})();

/* ══ 학생증 ══ */
function fillCard(){
  const D=DREAM[state.dream],ko=state.name||'신입생';
  // 사진 칸: 찍은 사진(나중에 찍기를 고르면 실루엣)
  $('#idPhoto').innerHTML='<svg viewBox="0 0 92 120" aria-hidden="true"><circle cx="46" cy="46" r="19" fill="rgba(255,255,255,.8)"/><path d="M10 120c3-24 18-38 36-38s33 14 36 38z" fill="rgba(255,255,255,.8)"/></svg>';
  $('#idName').innerHTML=`<span class="nm-ko">${esc(ko)}</span><small><span class="nm-en">${!state.name?'New student':state.nameEn&&state.nameEn!==ko?esc(state.nameEn):'&nbsp;'}</span></small>`;   // 빈 영어 줄도 한 줄 자리를 남겨 이름 글씨가 앉을 곳이 있게
  $('#idDept').innerHTML='<span class="dp-t">국제학부 1학년'+(state.from?` · <b>${esc(state.from)}</b>`:'')+'</span>';   // 이름 글씨 자리(placeSign)가 학과 줄을 재므로 그보다 먼저 쓴다(다시 검수 FA1)
  // 부스에서 손으로 쓴 이름 글씨(있을 때만). 쓴 이름이 지금 이름과 다르면 그리지 않는다
  const sg=state.sign&&state.name&&(state.sign.w===state.name||state.name.split(' ').includes(state.sign.w))?signSvg(state.sign,{width:.075,tight:true}):'';
  $('#idSign').innerHTML=sg;$('#idSign').hidden=!sg;placeSign();
  $('#idDream').textContent='꿈 · '+D.ko;
  $('#cardLine').textContent=LANG==='ko'?`${state.name?state.name+' 씨의':'이제'} 한국 생활이 시작돼요. 이 길 끝에 ${D.goal}${hasBatchim(D.goal)?'이':'가'} 있어요.`:L('학생증 한 줄',{goal:L(D.goal)});
}
// 이름 글씨 자리: 인쇄된 한글 이름이 끝난 오른쪽(빈자리가 모자라면 영어 이름 줄 오른쪽). 배치 크기(offset)로 재서 카드가 흔들리는 중에도 같다.
// 둘 다 자리가 없으면(아주 긴 이름) 그리지 않는다 — 글씨는 기록에 남아 있다
function placeSign(tries=0){
  const sg=$('#idSign'),card=$('#idcard'),ko=$('#idName .nm-ko'),en=$('#idName .nm-en');
  if(sg.hidden||!ko)return;
  if(!card.offsetWidth||!ko.offsetWidth){if(tries<60)requestAnimationFrame(()=>placeSign(tries+1));return;}
  const W=card.offsetWidth,edge=W-16,box=(el,h)=>({left:el.offsetLeft+el.offsetWidth+10,top:el.offsetTop+(el.offsetHeight-h)/2,h});
  const hKo=Math.min(32,ko.offsetHeight*1.05),lines=Math.round(ko.offsetHeight/(parseFloat(getComputedStyle(ko).lineHeight)||ko.offsetHeight));
  // 자리 차례: ① 인쇄 이름 오른쪽(한 줄일 때) ② 영어 이름 오른쪽 ③ 학과 줄 오른쪽 ④ 빈 영어 줄 맨 왼쪽(작게).
  // 한글로 이름을 친 학생은 영어 이름 줄이 비어 있어(빈칸 하나로 자리만 남김) 긴 이름이어도 ③ · ④에 앉는다 — 숨기지 않는다(화면 검수 F4)
  const blank=en&&!en.textContent.trim(),dp=$('#idDept .dp-t');
  const seats=[()=>lines<=1?box(ko,hKo):null,()=>en&&en.offsetWidth&&!blank?{...box(en,15),top:box(en,15).top+1}:null,()=>dp&&dp.offsetWidth?box(dp,16):null,()=>blank&&en.offsetWidth?{left:en.offsetLeft,top:en.offsetTop+2,h:10}:null];
  let at=null;for(const seat of seats){const b=seat();if(b&&edge-b.left>=(b.h>=30?64:56)){at=b;break;}}
  if(!at){sg.style.visibility='hidden';return;}
  Object.assign(sg.style,{visibility:'',left:at.left+'px',right:'16px',top:at.top+'px',height:at.h+'px'});
}
addEventListener('resize',()=>{if($('#s-card').classList.contains('on'))placeSign();});
// 사진은 카드의 배치 크기로 자른다(움직이는 중의 화면 크기가 아니라)
function putPhoto(){if(!state.look)return;const p=$('#idPhoto'),r=lookRects.crop(state.look,p.clientWidth,p.clientHeight,.6),im=new Image();im.alt='';im.src=state.look.src;Object.assign(im.style,px(r));p.replaceChildren(im);}
function cardEnd(){$('#cardHead').classList.add('on');setTimeout(()=>$('#cardFoot').classList.add('on'),reduce?0:240);}
/* 학생증 다시 보기 · 모습 다시 고르기: 내 길의 내 사진을 누르면 온다 */
function openCardView(){const rig=$('#cardRig');for(const x of [$('#cardSwing'),$('#printer')])x.getAnimations().forEach(a=>a.cancel());$('#cardSwing').style.transform='';$('#cardBox').classList.remove('feeding');$('#printer').classList.remove('busy','on');cardAskDone();fillCard();CardFX.setup();rig.classList.add('down');show('s-card');putPhoto();$('#s-card').classList.add('view');$('#cardHead span').textContent=L('내 학생증');cardEnd();CardFX.live(true);SND.felt('open');}
$('#reLook').onclick=async()=>{const lk=await pickLook({change:true});$('#look').classList.remove('on');if(!lk)return;state.look=lk;save({look:lk.id});SND.felt('shutter');putPhoto();buildRoad();};
// 카드에 손을 대야 이어지는 순간: 안내 한 줄과 키보드 초점(Enter · 스페이스)
function cardAsk(text,label){const h=$('#cardHint'),rig=$('#cardRig');h.textContent=L(text);h.classList.add('on');rig.tabIndex=0;rig.setAttribute('role','button');rig.setAttribute('aria-label',L(label));}
function cardAskDone(){const rig=$('#cardRig');$('#cardHint').classList.remove('on');rig.removeAttribute('tabindex');rig.removeAttribute('role');rig.removeAttribute('aria-label');}

async function revealCard(r,from){
  save({stage:'card'});$('#cardHead span').textContent=L('학생증이 나왔어요');
  const rig=$('#cardRig'),box=$('#cardBox'),sw=$('#cardSwing'),pr=$('#printer');
  for(const id of ['cardHead','cardFoot'])$('#'+id).classList.remove('on');cardAskDone();
  rig.classList.remove('down');pr.classList.remove('busy','on');box.classList.remove('feeding');
  for(const x of [sw,pr])x.getAnimations().forEach(a=>a.cancel());
  sw.style.transform='';
  fillCard();CardFX.setup();
  if(reduce){$('#look').classList.remove('on');putPhoto();show('s-card');rig.classList.add('down');cardEnd();SND.felt('reward');return;}
  const H=rig.offsetHeight,slit=Math.round(-.14*H),hide=slit-H-4;
  rig.style.setProperty('--slit',slit+'px');box.classList.add('feeding');pr.classList.add('on');
  sw.animate([{transform:`translateY(${hide}px)`}],{fill:'forwards'});
  putPhoto();show('s-card');
  if(from&&state.look){flyToSlit(from,slit-39);await sleep(1000);}else{$('#look').classList.remove('on');await sleep(560);}
  guard(r);pr.classList.add('busy');
  let y=hide;
  const go=async(to,ms=300)=>{await sw.animate([{transform:`translateY(${y}px)`},{transform:`translateY(${to}px)`}],{duration:ms,easing:'cubic-bezier(.25,.75,.3,1)',fill:'forwards'}).finished;y=to;};
  for(const f of [.36,.72]){SND.felt('feed');await go(hide+(slit-hide)*f);guard(r);await sleep(150);guard(r);}
  // 반쯤 나오면 멈춘다: 내가 아래로 당기거나 눌러 꺼낸다(보고만 있는 연출로 끝나지 않게)
  pr.classList.remove('busy');cardAsk('카드를 아래로 당겨 꺼내세요','학생증 꺼내기');
  const base=y;
  await new Promise(res=>CardFX.onPull({
    move(dy){const v=Math.max(0,Math.min(slit-base,dy*.75));sw.getAnimations().forEach(a=>a.cancel());sw.style.transform=`translateY(${base+v}px)`;y=base+v;},
    end(dy,tap){if(tap||dy>26){res();return true;}
      const at=y;sw.getAnimations().forEach(a=>a.cancel());sw.style.transform='';y=base;sw.animate([{transform:`translateY(${at}px)`},{transform:`translateY(${base}px)`}],{...SP.def,fill:'forwards'});return false;}
  }));guard(r);
  cardAskDone();sw.getAnimations().forEach(a=>a.cancel());sw.style.transform='';
  SND.felt('page');await go(slit,170);guard(r);
  // 틈에서 빠지면 집어 들어 내 쪽으로 가져온다 · 프린터는 뒤로 물러난다
  box.classList.remove('feeding');SND.felt('eject');
  pr.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(-18px) scale(.97)'}],{duration:480,delay:80,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'});
  sw.animate([{transform:`translateY(${slit}px)`,easing:'cubic-bezier(.3,.6,.4,1)'},{transform:`translateY(${Math.round(slit*.35)}px) scale(1.06) rotate(-1.2deg)`,offset:.38,easing:SP.def.easing},{transform:'none'}],{duration:760,fill:'forwards'});
  setTimeout(()=>rig.classList.add('down'),260);
  await sleep(420);guard(r);
  CardFX.live(true);CardFX.kick(-40,110);SND.felt('reward');SND.sfx('pix_sparkle',.45);
  await sleep(150);guard(r);pr.classList.remove('on');cardEnd();   // 제목은 프린터가 다 물러난 뒤에
}
// 카메라 칸의 사진이 작아지며 프린터 윗틈 위에 섰다가 틈 안으로 미끄러져 들어간다(틈 높이에서 잘라 들어가 보이게)
function flyToSlit(from,yIn){
  const l=state.look,a=$('#app').getBoundingClientRect(),b=$('#cardRig').getBoundingClientRect(),sy=b.top-a.top+yIn,cx=b.left-a.left+b.width/2;
  const s=b.width*.36/from.width,w=from.width*s,h=from.height*s,tx=cx-w/2-from.left,ty=sy-h-from.top;
  $('#look').classList.remove('on');
  const fly=document.createElement('div');fly.className='lk-fly';Object.assign(fly.style,px(from),{transformOrigin:'0 0'});
  const pic=new Image();pic.alt='';pic.src=l.src;Object.assign(pic.style,px(l.view||lookRects.cover(l,from.width,from.height)));fly.append(pic);$('#app').append(fly);
  const anim=fly.animate([
    {transform:'translate(0,0) scale(1)',borderRadius:'22px',clipPath:'inset(0 0 0 0)',easing:'cubic-bezier(.4,0,.2,1)'},
    {transform:`translate(${tx}px,${ty}px) scale(${s})`,borderRadius:`${(10/s).toFixed(1)}px`,clipPath:'inset(0 0 0 0)',offset:.62,easing:'cubic-bezier(.55,0,.85,.55)'},
    {transform:`translate(${tx}px,${ty+h}px) scale(${s})`,borderRadius:`${(10/s).toFixed(1)}px`,clipPath:'inset(0 0 100% 0)'}
  ],{duration:900,fill:'forwards'});
  setTimeout(()=>SND.sfx('pix_whoosh_short',.35),420);
  const end=()=>fly.remove();anim.finished.then(end,end);
}

let rolling=false;
$('#toPath').onclick=()=>{if(rolling)return;const viewing=$('#s-card').classList.contains('view');CardFX.stop();if(state.replayOf){const a=state.replayOf;state.replayOf=null;loadState(a);}SND.sfx('pix_whoosh_short',.5);buildRoad();show('s-path');if(viewing){$('#s-card').classList.remove('view');const r=$('#road');r.scrollTop=r.scrollHeight;momMaybe();return;}rolling=true;setTimeout(()=>{rolling=false;},2700);rollRoad();};
$('#changeDream').onclick=()=>{fillLazy('data-dream-src');unpick();$('#s-dream').classList.add('change');show('s-dream');};
$('#meBadge').onclick=()=>openCardView();

/* ══ 내 길 ══ */
const ROAD=[
  {lv:'TOPIK 1'},
  {t:'1화 · 개강 첫날',b:'학생 식당에서 길 묻기',goal:'위치 묻기'},
  {t:'2화 · 동아리 박람회',b:'동갑 친구와 말 놓기',goal:'반말로 바꾸기'},
  {dream:0,goal:'자기소개 하기'},
  {lv:'TOPIK 2'},
  {t:'3화 · 첫 당번',b:'동아리 카페에서 주문 받기',goal:'부탁하기',town:true},
  {t:'4화 · 아픈 날',b:'시험 전날, 병원에 가기',goal:'아픈 곳 말하기'},
  {dream:1,goal:'일정 맞추기'},
  {lv:'TOPIK 3'},
  {dream:2,goal:'의견 말하기'},
  {t:'5화 · 봄 축제',b:'고향 음식 부스 열고, 입구에서 표 확인하기',goal:'내 나라 설명하기'},
  {t:'6화 · 여름 MT',b:'소나기, 자전거, 숙소 앞 평상',goal:'제안하고 거절하기'},
  {lv:'TOPIK 4'},
  {t:'7화 · 가을',b:'사유서를 처음 쓰기',goal:'사정 설명하기'},
  {dream:3,goal:'격식 자리에서 나를 소개하기'},
  {dream:4,goal:'일정 변경 보고하기'},
  {t:'8화 · 가을 축제',b:'국제처에서 내 입으로 말하기',goal:'격식 있게 설득하기'},
  {dream:5,goal:'질문에 답하기'},
  {dream:6,goal:'무대 인사 3분'}
];
const DOT_CROP=[[190,'50% 55%'],[280,'30% 42%'],[240,'72% 60%'],[320,'50% 30%'],[220,'20% 70%'],[300,'78% 38%'],[170,'50% 50%']];
function buildRoad(){
  const D=DREAM[state.dream];
  $('#lightNum').textContent=state.lights;$('#lightIcon').setAttribute('href',state.dream==='actor'?'#seat':'#stick');
  $('#dreamChip').textContent=L(D.chip);$('#whoName').textContent=(state.name||L('유학생'))+' · '+L('1급');
  $('#meBadge').classList.toggle('face',!!state.look);
  $('#meBadge').innerHTML=state.look?faceTile(state.look,44,44,.66):state.name&&/[가-힣]/.test(state.name[0])?`<span style="font-size:19px;font-weight:680;color:#fff">${esc(state.name[0])}</span>`:`<svg viewBox="0 0 24 24"><use href="#${state.dream==='actor'?'seat':'stick'}"/></svg>`;
  let side=0;const rows=[];
  ROAD.forEach((r,i)=>{
    if(r.lv){rows.push(`<div class="lv"><span>${r.lv}</span></div>`);return;}
    const now=i===1,lock=i>1,cls=['node',side++%2?'l':'r'],soon=r.t&&r.t.startsWith('2화');
    if(r.dream!=null)cls.push('dn');if(now)cls.push('now');if(lock)cls.push('locked');
    const title=r.dream!=null?L('꿈 장면'):L(r.t),body=r.dream!=null?L(D.scenes[r.dream]):L(r.b);
    const dot=r.dream!=null?`<span class="dot" style="background-image:url(${IMG[state.dream]});background-size:${DOT_CROP[r.dream][0]}%;background-position:${DOT_CROP[r.dream][1]}"></span>`:`<span class="dot">${now?L('지금'):L('{n}화',{n:(r.t.match(/^(\d+)화/)||[])[1]})}</span>`;
    const done=now&&episodeDone()?`<span class="done-tag">${L('1화 끝')}</span>`:'';
    rows.push(`<div class="${cls.join(' ')}"><span class="txt"><small>${now?`<span class="nw here">${L('지금 여기')}</span>`:''}<span class="nw">${title}</span></small><b>${body}</b><em>${L(r.goal)}</em>${soon?`<span class="town">${L('곧 열려요')}</span>`:''}${r.town?`<span class="town">${L('싱크타운이 열려요')}</span>`:''}${done}</span>${dot}</div>`);
  });
  $('#road').innerHTML=`<div class="goal"><img src="${IMG[state.dream+'Goal']}" alt=""><div class="goal-copy"><i>${L(D.goalEn)}</i><b>${L(D.goal)}</b><span>${L(D.goalSub)}</span><span class="lock"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>${L('4급에서 열려요')}</span></div></div>`
    +`<div class="steps">${rows.reverse().join('')}</div>`
    +`<div class="start">${episodeDone()?`<button class="go-btn" id="goHome" type="button">${L('우리 동네로')}</button><button class="back-btn" id="startEp" type="button">${L('1화 다시 하기')}</button>`:`<button class="go-btn" id="startEp" type="button">${L('1화 시작')}</button><p>${L('한 장면 5분 남짓 · 상대가 먼저 말을 걸어요')}</p><button class="back-btn" id="goHome" type="button">${L('우리 동네 먼저 둘러보기')}</button>`}</div>`;
  $('#startEp').onclick=playScene;$('#goHome').onclick=leave;
  $('#road').classList.toggle('calm',!!state.ringShown);state.ringShown=true;
}
function leave(){if(leaving2)return;leaving2=true;SND.stopAll(.5);save({stage:'left'});HOST?.leave?.();}
let leaving2=false;
function rollRoad(){
  const r=$('#road');r.scrollTop=0;if(reduce){r.scrollTop=r.scrollHeight;return;}
  setTimeout(()=>{const from=0,to=r.scrollHeight-r.clientHeight,t0=performance.now(),dur=2100;
    (function f(t){const k=Math.min(1,(t-t0)/dur),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;r.scrollTop=from+(to-from)*e;if(k<1)requestAnimationFrame(f);else SND.felt('select');})(t0);},400);
}

/* ══ 장면 → 객석 ══
 * 실제 1화는 시범판 틀 하나(식당 장면 → 테이크 2 → 새 상황 → 오늘 기록)다. 시범판을 끊을 수 없으니 카드 → 틀 → 회 끝 객석 한 번으로 잇고,
 * 객석은 세 박자로 켠다(장면에서 말한 줄 · 테이크 2 · 새 상황). 불빛은 실제로 말한 줄만 센다. 설계 6절. */
let playing=false;
const EP='s1e01';
const episodeDone=()=>state.scenes.some(s=>s.id===EP+'.wrap');
const SCENE_TEXT='학생 식당에서 선배에게<br>도서관 가는 길을 물어요';
function playScene(){
  if(playing)return;playing=true;cineLoad();
  Promise.resolve(HOST?.prepareEpisode?.()??{status:'ok'}).then(async got=>{
    if(got?.status!=='ok'){playing=false;return;}   // 로그인 판이 떠 있다. 돌아오면 내 길에서 다시 누른다
    SND.stop('bgm_campus',1.2);SND.stop('amb_campus',1.2);
    /* 첫 판만 카드 밑으로 식당 소리와 이모의 빠른 말 한 줄이 지나간다 — 자막도 해설도 없다(시즌 1 이야기 지도 규칙 2). 소리는 움직임이 아니라 동작 줄이기에서도 같은 시간을 준다. */
    const imo=!state.scenes.length,sc=$('#s-scene');
    $('#sceneWhat').innerHTML=L(SCENE_TEXT);sc.style.setProperty('--fill',imo?'4.6s':'1.9s');SND.sfx('pix_impact_bass_1',.45);show('s-scene');
    if(imo){SND.play('amb_canteen',{vol:.95,fade:.5,bus:'amb'});setTimeout(()=>SND.sfx('sfx_imo',.7),900);setTimeout(()=>SND.stop('amb_canteen',.7),4400);}
    await sleep(imo?5000:(reduce?600:2300));
    SND.stopAll(.3);
    let out=null;try{out=await HOST.openEpisode({onScene:s=>noteScene(s)});}catch{out=null;}
    playing=false;
    if(out?.status==='wrap')crowdScene(out.lines||{});else backToRoad();
  },()=>{playing=false;});
}
function noteScene(s){if(!s?.id||state.scenes.some(x=>x.id===s.id&&s.id!==EP+'.wrap'))return;state.scenes=[...state.scenes,{id:s.id,at:Date.now(),...(s.lines!=null?{lines:s.lines}:{})}].slice(-200);save({scenes:state.scenes});}
function backToRoad(){SND.play('bgm_campus',{vol:.45,fade:1.5});SND.play('amb_campus',{vol:.6,fade:1.5,bus:'amb'});buildRoad();show('s-path');const r=$('#road');r.scrollTop=r.scrollHeight;momMaybe();}
let crowdRun=0;
// 이번 회까지 켜진 자리: 사람은 말한 줄 수만큼, 친구는 테이크 2 · 새 상황을 한 판에 한 마리(지어내지 않는다)
const litSeats=(H,b)=>[...H.data.people.slice(0,b.n),...(b.t2?[H.data.friendSeats[0]]:[]),...(b.tr?[H.data.friendSeats[1]]:[])];
const litCount=()=>Object.values(state.best).reduce((s,b)=>s+b.n+(b.t2?1:0)+(b.tr?1:0),0);
async function crowdScene({n=0,t2=false,tr=false}={}){
  const D=DREAM[state.dream],run=++crowdRun,H=HALLS[state.dream],prev=state.best[EP]||null,first=!prev;
  const was=prev||{n:0,t2:false,tr:false},next={n:Math.max(was.n,Math.max(0,Math.min(H.data.people.length,n))),t2:was.t2||!!t2,tr:was.tr||!!tr};
  state.best={...state.best,[EP]:next};state.lights=litCount();save({best:state.best,lights:state.lights});
  $('#nextWhat').textContent=L('{x}까지',{x:L(D.scenes[0])});$('#nextLeft').textContent=L('2화 다음');
  $('#goalLine').textContent=L('목표까지 늘어나요',{goal:L(D.goal)});
  $('#crowdWhy').textContent=state.dream==='actor'?L('말한 줄마다 내 객석에 한 사람씩 앉아요.'):L('말한 줄마다 내 객석에 불이 하나씩 켜져요.');
  const plus=$('#plus'),count=$('#crowdCount'),foot=$('#crowdFoot'),lab=$('#crowdLab');
  plus.classList.remove('on');plus.textContent='';foot.classList.remove('on');show('s-crowd');
  SND.play('bgm_anthem',{at:ANTHEM_DROP[0]-1.2,vol:.4,fade:1.2});SND.muffle('bgm_anthem',false,3,{from:true});
  ambient(IMG[state.dream==='actor'?'theaterBase':'arenaBase']);
  const P=H.data.people,F=H.data.friendSeats;
  // 첫 판은 세 박자(장면에서 말한 줄 → 테이크 2 → 처음 보는 말). 다시 할 때는 늘어난 만큼 한 번에 — 못 건너뛰는 반복 연출을 만들지 않는다
  const beats=first
    ?[{lab:'1화 · 식당 장면 끝',seats:P.slice(0,next.n)},{lab:'1화 · 한 번 더',seats:next.t2?[F[0]]:[]},{lab:'1화 · 처음 보는 말',seats:next.tr?[F[1]]:[]}].filter(b=>b.seats.length)
    :[{lab:'1화 끝',seats:[...P.slice(was.n,next.n),...(next.t2&&!was.t2?[F[0]]:[]),...(next.tr&&!was.tr?[F[1]]:[])]}].filter(b=>b.seats.length);
  const total=next.n+(next.t2?1:0)+(next.tr?1:0);
  if(!beats.length){
    lab.textContent=L('1화 끝');count.textContent=total?L('말한 줄 {n}개',{n:total}):L('오늘은 들어 본 날이에요');
    drawCinema(litSeats(H,next),[]);foot.classList.add('on');return;
  }
  let shown=first?[]:litSeats(H,was),said=first?0:total-beats[0].seats.length,opening=true;
  for(const b of beats){
    if(run!==crowdRun)return;
    said+=b.seats.length;lab.textContent=L(b.lab);plus.textContent='+'+b.seats.length;void plus.offsetWidth;count.textContent=L('말한 줄 {n}개',{n:said});
    plus.classList.remove('on');drawCinema(shown,b.seats,!opening);opening=false;shown=[...shown,...b.seats];
    const hasFriend=b.seats.some(s=>F.includes(s));
    await sleep(reduce?300:900+b.seats.length*650+(hasFriend?1500:500));
  }
  if(run===crowdRun)foot.classList.add('on');
}
$('#s-crowd').addEventListener('click',e=>{if(e.target.closest('button'))return;$('#crowdFoot').classList.add('on');});
function drawCrowd(before,gain,keep){
  if(!keep)crowdStop();$('#crowdStage').src=IMG[state.dream+'Goal'];
  const c=$('#crowd'),x=c.getContext('2d'),d=devicePixelRatio;c.width=c.offsetWidth*d;c.height=c.offsetHeight*d;
  const W=c.width,H=c.height,col=getComputedStyle(document.body).getPropertyValue('--dream').trim();
  const seats=[],rows=10;
  for(let r=0;r<rows;r++){const k=r/(rows-1),y=H*(.56+.4*Math.pow(k,1.3)),sz=(6+k*30)*d,n=Math.round(W/(sz*1.15));
    for(let i=0;i<n;i++)seats.push({x:(i+.5+(r%2?.45:0))*W/n+(Math.random()-.5)*sz*.7,y:y+(Math.random()-.5)*sz*.5,s:sz,row:r,lit:0,tgt:0,ph:Math.random()*6.28});}
  const pri=r=>r<=5?5-r:20+r,order=seats.slice().sort((a,b)=>(pri(a.row)-pri(b.row))||Math.abs(a.x-W/2)-Math.abs(b.x-W/2));
  before=Math.min(before,Math.max(0,seats.length-gain));
  order.slice(0,before).forEach(s=>s.lit=s.tgt=1);
  const fresh=order.slice(before,before+gain);
  function frame(t){
    x.clearRect(0,0,W,H);
    const fl=x.createLinearGradient(0,H*.5,0,H);fl.addColorStop(0,'rgba(0,0,0,0)');fl.addColorStop(.25,hexA(col,.10));fl.addColorStop(1,hexA(col,.04));x.fillStyle=fl;x.fillRect(0,H*.5,W,H*.5);
    for(const s of seats){
      s.lit+=(s.tgt-s.lit)*.1;
      const hx=s.x+s.s*.32+(s.lit>.5&&!reduce?Math.sin(t/520+s.ph)*s.s*.18:0),hy=s.y-s.s*1.5;
      if(s.lit>.03){
        x.strokeStyle=`rgba(220,226,240,${.5*s.lit})`;x.lineWidth=Math.max(1,s.s*.09);x.beginPath();x.moveTo(s.x+s.s*.32,s.y+s.s*.2);x.lineTo(hx,hy+s.s*.35);x.stroke();
        const R=s.s*2.6,gl=x.createRadialGradient(hx,hy,0,hx,hy,R);
        gl.addColorStop(0,`rgba(255,255,255,${s.lit})`);gl.addColorStop(.16,hexA(col,.9*s.lit));gl.addColorStop(.5,hexA(col,.2*s.lit));gl.addColorStop(1,hexA(col,0));
        x.fillStyle=gl;x.beginPath();x.arc(hx,hy,R,0,7);x.fill();
        x.fillStyle=`rgba(255,255,255,${s.lit})`;x.beginPath();x.ellipse(hx,hy,s.s*.24,s.s*.34,0,0,7);x.fill();
      }
      const px=s.x,py=s.y;
      x.fillStyle='#010207';x.beginPath();x.arc(px,py+s.s*.2,s.s*.5,0,7);x.fill();
      x.beginPath();x.ellipse(px,py+s.s*1.15,s.s*1.0,s.s*.62,0,0,7);x.fill();
      x.strokeStyle=hexA(col,s.row>=rows-2?.16:0);x.lineWidth=Math.max(1,s.s*.06);
      x.beginPath();x.arc(px,py+s.s*.2,s.s*.5,Math.PI*1.15,Math.PI*1.85);x.stroke();
      x.beginPath();x.ellipse(px,py+s.s*1.15,s.s*1.0,s.s*.62,0,Math.PI*1.1,Math.PI*1.3);x.stroke();
      x.beginPath();x.ellipse(px,py+s.s*1.15,s.s*1.0,s.s*.62,0,Math.PI*1.7,Math.PI*1.9);x.stroke();
    }
    window.__crowd=requestAnimationFrame(frame);
  }
  cancelAnimationFrame(window.__crowd);window.__crowd=requestAnimationFrame(frame);
  fresh.forEach((s,i)=>crowdLater(()=>{s.tgt=1;$('#plus').classList.add('on');SND.felt('ok');if(i===0)SND.sfx('sfx_crowd',.3);},reduce?0:900+i*650));
}
/* 객석 보상 공통: 늦게 오는 타이머를 모아 두었다가 화면을 떠날 때 함께 끊는다 — 안 그러면 숨은 화면에서 박수 · 진동이 난다 */
let crowdTimers=[];
function crowdLater(fn,ms){crowdTimers.push(setTimeout(fn,ms));}
function crowdStop(){crowdTimers.forEach(clearTimeout);crowdTimers=[];cancelAnimationFrame(window.__crowd);}
// 돌리거나 크기가 바뀌면 캔버스를 다시 잰다(새로 켜지는 움직임 없이 지금 수만큼)
addEventListener('resize',()=>{if(!$('#s-crowd').classList.contains('on'))return;clearTimeout(window.__crowdRs);
  window.__crowdRs=setTimeout(()=>{if(document.body.classList.contains('no-cine'))drawCrowd(state.lights,0,true);},150);});

/* 1화 끝 보상: 실사 객석(12판 배우 상영관 · 14판 아이돌 콘서트 — 11-03 유호님 「관객석이 너무 AI 같다 — 디자인 사이트 참고해서 제대로」, 11-04 「아이돌도 바꿔 줘」).
 * 배우: 무대에서 본 시사회 상영관(스크린 빛만 닿는 객석 — Sugimoto 「Theaters」, 화면 쪽에서 본 관객 — Eyerman의 LIFE 사진). 말한 줄마다 빈 좌석에 한 사람씩 앉는다.
 * 아이돌: 무대에서 본 어두운 콘서트장. 말한 줄마다 팬 한 사람의 응원봉이 켜지고 그 불빛에 얼굴이 드러난다.
 * 꺼진 판 위에, 같은 자리를 채워 다시 구운 그림에서 오려 둔 조각을 차례대로 제자리에 그린다(앞줄 가운데부터, 앞사람이 뒷사람을 가리면 앞사람 먼저).
 * 다 차면 먼 줄까지 함께 찬다.
 * 세 친구(마린 · 몽글 · 까몽, 11-04 유호님 「사람 사이에 껴서」): 첫 보상은 사람만, 두 번째 · 세 번째 보상에 한 마리씩 사람 크기로 끼고, 처음 앉을 때 속마음 한 줄 — 나중 화에서 되부를 씨앗이다.
 * 캔버스는 그림 해상도 그대로 두고 CSS object-fit으로 맞춘다 — 돌리거나 크기가 바뀌어도 다시 그릴 필요가 없다. */
// 사람 자리와 친구 자리를 나눈다. 객석에 앉는 차례는 crowdScene이 정한다(친구는 박자에 묶는다 — 결정 11-04).
function seatOrder(S){const items=S.seats.concat([S.rest]),friendSeats=S.friends.map(i=>items[i]);return {...S,people:items.filter(x=>!friendSeats.includes(x)),friendSeats};}
const HALLS={
  actor:{data:seatOrder(THEATER),base:'theaterBase',seats:'theaterSeats',sit:true,sfx:['sfx_applause',.4]},
  idol:{data:seatOrder(ARENA),base:'arenaBase',seats:'arenaSeats',sit:false,sfx:['sfx_crowd',.3]}
};
const FRIEND_LINES=['…잠깐, 쟤 누구지?','…또 있네?','…쟤들, 내 팬인가?'];
/* 맨 앞 가운데는 채우지 않는다(자리 자료에 없다). 8화에 내가 엄마의 휴대폰 자리로 고르고, 8화 뒤 「엄마는 밥 먹었어?」 다음에 켜진다. 그때까지 아무도 말로 안 꺼낸다(시즌 1 이야기 지도 규칙 6) */
const cinePics={};
// 그림이 안 풀리면 null로 끝난다(거부를 남기지 않는다) — 다음 장면에서 다시 풀어 본다
function cineLoad(k=state.dream){
  const H=HALLS[k];
  if(!cinePics[k])cinePics[k]=Promise.all([IMG[H.base],IMG[H.seats]].map(src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src;})))
    .catch(()=>{cinePics[k]=null;return null;});
  return cinePics[k];
}
function drawCinema(seated,freshSeats,keep){
  if(!keep)crowdStop();$('#crowdStage').removeAttribute('src');document.body.classList.remove('no-cine');
  const H=HALLS[state.dream],S=H.data,cv=$('#cinema'),x=cv.getContext('2d'),aside=$('#crowdAside'),gain=freshSeats.length;
  if(cv.width!==S.w||cv.height!==S.h){cv.width=S.w;cv.height=S.h;}
  const sat=seated.map(s=>({s,t0:-1e9})),fresh=freshSeats;
  // 이번 보상에 처음 앉는 친구가 있으면 발판과 함께 속마음 한 줄
  const fr=S.friendSeats.some(s=>fresh.includes(s))?Math.min(S.friendSeats.filter(s=>seated.includes(s)&&!fresh.includes(s)).length,FRIEND_LINES.length-1):-1;aside.textContent=fr>=0?FRIEND_LINES[fr]:'';$('#crowdAsideSub').textContent=fr>=0?sub(FRIEND_LINES[fr]):'';aside.hidden=fr<0;
  // 화면에 들어올 때마다 천천히 다가가는 움직임을 처음부터(동작 줄이기면 CSS가 끈다)
  if(!keep){cv.style.animation='none';void cv.offsetWidth;cv.style.animation='';}
  let pics=null;
  // 앉는 사람은 1.1초에 걸쳐 나타나며 몸높이의 4%만큼 내려앉고, 응원봉은 켜지는 순간 잠깐 더 밝다.
  // 먼 줄부터 가까운 줄로 그린다(조각의 아래 끝 기준) — 다른 판에서 온 친구도 앞사람이 덮게
  function paint(t){
    const [base,at]=pics;x.globalAlpha=1;x.drawImage(base,0,0);let moving=false;
    for(const p of sat.slice().sort((a,b)=>a.s[1]+a.s[3]-b.s[1]-b.s[3])){
      const k=reduce?1:Math.min(1,Math.max(0,(t-p.t0)/1100)),e=1-Math.pow(1-k,3);if(k<1)moving=true;
      const [X,Y,w,h,ax,ay]=p.s;x.globalAlpha=e;x.drawImage(at,ax,ay,w,h,X,H.sit?Y-(1-e)*h*.04:Y,w,h);
      if(!H.sit&&k<.45){x.globalCompositeOperation='lighter';x.globalAlpha=(.45-k)*1.6;x.drawImage(at,ax,ay,w,h,X,Y,w,h);x.globalCompositeOperation='source-over';}
    }
    x.globalAlpha=1;
    // 비워 둔 자리에만 옅은 빛(그린 티가 안 나게 넓고 약하게)
    if(S.hole){const [hx,hy,hr]=S.hole,g=x.createRadialGradient(hx,hy,0,hx,hy,hr);g.addColorStop(0,'rgba(255,240,214,.16)');g.addColorStop(.5,'rgba(255,240,214,.05)');g.addColorStop(1,'rgba(255,240,214,0)');x.globalCompositeOperation='screen';x.fillStyle=g;x.fillRect(hx-hr,hy-hr,hr*2,hr*2);x.globalCompositeOperation='source-over';}
    return moving;
  }
  function frame(t){if(pics&&paint(t))window.__crowd=requestAnimationFrame(frame);}
  function kick(){cancelAnimationFrame(window.__crowd);window.__crowd=requestAnimationFrame(frame);}
  const dream=state.dream;
  cineLoad(dream).then(v=>{
    if(!$('#s-crowd').classList.contains('on')||state.dream!==dream)return;
    // 그림을 끝내 못 풀면 그린 응원봉 객석으로 대신한다(검은 화면에 「+2」만 남지 않게)
    if(!v){crowdStop();aside.hidden=true;$('#crowdAsideSub').textContent='';document.body.classList.add('no-cine');drawCrowd(seated.length,gain);return;}
    // 그림이 늦게 풀려 이미 앉았어야 할 사람은 지금부터 앉힌다(늦은 만큼 연출이 사라지지 않게 —
    const now=performance.now();sat.forEach(p=>{if(p.t0>0&&p.t0<now)p.t0=now;});
    pics=v;kick();
  });
  for(let i=0;i<gain;i++)crowdLater(()=>{if(fresh[i]){sat.push({s:fresh[i],t0:performance.now()});kick();}$('#plus').classList.add('on');SND.felt('ok');if(i===0)SND.sfx(H.sfx[0],H.sfx[1]);},reduce?0:900+i*650);
}
function hexA(h,a){const n=parseInt(h.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`;}
$('#backPath').onclick=()=>{crowdRun++;crowdStop();SND.stop('bgm_anthem',1);SND.play('bgm_campus',{vol:.45,fade:1.5});SND.play('amb_campus',{vol:.6,fade:1.5,bus:'amb'});SND.felt('page');buildRoad();show('s-path');const r=$('#road');r.scrollTop=r.scrollHeight;momMaybe();};
/* 1화 끝 쪽지(시즌 1 이야기 지도 1절 · 5절): 엄마가 손글씨를 찍어 보낸다. 고쳐 줘도 되고 「맞아」 해도 되고 안 해도 이야기는 간다. 어느 쪽에도 정답 표시 · 칭찬을 달지 않고, 엄마 글에 펜을 대지 않는다(고친 글자는 다음 쪽지에서 맞게 온다).
 * 쪽지 아래 작은 번역은 실제 앱의 화면 언어 몫(결정 11-03) — 이 시안은 화면이 한국어라 뺐다. */
function momMaybe(){if(episodeDone()&&!state.momSeen)setTimeout(momNote,reduce?200:800);}
const MOM_FIX='있어. ㅅ 두 개!',MOM_OK='맞아.';
function momOptionSubs(){for(const [id,ko] of [['#momFixSub',MOM_FIX],['#momOkSub',MOM_OK]]){const v=sub(ko),el=$(id);el.textContent=v;el.hidden=!v;}}
async function momNote(){
  if(state.momSeen||!$('#s-path').classList.contains('on'))return;
  state.momSeen=true;const r=++RUN,box=$('#mom'),ph=$('#momPhoto');
  momOptionSubs();ph.src=IMG.note1;$('#momList').innerHTML='';$('#momSub').textContent=sub('공부 잘 돼? 친구 잇어? 엄마도 한국말 해 볼래. 맞아?');$('#momSub').hidden=!$('#momSub').textContent;for(const id of ['#momActs','#momLater','#momBye'])$(id).hidden=true;
  box.hidden=false;$('#s-path').inert=true;void box.offsetWidth;box.classList.add('on');$('#momCard').focus({preventScroll:true});
  SND.sfx('pix_notification',.7);SND.level('bgm_campus',.2,.6);
  try{
    await sleep(reduce?0:1500);guard(r);
    $('#momActs').hidden=false;$('#momLater').hidden=false;
  }catch(e){if(e!==SKIP)throw e;}
}
async function momAnswer(fix){
  if($('#momActs').hidden)return;
  const r=++RUN;state.momAnswer=fix?'fix':'ok';save({momAnswer:state.momAnswer,momAt:Date.now()});$('#momActs').hidden=true;$('#momLater').hidden=true;$('#momCard').focus({preventScroll:true});
  const b=document.createElement('div'),said=fix?MOM_FIX:MOM_OK,meaning=sub(said);b.className='mom-b';b.textContent=said;if(meaning){const s=document.createElement('small');s.textContent=meaning;b.append(s);}$('#momList').append(b);SND.felt('tap');
  try{
    await sleep(reduce?0:800);guard(r);
    const k=document.createElement('span');k.className='mom-read';k.dataset.l='읽음';k.textContent=L('읽음');$('#momList').append(k);
    await sleep(reduce?0:700);guard(r);
    $('#momBye').hidden=false;$('#momBye').focus({preventScroll:true});
  }catch(e){if(e!==SKIP)throw e;}
}
function momClose(){++RUN;const box=$('#mom');box.classList.remove('on');$('#s-path').inert=false;SND.level('bgm_campus',.45,.8);SND.felt('page');setTimeout(()=>{box.hidden=true;$('#startEp')&&$('#startEp').focus({preventScroll:true});},reduce?0:360);}
$('#momFix').onclick=()=>momAnswer(true);
$('#momOk').onclick=()=>momAnswer(false);
$('#momLater').onclick=()=>{state.momAnswer='later';save({momAnswer:'later',momAt:Date.now()});momClose();};
$('#momBye').onclick=momClose;

/* ══ 시작: 부모가 정한 자리에서 연다 ══ */
function applyStatic(){
  document.documentElement.lang=LANG;
  document.querySelectorAll('[data-l]').forEach(el=>{el.textContent=L(el.dataset.l||el.textContent.trim());});
  document.querySelectorAll('[data-l-aria]').forEach(el=>{el.setAttribute('aria-label',L(el.dataset.lAria));});
  document.querySelectorAll('[data-l-html]').forEach(el=>{el.innerHTML=L(el.dataset.lHtml);});
  momOptionSubs();
  $('#bigSub').textContent=sub('안녕, 서울.');$('#bigSub').hidden=!$('#bigSub').textContent;
}
function loadState(a){
  if(!a)return;
  Object.assign(state,{dream:a.dream||state.dream,name:a.name??null,nameEn:a.nameEn??null,sign:a.sign??null,from:a.from??null,call:a.call??null,look:a.look?lookById(a.look):null,lights:a.lights||0,best:a.best||{},scenes:a.scenes||[],momSeen:!!a.momAt,momAnswer:a.momAnswer||null,dreamPicked:!!a.dream});
  document.body.dataset.dream=state.dream;
}
if(location.hash!=='#road')warm(WARM.first);
const insets=()=>{const s=HOST?.insets?.();if(!s)return;for(const [k,v] of Object.entries(s))document.documentElement.style.setProperty('--'+k,v+'px');};
// 앱 밖에서 바로 연 판: 화면들을 지우지 않고 가린다 — 크기 바뀜 처리기(거울 · 정문 · 객석)가 지운 요소를 찾다 오류를 내지 않게(11-06 배포 점검)
function outside(){const app=document.getElementById('app'),box=document.createElement('div');box.className='outside';box.innerHTML=`<p>${L('WORLD에서 열어 주세요')}</p><a class="go-btn" href="../?seoul=1" target="_top">${L('WORLD 열기')}</a>`;for(const el of [...app.children])el.style.display='none';app.append(box);}
applyStatic();
SND.ensure();
window.__seoulFrame=Object.freeze({
  // 타이틀을 누른 바로 그 순간(동기). 곡과 번쩍임을 부모의 누름 안에서 시작한다
  begin(){begin();},
  setLang(code){setLang(code);applyStatic();},
  unlock(){SND.unlock();},
  // 1화 끝 띠를 누른 순간에도 소리를 깨운다
  wake(){SND.unlock();},
  start({at='title',handoff=false,arrival=null,replay=false}={}){
    loadState(arrival);insets();if(replay)state.replayOf=arrival;
    if(at==='road'){state.prologue=true;warm(WARM.road(state.dream));buildRoad();$('#s-title').classList.remove('on');show('s-path');const r=$('#road');r.scrollTop=r.scrollHeight;ambient(IMG[state.dream+'Goal']);if(SND.ctx?.state==='running'){SND.play('bgm_campus',{vol:.45,fade:1.5});SND.play('amb_campus',{vol:.6,fade:1.5,bus:'amb'});}else{const go=()=>{document.removeEventListener('pointerdown',go);if($('#s-path').classList.contains('on')){SND.play('bgm_campus',{vol:.45,fade:1.5});SND.play('amb_campus',{vol:.6,fade:1.5,bus:'amb'});}};document.addEventListener('pointerdown',go);}momMaybe();return;}
    warm(WARM.first);ambient(IMG.concert);
    document.body.classList.toggle('handoff',handoff);
    $('#titleSkip').hidden=!state.dreamPicked;
  },
});
window.__seoulQA={state,show,get SND(){return SND;},traceGa,nameTrace,buildRoad,crowdScene,momNote};
if(!HOST){
  if(['127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).has('qa')){window.__seoulFrame.start({at:new URLSearchParams(location.search).get('qa')==='road'?'road':'title'});}
  else outside();
}else{HOST.ready?.(window.__seoulFrame);}
