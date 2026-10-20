import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as R from './homework-review.mjs';
import * as World from '../synk-world-app/classroom-homework.mjs';
// 「과제 첨삭」(homework-review.mjs)의 계산 부분. 학생 화면(WORLD classroom-homework.mjs)·과제 서버(SYNK-talk lib/synk-classroom-homework.js)와
// 같은 규칙인지 대조하고, 교사가 쓴 첨삭이 서버가 받는 꼴(parts)로만 나가는지 본다. 학생 글은 모두 합성이다.
const root=fileURLToPath(new URL('../../',import.meta.url)),require=createRequire(import.meta.url);
const content=JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app/topik4-homework.json'),'utf8'));
const key=JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app/topik4-homework-key.json'),'utf8'));
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-worktrees/talk-class-homework-20261020')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/synk-classroom-homework.js')));
const START='2027-03-06';
const ESSAY='한빛대학교 언어교육원에서 2022년과 2026년에 외국인 유학생 400명을 대상으로 아르바이트에 대해 조사했습니다. 조사 결과 아르바이트를 하는 유학생은 2022년 48%에서 2026년 63%로 15% 증가했다.\n\n아르바이트를 하는 이유는 생활비 마련이 52%로 가장 많았고 한국어 연습이 27%, 경력 쌓기가 15%였다. 요즘 물가가 많이 올랐기 때문이다. 이처럼 아르바이트를 하는 유학생이 늘고 있다.';
const sub=(over={})=>({submissionId:'s-1',learnerId:'l-1',week:3,kind:'writing',answers:{'W3-1.1':ESSAY},retry:{},revision:1,submittedAt:'2027-03-24T12:00:00Z',late:false,contentVersion:content.version,feedback:null,...over});
const writingOf=week=>content.weeks[week-1].writing;

test('글자 수·주차·마감·기호 자리는 학생 화면 모듈과 같다',()=>{
 for(const text of ['',ESSAY,'가\r\n나\n\n다','ㅎᅡㄴ','  띄어 쓰기  '])assert.equal(R.homeworkLength(text),World.homeworkLength(text),text);
 for(const startsOn of [START,'2027-03-10','2026-12-05','2027-3-6'])for(const week of [1,2,3,8])assert.deepEqual(R.homeworkWindow(startsOn,week,content.schedule),World.homeworkWindow(startsOn,week,content.schedule),`${startsOn} ${week}`);
 for(const now of [Date.parse('2027-03-01T00:00:00Z'),Date.parse('2027-03-26T01:00:00Z'),Date.parse('2027-06-01T00:00:00Z')])assert.deepEqual(R.homeworkWeek({startsOn:START,weeks:8,now,schedule:content.schedule}),World.homeworkWeek({startsOn:START,weeks:8,now,schedule:content.schedule}));
 const marks=[{quote:'조사했습니다',code:'체'},{quote:'15% 증가했다',code:'낱'},{quote:'유학생',code:'+'},{quote:'유학생은',code:'조'},{quote:'없는 글귀',code:'자'}];
 for(const paragraph of R.paragraphsOf(ESSAY)){
  const mine=R.markSegments(paragraph,marks).map(({text,mark})=>({text,...(mark===undefined?{}:{mark})}));
  assert.deepEqual(mine,World.markSegments(paragraph,marks),'학생 화면과 같은 자리에 놓는다');
 }
});

test('주차·마감이 SYNK-talk 과제 서버와 같다',{skip:!talkRoot&&'과제 서버(lib/synk-classroom-homework.js)가 있는 SYNK-talk 사본이 없다'},()=>{
 const server=require(path.join(talkRoot,'lib/synk-classroom-homework.js'));
 for(const startsOn of [START,'2027-03-10','2026-12-05'])for(let week=1;week<=8;week++){
  const a=R.homeworkWindow(startsOn,week,content.schedule),b=server.homeworkWindow(startsOn,week);assert.deepEqual({start:a.start,end:a.end,due:a.due},{start:b.start,end:b.end,due:b.due});
 }
 assert.deepEqual([...R.CODES].sort(),[...server.CODES].sort(),'기호 열한 개가 같다');assert.deepEqual(R.VERDICTS,[...server.VERDICTS]);
});

