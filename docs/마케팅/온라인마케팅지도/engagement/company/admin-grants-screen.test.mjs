import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// 관리자 화면 「반」 · 「이용 권한」 · 「최근 부여」 · 관리자 올리기의 화면 단위 시험(관리자 직접부여 설계 5 · 6 · 8절).
// 응답 칸 이름은 중앙 synk-account(SYNK-talk lib/synk-account-admin-grants.js 31a8e8f5)와 같다.
const classId='44444444-4444-4444-8444-444444444444',synkUserId='22222222-2222-4222-8222-222222222222',learnerId='66666666-6666-4666-8666-666666666666';
const classRow={id:classId,classKey:'test-evening',displayName:'시험 저녁반',active:true,test:true,seasonless:true,teachers:1,learners:1,openRows:1,createdAt:'2026-11-01T00:00:00.000Z'};
const classView={id:classId,classKey:'test-evening',displayName:'시험 저녁반',active:true,test:true};
const person={id:synkUserId,name:'합성 학생',loginId:'student@example.test',createdAt:'2026-10-01T00:00:00.000Z',status:'active'};
const teacherRow={staffId:synkUserId,synkUserId,name:'합성 교사',role:'teacher',active:true,assignedAt:'2026-11-01T00:00:00.000Z'};
const learnerRow={learnerId,studentCode:'SYNK-1043',active:true,linked:true,synkUserId,accountStatus:'active',name:'합성 학생',enrolledAt:null,test:true};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const refused=(code,status,extra={})=>Object.assign(new Error(code),{status,code,...extra});

