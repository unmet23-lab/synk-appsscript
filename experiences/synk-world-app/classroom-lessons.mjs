// 내 계정 시트의 「우리 반 수업」(반 연결 카드 위). TOPIK 온라인 반 학생이 실시간·예정·복습 수업을 연다.
// 상태 이름·안내·묶는 차례·재조회는 학생 앱 「우리 반 수업 · 실시간 / 복습」(SYNK-talk src/수업영상화면.js)과 같은 뜻으로 맞춘다:
// 실시간 → 확인이 필요한 수업 → 예정 수업 → 복습 영상. 「지금 수업 중」은 서버가 실제 방송 상태(150초 안에 동기화된 live)로 줄 때만 보인다.
// 시트가 열려 있는 동안 30초마다, 다른 탭·앱에서 돌아올 때 다시 묻는다. 실패하면 옛 링크를 남기지 않는다. 서버 글은 textContent로만 넣는다.
export const CLASSROOM_STATUS_LABELS=Object.freeze({scheduled:'수업 예정',live:'지금 수업 중',processing:'복습 영상 준비 중',ready:'다시 보기',
 failed:'영상 확인 중',interrupted:'방송 연결 확인 중',unavailable:'영상 연결 확인 중',access_pending:'학생 계정 초대 준비 중'});
export const CLASSROOM_STATUS_HELP=Object.freeze({
 access_pending:'선생님이 이 영상의 학생 초대를 확인해야 볼 수 있어요. 수업 시간이 됐다면 선생님께 반 이름과 수업명을 알려 주세요.',
 interrupted:'방송 연결을 확인하고 있어요. 잠시 뒤 다시 확인해 주세요. 계속 안 되면 선생님께 알려 주세요.',
 unavailable:'지금은 영상을 열 수 없어요. 연결 확인이 끝나면 다시 볼 수 있어요.',
 failed:'영상에 문제가 있어 확인이 필요해요. 선생님께 이 수업명을 알려 주세요.',
 processing:'수업 영상을 정리하고 있어요. 준비가 끝나면 복습 버튼이 나타나요.',
 scheduled:'방송이 시작되고 시청 준비가 끝나면 보기 버튼이 나타나요.'});
// 학생 앱 화면의 글 그대로(불러오는 중만 화면에 보이는 문장으로 풀었다). qa/classroom-lessons.test.mjs가 학생 앱 원문과 대조한다.
export const CLASSROOM_TEXT=Object.freeze({title:'우리 반 수업',lead:'못 온 날에도 함께 배우고,\n놓친 부분은 다시 들어요.',auto:'수업 상태는 30초마다 자동으로 확인해요.',
 refresh:'새로고침',loading:'수업을 불러오는 중이에요.',error:'수업을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.',retry:'다시 불러오기',
 openError:'링크를 열지 못했어요. 잠시 뒤 다시 눌러 주세요.',
 emptyTitle:'아직 연결된 수업이 없어요',emptyBody:'수강 중인 반이 연결되면 이곳에 수업이 나타나요. 등록한 학생이라면 선생님에게 반 연결을 확인해 주세요.',
 liveHelp:'유튜브에서 열려요. 앞부분으로 돌려볼 수도 있어요.',live:'실시간 수업 보기',replay:'복습하기',
 attention:'확인이 필요한 수업',recheck:'수업 상태 다시 확인',scheduled:'예정 수업',replays:'복습 영상',noSessions:'첫 수업 영상이 준비되면 이곳에 보여요.',
 privateTitle:'유튜브에서 영상이 안 보이나요?',privateAccount:'초대받은 Google 계정으로 로그인했는지 확인해 주세요. 다른 계정이면 유튜브에서 계정을 바꿔 주세요.',
 privateTeacher:'계정이 맞아도 열리지 않으면 선생님께 반 이름과 수업명을 알려 주세요.',
 playlist:'우리 반 전체 영상 목록',meetingTitle:'화상 참여',meetingBody:'선생님이 안내한 시간에 참여해 주세요.',meeting:'화상 수업 참여',
 note:'수업 영상은 우리 반 학습을 위해 제공해요. 다른 사람에게 공유하지 말아 주세요.'});
const ATTENTION=['interrupted','access_pending','unavailable','failed'];
const TONES={live:'live',ready:'ok',scheduled:'info',processing:'idle',interrupted:'check',access_pending:'check',unavailable:'check',failed:'check'};
export const classroomTone=status=>TONES[status]||'idle';

