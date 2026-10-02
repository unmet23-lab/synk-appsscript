import {StoryGame} from './core.mjs';
import {EPISODE} from './story.mjs';
import {StoryStage,names} from './stage.mjs';
import {StoryAudio} from './audio.mjs';
import {StoryVoice} from './voice.mjs';
import {VOICE_LINE_BY_ID,voiceForMission} from './voice-lines.mjs';
import {createStoryLearning,skillReport} from './learning.mjs';

const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const game=new StoryGame(),audio=new StoryAudio();
const learning=createStoryLearning({storage:localStorage});
const initialScope=learning.progressScope();
const STORAGE=initialScope.persistent?initialScope.key:null;
const voice=new StoryVoice({audio,onStatus:state=>{$('voice-status').textContent=state.message;$('voice-status').dataset.state=state.state;},onStarted:line=>{
 const ids=line.assistanceMissionIds;const source=['mission','explanation','feedback'].includes(line.category)?line.category:'dialogue';
 if(ids.length){game.markAudioHelp(ids,{source,voiceId:line.id});learning.help(ids,{kind:'audio',source,requestId:`${line.id}:${++voiceHelpSerial}`});persist();}
}});
voice.readingOnly=new URLSearchParams(location.search).get('reading')==='1';
// 입구에서 고른 도움 방식(순간 맞춤 선언 FLOW_VOICE)이 자동 읽기의 처음 값을 정한다. 이 판에서 누른 단추가 언제나 이긴다.
const chosenVoice=learning.voiceDefault();voice.automatic=chosenVoice;
const portraits={teacher:'teacher.webp',marin:'marin-focus.webp',kkamong:'kkamong-focus.webp',mongle:'mongle-body.webp'};
const speakerNames={teacher:'선생님',marin:'마린',kkamong:'까몽',mongle:'몽글',narrator:'이야기'};
let notes=[],saved=null,busy=false,started=false,teacherVisible=false,feedback=null,toastTimer,lastRenderedPhase=null,voiceKey='',voiceHelpSerial=0;
try{const raw=STORAGE?JSON.parse(localStorage.getItem(STORAGE)):null;if(raw?.game&&new StoryGame().restore(raw.game))saved=raw;}catch{}
const stage=new StoryStage($('stage'),{onActor:selectActor,onObject:selectObject,onPlace:place});
if(saved){$('resume').hidden=false;}

