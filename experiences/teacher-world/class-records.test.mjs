import test from 'node:test';
import assert from 'node:assert/strict';
import {classRecordsModel,attendanceRows,attendanceDirty,attendanceMissingStatus,attendanceCounts,topikBadge,levelLabel,localDate,addDays,TOPIK_LEVELS,createClassRecords} from './class-records.mjs';
import {classSummaryModel,classSummaryHtml,teacherOverviewModel,createTeacherOverview} from './workspace-overview.mjs';

// 서버(SYNK-talk learnerTopik)와 같은 꼴: level4는 유효한 4급 이상 가운데 가장 늦게 만료되는 성적이다.
const level4Of=records=>records.filter(r=>r.passed!==false&&r.level>=4&&r.state!=='expired').sort((x,y)=>String(y.expiresOn).localeCompare(String(x.expiresOn)))[0]||null;
const topik=(records=[],extra={})=>({shared:true,basisDate:'2026-11-27',records,representative:records[0]||null,level4:level4Of(records),validLevel4:!!level4Of(records),recordLimit:20,capacityReached:false,...extra});
const learner=(id,extra={})=>({id,name:'학생 '+id,accountConnected:true,accountConnectionStatus:'connected',sharing:{enabled:true,revision:2},topik:topik(),attendanceToday:null,absentStreak:0,...extra});
const workspace=(learners,attendance={})=>({classes:[{id:'c',name:'합성 반',attendance:{basisDate:'2026-11-27',sessionDate:'2026-11-27',rows:[],counts:{},recentDates:[],streaks:[],...attendance},learners}]});
const fakeRoot=()=>({innerHTML:'',className:'',attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(){},removeEventListener(){},replaceChildren(){this.innerHTML='';},querySelector(){return null;},contains(){return true;}});

