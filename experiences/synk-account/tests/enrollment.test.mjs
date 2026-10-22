import test from 'node:test';
import assert from 'node:assert/strict';
import {mountEnrollment,normalizeInviteCode,enrollmentMessage} from '../src/enrollment.mjs';
function fixture(request,options={}){
  const elements=[],doc={createElement(tag){const el={tag,children:[],value:'',textContent:'',listeners:{},setAttribute(){},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},addEventListener(name,fn){this.listeners[name]=fn;},remove(){this.removed=true;}};elements.push(el);return el;}};
  const container={ownerDocument:doc,append(el){this.panel=el;}},mount=mountEnrollment({container,request,...options});
  return {mount,input:elements.find(e=>e.tag==='input'),form:elements.find(e=>e.tag==='form'),confirm:elements.find(e=>e.type==='button'),details:elements.find(e=>e.tag==='div'),status:elements.find(e=>e.listeners===undefined),container,submit(){return this.form.listeners.submit({preventDefault(){}});}};
}
test('student must preview the current code then explicitly confirm; name markup stays text',async()=>{
  const calls=[],linked=[],f=fixture(async(action,body)=>{calls.push({action,body});return action==='preview'?{invite:{className:'A반',learnerLabel:'<script>학생</script>',expiresAt:'2026-10-12T00:00:00Z'}}:{linked:true};},{onLinked:r=>linked.push(r)});
  f.input.value='a'.repeat(32);await f.confirm.listeners.click();assert.equal(calls.length,0);
  await f.submit();assert.equal(calls.length,1);assert.equal(f.confirm.hidden,false);assert.equal(f.details.children[0].textContent,'A반 · <script>학생</script>');
  f.input.value='b'.repeat(32);f.input.listeners.input();await f.confirm.listeners.click();assert.equal(calls.length,1);
  await f.submit();await f.confirm.listeners.click();assert.deepEqual(calls.at(-1),{action:'claim',body:{token:'b'.repeat(32),confirm:true}});assert.equal(linked.length,1);assert.equal(f.input.value,'');assert.equal(f.confirm.hidden,true);
});
test('late preview after disposal cannot reveal the student or enable confirmation',async()=>{
  let resolve;const f=fixture(()=>new Promise(r=>resolve=r));f.input.value='a'.repeat(32);const pending=f.submit();f.mount.dispose();resolve({invite:{className:'A반',learnerLabel:'학생'}});await pending;
  assert.equal(f.input.value,'');assert.equal(f.details.children.length,0);assert.equal(f.confirm.hidden,true);assert.equal(f.container.panel.removed,true);
});
test('uncertain claim retains only the verified code for explicit receipt retry',async()=>{
  let claims=0;const f=fixture(async action=>{if(action==='preview')return{invite:{className:'A반',learnerLabel:'학생'}};if(++claims===1)throw Error('network');return{linked:true};});
  f.input.value='a'.repeat(32);await f.submit();await f.confirm.listeners.click();assert.equal(f.input.value,'a'.repeat(32));assert.equal(f.confirm.hidden,false);await f.confirm.listeners.click();assert.equal(claims,2);assert.equal(f.input.value,'');
});

test('declining draft disposal blocks the server claim and preserves the verified invitation for retry',async()=>{
  const calls=[],linked=[];let allow=false,prompts=0;
  const f=fixture(async(action,body)=>{calls.push({action,body});return action==='preview'?{invite:{className:'A반',learnerLabel:'학생'}}:{linked:true,duplicate:true};},
    {beforeClaim:()=>{prompts++;return allow;},onLinked:r=>linked.push(r)});
  f.input.value='a'.repeat(32);await f.submit();assert.equal(prompts,0,'read-only preview does not discard drafts');
  await f.confirm.listeners.click();
  assert.equal(prompts,1);assert.deepEqual(calls.map(c=>c.action),['preview']);assert.equal(linked.length,0);
  assert.equal(f.input.value,'a'.repeat(32));assert.equal(f.confirm.hidden,false);assert.equal(f.confirm.disabled,false);
  allow=true;await f.confirm.listeners.click();
  assert.equal(prompts,2);assert.deepEqual(calls.map(c=>c.action),['preview','claim']);assert.equal(linked[0].duplicate,true);
});

