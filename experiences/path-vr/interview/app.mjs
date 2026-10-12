import {createInterviewRoom,SEATS} from './room.mjs';
import {createInterviewAudio} from './audio.mjs';
import {createInterviewSession} from './dialogue.mjs';
import {INTERVIEWERS,INTERVIEW_INFO,PROMPTS,FOLLOWUPS} from './content.mjs';
import {createVoiceInput} from './voice.mjs';
import {createXR} from '../xr.mjs';

const $=id=>document.getElementById(id),session=createInterviewSession();
let view,audio,xr,voice,mode='text',stage=session.snapshot(),ready=false,preparing=false,starting=false,paused=false,disposed=false,operation=0,answerStarted=0,startedAt=0,pausedAt=0,elapsedPause=0,partial='',finalText='',answerPrefix='',confidence,level=0,submitting=false,micAuthorized=false,lastPanel='',voiceMessage='';
const speakingPhases=['intro','question','followup','repair','closing'];
let audioFailed=false;
const speakerName=id=>INTERVIEWERS.find(s=>s.id===id)?.role||'면접 연습';
const labels={idle:'입실 준비',intro:'인사',question:'첫 번째 질문',followup:'후속 질문',listening:'답변 듣는 중',repair:'다시 확인',closing:'마무리',reflection:'돌아보기'};
const notice=text=>$('session-notice').textContent=text;
const textResult=r=>typeof r==='string'?r:r?.text||'';
const transcript=()=>partial||finalText;
const withPrefix=text=>[answerPrefix,text].filter(Boolean).join(' ').trim();
function prepareButton(){ $('prepare').disabled=!ready||preparing||!$('mic-consent').checked;$('prepare').textContent=micAuthorized?'면접 시작':'음성 준비하기';}
function currentQuestion(){return stage.turn===2?FOLLOWUPS[stage.branch?.category]||FOLLOWUPS.unclear:PROMPTS.question;}
function showFailure(error){const text=error?.message||'준비 중 문제가 생겼습니다. 다시 시도해 주세요.';$('prepare-status').textContent=text;notice(text);}
function updatePanel(force=false){if(!view)return;let s;
  if(paused)s={title:'잠시 쉬는 중',text:'마이크와 면접 시간이 멈췄습니다.',buttons:[{label:'이어서 하기',action:'resume'},{label:'끝내기',action:'end'},{label:'VR 나가기',action:'exit'}]};
  else if(stage.phase==='idle')s={title:'SYNK PATH · 첫 면접실',text:preparing?voiceMessage||'음성과 면접관을 준비하고 있어요.':voice.ready&&micAuthorized?'준비되었습니다. 세 명의 면접관과 약 60–90초간 연습합니다.':'음성으로 답하면 후속 질문이 달라집니다. 먼저 마이크를 준비하세요.',hint:'기기 안에서 한국어 인식 · 첫 모델 약 90MB · 녹음 저장/전송 없음',buttons:preparing?[{label:'VR 나가기',action:'exit'}]:[{label:voice.ready&&micAuthorized?'면접 시작':'음성 준비',action:voice.ready&&micAuthorized?'start':'prepare'},{label:'VR 나가기',action:'exit'}]};
  else if(stage.phase==='reflection')s={title:'첫 면접을 마쳤어요',text:stage.reflections[1]||'지원 계기와 직접 해 볼 행동을 연결해 다시 말해 보세요.',hint:'이번 답변은 녹음하거나 저장하지 않았습니다.',buttons:[{label:'다시 연습',action:'restart'},{label:'VR 나가기',action:'exit'}]};
  else s={title:stage.phase==='listening'?`답변 ${stage.turn}/2 · 말씀해 주세요`:speakerName(stage.prompt?.speakerId),text:stage.prompt?.text||currentQuestion().text,transcript:stage.phase==='listening'?transcript():undefined,hint:stage.phase==='listening'?'답변은 25초씩입니다. 마치면 아래 버튼을 선택하세요.':voiceMessage,buttons:stage.phase==='listening'?[{label:submitting?'확인 중…':'답변 마치기',action:'answer'},{label:'다시 듣기',action:'repeat'},{label:'잠시 쉬기',action:'pause'},{label:'끝내기',action:'end'}]:[{label:'잠시 쉬기',action:'pause'},{label:'다시 듣기',action:'repeat'},{label:'끝내기',action:'end'}]};
  if(audioFailed&&!paused)s.buttons=[{label:'읽고 계속하기',action:'advance'},{label:'잠시 쉬기',action:'pause'},{label:'끝내기',action:'end'}];
  const key=JSON.stringify(s);if(force||key!==lastPanel){lastPanel=key;view.setPanel(s);}
}
function render(){
  $('welcome').hidden=stage.phase!=='idle';$('conversation').hidden=['idle','reflection','disposed'].includes(stage.phase);$('reflection').hidden=stage.phase!=='reflection';
  $('phase').textContent=labels[stage.phase]||'';$('speaker').textContent=stage.phase==='listening'?'지원자 · 나':speakerName(stage.prompt?.speakerId);
  $('caption').textContent=stage.prompt?.text||currentQuestion()?.text||'';$('answer-area').hidden=stage.phase!=='listening';$('finish-answer').hidden=stage.phase!=='listening'||mode!=='voice';$('finish-answer').disabled=submitting;
  $('text-answer-form').hidden=stage.phase!=='listening'||mode!=='text';$('repeat').disabled=!['question','followup','listening','repair'].includes(stage.phase)||submitting;
  $('next').hidden=true;$('transcript').textContent=transcript();
  $('listen-status').textContent=mode==='voice'?'편하게 말씀해 주세요.':'답변을 적어 주세요.';
  view?.setState({phase:paused?'paused':stage.phase,speaker:stage.prompt?.speakerId||currentQuestion()?.speakerId||'lead',speaking:!paused&&speakingPhases.includes(stage.phase),listening:!paused&&stage.phase==='listening',amplitude:0});
  if(stage.phase==='reflection')renderReflection();updatePanel();
}
function renderReflection(){const host=$('reflection-body');host.replaceChildren();stage.answers.forEach((a,i)=>{const article=document.createElement('article'),small=document.createElement('small'),p=document.createElement('p');small.textContent=i===0?'첫 번째 답변':'후속 질문에 대한 답변';p.textContent=a.text;article.append(small,p);host.append(article);});const article=document.createElement('article');article.textContent=stage.reflections[1]||'다음에는 구체적인 행동 한 가지를 더해 보세요.';host.append(article);if(stage.branch?.explanation){const p=document.createElement('p');p.className='small-note';p.textContent=stage.branch.explanation;host.append(p);}}
async function stopMic(){try{return voice?await voice.stop():{text:''};}catch{return {text:'',recognitionError:true};}}
async function drive(next){
  stage=next;audioFailed=false;const token=++operation;render();
  if(disposed||paused)return;
  if(speakingPhases.includes(stage.phase)){
    try{const finished=await audio.speak(stage.prompt);if(finished&&!disposed&&!paused&&token===operation)await drive(session.advance());}
    catch(e){if(token!==operation)return;audioFailed=true;showFailure(e);view?.setState({speaking:false});$('next').hidden=false;$('next').textContent='질문을 읽고 계속하기';updatePanel(true);}
  }else if(stage.phase==='listening'){
    answerStarted=performance.now();partial='';finalText='';answerPrefix='';confidence=undefined;$('text-answer').value='';render();
    if(mode==='voice')try{await voice.start();if(disposed||paused||token!==operation)await stopMic();}
      catch(e){if(token!==operation)return;showFailure(e);voiceMessage='마이크를 시작하지 못했습니다. 다시 듣기로 재시도하거나 화면에서 입력할 수 있습니다.';notice(voiceMessage);if(!xr?.active){mode='text';render();}else updatePanel(true);}
    else $('text-answer').focus({preventScroll:true});
  }
}
async function prepareVoice(){
  if(!ready||preparing||disposed)return;const token=++operation;preparing=true;$('prepare').disabled=true;$('text-preview').disabled=true;voiceMessage='한국어 음성 인식을 준비하고 있어요.';updatePanel();
  try{await audio.unlock();await voice.prepare();if(disposed||token!==operation)return;voiceMessage='마이크 사용을 허용해 주세요.';updatePanel();await voice.start();await voice.stop();if(disposed||token!==operation)return;micAuthorized=true;$('prepare-status').textContent='음성 준비 완료. 면접을 시작할 수 있습니다.';}
  catch(e){if(!disposed&&token===operation){showFailure(e);micAuthorized=false;}}
  finally{preparing=false;prepareButton();$('text-preview').disabled=!ready;updatePanel(true);}
}
async function startSession(selectedMode){
  if(!ready||preparing||starting||stage.phase!=='idle')return;
  if(selectedMode==='voice'&&(!voice.ready||!micAuthorized)){await prepareVoice();return;}
  starting=true;const token=++operation;try{mode=selectedMode;paused=false;await audio.unlock();if(disposed||token!==operation)return;audio.resume();startedAt=performance.now();elapsedPause=0;document.body.classList.add('started');notice('');await drive(session.start());}finally{starting=false;}
}
async function answer(text){
  if(stage.phase!=='listening'||submitting||paused)return;submitting=true;render();const token=operation;
  try{let result={text};if(mode==='voice'){result=await stopMic();result={...result,text:result?.text?withPrefix(result.text):transcript()};}
    if(token!==operation||paused||disposed)return;const options={};if(result.recognitionError)options.recognitionError=true;if(Number.isFinite(result.confidence)&&result.confidence>0)options.confidence=result.confidence;
    partial='';finalText='';submitting=false;await drive(session.answer(result.text||'',options));
  }finally{submitting=false;if(token===operation)render();}
}
async function repeat(){if(submitting||paused||!['question','followup','listening','repair'].includes(stage.phase))return;const token=++operation;audio.stop();await stopMic();if(token!==operation||disposed)return;partial=finalText=answerPrefix='';await drive(session.repeat());}
async function pause(){if(paused||['idle','reflection'].includes(stage.phase))return;paused=true;pausedAt=performance.now();const token=++operation;audio.suspend();const r=await stopMic();if(token!==operation||disposed)return;if(r?.text)finalText=withPrefix(r.text);else finalText=transcript();partial='';answerPrefix=finalText;render();if(!xr?.active&&!$('pause-dialog').open)$('pause-dialog').showModal();}
async function resume(){if(!paused)return;elapsedPause+=performance.now()-pausedAt;paused=false;if($('pause-dialog').open)$('pause-dialog').close();audio.resume();if(stage.phase==='listening'){
    const token=++operation;answerStarted+=performance.now()-pausedAt;render();if(mode==='voice')try{await voice.start();if(token!==operation||disposed||paused)await stopMic();}catch(e){if(token===operation){showFailure(e);mode='text';$('text-answer').value=finalText;render();}}
  }else await drive(stage);}
