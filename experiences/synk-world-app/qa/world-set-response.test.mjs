// 연습 한 판의 응답(WORLD 학습자 응답 설계 §3·§5·§7 화면): 세 끝 화면(짧은 연습·짧은 진단·시험 형식 연습)의 「이번 연습 어땠어요?」는
// 로그인한 학습자에게만, 설정값(responses)이 켜졌을 때만 있다. 손님과 꺼짐에는 줄도 판 기록(.set)도 없다. 짧은 연습의 문항 수는
// 짧은 연습에 남긴 마지막 응답 하나로 3·5·7이고(진단·시험 형식 응답은 움직이지 않음), 응답을 빼거나 30일이 지나면 효과도 빠진다.
// 실제 Core 코치와 기기 저장소 흉내로 돌고, 판 상자는 HTML 글을 그대로 들고 단추 누르기만 흉내 낸다(이 저장소에 DOM 도구가 없다).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {worldPosition} from '../world-position-kit.mjs';
import {worldLearning} from '../world-learning-map.mjs';
import {t} from '../../brand-opening/world-lang.mjs';
import STRINGS from '../../brand-opening/world-strings.mjs';

const BANK=JSON.parse(fs.readFileSync(new URL('../world-topik-items.json',import.meta.url),'utf8'));
worldPosition.topik.use(BANK);
const DAY=86400000,KEY='synk.atlas.learning.v1.device';
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
const camel=name=>name.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());

