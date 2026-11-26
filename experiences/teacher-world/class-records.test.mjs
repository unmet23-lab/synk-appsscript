import test from 'node:test';
import assert from 'node:assert/strict';
import {classRecordsModel,attendanceRows,attendanceDirty,attendanceCounts,topikBadge,levelLabel,localDate,addDays,TOPIK_LEVELS,createClassRecords} from './class-records.mjs';
import {classSummaryModel,classSummaryHtml,teacherOverviewModel,createTeacherOverview} from './workspace-overview.mjs';

const topik=(records=[],extra={})=>({shared:true,basisDate:'2026-11-27',records,representative:records[0]||null,validLevel4:records.some(r=>r.level>=4&&r.state!=='expired'),recordLimit:20,capacityReached:false,...extra});
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