async function reset(){++operation;paused=false;submitting=false;audioFailed=false;audio?.suspend();session.reset();stage=session.snapshot();partial=finalText=answerPrefix='';startedAt=0;document.body.classList.remove('started');if($('pause-dialog').open)$('pause-dialog').close();$('clock').textContent='약 60–90초';$('prepare-status').textContent=voice?.ready?'음성 인식이 준비되어 있습니다.':'';render();await stopMic();prepareButton();}
async function action(a){if(a==='exit'){await pause();await xr?.exit();}else if(a==='prepare'){ $('mic-consent').checked=true;await prepareVoice();}else if(a==='start')await startSession('voice');else if(a==='answer')await answer();else if(a==='repeat')await repeat();else if(a==='pause')await pause();else if(a==='resume')await resume();else if(a==='advance'&&audioFailed)await drive(session.advance());else if(a==='end'||a==='restart')await reset();}

$('prepare').onclick=()=>{if($('mic-consent').checked)void startSession('voice');};
$('mic-consent').onchange=prepareButton;
$('text-preview').onclick=()=>startSession('text');$('text-answer-form').onsubmit=e=>{e.preventDefault();void answer($('text-answer').value);};
$('finish-answer').onclick=()=>answer();$('repeat').onclick=repeat;$('next').onclick=()=>drive(session.advance());$('pause').onclick=pause;$('resume').onclick=resume;$('end').onclick=reset;$('quit').onclick=reset;$('restart').onclick=reset;
$('details-button').onclick=()=>$('details').showModal();$('details-close').onclick=()=>$('details').close();$('center').onclick=()=>view?.reset();$('sound').onclick=()=>{audio?.setMuted(!audio.muted);$('sound').textContent=audio?.muted?'소리 꺼짐':'소리 켜짐';$('sound').setAttribute('aria-pressed',String(!audio?.muted));};
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();void resume();});
voice=createVoiceInput({onPartial:r=>{if(stage.phase!=='listening'||paused)return;partial=textResult(r)?withPrefix(textResult(r)):'';$('transcript').textContent=transcript();},onResult:r=>{if(stage.phase!=='listening'||paused)return;finalText=withPrefix(textResult(r));partial='';confidence=r?.confidence;$('transcript').textContent=finalText;},onLevel:n=>{level=n;},onStatus:s=>{voiceMessage=s.message||'';if(preparing){$('prepare-status').textContent=voiceMessage;updatePanel();}else if(s.state==='error'){notice(voiceMessage);}}});

