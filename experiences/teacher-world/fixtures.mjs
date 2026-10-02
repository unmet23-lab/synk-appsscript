import {DEMO_TEACHER,demoLearnerActor} from './model.mjs';
export {DEMO_TEACHER,demoLearnerActor};
const DAY=86400000;
// Entirely invented names and records. Never import a production roster here.
export function createDemoState({now=Date.now()}={}){
  const time=typeof now==='string'?Date.parse(now):now;
  const evidence=(learner,skill,verdicts,{days=1,source='language-item',responseFormat='single-choice',assisted=false}={})=>verdicts.map((verdict,index)=>({
    id:`fixture-${learner}-${skill}-${index}`,skillId:skill,at:new Date(time-days*DAY-index*3600000).toISOString(),source,verdict,independent:source==='language-item'&&!assisted,assisted,
    taskId:'synthetic-baseline',itemKey:`${learner}-${skill}-${index}`,familyKey:`fixture-family-${learner}-${skill}-${index}`,difficulty:1,responseFormat
  }));
  return {schemaVersion:1,mode:'demo',synthetic:true,nextId:1,
    teachers:[{id:'teacher-demo',name:'체험 선생님'},{id:'teacher-other',name:'다른 반 체험 선생님'}],
    classes:[{id:'class-morning',name:'오전 한국어반 · 합성',teacherIds:['teacher-demo'],learnerIds:['demo-nara','demo-bora','demo-dami']},{id:'class-evening',name:'저녁 한국어반 · 합성',teacherIds:['teacher-demo','teacher-other'],learnerIds:['demo-roan']}],
    learners:[
      {id:'demo-nara',name:'나래 · 합성',classId:'class-morning',evidence:[...evidence('nara','ko.listening.detail',['correct','correct','correct','correct','correct']),...evidence('nara','ko.reading.detail',['incorrect','incorrect','correct'])]},
      {id:'demo-bora',name:'보라 · 합성',classId:'class-morning',evidence:[...evidence('bora','ko.reading.detail',['correct','correct','correct','correct','correct']),...evidence('bora','ko.listening.detail',['incorrect','incorrect','incorrect'])]},
      {id:'demo-dami',name:'다미 · 합성',classId:'class-morning',evidence:[...evidence('dami','ko.reading.negation',['correct','correct'],{days:15}),...evidence('dami','ko.listening.main',['correct','correct','correct','correct'],{source:'game-control',responseFormat:'binary-choice'})]},
      {id:'demo-roan',name:'로안 · 합성',classId:'class-evening',evidence:[...evidence('roan','ko.reading.condition',['correct','correct'],{assisted:true}),...evidence('roan','ko.reading.detail',['correct'],{days:45})]}
    ],assignments:[],submissions:[],observations:[],audit:[],personalization:{version:1,records:{}}};
}
