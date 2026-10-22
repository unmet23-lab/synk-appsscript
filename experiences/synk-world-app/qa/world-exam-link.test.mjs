// 주소의 ?exam= 바로가기(10-22, world-learning-ui.mjs examLink): 메일·신청 페이지에서 온 TOPIK II 목표 학생이 첫 화면에서 TOPIK II에 바로 닿는지 —
// 처음 온 사람은 그 시험을 채운 학습 목표 창(묻지 않고 저장하지 않는다), 이미 그 목표인 사람은 이번 주 계획, 저장하면 이번 주 계획으로.
// 실제 생활 진도(createLifeProgress)·Core 코치·시험 계획 묶음으로 돈다. 화면은 home.showPanel이 받은 HTML로, 폼 값은 그 HTML에 그려진 선택으로 읽는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createLifeProgress} from '../life-progress.mjs';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {createWorldLearningPlan} from '../world-learning-plan.mjs';
import {worldPosition} from '../world-position-kit.mjs';
import {worldLearning} from '../world-learning-map.mjs';

worldPosition.topik.use(JSON.parse(fs.readFileSync(new URL('../world-topik-items.json',import.meta.url),'utf8')));
const AT=Date.UTC(2026,9,22,2);
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function until(check,label){for(let i=0;i<200;i++){if(check())return;await settle();}assert.fail(`기다린 상태가 오지 않았다: ${label}`);}

// 그린 목표 창에서 학생이 아무것도 바꾸지 않았을 때의 폼 값(고른 라디오·체크박스·select)을 읽는다.
function fakeForm(html){
 const elements={},handlers=new Map(),status={textContent:''},section=hidden=>({hidden,querySelectorAll:()=>[],querySelector:()=>null});
 for(const [,name,value,checked] of html.matchAll(/<input type="radio" name="([^"]+)" value="([^"]*)" (checked)?>/g)){elements[name]||={value:''};if(checked)elements[name].value=value;}
 for(const [,name,checked] of html.matchAll(/<input type="checkbox" name="([^"]+)" (checked)?>/g))elements[name]={checked:!!checked};
 for(const [,name,body] of html.matchAll(/<select name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g))elements[name]={value:/<option value="([^"]*)" selected>/.exec(body)?.[1]||'',options:[]};
 const sections={'[data-study-exam]':/data-study-exam[ >]/.test(html)?section(/data-study-exam hidden/.test(html)):null,'[data-study-grade]':/data-study-grade[ >]/.test(html)?section(/data-study-grade hidden/.test(html)):null};
 const skip={dataset:{},disabled:false,addEventListener(type,fn){this[type]=fn;}};
 return {isConnected:true,elements,status,sections,
  addEventListener:(type,fn)=>handlers.set(type,fn),
  querySelector:selector=>selector==='.study-save-status'?status:selector==='[data-study-skip]'?skip:sections[selector]??null,
  querySelectorAll:selector=>selector==='button'?[skip]:[],
  submit(){handlers.get('submit')({preventDefault(){}});},skip(){skip.click();}};
}

// home.openPanel()은 지금 열린 판의 종류('' = 닫힘)를 돌려준다(brand-opening/home.mjs와 같다). prepare: 학습 호스트 준비(시험이 끼어들 자리).
function setup({reading='reads',saved=null,position=worldPosition,prepare=async()=>{}}={}){
 const storage=memory(),panels=[],toasts=[],launched=[];let form=null,kind='';
 const progress=createLifeProgress({storage,now:()=>AT});
 if(reading)progress.setHangulReading(reading,{via:'question'});
 if(saved)progress.updateLearningProfile({consent:true,expectedRevision:progress.learningProfile().profile.revision,values:saved});
 const home={updateStudy(){},toast:message=>toasts.push(message),openPanel:()=>kind,closePanel(){kind='';if(form)form.isConnected=false;},
  showPanel(title,html,options){panels.push({title,html,options});kind=options?.type||'panel';if(form)form.isConnected=false;form=options?.type==='world-study'?fakeForm(html):null;}};
 const target={localStorage:storage,document:{querySelector:selector=>selector==='#world-study-form'?form:null},addEventListener(){},removeEventListener(){}};
 const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:createWorldLearningPlan,position,target,prepare,
  launchGame:id=>launched.push(['game',id]),startLesson:id=>launched.push(['lesson',id]),startReview:id=>launched.push(['review',id])});
 return {education,progress,home,panels,toasts,launched,form:()=>form,goal:()=>panels.filter(p=>p.options?.type==='world-study').at(-1),plan:()=>panels.filter(p=>p.options?.eyebrow==='MY WEEK').at(-1)};
}
const checked=(html,name,value)=>new RegExp(`name="${name}" value="${value}" checked>`).test(html);

