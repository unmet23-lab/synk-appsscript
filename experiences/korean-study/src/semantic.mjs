import {addObs,recordDecision,recordAnswer,SITTING_GAP,SITTING_WRITES,SITTING_FRESH} from './tutor.mjs';
import {semanticTarget,semanticHistory} from './semantic-history.mjs';
export {semanticHistory};
export const SEMANTIC_SKILLS=['data.accuracy','task.coverage','structure.connection','language.expression','language.ending'];
const fail=()=>{throw Error('INVALID_STUDY_FEEDBACK');};
const text=(v,max,empty=false)=>{if(typeof v!=='string'||(!empty&&!v.trim())||[...v].length>max)fail();return v;};
const question=q=>{if(!q||!Array.isArray(q.options)||q.options.length!==2||!['a','b'].includes(q.correct))fail();
 const options=['a','b'].map(id=>{const rows=q.options.filter(o=>o?.id===id);if(rows.length!==1)fail();return {id,text:text(rows[0].text,110)};});
 if(options[0].text===options[1].text)fail();return {prompt:text(q.prompt,220),why:text(q.why,280),correct:q.correct,options};};
export function readSemantic(raw,answer){
 if(!raw||raw.version!==1||raw.kind!=='study'||raw.source!=='ai-reference'||!['focus','clear','insufficient'].includes(raw.status))fail();
 const f={version:1,kind:'study',source:'ai-reference',status:raw.status,summary:text(raw.summary,200),good:text(raw.good,200,true),rewrite:text(raw.rewrite,200)};
 if(raw.status!=='focus')return {...f,focus:null,check:null,help:null,practice:null};
 const r=raw.focus;if(!r||!SEMANTIC_SKILLS.includes(r.skill)||!['read-data','understand-task','organize','form','apply','uncertain'].includes(r.cause)||r.certainty!=='hypothesis')fail();
 const quote=text(r.quote,180,r.skill==='task.coverage');if(quote&&!String(answer).normalize('NFC').includes(quote))fail();
 return {...f,focus:{skill:r.skill,target:semanticTarget(r.target,r.skill),quote,taskQuote:text(r.taskQuote,180),observation:text(r.observation,280),cause:r.cause,certainty:'hypothesis'},
  check:question(raw.check),practice:question(raw.practice),help:{explanation:text(raw.help?.explanation,280),example:text(raw.help?.example,160)}};
}
export function recordSemantic(state,{feedback,stage='analysis',pick=null,itemId,attempt=null},{now=Date.now()}={}){
 const skill=feedback.focus?.skill||'none',d=recordDecision(state,{scene:'semantic',source:'ai-reference',skill,stage,hypothesis:feedback.focus?.cause||'uncertain'},{now});
 let s=d.state,ev=null,result=feedback.status,detail=null;
 if(stage!=='analysis'){
  const q=stage==='check'?feedback.check:feedback.practice;if(!q||!['a','b'].includes(pick))return state;
  const r=recordAnswer(s,{did:d.did,taskId:'study-writing-semantic',itemKey:`ai:${itemId}:${stage}:${d.did}`,concept:`study.ko2.${skill}`,
   helps:[{id:'ai-reference',level:'explanation'}],verdict:'unassessed',errorTags:['source.ai-reference'],choice:{selectedId:pick,correctId:q.correct}},{now});
  s=r.state;ev=r.ev;result=pick===q.correct?'selected-right':'selected-other';
  detail={itemId,attempt:attempt||new Date(now).toISOString(),target:semanticTarget(feedback.focus?.target,skill),prompt:q.prompt,selected:q.options.find(o=>o.id===pick).text,expected:q.options.find(o=>o.id===q.correct).text,explanation:q.why};
 }
 return addObs(s,{kind:'semantic',stage,skill,result,...(ev?{ev}:{}),...(detail?{detail}:{})},{now});
}
// 공개된 자료 구조의 편집 표다. 난이도 점수·학생 능력값으로 취급하지 않는다.
const TASK_TARGETS={
 'w53-resale':['trend','unit'], 'w53-exchange':['trend','unit'],
 'w53-study-ways':['comparison','unit'], 'w53-living-cost':['trend','unit','comparison'], 'w53-clinic':['comparison','unit'],
};
export function semanticNext(state,bank,{itemId,revise=false,focusSkill=null,focusTarget='other',now=Date.now()}={}){
 const past=state.obs.filter(o=>Date.parse(o.at)<=now);let start=past.length;
 while(start>0&&((start===past.length?now:Date.parse(past[start].at))-Date.parse(past[start-1].at))<=SITTING_GAP)start--;
 const writes=past.slice(start).filter(o=>o.kind==='write');
 if(writes.length>=SITTING_WRITES)return {id:'rest',why:'enough'};
 const target=semanticTarget(focusTarget,focusSkill);
 if(revise)return {id:'write',itemId,mode:'revise',support:1,phase:'edit',why:'semantic',semantic:true,focusSkill,focusTarget:target};
 const available=[...bank.open53,...bank.open54].filter(i=>i.id!==itemId&&!state.seen[i.id]);
 const current=[...bank.open53,...bank.open54].find(i=>i.id===itemId);
 const fresh=available.find(i=>target!=='other'&&TASK_TARGETS[i.id]?.includes(target))||available.find(i=>i.type===current?.type)||available[0];
 if(!fresh)return {id:'rest',why:'no-items'};
 if(writes.filter(o=>o.mode==='new').length>=SITTING_FRESH)return {id:'rest',why:'later'};
 return {id:'write',itemId:fresh.id,mode:'new',support:0,phase:'edit',why:'semantic-transfer',semantic:true,focusSkill,focusTarget:target};
}
