import {supplementalItems} from './supplemental.mjs';

export function supplementalAudioUrl(audio, location = globalThis.location) {
 const relative = `../${audio}`;
 if (!location?.href) return relative;
 return new URL(location.pathname.startsWith('/try/rhythm/') ? `/world/${audio}` : relative, location.href).href;
}

export function shuffled(items,seed){
 const out=[...items];let s=Number(seed)>>>0;
 for(let i=out.length-1;i>0;i--){s=(Math.imul(s,1664525)+1013904223)>>>0;const j=s%(i+1);[out[i],out[j]]=[out[j],out[i]];}
 return out;
}
// Delayed opportunities keep the song game's exact response cell and the original map version.
export function delayedSupplemental(coach){
 if(!coach?.followups||!coach?.exposure)return [];
 const opportunities=coach.followups().items.filter(row=>row.status==='due'&&row.gameId==='korean-rhythm'
  &&row.measure.taskVersion===coach.mapVersion
  &&row.measure.responseFormat==='binary-choice'&&row.measure.modality==='listening'&&row.measure.audioRequired===true);
 const pool=supplementalItems({purpose:'delayed',seen:item=>coach.exposure(item).seen});
 return pool.filter(item=>opportunities.some(row=>row.measure.skillId===item.skillId&&row.measure.difficulty===item.difficulty));
}

// Owns only this presentation. The shared coach owns help, first exposure, answer and provenance.
export function createSupplementalSession({coach,audio,onChange=()=>{}}){
 let current=null,token=0,played=0;
 const record=(name,...args)=>{try{return coach?.[name]?.(...args);}catch{return null;}};
 const update=()=>onChange(current?{...current}:null);
 function stop(){token++;audio.pause();audio.onended=null;audio.onerror=null;}
 function close(){if(current&&!current.answered&&current.presentationId)record('answer',current.presentationId,{correct:null,assessable:false,reason:'unanswered'});stop();current=null;update();}
 function open(item){close();played=0;current={item,presentationId:record('present',item),completed:false,answered:false,failed:false,text:false};update();return current.presentationId;}
 async function play(){
  if(!current||current.answered)return false;
  stop();const mine=token,row=current;
  if(played++)record('help',row.presentationId,'replay');
  row.completed=false;row.failed=false;audio.src=supplementalAudioUrl(row.item.audio);
  audio.onended=()=>{if(mine!==token||row!==current)return;row.completed=true;record('delivery',row.presentationId,{audio:'completed'});update();};
  audio.onerror=()=>{if(mine!==token||row!==current)return;row.failed=true;record('delivery',row.presentationId,{audio:'failed'});update();};
  update();try{await audio.play();return true;}catch{audio.onerror?.();return false;}
 }
 function text(){if(!current||current.text)return;current.text=true;record('help',current.presentationId,'text');update();}
 function answer(id){
  if(!current||!current.completed||current.answered||!current.item.choices.some(c=>c.id===id))return null;
  current.answered=true;current.correct=id===current.item.correctId;
  current.record=record('answer',current.presentationId,{correct:current.correct,assessable:true});stop();update();return current.correct;
 }
 function explanation(){if(!current?.answered)return null;record('help',current.presentationId,'explanation');return current.item.explanation.ko;}
 return {open,play,text,answer,explanation,close,get state(){return current?{...current}:null;}};
}

export function createSupplementalPanel({host,getCoach,audioFactory=()=>new Audio(),seed=()=>Date.now(),document:doc=globalThis.document}){
 let session=null,queue=[],index=0;
 function close(){session?.close();session=null;queue=[];host?.replaceChildren();}
 const element=(tag,text)=>{const node=doc.createElement(tag);if(text)node.textContent=text;return node;};
 const button=(label,click)=>{const node=element('button',label);node.type='button';node.className='chip-btn';node.addEventListener('click',click);return node;};
 function show(){
  close();if(!host)return;
  const coach=getCoach(),heading=element('h3','노래 밖에서도 들어 볼까요?'),note=element('p','시간 제한 없이 대화를 듣고 O·X로 확인해요. 노래 점수와 코인에는 들어가지 않아요.');
  host.append(heading,note);
  host.append(button('보충 연습',()=>start(supplementalItems())));
  let due=[];try{due=delayedSupplemental(coach);}catch{/* unreadable history is not unseen */}
  // Recheck at click time and consume only one reserve; the first answer may satisfy the due cell.
  if(due.length)host.append(button('며칠 뒤 다시 확인',()=>{let fresh=[];try{fresh=delayedSupplemental(getCoach());}catch{}start(fresh,1);}));
  if(!coach)host.append(element('p','학습 기록을 연결하지 못했어요. 이번 답은 기록되지 않을 수 있어요.'));
 }
 function start(pool,limit=3){
  queue=shuffled(pool,seed()).slice(0,limit);index=0;
  if(!queue.length){host.append(element('p','지금 확인할 수 있는 문항이 없어요.'));return;}
  session=createSupplementalSession({coach:getCoach(),audio:audioFactory(),onChange:render});session.open(queue[index]);
 }
 function render(row){
  if(!row||!host)return;
  host.replaceChildren(element('h3',`듣기 보충 ${index+1} / ${queue.length}`));
  const status=element('p',row.failed?'소리가 재생되지 않았어요. 다시 듣기를 눌러 주세요.':row.answered?(row.correct?'맞아요.':'다시 확인해 봐요.'):row.completed?'끝까지 들었어요. 이제 답해 주세요.':'먼저 대화를 끝까지 들어 주세요.');
  status.setAttribute('aria-live','polite');host.append(status,element('p',row.item.question));
  if(!row.answered){
   host.append(button('대화 듣기',()=>session.play()),button('글 도움',()=>session.text()));
   if(row.text)host.append(element('p',row.item.script.map(line=>`${line.speaker}: ${line.text}`).join('\n')));
   for(const choice of row.item.choices){const b=button(choice.label,()=>session.answer(choice.id));b.disabled=!row.completed;host.append(b);}
  }else{
   const explain=button('해설 보기',()=>{const why=session.explanation();if(why){explain.disabled=true;host.append(element('p',why));}});host.append(explain);
   host.append(button(index+1<queue.length?'다음 대화':'보충 연습 마치기',()=>{if(++index<queue.length)session.open(queue[index]);else show();}));
  }
  host.append(button('보충 연습 닫기',show));
 }
 return {show,close};
}
