// 10-26 GQ1: 손님 기기 기록 옮기기(importRecords)는 계정 생활 진도의 남은 자리(날 30·하루 문항 100)에만 더한다.
// 계정의 날·문항·같은 키 값·closedAt은 밀어내거나 덮지 않고, 저장 상한을 넘기면 계정의 지난 날을 자르지 않고 통째로 거절한다.
// 메모리 저장소와 「synced」 저장 상태만 쓴다 — 실제 계정 전송·DB·화면은 이 시험 밖이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLifeProgress,LIFE_PROGRESS_KEY,lifeDayKey} from '../life-progress.mjs';

const OWNER='account-example',DAY=86400000,BASE=Date.parse('2026-01-01T03:00:00.000Z');
const at=n=>BASE+n*DAY,dayKey=n=>lifeDayKey(at(n));
const memory=()=>{const data=new Map();let writes=0;return {getItem:key=>data.get(key)??null,setItem(key,value){writes++;data.set(key,String(value));},get writes(){return writes;},data};};
const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value)).length;
const item=(n=0,outcome='independent',lessonId='lesson-example')=>({lessonId,observedAt:at(n),outcome});
// 계정 기록: n일에 하루 한 문항씩, 또는 첫날 하루에 n문항.
const spanDays=count=>Object.fromEntries(Array.from({length:count},(_,n)=>[dayKey(n),{items:{[`q${n}`]:item(n)}}]));
const fullDay=count=>({[dayKey(0)]:{items:Object.fromEntries(Array.from({length:count},(_,n)=>[`q${n}`,item(0)]))}});
const record=(days,extra={})=>({version:1,owner:OWNER,revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{},daily:{version:1,days},...extra});
function open(value){
 const storage=memory();storage.setItem(LIFE_PROGRESS_KEY,JSON.stringify(value));
 const options={storage,owner:OWNER,mode:'account',now:()=>at(40),uuid:()=>'test-id',getSaveStatus:()=>({phase:'synced',pending:0,rejected:0})};
 return {storage,progress:createLifeProgress(options),reopen:()=>createLifeProgress(options),raw:()=>storage.getItem(LIFE_PROGRESS_KEY)};
}
// 다시 열어도 읽히는지(unreadable이 아닌지)를 보고 그때의 기록을 돌려준다.
function reload(f){const again=f.reopen(),status=again.status();assert.equal(status.phase,'synced');assert.equal(status.code,undefined);return again.exportSnapshot();}
function take(f,records){const {status,...added}=f.progress.importRecords(records);assert.equal(status.phase,'synced');return added;}
const shape=days=>[Object.keys(days).length,Math.max(...Object.values(days).map(day=>Object.keys(day.items).length))];
const none={lessons:0,reviews:0,days:0,profile:false},oneDay={...none,days:1};

test('a full account (30 days, or 100 questions in one day) takes nothing past the cap: no write, and it still reloads',()=>{
 for(const [label,days,guest]of [['30 days + 1 day',spanDays(30),{[dayKey(30)]:{items:{qnew:item(30)}}}],['100 questions + 1',fullDay(100),{[dayKey(0)]:{items:{qnew:item(0)}}}]]){
  const f=open(record(days)),raw=f.raw(),writes=f.storage.writes,input=structuredClone(guest);
  assert.deepEqual(take(f,{days:guest}),none,label);
  assert.equal(f.storage.writes,writes,label);assert.equal(f.raw(),raw,label);assert.deepEqual(guest,input,label);
  const saved=reload(f);assert.deepEqual(saved.daily.days,days,label);assert.equal(saved.revision,0,label);assert.equal(saved.imports,undefined,label);
 }
});

