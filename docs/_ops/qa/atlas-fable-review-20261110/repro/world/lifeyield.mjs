const __ROOT = (() => { let p = decodeURIComponent(new URL('../../../../../..', import.meta.url).pathname); if (p.endsWith('/')) p = p.slice(0, -1); return p.charAt(2) === ':' ? p.slice(1) : p; })();
// 읽기 전용 측정: 생활 22레슨 본문항 66 + 새 상황 복습 66을 모두 혼자 맞힌 학습자에게서 Core가 얻는 근거의 양과 해상도.
import {pathToFileURL} from 'node:url';
const R=(__ROOT + '/');
const imp=p=>import(pathToFileURL(R+p).href);
const {worldLearning}=await imp('experiences/synk-world-app/world-learning-map.mjs');
const {PACKS,LESSONS}=await imp('experiences/synk-world-app/life-content.mjs');
const items=worldLearning.life.lifeItems();
const dist=new Map();for(const i of items){const k=`${i.skillId.replace('ko.reading.','')}/d${i.difficulty}/${i.responseFormat}`;dist.set(k,(dist.get(k)||0)+1);}
console.log('생활 문항 132의 Core 칸 분포:',[...dist].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v}`).join('  '));
console.log('계열 수:',new Set(items.map(i=>i.familyKey)).size,'· 판정 자격:',items.filter(i=>worldLearning.life.lifeAssessable(i)).length,'· 장면:',items.filter(i=>i.confounded).length);
let clock=Date.parse('2026-11-10T03:00:00.000Z');
const store=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]??null,get length(){return values.size;}};};
const shared=store();const mk=id=>worldLearning.engine.createGame({gameId:id,storage:shared,clock:()=>new Date(clock).toISOString(),followups:true});
const coach=mk('world-life');
// 제품 이력 대조는 「처음」으로 둔다(snapshot 없음 → productMet은 true라 근거가 안 되므로, 빈 진도 스냅숏을 준다).
let snapshot={lessons:{},reviews:{},daily:{days:{}}};
const trail=worldLearning.life.createLifeTrail({coach:()=>coach,snapshot:()=>snapshot});
let shown=0,counted=0;
for(const review of [false,true])for(const pack of PACKS)for(const l of pack.lessons){const lesson={...LESSONS.find(x=>x.id===l.id),packId:pack.id};
  for(const q of lesson.questions){const item=worldLearning.life.lifeItem({lesson,question:q,review});if(!item)continue;
    const key=`${review?'review':'lesson'}:${lesson.id}:${q.id}`;trail.shown(key,item);const r=trail.answer(key,{correct:true});shown++;if(r?.independent)counted++;clock+=60000;}
  clock+=3600000;}
coach.flush?.();
const summary=mk('world-home').summary();
console.log('보인 문항:',shown,'· 혼자 낸 첫 답으로 센 것:',counted,'· 요약 independent 합:',summary.independent);
for(const s of summary.skills.filter(s=>s.status!=='unseen'||s.unassessed)){const cells=[];for(const d of [1,2,3])for(const [f,c] of Object.entries(s.levels[d].formats))if(c.n||c.assisted||c.unassessed)cells.push(`d${d}/${f}:${c.status}(n${c.n},맞음${c.correct},미판정${c.unassessed})`);console.log(' ',s.id,'→',s.status,'|',cells.join('  '));}
