import {WorldClient} from './world-client.mjs';
const $=s=>document.querySelector(s);
const home=window.__synkHome;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let screen='',draftRun=null,answers=[],questionIndex=0,lastCompletion=null,wardrobeRevision=null;
const client=new WorldClient({onChange:renderStatus});
const stateLine=document.createElement('div');stateLine.className='world-state';stateLine.setAttribute('role','status');$('.page-heading').after(stateLine);
$('.preview-label').textContent='연결 개발판';$('.local-note').innerHTML='<span class="status-dot"></span>로컬 서버 연결';
$('.hero-footnote').textContent='첫 문장 놀이 · 3개의 짧은 문장';
$('.hero-copy .felt-button').innerHTML='첫 놀이 시작 <span aria-hidden="true">→</span>';
function show(title,html,type='world'){screen=type;home.showPanel(title,html,{type,eyebrow:'MY SYNK WORLD'});}
function close(){screen='';home.closePanel();}
function errorText(error){return {NETWORK_UNAVAILABLE:'연결이 잠시 끊겼어요. 선택한 내용은 그대로 두었어요.',REVISION_CONFLICT:'다른 화면에서 차림이 바뀌었어요. 최신 차림을 확인한 뒤 다시 골라주세요.',STALE_RESPONSE:'',AUTH_REQUIRED:'계정 연결이 끝났어요. 다시 연결해 주세요.',RUN_EXPIRED:'놀이 시간이 지나 새로 시작해야 해요.',BUSY:'앞선 요청을 확인하고 있어요.'}[error.code]||'아직 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.';}
function renderStatus(){
 const snap=client.snapshot;
 if(snap){home.setEquipment(snap.avatar?.slots);$('.page-heading h1').textContent=snap.activeRun?'하던 놀이를 이어갈까?':'오늘도, 나답게 놀아봐.';$('.hero-copy .felt-button').innerHTML=`${snap.activeRun?'하던 놀이 이어하기':'첫 문장 놀이'} <span aria-hidden="true">→</span>`;}
 else {home.setEquipment({});$('.page-heading h1').textContent='오늘도, 나답게 놀아봐.';$('.hero-copy .felt-button').innerHTML='첫 놀이 시작 <span aria-hidden="true">→</span>';}
 const status=client.status==='offline'?'연결을 기다리고 있어요. 저장 전 내용은 아직 확정되지 않았어요.':client.status==='conflict'?'다른 화면의 변경을 확인해 주세요.':client.pending?'아직 저장하지 못한 차림이 있어요.':snap?'내 차림과 보유품을 로컬 서버에서 불러왔어요.':'로그인 없이 홈을 둘러볼 수 있어요.';
 stateLine.innerHTML=`<span class="status-dot"></span><span>${status}</span>${client.pending?'<button data-world="pending">저장 확인</button>':client.status==='offline'?'<button data-world="refresh">다시 연결</button>':''}`;
 stateLine.dataset.state=client.status;
 document.querySelectorAll('[data-world-submit]').forEach(el=>{el.disabled=client.busy||client.status==='loading';});
 if(snap&&screen==='world-wardrobe'&&!client.busy&&wardrobeRevision!==snap.revision)wardrobe();
}
function welcome(){show('몽글과, 나의 작은 세계',`<div class="welcome-art"><img src="assets/mongle-smile.webp" alt="반갑게 웃는 몽글"><span>HELLO, MY WORLD</span></div><p class="welcome-lead">놀고, 꾸미고, 조금씩 배워요.</p><p class="panel-description">마음에 드는 차림을 입고<br>나만의 속도로 시작해요.</p><div class="world-actions"><button class="felt-button" data-world="sign-in">내 계정으로 시작 <span aria-hidden="true">→</span></button><button class="plain-button" data-world="guest">먼저 둘러보기</button></div><p class="dialog-note">이번 개발판에서는 테스트 계정으로 저장과 이어하기를 확인할 수 있어요. 실제 SYNK 계정은 변경되지 않아요.</p>`,'world-welcome');}
function signIn(){show('내 세계를 이어서',`<img class="world-account-mascot" src="assets/mongle.webp" alt="몽글"><p class="panel-description">같은 테스트 계정으로 들어오면<br>다른 화면에서도 보유품과 차림이 이어져요.</p><div class="world-notice"><strong>로컬 연결 리허설</strong><span>실제 Google·Apple 로그인과 별개예요.<br>아래 두 계정에는 시험용 기록만 저장돼요.</span></div><div class="world-actions"><button class="felt-button" data-world="login-a" data-world-submit>나의 테스트 계정으로 시작</button><button class="plain-button" data-world="login-b" data-world-submit>다른 테스트 계정으로 확인</button></div><p class="dialog-note">웹과 Unity 앱은 같은 로컬 서버 계약을 사용해요. 실제 계정 연결은 네이티브 인증 설정 후 검증해요.</p>`,'world-signin');}
async function login(account){try{await client.signIn(account);try{localStorage.setItem('synk-world-v1-welcomed','1');}catch{}close();home.toast('내 홈과 차림을 불러왔어요.');}catch(e){home.toast(errorText(e));}}
function about(){show('함께 만들어 가는 SYNK WORLD','<div class="review-note"><p><strong>지금 연결된 경험</strong><br>테스트 계정으로 첫 문장 놀이를 마치고, 받은 목도리와 앞치마를 함께 입을 수 있어요. 같은 계정의 다른 화면에서도 차림을 불러오고, 지금의 차림을 실제 3D 사진으로 저장해요.</p><p><strong>이어 만들고 있어요</strong><br>실제 SYNK 로그인, 설치형 앱 실행과 휴대폰 성능은 별도로 검증해야 해요. 기존 미니게임과 노래는 계속 둘러볼 수 있어요.</p><p>이 개발판은 이 PC의 로컬 서버와 합성 계정만 사용해요. 운영 계정이나 공개 앱은 변경하지 않아요.</p></div>','world-about');}
async function photo(){
 if(!client.snapshot)return home.showPhoto();
 if(client.busy){home.toast('차림을 저장한 뒤 사진을 찍을 수 있어요.');return;}
 try{
  await client.refresh();const snap=client.snapshot;
  const names={'mongle-apron-starter':'나의 첫 앞치마','mongle-scarf-first-steps':'첫 산책 목도리'};
  const items=Object.values(snap.avatar.slots).filter(id=>snap.inventory.some(item=>item.itemId===id)).map(id=>names[id]).filter(Boolean);
  home.showPhoto({verified:true,items:items.length?items:['몽글 기본 차림']});
  if(client.pending)home.toast('아직 저장하지 못한 변경은 빼고, 서버에 저장된 차림으로 찍었어요.');
 }catch(e){home.toast(errorText(e));}
}
function town(){show('우리 동네, 가까이 만나봐요',`<img class="town-preview" src="assets/town.webp" alt="싱크타운 광장 콘셉트"><p class="panel-description">내 차림 그대로 동네를 걸어보고,<br>몽글을 가까이서 만나봐요.</p><div class="world-notice"><strong>타운 연결 미리보기</strong><span>시험 계정의 차림 연결을 확인하는 개발 체험이에요. 실제 타운의 TOPIK 1급+ 조건·이용권·입장 권한을 부여하지 않아요.</span></div><div class="world-actions"><button class="felt-button" data-world="town-preview">${client.snapshot?'내 차림으로 미리보기':'시험 계정으로 연결하기'} <span aria-hidden="true">→</span></button><button class="plain-button" data-action="hangul">한글부터 배우기</button></div>`,'world-town');}
function townPreview(){if(!client.snapshot)return signIn();show('싱크타운 연결 미리보기','<iframe class="game-frame" title="시험 계정 차림으로 걷는 싱크타운 미리보기" src="/town/day.html?play=walk" allow="autoplay; fullscreen" allowfullscreen></iframe>','game');}
function profile(){if(!client.snapshot)return signIn();show('내 세계와 기록',`<div class="profile-view"><img src="assets/mongle-smile.webp" alt=""><h3>반가워요!</h3><p>차림과 첫 놀이의 선물이<br>이 테스트 계정에 보관돼요.</p></div><div class="world-notice"><strong>서버 저장 ${client.pending?'대기 중':'연결됨'}</strong><span>현재 차림 판본 ${client.snapshot.revision} · 로컬 테스트 계정</span></div><div class="world-actions"><button class="felt-button" data-world="wardrobe">내 옷장 열기</button><button class="plain-button" data-world="logout">이 화면에서 로그아웃</button></div>`,'world-profile');}
function wardrobe(){
 if(!client.snapshot)return signIn();const snap=client.snapshot,slots=snap.avatar.slots;wardrobeRevision=snap.revision;
 let frame=null;try{frame=home.captureFrame();}catch{}
 show('오늘은, 이 차림으로',`<p class="panel-description">목도리와 앞치마를 함께 입어봐요.<br>저장한 차림은 다른 화면에서도 이어져요.</p>${frame?`<figure class="world-wardrobe-preview"><img src="${frame}" alt="서버에 저장한 차림을 입은 3D 몽글"><figcaption>지금 입은 차림</figcaption></figure>`:''}<div class="world-outfits">${[{slot:'body',id:'mongle-apron-starter',name:'나의 첫 앞치마',note:'처음부터 함께하는 옷'},{slot:'neck',id:'mongle-scarf-first-steps',name:'첫 산책 목도리',note:'첫 문장 놀이의 선물'}].map(item=>{const owned=snap.inventory.some(i=>i.itemId===item.id),worn=slots[item.slot]===item.id;return `<button class="world-outfit ${worn?'is-equipped':''}" data-world="equip" data-slot="${item.slot}" data-item="${item.id}" aria-pressed="${worn}" ${owned?'data-world-submit':'disabled'}><span class="world-item-art">${item.slot==='neck'?'<img src="assets/scarf.webp" alt="">':'<span class="apron-mini"></span>'}</span><strong>${item.name}</strong><small>${owned?(worn?'입고 있어요':'입어보기'):item.note}</small><span class="world-item-check" aria-hidden="true">${worn?'✓':owned?'+':'잠김'}</span></button>`;}).join('')}</div>${client.pending?'<div class="world-notice"><strong>저장할 차림이 남아 있어요</strong><button class="plain-button" data-world="pending">저장 상태 확인</button></div>':''}<p class="dialog-note">지금은 개발용 3D 차림 두 개를 연결했어요. 다른 게임의 기존 아이템은 별도로 유지돼요.</p><div class="world-actions"><button class="felt-button" data-world="play">${snap.inventory.some(i=>i.itemId==='mongle-scarf-first-steps')?'문장 놀이 다시 하기':'놀이하고 목도리 받기'}</button></div>`,'world-wardrobe');
}
function pending(){show('아직 저장 전이에요',`<p class="panel-description">선택한 차림을 보내는 중에 연결이 끊겼거나 다른 화면에서 차림이 바뀌었어요. 지금 홈에는 마지막으로 확인된 차림이 보여요.</p><div class="world-actions"><button class="felt-button" data-world="retry-pending" data-world-submit>같은 요청 다시 보내기</button><button class="plain-button" data-world="discard-pending">최신 차림을 불러와 다시 고르기</button></div>`,'world-pending');}
function readDraft(run){try{const draft=JSON.parse(localStorage.getItem(`synk-world-v1-run:${client.snapshot.accountId}`)||'null');return draft?.runId===run.runId?draft:null;}catch{return null;}}
function saveDraft(){if(!draftRun||!client.snapshot)return;try{localStorage.setItem(`synk-world-v1-run:${client.snapshot.accountId}`,JSON.stringify({runId:draftRun.runId,answers,requestId:draftRun.requestId}));}catch{}}
async function play(){
 if(!client.snapshot)return signIn();
 try{let run=client.snapshot.activeRun;if(!run){const result=await client.start();run=result.run||result.activeRun;}if(!run)throw Error('NO_RUN');const previous=readDraft(run);draftRun={...run,requestId:previous?.requestId||crypto.randomUUID()};answers=previous?.answers||[];questionIndex=Math.min(answers.length,run.questions.length-1);showQuestion();}
 catch(e){home.toast(errorText(e));}
}
function showQuestion(){
 const q=draftRun.questions[questionIndex],choice=answers.find(a=>a.questionId===q.questionId)?.optionId;
 show('작은 문장, 첫걸음',`<div class="world-game-top"><span>초급 읽기</span><span>${questionIndex+1} / ${draftRun.questions.length}</span></div><div class="world-progress" aria-hidden="true"><i style="width:${(questionIndex+1)/draftRun.questions.length*100}%"></i></div><p class="world-prompt">${escape(q.prompt)}</p><div class="world-answers" role="group" aria-label="답 고르기">${q.options.map((o,i)=>`<button class="world-answer ${choice===o.optionId?'selected':''}" data-world="answer" data-option="${escape(o.optionId)}" aria-pressed="${choice===o.optionId}"><span>${i+1}</span>${escape(o.text)}</button>`).join('')}</div><p class="dialog-note">${questionIndex===0?'짧은 문장을 읽고 어울리는 답을 골라요.':'틀려도 괜찮아요. 마지막에 함께 확인해요.'}</p><div class="world-actions"><button class="felt-button" data-world="next" ${choice?'data-world-submit':'disabled'}>${questionIndex===draftRun.questions.length-1?'놀이 마치기':'다음 문장'} <span aria-hidden="true">→</span></button><button class="plain-button" data-world="pause">홈에서 잠깐 쉬기</button></div>`,'world-play');
}
async function finish(){
 saveDraft();try{const result=await client.complete(draftRun.runId,answers,draftRun.requestId);lastCompletion=result.completion;try{localStorage.removeItem(`synk-world-v1-run:${client.snapshot.accountId}`);}catch{}showReward();}
 catch(e){if(e.code==='STALE_RESPONSE')return;show('결과를 확인하고 있어요',`<p class="panel-description">${escape(errorText(e))}<br>같은 결과로 다시 보내도 선물은 한 번만 지급돼요.</p><div class="world-actions"><button class="felt-button" data-world="finish" data-world-submit>결과 다시 보내기</button><button class="plain-button" data-world="pause">홈으로 돌아가기</button></div>`,'world-retry');}
}
function showReward(){const done=lastCompletion;show(done?.rewardGranted?'나의 첫 선물이 도착했어요':'오늘의 작은 놀이를 마쳤어요',`<div class="world-reward-art"><img src="assets/scarf.webp" alt="포근한 목도리"></div><p class="welcome-lead">${done?.rewardGranted?'첫 산책 목도리':'잘했어요, 한 걸음 더.'}</p><p class="panel-description">${done?.rewardGranted?'첫 놀이를 마친 선물을 옷장에 보관했어요.':'이미 받은 목도리는 옷장에서 다시 입을 수 있어요.'}<br>정답 수와 관계없이 참여한 첫걸음을 기억해요.</p><details class="world-review"><summary>함께 답 확인하기</summary>${(done?.answers||[]).map((a,i)=>`<p><strong>${i+1}. ${escape(draftRun.questions[i]?.prompt)}</strong><br>알맞은 답: ${escape(draftRun.questions[i]?.options.find(o=>o.optionId===a.correctOptionId)?.text)} ${a.correct?'✓':''}</p>`).join('')}</details><div class="world-actions"><button class="felt-button" data-world="wear-reward" data-world-submit>지금 목도리 입기</button><button class="plain-button" data-world="home">홈으로 돌아가기</button></div>`,'world-reward');}
const commands={
 'sign-in':signIn,'guest':()=>{try{localStorage.setItem('synk-world-v1-welcomed','1');}catch{}close();},'login-a':()=>login('player-a'),'login-b':()=>login('player-b'),profile,wardrobe,pending,play,finish,home:close,'town-preview':townPreview,
 pause:()=>{saveDraft();close();home.toast('홈에서 쉬었다가 이어서 할 수 있어요.');},
 answer:button=>{const q=draftRun.questions[questionIndex];answers=answers.filter(a=>a.questionId!==q.questionId);answers.push({questionId:q.questionId,optionId:button.dataset.option});saveDraft();showQuestion();},
 next:()=>{if(questionIndex<draftRun.questions.length-1){questionIndex++;showQuestion();}else finish();},
 equip:async button=>{try{const slots={...client.snapshot.avatar.slots};slots[button.dataset.slot]=slots[button.dataset.slot]===button.dataset.item?'':button.dataset.item;await client.equip(slots);wardrobe();home.toast('차림을 서버에 저장했어요.');}catch(e){home.toast(errorText(e));if(client.pending)pending();}},
 'wear-reward':async()=>{try{await client.equip({...client.snapshot.avatar.slots,neck:'mongle-scarf-first-steps'});close();home.toast('포근한 첫 산책 목도리, 잘 어울려요.');}catch(e){home.toast(errorText(e));if(client.pending)pending();}},
 'retry-pending':async()=>{try{await client.sendPending();wardrobe();}catch(e){home.toast(errorText(e));}},
 'discard-pending':async()=>{try{await client.discardPending();wardrobe();}catch(e){home.toast(errorText(e));}},
 refresh:async()=>{try{await client.refresh();home.toast('다시 연결됐어요.');}catch(e){home.toast(errorText(e));}},
 logout:async()=>{try{await client.logout();welcome();}catch(e){if(e.code==='STALE_RESPONSE')return;home.toast('이 화면은 로그아웃됐어요. 서버 연결을 다시 확인해 주세요.');welcome();}},
};
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.world){event.preventDefault();event.stopImmediatePropagation();Promise.resolve(commands[button.dataset.world]?.(button)).catch(e=>home.toast(errorText(e)));return;}
 const action=button.dataset.action,nav=button.dataset.nav;
 if(['quickplay','profile','wardrobe','about','photo','town'].includes(action)||['wardrobe','town'].includes(nav)){
  event.preventDefault();event.stopImmediatePropagation();(action==='quickplay'?play:action==='profile'?profile:action==='about'?about:action==='photo'?photo:action==='town'||nav==='town'?town:wardrobe)();
 }
},true);
window.addEventListener('online',()=>{if(client.snapshot)client.refresh().catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&client.snapshot&&!client.busy)client.refresh().catch(()=>{});});
$('#panel').addEventListener('close',()=>{screen='';});
window.__synkWorld={client,screen:()=>screen};
try{const restored=await client.restore();if(!restored&&!localStorage.getItem('synk-world-v1-welcomed'))welcome();}catch{welcome();}
renderStatus();