test('one below the cap (29 days + 1, 99 questions + 1) the guest record is added and reloads at exactly 30 days / 100 questions',()=>{
 for(const [label,days,guest,expected]of [['29 days + 1 day',spanDays(29),{[dayKey(29)]:{items:{qnew:item(29)}}},[30,1]],['99 questions + 1',fullDay(99),{[dayKey(0)]:{items:{qnew:item(0)}}},[1,100]]]){
  const f=open(record(days)),writes=f.storage.writes,input=structuredClone(guest),key=Object.keys(guest)[0];
  assert.deepEqual(take(f,{days:guest}),oneDay,label);
  assert.equal(f.storage.writes,writes+1,label);assert.deepEqual(guest,input,label);
  const saved=reload(f);assert.deepEqual(shape(saved.daily.days),expected,label);
  for(const [k,day]of Object.entries(days))assert.deepEqual(saved.daily.days[k].items,{...day.items,...(k===key?guest[key].items:{})},label);
  assert.deepEqual(saved.daily.days[key].items.qnew,guest[key].items.qnew,label);
  assert.equal(saved.revision,1,label);assert.deepEqual(saved.imports,[{from:'guest-device',at:at(40),lessons:0,reviews:0,days:1,profile:false}],label);
 }
});

test('two guest entries with room for one (29 days + 2, 99 questions + 2): only the first fits, added counts it, and moving again writes nothing',()=>{
 const cases=[
  ['29 days + 2 days',spanDays(29),{[dayKey(29)]:{items:{qa:item(29)}},[dayKey(30)]:{items:{qb:item(30)}}},[30,1],
   saved=>{assert.deepEqual(saved.daily.days[dayKey(29)],{items:{qa:item(29)}});assert.equal(saved.daily.days[dayKey(30)],undefined);}],
  ['99 questions + 2',fullDay(99),{[dayKey(0)]:{items:{qa:item(0),qb:item(0,'retry')}}},[1,100],
   saved=>{const items=saved.daily.days[dayKey(0)].items;assert.deepEqual(items.qa,item(0));assert.equal(items.qb,undefined);}]];
 for(const [label,days,guest,expected,check]of cases){
  const f=open(record(days)),writes=f.storage.writes,input=structuredClone(guest);
  assert.deepEqual(take(f,{days:guest}),oneDay,label);assert.equal(f.storage.writes,writes+1,label);
  const saved=reload(f);check(saved);assert.deepEqual(shape(saved.daily.days),expected,label);
  for(const [k,day]of Object.entries(days))for(const [id,value]of Object.entries(day.items))assert.deepEqual(saved.daily.days[k].items[id],value,label);
  assert.deepEqual(saved.imports.map(row=>row.days),[1],label);
  // 같은 것을 다시 옮기면 더할 자리도 새것도 없다: 쓰지 않고 바이트가 그대로다(다시 연 기록에서도).
  const raw=f.raw(),again=f.storage.writes;
  assert.deepEqual(take(f,{days:guest}),none,label);
  assert.equal(f.reopen().importRecords({days:guest}).days,0,label);
  assert.equal(f.storage.writes,again,label);assert.equal(f.raw(),raw,label);assert.deepEqual(guest,input,label);
 }
});

test('existing questions, values and closedAt stay as the account had them; the guest input is never changed or shared',()=>{
 const days=spanDays(29);days[dayKey(0)]={items:{q0:item(0,'retry')},closedAt:at(0)+60000};
 const guest={[dayKey(0)]:{items:{q0:item(0,'independent'),qadd:item(0,'assisted')},closedAt:at(0)+120000},[dayKey(29)]:{items:{q29:item(29)},closedAt:at(29)+60000},[dayKey(30)]:{items:{q30:item(30)}}};
 const f=open(record(days)),input=structuredClone(guest);
 assert.deepEqual(take(f,{days:guest}),{...none,days:2},'the existing day that got a question and the one new day that fit');
 const saved=reload(f);
 assert.deepEqual(saved.daily.days[dayKey(0)],{items:{q0:item(0,'retry'),qadd:item(0,'assisted')},closedAt:at(0)+60000},'the same key and closedAt are the account’s');
 assert.deepEqual(saved.daily.days[dayKey(29)],guest[dayKey(29)],'a new day arrives whole');
 assert.equal(saved.daily.days[dayKey(30)],undefined,'no room for a 31st day');
 assert.deepEqual(guest,input);
 // 옮긴 뒤 손님 입력을 바꿔도 계정 기록은 따라 바뀌지 않는다.
 guest[dayKey(0)].items.qadd.outcome='retry';guest[dayKey(29)].items.q29.outcome='retry';
 const current=f.progress.exportSnapshot().daily.days;assert.deepEqual(current[dayKey(0)].items.qadd,item(0,'assisted'));assert.deepEqual(current[dayKey(29)].items.q29,item(29));
 // 문항이 꽉 찬 닫힌 날: 같은 키의 다른 값과 새 문항 모두 아무것도 바꾸지 않는다.
 const full=fullDay(100);full[dayKey(0)].closedAt=at(0)+60000;
 const g=open(record(full)),raw=g.raw(),writes=g.storage.writes;
 assert.deepEqual(take(g,{days:{[dayKey(0)]:{items:{q0:item(0,'retry'),qnew:item(0)},closedAt:at(0)+120000}}}),none);
 assert.equal(g.storage.writes,writes);assert.equal(g.raw(),raw);assert.deepEqual(reload(g).daily.days,full);
});

