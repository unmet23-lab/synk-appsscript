import test from 'node:test';
import assert from 'node:assert/strict';
import {mountEnrollment} from '../src/enrollment.mjs';
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
