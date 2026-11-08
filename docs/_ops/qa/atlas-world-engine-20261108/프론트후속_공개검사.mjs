// 개인화 화면 프론트 후속(2026-11-08) — 공개본 계정 묶음에 끼운 줄을 실제로 돌린다(프론트_공개검사.mjs와 같은 방식).
// 프론트후속_공개묶음.cjs가 만든 check/ 폴더(고친 묶음 · 끼우기 전 공개본 묶음 + 공개본의 D 엔진 판 · 생활 원고 · 진도)에서 묶음을 import하고,
// 같은 기록을 이 작업본의 원천 판으로 읽어 세지 않은 답의 줄 · 수 · 그림이 같은지 본다. 다르면 멈춘다(종료 코드 1).
//   node docs/_ops/qa/atlas-world-engine-20261108/프론트후속_공개검사.mjs <check 폴더>
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const dir=path.resolve(process.argv[2]||'');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const at=file=>pathToFileURL(path.join(dir,file)).href,src=file=>pathToFileURL(path.join(ROOT,file)).href;
const live=await import(at('world-account.bundle.mjs')),before=await import(at('live-account.bundle.mjs'));
const source=(await import(src('experiences/synk-world-app/world-position-kit.mjs'))).worldPosition;
const START=Date.UTC(2026,10,9,1);
const checks=[];const check=(name,fn)=>{fn();checks.push(name);};

// 그 묶음의 코치로 기록을 적는다: 고른 답(판정 자격 없음) · 답하지 않음 · 장면 문항 · 소리 못 들음 · 다른 난도 · 빼기로 지운 답.
function record(side){
 let now=START,index=0;const values=new Map();
 const coach=side.worldLearning.engine.createGame({gameId:'world-home',storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},clock:()=>new Date(now+=60000).toISOString()});
 const ask=(key,result,measure={})=>{const skillId=measure.skillId||'ko.reading.detail';const pid=coach.present({id:`qa.${key}`,itemKey:`life.${key}`,familyKey:`life.${key}`,skillId,modality:skillId.split('.')[1],difficulty:1,responseFormat:'single-choice',...measure});return coach.answer(pid,result);};
 ask('draft',{correct:false,assessable:false,choice:{selectedId:'a',correctId:'b'}});
 ask('met',{correct:true,assessable:false,choice:{selectedId:'b',correctId:'b'}});
 ask('skip',{correct:null,assessable:false,reason:'unanswered'});
 ask('scene',{correct:true,assessable:true},{confounded:true});
 ask('heard',{correct:true,assessable:true},{skillId:'ko.listening.detail'});
 ask('level2',{correct:true,assessable:false},{difficulty:2});
 const gone=ask('gone',{correct:true,assessable:false});coach.exclude(gone.eventId);
 return coach;
}
// 시각 · 사건 번호는 판마다 같지 않아도 되는 값이라 빼고 견준다.
const rowsOf=(map,id)=>map.skills.find(skill=>skill.id===id).uncounted.map(({eventId,at,...row})=>row);
const t=(key,values)=>values?`${key}(${Object.entries(values).map(([k,v])=>`${k}=${v}`).join(',')})`:key;
const clip=html=>html.replace(/<time [^>]*>[^<]*<\/time>/g,'<time>');
const uncountedBlock=html=>{const body=html.slice(html.indexOf('data-skill="ko.reading.detail"')),end=body.indexOf('</details>');return clip(body.slice(0,end)).match(/<p class="wpos-evidence-title">position\.uncounted\.title<\/p>[\s\S]*?<\/ul>(?:<p class="wpos-note">[^<]*<\/p>)?/)?.[0]||'';};
const assessable=key=>key==='life.met'?true:key==='life.draft'?false:null,catalog=key=>key==='life.draft'?'안녕하세요.':null;

const coachLive=record(live),coachSource=record({worldLearning:live.worldLearning});
const mapLive=live.worldPosition.buildPositionMap({summary:coachLive.summary(),events:coachLive.events()});
const mapSource=source.buildPositionMap({summary:coachSource.summary(),events:coachSource.events()});

