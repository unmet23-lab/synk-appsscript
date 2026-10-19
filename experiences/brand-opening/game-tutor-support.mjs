import {practiceStep} from './tutor-practice-core.mjs';
import {josa} from './kit/josa.mjs';

const types=['control','timing','language','unanswered','audio'];
const clean=(value,max=200)=>typeof value==='string'?value.replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9:._-]{1,100}$/.test(value)?value:null;
const audioFile=(value,game)=>['runner','rhythm','hangul'].includes(game)&&typeof value==='string'&&new RegExp(`^${({runner:'korean-runner/assets/voice',rhythm:'korean-rhythm/assets/narration',hangul:'hangul-stage/assets/voice'})[game]}/[a-zA-Z0-9/_-]+\\.mp3$`).test(value)&&!value.includes('..')?value:null;
export const supportKey=(owner,tutor,game)=>`synk.world.tutor.support.v1:${encodeURIComponent(owner||'guest')}:${tutor}:${game}`;
export function normalizeSupport(raw,game){
 if(!['runner','rhythm','hangul','first'].includes(game)||!Array.isArray(raw))return [];
 return raw.slice(0,4).flatMap(value=>{
  if(!value||!types.includes(value.type)||!id(value.id))return [];
  const step=typeof value.step==='string'&&practiceStep(game,value.step)?value.step:null;
  let review=null;
  const r=value.review;
  if(r&&Array.isArray(r.options)&&r.options.length>=2&&r.options.length<=6){
   const options=r.options.map(s=>clean(s,90));
   if(options.every(Boolean)&&new Set(options).size===options.length&&Number.isInteger(r.correct)&&r.correct>=0&&r.correct<options.length){
    review={prompt:clean(r.prompt,260),options,correct:r.correct,selected:Number.isInteger(r.selected)&&r.selected>=0&&r.selected<options.length?r.selected:null};
    if(game==='runner'&&value.mode!=='check')review=null;
    if(review){const path=audioFile(r.audio,game);if(path)review.audio=path;const glyph=game==='hangul'&&clean(r.glyph,24);if(glyph&&/^[가-힣ㄱ-ㅎㅏ-ㅣ ]+$/.test(glyph))review.glyph=glyph;if(game!=='first'&&!review.audio&&!review.glyph)review=null;}
   }
  }
  if(['control','timing'].includes(value.type)&&!step)return [];
  if(['language','unanswered','audio'].includes(value.type)&&!review)return [];
  // Running actions alone cannot diagnose misunderstanding a Korean sentence.
  if(game==='runner'&&value.type==='language'&&value.mode!=='check')return [];
  return [{id:value.id,type:value.type,title:clean(value.title,60)||'다시 해 볼 부분',hint:clean(value.hint,220),topic:clean(value.topic,20),...(step?{step}:{}),...(review?{review}:{}),...(value.mode==='check'?{mode:'check'}:{}),...(value.answerCorrect===true?{answerCorrect:true}:{}),...(value.timed===true?{timed:true}:{})}];
 });
}
const cached=new Map();
export function createSupportLedger({storage,owner,tutor,game}){
 const key=supportKey(owner,tutor,game);
 let entries=cached.get(key)?.map(e=>({...e}))||[];
 if(!cached.has(key))try{const saved=JSON.parse(storage?.getItem(key)||'null');if(saved?.version===1&&Array.isArray(saved.entries))entries=saved.entries.slice(-12).flatMap(e=>{const normalized=normalizeSupport([e],game)[0];return normalized?[{...normalized,misses:Math.min(99,Math.max(1,Number(e.misses)||1)),practised:e.practised===true}]:[];});}catch{}
 const save=()=>{cached.set(key,entries.map(e=>({...e})));try{storage?.setItem(key,JSON.stringify({version:1,entries}));}catch{}};
 return {list:()=>entries.map(e=>({...e})),add(raw){const normalized=normalizeSupport(raw,game);for(const value of normalized){const key=value.type+':'+value.id,at=entries.findIndex(e=>e.type+':'+e.id===key);const entry={...value,misses:at>=0?Math.min(99,entries[at].misses+1):1,practised:false};if(at>=0)entries.splice(at,1);entries.push(entry);}entries=entries.slice(-12);if(normalized.length)save();return normalized;},mark(value){const entry=entries.find(e=>e.type===value.type&&e.id===value.id);if(entry){entry.practised=true;save();}},pending:()=>entries.filter(e=>!e.practised).length};
}
const actionStep=s=>s.action==='lane'?['left','middle','right'][s.target]:s.action;
export function runnerSupport(record){
 if(!record||!Array.isArray(record.steps))return [];
 return record.steps.flatMap((s,i)=>s.status==='done'?[]:[{id:`run-${record.id}-${i}`,type:s.status==='timing'?'timing':'control',step:actionStep(s),timed:s.status==='timing',title:s.status==='timing'?`${s.label} · 표시선 맞추기`:`${s.label} · 동작 다시 보기`,hint:s.status==='timing'?'동작 입력은 맞았어요. 표시선 가까이에서 움직여 보세요.':'이 표시선에서는 부탁한 동작이 끝까지 이어지지 않았어요. 들은 부탁과 동작을 같이 확인해 보세요.'}]);
}
export function obstacleSupport(type){const kind=({barrier:'fence',arch:'sign'})[type]||type,step=({fence:'jump',sign:'slide',tram:'left'})[kind];return step?[{id:'obstacle-'+kind,type:'control',step,title:({fence:'울타리 넘기',sign:'표지판 아래로',tram:'옆 길로 피하기'})[kind],hint:({fence:'울타리는 위 단추로 뛰어넘어요.',sign:'표지판 아래에서는 아래 단추로 몸을 숙여요.',tram:'전차가 있는 길에서 옆 길로 한 칸 옮겨요.'})[kind]}]:[];}
export function rhythmSupport(event){
 const q=event?.q;
 if(!q){if(event?.quality!==0)return [];const held=/hold/.test(event.type);return [{id:held?'hold-'+event.lane:'beat-'+event.lane,type:held?'control':'timing',step:held?(event.lane===1?'hold-right':'hold-left'):(event.lane===1?'beat-right':'beat-left'),title:held?'긴 노트 끝까지 누르기':'선에 닿을 때 누르기',hint:held?'긴 노트는 끝까지 누르고 있다가 놓아요.':'노트가 크림색 선에 닿을 때 한 번 더 눌러요.'}];}
 if(!Array.isArray(q.options)||!q.voice?.url)return [];
 const review={prompt:q.question,options:q.options,correct:q.options.indexOf(q.answer),selected:q.response,audio:'korean-rhythm/'+q.voice.url};
 const base={id:q.id,title:q.category+' · 문장 다시 듣기',hint:q.explanation,topic:q.category,review};
 const out=[];
 if(['failed','interrupted'].includes(q.delivered))out.push({...base,type:'audio',hint:'소리 전달이 끊겼어요. 문장을 다시 듣고 확인해 보세요.'});
 else if(q.response===null)out.push({...base,type:'unanswered',hint:'이 문장에는 답을 고르지 않았어요. 끝까지 듣고 O/X를 골라 보세요.'});
 else if(!event.correct)out.push({...base,type:'language'});
 if(q.response!==null&&event.quality===0)out.push({id:q.id,type:'timing',step:q.response===1?'beat-right':'beat-left',title:event.correct?'맞은 답 · 박자 다시 맞추기':'박자 다시 맞추기',hint:'O/X 선택과 누른 박자는 따로 확인해요. 선에 닿을 때 한 번 더 눌러요.',answerCorrect:event.correct===true});
 return out;
}
export function runnerCheckSupport(item,choice,feedback){return [{id:item.id,type:'language',mode:'check',topic:item.skill,title:item.skill+' · 부탁 다시 듣기',hint:feedback.correction||feedback.explanation,review:{prompt:item.text,options:item.choices,correct:item.correct,selected:choice,audio:`korean-runner/assets/voice/${item.id}.mp3`}}];}
export function hangulSupport({id:sourceId,target,selected,options,glyph,heard=true}){
 const choices=options.map(o=>typeof o==='string'?o:o.text);
 const correct=choices.indexOf(target),pick=choices.indexOf(selected);
 return [{id:id(sourceId)||'letter-'+[...target].map(c=>c.codePointAt(0).toString(16)).join('-'),type:heard?'language':'audio',title:'소리·글자 다시 만나기',hint:heard?`고른 ‘${selected}’${josa(selected,'과','와')} 알맞은 ‘${target}’${josa(target,'을','를')} 다시 비교해 보세요.`:'소리를 끝까지 확인하지 못했어요. 소리를 먼저 듣고 골라 보세요.',review:{prompt:'소리를 듣고 알맞은 글자를 골라요.',options:choices,correct,selected:pick,glyph:glyph||target}}];
}
export function firstSupport(question,result,selectedId){const options=question.options.map(o=>o.text),correct=question.options.findIndex(o=>o.optionId===result.correctOptionId);return [{id:question.questionId,type:'language',title:'상황에 맞는 표현',hint:correct>=0?`이 상황에 어울리는 표현은 ‘${options[correct]}’${josa(options[correct],'이에요','예요')}.`:'상황과 표현을 다시 비교해 보세요.',review:{prompt:question.prompt,options,correct,selected:question.options.findIndex(o=>o.optionId===selectedId)}}];}
export const supportLabel=(entry,game)=>entry.type==='language'?(game==='hangul'?'소리·글자':'문장 뜻'):({control:'조작',timing:'타이밍',unanswered:'답 고르기',audio:'다시 듣기'})[entry.type]||'다시 확인';
const controlWords={left:'왼쪽 단추나 ←·A로 한 칸 옮긴다.',right:'오른쪽 단추나 →·D로 한 칸 옮긴다.',middle:'끝 길에서 가운데로 한 칸 옮긴다.',jump:'↑·Space로 점프한다.',slide:'↓·S로 숙인다.',stay:'뛰거나 숙이지 않고 기다린다.',beat:'왼쪽 단추를 크림색 선에서 누른다.','beat-left':'왼쪽 단추를 크림색 선에서 누른다.','beat-x':'오른쪽 단추를 크림색 선에서 누른다.','beat-right':'오른쪽 단추를 크림색 선에서 누른다.','hold-left':'왼쪽 단추를 끝까지 누른다.','hold-right':'오른쪽 단추를 끝까지 누른다.'};
const cues={'시간':'오늘과 내일을','장소':'어디에 있는지','대조':'앞뒤에서 달라진 내용을','대신':'대신 고른 것을','변경된 시간':'바뀐 시간을','원인과 결과':'이유와 결과를','목적':'왜 갔는지','진행':'지금 하는 일인지','이유':'부탁한 이유를','조건':'무엇을 해야 하는지','비교':'비교한 내용을','의견':'찬성과 반대를','일정':'바뀐 일정을','생활':'달라진 상황을','부정 지시':'하지 않아도 되는 동작을','부정 · 방향':'하지 말라는 쪽과 가라는 쪽을','순서':'먼저와 그다음을','순서 · 방향':'움직이는 순서를'};
export function supportLine(tutor,entry,{full=false}={}){
 const body=full?entry.hint:entry.type==='language'?`${entry.review?.glyph?'소리와 글자를':cues[entry.topic]||'상황과 표현을'} 다시 확인한다.`:entry.type==='audio'?'소리부터 끝까지 듣는다.':entry.type==='unanswered'?'끝까지 듣고 답을 하나 고른다.':entry.answerCorrect?'문장 답은 맞았다. 박자는 다시.':entry.type==='timing'&&entry.timed?'동작 입력은 맞았다. 표시선 가까이에서 움직인다.':controlWords[entry.step]||'동작을 다시 확인한다.';
 if(tutor==='marin')return `확인. ${body.replace(/[?!？！]/g,'.')} …네 속도로.`;
 const casual=body.replace(/한다\./g,'해 봐.').replace(/듣는다\./g,'들어 봐.').replace(/고른다\./g,'골라 봐.').replace(/맞았다\./g,'맞았어.').replace(/누른다\./g,'눌러 봐.').replace(/옮긴다\./g,'옮겨 봐.').replace(/숙인다\./g,'숙여 봐.').replace(/기다린다\./g,'기다려 봐.').replace(/움직인다\./g,'움직여 봐.');
 if(tutor==='kkamong')return entry.type==='language'?`나도 헷갈렸ㅇ… 아니! ${casual} 이 몸이 같이 볼게.`:`내 비법. ${casual} …천천히 해도 돼.`;
 if(tutor==='mongle')return entry.type==='language'?`어? 나도… 헷갈리네! ${casual} 같이 다시 찾아보자!`:`오! ${casual} 같이 다시 해 보자!`;
 return '';
}
