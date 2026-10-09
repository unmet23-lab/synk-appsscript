import { VoiceBank, WORDS } from './audio.js';
import { createShipShop, DEFAULT_OUTFIT, BADGE_ART } from './shop.js';
import { createStarbook, STARBOOK_ITEM } from './starbook.js';

// Restore the verified account before reading progress or enabling play.
await globalThis.SynkPlayAccount.ready();
let shipShop,starbook;

const $=selector=>document.querySelector(selector),main=$('#main'),voices=new VoiceBank();
const API=document.querySelector('meta[name="spaceship-api"]')?.content||'/api/spaceship';
const EN={red:'red',blue:'blue',up:'up',down:'down',one:'once',two:'twice',three:'three times'};
let session=null,state=null,connecting=false,stopped=false,streamController=null,busy=false,studying=false,helpOpen=false,demo='red',count=0,playedSignal=0,heardSignal=0,listening=false,lastFeedback=0,lastRound=-1,reviewIndex=0,reviewAnswer=null,reviewReady=false,reviewOrder=[],toastTimer,entryError='',transportOnline=false;
let pageAway=false,leaveDestination=null,pendingEntry=null;
const moreGames='<a class="text-button more-games" href="/try/learning-hub/#beginner-title">다른 입문 놀이 / More beginner games</a>';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},5500);$('#live').textContent=message;}
function focusAction(action,word){[...main.querySelectorAll('[data-action]')].find(x=>x.dataset.action===action&&(word===undefined||x.dataset.word===word)&&!x.disabled)?.focus({preventScroll:true});}
function save(){try{session?sessionStorage.setItem('synk-spaceship-session',JSON.stringify(session)):sessionStorage.removeItem('synk-spaceship-session');}catch{toast('이 기기에서는 새로고침 후 이어 하기가 저장되지 않아요. / Keep this page open.');}}
function clearEntry(){pendingEntry=null;try{sessionStorage.removeItem('synk-spaceship-pending-entry');}catch{}}
function entryRequest(type,code){
  const room=type==='join'?code:'';
  if(pendingEntry?.type!==type||pendingEntry.code!==room)pendingEntry={type,code:room,id:id()};
  try{sessionStorage.setItem('synk-spaceship-pending-entry',JSON.stringify(pendingEntry));}catch{toast('이 기기에서는 새로고침 후 입장 재시도가 저장되지 않아요. / Retry before reloading.');}
  return pendingEntry;
}
function load(){
  try{const p=JSON.parse(sessionStorage.getItem('synk-spaceship-session'));if(p&&/^[A-Z2-9]{6}$/.test(p.code)&&/^[A-Za-z0-9_-]{32}$/.test(p.token))session=p;}catch{}
  try{const p=JSON.parse(sessionStorage.getItem('synk-spaceship-pending-entry'));if(p&&['create','join'].includes(p.type)&&/^[a-f0-9]{32}$/.test(p.id)&&(p.type==='create'?p.code==='':/^[A-Z2-9]{6}$/.test(p.code)))pendingEntry=p;}catch{}
}
async function request(route,method='GET',data){
  const response=await fetch(`${API}${route}`,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(session?{Authorization:`Bearer ${session.token}`}:{})},body:data?JSON.stringify(data):undefined,credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(12000)});
  const result=await response.json();if(!response.ok){const error=new Error(result.message||'서버에 연결할 수 없어요. / Connection unavailable.');error.code=result.error;error.status=response.status;throw error;}return result;
}
function update(next){
  if(state&&next.revision<state.revision)return;
  const previousPhase=state?.phase,previousRound=state?.round;state=next;
  if(!['lobby','complete','closed'].includes(state.phase)){document.querySelector('#ship-shop[open]')?.close();document.querySelector('#starbook[open]')?.close();}
  if(state.phase==='complete')starbook?.capture(state);
  if(lastRound!==state.round){lastRound=state.round;helpOpen=false;count=0;demo=state.stage.words[0];}
  const newSignal=state.signal&&state.signal.id!==playedSignal&&state.role==='pilot';
  if(newSignal){playedSignal=state.signal.id;heardSignal=0;count=0;listening=!document.hidden&&!pageAway;}
  render();
  if(previousPhase&&state.phase!=='celebrate'&&(previousPhase!==state.phase||previousRound!==state.round)&&!document.hidden){const heading=main.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus();}}
  if(state.phase==='celebrate'&&previousPhase!=='celebrate'&&state.role==='pilot'&&!document.hidden)main.querySelector('[data-action="next"]')?.focus();
  if(newSignal){if(!document.hidden&&!pageAway)listenSignal();$('#live').textContent='친구의 소리가 도착했어요. / Your friend sent a sound.';}
  if(state.feedback&&state.feedback.id!==lastFeedback){lastFeedback=state.feedback.id;voices.effect(state.feedback.effect);}
  if(state.phase==='complete')shipShop?.award(state);
  if(state.phase==='complete'&&previousPhase!=='complete'){voices.effect('launch');$('#live').textContent='함께 이륙했어요! / You launched together!';}
}
async function listenSignal(){
  const signal=state?.signal;if(!signal)return;heardSignal=0;listening=true;render();
  try{const completed=await voices.play(signal.clip);if(state?.signal?.id===signal.id){if(completed)heardSignal=signal.id;listening=false;render();}}
  catch(e){if(state?.signal?.id===signal.id){listening=false;heardSignal=0;render();}toast(e.message);}
}
async function send(type,fields={}){
  if(busy||!state)return null;if(!transportOnline&&type!=='leave'){toast('연결을 다시 찾으면 계속해요. / Wait for the connection to return.');return null;}busy=true;
  const body={type,id:id(),revision:state.revision,...fields};
  try{
    let result;for(let attempt=0;attempt<2;attempt++){
      try{result=await request(`/rooms/${session.code}/commands`,'POST',body);break;}
      catch(e){if(e.code==='REVISION'&&attempt===0){update(await request(`/rooms/${session.code}/state`));body.revision=state.revision;continue;}throw e;}
    }
    if(result)update(result);return result;
  }catch(e){
    // A previous leave may have succeeded while its response and SSE update were
    // lost. Only these exact server statuses confirm that the room cannot continue.
    if(type==='leave'&&((e.code==='CLOSED'&&e.status===410)||(e.code==='ROOM_MISSING'&&e.status===404)))return {phase:'closed',confirmed:true,reason:e.code};
    toast(e.message);return null;
  }finally{busy=false;}
}
async function stream(){
  if(connecting||stopped||!session||pageAway)return;connecting=true;let retry=700;
  while(!stopped&&session&&!pageAway){
    streamController=new AbortController();
    try{
      const response=await fetch(`${API}/rooms/${session.code}/events`,{headers:{Authorization:`Bearer ${session.token}`},credentials:'omit',cache:'no-store',signal:streamController.signal});
      if(!response.ok){const e=await response.json();if(['ROOM_MISSING','AUTH','CLOSED'].includes(e.error)){entryError=e.message;forget();render();break;}throw new Error(e.message);}
      transportOnline=true;retry=700;const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
      while(!stopped){
        const part=await reader.read();if(part.done)break;pending+=decoder.decode(part.value,{stream:true});
        let boundary;while((boundary=pending.indexOf('\n\n'))>=0){
          const block=pending.slice(0,boundary);pending=pending.slice(boundary+2);const type=block.match(/^event: (.+)$/m)?.[1],data=block.match(/^data: (.+)$/m)?.[1];
          if(type==='state'&&data)update(JSON.parse(data));
          if(type==='replaced'){stopped=true;transportOnline=false;entryError='다른 창에서 이어 하고 있어요. 원래 탐험은 그 창에서 계속해 주세요. / This player is active in another tab.';render();break;}
          if(type==='expired'||type==='shutdown'){entryError=type==='expired'?'방이 만료되었어요. 새 탐험을 만들어요. / This room has expired.':'서버가 다시 시작되어 진행 중인 방이 닫혔어요. 잠시 뒤 새 탐험을 만들어요. 계정에 저장한 코인과 수집품은 그대로예요. / The server restarted. Start a new expedition shortly; your saved account collection is safe.';forget();render();break;}
        }
      }
      if(!stopped)throw new Error('연결을 다시 찾고 있어요. / Reconnecting…');
    }catch(e){
      if(stopped||e.name==='AbortError')break;transportOnline=false;render();
      await new Promise(resolve=>setTimeout(resolve,retry));retry=Math.min(retry*1.7,8000);
    }
  }
  connecting=false;
  if(!stopped&&session&&!pageAway&&streamController?.signal.aborted)stream();
}
function forget(){stopped=true;streamController?.abort();session=null;state=null;clearEntry();inReview=false;voices.stop();heardSignal=0;playedSignal=0;lastFeedback=0;lastRound=-1;reviewReady=false;listening=false;save();$('#leave-top').hidden=true;const url=new URL(location.href);if(url.searchParams.has('room')){url.searchParams.delete('room');history.replaceState(null,'',url);}}
function interruptAudio(){voices.stop();heardSignal=0;listening=false;reviewReady=false;render();}
function picture(word,{label=true}={}){
  const a=label?`role="img" aria-label="${esc(EN[word])}"`:'aria-hidden="true"';
  if(word==='red'||word==='blue')return `<span class="disc ${word==='blue'?'blue':''}" ${a}>${word==='red'?'▲':'●'}</span>`;
  if(word==='up'||word==='down')return `<span class="arrow" ${a}>${word==='up'?'↑':'↓'}</span>`;
  return `<span class="star-group" ${a}>${Array.from({length:{one:1,two:2,three:3}[word]||0},()=>'<i class="pump-dot"></i>').join('')}</span>`;
}
function ship(progress=0,effect='',look=shipShop?.outfit()||DEFAULT_OUTFIT){
  const systems=[Math.min(6,progress),Math.max(0,Math.min(6,progress-6)),Math.max(0,Math.min(6,progress-12))];
  return `<figure class="scene ${esc(effect)}" data-sky="${esc(look.sky)}" data-badge="${esc(look.badge)}" aria-label="${progress===18?'모든 장치를 고친 우주선':'펠트 우주선, '+progress+'개 장치 수리'}"><div class="space-glow" aria-hidden="true"></div><div class="planet" aria-hidden="true"><i></i></div><i class="star s1"></i><i class="star s2"></i><i class="star s3"></i><i class="star s4"></i><div class="launch-pad" aria-hidden="true"></div><div class="craft"><div class="engine-plume left ${progress>=3?'hot':''}"></div><div class="engine-plume right ${progress>=6?'hot':''}"></div><img class="craft-sprite" src="assets/art/felt-rocket-v2.webp" width="768" height="1152" alt=""><div class="cockpit"><img src="assets/brand/mongle-${effect==='complete'?'cheer':effect==='spin'||effect==='bubbles'?'curious':'smile'}.webp" alt=""></div><img class="ship-emblem" src="assets/felt/${BADGE_ART[look.badge]||BADGE_ART.sparkle}.webp" alt=""><span class="antenna-beacon left ${progress>=8?'active':''}"></span><span class="antenna-beacon right ${progress>=12?'active':''}"></span></div>${[15,27,60,72].map((x,i)=>`<i class="bubble" style="--x:${x}%;--delay:${i*.12}s"></i>`).join('')}<figcaption class="scene-caption"><span>${progress===18?'READY FOR THE STARS':'OUR LITTLE SHIP'}</span><strong>${progress===18?'함께 띄울 준비 완료':progress===0?(!state||state.phase==='lobby'?'두 탐험가를 기다려요':'함께 고치는 중이에요'):`${progress} / 18 · 하나씩 살아나는 우주선`}</strong></figcaption><div class="ship-systems" role="group" aria-label="엔진·안테나·연료 수리 / Engine, antenna and fuel repairs">${['ENGINE','ANTENNA','FUEL'].map((name,i)=>`<span class="${systems[i]===6?'online':''}" aria-label="${name}: ${systems[i]} / 6"><b>${['엔진','안테나','연료'][i]}</b><small>${name}</small><i style="--charge:${systems[i]/6}"></i></span>`).join('')}</div></figure>`;
}
function entry(){
  const joinCode=(new URL(location.href).searchParams.get('room')||'').replace(/[^A-Za-z2-9]/g,'').slice(0,6).toUpperCase();
  main.innerHTML=`<section class="hero"><div><span class="eyebrow">YOUR FIRST KOREAN · TWO PLAYERS</span><h1>둘이서<br><span class="marker">우주선 고치기</span></h1><p>나는 설명서, 너는 조종판.<br>한국어 소리를 주고받으며<br>우리 둘의 우주선을 띄워요.</p><p class="sub" lang="en">You see the manual. Your friend sees the controls.<br>Learn seven Korean sounds and launch together.</p><div class="tags"><span class="tag">2명 / 2 players</span><span class="tag">처음부터 / First words</span><span class="tag">시간 제한 없음 / No timer</span></div><button class="text-button" data-book-open>탐험 기록과 무료 소리 듣기 / Expedition collection & sounds</button></div>${ship()}</section>
  ${entryError?`<p class="error" role="alert">${esc(entryError)}</p>`:''}
  ${session?`<section class="paper"><h2>하던 탐험으로 돌아갈까요?</h2><p>방 ${esc(session.code)} · 이 기기의 자리로 돌아가요.</p><button class="felt coral" data-action="resume">소리 켜고 이어 하기 / Resume</button><button class="text-button" data-action="forget">이 기기의 입장 정보 지우기 / Forget session</button></section>`:
  `<section class="lobby-grid"><article class="paper"><span class="eyebrow">01 / INVITE A FRIEND</span><h2>함께 탈 친구를 초대해요</h2><p class="sub">각자 다른 화면에서 해요. 휴대폰 두 대 또는 컴퓨터와 휴대폰을 준비해요.<br><span lang="en">Use two separate screens on a shared game address.</span></p><button class="felt coral" data-action="create">탐험 만들기 <small lang="en">Create an expedition</small></button><p class="fine">소리를 먼저 확인해요. 마이크는 필요 없어요.<br><span lang="en">Sound on. No microphone needed.</span></p></article><article class="paper"><span class="eyebrow">02 / GOT A CODE?</span><h2>친구가 만든 탐험으로</h2><form class="join-form" id="join-form"><label class="sr" for="room-input">방 코드 6자리 / Six-character room code</label><input id="room-input" name="room" value="${joinCode}" placeholder="ABC123" minlength="6" maxlength="6" pattern="[A-Za-z2-9]{6}" autocomplete="off" autocapitalize="characters" spellcheck="false" required><button class="felt cream" type="submit">입장<small>Join</small></button></form><p class="fine">친구와 같은 게임 주소에서 방 코드를 넣어요.<br><span lang="en">Open the same game address and enter your friend’s code.</span></p></article></section>`}
  <p class="network-note">친구에게는 초대 링크를 보내 주세요. 각자 다른 화면과 소리가 필요해요. 마이크는 필요 없어요.<br><span lang="en">You need a friend, two separate screens and sound. Share the invite link. No microphone is needed.</span></p>${['127.0.0.1','localhost'].includes(location.hostname)?'<p class="fine local-note">현재 주소는 이 컴퓨터에서만 열려요. 여기서는 서로 다른 브라우저로 시험할 수 있어요.<br><span lang="en">This local address works only on this computer. Use two different browsers to try it here.</span></p>':''}<p class="solo-link">지금은 혼자인가요? / Playing alone? ${moreGames}</p><p class="fine">연습: 색 · 위치 · 횟수 듣기와 표현 선택. TOPIK I 듣기에 필요한 기초 표현을 준비해요. 점수는 이 탐험의 행동 기록이며, 학습 향상을 입증하지 않아요.</p>`;
}
function roomLobby(){
  const me=state.players[state.slot],partner=state.players[1-state.slot];
  const invite=new URL(location.href);invite.search='';invite.searchParams.set('room',state.code);
  main.innerHTML=`<section class="hero"><div><span class="eyebrow">CREW CHECK · BEFORE TAKEOFF</span><h1>친구와<br><span class="marker">함께 출발해요</span></h1><p>한 명은 그림 설명서,<br>한 명은 조종판을 맡아요.<br>장치 하나를 고칠 때마다 바꿔요.</p><p class="sub" lang="en">One manual, one control panel.<br>Swap roles after each repair.</p></div>${ship()}</section><div class="lobby-grid"><section class="paper"><h2>초대 코드 / Invite code</h2><div class="code-row"><p class="room-code">${state.code}</p><button class="felt cream" data-action="copy-code">복사 / Copy</button></div><label class="fine" for="invite-url">친구에게 보낼 링크 / Invite link</label><input class="inline-input" id="invite-url" readonly value="${esc(invite.href)}"><button class="felt cream" data-action="copy-link">초대 링크 복사 / Copy link</button>${['127.0.0.1','localhost'].includes(location.hostname)?'<p class="fine">현재 주소는 이 컴퓨터에서만 열려요. 같은 컴퓨터의 다른 브라우저에서 시험하거나, 운영자가 제공한 접속 주소를 사용해요.<br><span lang="en">This local link works only on this computer. Try a second browser here, or use a shared address provided by the host.</span></p>':''}</section><section class="paper"><h2>우리 탐험대 / Our crew</h2><div class="crew">${state.players.map((p,i)=>`<article class="crew-member ${p.connected?'connected':''}"><img src="assets/brand/mongle-${i===0?'smile':'cheer'}.webp" alt=""><h3>${i===state.slot?'나 / You':'친구 / Friend'}</h3><p>${p.ready?'준비 완료 / Ready':p.connected?'연결됐어요 / Connected':p.present?'돌아오는 중 / Reconnecting':'기다리는 중 / Waiting'}</p></article>`).join('')}</div><button class="felt coral" data-action="ready" ${!transportOnline||!partner.connected||me.ready?'disabled':''}>${me.ready?'친구의 준비를 기다려요 / Waiting':partner.connected?'준비됐어요 / Ready':'친구가 들어오면 시작해요 / Waiting for friend'}</button><p class="fine">헤드폰이나 이어폰을 끼면 서로의 소리가 겹치지 않아요.</p></section></div>`;
}
function header(){return `<header class="stage-header"><div><span class="eyebrow">${state.stage.index+1} / 3 · ${esc(state.stage.en.toUpperCase())}</span><h1>${esc(state.stage.name)}</h1><div class="progress" role="progressbar" aria-label="수리한 장치" aria-valuemin="0" aria-valuemax="18" aria-valuenow="${state.round}">${Array.from({length:18},(_,i)=>`<span class="${i<state.round?'done':i===state.round?'current':''}"></span>`).join('')}</div></div><span class="role">${state.role==='navigator'?'그림 설명서':'조종판'}<small>${state.role==='navigator'?'MANUAL':'CONTROLS'} · ${state.slot+1}P</small></span></header>`;}
function paused(){return !transportOnline||state.paused?`<aside class="paused" role="status"><strong>${!transportOnline?'연결을 다시 찾고 있어요.':'친구가 돌아오기를 기다려요.'}</strong><p lang="en">${!transportOnline?'Reconnecting. You can return while this temporary room is open.':'Your friend disconnected. The expedition is paused.'}</p><p>방 코드는 ${state.code}. 방이 열려 있는 동안 같은 자리로 돌아와요. 조작은 둘 다 연결되면 다시 열려요. 진행 중인 방은 30분 동안 조작이 없거나 서버가 다시 시작되면 닫혀요.</p></aside>`:'';}
function studyCards(words,action='study'){return `<div class="words ${words.length===3?'three':''}">${words.map((word,i)=>`<button class="word-btn ${state.studied.includes(word)&&action==='study'?'learned':''}" data-action="${action}" data-word="${word}" aria-label="${esc(WORDS[word])}, ${EN[word]}, 소리 듣기" ${action==='study'&&studying?'disabled':''}>${action==='help-word'?picture(word,{label:false}):''}<span>${WORDS[word]}</span><small>${EN[word]} · ♪</small></button>`).join('')}</div>`;}
function tutorial(){
  const ready=state.players[state.slot].ready,all=state.stage.words.every(x=>state.studied.includes(x));
  main.innerHTML=`${paused()}<header class="tutorial-head"><span class="eyebrow">LEARN FIRST · NO TIMER</span><h1>먼저 ${state.stage.words.length}가지 소리를 만나요</h1><p class="sub" lang="en">Tap each word. Watch what it means.</p></header><section class="tutorial-grid"><article class="tutorial-art"><div class="demo-item" id="demo-item">${picture(demo)}</div><div class="demo-label">${WORDS[demo]}</div><div class="meaning">${EN[demo]}</div></article><article class="paper"><h2>${esc(state.stage.name)}</h2><p class="sub">그림을 보며 하나씩 눌러 들어요. 처음엔 함께 배우고, 그다음에 역할을 나눠요.</p>${studyCards(state.stage.words)}<button class="felt coral" data-action="ready" ${!all||ready||state.paused||!transportOnline?'disabled':''}>${ready?'친구도 연습 중이에요 / Waiting for friend':all?'알겠어요, 함께 해 볼게요 / Let’s play':'모든 소리를 한 번씩 들어요 / Listen to each sound'}</button><p class="fine">버튼의 소리를 따라 말해도 좋아요. 말하기는 자동 채점하지 않아요.</p></article></section>`;
}
function feedback(){
  const f=state.feedback;if(!f)return '';
  const title=f.success?'둘이 해냈어요!':f.listeningCorrect?'들은 소리대로 잘 움직였어요.':'우주선이 장난을 치네요!';
  const text=f.success?'이 장치가 살아났어요. 다음에는 역할을 바꿔요.':f.listeningCorrect?'설명서 친구가 그림을 다시 보고 소리를 보내요.':'소리를 다시 듣고 조종판을 한 번 더 눌러 봐요.';
  return `<div class="feedback ${f.success?'good':''}" role="status"><strong>${title}</strong><p>${text}</p><p lang="en">${f.success?'Repaired! Swap roles at the next device.':f.listeningCorrect?'You matched the sound. Your friend should check the manual again.':'Listen again and try another control.'}</p></div>`;
}
function helper(){return helpOpen?`<section class="help-sheet"><h3>소리 연습장 / Sound guide</h3><p class="fine">필요할 때 보고 다시 들어요. 도움 사용으로 기록돼요.</p>${studyCards(state.stage.words,'help-word')}<button class="text-button" data-action="close-help">연습장 닫기 / Close</button></section>`:'';}
function playScreen(){
  const navigator=state.role==='navigator',locked=state.paused||!transportOnline,done=state.phase==='celebrate',signal=!!state.signal;
  const disabled=locked||done?'disabled':'';
  let panel;
  if(navigator){
    panel=`<span class="eyebrow">ONLY YOU CAN SEE THE MANUAL</span><h2>이 그림을 소리로 전해요</h2><p class="instruction" lang="en">Your friend cannot see this picture. Send the matching sound.</p><div class="manual-sheet"><span class="manual-number">REPAIR ${String(state.round+1).padStart(2,'0')}<b>${esc(state.device)}</b></span><div class="target-picture">${picture(state.target)}</div><p class="target-caption">이 그림은 나에게만 보여요 / Only on your screen</p></div><div class="words transmit ${state.stage.words.length===3?'three':''}">${state.stage.words.map(word=>`<button class="word-btn" data-action="signal" data-word="${word}" ${disabled}><span>${WORDS[word]}</span><small>♪ 소리 보내기 / Send</small></button>`).join('')}</div><p class="status-line">${done?'친구가 다음 장치로 이동해요. / Waiting to swap roles':signal?'소리를 보냈어요. 친구가 조작해요. / Sound sent':'그림과 같은 뜻의 말을 골라요. / Choose a sound'}</p>`;
  }else{
    panel=`<span class="eyebrow">ONLY YOU HAVE THE CONTROLS</span><h2>친구의 소리를 듣고 조작해요</h2><p class="instruction" lang="en">Listen to your friend, then use the controls.</p>${signal?`<button class="felt cream listen-button" data-action="replay" ${locked||done?'disabled':''}>♪ 다시 듣기 / Listen again</button>`:'<p class="waiting-signal"><span class="receiver-light" aria-hidden="true"></span>친구가 설명서를 보고 소리를 보내요.<br><span lang="en">Waiting for your friend’s sound…</span></p>'}`;
    const block=disabled||!signal||heardSignal!==state.signal?.id?'disabled':'';
    if(signal&&!done&&heardSignal!==state.signal.id)panel+=`<p class="fine" role="status">${listening?'먼저 끝까지 들어요. / Listen to the whole sound first.':'소리를 다시 들어요. 끝까지 들으면 조작이 열려요. / Listen again to unlock the controls.'}</p>`;
    if(state.stage.id==='count')panel+=`<div class="count-control"><button class="pump-button" data-action="pump" aria-label="연료 한 번 넣기 / Pump once" ${block||count>=3?'disabled':''}>↓</button><span class="counter" aria-live="polite">${count}</span></div><div class="count-stars" aria-hidden="true">${Array.from({length:count},()=>'<i class="pump-dot"></i>').join('')}</div><div class="button-row"><button class="felt cream" data-action="reset-count" ${block}>다시 / Reset</button><button class="felt coral" data-action="submit-count" ${block||count<1?'disabled':''}>넣었어요 / Done</button></div>`;
    else panel+=`<div class="controls ${state.stage.id==='position'?'move-control':''}"><div class="words">${state.stage.words.map(word=>`<button class="word-btn ${state.feedback?.choice===word?'selected':''}" data-action="act" data-word="${word}" aria-label="${EN[word]} ${state.stage.id==='color'?'button':'antenna'}" ${block}>${picture(word,{label:false})}</button>`).join('')}</div></div>`;
  }
  panel+=feedback();if(done&&!navigator)panel+=`<button class="felt coral listen-button" data-action="next" ${locked?'disabled':''}>다음 장치로<small>Swap roles & continue</small></button>`;
  if(!done)panel+=`<div class="panel-footer"><button class="text-button" data-action="help" ${locked?'disabled':''}>소리 연습장 / Sound guide</button><span class="fine">${state.round+1} / 18 · 시간 제한 없음</span></div>${helper()}`;
  main.innerHTML=`${header()}${paused()}<section class="game-grid"><article class="paper console">${panel}</article><aside>${ship(state.round+(done?1:0),state.feedback?.effect||'')}<p class="device-label">${esc(state.device)}<small>${navigator?'친구에게 말을 보내면, 우주선이 움직여요.':'내 조작이 우리 우주선을 바꿔요.'}</small></p></aside></section>`;
}
function launch(){const armed=state.players[state.slot].launch;main.innerHTML=`<section class="result"><span class="eyebrow">ALL SYSTEMS READY</span><h1>모두 고쳤어요.<br><span class="marker">이제 함께 이륙!</span></h1><p lang="en">All eighteen devices work. Both explorers press Launch.</p>${paused()}<div class="result-grid">${ship(18)}<article class="paper"><h2>둘이 함께 누르면 출발해요</h2><div class="crew">${state.players.map((p,i)=>`<div class="crew-member"><h3>${i===state.slot?'나 / You':'친구 / Friend'}</h3><p>${p.launch?'출발 준비 완료 / Ready':'출발 버튼을 기다려요 / Waiting'}</p></div>`).join('')}</div><button class="felt coral" data-action="launch" ${armed||state.paused||!transportOnline?'disabled':''}>${armed?'친구와 함께 출발할게요 / Waiting':'함께 이륙! / Launch together!'}</button></article></div></section>`;}
function result(){
  const s=state.summary;
  main.innerHTML=`<section class="result"><span class="eyebrow">EXPEDITION COMPLETE · TOGETHER</span><h1><span class="marker">우리 둘이 띄웠어요!</span></h1><p lang="en">Seven Korean expressions. Eighteen repairs. One shared launch.</p><div class="result-grid">${ship(18,'complete')}<article class="paper"><div class="badge-result" aria-hidden="true"></div><h2>첫 우주 탐험대</h2><div class="metrics"><div class="metric"><strong>${s.repaired}</strong><span>함께 고친 장치 / Repairs</span></div><div class="metric"><strong>${s.expressions}</strong><span>함께 쓴 표현 / Expressions</span></div></div><p class="fine">내가 들은 소리와 같은 조작 ${state.stats.listeningCorrect} / ${state.stats.listeningAttempts}번 · 다시 듣기 ${state.stats.replays}번 · 연습장 ${state.stats.help}번</p><p class="fine">친구와 도움을 주고받은 탐험 기록이에요. 혼자서 기억하는지와 실제 학습 효과는 별도로 확인해요.</p><button class="felt coral" data-action="review">혼자 소리 3개 떠올리기 / Quick recall</button><button class="text-button" data-action="new">새 탐험 만들기 / A new expedition</button>${shipShop?.rewardMarkup(state)||''}${starbook?.captureMarkup()||''}</article></div><section class="paper" style="margin-top:24px;text-align:left"><h2>오늘 함께 쓴 말 / Today’s sounds</h2>${Object.entries(WORDS).map(([key,text])=>`<div class="review-row"><div><strong>${text}</strong> <span class="meaning">${EN[key]}</span></div><button class="felt cream" data-action="help-word" data-word="${key}">♪ 다시 듣기 / Listen</button></div>`).join('')}</section></section>`;
}
function review(){
  const word=reviewOrder[reviewIndex],group=['red','blue'].includes(word)?['red','blue']:['up','down'].includes(word)?['up','down']:['one','two','three'];
  if(reviewIndex>=reviewOrder.length){main.innerHTML=`<section class="result paper"><div class="badge-result" aria-hidden="true"></div><h1>소리를 다시 떠올렸어요</h1><p>친구 없이 들어 본 짧은 복습이에요. 다음에 만났을 때도 기억나는지 다시 들어 봐요.</p><p class="sub" lang="en">A short solo recall. Listen again another day.</p><button class="felt coral" data-action="back-result">탐험 사진으로 돌아가기 / Back to expedition</button></section>`;return;}
  main.innerHTML=`<section class="result" style="max-width:600px"><span class="eyebrow">SOLO RECALL · ${reviewIndex+1} / 3</span><h1>소리만 듣고 골라요</h1><p lang="en">No manual this time. Which picture matches the sound?</p><button class="felt cream listen-button" data-action="recall-listen">♪ 소리 듣기 / Listen</button><div class="words ${group.length===3?'three':''} controls">${group.map(x=>`<button class="word-btn" data-action="recall-answer" data-word="${x}" aria-label="${EN[x]}" ${reviewAnswer||!reviewReady?'disabled':''}>${picture(x,{label:false})}</button>`).join('')}</div>${reviewAnswer?`<div class="feedback ${reviewAnswer===word?'good':''}"><strong>${reviewAnswer===word?'기억했어요!':'다시 만나도 괜찮아요.'}</strong><p>${WORDS[word]} · ${EN[word]}</p></div><button class="felt coral listen-button" data-action="recall-next">다음 / Next</button>`:''}<button class="text-button" data-action="back-result">탐험으로 돌아가기 / Back</button></section>`;
}
async function listenRecall(){const index=reviewIndex;reviewReady=false;render();try{const completed=await voices.play(reviewOrder[index]);if(inReview&&reviewIndex===index){reviewReady=completed;render();}}catch(e){toast(e.message);}}
let inReview=false;
function render(){
  document.body.dataset.phase=state?.phase||'entry';document.body.dataset.round=String(state?.round??'');
  const focus=document.activeElement?.dataset;const action=focus?.action,word=focus?.word;
  $('#leave-top').hidden=!state||state.phase==='closed';
  $('#ship-shop-open').hidden=!!state&&!['lobby','complete','closed'].includes(state.phase);
  if(!state||stopped){entry();return;}
  if(inReview){review();main.insertAdjacentHTML('beforeend',moreGames);if(action)focusAction(action,word);return;}
  if(state.phase==='closed'){main.innerHTML='<section class="result paper"><h1>탐험을 마쳤어요</h1><p>한 사람이 나가서 이 탐험은 끝났어요.</p><p lang="en">A player left this expedition.</p><button class="felt coral" data-action="new">새 탐험으로 / Start again</button>'+moreGames+'</section>';return;}
  ({lobby:roomLobby,tutorial,playing:playScreen,celebrate:playScreen,launch,complete:result}[state.phase]||entry)();
  if(state.phase==='complete')main.insertAdjacentHTML('beforeend',moreGames);
  if(action)focusAction(action,word);
}
async function enter(type,code){
  if(busy)return;busy=true;entryError='';const controls=[...main.querySelectorAll('button,input')];controls.forEach(x=>x.disabled=true);toast('소리를 준비하고 있어요. / Preparing Korean audio…');
  try{
    await voices.prepare();
    if(type==='create'||type==='join'){
      // The server may accept the request before its response is lost. Reuse its
      // ID on retry/reload to recover the same room and participant, not a new seat.
      const pending=entryRequest(type,code);
      session=await request(type==='create'?'/rooms':`/rooms/${code}/join`,'POST',{id:pending.id});
      save();clearEntry();
    }
    save();stopped=false;transportOnline=false;playedSignal=0;lastRound=-1;update(await request(`/rooms/${session.code}/state`));clearTimeout(toastTimer);$('#toast').hidden=true;stream();
  }catch(e){
    // Throttling, capacity and server interruptions cannot prove that an earlier
    // POST was rejected. Keep its ID unless the room/schema rejection is final.
    if(['ROOM_MISSING','FULL','SCHEMA'].includes(e.code))clearEntry();
    entryError=e.message;render();
  }finally{busy=false;}
}
async function copy(value){try{await navigator.clipboard.writeText(value);toast('복사했어요. / Copied.');}catch{const input=$('#copy-value');input.value=value;$('#copy-dialog').showModal();input.focus();input.select();input.setSelectionRange(0,value.length);}}
main.addEventListener('submit',e=>{if(e.target.id==='join-form'){e.preventDefault();const code=$('#room-input').value.toUpperCase();if(/^[A-Z2-9]{6}$/.test(code))enter('join',code);}});
main.addEventListener('click',async e=>{
  if(e.target.closest('[data-shop-open]'))return shipShop?.open(e.target.closest('[data-shop-open]').dataset.shopOpen);
  if(e.target.closest('[data-book-open]'))return starbook?.open();
  if(e.target.closest('[data-book-save-retry]')){await starbook?.retry();return render();}
  if(e.target.closest('[data-shop-reward]'))return shipShop?.award(state,{retry:true});
  const button=e.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action,word=button.dataset.word;
  if(action==='create'||action==='resume')return enter(action);
  if(action==='forget'){forget();entryError='';stopped=false;return render();}
  if(action==='copy-code')return copy(state.code);
  if(action==='copy-link')return copy($('#invite-url').value);
  if(action==='ready'||action==='launch'||action==='next')return send(action);
  if(action==='study'){
    if(busy||studying)return;studying=true;demo=word;render();const el=$('#demo-item');el?.classList.add('tutorial-demo-active');
    try{if(await voices.play(word))await send('study',{clip:word});}catch(error){toast(error.message);}finally{studying=false;render();if(!document.hidden&&!document.querySelector('dialog[open]'))main.querySelector(`[data-action="study"][data-word="${word}"]`)?.focus({preventScroll:true});}return;
  }
  if(action==='signal'){if(await send('send',{clip:word}))voices.play(word).catch(x=>toast(x.message));return;}
  if(action==='act')return send('act',{choice:word});
  if(action==='pump'){count=Math.min(3,count+1);voices.effect('pump');render();if(count===3)focusAction('submit-count');return;}
  if(action==='reset-count'){count=0;return render();}
  if(action==='submit-count')return send('act',{choice:['','one','two','three'][count]});
  if(action==='replay'){if(await send('replay'))await listenSignal();return;}
  if(action==='help'){if(await send('help')){helpOpen=true;render();}return;}
  if(action==='close-help'){helpOpen=false;render();focusAction('help');return;}
  if(action==='help-word')return voices.play(word).catch(x=>toast(x.message));
  if(action==='new'){if(state?.phase!=='complete'&&state?.phase!=='closed')await send('leave');forget();entryError='';stopped=false;render();focusAction('create');return;}
  if(action==='review'){
    const random=arr=>arr[Math.floor(Math.random()*arr.length)];reviewOrder=[random(['red','blue']),random(['up','down']),random(['one','two','three'])];reviewIndex=0;reviewAnswer=null;reviewReady=false;inReview=true;const playback=listenRecall();focusAction('recall-listen');await playback;return;
  }
  if(action==='recall-listen')return listenRecall();
  if(action==='recall-answer'){reviewAnswer=word;voices.effect(word===reviewOrder[reviewIndex]?'repair':'bubbles');render();main.querySelector('[data-action="recall-next"]')?.focus();return;}
  if(action==='recall-next'){reviewIndex++;reviewAnswer=null;reviewReady=false;render();if(reviewIndex<reviewOrder.length){const playback=listenRecall();focusAction('recall-listen');await playback;}else focusAction('back-result');return;}
  if(action==='back-result'){voices.stop();inReview=false;render();focusAction('review');return;}
});
$('#leave-top').addEventListener('click',()=>{leaveDestination=null;if(state?.phase==='complete'){forget();entryError='';stopped=false;render();}else $('#leave-dialog').showModal();});
$('#world-link').addEventListener('click',e=>{if(state&&!['complete','closed'].includes(state.phase)){e.preventDefault();leaveDestination=e.currentTarget.href;$('#leave-dialog').showModal();}});
$('#leave-dialog').addEventListener('click',async e=>{
  const action=e.target.closest('[data-dialog]')?.dataset.dialog;if(!action)return;$('#leave-dialog').close();
  if(action==='confirm'){
    if(busy){toast('지금 행동을 마친 뒤 다시 눌러 주세요. / Please retry after this action finishes.');leaveDestination=null;return;}
    const result=await send('leave');
    if(!result&&state&&state.phase!=='closed'){toast('탐험을 종료하지 못했어요. 연결을 확인한 뒤 다시 눌러 주세요. / Could not end the expedition. Check your connection and try again.');leaveDestination=null;return;}
    forget();entryError='';stopped=false;if(leaveDestination)location.assign(leaveDestination);else render();
  }
  leaveDestination=null;
});
document.addEventListener('keydown',e=>{
  if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)||document.querySelector('dialog[open]'))return;
  if(e.code==='KeyR'&&state?.phase==='playing'&&state.role==='pilot'&&state.signal){e.preventDefault();main.querySelector('[data-action="replay"]')?.click();}
  if(['Digit1','Digit2','Digit3'].includes(e.code)&&state?.phase==='playing'){const action=state.role==='navigator'?'signal':'act',options=main.querySelectorAll(`[data-action="${action}"]`);const b=options[Number(e.code.at(-1))-1];if(b&&!b.disabled){e.preventDefault();b.click();}}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)interruptAudio();});