test('기호는 문단마다 놓이고, 못 찾거나 여러 곳이면 그 수를 센다',()=>{
 const text='문체가 섞였습니다. 문체가 섞였다.\n\n문체가 또 섞였습니다.';
 assert.deepEqual(R.markPlacements(text,[{quote:'섞였습니다',code:'체'},{quote:'없는 말',code:'자'},{quote:'섞였다',code:'체'}]),[2,0,1]);
 assert.deepEqual(R.markPlacements(text,[{quote:'섞였습니다. 문체가 섞였다.\n\n문체',code:'체'}]),[0],'문단을 넘는 글귀는 학생 화면에서 놓이지 않는다');
});

test('쓰기 상태: 새로 냄 · 고쳐 냄 · 첨삭 중 · 고쳐 내서 다시 맞추기 · 돌려줌 · 일부 돌려줌',()=>{
 const parts=writingOf(7).parts;
 assert.equal(R.writingStatus(null,parts).code,'none');
 assert.equal(R.writingStatus(sub(),parts).code,'new');
 assert.equal(R.writingStatus(sub({revision:2}),parts).code,'resubmitted');
 assert.equal(R.writingStatus(sub({feedback:{parts:{},returnedAt:null,revision:1,submissionRevision:1}}),parts).code,'drafting');
 assert.equal(R.writingStatus(sub({revision:2,feedback:{parts:{},returnedAt:null,revision:1,submissionRevision:1}}),parts).code,'stale');
 const some={parts:{'W7-1':{fields:{'W7-1.1':{verdict:'인정'}}}},returnedAt:'2027-04-23T09:00:00Z',revision:1,submissionRevision:1};
 assert.equal(R.writingStatus(sub({week:7,feedback:some}),parts).code,'partly','7주처럼 일부 문항만 먼저 돌려줄 수 있다');
 const all={...some,parts:Object.fromEntries(parts.map(p=>[p.key,{comment:{good:'좋아요.'}}]))};
 assert.equal(R.writingStatus(sub({week:7,feedback:all}),parts).code,'returned');
 assert.equal(R.writingStatus(sub({late:true}),parts).late,true);
});

test('주별 목록: 명부 차례(이름), 읽기 맞힌 수는 정답 자료로 세고, 숫자판과 주차 표시를 낸다',()=>{
 const data={plan:{course:'topik4-online',startsOn:START,weeks:8,revision:1},learners:[{learnerId:'l-2',name:'보라 (합성)',accountConnected:true},{learnerId:'l-1',name:'나래 (합성)',accountConnected:true},{learnerId:'l-3',name:'다미 (합성)',accountConnected:false}],
  submissions:[sub(),sub({submissionId:'s-2',learnerId:'l-2',late:true,feedback:{parts:{'W3-1':{comment:{good:'좋아요.'}}},returnedAt:'2027-03-26T09:00:00Z',revision:1,submissionRevision:1}}),
   {submissionId:'r-1',learnerId:'l-1',week:3,kind:'reading',answers:{'R3-1':2,'R3-2':4,'R3-3':2,'R3-4':3,'R3-5':1},retry:{},revision:1,submittedAt:'2027-03-23T12:00:00Z',late:false,contentVersion:content.version,feedback:null},
   sub({submissionId:'s-old',learnerId:'l-1',week:2,answers:{'W2-1.1':'가'}})]};
 const rows=R.weekRows(data,3,content,key);
 assert.deepEqual(rows.map(r=>r.name),['나래 (합성)','다미 (합성)','보라 (합성)']);
 const reading=rows[0].score,answers=data.submissions[2].answers;
 assert.equal(reading.total,5);assert.equal(reading.right,Object.entries(answers).filter(([id,n])=>key.reading[id].answer===n).length);
 assert.deepEqual(reading.missed.map(m=>m.id),Object.keys(answers).filter(id=>key.reading[id].answer!==answers[id]));
 assert.equal(R.weekRows(data,3,content,null)[0].score,null,'정답 자료가 없으면 맞힌 수를 세지 않는다');
 assert.deepEqual(rows.map(r=>r.status.code),['new','none','returned']);assert.equal(rows[1].accountConnected,false);
 assert.deepEqual(R.weekBoard(rows),{learners:3,writing:2,reading:1,todo:1,drafting:0,returned:1,late:1});
 assert.equal(R.pendingCount(data,3,content),1);assert.equal(R.pendingCount(data,2,content),1);assert.equal(R.pendingCount(data,4,content),0);
 assert.equal(R.pendingCount({...data,learners:data.learners.filter(l=>l.learnerId!=='l-1')},3,content),0,'명부에서 빠진 학생의 글은 세지 않는다');
});