// 판 상자: innerHTML 글을 들고, 들어 있는 속성의 요소만 찾아 준다(초점·한 번 듣는 단추·응답 줄 바꿔 끼우기·「더 하기」 글 고치기).
function stage(){
 const clicks=[],once=new Map();
 const has=selector=>{const match=/\[([a-z-]+)(?:="([^"]*)")?\]/.exec(selector);if(!match)return true;return match[2]!=null?box.html.includes(`${match[1]}="${match[2]}"`):new RegExp(`\\s${match[1]}[\\s=>]`).test(box.html);};
 const box={html:'',isConnected:true,
  get innerHTML(){return this.html;},set innerHTML(value){this.html=String(value);},
  addEventListener(type,fn){if(type==='click')clicks.push(fn);},contains:()=>true,closest:()=>null,focus(){},
  querySelectorAll:()=>[],
  querySelector(selector){
   if(!has(selector))return null;
   const node={focus(){},textContent:'',addEventListener:(type,fn)=>{if(type==='click')once.set(selector,fn);}};
   if(selector==='[data-set-response-box]')Object.defineProperty(node,'outerHTML',{set:html=>{box.html=box.html.replace(/<section class="wpos-response"[\s\S]*?<\/section>/,html);}});
   if(selector==='[data-practice-again]')Object.defineProperty(node,'innerHTML',{set:html=>{box.html=box.html.replace(/(<button[^>]*data-practice-again[^>]*>)[\s\S]*?(<\/button>)/,`$1${html}$2`);}});
   return node;
  }};
 // 단추 하나 누르기: 그 속성(값)을 가진 단추가 글에 있어야 한다.
 box.press=(attr,value='')=>{
  assert.ok(value?box.html.includes(`${attr}="${value}"`):box.html.includes(attr),`${attr}${value?`=${value}`:''} 단추가 있다`);
  const button={dataset:{[camel(attr)]:value},disabled:false,hasAttribute:name=>name===attr};
  const event={target:{closest:selector=>selector==='button'||selector.includes(attr)?button:null}};
  for(const fn of [...clicks])fn(event);
 };
 box.trigger=selector=>{const fn=once.get(selector);assert.ok(fn,`${selector} 단추가 이어져 있다`);once.delete(selector);fn();};
 return box;
}
function setup({owner='account-a',responses=true,audio='off',values={}}={}){
 const panels=[],toasts=[],storage=memory();let now=Date.parse('2026-10-22T03:00:00Z'),box=null;
 const progress={owner,learningProfile:()=>({profile:{status:'active',revision:1,consent:true}}),learningProfileValues:()=>({audio,...values}),
  status:()=>({phase:'synced',rejected:false,scoped:owner!=='guest',message:''}),exportSnapshot:()=>({}),flush:async()=>{},hangulReading:()=>({answer:'reads'})};
 const home={updateStudy(){},toast:message=>toasts.push(message),closePanel(){},attachPanelResource(){},
  showPanel:(title,html,options)=>{panels.push({title,html,options});if(/data-(practice|position|mock)-stage/.test(html))box=stage();}};
 const host={createGame:(options,factory)=>factory({...options,storage,clock:()=>new Date(now).toISOString()}),ready:async()=>{}};
 const target={localStorage:storage,addEventListener(){},removeEventListener(){},setTimeout,
  document:{querySelector:selector=>/data-(practice|position|mock)-stage/.test(selector)?box:null},...(owner==='guest'?{}:{SYNKLearningHost:host})};
 const education=createWorldEducation({home,getProgress:()=>progress,engine:worldLearning,createPlan:()=>({selected:null,reason:''}),launchGame(){},startLesson(){},startReview(){},
  position:worldPosition,responses,target});
 const events=()=>JSON.parse(storage.getItem(KEY)||'{"events":[]}').events;
 return {education,panels,toasts,storage,events,box:()=>box,tick:ms=>{now+=ms;}};
}
// 아직 처음 보는 읽기 문항이 가장 많이 남은 항목.
function freshestSkill(env){
 const coach=worldLearning.engine.createGame({gameId:'probe',storage:env.storage});
 const supply=worldPosition.practice.practiceSupply({pool:worldPosition.practice.pool,seen:item=>coach.exposure(item).seen,audioAvailable:false});
 return Object.entries(supply).filter(([id])=>/^ko2?\.reading\./.test(id)).sort((a,b)=>b[1]-a[1])[0];
}
// 짧은 연습 한 판을 끝까지(모두 첫 보기 고르기). 돌려주는 값: 낸 문항 수와 끝 화면 상자.
async function runPractice(env){
 env.tick(60000);
 const [skillId]=freshestSkill(env);
 await env.education.practice(skillId);
 const box=env.box();let total=null;
 for(let guard=0;guard<40&&!box.html.includes('data-practice-done');guard+=1){
  total??=Number(/(\d+) \/ (\d+)/.exec(box.html)?.[2]);
  if(box.html.includes('data-practice-feedback'))box.press('data-practice-next');
  else box.press('data-practice-choice',/data-practice-choice="([^"]+)"/.exec(box.html)[1]);
 }
 assert.match(box.html,/data-practice-done/);
 return {total,box,skillId};
}
async function runDiagnostic(env){
 env.tick(60000);
 await env.education.position({start:true});
 const box=env.box();
 for(let guard=0;guard<40&&!box.html.includes('data-position-done');guard+=1)box.press('data-position-choice',/data-position-choice="([^"]+)"/.exec(box.html)[1]);
 assert.match(box.html,/data-position-done/);
 return box;
}
async function runMock(env){
 env.tick(60000);
 await env.education.mock();
 const box=env.box();
 box.trigger('[data-mock-start]');
 box.press('data-mock-stop');
 assert.match(box.html,/data-mock-done/);
 return box;
}
const setEvents=env=>env.events().filter(e=>/\.set$/.test(e.experienceId||'')||e.type==='feedback.given');
const responseBox=html=>/<section class="wpos-response"[\s\S]*?<\/section>/.exec(html)?.[0]||'';

