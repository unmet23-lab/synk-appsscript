import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createLifeSession,sheetResource} from '../world-session.mjs';
import {createDeviceRecordsOffer} from '../device-records.mjs';
import {createHangulProgressPort,HANGUL_PROGRESS_KEY} from '../hangul-progress-port.mjs';
import {emptyProgress,meet} from '../../hangul-stage/core.mjs';
import {emptyPlayState,validatePlayChanges} from '../../play-common/play-data.mjs';
import {mountEnrollment} from '../../synk-account/src/enrollment.mjs';

// Execute unchanged complete shell blocks, not a reimplementation of the wiring.
// DOM/navigation and mount ports are controlled doubles; migration uses the real
// offer + Hangul port + game account store/CAS. This is not browser/OAuth evidence.
const source=readFileSync(process.env.SYNK_SHELL_UNDER_TEST||new URL('../app-shell.mjs',import.meta.url),'utf8');
function block(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,`${start} source block`);return source.slice(a,b);}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const memory=()=>{const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
const no=()=>{};
function fixture({operating=true,owner='alpha',generation=1,recordsFactory=null}={}){
 const listeners={},captures={},disposed=[],toasts=[],shown=[],confirms=[],nodes=new Map();let confirm=true,draft=true;
 for(const selector of ['#world-classroom-lessons','#world-classroom-homework','#world-classroom-entry'])nodes.set(selector,{});
 const client={snapshot:owner==='guest'?null:{accountId:owner,revision:1},generation,status:'ready'};
 const document={addEventListener(type,fn,capture){(listeners[type]??=[]).push({fn,capture});},querySelector:selector=>nodes.get(selector)||null,querySelectorAll:()=>[]};
 const home={isMaru:false,tutor:()=>({}),showPanel:(...args)=>shown.push(args),closePanel:()=>disposed.push('panel'),toast:text=>toasts.push(text),connectEducation:no,connectReminders:no};
 const account={assertActive:no,supportsClassroom:true,supportsHomework:true,preferences:()=>null,readClassrooms:no,courseRequest:no,readHomework:no,submitHomework:no,readHomeworkKey:no,enrollmentRequest:no,restore:async()=>{},prepareGame:async()=>{}};
 const context={console,Promise,queueMicrotask,document,client,home,account,operating,localStorage:memory(),sheetResource,window:{confirm:text=>{confirms.push(text);return confirm;}},
  sheet:null,gameLaunch:0,gameRecovery:null,screen:'',EYEBROWS:{},TUTOR_NAMES:{},t:key=>key,escape:String,profilePortrait:()=>'',responsesSection:()=>'',mountResponses:no,signIn:no,
  $:selector=>nodes.get(selector)||{},renderHomeHanger:no,hanger:{},
  mountClassroomLessons:args=>{captures.lessons=args;return {dispose:()=>disposed.push('lessons')};},
  mountCourseWritingEntry:args=>{captures.course=args;return {hasDraft:()=>draft,dispose:()=>disposed.push('course')};},
  mountClassroomHomework:args=>{captures.homework=args;return {dispose:()=>disposed.push('homework')};},
  mountEnrollment:args=>{captures.enrollment=args;return {dispose:()=>disposed.push('enrollment')};},homeworkJson:no,
  createLifeExperience:()=>({dispose:()=>disposed.push('life-ui')}),worldUrl:v=>v,worldLearning:{},createWorldLearningPlan:no,
  createWorldEducation:args=>{captures.education=args;return {dispose:()=>disposed.push('education')};},worldPosition:{},responsesOn:false,
  launchGame:no,classworkThisWeek:no,writingReady:()=>false,WRITING_CANDIDATES:[],openWriting:no,readWritingSummary:()=>({times:[]}),writingOwnerId:()=>owner,
  speakingModule:null,openSpeaking:no,worldTownCheck:{},town:no,quietTownCheck:no,createTrailTimes:()=>({dispose:()=>disposed.push('trail')}),
  createWorldReminders:()=>({schedule:no,dispose:()=>disposed.push('reminders')}),reminderInputs:no,openReminder:no,repaintReminderCard:no,worldPush:null,pushOn:false,
  refreshLife:no,repaintWritingRow:no,showEntryRecovery:no,commands:{},accountPrint:()=>'',initialRestoreReady:Promise.resolve(),sessionTask:null,sessionConfirmed:true,restoreSession:async()=>{},prepareWorldTutor:no,
  createDeviceRecordsOffer:args=>{captures.device=args;return recordsFactory?recordsFactory(args):{offer:id=>{captures.offered=id;return 'offered';}};},createWorldEntryGate:args=>{captures.gate=args;return args;},
 };
 vm.createContext(context);
 const run=text=>vm.runInContext(text,context);
 run(block('function show(', 'function errorText('));
 run(block('function profile(){','async function wardrobe(){'));
 run(block('function mountLifeLearning(', '// 알림 계획의 입력'));
 context.life={owner,ui:{hangulReading:()=>null},progress:{},education:{},closed:false};
 run(block('const accountLife=', 'window.__synkWorld.entry='));
 return {context,run,listeners,captures,disposed,toasts,shown,confirms,nodes,client,account,home,setDraft:value=>{draft=value;},setConfirm:value=>{confirm=value;},
  fire(type,{key,id='',target=null}={}){const event={key,target:target||{id,dataset:{},closest:()=>null},prevented:0,stopped:0,preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;}};for(const {fn}of listeners[type]||[])fn(event);return event;},
  mount(){const parts=[];run('mountLifeLearning')({owner,keep:(name,value,dispose=v=>v?.dispose?.())=>{parts.push(()=>dispose(value));return value;}});context.life.education=context.window.__synkEducation;return ()=>{for(const release of parts.reverse())release();};},
 };
}