test('보내는 parts: 낸 칸에만, 빈 줄을 빼고, 문서 차례로 — 같은 첨삭이면 같은 문자열',()=>{
 const writing=writingOf(2),answers={'W2-1.1':'가','W2-1.2':'나','W2-2.1':'다','W2-2.2':'라','W2-3.1':'마','W2-3.2':'바','W2-3.3':'사','W2-3.4':'아','W2-3.5':'자'};
 const draft={'W2-3':{fields:{'W2-3.5':{verdict:'부분',reason:'  「진짜」는 말하는 낱말이에요.  '},'W2-3.2':{verdict:'다시',reason:''},'W2-3.9':{verdict:'인정'},'W2-3.1':{verdict:'몰라'}},marks:[{field:'W2-3.2',quote:'',code:'어'},{field:'W2-3.2',quote:'바',code:'?'},{field:'W2-1.1',quote:'가',code:'어'}],comment:{good:' ',fix:'동사는 「-는다」예요.〔어〕',retry:''}},
  'W2-1':{fields:{},marks:[],comment:{good:'',fix:'',retry:''}}};
 const parts=R.buildParts(draft,writing,answers);
 assert.deepEqual(parts,{'W2-3':{fields:{'W2-3.2':{verdict:'다시'},'W2-3.5':{verdict:'부분',reason:'「진짜」는 말하는 낱말이에요.'}},comment:{fix:'동사는 「-는다」예요.〔어〕'}}},'다른 문항의 칸·없는 칸·틀린 판정·빈 글귀·모르는 기호·빈 문항은 빠진다');
 assert.deepEqual(Object.keys(parts['W2-3'].fields),['W2-3.2','W2-3.5'],'칸은 문서 차례');
 const again=R.buildParts(R.draftFrom({parts:JSON.parse(JSON.stringify({'W2-3':{comment:parts['W2-3'].comment,fields:{'W2-3.5':parts['W2-3'].fields['W2-3.5'],'W2-3.2':parts['W2-3'].fields['W2-3.2']}}}))}),writing,answers);
 assert.equal(JSON.stringify(again),JSON.stringify(parts),'서버(jsonb)가 키 차례를 바꿔 돌려줘도 저장 여부 비교가 흔들리지 않는다');
 assert.deepEqual(R.buildParts({'W2-1':{fields:{'W2-1.1':{verdict:'인정'}}}},writing,{'W2-1.2':'나'}),{},'학생이 내지 않은 칸에는 붙이지 않는다');
});

test('돌려주기 전에 볼 것: 판정 빈칸, 〔+〕 없음, 한마디 빈 줄, 아직 안 본 문항, 글에서 못 찾은 글귀',()=>{
 const w3=writingOf(3);
 let notes=R.reviewChecklist({},w3,{'W3-1.1':ESSAY});assert.deepEqual(notes.map(n=>n.kind),['empty']);
 notes=R.reviewChecklist({'W3-1':{fields:{},marks:[{field:'W3-1.1',quote:'조사했습니다',code:'체'},{field:'W3-1.1',quote:'고친 뒤 사라진 글귀',code:'낱'}],comment:{good:'',fix:'문체를 맞춰요.〔체〕',retry:''}}},w3,{'W3-1.1':ESSAY});
 assert.deepEqual(notes.map(n=>n.kind),['plus','lost','comment','comment']);assert.match(notes[0].text,/〔\+〕/);assert.match(notes[2].text,/잘된 점/);
 notes=R.reviewChecklist({'W3-1':{fields:{},marks:[{field:'W3-1.1',quote:'유학생',code:'+'}],comment:{good:'좋아요.',fix:'핵심.',retry:'다시.'}}},w3,{'W3-1.1':ESSAY});assert.deepEqual(notes,[]);
 const w1=writingOf(1);
 notes=R.reviewChecklist({'W1-1':{fields:{'W1-1.1':{verdict:'인정'}},marks:[],comment:{}}},w1,{'W1-1.1':'가','W1-1.2':'나','W1-2.1':'다','W1-2.2':'라'});
 assert.deepEqual(notes.map(n=>n.kind),['verdict','empty'],'51·52는 칸마다 판정, 한마디는 고르지 않아도 된다');assert.match(notes[0].text,/빈칸 ㉡/);
 const w2=writingOf(2);assert.match(R.reviewChecklist({'W2-3':{fields:{},marks:[],comment:{good:'x'}}},w2,{'W2-3.1':'가'}).find(n=>n.kind==='verdict')?.text||'',/「요즘 혼자 사는 사람이 많아요\.」 판정이 비어 있어요/,'바꿔 쓰기 칸은 원래 문장으로 가리킨다');
});