test('로그인 · 켜짐: 짧은 연습 끝 화면에 묻기 줄과 응답 넷, 고르면 판 기록에 결정 번호와 함께 남고 같은 값은 다시 남지 않는다',async()=>{
 const env=setup();
 const {total,box}=await runPractice(env);
 assert.equal(total,5,'응답이 없으면 5문항');
 const line=responseBox(box.html);
 assert.match(line,/이번 연습 어땠어요\?/);
 for(const name of ['좋았어요','안 맞았어요','많았어요','더 하고 싶어요'])assert.match(line,new RegExp(`>${name}<`));
 assert.equal((line.match(/aria-pressed="true"/g)||[]).length,0,'고르지 않아도 된다');
 const [decision,completion]=setEvents(env);
 assert.equal(decision.experienceId,'world-practice.set');assert.equal(decision.variant,'short');assert.equal(completion.decisionId,decision.id);
 box.press('data-set-response','too_much');
 assert.match(responseBox(box.html),/고마워요\. 「내 계정」에서 보고 뺄 수 있어요\./);
 assert.match(responseBox(box.html),/앞으로 짧은 연습을 조금 짧게 할게요\. 다음 응답으로 바꿀 수 있어요\./);
 assert.match(responseBox(box.html),/data-set-response="too_much" aria-pressed="true"/);
 const response=setEvents(env).find(e=>e.type==='feedback.given');
 assert.deepEqual([response.completionId,response.decisionId,response.value],[completion.id,decision.id,'too_much']);
 // 「새 문항 n개 더 하기」의 n도 새 길이(3)를 따른다.
 if(box.html.includes('data-practice-again'))assert.match(box.html,/새 문항 [1-3]개 더 하기/);
 box.press('data-set-response','too_much');
 assert.equal(setEvents(env).filter(e=>e.type==='feedback.given').length,1,'같은 값을 다시 누르면 사건 0');
 box.press('data-set-response','helpful');
 assert.doesNotMatch(responseBox(box.html),/앞으로 짧은 연습을/,'좋았어요에는 효과를 말하지 않는다');
 assert.deepEqual(env.education.responses().map(row=>[row.kind,row.value]),[['short','helpful']],'다른 값이 앞 응답을 대신한다');
});

test('짧은 연습 문항 수 3·5·7은 짧은 연습의 마지막 응답 하나로만 — 진단·시험 형식 응답은 움직이지 않고, 빼거나 30일이 지나면 돌아간다',async()=>{
 const env=setup();
 let run=await runPractice(env);run.box.press('data-set-response','too_much');
 run=await runPractice(env);assert.equal(run.total,3,'많았어요 → 3문항');
 run.box.press('data-set-response','want_more');
 // 진단·시험 형식의 응답은 길이를 바꾸지 않고 효과 문구도 없다.
 const check=await runDiagnostic(env);check.press('data-set-response','too_much');
 assert.match(responseBox(check.html),/고마워요/);assert.doesNotMatch(responseBox(check.html),/앞으로 짧은 연습을/);
 const mock=await runMock(env);mock.press('data-set-response','too_much');
 assert.doesNotMatch(responseBox(mock.html),/앞으로 짧은 연습을/);
 run=await runPractice(env);assert.equal(run.total,Math.min(7,freshestSkillCount(env,run)),'더 하고 싶어요 → 7문항(처음 보는 문항이 모자라면 있는 만큼)');
 // 「내 계정」 목록: 30일 안 전부, 새것부터.
 assert.deepEqual(env.education.responses().map(row=>[row.kind,row.value]),[['mock','too_much'],['diagnostic','too_much'],['short','want_more'],['short','too_much']]);
 // 마지막 짧은 연습 응답(더 하고 싶어요)을 빼면 그 앞 응답(많았어요)으로.
 const wantMore=env.education.responses().find(row=>row.value==='want_more');
 assert.equal(env.education.removeResponse(wantMore.id),true);
 assert.ok(!env.education.responses().some(row=>row.id===wantMore.id),'뺀 응답은 목록에서 빠진다');
 run=await runPractice(env);assert.equal(run.total,3);
 // 30일이 지나면 응답을 더 읽지 않아 5문항.
 env.tick(31*DAY);
 run=await runPractice(env);assert.equal(run.total,5);
 assert.deepEqual(env.education.responses().filter(row=>row.kind==='short'),[]);
});
// 7문항 판을 돌린 뒤 그 판이 낸 문항 수와 견줄 값: 판을 열 때 그 항목에 남아 있던 처음 보는 문항 수(지금 남은 것 + 이번에 낸 것).
function freshestSkillCount(env,run){
 const coach=worldLearning.engine.createGame({gameId:'probe',storage:env.storage});
 const left=worldPosition.practice.practiceSupply({pool:worldPosition.practice.pool,seen:item=>coach.exposure(item).seen,audioAvailable:false})[run.skillId]||0;
 return left+run.total;
}