test('no attendance key means the band is not drawn (switch off keeps the old class screen)',()=>{
  assert.equal(classRecordsModel({classes:[{id:'c',learners:[learner('a')]}]},'c'),null);
  assert.equal(classRecordsModel(workspace([learner('a')]),'other'),null);
  const root=fakeRoot(),view=createClassRecords({root,request:async()=>{throw Error('no call');},documentObject:null,now:()=>new Date('2026-11-27T03:00:00+09:00')});
  assert.equal(view.render({classes:[{id:'c',learners:[]}]},'c'),false);assert.equal(root.innerHTML,'');view.stop();
});
test('only connected, shared learners can be recorded; others are listed but muted',()=>{
  const model=classRecordsModel(workspace([learner('b'),learner('a',{sharing:{enabled:false,revision:3},topik:{shared:false,records:[]}}),learner('u',{accountConnected:false,accountConnectionStatus:'unconnected',topik:{shared:false,records:[]}})]),'c');
  assert.deepEqual(model.learners.map(l=>[l.id,l.shared,l.sharing]),[['a',false,'unshared'],['b',true,'shared'],['u',false,'unconnected']]);
  const saved=new Map(),draft=new Map([['a',{status:'present'}],['b',{status:'absent',note:'  감기  '}],['u',{status:'present'}]]);
  assert.deepEqual(attendanceRows(model.learners,saved,draft),[{learnerId:'b',status:'absent',note:'감기',revision:0}]);
  assert.deepEqual(attendanceCounts(model.learners,saved,draft),{present:0,late:0,absent:1,excused:0,unrecorded:0});
});
test('batch rows carry each saved revision, unchanged rows included, and dirty tracks real changes only',()=>{
  const model=classRecordsModel(workspace([learner('a'),learner('b'),learner('c')]),'c');
  const saved=new Map([['a',{learnerId:'a',status:'present',note:'',revision:2}],['b',{learnerId:'b',status:'late',note:'버스',revision:1}]]);
  assert.equal(attendanceDirty(model.learners,saved,new Map()),false);
  assert.equal(attendanceDirty(model.learners,saved,new Map([['a',{status:'present'}]])),false,'same status is not a change');
  assert.equal(attendanceDirty(model.learners,saved,new Map([['b',{note:'버스 '}]])),false,'trailing spaces are not a change');
  const draft=new Map([['a',{status:'absent'}],['c',{status:'present'}]]);assert.equal(attendanceDirty(model.learners,saved,draft),true);
  assert.deepEqual(attendanceRows(model.learners,saved,draft),[{learnerId:'a',status:'absent',note:'',revision:2},{learnerId:'b',status:'late',note:'버스',revision:1},{learnerId:'c',status:'present',note:'',revision:0}]);
  assert.equal(attendanceRows(model.learners,saved,new Map([['a',{note:'가'.repeat(260)}]]))[0].note.length,200);
});
test('TOPIK badges: four expiry states plus a failed result, with I/II level choices',()=>{
  const row=(state,daysLeft,level=4)=>({kind:'II',round:96,level,announcedOn:'2025-01-10',expiresOn:'2027-01-10',state,daysLeft,passed:level>0});
  assert.deepEqual(['valid','within90','within30','expired'].map(state=>topikBadge(row(state,state==='valid'?200:state==='within90'?70:state==='within30'?20:-5))).map(b=>[b.label,b.tone]),[['유효','good'],['90일 안 만료','warn'],['30일 안 만료','bad'],['만료','bad']]);
  assert.equal(topikBadge(row('within30',20)).detail,'D-20 · 만료일 2027-01-10');assert.equal(topikBadge(row('valid',300,0)).label,'미달');assert.equal(topikBadge(null),null);
  assert.deepEqual(TOPIK_LEVELS,{I:[1,2,0],II:[3,4,5,6,0]});assert.equal(levelLabel(0),'미달');assert.equal(levelLabel('4'),'4급');
  assert.equal(localDate(new Date(2026,1,3)),'2026-02-03');assert.equal(addDays('2028-02-28',1),'2028-02-29');
});
test('band HTML escapes names and notes, shows the recorder and keeps saved status pressed',()=>{
  const root=fakeRoot(),calls=[];
  const view=createClassRecords({root,request:async(path,body)=>{calls.push([path,body]);return {sessionDate:body.sessionDate,attendance:[]};},documentObject:null,now:()=>new Date(2026,10,27,10,0)});
  const data=workspace([learner('a',{name:'<img src=x onerror=bad>',topik:topik([{id:'t',kind:'II',round:96,level:4,announcedOn:'2025-01-10',expiresOn:'2027-01-10',state:'within90',daysLeft:44,passed:true}]),absentStreak:3})],{rows:[{learnerId:'a',sessionDate:'2026-11-27',status:'absent',note:'<b>연락 없음</b>',revision:1,recordedBy:'s',recordedByName:'<i>교사</i>',updatedAt:'2026-11-27T01:00:00Z'}]});
  assert.equal(view.render(data,'c'),true);
  assert.doesNotMatch(root.innerHTML,/<img src=x/);assert.match(root.innerHTML,/&lt;img src=x/);assert.match(root.innerHTML,/&lt;b&gt;연락 없음/);assert.match(root.innerHTML,/&lt;i&gt;교사/);
  assert.match(root.innerHTML,/data-att-status="absent" data-learner="a" aria-pressed="true"/);assert.match(root.innerHTML,/연속 결석 3회/);assert.match(root.innerHTML,/90일 안 만료/);assert.match(root.innerHTML,/오늘 출결/);
  assert.equal(calls.length,0,'the server day and the device day match, so no extra read');assert.equal(view.hasDraft(),false);view.stop();
});
test('a device date different from the server basis loads that local day once',async()=>{
  const root=fakeRoot(),calls=[];
  const view=createClassRecords({root,request:async(path,body)=>{calls.push(body);return {sessionDate:body.sessionDate,attendance:[]};},documentObject:null,now:()=>new Date(2026,10,26,23,30)});
  view.render(workspace([learner('a')]),'c');await new Promise(r=>setTimeout(r,0));
  assert.deepEqual(calls,[{action:'day',sessionDate:'2026-11-26'}]);view.stop();
});