test('첨삭 꼴은 서버(validFeedback)가 받는 꼴이고, 회사 중계의 본문 상한 아래다',{skip:!talkRoot&&'SYNK-talk 사본이 없다'},()=>{
 const {validFeedback}=require(path.join(talkRoot,'lib/synk-classroom-homework.js'));
 const answersFor=week=>Object.fromEntries(writingOf(week).parts.flatMap(p=>p.fields).map(f=>[f.id,f.kind==='grid'?f.rows.map(()=>f.columns.map(()=>'합성 칸')):f.kind==='text'?ESSAY:'합성 답']));
 for(let week=1;week<=8;week++){
  const writing=writingOf(week),answers=answersFor(week),draft={};
  for(const part of writing.parts){
   const d=draft[part.key]={fields:{},marks:[],comment:{good:'잘했어요.',fix:'핵심이에요.〔체〕',retry:'다시 써 보세요.'}};
   for(const field of part.fields){
    if(field.kind==='text'){d.marks.push({field:field.id,quote:'유학생',code:'+',note:''});for(const code of ['체','조','어','낱','맞'])d.marks.push({field:field.id,quote:'조사',code,note:'x'.repeat(R.LIMITS.note)});}
    else d.fields[field.id]={verdict:'부분',reason:'이'.repeat(R.LIMITS.reason)};
   }
  }
  const parts=R.buildParts(draft,writing,answers);
  assert.equal(validFeedback(week,answers,parts),true,`${week}주차 첨삭을 서버가 받는다`);
  assert.equal(validFeedback(week,answers,{...parts,'W9-1':{}}),false,'다른 주 문항은 서버가 거절한다(대조가 진짜인지)');
 }
 // 기준대로 쓴 한 편(고칠 곳 다섯 + 〔+〕 + 세 줄)은 중계 상한에 넉넉히 들어간다.
 const writing=writingOf(7),answers=answersFor(7),draft={};
 for(const part of writing.parts){const d=draft[part.key]={fields:{},marks:[],comment:{good:'두 해의 비율을 정확히 옮겼어요.',fix:'물가 이야기는 자료에 없는 내용이에요.〔자〕',retry:'두 문장을 「-에서 -로 증가했다」로 이어 보세요.'}};
  for(const field of part.fields){if(field.kind==='text'){for(const code of ['+','체','조','어','낱','맞'])d.marks.push({field:field.id,quote:'유학생은 2022년 48%',code,note:'글 전체를 「-다」로 맞춰요. 같은 실수 세 번.'});}else d.fields[field.id]={verdict:'인정',reason:'뒤 문장과 잘 이어져요.'};}}
 const body={action:'feedback',submissionId:'00000000-0000-4000-8000-000000000000',submissionRevision:1,revision:0,parts:R.buildParts(draft,writing,answers),returned:true};
 const size=R.sendSize('11111111-1111-4111-8111-111111111111',body);assert.ok(size.chars<R.LIMITS.sendChars/2&&size.bytes<R.LIMITS.sendBytes/2,JSON.stringify(size));
 assert.ok(R.LIMITS.sendChars<12000&&R.LIMITS.sendBytes<40000,'회사 워크스페이스 /api/teaching/request 본문 상한(12,000자·40,000바이트) 아래로 자른다');
});