function persist(){try{const scope=learning.progressScope();if(STORAGE&&scope.persistent&&scope.key===STORAGE)localStorage.setItem(STORAGE,JSON.stringify({version:2,game:game.snapshot(),notes:notes.slice(-60)}));}catch{}}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function rememberLine(line){if(line&&!notes.some(n=>n.key===`${game.phase}:${game.actIndex}:${game.dialogueIndex}`))notes.push({...line,voiceId:game.currentVoiceLine?.id,key:`${game.phase}:${game.actIndex}:${game.dialogueIndex}`});}
function voiceLines(){if(feedback?.voiceId)return [VOICE_LINE_BY_ID[feedback.voiceId]];if(['play','review'].includes(game.phase))return game.missions.filter(m=>!game.completedIds.includes(m.id)).map(m=>voiceForMission(m.id));return [game.currentVoiceLine].filter(Boolean);}
function syncVoice(){const lines=voiceLines(),key=lines.map(l=>l.id).join('|');if(key===voiceKey)return;voiceKey=key;void voice.speak(lines);}
function setVoice(){
 $('voice-auto').setAttribute('aria-pressed',String(voice.automatic));$('reading-mode').setAttribute('aria-pressed',String(voice.readingOnly));
 $('voice-replay').disabled=voice.readingOnly||!audio.enabled;
 if(voice.readingOnly)voice.status('reading','글로만 연습 중이에요. 음성은 쉬고 있어요.');
 else if(!audio.enabled)voice.status('muted','소리가 꺼져 있어요.');
}
function accountStatus(){
 const status=learning.status(),scope=learning.progressScope();
 $('account-sign-in').hidden=scope.scope==='account';$('account-sign-out').hidden=scope.scope!=='account';
 $('account-sync').hidden=!['offline','blocked','error'].includes(status.phase);
 $('account-status').textContent=status.warning||({synced:'WORLD 계정에 학습 기록을 연결했어요.',offline:`연결을 기다리는 기록 ${status.queued||0}개를 이 기기에 보관해요.`,blocked:'학습 연결을 확인하지 못했어요. WORLD 계정 상태를 확인해 주세요.',local:'이 계정의 학습 기록은 이 기기에 저장해요. 이야기 진행은 이번 창에서 이어가요.'}[status.phase]||'이 기기의 연습 기록을 저장해요.');
 if(scope.scope==='device'&&location.port==='5213')$('account-status').textContent+=' 다른 게임과 함께 보려면 WORLD 입구에서 열어 주세요.';
 const accountUrl=location.pathname.startsWith('/story-classroom/')?new URL('../synk-account/client.html?product=world',location.href):new URL('http://127.0.0.1:4280/synk-account/client.html?product=world');
 $('account-sign-in').href=accountUrl;$('account-sign-out').href=accountUrl;
}
function speaker(line){const name=speakerNames[line?.speaker]||'이야기';$('speaker').textContent=name;const img=$('speaker-avatar'),file=portraits[line?.speaker];img.hidden=!file;if(file)img.src='./assets/'+file;$('dialogue').dataset.speaker=line?.speaker||'narrator';}
function render(){
 const playing=['play','review'].includes(game.phase);
 const complete=game.phase==='complete'&&!busy;
 $('landing').hidden=started;$('game').hidden=!started||complete;$('ending').hidden=!complete||!started;
 if(!started)return;
 const act=game.currentAct;
 $('chapter-label').textContent=game.phase==='review'?'다른 글, 새로운 행동':game.phase==='opening'?'우리 교실의 이야기':game.phase==='ending'?'오늘은 특별한 날':`장면 ${game.actIndex+1} / 3`;
 $('chapter-title').textContent=game.phase==='opening'?'문밖의 발소리':game.phase==='ending'?'비밀이 밝혀졌다':act.title.replace(/^\d+\s*·\s*/, '');
 $('chapter-progress').textContent=game.phase==='review'?`${game.missions.filter(m=>game.completedIds.includes(m.id)).length} / 3`:game.phase==='opening'?'PROLOGUE':game.phase==='ending'?'FINALE':`${game.actIndex+1} / 3`;
 const line=feedback||(playing?{speaker:'teacher',text:game.phase==='review'?'같은 교실이지만, 이번 글은 달라. 새 부탁을 읽어 보자.':'부탁을 읽고, 친구 → 물건 → 놓을 곳을 골라 줘.'}:game.currentLine);
 if(!playing&&!feedback){rememberLine(game.currentLine);}
 speaker(line);$('dialogue-text').textContent=line?.text||'';
 $('dialogue-next').hidden=playing;$('dialogue-next').disabled=busy;
 $('dialogue-next').textContent=game.phase==='ending'&&game.dialogueIndex===game.currentLines.length-1?'새 글로 마지막 정리':game.phase==='intro'&&game.dialogueIndex===game.currentLines.length-1?'친구들과 정리하기':game.phase==='outro'&&game.dialogueIndex===game.currentLines.length-1?'다음 장면으로':'다음 이야기 →';
 if(line?.speaker==='teacher'&&!teacherVisible){teacherVisible=true;stage.teacher(true);audio.play('door');}
 $('missions').innerHTML=playing?game.missions.map((m,i)=>`<div class="mission ${game.completedIds.includes(m.id)?'done':''}"><span class="mission-number">${String(i+1).padStart(2,'0')}</span><div class="mission-copy"><p>${escape(m.text)}</p><small>${game.completedIds.includes(m.id)?'부탁대로 옮겼어요':game.phase==='review'?'새로운 부탁':'선생님의 부탁'}</small><button class="tool-button mission-listen" data-voice="mission-${m.id}" type="button" ${voice.readingOnly||!audio.enabled?'disabled':''}>이 부탁 듣기</button></div><span class="mission-check" aria-label="${game.completedIds.includes(m.id)?'완료':'진행 전'}">${game.completedIds.includes(m.id)?'✓':''}</span></div>`).join(''):`<div class="quiet-mission"><span class="quiet-book">↗</span><p>${game.phase==='outro'?'이 장면의 부탁을 마쳤어요.':game.phase==='ending'?'친구들이 준비한 비밀은…':'지금은 이야기를 읽는 시간이에요.'}</p><small>다음 이야기 버튼으로 이어 가세요.</small></div>`;
 if(playing)for(const mission of game.missions)learning.present(mission,{record:game.records.find(r=>r.id===mission.id),visible:true});
 const available=playing?game.missions.filter(m=>!game.completedIds.includes(m.id)&&(m.requires||[]).every(id=>game.completedIds.includes(id))):[];
 const plan=available.length?learning.recommend(available):null;
 const preferred=available.find(m=>m.id===plan?.selected?.missionId);
 $('missions').dataset.recommended=preferred?.id||'';
 if(preferred){const index=game.missions.indexOf(preferred),copy=$('missions').children[index]?.querySelector('small');if(copy)copy.textContent='기록을 보고 먼저 추천하는 부탁';}
 document.querySelector('.mission-footnote').textContent=preferred?(plan.reason||'기록을 보고 다음 부탁을 골랐어요. 원하는 부탁부터 해도 괜찮아요.'):'글 속에 힌트가 있어요. 언제든 다시 읽어 보세요.';
 const name=game.actor?names[game.actor]:null,object=game.held?names[game.held]:null;
 $('selection').textContent=busy?`${name||'친구'}이 물건을 옮기고 있어요…`:playing?(object?`${name||'친구'} · ${object} 선택. 놓을 곳을 골라 주세요.`:name?`${name} 선택. 옮길 물건을 골라 주세요.`:'먼저 마린 또는 까몽을 골라 주세요.'):'이야기를 천천히 읽고 이어 가세요.';
 $('cancel-selection').hidden=!playing||!game.held||busy;
 $('undo').disabled=busy||!game.canUndo;$('hint').disabled=busy||!playing;$('journal').disabled=busy;$('restart').disabled=busy;
 stage.update(game);
 if(complete){renderEnding();if(lastRenderedPhase!=='complete'){window.scrollTo({top:0,behavior:stage.reduced?'instant':'smooth'});const title=$('ending-content').querySelector('h1');title.setAttribute('tabindex','-1');title.focus({preventScroll:true});}}
 if(!busy)lastRenderedPhase=game.phase;
 persist();
 setVoice();accountStatus();if(!complete)syncVoice();else voice.stop();
}