test('profile mounts course writing alongside lessons/homework and keeps draft/disposal in the current sheet',()=>{
 const f=fixture();f.run('profile()');assert.ok(f.captures.course,'course-writing entry must be mounted');
 assert.equal(f.captures.course.container,f.captures.lessons.container);assert.equal(f.captures.course.transport,f.account.courseRequest);
 assert.equal(f.run('sheet.hasDraft()'),true);f.setDraft(false);assert.equal(f.run('sheet.hasDraft()'),false);
 f.client.generation++;assert.throws(f.captures.course.guard,{code:'ACCOUNT_CHANGED'});
 f.run('close();releaseSheet()');for(const name of ['course','lessons','homework','enrollment'])assert.equal(f.disposed.filter(x=>x===name).length,1,name);
});

test('ordinary navigation, Escape and dialog cancel honor the unsent draft; logout and forced close remain possible',()=>{
 const f=fixture();f.run('profile()');f.setConfirm(false);
 const button={dataset:{world:'wardrobe'}};
 const click=f.fire('click',{target:{id:'',closest:()=>button}});assert.equal(click.prevented,1);assert.equal(click.stopped,1);
 const key=f.fire('keydown',{key:'Escape'});assert.equal(key.prevented,1);assert.equal(key.stopped,1);assert.equal(f.disposed.length,0);
 assert.equal(f.fire('cancel',{id:'world-panel'}).prevented,1);
 assert.equal(f.fire('click',{target:{closest:()=>({dataset:{world:'logout'}})}}).prevented,0);
 assert.equal(f.fire('click',{target:{id:'text',closest:()=>null}}).prevented,0);
 f.setConfirm(true);f.fire('keydown',{key:'Escape'});assert.equal(f.disposed.filter(x=>x==='course').length,1);
 const prompts=f.confirms.length;f.run('close()');assert.equal(f.confirms.length,prompts,'identity invalidation does not ask to retain account text');
});

test('enrollment beforeClaim blocks a real claim until the draft-close confirmation is accepted',async()=>{
 const f=fixture();f.run('profile()');assert.equal(typeof f.captures.enrollment.beforeClaim,'function');
 const created=[];const doc={createElement(tag){const el={tag,children:[],handlers:{},ownerDocument:doc,append(...children){this.children.push(...children);},setAttribute:no,addEventListener(k,fn){this.handlers[k]=fn;},replaceChildren(){this.children=[];},remove:no};created.push(el);return el;}};
 const container={ownerDocument:doc,append:no},calls=[];
 const view=mountEnrollment({...f.captures.enrollment,container,onLinked:no,request:async action=>{calls.push(action);return action==='preview'?{invite:{className:'Synthetic',learnerLabel:'Learner'}}:{linked:true};}});
 const input=created.find(x=>x.tag==='input'),form=created.find(x=>x.tag==='form'),button=created.find(x=>x.type==='button');
 input.value='a'.repeat(32);await form.handlers.submit({preventDefault:no});f.setConfirm(false);await button.handlers.click();assert.deepEqual(calls,['preview']);
 f.setConfirm(true);await button.handlers.click();assert.deepEqual(calls,['preview','claim']);view.dispose();
});

test('replacing the profile releases its course draft and does not prompt on a later unrelated sheet',()=>{
 const f=fixture();f.run('profile();show("other","","world-town")');assert.equal(f.disposed.filter(x=>x==='course').length,1);
 f.setConfirm(false);assert.equal(f.fire('keydown',{key:'Escape'}).prevented,0);assert.equal(f.confirms.length,0);
});

test('account learning reads account Hangul bytes and always disposes its temporary port; guest/local do not request it',async()=>{
 const f=fixture();f.mount();const reads=[];let disposed=0;
 f.account.prepareHangulProgress=async options=>{reads.push(options);return {read:()=>'{"v":1}',dispose:()=>disposed++};};
 assert.equal(typeof f.captures.education.readHangulProgress,'function');assert.equal(await f.captures.education.readHangulProgress(),'{"v":1}');
 assert.equal(reads[0].storage,f.context.localStorage);assert.equal(reads[0].target,f.context.window);assert.equal(disposed,1);
 f.account.prepareHangulProgress=async()=>({read(){throw Error('read failed');},dispose:()=>disposed++});
 await assert.rejects(f.captures.education.readHangulProgress(),/read failed/);assert.equal(disposed,2);
 for(const options of [{owner:'guest'},{operating:false}]){const other=fixture(options);other.mount();assert.equal(other.captures.education.readHangulProgress,null);}
});