const summaryData=()=>({classes:[{id:'c',name:'합성 A반',learners:[learner('a',{name:'가온'}),learner('b',{name:'<나래>'})]},{id:'d',name:'합성 B반',learners:[learner('x',{name:'자람'})]}],
  attendance:{basisDate:'2026-11-27',classes:[{classId:'c',counts:{present:1,late:0,absent:1,excused:0,unrecorded:0}}],absentToday:[{classId:'c',learnerId:'a',note:'연락 없음'}],lateToday:[{classId:'d',learnerId:'x',note:''}],consecutiveAbsences:[{classId:'c',learnerId:'a',count:3,since:'2026-11-24',lastDate:'2026-11-27'}]},
  topik:{basisDate:'2026-11-27',expiring:[{classId:'c',learnerId:'b',kind:'II',round:96,level:5,state:'within30',daysLeft:12,expiresOn:'2026-12-09'}],expired:[{classId:'c',learnerId:'a',kind:'II',round:90,level:4,state:'expired',daysLeft:-3,expiresOn:'2026-11-24'}],withoutValidLevel4:[{classId:'c',learnerId:'a',reason:'expired'},{classId:'d',learnerId:'x',reason:'no-record',best:null},{classId:'zz',learnerId:'ghost',reason:'no-record'}]}});
test('class summary: today absent and late, streaks, expiring/expired TOPIK and no valid level 4, scoped to the classes on screen',()=>{
  const data=summaryData(),model=teacherOverviewModel(data),summary=classSummaryModel(data,model);
  assert.equal(summary.basisDate,'2026-11-27');assert.deepEqual(summary.absent.map(r=>r.name),['가온']);assert.deepEqual(summary.late.map(r=>[r.name,r.className]),[['자람','합성 B반']]);
  assert.deepEqual(summary.streaks.map(r=>r.count),[3]);assert.deepEqual(summary.expiring.map(r=>r.name),['<나래>']);assert.deepEqual(summary.expired.map(r=>r.name),['가온']);
  assert.deepEqual(summary.noLevel4.map(r=>r.learnerId),['a','x'],'a learner outside the visible classes is dropped');
  const html=classSummaryHtml(data,model);assert.match(html,/기준일 2026-11-27/);assert.match(html,/&lt;나래&gt;/);assert.doesNotMatch(html,/<나래>/);
  assert.equal([...html.matchAll(/data-overview-student="a"/g)].length,4);assert.match(html,/30일 안 만료 · D-12/);assert.match(html,/4급 이상 만료/);
  assert.match(classSummaryHtml(data,model,{unavailable:true}),/data-overview-student="a" disabled/);
});
test('summary is absent without the new response keys, and long lists fold after six names',()=>{
  const plain={classes:[{id:'c',name:'반',learners:[learner('a')]}]};
  assert.equal(classSummaryModel(plain,teacherOverviewModel(plain)),null);assert.equal(classSummaryHtml(plain,teacherOverviewModel(plain)),'');
  const root={innerHTML:'',addEventListener(){},removeEventListener(){},replaceChildren(){this.innerHTML='';}},view=createTeacherOverview({root});view.render(plain);assert.doesNotMatch(root.innerHTML,/class-summary/);
  const many={classes:[{id:'c',name:'반',learners:Array.from({length:9},(_,i)=>learner('l'+i))}],topik:{basisDate:'2026-11-27',expiring:[],expired:[],withoutValidLevel4:Array.from({length:9},(_,i)=>({classId:'c',learnerId:'l'+i,reason:'no-record'}))}};
  view.render(many);assert.match(root.innerHTML,/class-summary/);assert.match(root.innerHTML,/나머지 3명 보기/);view.stop();
});

// 누르기 · 입력을 흉내 내는 띠 뿌리. querySelector는 그린 HTML에서 그 속성을 모두 가진 태그를 찾아 비활성 여부를 읽고, 비활성 단추에는 초점이 가지 않는다.
function liveRoot(){
  const listeners={},focused=[];
  return {innerHTML:'',className:'',attributes:{},listeners,focused,setAttribute(k,v){this.attributes[k]=v;},addEventListener(type,fn){listeners[type]=fn;},removeEventListener(type){delete listeners[type];},replaceChildren(){this.innerHTML='';},contains(){return true;},
    querySelector(selector){
      const wanted=[...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].map(([,name,value])=>value===undefined?' '+name+'="':' '+name+'="'+value+'"');
      const tag=[...this.innerHTML.matchAll(/<(?:button|input|select|li|form)\b[^>]*>/g)].map(m=>m[0]).find(t=>wanted.every(w=>t.includes(w)));
      if(!tag)return null;const disabled=/\sdisabled(?=[\s>])/.test(tag);
      return {disabled,focus(){if(!disabled)focused.push(selector);},scrollIntoView(){}};
    }};
}
const press=(root,dataset)=>root.listeners.click({target:{closest:()=>({dataset,disabled:false})}});
const tagOf=(root,attr)=>root.innerHTML.match(new RegExp('<[^>]*'+attr+'[^>]*>'))?.[0]||'';
const formFor=(id,values)=>({dataset:{attTopikForm:id},elements:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{value:v}]))});
const later=()=>new Promise(r=>setTimeout(r,0));