test('처음 온 손님: TOPIK II 주소는 「시험·자격 준비 → TOPIK II」를 채운 목표 창을 열고, 열기만으로는 아무것도 저장하지 않는다',async()=>{
 const s=setup();
 try{
  assert.equal(await s.education.examLink('topik2'),true);
  const goal=s.goal();assert.ok(goal,'학습 목표 창');assert.equal(s.panels.length,1);
  assert.ok(checked(goal.html,'reason','exam'),'배우는 이유: 시험·자격 준비');
  assert.ok(checked(goal.html,'examType','topik2'),'시험 종류: TOPIK II');
  assert.ok(checked(goal.html,'targetGrade',''),'목표 급은 학생이 고른다(정하지 않음)');
  assert.match(goal.html,/data-study-exam>/,'시험 칸이 펼쳐져 있다');assert.match(goal.html,/data-study-grade>/,'급 칸도 보인다');
  for(const n of [3,4,5,6])assert.match(goal.html,new RegExp(`data-grade-type="topik2"><input type="radio" name="targetGrade" value="${n}" >`),`TOPIK II ${n}급 칸`);
  assert.match(goal.html,/data-grade-type="topik1" hidden><input type="radio" name="targetGrade" value="2" >/,'TOPIK I 급은 숨는다');
  assert.match(goal.html,/<input type="checkbox" name="consent" >/,'저장 스위치는 꺼진 채(학생이 켠다)');
  assert.match(goal.html,/저장하고 시작하기/);
  assert.equal(s.progress.learningProfile().profile.status,'new');assert.equal(s.progress.learningProfile().profile.revision,0);
  assert.deepEqual(s.progress.learningProfileValues(),{});
 }finally{s.education.dispose();}
});

test('채운 창의 「건너뛰기」는 첫 실행 창처럼 건너뛴 뒤 다음 연습을 열고, 「바꿨어요」 알림을 띄우지 않는다',async()=>{
 const s=setup();
 try{
  await s.education.examLink('topik2');s.form().skip();
  await until(()=>s.launched.length,'다음 연습');
  assert.equal(s.progress.learningProfile().profile.status,'skipped');assert.deepEqual(s.progress.learningProfileValues(),{},'목표 값은 저장하지 않는다');
  assert.equal(s.launched.length,1);assert.deepEqual(s.toasts,[]);assert.equal(s.plan(),undefined);
 }finally{s.education.dispose();}
});