test('손님과 기능 꺼짐에는 응답 줄도 판 기록도 없다(세 끝 화면 모두)',async()=>{
 for(const env of [setup({owner:'guest'}),setup({responses:false})]){
  const practice=await runPractice(env);
  assert.equal(practice.total,5);
  assert.doesNotMatch(practice.box.html,/data-set-response/);
  assert.doesNotMatch((await runDiagnostic(env)).html,/data-set-response/);
  assert.doesNotMatch((await runMock(env)).html,/data-set-response/);
  assert.deepEqual(setEvents(env),[],'.set 결정·마침·응답이 0');
  assert.equal(env.education.responses(),null,'「내 계정」 목록도 없다');
 }
});

test('응답을 남기지 못하면(판이 접혀 사라짐) 조용히 알리고 고른 표시를 하지 않는다',async()=>{
 const env=setup();
 const {box}=await runPractice(env);
 // 다른 탭이 이 기기 기록을 새 판(다른 epoch)으로 바꾼 경우: 이 판의 마침이 기록에 없다.
 env.storage.setItem(KEY,JSON.stringify({version:1,epoch:'other-tab',events:[]}));
 box.press('data-set-response','helpful');
 assert.match(responseBox(box.html),/지금은 응답을 남기지 못했어요\./);
 assert.equal((responseBox(box.html).match(/aria-pressed="true"/g)||[]).length,0);
});

test('끝 화면 그림: 효과 문구는 짧은 연습의 많았어요·더 하고 싶어요에만, 계획 숙제의 n도 길이 값', ()=>{
 const view=worldPosition.createView({t});
 assert.equal(view.renderSetResponse(null),'');
 for(const kind of ['short','diagnostic','mock'])for(const value of ['helpful','not_fit','too_much','want_more']){
  const html=view.renderSetResponse({kind,value});
  const effect=kind==='short'&&['too_much','want_more'].includes(value);
  assert.equal(/앞으로 짧은 연습을/.test(html),effect,`${kind}·${value}`);
  assert.match(html,new RegExp(`data-set-response="${value}" aria-pressed="true"`));
 }
 const plan={exam:{type:'topik1'},areas:[],homework:[{skillId:'ko.reading.detail',status:'practice',fresh:9,domain:'reading',activities:[]}],checks:[],reach:{confirmed:0,total:16,evidence:0}};
 assert.match(view.renderExamPlan({plan,count:3}),/새 문항 3개/);
 assert.match(view.renderExamPlan({plan}),/새 문항 5개/);
 const done=view.renderPracticeDone({skill:{id:'ko.reading.detail'},results:[],more:9,count:7});
 assert.match(done,/새 문항 7개 더 하기/);
});

test('새 화면 글은 세 언어 모두 있고 영어·몽골어에는 한글이 없다(영어 응답 이름은 처리방침 문장과 같다)',()=>{
 const keys=Object.keys(STRINGS).filter(key=>key.startsWith('response.'));
 assert.ok(keys.length>=19);
 for(const key of keys){
  const row=STRINGS[key];
  assert.ok(row.ko&&row.en&&row.mn,key);
  for(const lang of ['en','mn'])assert.doesNotMatch(String(row[lang]),/[가-힣]/,`${key}.${lang}`);
 }
 assert.deepEqual(['helpful','not_fit','too_much','want_more'].map(value=>STRINGS[`response.value.${value}`].en),['Good','Not for me','Too much','I want more']);
});