test('a note without a status counts as unsaved, and saving it asks for the status first without sending anything',async()=>{
  const root=liveRoot(),calls=[],notices=[];
  const view=createClassRecords({root,request:async(path,body)=>{calls.push(body);return {sessionDate:body.sessionDate,attendance:[]};},notice:(...args)=>notices.push(args),documentObject:null,now:()=>new Date(2026,10,27,10,0)});
  view.render(workspace([learner('a',{name:'가온'}),learner('b',{name:'나래'})]),'c');
  const model=classRecordsModel(workspace([learner('a'),learner('b')]),'c'),draft=new Map([['a',{note:'병원'}]]);
  assert.equal(attendanceDirty(model.learners,new Map(),draft),true);assert.deepEqual(attendanceMissingStatus(model.learners,new Map(),draft).map(l=>l.id),['a']);
  assert.deepEqual(attendanceMissingStatus(model.learners,new Map(),new Map([['a',{note:'  '}]])),[],'blank notes are not a change');
  root.listeners.input({target:{dataset:{attNote:'a'},value:'병원'}});press(root,{attSave:'1'});await later();
  assert.equal(calls.length,0,'nothing is sent while a changed row has no status');
  assert.match(root.innerHTML,/가온의 출결 상태를 먼저 골라 주세요/);assert.equal(notices.at(-1)[1],true);
  assert.deepEqual(root.focused,['[data-att-status="present"][data-learner="a"]']);
  assert.match(root.innerHTML,/저장 전 · 출결 상태를 골라 주세요/);assert.equal(view.hasDraft(),true);
  // 상태를 고르면 메모와 함께 저장된다.
  press(root,{attStatus:'excused',learner:'a'});press(root,{attSave:'1'});await later();
  assert.deepEqual(calls.at(-1).rows,[{learnerId:'a',status:'excused',note:'병원',revision:0}]);view.stop();
});
test('「모두 출석」 is off when every shared learner already has a status, and focus never lands on a disabled button',()=>{
  const rows=[{learnerId:'a',sessionDate:'2026-11-27',status:'present',note:'',revision:1},{learnerId:'b',sessionDate:'2026-11-27',status:'late',note:'',revision:1}];
  const band=saved=>{const root=liveRoot(),view=createClassRecords({root,request:async()=>{throw Error('no call');},documentObject:null,now:()=>new Date(2026,10,27,10,0)});view.render(workspace([learner('a'),learner('b')],{rows:saved}),'c');return {root,view};};
  const full=band(rows);assert.match(tagOf(full.root,'data-att-all'),/disabled/);assert.match(tagOf(full.root,'data-att-save'),/disabled/);
  press(full.root,{attAll:'1'});assert.deepEqual(full.root.focused,[],'an already full roster changes nothing and moves no focus');
  const half=band(rows.slice(0,1));assert.doesNotMatch(tagOf(half.root,'data-att-all'),/disabled/);
  press(half.root,{attAll:'1'});assert.deepEqual(half.root.focused,['[data-att-save]']);assert.match(tagOf(half.root,'data-att-all'),/disabled/);
  full.view.stop();half.view.stop();
});
test('TOPIK edit keeps the original kind and round in the heading; cancel carries the learner, is off while saving and returns to the edit button',async()=>{
  const root=liveRoot(),record={id:'t1',kind:'II',round:96,level:4,announcedOn:'2025-01-10',expiresOn:'2027-01-10',state:'within90',daysLeft:44,passed:true,revision:1};let finish;
  const view=createClassRecords({root,request:()=>new Promise(r=>{finish=r;}),documentObject:null,now:()=>new Date(2026,10,27,10,0)});
  view.render(workspace([learner('a',{topik:topik([record])})]),'c');
  press(root,{attTopikOpen:'a'});press(root,{attTopikEdit:'t1',learner:'a'});assert.match(root.innerHTML,/<legend>TOPIK II 제96회 고치기<\/legend>/);
  // 회차를 지우고 시험 종류를 바꾸거나 검증에 걸려도 머리글은 고치던 원본을 가리킨다.
  root.listeners.input({target:{dataset:{},form:formFor('a',{kind:'II',round:'',level:'4',announcedOn:'2025-01-10'})}});
  root.listeners.change({target:{dataset:{attTopikKind:'a'},form:formFor('a',{kind:'I',round:'',level:'4',announcedOn:'2025-01-10'})}});
  assert.match(root.innerHTML,/<legend>TOPIK II 제96회 고치기<\/legend>/);assert.match(root.innerHTML,/<option value="I" selected>/);assert.match(root.innerHTML,/<option value="1" selected>1급/);
  root.listeners.submit({target:formFor('a',{kind:'I',round:'',level:'1',announcedOn:'2025-01-10'}),preventDefault(){}});
  assert.match(root.innerHTML,/회차\(숫자\) · 급수 · 성적 발표일을 확인해 주세요/);assert.match(root.innerHTML,/<legend>TOPIK II 제96회 고치기<\/legend>/);
  const cancel=tagOf(root,'data-att-topik-cancel');assert.match(cancel,/data-att-topik-cancel="a" data-learner="a"/);assert.doesNotMatch(cancel,/disabled/);
  // 저장 중에는 취소할 수 없다.
  root.listeners.submit({target:formFor('a',{kind:'II',round:'97',level:'5',announcedOn:'2025-06-10'}),preventDefault(){}});
  assert.match(tagOf(root,'data-att-topik-cancel'),/disabled/);
  finish({topik:topik([{...record,round:97,level:5,revision:2}])});await later();assert.doesNotMatch(root.innerHTML,/고치기 취소/);
  press(root,{attTopikEdit:'t1',learner:'a'});root.focused.length=0;press(root,{attTopikCancel:'a',learner:'a'});
  assert.doesNotMatch(root.innerHTML,/고치기 취소/);assert.deepEqual(root.focused,['[data-att-topik-edit="t1"][data-learner="a"]']);view.stop();
});
test('refresh updates derived row marks such as the streak badge and keeps the chosen day, saved rows and draft',()=>{
  const root=liveRoot(),view=createClassRecords({root,request:async()=>{throw Error('no call');},documentObject:null,now:()=>new Date(2026,10,27,10,0)});
  view.render(workspace([learner('a',{absentStreak:3}),learner('b')]),'c');assert.match(root.innerHTML,/연속 결석 3회/);
  press(root,{attStatus:'late',learner:'b'});
  assert.equal(view.refresh(workspace([learner('a',{absentStreak:0}),learner('b')])),true);
  assert.doesNotMatch(root.innerHTML,/연속 결석/);assert.match(root.innerHTML,/data-att-status="late" data-learner="b" aria-pressed="true"/);assert.equal(view.hasDraft(),true);
  assert.equal(view.refresh(workspace([learner('a',{absentStreak:0}),learner('b')])),false,'nothing changed, nothing repainted');
  assert.equal(view.refresh({classes:[]}),false);view.stop();
});