test('저장 스위치를 켜지 않고 누르면 저장하지 않고, 켜고 누르면 그 시험이 목표로 남고 이번 주 계획이 열린다',async()=>{
 const s=setup();
 try{
  await s.education.examLink('topik2');const form=s.form();
  form.submit();await settle();
  assert.match(form.status.textContent,/「이 기기에 저장하기」 스위치를 켜 주세요/);assert.equal(s.progress.learningProfile().profile.status,'new');
  form.elements.consent.checked=true;form.submit();
  await until(()=>s.plan(),'이번 주 계획');
  const values=s.progress.learningProfileValues();
  assert.equal(values.primaryReason,'exam');assert.deepEqual(values.reasons,['exam']);assert.equal(values.examType,'topik2');assert.equal(values.targetGrade,undefined);
  assert.equal(s.progress.learningProfile().profile.status,'active');
  const plan=s.plan().html;assert.match(plan,/data-plan-board/);assert.match(plan,/<strong class="life-poster-word">이번 주 계획<\/strong>/);
  assert.match(plan,/life-poster-sub">TOPIK II</,'계획 머리에 고른 시험');assert.match(plan,/data-plan-next/,'지금 할 것');
  assert.equal(form.isConnected,false,'목표 창은 닫혔다');assert.deepEqual(s.toasts,[],'계획이 열리면 저장 알림은 따로 띄우지 않는다');
 }finally{s.education.dispose();}
});

test('이미 TOPIK II를 목표로 저장한 사람은 목표 창 없이 이번 주 계획이 열리고, 기록은 그대로다',async()=>{
 const s=setup({saved:{reasons:['exam'],primaryReason:'exam',examType:'topik2',targetGrade:4}}),revision=s.progress.learningProfile().profile.revision;
 try{
  assert.equal(await s.education.examLink('topik2'),true);
  assert.equal(s.goal(),undefined,'목표 창을 다시 내밀지 않는다');assert.ok(s.plan(),'이번 주 계획');
  assert.match(s.plan().html,/life-poster-sub">TOPIK II · 4급 목표</);
  assert.equal(s.progress.learningProfile().profile.revision,revision);
 }finally{s.education.dispose();}
});

test('TOPIK I을 목표로 둔 사람이 TOPIK II 주소로 오면 창에만 TOPIK II를 채우고(맞지 않는 급은 비움), 저장하기 전에는 원래 목표 그대로다',async()=>{
 const s=setup({saved:{reasons:['exam'],primaryReason:'exam',examType:'topik1',targetGrade:2,examDate:'2027-04'}}),before=s.progress.learningProfileValues();
 try{
  await s.education.examLink('topik2');const goal=s.goal();
  assert.ok(goal,'TOPIK I 계획이 아니라 목표 창');assert.equal(s.plan(),undefined);
  assert.ok(checked(goal.html,'examType','topik2'));assert.ok(checked(goal.html,'targetGrade',''),'TOPIK I의 2급은 TOPIK II 급이 아니라 비운다');
  assert.equal(s.form().elements.examMonth.value,'2027-04','적어 둔 시험 달은 그대로 보인다');
  assert.match(goal.html,/<input type="checkbox" name="consent" checked>/,'이미 켠 저장 스위치');assert.match(goal.html,/저장하고 시작하기/);
  assert.deepEqual(s.progress.learningProfileValues(),before,'창을 열기만 해서는 바뀌지 않는다');
  s.form().submit();await until(()=>s.plan(),'저장 뒤 이번 주 계획');
  assert.equal(s.progress.learningProfileValues().examType,'topik2');assert.equal(s.progress.learningProfileValues().examDate,'2027-04');
 }finally{s.education.dispose();}
});

test('채워 둔 창에서 이유를 시험 밖으로 바꿔 「저장하고 시작하기」를 누르면 시험 계획 없이 첫 실행처럼 다음 연습을 시작한다',async()=>{
 const s=setup();
 try{
  await s.education.examLink('topik2');const form=s.form();
  form.elements.reason.value='travel';form.elements.consent.checked=true;form.submit();
  await until(()=>s.launched.length,'다음 연습');
  assert.equal(s.launched.length,1);assert.equal(s.plan(),undefined);assert.deepEqual(s.toasts,[],'저장 알림만 띄우고 끝나지 않는다');
  const values=s.progress.learningProfileValues();assert.equal(values.primaryReason,'travel');assert.equal(values.examType,undefined);
 }finally{s.education.dispose();}
});

test('다른 판이 열려 있거나 계획을 세우는 사이 학생이 다른 판을 열면 덮지 않는다 — 저장 뒤에는 저장 알림만',async()=>{
 const open=setup({saved:{reasons:['exam'],primaryReason:'exam',examType:'topik2'}});
 try{
  open.home.showPanel('배우기','<div></div>',{type:'life-hub'});
  assert.equal(await open.education.examLink('topik2'),false);assert.equal(open.plan(),undefined);assert.equal(open.goal(),undefined);
 }finally{open.education.dispose();}
 let s;
 s=setup({saved:{reasons:['exam'],primaryReason:'exam',examType:'topik2'},prepare:async()=>{s.home.showPanel('배우기','<div></div>',{type:'life-hub'});}});
 try{assert.equal(await s.education.examLink('topik2'),false);assert.equal(s.plan(),undefined,'기다리는 사이 연 판 위에 계획을 띄우지 않는다');}
 finally{s.education.dispose();}
 // 저장(run)의 준비는 지나가고, 계획을 열 때의 준비에서 학생이 다른 판을 연다.
 let calls=0,t;
 t=setup({prepare:async()=>{if(++calls===2)t.home.showPanel('배우기','<div></div>',{type:'life-hub'});}});
 try{
  await t.education.examLink('topik2');t.form().elements.consent.checked=true;t.form().submit();
  await until(()=>t.toasts.length,'저장 알림');
  assert.deepEqual(t.toasts,['목표에 맞춰 다음 연습을 바꿨어요.']);assert.equal(t.plan(),undefined);assert.equal(t.progress.learningProfileValues().examType,'topik2','저장은 됐다');
 }finally{t.education.dispose();}
});

test('저장한 뒤 계획을 여는 사이 이 화면이 닫히면(계정이 바뀜) 계획도 알림도 띄우지 않는다',async()=>{
 let calls=0,s;
 s=setup({prepare:async()=>{if(++calls===2)s.education.dispose();}});
 await s.education.examLink('topik2');s.form().elements.consent.checked=true;s.form().submit();
 for(let i=0;i<50;i++)await settle();
 assert.equal(calls,2);assert.equal(s.plan(),undefined);assert.deepEqual(s.toasts,[]);
 assert.equal(s.progress.learningProfileValues().examType,'topik2','저장은 화면이 닫히기 전에 끝났다');
});

test('TOPIK I 주소도 같은 길이다(그 시험과 1·2급 칸)',async()=>{
 const s=setup();
 try{
  await s.education.examLink('topik1');const goal=s.goal();
  assert.ok(checked(goal.html,'reason','exam'));assert.ok(checked(goal.html,'examType','topik1'));
  assert.match(goal.html,/data-grade-type="topik1"><input type="radio" name="targetGrade" value="1" >/);assert.match(goal.html,/data-grade-type="topik2" hidden>/);
 }finally{s.education.dispose();}
});

test('「아직 못 읽어요」를 고른 사람·모르는 시험 값·내 위치 묶음이 없는 화면에는 아무것도 열지 않는다',async()=>{
 const hangul=setup({reading:'new'});
 try{assert.equal(await hangul.education.examLink('topik2'),false);assert.equal(hangul.panels.length,0,'한글 만나기가 먼저다');}
 finally{hangul.education.dispose();}
 const s=setup();
 try{
  for(const value of ['topik3','unknown','constructor','__proto__','',null,undefined])assert.equal(await s.education.examLink(value),false,String(value));
  assert.equal(s.panels.length,0);
  s.education.open({presetExam:'constructor'});assert.ok(checked(s.goal().html,'reason',''),'모르는 값은 채우지 않는다');assert.doesNotMatch(s.goal().html,/name="examType" value="[^"]+" checked/);
 }finally{s.education.dispose();}
 const bare=setup({position:null});
 try{assert.equal(await bare.education.examLink('topik2'),false);assert.equal(bare.panels.length,0);}
 finally{bare.education.dispose();}
});