test('entry waits for the account Hangul port before offering migration, and life disposal releases it',async()=>{
 const f=fixture(),release=f.mount(),pending=deferred();let disposed=0;
 const port={accountId:'alpha',dispose:()=>disposed++};f.account.prepareHangulProgress=()=>pending.promise;
 const job=f.captures.gate.offer({owner:'alpha',generation:1});await Promise.resolve();assert.equal(f.captures.offered,undefined);
 pending.resolve(port);assert.equal(await job,'offered');assert.equal(f.captures.device.hangulPort(),port);
 release();assert.equal(disposed,1);assert.equal(f.captures.device.hangulPort(),null);
});

for(const change of ['owner','generation','pagehide','remount'])test(`late Hangul preparation cannot offer a port after ${change}`,async()=>{
 const f=fixture(),release=f.mount(),pending=deferred();let disposed=0;f.account.prepareHangulProgress=()=>pending.promise;
 const job=f.captures.gate.offer({owner:'alpha',generation:1});
 if(change==='owner')f.client.snapshot.accountId='beta';
 if(change==='generation')f.client.generation++;
 if(change==='pagehide'){release();f.context.life.closed=true;}
 if(change==='remount'){release();f.mount();}
 pending.resolve({dispose:()=>disposed++});assert.equal(await job,null);assert.equal(f.captures.offered,undefined);assert.equal(disposed,1);
});

test('failed account Hangul preparation defers the offer instead of presenting device-only migration',async()=>{
 const f=fixture();f.mount();f.account.prepareHangulProgress=async()=>{throw Error('offline');};
 assert.equal(await f.captures.gate.offer({owner:'alpha',generation:1}),null);assert.equal(f.captures.offered,undefined);assert.equal(f.toasts.length,1);
});

test('the real life session owns migration disposal across generation changes and pagehide',async()=>{
 const f=fixture();let disposals=0;
 f.context.life=createLifeSession({identity:()=>({owner:f.client.snapshot.accountId,generation:f.client.generation}),openPort:async()=>null,createProgress:()=>({stop:no}),mountView:f.run('mountLifeLearning')});
 f.account.prepareHangulProgress=async()=>({dispose:()=>disposals++});
 f.context.life.sync();await f.context.life.ready;await f.captures.gate.offer({owner:'alpha',generation:1});
 f.client.generation++;f.context.life.sync();await f.context.life.ready;assert.equal(disposals,1);assert.equal(f.captures.device.hangulPort(),null);
 await f.captures.gate.offer({owner:'alpha',generation:2});f.context.life.close();f.context.life.close();assert.equal(disposals,2);assert.equal(f.captures.device.hangulPort(),null);
});

test('guest and local entry preserve the existing no-account Hangul preparation route',async()=>{
 for(const options of [{owner:'guest'},{operating:false}]){
  const f=fixture(options);f.mount();f.account.prepareHangulProgress=()=>assert.fail('guest/local must not ask account');
  const identity={owner:options.owner||'alpha',generation:1};assert.equal(await f.captures.gate.offer(identity),'offered');assert.equal(f.captures.offered,identity);
 }
});

test('shell wiring migrates a real guest Hangul snapshot through the actual account port and CAS store',async()=>{
 let present;const f=fixture({recordsFactory:options=>createDeviceRecordsOffer({...options,importLife:null,importLearning:null,present:value=>{present=value;},defer:fn=>fn()})});f.mount();const state=emptyPlayState();let revision=0;const calls=[],receipts=new Set();
 const reply=()=>({ok:true,scope:'synk-play',accountId:'alpha',state:structuredClone(state),revision});
 const remote={load:async()=>reply(),mutate:async body=>{calls.push(body);if(!receipts.has(body.id)){const changes=validatePlayChanges(body.changes);for(const change of changes)assert.equal(state.records[change.key]??null,change.previous);for(const change of changes)state.records[change.key]=change.value;receipts.add(body.id);revision++;}return reply();}};
 const raw=JSON.stringify(meet(emptyProgress(),['v-a','v-o'],'2026-10-20T00:00:00Z'));f.context.localStorage.setItem(HANGUL_PROGRESS_KEY,raw);
 f.account.prepareHangulProgress=options=>createHangulProgressPort({accountId:'alpha',client:remote,guard:no,...options});
 const pending=f.captures.gate.offer({owner:'alpha',generation:1});
 for(let i=0;i<40&&!present;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.ok(present,'the real migration prompt must be shown');assert.equal(state.records[HANGUL_PROGRESS_KEY],undefined,'opening never imports implicitly');
 assert.equal(await f.run('deviceRecords').choose('move',{owner:'alpha'}),'moved');assert.equal(await pending,'moved');
 assert.equal(state.records[HANGUL_PROGRESS_KEY],raw);assert.equal(f.context.localStorage.getItem(HANGUL_PROGRESS_KEY),raw);assert.equal(calls.length,1);assert.equal(revision,1);
});