try{
  await document.fonts.ready;view=await createInterviewRoom($('room'),{onAction:a=>{void action(a);},onProgress:t=>$('load-text').textContent=typeof t==='string'?t:'면접관을 준비하고 있어요.'});
  audio=createInterviewAudio(view.camera,view.scene,SEATS);await audio.prepare();
  xr=createXR({xr:navigator.xr,renderer:view.renderer,secure:isSecureContext,native:false,onChange:({status,message})=>{const active=status==='active';document.body.classList.toggle('xr',active);$('vr-status').textContent=message;$('vr').disabled=['unsupported','native','starting'].includes(status);$('vr').textContent=active?'VR 나가기':status==='unsupported'?'PC 미리보기':'VR로 입장';if(status==='ready'&&startedAt&&!paused&&stage.phase!=='reflection')void pause();updatePanel(true);}});
  view.renderer.xr.addEventListener('sessionstart',()=>{const active=view.renderer.xr.getSession();const visibility=()=>{if(active.visibilityState!=='visible')void pause();};active.addEventListener('visibilitychange',visibility);active.addEventListener('end',()=>active.removeEventListener('visibilitychange',visibility),{once:true});});
  $('vr').onclick=()=>{if(xr.active)return action('exit');if(mode==='text'&&!['idle','reflection'].includes(stage.phase)){$('vr-status').textContent='VR 음성 연습은 현재 연습을 마친 뒤 마이크를 준비해 시작해 주세요.';notice('글로 연습하는 동안에는 화면에서 계속해 주세요. VR은 면접을 끝낸 뒤 음성 모드로 입장할 수 있습니다.');return;}return xr.enter();};await xr.check();ready=true;$('loading').hidden=true;prepareButton();$('text-preview').disabled=false;document.documentElement.dataset.ready='true';render();
}catch(e){$('loading').hidden=true;showFailure(e);$('prepare').textContent='준비를 완료하지 못했습니다';document.documentElement.dataset.ready='error';}
let lastUi=0;
function frame(now){if(disposed)return;if(view)view.setState({amplitude:audio?.amplitude||0});if(now-lastUi>240){lastUi=now;$('level').style.transform=`scaleX(${Math.min(1,level*2)})`;if(startedAt&&!paused&&stage.phase!=='reflection')$('clock').textContent=`${Math.floor((now-startedAt-elapsedPause)/1000)}초`;
    if(stage.phase==='listening'&&!paused){const remaining=Math.max(0,Math.ceil((stage.answerLimitMs-(now-answerStarted))/1000));$('answer-clock').textContent=remaining?`${remaining}초`:'답변을 확인하고 있어요';if(!remaining&&!submitting)void answer(mode==='text'?$('text-answer').value:undefined);updatePanel();}}
  requestAnimationFrame(frame);
}requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!xr?.active)void pause();});
window.addEventListener('pagehide',()=>{disposed=true;++operation;session.dispose();audio?.dispose();void voice.dispose();void xr?.dispose();view?.dispose();});
// Read-only diagnostics for local QA. No transcript, microphone buffer, or account data is exposed.
Object.defineProperty(window,'pathInterviewDiagnostics',{value:()=>({ready,phase:stage.phase,turn:stage.turn,branch:stage.branch?.category||null,mode,paused,voiceReady:voice.ready,microphonePrepared:micAuthorized,stats:view?.stats(),audioReady:audio?.ready}),writable:false});
