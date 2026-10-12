import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const messenger=readFileSync(new URL('../../../../../tools/company-messenger/public/app.js',import.meta.url),'utf8');
const workspace=readFileSync(new URL('./public/workspace.js',import.meta.url),'utf8');
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function fixture(){
  const state={user:{id:'u'},navigationSeq:1,drawer:'personal',personalTab:'notifications'},calls=[],requests=[],errors=[];
  const context=vm.createContext({state,moduleBase:'/messenger',moduleVisible:true,esc:escape,shortDate:()=>'',icon:()=>'',id:encodeURIComponent,Date,notificationLabels:{},parentMessage:type=>calls.push(type),refreshNotificationCount(){},toast:message=>errors.push(message),api:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}))});
  vm.runInContext(messenger.slice(messenger.indexOf('function workflowNotificationHtml('),messenger.indexOf('function showDeadlineDigest(')),context);
  const item={id:'automation:test:1',kind:'automation_health',title:'<script>bad</script>',text:'<img src=x onerror=bad>',href:'https://untrusted.test/',createdAt:'2026-10-12T00:00:00Z',readAt:null};
  const run=code=>vm.runInContext(code,context);context.item=item;return {state,calls,requests,errors,context,item,run};
}
test('automation notice escapes source text and ignores supplied URL when opening the fixed parent destination',async()=>{
  const f=fixture(),html=f.run('workflowNotificationHtml(item,0)');assert.doesNotMatch(html,/<script>|<img|untrusted/);assert.match(html,/&lt;script&gt;/);
  const opening=f.run('openPersonalNotification(item)');assert.equal(f.requests.length,1);assert.equal(f.requests[0].options.method,'POST');assert.deepEqual(f.calls,[]);
  f.requests[0].resolve({ok:true});await opening;assert.deepEqual(f.calls,['messenger:automation-open']);
});
test('late notification reads cannot redirect a hidden messenger, changed account or different panel',async()=>{
  for(const change of [f=>f.context.moduleVisible=false,f=>f.state.user={id:'other'},f=>f.state.personalTab='tasks',f=>f.state.navigationSeq++]){
    const f=fixture(),opening=f.run('openPersonalNotification(item)');change(f);f.requests[0].resolve({ok:true});await opening;assert.deepEqual(f.calls,[]);
  }
});
test('failed or no-longer-authorized notification read never opens the status page',async()=>{
  const f=fixture(),opening=f.run('openPersonalNotification(item)');f.requests[0].reject(new Error('접근할 수 없습니다'));await opening;assert.deepEqual(f.calls,[]);assert.deepEqual(f.errors,['접근할 수 없습니다']);
});
test('parent accepts only current same-origin messenger iframe and ignores arbitrary notification URLs',()=>{
  let handler;const frame={},state={user:{id:'u'},tab:'messenger'},makerTools={},opened=[];
  const context=vm.createContext({window:{addEventListener:(_name,fn)=>handler=fn},location:{origin:'http://localhost:4191'},workspaceModule:{frame:{contentWindow:frame}},state,makerTools,selectWorkspaceView:(...args)=>opened.push(args),render(){},makerToolsEnsure(){}});
  const start=workspace.indexOf("window.addEventListener('message',event=>{");vm.runInContext(workspace.slice(start,workspace.indexOf("window.addEventListener('resize'",start)),context);
  const event={origin:'http://localhost:4191',source:frame,data:{type:'messenger:automation-open',url:'https://untrusted.test/'}};
  handler({...event,origin:'https://untrusted.test'});handler({...event,source:{}});state.tab='home';handler(event);assert.equal(opened.length,0);
  state.tab='messenger';handler(event);assert.equal(makerTools.view,'automation');assert.deepEqual(opened,[['workroom','tools']]);
});