test('the row TOPIK badge judges expiry by the latest-expiring valid level 4 first, like the class summary, and falls back to the representative',()=>{
  const recent={id:'r',kind:'II',round:102,level:3,announcedOn:'2026-11-07',expiresOn:'2028-11-07',state:'valid',daysLeft:711,passed:true};
  const old4={id:'o',kind:'II',round:95,level:4,announcedOn:'2024-12-17',expiresOn:'2026-12-17',state:'within30',daysLeft:20,passed:true};
  const root=liveRoot(),view=createClassRecords({root,request:async()=>{throw Error('no call');},documentObject:null,now:()=>new Date(2026,10,27,10,0)});
  view.render(workspace([learner('a',{topik:topik([recent,old4])}),learner('b',{topik:topik([recent])})]),'c');
  const row=id=>root.innerHTML.match(new RegExp('<li class="att-row[^"]*" data-att-row="'+id+'">.*?</li>'))[0];
  assert.match(row('a'),/TOPIK II 4급<\/span><span class="status-badge bad" title="D-20 · 만료일 2026-12-17">30일 안 만료/);
  assert.match(row('b'),/TOPIK II 3급<\/span><span class="status-badge good"[^>]*>유효/);view.stop();
});
test('a roster lock (RECORDS_BUSY, direct or through the company relay) keeps the choices and the key and asks to save again shortly',async()=>{
  for(const code of ['RECORDS_BUSY','TEACHING_CLASSROOM_RECORDS_BUSY']){
    const root=liveRoot(),calls=[];let reply=()=>{throw Object.assign(new Error('반 명단이 방금 바뀌었어요. 다시 저장해 주세요.'),{code,status:409});};
    const view=createClassRecords({root,request:async(path,body)=>{calls.push(body);return reply(body);},documentObject:null,now:()=>new Date(2026,10,27,10,0)});
    view.render(workspace([learner('a'),learner('b')],{rows:[{learnerId:'b',sessionDate:'2026-11-27',status:'present',note:'',revision:9000123}]}),'c');
    press(root,{attStatus:'absent',learner:'a'});press(root,{attSave:'1'});await later();
    assert.equal(calls.length,1,'no day reload after a roster lock');assert.match(root.innerHTML,/잠시 뒤 다시 저장해 주세요/);assert.doesNotMatch(root.innerHTML,/다른 화면에서/);
    assert.match(root.innerHTML,/data-att-status="absent" data-learner="a" aria-pressed="true"/);assert.equal(view.hasDraft(),true);
    assert.equal(calls[0].rows.find(r=>r.learnerId==='b').revision,9000123,'the shared table sequence is sent back as received');
    reply=body=>({sessionDate:body.sessionDate,attendance:body.rows.map((r,i)=>({...r,sessionDate:body.sessionDate,revision:9000200+i}))});
    press(root,{attSave:'1'});await later();
    assert.equal(calls[1].idempotencyKey,calls[0].idempotencyKey,'the retry of the same batch keeps its key');assert.equal(view.hasDraft(),false);view.stop();
  }
});
test('only a revision conflict reloads the day; capacity and other 409s show the server text and keep the choices',async()=>{
  const run=async error=>{const root=liveRoot(),calls=[];
    const view=createClassRecords({root,request:async(path,body)=>{calls.push(body);if(body.action==='save')throw error;return {sessionDate:body.sessionDate,attendance:[{learnerId:'b',sessionDate:body.sessionDate,status:'late',note:'',revision:77,recordedByName:'다른 교사',updatedAt:'2026-11-27T01:00:00Z'}]};},documentObject:null,now:()=>new Date(2026,10,27,10,0)});
    view.render(workspace([learner('a'),learner('b')]),'c');press(root,{attStatus:'present',learner:'a'});press(root,{attSave:'1'});await later();return {root,calls,view};};
  const conflict=await run(Object.assign(new Error('다른 화면에서 이 날 출결이 먼저 바뀌었어요. 다시 불러온 뒤 저장해 주세요.'),{code:'TEACHING_CLASSROOM_REVISION_CONFLICT',status:409}));
  assert.deepEqual(conflict.calls.map(b=>b.action),['save','day']);assert.match(conflict.root.innerHTML,/바뀐 내용을 확인하고 다시 저장해 주세요/);assert.match(conflict.root.innerHTML,/다른 교사/);assert.equal(conflict.view.hasDraft(),true);conflict.view.stop();
  const full=await run(Object.assign(new Error('이 반의 출결 기록이 가득 찼어요. 이미 찍은 날은 이어서 고칠 수 있어요.'),{code:'ATTENDANCE_CAPACITY',status:409}));
  assert.deepEqual(full.calls.map(b=>b.action),['save']);assert.match(full.root.innerHTML,/출결 기록이 가득 찼어요/);assert.equal(full.view.hasDraft(),true);full.view.stop();
  const replay=await run(Object.assign(new Error('IDEMPOTENCY_CONFLICT'),{code:'IDEMPOTENCY_CONFLICT',status:409}));
  assert.deepEqual(replay.calls.map(b=>b.action),['save']);assert.match(replay.root.innerHTML,/저장하지 못했어요\. 잠시 뒤 다시 해 주세요/);assert.doesNotMatch(replay.root.innerHTML,/IDEMPOTENCY_CONFLICT/);
  press(replay.root,{attSave:'1'});await later();assert.notEqual(replay.calls.at(-1).idempotencyKey,replay.calls[0].idempotencyKey,'a key the server refused is not reused');replay.view.stop();
});
test('a resent batch (duplicate) draws the current server rows and says it was already saved',async()=>{
  const root=liveRoot(),view=createClassRecords({root,request:async(path,body)=>({sessionDate:body.sessionDate,duplicate:true,attendance:[{learnerId:'a',sessionDate:body.sessionDate,status:'late',note:'다른 교사가 고침',revision:9000301,recordedByName:'다른 교사',updatedAt:'2026-11-27T02:00:00Z'}]}),documentObject:null,now:()=>new Date(2026,10,27,10,0)});
  view.render(workspace([learner('a')]),'c');press(root,{attStatus:'present',learner:'a'});press(root,{attSave:'1'});await later();
  assert.match(root.innerHTML,/2026-11-27 출결은 이미 저장돼 있어요/);assert.match(root.innerHTML,/data-att-status="late" data-learner="a" aria-pressed="true"/);assert.equal(view.hasDraft(),false);view.stop();
});
test('a TOPIK save hit by a roster lock keeps the typed record and asks to save again shortly',async()=>{
  const root=liveRoot(),view=createClassRecords({root,request:async()=>{throw Object.assign(new Error('반 명단이 방금 바뀌었어요. 다시 저장해 주세요.'),{code:'TEACHING_CLASSROOM_RECORDS_BUSY',status:409});},documentObject:null,now:()=>new Date(2026,10,27,10,0)});
  view.render(workspace([learner('a')]),'c');press(root,{attTopikOpen:'a'});
  const values={kind:'II',round:'105',level:'4',announcedOn:'2026-10-28'};root.listeners.input({target:{dataset:{},form:formFor('a',values)}});
  root.listeners.submit({target:formFor('a',values),preventDefault(){}});await later();
  assert.match(root.innerHTML,/잠시 뒤 다시 저장해 주세요/);assert.match(root.innerHTML,/value="105"/);assert.match(root.innerHTML,/value="2026-10-28"/);assert.equal(view.hasDraft(),true);view.stop();
});
test('a sharing-only refresh mutes a learner who just turned sharing off, leaves other marks alone, and an older overview cannot bring the row back',()=>{
  const root=liveRoot(),view=createClassRecords({root,request:async()=>{throw Error('no call');},documentObject:null,now:()=>new Date(2026,10,27,10,0)});
  const record={id:'t',kind:'II',round:96,level:4,announcedOn:'2025-01-10',expiresOn:'2027-01-10',state:'within90',daysLeft:44,passed:true};
  view.render(workspace([learner('a',{absentStreak:3}),learner('b',{topik:topik([record])})]),'c');assert.match(root.innerHTML,/90일 안 만료/);
  const off=learner('b',{sharing:{enabled:false,revision:3},topik:{shared:false,records:[],representative:null,level4:null}});
  assert.equal(view.refresh(workspace([learner('a',{absentStreak:0}),off]),{sharingOnly:true}),true);
  assert.match(root.innerHTML,/<li class="att-row is-off" data-att-row="b">/);assert.doesNotMatch(root.innerHTML,/90일 안 만료/);assert.match(root.innerHTML,/연속 결석 3회/,'other marks wait for a save refresh');
  assert.equal(view.refresh(workspace([learner('a',{absentStreak:3}),learner('b',{topik:topik([record])})])),false,'an overview from before the change (lower sharing revision) is ignored');
  assert.match(root.innerHTML,/<li class="att-row is-off" data-att-row="b">/);
  assert.equal(view.refresh(workspace([learner('a',{absentStreak:3}),off]),{sharingOnly:true}),false,'nothing changed, nothing repainted');view.stop();
});