async function start(resume=false){
 if(busy)return;voice.stop();voiceKey='';started=true;feedback=null;stage.reset();teacherVisible=false;
 if(!chosenVoice&&!voice.automatic&&!voice.readingOnly)toast('입구에서 고른 도움 방식대로, 부탁은 눌러야 소리로 읽어 줘요.');
 if(resume&&saved&&game.restore(saved.game)){notes=Array.isArray(saved.notes)?saved.notes.filter(n=>typeof n.text==='string'&&typeof n.speaker==='string').slice(-60):[];teacherVisible=game.phase!=='opening'||game.dialogueIndex>=3;stage.teacher(teacherVisible);}
 else{game.restart();notes=[];}
 learning.beginRun({restored:resume});
 await audio.start();setSound();render();$('chapter-title').setAttribute('tabindex','-1');$('chapter-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
}
function selectActor(id){if(busy||!game.selectActor(id))return;feedback=null;audio.play('select');render();}
function selectObject(id){
 if(busy)return;if(!game.actor){toast('먼저 물건을 옮길 친구를 골라 주세요.');stage.caption('마린 또는 까몽을 먼저 골라 주세요.');return;}
 if(!game.selectObject(id))return;feedback=null;audio.play('pickup');render();
}
async function place(destination){
 if(busy)return;const actor=game.actor,object=game.held,result=game.place(destination);
 if(result.mission&&result.moved){const record=game.records.find(r=>r.id===result.mission.id);learning.recordResponse(result,{attemptNo:record.attempts,requestId:`${result.mission.id}:${record.attempts}`});}
 if(!result.moved){toast(result.message);feedback={...result,text:result.message};render();return;}
 busy=true;stage.busy=true;feedback={...result,text:result.message};audio.play('place');render();
 try{await stage.act(actor,object,destination,result,game.scene);}finally{busy=false;stage.busy=false;}
 audio.play(result.correct?'success':'mistake');
 if(result.actComplete){feedback=null;if(game.phase==='ending'||game.phase==='complete')audio.play('reveal');}
 render();
}
function undo(){if(busy||!game.undo())return;feedback=null;audio.play('page');stage.caption('한 장면 전으로 돌아왔어요. 글을 다시 읽어 보세요.');render();}
function hint(){if(busy)return;const r=game.help();if(r.mission)learning.help(r.mission.id,{kind:'text',revealsAnswer:true,requestId:`hint:${r.mission.id}:${game.records.find(x=>x.id===r.mission.id).helpCount}`});feedback={...r,text:r.message};audio.play('page');render();}
function advance(){if(busy)return;feedback=null;if(!game.advance())return;audio.play('page');render();}
function setSound(){const enabled=audio.enabled;$('sound').setAttribute('aria-pressed',String(enabled));$('sound').querySelector('span').textContent=enabled?'소리 켜짐':'소리 꺼짐';}
function modal(html){$('modal-content').innerHTML=html;$('modal').showModal();}
function journal(){
 const items=notes.map(n=>`<li><strong>${escape(speakerNames[n.speaker]||'이야기')}</strong><p>${escape(n.text)}</p>${n.voiceId?`<button class="tool-button" data-voice="${escape(n.voiceId)}" ${voice.readingOnly||!audio.enabled?'disabled':''}>이 대사 듣기</button>`:''}</li>`).join('');
 modal(`<p class="eyebrow">OUR CLASSROOM</p><h2 id="modal-title">이야기 수첩</h2><p class="modal-intro">지금까지 읽은 이야기를 다시 볼 수 있어요.</p><ol class="journal-lines">${items}</ol><div class="control-guide"><h3>친구들과 움직이는 방법</h3><p>친구 → 물건 → 놓을 곳을 차례로 눌러 주세요. 친구를 고른 뒤 물건을 끌어 놓을 곳에 옮겨도 돼요.</p><p>키보드: Tab으로 이동하고 Enter 또는 Space로 선택해요. Esc로 수첩을 닫아요. 지시는 글로 읽으며, 소리를 꺼도 모든 이야기를 플레이할 수 있어요.</p></div>`);
}
function restartDialog(){modal(`<p class="eyebrow">REPLAY</p><h2 id="modal-title">처음부터 다시 놀까요?</h2><p class="modal-intro">이번 교실의 진행을 지우고 첫 장면으로 돌아가요.</p><button id="confirm-restart" class="button-primary">다시 시작</button><button id="keep-playing" class="button-secondary">이어서 놀기</button>`);$('confirm-restart').onclick=()=>{$('modal').close();start(false);};$('keep-playing').onclick=()=>$('modal').close();}
function renderEnding(){
 const story=game.records.filter(r=>r.mode==='story'),review=game.records.filter(r=>r.mode==='review');
 const first=game.records.filter(r=>r.firstCorrect&&!r.firstHelpUsed&&!r.firstAudioHelpUsed).length;
 const helped=game.records.filter(r=>r.helpUsed).length;
 const heard=game.records.filter(r=>r.audioHelpUsed).length;
 const skills=[...new Set(game.records.map(r=>r.skill))];
 $('ending-content').innerHTML=`<div class="ending-illustration"><img class="ending-teacher" src="./assets/teacher.webp" alt="생일을 맞은 선생님"><img src="./assets/marin-happy.webp" alt="마린"><img src="./assets/kkamong-happy.webp" alt="까몽"><span class="ending-ribbon">생일 축하해요!</span></div><h1>우리의 파티,<br><span class="title-mark">완성!</span></h1><p class="ending-lead">읽은 이야기가 두 친구의 행동이 되고,<br>엉망이던 교실이 특별한 추억이 됐어요.</p><div class="ending-stats"><div><strong>${story.filter(r=>r.completed).length}<span> / 6</span></strong><p>이야기 속 부탁</p></div><div><strong>${review.filter(r=>r.completed).length}<span> / 3</span></strong><p>새 글로 마지막 정리</p></div><div><strong>${first}</strong><p>도움 없이 첫 시도에 옮김</p></div></div><p class="result-note">힌트를 확인한 부탁 ${helped}개 · 되돌리고 다시 시도해도 괜찮아요.</p><div class="reading-recap"><h2>이번 이야기에서 읽은 것</h2><p>누가 무엇을 옮기는지 · 물건이 갈 곳 · 하지 말아야 할 행동 · 먼저와 나중</p><button id="see-reading" class="button-secondary">읽은 표현 다시 보기</button></div><p class="learning-boundary">이번 플레이 기록이며 TOPIK 점수나 급수 판정은 아니에요.</p>`;
 $('ending-content').querySelector('.result-note').textContent=`힌트를 확인한 부탁 ${helped}개 · 음성 도움을 받은 부탁 ${heard}개 · 도움 없이 옮긴 수는 첫 시도 기준이에요.`;
 const report=skillReport(learning.summary());
 if(report.length){const panel=document.createElement('div');panel.className='reading-recap';panel.innerHTML=`<h2>내 읽기 연습 기록</h2><ul>${report.map(s=>`<li>${escape(s.label)} · ${escape(s.text)}</li>`).join('')}</ul><a class="button-secondary" href="${location.pathname.startsWith('/story-classroom/')?'../learning-hub/':'http://127.0.0.1:4280/learning-hub/'}">다음 연습 살펴보기</a>`;$('ending-content').append(panel);}
 $('see-reading').onclick=()=>modal(`<p class="eyebrow">READING NOTES</p><h2 id="modal-title">읽은 표현 다시 보기</h2><div class="recap-items">${[...EPISODE.acts.flatMap(a=>a.missions),...EPISODE.review].map(m=>`<article><small>${escape(m.skill)}</small><h3>${escape(m.text)}</h3><p>${escape(m.explanation)}</p><button class="tool-button" data-voice="help-${m.id}" ${voice.readingOnly||!audio.enabled?'disabled':''}>이 표현 듣기</button></article>`).join('')}</div>`);
}

$('start').onclick=()=>start(false);$('resume').onclick=()=>start(true);$('dialogue-next').onclick=advance;$('undo').onclick=undo;$('hint').onclick=hint;$('journal').onclick=journal;$('sound').onclick=()=>{audio.toggle();voice.stop();setSound();setVoice();render();};$('restart').onclick=restartDialog;$('again').onclick=()=>start(false);$('modal-close').onclick=()=>{$('modal').close();voice.stop();};
$('voice-replay').onclick=()=>void voice.speak(voiceLines(),{manual:true});
$('voice-auto').onclick=()=>{voice.automatic=!voice.automatic;voice.stop();setVoice();if(voice.automatic)void voice.speak(voiceLines());};
$('reading-mode').onclick=()=>{voice.readingOnly=!voice.readingOnly;voice.stop();setVoice();render();if(!voice.readingOnly)void voice.speak(voiceLines());};
$('account-sync').onclick=()=>{learning.retry();accountStatus();};
document.addEventListener('click',event=>{const button=event.target.closest('[data-voice]');if(button&&!button.disabled){const line=VOICE_LINE_BY_ID[button.dataset.voice];if(line)void voice.speak([line],{manual:true});}});
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}});
$('cancel-selection').onclick=()=>{if(!busy){game.held=null;feedback=null;render();}};
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').open&&game.held&&!busy){game.held=null;render();}});
window.addEventListener('pagehide',event=>{persist();voice.stop();audio.suspend();if(!event.persisted)learning.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted){if(audio.enabled)void audio.start();accountStatus();}});
let resizeFrame;window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(started&&!busy)stage.update(game);});});
// Inspectable development evidence; it cannot advance or solve the game.
Object.defineProperty(window,'__storyState',{get:()=>({busy,started,...game.snapshot()})});
Object.defineProperty(window,'__storyVoice',{get:()=>({state:voice.state,id:voice.currentId,automatic:voice.automatic,readingOnly:voice.readingOnly})});
Object.defineProperty(window,'__storyLearning',{get:()=>({summary:learning.summary(),status:learning.status(),scope:learning.progressScope()})});
setSound();setVoice();accountStatus();setInterval(accountStatus,3000);