test('통로마다 다른 오류 꼴을 같은 코드로 읽는다',()=>{
 const cases=[
  [{code:'REVISION_CONFLICT',status:409},'REVISION_CONFLICT'],
  [{code:'TEACHING_CLASSROOM',message:'REVISION_CONFLICT',status:409},'REVISION_CONFLICT'],
  [{code:'TEACHING_CLASSROOM',message:'FEEDBACK_RETURNED',status:409},'FEEDBACK_RETURNED'],
  [{code:'FORBIDDEN',message:'지원하지 않는 교사 요청입니다.',status:403},'ROUTE_UNSUPPORTED'],
  [{code:'INVALID_REQUEST',message:'지원하지 않는 수업 요청입니다.'},'ROUTE_UNSUPPORTED'],
  [{code:'TEACHING_OPERATION',message:'지원하지 않는 수업 요청입니다.',status:403},'ROUTE_UNSUPPORTED'],
  [{code:'TEACHING_CLASSROOM',message:'NOT_FOUND',status:404},'HOMEWORK_UNAVAILABLE'],
  [{code:'HOMEWORK_UNAVAILABLE',status:404},'HOMEWORK_UNAVAILABLE'],
  [{code:'TEACHING_NOT_TEACHER',message:'이 수업의 교사 권한을 확인하지 못했어요.',status:403},'FORBIDDEN'],
  [{code:'NETWORK_ERROR',message:'수업 응답을 확인하지 못했어요.'},'NETWORK_ERROR'],
 ];
 for(const [error,code] of cases)assert.equal(R.homeworkErrorCode(error),code,JSON.stringify(error));
});

test('화면 글과 상한은 첨삭 기준을 따른다',()=>{
 assert.equal(R.LIMITS.corrections,5,'한 편에 고칠 곳 다섯 곳(첨삭 기준 §2)');assert.equal(R.CODES[0],'+','〔+〕를 맨 앞에');
 assert.deepEqual(Object.keys(R.CODE_SHORT).sort(),[...R.CODES].sort());
 for(const code of R.CODES)assert.ok(content.feedback.codes[code],`기호 ${code}는 수업 자료의 첨삭 기호다`);
 assert.deepEqual(R.VERDICTS,content.feedback.verdicts);
 assert.equal(R.partName(writingOf(7).parts[0]),'51번','「51번 · 51번」처럼 겹치지 않는다');assert.equal(R.partName(writingOf(1).parts[0]),'51번 · 문제 1');assert.equal(R.partName(writingOf(2).parts[2]),'문어체 바꿔 쓰기');
 for(const text of Object.values(R.REVIEW_TEXT))assert.doesNotMatch(text,/\b[A-Z]+_[A-Z_]+\b|undefined|null/,'화면 글에 내부 코드가 섞이지 않는다');
});

test('교사 화면·회사 워크스페이스가 과제 첨삭 파일과 교사 과제 경로를 싣는다',()=>{
 const read=file=>fs.readFileSync(path.join(root,file),'utf8');
 const html=read('experiences/teacher-world/index.html'),app=read('experiences/teacher-world/app.mjs');
 assert.match(html,/id="homework-nav" data-view="homework" hidden/);assert.match(html,/<section id="view-homework" hidden>/);assert.match(html,/href="\.\/homework-review\.css"/);
 assert.match(app,/import \{mountHomeworkReview\} from '\.\/homework-review\.mjs';/);assert.match(app,/\$\('homework-nav'\)\.hidden=!accountRequested/,'계정 모드에서만 메뉴를 연다');
 assert.match(app,/homework\.hasDraft\(\)/,'저장 안 한 첨삭이 있으면 다른 학생으로 넘어가기 전에 묻는다');
 const company='docs/마케팅/온라인마케팅지도/engagement/company/',server=read(company+'server.mjs'),docker=read(company+'Dockerfile'),ignore=read(company+'Dockerfile.dockerignore');
 for(const file of ['homework-review.mjs','homework-review.css'])assert.ok(server.includes(`'${file}'`)&&docker.includes('experiences/teacher-world/'+file)&&ignore.includes('!experiences/teacher-world/'+file),file);
 for(const file of ['topik4-homework.json','topik4-homework-key.json'])assert.ok(server.includes(`'${file}'`)&&docker.includes('experiences/synk-world-app/'+file)&&ignore.includes('!experiences/synk-world-app/'+file),file);
 for(const [file,pattern] of [['experiences/synk-account/src/classroom-client.mjs',/homework:\['\/api\/teacher\/homework'\],homeworkSave:\['\/api\/teacher\/homework','POST'\]/],[company+'teaching-service.mjs',/homework:\['\/api\/teacher\/homework'\],homeworkSave:\['\/api\/teacher\/homework','POST'\]/],
  ['experiences/synk-account/src/messenger-teacher.mjs',/'homework','homeworkSave'/],['desktop/src/classroom-requests.cjs',/homework:\['GET','teacher\/homework'\],homeworkSave:\['POST','teacher\/homework'\]/],['desktop/src/teacher-account.cjs',/'homework','homeworkSave'/]])assert.match(read(file),pattern,file);
});