check('세지 않은 답 줄 · 전체 수가 원천 판과 같다',()=>{
 const rows=rowsOf(mapLive,'ko.reading.detail');
 assert.equal(rows.length,5,'빼기로 지운 답은 줄에 없다');
 assert.deepEqual(rows,rowsOf(mapSource,'ko.reading.detail'));
 assert.deepEqual(rowsOf(mapLive,'ko.listening.detail'),rowsOf(mapSource,'ko.listening.detail'));
 assert.equal(rowsOf(mapLive,'ko.listening.detail')[0].reason,'audio');
 const skill=mapLive.skills.find(row=>row.id==='ko.reading.detail');
 assert.equal(skill.unassessed,mapSource.skills.find(row=>row.id==='ko.reading.detail').unassessed);
 assert.equal(skill.cell,'notyet','칸은 그대로');assert.equal(skill.n,0);
});
check('판 그림: 까닭 하나씩 한 줄 — 원천 판과 글자까지 같다',()=>{
 const view=side=>side.createView({t,has:()=>true});
 const a=uncountedBlock(view(live.worldPosition).renderPositionBoard({map:mapLive,assessable,catalog}));
 const b=uncountedBlock(view(source).renderPositionBoard({map:mapSource,assessable,catalog}));
 assert.ok(a,'줄 칸이 있다');assert.equal(a,b);
 for(const why of ['draft','met','unanswered','visual','other'])assert.match(a,new RegExp(`data-why="${why}"`),why);
 assert.match(a,/position\.evidence\.incorrect · position\.uncounted\.tag/);
 assert.match(a,/<span lang="ko">안녕하세요\.<\/span>/);
});
check('옛 화면 모듈이 assessable을 안 넘겨도 묶음이 깨지지 않는다(캐시에 옛 판이 남은 10분)',()=>{
 const html=live.worldPosition.createView({t,has:()=>true}).renderPositionBoard({map:mapLive,catalog:null});
 assert.match(html,/data-why="other"/);assert.doesNotMatch(html,/data-why="draft"|data-why="met"/);
});
check('접힌 옛 기록만 있으면 옛 줄 그대로(수 한 줄)',()=>{
 const skill={...mapLive.skills.find(row=>row.id==='ko.reading.detail'),uncounted:[],unassessed:3};
 const html=live.worldPosition.createView({t,has:()=>true}).renderPositionBoard({map:{...mapLive,skills:[skill]}});
 assert.match(html,/position\.evidence\.unassessed\(n=3\)/);
});
check('이번 주 계획: 시험일 안내는 단추 바로 위 — 원천 판과 같다',()=>{
 const plan=side=>{const exam=side.exam;return exam.buildExamPlan({exam:exam.examInfo({reasons:['exam'],primaryReason:'exam',examType:'topik1'}),summary:coachLive.summary(),now:START,done:exam.weekActivity({events:coachLive.events(),progress:{},week:exam.examWeek(START)}),available:{reading:{},listening:{},recheck:15,life:true}});};
 const a=live.worldPosition.createView({t,has:()=>true}).renderExamPlan({plan:plan(live.worldPosition)}),b=source.createView({t,has:()=>true}).renderExamPlan({plan:plan(source)});
 assert.ok(plan(live.worldPosition).notes.includes('no-date'),'시험일 없는 계획으로 잰다');
 assert.equal(a,b);
 assert.match(a,/<\/section><p class="wpos-note wplan-date-note">plan\.week\.noDate<\/p><button class="quiet-button" type="button" data-view="study">/);
 assert.equal(a.split('plan.week.noDate').length-1,1,'한 번만');
});
check('끼우기 전 공개본에는 없고, 끼운 묶음의 기록 꼴 · 지도판은 그대로다',()=>{
 const coachBefore=record(before),mapBefore=before.worldPosition.buildPositionMap({summary:coachBefore.summary(),events:coachBefore.events()});
 assert.equal(mapBefore.skills.find(row=>row.id==='ko.reading.detail').uncounted,undefined);
 const shape=coach=>coach.events().map(event=>[event.type,event.verdict??null,event.reason??null]);
 assert.deepEqual(shape(coachLive),shape(coachBefore),'같은 일의 기록이 같다');
 const version=side=>side.worldLearning.engine.createGame({gameId:'front-follow-map',storage:null,clock:()=>new Date(START).toISOString()}).mapVersion;
 assert.equal(version(live),version(before));
});
console.log(`프론트 후속 공개 검사 ${checks.length}/${checks.length} 통과: ${checks.join(' · ')}`);