test('account invalidation while awaiting draft confirmation cannot send a stale claim',async()=>{
  const calls=[];let finish;
  const f=fixture(async action=>{calls.push(action);return{invite:{className:'A반',learnerLabel:'학생'}};},{beforeClaim:()=>new Promise(resolve=>finish=resolve)});
  f.input.value='a'.repeat(32);await f.submit();const pending=f.confirm.listeners.click();
  f.mount.dispose();finish(true);await pending;
  assert.deepEqual(calls,['preview']);assert.equal(f.input.value,'');assert.equal(f.container.panel.removed,true);
});

// 10-22 반 리허설: 휴대폰 자판이 첫 글자를 대문자로 바꾸거나 코드를 끊어 적으면 서버(소문자 32자리만 받음)가 400 INVALID_INVITE로 거절했고, 화면은 그 코드를 그대로 보였다.
test('codes copied with capitals, spaces, line breaks or hyphens reach the server as the issued lowercase code',async()=>{
  const code='5da36145e533d152366c045c365a9b2f';
  for(const typed of [code.toUpperCase(),'5Da36145 E533d152\n366c045c 365a9b2f','5da36145-e533-d152-366c-045c365a9b2f','  '+code+'  '])assert.equal(normalizeInviteCode(typed),code,typed);
  for(const other of ['Abc_DEF-ghi_jklmnopqrstuv','x'.repeat(31)])assert.equal(normalizeInviteCode(other),other,'other formats keep their case');
  const calls=[],f=fixture(async(action,body)=>{calls.push(body);return{invite:{className:'A반',learnerLabel:'학생'}};});
  f.input.value='5DA36145E533D152366C045C365A9B2F';await f.submit();assert.deepEqual(calls,[{token:code}]);
});
test('server refusal codes become what the student should do, never the raw code',async()=>{
  for(const code of ['INVALID_INVITE','INVITE_UNAVAILABLE','ACCOUNT_ALREADY_ENROLLED','LEARNER_ALREADY_LINKED','PRODUCT_FORBIDDEN','AUTH_REQUIRED','FORBIDDEN','ENROLLMENT_UNAVAILABLE']){
    const text=enrollmentMessage(Object.assign(Error(code),{code}));assert.ok(!text.includes(code),code);assert.doesNotMatch(text,/[A-Z]+_[A-Z]+/,code);assert.match(text,/요\.$/,code);
  }
  // 모르는 코드와 브라우저 쪽 실패(끊긴 회선 · 12초 중단 · 게이트웨이 HTML 응답의 JSON 해석)는 영어 글 대신 일반 안내다(10-22 Fable P2).
  const general='연결하지 못했어요. 인터넷 연결을 확인하고 잠시 뒤 다시 해 주세요.';
  for(const error of [Object.assign(Error('UNKNOWN_REASON'),{code:'UNKNOWN_REASON'}),Object.assign(Error('constructor'),{code:'constructor'}),new TypeError('Failed to fetch'),new DOMException('The user aborted a request.','AbortError'),new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"),{},null])
    assert.equal(enrollmentMessage(error),general,String(error?.message));
  assert.equal(enrollmentMessage(Error('반 정보를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.')),'반 정보를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.');
  assert.match(enrollmentMessage(Object.assign(Error('INVITE_UNAVAILABLE'),{code:'INVITE_UNAVAILABLE'})),/^연결 코드를 한 글자씩 다시 확인해 주세요\./,'꼴은 맞지만 없는 코드(오타)도 이 코드라 다시 확인하기가 먼저');
  const f=fixture(async()=>{throw Object.assign(Error('INVALID_INVITE'),{code:'INVALID_INVITE',status:400});});
  f.input.value='a'.repeat(32);await f.submit();
  const status=f.container.panel.children.find(el=>el.tag==='p'&&el.className==='error');assert.ok(status);assert.doesNotMatch(status.textContent,/INVALID_INVITE/);assert.match(status.textContent,/연결 코드가 맞지 않아요/);
});