export function groupClassroomSessions(sessions){
 const at=value=>Date.parse(value);
 return {live:sessions.filter(r=>r.status==='live'),attention:sessions.filter(r=>ATTENTION.includes(r.status)),
  scheduled:sessions.filter(r=>r.status==='scheduled').sort((a,b)=>at(a.starts_at)-at(b.starts_at)),
  replay:sessions.filter(r=>['ready','processing'].includes(r.status)).sort((a,b)=>at(b.starts_at)-at(a.starts_at))};
}
export function classroomDate(value){
 if(typeof value!=='string')return '';const d=new Date(value);
 return Number.isNaN(d.getTime())?'':d.toLocaleString('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
// 학생 앱의 안전링크 + lib/수업영상.js validMeetingUrl: 유튜브 영상·재생목록, Google Meet·Zoom 회의 주소만 연다.
export function safeClassroomLink(url){
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  if(u.hostname==='www.youtube.com')return (u.pathname==='/watch'&&/^[A-Za-z0-9_-]{11}$/.test(u.searchParams.get('v')))
   ||(u.pathname==='/playlist'&&/^[A-Za-z0-9_-]{10,100}$/.test(u.searchParams.get('list')));
  return (u.hostname==='meet.google.com'&&/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(u.pathname))
   ||((u.hostname==='zoom.us'||/^[a-z0-9-]+\.zoom\.us$/.test(u.hostname))&&/^\/j\/\d+$/.test(u.pathname));
 }catch{return false;}
}

export function mountClassroomLessons({container,load,guard=()=>{},intervalMs=30000,timers=globalThis}){
 const doc=container.ownerDocument,T=CLASSROOM_TEXT;
 const node=(tag,className,value)=>{const el=doc.createElement(tag);if(className)el.className=className;if(value!==undefined)el.textContent=value;return el;};
 const led=tone=>{const el=node('i','ws-led');el.dataset.tone=tone;el.setAttribute('aria-hidden','true');return el;};
 const button=(label,className,key,onClick)=>{const el=node('button',className,label);el.type='button';el.dataset.classroomKey=key;el.addEventListener('click',onClick);return el;};
 const root=node('section','ws-class'),headingId='ws-class-'+Math.random().toString(36).slice(2,10);
 root.dataset.label='CLASS';root.dataset.state='loading';root.setAttribute('aria-labelledby',headingId);
 const head=node('div','ws-class-head'),title=node('h3','',T.title);title.id=headingId;head.append(title,button(T.refresh,'quiet-button','refresh',()=>start()));
 const status=node('p','ws-class-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const alert=node('div','ws-class-alert');alert.setAttribute('role','alert');alert.hidden=true;
 const openAlert=node('p','ws-class-open');openAlert.setAttribute('role','alert');openAlert.hidden=true;
 const body=node('div','ws-class-body');
 root.append(head,node('p','ws-class-lead',T.lead),node('p','ws-class-auto',T.auto),status,alert,openAlert,body,node('p','ws-class-note',T.note));
 container.append(root);
 const model={loading:true,error:false,classes:[]};
 let disposed=false,cycle=null,signature='';
 const visible=()=>doc.visibilityState!=='hidden';
 function setOpenError(value){openAlert.hidden=!value;openAlert.replaceChildren(...(value?[led('alert'),doc.createTextNode(T.openError)]:[]));}
 // 안전한 주소는 새 탭 링크(휴대폰 팝업 차단에 걸리지 않는다), 아니면 학생 앱처럼 누를 때 「링크를 열지 못했어요」를 위에 보인다.
 function link(label,url,className,key){
  if(!safeClassroomLink(url))return button(label,className,key,()=>{setOpenError(true);openAlert.scrollIntoView?.({block:'nearest'});});
  const el=node('a',className,label);el.href=url;el.target='_blank';el.rel='noopener noreferrer';el.dataset.classroomKey=key;el.addEventListener('click',()=>setOpenError(false));return el;
 }
 const meta=(tone,value)=>{const el=node('p','ws-class-meta');el.append(led(tone),doc.createTextNode(value));return el;};
 function lesson(c,r){
  const row=node('div','ws-class-lesson');row.dataset.status=r.status;
  row.append(meta(classroomTone(r.status),[classroomDate(r.starts_at),CLASSROOM_STATUS_LABELS[r.status]||'확인 중'].filter(Boolean).join(' · ')),node('strong','ws-class-title',r.title));
  if(CLASSROOM_STATUS_HELP[r.status])row.append(node('p','ws-class-help',CLASSROOM_STATUS_HELP[r.status]));
  if(r.status==='ready'&&r.watch_url)row.append(link(T.replay,r.watch_url,'plain-button',`replay:${c.class_id}:${r.session_key}`));
  return row;
 }
 function group(name,heading,rows){const el=node('section','ws-class-group');el.dataset.group=name;el.append(node('h5','',heading),...rows);return el;}
 function tip(heading,...lines){const el=node('div','ws-class-tip');el.append(node('strong','',heading),...lines.map(line=>typeof line==='string'?node('p','',line):line));return el;}
 function room(c){
  const el=node('div','ws-class-room'),g=groupClassroomSessions(c.sessions);el.append(node('h4','ws-class-name',c.display_name));
  for(const r of g.live){
   const live=node('article','ws-class-live');live.dataset.status='live';
   live.append(meta('live',[CLASSROOM_STATUS_LABELS.live,classroomDate(r.starts_at)].filter(Boolean).join(' · ')),node('strong','ws-class-title',r.title),node('p','ws-class-help',T.liveHelp));
   if(r.watch_url)live.append(link(T.live,r.watch_url,'felt-button',`live:${c.class_id}:${r.session_key}`));
   el.append(live);
  }
  if(g.attention.length){const box=group('attention',T.attention,g.attention.map(r=>lesson(c,r)));box.append(button(T.recheck,'quiet-button',`recheck:${c.class_id}`,()=>start()));el.append(box);}
  if(g.scheduled.length)el.append(group('scheduled',T.scheduled,g.scheduled.map(r=>lesson(c,r))));
  if(g.replay.length)el.append(group('replay',T.replays,g.replay.map(r=>lesson(c,r))));
  if(!c.sessions.length)el.append(node('p','ws-class-help',T.noSessions));
  if(c.video_privacy==='private')el.append(tip(T.privateTitle,T.privateAccount,T.privateTeacher));
  if(c.playlist_url)el.append(link(T.playlist,c.playlist_url,'quiet-button ws-class-out',`playlist:${c.class_id}`));
  if(c.meeting_url)el.append(tip(T.meetingTitle,T.meetingBody,link(T.meeting,c.meeting_url,'plain-button',`meeting:${c.class_id}`)));
  return el;
 }
 // 30초 갱신이 같은 목록을 다시 그리지 않게 서명으로 거르고, 다시 그리면 누르던 단추로 초점을 돌린다.
 function paint(){
  if(disposed)return;
  const next=JSON.stringify([model.loading,model.error,model.classes]);if(next===signature)return;signature=next;
  const focused=doc.activeElement,focusKey=focused&&root.contains(focused)&&body.contains(focused)?focused.dataset.classroomKey:null;
  root.dataset.state=model.error?'error':model.loading?'loading':model.classes.length?'ready':'empty';
  status.hidden=!model.loading;status.replaceChildren(...(model.loading?[led('idle'),doc.createTextNode(T.loading)]:[]));
  alert.hidden=!model.error;alert.replaceChildren(...(model.error?[node('p','',T.error),button(T.retry,'plain-button','retry',()=>start())]:[]));
  body.replaceChildren();
  if(!model.loading&&!model.error&&!model.classes.length){const empty=node('div','ws-class-empty');empty.append(node('strong','',T.emptyTitle),node('p','',T.emptyBody));body.append(empty);}
  for(const c of model.classes)body.append(room(c));
  if(focusKey)for(const el of body.querySelectorAll('[data-classroom-key]'))if(el.dataset.classroomKey===focusKey){el.focus({preventScroll:true});break;}
 }
 // 학생 앱의 한 번의 useEffect와 같은 한 바퀴: 새로고침·다시 확인은 바퀴를 새로 돌려 목록을 비우고 다시 묻는다.
 function start(){
  if(disposed)return;cycle?.end();
  const run={ended:false,inflight:false,generation:0,end(){this.ended=true;this.generation++;}};cycle=run;
  model.loading=true;model.error=false;model.classes=[];setOpenError(false);paint();void refresh(run);
 }
 async function refresh(run){
  if(!run||run.ended||!visible()||run.inflight)return;
  run.inflight=true;const current=++run.generation;
  try{
   guard();const result=await load();guard();
   if(!run.ended&&current===run.generation){model.classes=result.classes;model.error=false;}
  }catch(error){
   // 계정이 바뀌면 이 칸은 끝난다. 시트를 다시 그리는 쪽이 새 칸을 붙인다(옛 계정의 링크를 보이지 않는다).
   if(error?.code==='ACCOUNT_CHANGED'){run.end();root.hidden=true;return;}
   if(!run.ended&&current===run.generation){model.classes=[];model.error=true;}
  }finally{
   run.inflight=false;
   if(!run.ended&&current===run.generation)model.loading=false;
   if(!run.ended)paint();
   if(!run.ended&&visible()&&current!==run.generation)void refresh(run);
  }
 }
 // 다른 탭·앱으로 가면 목록을 비우고(돌아왔을 때 옛 링크를 보이지 않게) 돌아오면 다시 묻는다.
 function onVisibility(){
  if(!cycle||cycle.ended)return;
  if(visible())void refresh(cycle);else{cycle.generation++;model.classes=[];model.loading=true;paint();}
 }
 doc.addEventListener('visibilitychange',onVisibility);
 const timer=timers.setInterval(()=>void refresh(cycle),intervalMs);
 start();
 return Object.freeze({reload:start,state:()=>({phase:root.hidden?'closed':root.dataset.state,classes:model.classes.length}),
  dispose(){if(disposed)return;disposed=true;cycle?.end();timers.clearInterval(timer);doc.removeEventListener('visibilitychange',onVisibility);root.remove();}});
}
