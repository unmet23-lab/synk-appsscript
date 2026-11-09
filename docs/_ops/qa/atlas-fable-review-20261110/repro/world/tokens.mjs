const __ROOT = (() => { let p = decodeURIComponent(new URL('../../../../../..', import.meta.url).pathname); if (p.endsWith('/')) p = p.slice(0, -1); return p.charAt(2) === ':' ? p.slice(1) : p; })();
// 읽기 전용 재현: 시험 목표 학습자 · 듣기 항목이 약함 · 이번 주 초점이 듣기일 때, 듣기 짧은 연습 후보가 받는 계획 토큰과 순위.
import {pathToFileURL} from 'node:url';import fs from 'node:fs';
const R=(__ROOT + '/');
const imp=p=>import(pathToFileURL(R+p).href);
globalThis.fetch=async()=>{const body=fs.readFileSync(R+'experiences/synk-world-app/world-topik-items.json','utf8');return {ok:true,status:200,json:async()=>JSON.parse(body),text:async()=>body};};
const {createWorldLearningPlan}=await imp('experiences/synk-world-app/world-learning-plan.mjs');
const {worldLearning}=await imp('experiences/synk-world-app/world-learning-map.mjs');
const {worldPosition}=await imp('experiences/synk-world-app/world-position-kit.mjs');
await worldPosition.topik.load('bank.json');
const pool=worldPosition.practice.pool.filter(i=>/^ko\./.test(i.skillId));
let clock=Date.parse('2026-11-11T03:00:00.000Z'); // 수요일
const store=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]??null,get length(){return values.size;}};};
const shared=store();const mk=id=>worldLearning.engine.createGame({gameId:id,storage:shared,clock:()=>new Date(clock).toISOString(),followups:true});
const practice=mk('world-practice');
const answer=(item,correct)=>{const audio=item.modality==='listening';const pid=practice.present({id:item.id,itemKey:item.itemKey,familyKey:item.familyKey||item.itemKey,skillId:item.skillId,modality:item.modality,difficulty:item.difficulty,responseFormat:item.responseFormat??'unknown',audioRequired:audio,confounded:false});if(audio)practice.delivery(pid,{audio:'completed'});practice.answer(pid,{correct,assessable:true});clock+=40000;};
// 듣기 세부: 셋 틀림. 읽기는 항목마다 하나씩 맞힘(시작점 진단을 지난 사람).
for(const item of pool.filter(i=>i.skillId==='ko.listening.detail'&&i.difficulty===1).slice(0,3))answer(item,false);
for(const skill of [...new Set(pool.filter(i=>i.modality==='reading').map(i=>i.skillId))])answer(pool.find(i=>i.skillId===skill),true);
practice.flush?.();practice.dispose?.();
const home=mk('world-home'),summary=home.summary(),events=home.events();
const seen=item=>{try{return home.exposure(item).seen;}catch{return null;}};
const values={reasons:['exam'],primaryReason:'exam',examType:'topik1',weeklyMinutes:60};
const extra=worldPosition.practice.practiceCandidates({pool,seen,summary,count:5});
const rec=input=>home.recommendActivities(input.candidates,{settings:input.settings,at:input.at});
const empty={version:1,owner:'synthetic',revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{}};
const base=createWorldLearningPlan({summary,progress:empty,settings:values,now:clock,recommendActivities:rec,extra});
const listening={};for(const c of base.candidates)if(c.route==='game'&&c.modality==='listening')for(const t of c.targets)if(seen({itemKey:t.itemKey||t.id,familyKey:t.familyKeys?.[0]})===false)for(const id of t.skillIds)(listening[id]??=[]).includes(c.id)||listening[id].push(c.id);
const exam=worldPosition.exam.examInfo(values),week=worldPosition.exam.examWeek(clock);
const examPlan=worldPosition.exam.buildExamPlan({exam,summary,now:clock,audioAvailable:true,examSkills:worldPosition.exam.examEvidenceSkills(events),
  done:worldPosition.exam.weekActivity({events,progress:empty,week}),available:{practice:worldPosition.practice.practiceSupply({pool,seen,audioAvailable:true}),listening,recheck:0,life:true,writing:[],topik2:{listening:false,reading:false}}});
console.log('이번 주 계획: next=',JSON.stringify(examPlan.next),' goals=',JSON.stringify(examPlan.goals),' areas=',examPlan.areas.map(a=>`${a.area}:${a.done}/${a.planned}`).join(' '),' homework=',examPlan.homework.map(h=>h.skillId).join(','));
const plan=createWorldLearningPlan({summary,progress:empty,settings:values,now:clock,recommendActivities:rec,extra,examPlan});
console.log('고른 것:',plan.selected.id,'|',plan.reason);
const rows=plan.assessments.slice(0,6).map(a=>{const c=plan.candidates.find(x=>x.id===a.id);return `${a.id}  [${a.state}]  맞춘 목표 ${a.matchedGoals.length}: ${a.matchedGoals.join(',')}`;});
console.log(rows.join('\n'));
const lp=plan.candidates.find(c=>c.id==='world.practice.ko.listening.detail');
console.log('\n듣기 세부 짧은 연습 후보의 목표 토큰:',lp?JSON.stringify(lp.goals):'(후보 없음)');