test('at the day cap, a guest lesson, its review and new questions on an existing day are still added as before',()=>{
 const days=spanDays(30),lessonId='lesson-import',questionId='q-import';
 const lesson={attemptId:'guest-attempt',startedAt:at(29),completedAt:at(29)+5000,questionIds:[questionId],answers:{[questionId]:{correct:true,helped:false,choiceId:null,at:at(29)+1000}}};
 const review={id:'q-import-transfer',questionId,lessonId,packId:'greetings',skillId:'skill-0',dueAt:at(30),lastAt:at(29)+1000,streak:0,lapses:0,intervalDays:1};
 const moved={...item(29,'independent',lessonId),observedAt:at(29)+1000};
 const guest={lessons:{[lessonId]:lesson},reviews:{[review.id]:review},days:{[dayKey(30)]:{items:{q30:item(30)}},[dayKey(29)]:{items:{[questionId]:moved}}}};
 const f=open(record(days)),input=structuredClone(guest);
 assert.deepEqual(take(f,guest),{lessons:1,reviews:1,days:1,profile:false});
 const saved=reload(f);
 assert.deepEqual(saved.lessons[lessonId],lesson);assert.deepEqual(saved.reviews[review.id],review);
 assert.deepEqual(saved.daily.days[dayKey(29)].items,{q29:item(29),[questionId]:moved});
 assert.equal(saved.daily.days[dayKey(30)],undefined);assert.deepEqual(shape(saved.daily.days),[30,2]);
 for(const [k,day]of Object.entries(days))for(const [id,value]of Object.entries(day.items))assert.deepEqual(saved.daily.days[k].items[id],value);
 assert.deepEqual(saved.imports.map(row=>[row.lessons,row.reviews,row.days]),[[1,1,1]]);
 assert.deepEqual(guest,input);
});

test('an import that would pass the record size limit is refused whole instead of trimming the account’s past days',()=>{
 const days=spanDays(3),guest={[dayKey(3)]:{items:{qnew:item(3)}}};
 // 계정 원본을 저장 상한(480000바이트) 바로 아래까지 채운다 — 남는 자리만 다르다.
 const padded=room=>{const value=record(days,{preservedExtension:{pad:''}});value.preservedExtension.pad='x'.repeat(480000-room-bytes(value));return value;};
 const roomy=open(padded(1000));assert.equal(bytes(roomy.raw()),479000);
 assert.deepEqual(take(roomy,{days:guest}),oneDay);
 assert.deepEqual(reload(roomy).daily.days,{...days,...guest},'every account day is kept next to the guest day');
 assert.ok(bytes(roomy.raw())<=480000);
 const tight=open(padded(50)),raw=tight.raw(),writes=tight.storage.writes,before=tight.progress.exportSnapshot(),input=structuredClone(guest);
 assert.equal(bytes(raw),479950);
 assert.throws(()=>tight.progress.importRecords({days:guest}),{code:'PLAY_DATA_TOO_LARGE'});
 assert.equal(tight.storage.writes,writes);assert.equal(tight.raw(),raw);assert.deepEqual(tight.progress.exportSnapshot(),before);assert.deepEqual(guest,input);
 assert.equal(tight.progress.status().phase,'synced');
 // 더할 것이 없는 옮기기는 이 크기에서도 조용히 아무것도 하지 않는다.
 assert.deepEqual(take(tight,{days:{[dayKey(0)]:days[dayKey(0)]}}),none);
 assert.deepEqual(reload(tight).daily.days,days);assert.equal(tight.raw(),raw);
});