window.addEventListener('pagehide',()=>{pageAway=true;transportOnline=false;interruptAudio();streamController?.abort();});
window.addEventListener('pageshow',e=>{if(e.persisted){pageAway=false;if(session&&!stopped){transportOnline=false;render();stream();}}});
starbook=createStarbook({dialog:$('#starbook'),onCapture:()=>{if(state?.phase==='complete')render();},onStop:()=>voices.stop(),onListen:async word=>{await voices.prepare();return voices.play(word);},onShop:()=>shipShop.open(STARBOOK_ITEM),onStart:()=>{if(state&&['complete','closed'].includes(state.phase)){forget();entryError='';stopped=false;render();}if(!state)focusAction(session?'resume':'create');else $('#invite-url')?.focus();}});
shipShop=createShipShop({onKeepsake:()=>starbook.open(),dialog:$('#ship-shop'),openButton:$('#ship-shop-open'),renderShip:ship,onChange:look=>{for(const scene of main.querySelectorAll('.scene')){scene.dataset.sky=look.sky;scene.dataset.badge=look.badge;const badge=scene.querySelector('.ship-emblem');if(badge)badge.src=`assets/felt/${BADGE_ART[look.badge]}.webp`;}}});
load();render();
const entryParams=new URL(location.href).searchParams;
if(entryParams.get('collection')==='starbook')starbook.open();
else if(entryParams.get('shop')==='1')shipShop.open();