function screen({synkUserId:account='11111111-1111-4111-8111-111111111111',api}={}){
  const listeners=new Map(),modals=[],notices=[],calls=[],storage=new Map(),assigned=[],fetches=[];
  const state={user:{id:'owner',role:'admin',name:'회사 주인'},synkUserId:account,tab:'admin',data:{permissions:{manageAdmins:true},teams:[{id:'team-a',name:'합성 팀',active:true}],members:[]}};
  class FormData{constructor(form){this.map=new Map(Object.entries(form?.values||{}));}get(key){return this.map.has(key)?this.map.get(key):null;}[Symbol.iterator](){return this.map[Symbol.iterator]();}}
  const context=vm.createContext({state,console,Intl,URL,URLSearchParams,AbortController,Date,Math,JSON,Promise,setTimeout,clearTimeout,queueMicrotask,crypto:globalThis.crypto,FormData,
    document:{addEventListener:(name,fn)=>{if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>null,activeElement:null,body:{}},
    CSS:{escape:String},escape:escapeHtml,icon:()=>'',number:value=>String(value),roleLabel:role=>({admin:'관리자',member:'실무자'})[role]||role,
    isAdmin:()=>state.user?.role==='admin',isDemoMode:()=>false,companyAuthSnapshot:()=>({userId:state.user?.id}),companyAuthCurrent:stamp=>stamp?.userId===state.user?.id,
    modal:(title,subtitle,body)=>modals.push({title,subtitle,body}),closeModal:()=>modals.push({closed:true}),notify:message=>notices.push(message),
    api:async(path,body,method)=>{calls.push({path,body,method});return api?api(path,body,calls.length):{};},
    loadState:async()=>{},sessionStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
    location:{assign:url=>assigned.push(url)},fetch:async(path,init)=>{fetches.push({path,body:init?.body?JSON.parse(init.body):null});return {ok:true,json:async()=>path==='/api/synk-id/status'?{reauthNeeded:false}:{authorizationUrl:'https://identity.example.test/auth/v1/oauth/authorize?state=x'}};}});
  context.globalThis=context;
  vm.runInContext(readFileSync(new URL('./public/admin-workspace.js',import.meta.url),'utf8'),context);
  vm.runInContext(readFileSync(new URL('./public/admin-grants.js',import.meta.url),'utf8'),context);
  const run=code=>vm.runInContext(code,context);
  const fire=(name,event)=>{for(const fn of listeners.get(name)||[])fn(event);};
  const click=(dataset,extra={})=>fire('click',{target:{closest:selector=>selector==='[data-grants-action]'?{dataset,disabled:false,...extra}:null}});
  const submitConfirm=values=>run(`grantsSubmit({values:${JSON.stringify(values||{})}})`);
  return {state,context,run,modals,notices,calls,storage,assigned,fetches,click,submitConfirm,last:()=>modals.filter(row=>!row.closed).at(-1)};
}
function withClass(s,{people=null,cls=classRow}={}){
  s.run(`adminGrants.classes.data=${JSON.stringify({total:1,page:1,pageSize:25,rows:[cls]})};adminGrants.classId='${classId}';`);
  if(people)s.run(`adminGrants.people.data=${JSON.stringify({class:{...classView,active:cls.active},...people})};`);
}

test('the class and entitlement scopes appear only for an administrator signed in with SYNK ID',()=>{
  const signedIn=screen(),scopes=signedIn.run('directoryScopeMarkup()');
  assert.match(scopes,/data-directory-scope="classes"[^>]*>반</);assert.match(scopes,/data-directory-scope="entitlements"[^>]*>이용 권한</);
  const company=screen({synkUserId:null});
  assert.doesNotMatch(company.run('directoryScopeMarkup()'),/data-directory-scope="classes"|data-directory-scope="entitlements"/);
  assert.equal(company.run('adminGrantsAuditMarkup()'),'');
  assert.match(company.run("adminGrantsPanelMarkup('classes')"),/SYNK ID로 로그인했을 때만/);
});

test('the recent grants list shows operations, outcomes and refusals from the central audit',async()=>{
  const row=(op,outcome,code=null)=>({id:'1',at:'2026-11-21T01:00:00.000Z',op,outcome,code,actorSynkUserId:null,targetSynkUserId:synkUserId,classId,learnerId:null,staffId:null,entitlementRef:null});
  const s=screen({api:()=>({ok:true,op:'audit.list',days:7,rows:[row('learner.add','applied'),row('teacher.add','duplicate'),row('teacher.add','rejected','DAILY_LIMIT')]})});
  await s.run('adminGrantsLoadAudit()');
  const html=s.run('adminGrantsAuditMarkup()');
  assert.deepEqual({...s.calls[0].body},{op:'audit.list',days:7});
  assert.match(html,/최근 부여/);assert.match(html,/학생 넣기/);assert.match(html,/했어요/);assert.match(html,/이미 되어 있었어요/);assert.match(html,/거절됐어요/);
  assert.match(html,/반 44444444/);
  assert.match(html,/선생님 넣기/);assert.doesNotMatch(html,/교사 넣기/,'the recent list names teacher work as the class panel does');
});

test('classes are listed from the central row fields and every write sends the list request the central function expects',async()=>{
  const s=screen({api:()=>({ok:true,op:'classes.list',total:1,page:1,pageSize:25,rows:[classRow]})});
  s.run("adminGrants.classes.q='저녁';adminGrants.classes.active='inactive'");
  await s.run('grantsLoadClasses()');
  assert.deepEqual({...s.calls[0].body},{op:'classes.list',q:'저녁',active:'inactive',page:1});
  const html=s.run('grantsClassesListMarkup()');
  assert.match(html,/시험 저녁반/);assert.match(html,/1명/);assert.match(html,/1줄/);assert.match(html,new RegExp(`data-class-id="${classId}"`));
  const off=screen();withClass(off,{cls:{...classRow,active:false},people:{teachers:[],learners:[]}});
  assert.doesNotMatch(off.run('grantsClassDetailMarkup()'),/learner-add|teacher-add/,'a switched-off class takes nobody in');
  // 꺼진 반의 명부 표도 사람을 넣는 단추(잇기 · 다시 넣기)를 내지 않는다. 빼기는 꺼진 반에서도 된다.
  const offRows=screen();withClass(offRows,{cls:{...classRow,active:false},people:{teachers:[],learners:[learnerRow,{...learnerRow,learnerId:'66666666-6666-4666-8666-000000000001',linked:false,synkUserId:null,name:null},{...learnerRow,learnerId:'66666666-6666-4666-8666-000000000002',active:false}]}});
  const offDetail=offRows.run('grantsClassDetailMarkup()');
  assert.doesNotMatch(offDetail,/learner-link|learner-readd/);assert.match(offDetail,/learner-remove/);
  const onRows=screen();withClass(onRows,{people:{teachers:[],learners:[{...learnerRow,learnerId:'66666666-6666-4666-8666-000000000001',linked:false,synkUserId:null,name:null},{...learnerRow,learnerId:'66666666-6666-4666-8666-000000000002',active:false}]}});
  assert.match(onRows.run('grantsClassDetailMarkup()'),/learner-link[\s\S]*learner-readd|learner-readd[\s\S]*learner-link/);
});

test('a class key must start with a letter or digit, as the server requires',async()=>{
  const s=screen();
  s.click({grantsAction:'class-create'});
  assert.match(s.last().body,/pattern="\[a-z0-9\]\[a-z0-9\\-\]\{0,59\}"/);
  await s.submitConfirm({displayName:'저녁반',classKey:'-evening'});
  assert.match(s.last().body,/반 키는 영문 소문자나 숫자로 시작하고/);
  assert.equal(s.calls.length,0,'a key the server would refuse is never sent');
  await s.submitConfirm({displayName:'저녁반',classKey:'evening-1'});
  assert.equal(s.calls[0].body.classKey,'evening-1');
});

test('confirmation dialogs carry the design wording before every hard-to-undo write',()=>{
  const s=screen();withClass(s,{people:{teachers:[teacherRow],learners:[learnerRow]}});
  s.run(`grantsOpenLearnerAdd(${JSON.stringify(person)})`);
  let body=s.last().body;
  assert.match(body,/코드 없이 바로 이 반에 들어가요\. 이 학생이 내는 과제 글은 반 공유와 상관없이 이 반 선생님이 봐요\./);
  for(const text of ['합성 학생','student@example.test','SYNK ID',synkUserId])assert.ok(body.includes(text),text);
  s.click({grantsAction:'learner-remove',learnerId});
  assert.match(s.last().body,/명부 줄은 남아요\. 이 사람은 다른 반 코드로 들어갈 수 없고, 다른 반에는 여기서 옮겨야 해요\. 다시 넣어도 수업 영상 이용은 돌아오지 않아요\./);
  s.run(`grantsOpenTeacherAdd(${JSON.stringify(person)})`);
  assert.match(s.last().body,/이 사람에게 직원\(교사\) 자격이 생겨요\. 이 반 학생이 낸 과제 글과 옛 학습 기록\(녹음 받아쓰기, AI 첨삭\)을 보게 돼요\./);
  s.click({grantsAction:'teacher-remove',staffId:synkUserId});
  assert.match(s.last().body,/바로 안 보여요/);
  s.click({grantsAction:'class-toggle'});
  assert.match(s.last().body,/바로 이 반을 볼 수 없어요/);
  s.run(`grantsOpenLearnerMove({op:'learner.add',payload:{classId:'${classId}',synkUserId:'${synkUserId}'},details:{className:'옛 오전반'},person:${JSON.stringify(person)}})`);
  body=s.last().body;
  assert.match(body,/옛 오전반/);assert.match(body,/시험 저녁반/);
  assert.match(body,/옛 학습 기록이 새 반 선생님에게 보여요\. 과제 글은 옛 반에 남아요\. 옛 반의 수업 영상 이용은 멈춰요\./);
  const director=screen();withClass(director,{people:{teachers:[{...teacherRow,role:'director'}],learners:[]}});
  director.click({grantsAction:'teacher-remove',staffId:synkUserId});
  assert.match(director.last().body,/원장 자격은 반 배정과 상관없이 그대로 남아요\./);
  const open=screen();withClass(open,{people:{teachers:[],learners:[{...learnerRow,linked:false,synkUserId:null,name:null,accountStatus:null}]}});
  const detail=open.run('grantsClassDetailMarkup()');
  assert.match(detail,/빈 명부 줄/);assert.match(detail,/SYNK ID 잇기/);assert.match(detail,/학습 기록, 제출물, 녹음은 이 화면에서 보지 않아요/);
});

test('promotion needs the typed name, shows the company-only warning and is shown only to the owner',()=>{
  const s=screen();
  s.state.data.members=[{id:'member-1',name:'올릴 직원',email:'member@example.test',role:'member',active:true},{id:'admin-2',name:'다른 관리자',email:'a2@example.test',role:'admin',active:true}];
  const member=s.state.data.members[0],other=s.state.data.members[1];
  assert.match(s.run(`adminGrantsRoleButtons(${JSON.stringify(member)},{adminRole:{synkLinked:true,owner:false}})`),/관리자로 올리기/);
  assert.equal(s.run(`adminGrantsRoleButtons(${JSON.stringify(member)},{adminRole:{synkLinked:false,owner:false}})`),'','a password-only account is never offered');
  assert.match(s.run(`adminGrantsRoleButtons(${JSON.stringify(other)},{adminRole:{synkLinked:true,owner:false}})`),/관리자에서 내리기/);
  assert.equal(s.run(`adminGrantsRoleButtons(${JSON.stringify(other)},{adminRole:{synkLinked:true,owner:true}})`),'','the owner is never demoted');
  assert.equal(s.run(`adminGrantsRoleButtons({id:'owner',role:'admin',active:true},{adminRole:{synkLinked:true,owner:true}})`),'');
  s.run("state.data.permissions.manageAdmins=false");
  assert.equal(s.run(`adminGrantsRoleButtons(${JSON.stringify(member)},{adminRole:{synkLinked:true,owner:false}})`),'');
  s.run("state.data.permissions.manageAdmins=true");
  s.click({grantsAction:'admin-promote',id:'member-1'});
  const body=s.last().body;
  assert.match(body,/회사 자료 전부를 열 수 있어요\. 반과 이용 권한은 따라가지 않아요\./);
  assert.match(body,/확인하려면 직원 이름을 그대로 적어 주세요: 올릴 직원/);
  assert.match(body,/data-grants-submit disabled/);
});

test('a re-login request shows the SYNK ID button, resends keep one requestId and the dialog returns after re-login',async()=>{
  let mode='reauth';
  const write=body=>({ok:true,op:body.op,requestId:body.requestId,outcome:'applied',classId,learnerId,studentCode:'SYNK-1044',change:'created'});
  const s=screen({api:(path,body)=>{if(mode==='reauth')throw refused('REAUTH_REQUIRED',409,{message:'15분 안에 다시 로그인해 주세요.'});return write(body);}});
  withClass(s);s.run("memberDirectory.mode='classes'");
  s.run(`grantsOpenLearnerAdd(${JSON.stringify(person)})`);
  await s.submitConfirm();
  assert.match(s.last().body,/data-grants-action="reauth"[^>]*>SYNK ID로 다시 로그인</);
  assert.match(s.last().body,/SYNK ID 로그인 화면에서 한 번 더 로그인해 확인해요\./);
  assert.match(s.last().body,/data-grants-submit disabled/);
  const requestId=s.calls[0].body.requestId;assert.match(requestId,/^[0-9a-f-]{36}$/);
  assert.deepEqual({...s.calls[0].body,requestId:null},{op:'learner.add',classId,synkUserId,requestId:null,confirm:true});
  // 다시 확인: 같은 SYNK ID로 브라우저 로그인을 시작하고 확인 창을 저장한다.
  await s.run("grantsReauth(null)");
  // 다시 로그인은 reauth:true로 시작해 포털이 실제 로그인을 다시 받게 한다.
  assert.deepEqual({...s.fetches.find(row=>row.path==='/api/synk-id/start').body},{action:'login',expectedAccountId:s.state.synkUserId,returnTo:'admin',reauth:true});
  assert.equal(s.assigned[0],'https://identity.example.test/auth/v1/oauth/authorize?state=x');
  const saved=JSON.parse(s.storage.get('synk.admin.grants.pending'));assert.equal(saved.pending.requestId,requestId);assert.equal(saved.classId,classId);
  // 돌아온 뒤 새 화면에서 같은 확인 창과 같은 requestId로 다시 보낸다.
  const back=screen({api:(path,body)=>{if(body?.op!=='learner.add')return {ok:true,op:body?.op,total:0,page:1,pageSize:25,rows:[]};if(mode==='busy')throw refused('GRANTS_UNAVAILABLE',503,{message:'잠시 뒤 다시 해 주세요.'});return write(body);}});
  back.storage.set('synk.admin.grants.pending',s.storage.get('synk.admin.grants.pending'));
  back.run("memberDirectory.mode='classes'");
  assert.equal(back.run('adminGrantsRestore()'),true);
  assert.match(back.last().body,/코드 없이 바로 이 반에 들어가요/);
  // 쓰기가 중앙에 닿았는지 모르는 503은 「결과를 확인하지 못했어요」로 알리고, 「다시 확인」이 같은 요청 번호로 결과를 묻는다.
  mode='busy';await back.submitConfirm();
  assert.match(back.last().body,/결과를 확인하지 못했어요\. 이미 반영됐을 수도 있어요\. 「다시 확인」을 누르면 같은 요청으로 결과를 확인해요\./);
  assert.match(back.last().body,/data-grants-submit >다시 확인</);
  mode='ok';await back.submitConfirm();
  const writes=back.calls.filter(row=>row.body?.op==='learner.add');
  assert.equal(writes.length,2);assert.ok(writes.every(row=>row.body.requestId===requestId),'every resend uses the request number made when the dialog first opened');
  assert.ok(back.modals.at(-1).closed);assert.equal(back.notices.at(-1),'학생을 새 명부 줄로 이 반에 넣었어요.');
});

test('the done notice follows the central change and a duplicate says nothing changed',async()=>{
  for(const [change,outcome,expected] of [['moved','applied','학생을 이 반으로 옮겼어요.'],['assigned','applied','학생을 이 반에 넣었어요. 반 없이 남아 있던 이 학생의 명부 줄과 학생 번호를 그대로 썼어요.'],['linked','applied','빈 명부 줄에 SYNK ID를 이었어요.'],['none','duplicate','이미 되어 있었어요. 바뀐 것은 없어요.']]){
    const s=screen({api:(path,body)=>({ok:true,op:body.op,requestId:body.requestId,outcome,classId,learnerId,studentCode:'SYNK-1043',change})});
    withClass(s);s.run(`grantsOpenLearnerAdd(${JSON.stringify(person)})`);await s.submitConfirm();
    assert.equal(s.notices.at(-1),expected);
  }
  const teacher=screen({api:(path,body)=>({ok:true,op:body.op,requestId:body.requestId,outcome:'applied',classId,staffId:synkUserId,change:'closed',invitesRemoved:2})});
  withClass(teacher,{people:{teachers:[teacherRow],learners:[]}});teacher.click({grantsAction:'teacher-remove',staffId:synkUserId});await teacher.submitConfirm();
  assert.match(teacher.notices.at(-1),/직원\(교사\) 자격도 닫았어요/);
});

test('an enrolment in another class offers a move with a new request number',async()=>{
  const s=screen({api:(path,body)=>{if(!body.move)throw refused('ACCOUNT_ALREADY_ENROLLED',409,{details:{classId:'77777777-7777-4777-8777-777777777777',className:'옛 오전반'}});return {ok:true,op:body.op,requestId:body.requestId,outcome:'applied',classId,learnerId,studentCode:'SYNK-1043',change:'moved',fromClassId:'77777777-7777-4777-8777-777777777777'};}});
  withClass(s);s.run(`grantsOpenLearnerAdd(${JSON.stringify(person)})`);
  await s.submitConfirm();
  assert.match(s.last().body,/「옛 오전반」 반에서 이 반으로 옮기기/);
  s.click({grantsAction:'learner-move'});
  assert.match(s.last().body,/옛 학습 기록이 새 반 선생님에게 보여요/);
  await s.submitConfirm();
  assert.equal(s.calls[1].body.move,true);assert.notEqual(s.calls[1].body.requestId,s.calls[0].body.requestId);
  assert.equal(s.notices.at(-1),'학생을 이 반으로 옮겼어요.');
});

test('re-adding a removed learner who sits in another class keeps the learner lines in the move dialog',async()=>{
  const removed={...learnerRow,active:false};
  const s=screen({api:(path,body)=>{throw refused('ACCOUNT_ALREADY_ENROLLED',409,{details:{classId:'77777777-7777-4777-8777-777777777777',className:'옛 오전반'}});}});
  withClass(s,{people:{teachers:[],learners:[removed]}});
  s.click({grantsAction:'learner-readd',learnerId});
  await s.submitConfirm();
  assert.match(s.last().body,/「옛 오전반」 반에서 이 반으로 옮기기/);
  s.click({grantsAction:'learner-move'});
  const body=s.last().body;
  for(const text of ['옛 오전반','시험 저녁반','합성 학생','SYNK-1043',synkUserId])assert.ok(body.includes(text),text);
});

test('a central refusal hides every grant button, and a refused teacher operation hides only the teacher buttons',async()=>{
  const s=screen({api:()=>{throw refused('GRANTS_FORBIDDEN',403);}});
  s.run("memberDirectory.mode='classes'");
  await s.run('grantsLoadClasses()');
  const panel=s.run("adminGrantsPanelMarkup('classes')");
  assert.match(panel,/이 SYNK ID에는 반과 이용 권한을 관리할 권한이 없어요\./);
  assert.doesNotMatch(panel,/data-grants-action=/);
  assert.equal(s.run("adminGrantsDirectoryButton({id:'x'})"),'');
  // 중앙은 교사 열람권을 따로 알려 주지 않는다. 교사 op가 거절되면 그때 교사 단추만 숨긴다.
  const staff=screen({api:()=>{throw refused('GRANTS_FORBIDDEN',403);}});withClass(staff,{people:{teachers:[teacherRow],learners:[]}});
  assert.match(staff.run('grantsClassDetailMarkup()'),/teacher-add/);
  staff.run(`grantsOpenTeacherAdd(${JSON.stringify(person)})`);await staff.submitConfirm();
  assert.equal(staff.run('adminGrants.forbidden'),false);assert.equal(staff.run('adminGrants.staffForbidden'),true);
  // 열려 있는 확인 창도 교사 권한이 없다고 말하고 다시 누를 수 없게 한다.
  const dialog=staff.last().body;
  assert.match(dialog,/이 SYNK ID에는 선생님을 넣고 빼는 권한이 없어요\./);assert.doesNotMatch(dialog,/반과 이용 권한을 관리할 권한이 없어요/);
  assert.match(dialog,/data-grants-submit disabled/);
  const detail=staff.run('grantsClassDetailMarkup()');
  assert.doesNotMatch(detail,/teacher-add|teacher-remove/);assert.match(detail,/learner-add/);assert.match(detail,/선생님을 넣고 빼는 권한이 없어요/);
});

test('entitlements list other sources read-only and grants pick from the server choices with expiry rules',async()=>{
  const choices=[{product:'platform',capability:'library.teacher',label:'서재에서 교사 앱 열기',expiry:'optional',maxMonths:null},{product:'world',capability:'practice.plus',label:'WORLD 연습 더하기',expiry:'required',maxMonths:6}];
  const viewOnly=[{product:'world',capability:'town.access.trial',label:'마을 체험 입장',reason:'마을 체험은 학습 확인 때 자동으로 주어져 여기서 주거나 거둘 수 없어요.'}];
  const s=screen({api:(path,body)=>body.op==='entitlements.list'?{ok:true,op:'entitlements.list',synkUserId,rows:[{product:'world',capability:'practice.plus',source:'billing',validFrom:null,validUntil:null,revokedAt:null,active:true,editable:false},{product:'platform',capability:'library.teacher',source:'workspace-admin',validFrom:null,validUntil:null,revokedAt:null,active:true,editable:true},{product:'world',capability:'town.access.trial',source:'workspace-admin',validFrom:null,validUntil:null,revokedAt:null,active:true,editable:true}],choices,viewOnly}:{ok:true,op:body.op,requestId:body.requestId,outcome:'applied',synkUserId,entitlement:{product:body.product,capability:body.capability,validUntil:body.validUntil??null,revokedAt:null,active:true},change:'granted'}});
  s.run(`adminGrants.person=${JSON.stringify(person)};memberDirectory.mode='entitlements'`);
  await s.run('grantsLoadEnts()');
  const list=s.run('grantsEntsListMarkup()');
  assert.equal((list.match(/data-grants-action="ent-revoke"/g)||[]).length,1,'only rows written by this tool can be revoked');
  // 마을 체험 줄은 이 도구가 준 옛 줄이어도 거두기를 내지 않고 까닭을 적는다(중앙 1e7685f7).
  assert.doesNotMatch(list,/data-capability="town\.access\.trial"/);assert.match(list,/마을 체험 입장/);
  assert.match(list,/마을 체험은 학습 확인 때 자동으로 주어져 여기서 주거나 거둘 수 없어요\./);
  assert.match(list,/결제/);assert.match(list,/관리자 화면/);assert.match(list,/쓰는 중/);
  s.click({grantsAction:'ent-grant'});
  await s.submitConfirm({choice:'1',validUntil:''});
  assert.match(s.last().body,/WORLD 권한은 기한을 꼭 정해야 해요/);
  await s.submitConfirm({choice:'0',validUntil:`${new Date().getUTCFullYear()+1}-02-30`});
  assert.match(s.last().body,/기한을 달력에 있는 날짜로 골라 주세요/);
  await s.submitConfirm({choice:'0',validUntil:'2020-01-01'});
  assert.match(s.last().body,/기한은 오늘이나 그 뒤로 골라 주세요/);
  const far=new Date(Date.now()+300*86400000).toISOString().slice(0,10);
  await s.submitConfirm({choice:'1',validUntil:far});
  assert.match(s.last().body,/6개월 안에서 골라 주세요/);
  await s.submitConfirm({choice:'0',validUntil:far});
  const grant=s.calls.find(row=>row.body?.op==='entitlement.grant');
  assert.deepEqual({...grant.body,requestId:null},{op:'entitlement.grant',synkUserId,product:'platform',capability:'library.teacher',validUntil:`${far}T14:59:59.000Z`,requestId:null,confirm:true},'a library expiry may lie beyond six months');
  assert.equal(s.notices.at(-1),'이용 권한을 줬어요.');
});

test('an entitlement grant dialog survives the SYNK ID re-login even before the choices load again',async()=>{
  const choices=[{product:'platform',capability:'library.teacher',label:'서재에서 교사 앱 열기',expiry:'optional',maxMonths:null},{product:'world',capability:'practice.plus',label:'WORLD 연습 더하기',expiry:'required',maxMonths:6}];
  const until=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const s=screen({api:(path,body)=>{if(body.op==='entitlements.list')return {ok:true,op:'entitlements.list',synkUserId,rows:[],choices};throw refused('REAUTH_REQUIRED',409,{message:'15분 안에 다시 로그인해 주세요.'});}});
  s.run(`adminGrants.person=${JSON.stringify(person)};memberDirectory.mode='entitlements'`);
  await s.run('grantsLoadEnts()');
  s.click({grantsAction:'ent-grant'});
  await s.submitConfirm({choice:'1',validUntil:until});
  assert.match(s.last().body,/SYNK ID로 다시 로그인/);
  const requestId=s.run('adminGrants.pending.requestId');
  await s.run('grantsReauth(null)');
  // 돌아온 새 화면: 이용 권한 목록은 아직 오는 중이다.
  let release=null;
  const back=screen({api:(path,body)=>body.op==='entitlements.list'?new Promise(resolve=>{release=()=>resolve({ok:true,op:'entitlements.list',synkUserId,rows:[],choices});}):{ok:true,op:body.op,requestId:body.requestId,outcome:'applied',synkUserId,entitlement:{product:body.product,capability:body.capability,validUntil:body.validUntil,revokedAt:null,active:true},change:'granted'}});
  back.storage.set('synk.admin.grants.pending',s.storage.get('synk.admin.grants.pending'));
  back.run("memberDirectory.mode='entitlements'");
  assert.equal(back.run('adminGrantsRestore()'),true);
  assert.equal(back.last()?.title,'이용 권한 주기','the dialog comes back before the list finishes loading');
  assert.match(back.last().body,/<option value="1" selected>WORLD 연습 더하기<\/option>/);
  assert.equal(back.run('adminGrants.pending.requestId'),requestId);
  release?.();
  await back.submitConfirm({choice:'1',validUntil:until});
  const grant=back.calls.find(row=>row.body?.op==='entitlement.grant');
  assert.equal(grant.body.requestId,requestId);assert.equal(grant.body.product,'world');assert.equal(grant.body.capability,'practice.plus');
  assert.equal(back.notices.at(-1),'이용 권한을 줬어요.');
});

test('a write the server could not hand back after a session check asks to check again with the same request number',async()=>{
  let mode='unconfirmed';
  const s=screen({api:(path,body)=>{if(mode==='unconfirmed')throw refused('GRANTS_UNCONFIRMED',503,{message:'반영됐는지 확인하지 못했어요.'});return {ok:true,op:body.op,requestId:body.requestId,outcome:'applied',classId,staffId:synkUserId,change:'assigned',replayed:true};}});
  withClass(s,{people:{teachers:[],learners:[]}});
  s.run(`grantsOpenTeacherAdd(${JSON.stringify(person)})`);await s.submitConfirm();
  assert.match(s.last().body,/결과를 확인하지 못했어요\. 이미 반영됐을 수도 있어요\./);assert.match(s.last().body,/data-grants-submit >다시 확인</);
  assert.equal(s.run('adminGrants.forbidden'),false);assert.equal(s.run('adminGrants.staffForbidden'),false,'nothing is hidden');
  mode='ok';await s.submitConfirm();
  const writes=s.calls.filter(row=>row.body?.op==='teacher.add');assert.equal(writes.length,2);assert.equal(writes[1].body.requestId,writes[0].body.requestId);
  assert.equal(s.notices.at(-1),'선생님을 이 반에 넣었어요.');
});
