import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const settle=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};}

test('saving PATH after switching to SHIFT preserves the new company list request',async()=>{
  const saved=deferred(),listed=deferred(),events=new Map(),calls=[];
  const state={user:{id:'person'},data:{},tab:'path',modalRequest:1};
  const form={dataset:{form:'wa-work',id:'record',company:'PATH',revision:'1'},isConnected:true,querySelector:()=>({disabled:false,textContent:''})};
  const context=vm.createContext({state,document:{addEventListener:(name,fn)=>events.set(name,fn)},queueMicrotask,
    FormData:class{*[Symbol.iterator](){yield['title','Saved PATH record'];}},
    api:(url,body)=>{calls.push({url,write:body!==undefined});return body===undefined?listed.promise:saved.promise;},
    pageHeading:()=>'',isViewer:()=>false,button:()=>'',escape:String,empty:()=>'',renderBackground:()=>{},closeModal:()=>{form.isConnected=false;},notify:()=>{}});
  vm.runInContext(readFileSync(new URL('./public/workspace-access.js',import.meta.url),'utf8'),context);
  vm.runInContext("wa.workKey='person:PATH';wa.work={items:[]}",context);
  events.get('submit')({target:form,preventDefault(){},stopImmediatePropagation(){}});
  form.isConnected=false;state.modalRequest++;state.tab='lectures';
  vm.runInContext('waWorkPage()',context);await settle();
  assert.deepEqual(calls.map(row=>[row.url,row.write]),[['/api/company-work/PATH/record',true],['/api/company-work/SHIFT',false]]);
  saved.resolve({ok:true});await settle();
  listed.resolve({items:[{id:'shift-record',title:'Current SHIFT lecture'}],canWrite:true});await settle();
  const result=vm.runInContext('({key:wa.workKey,loading:wa.workLoading,items:wa.work?.items})',context);
  assert.equal(result.key,'person:SHIFT');assert.equal(result.loading,false);
  assert.equal(result.items?.[0]?.id,'shift-record','the current company response must still populate the list');
});

test('an admin read started before a write cannot restore stale data or clear the reload error',async()=>{
  const read=deferred(),state={user:{id:'admin',role:'admin'},tab:'admin',data:{members:[]}};
  const context=vm.createContext({state,document:{addEventListener(){},querySelector:()=>null},isAdmin:()=>true,isDemoMode:()=>false,
    companyAuthSnapshot:()=>({userId:'admin'}),companyAuthCurrent:stamp=>stamp.userId==='admin',api:()=>read.promise,AbortController,URLSearchParams});
  vm.runInContext(readFileSync(new URL('./public/admin-workspace.js',import.meta.url),'utf8'),context);
  const pending=vm.runInContext('loadAdminWorkspace()',context);
  vm.runInContext("adminNoteWriteSucceeded({userId:'admin'});adminOnStateLoadFailed(new Error('Reload failed after saving'))",context);
  read.resolve({members:[{id:'old-result'}],invitations:[]});await pending;
  const result=vm.runInContext('({data:adminState.data,error:adminState.error})',context);
  assert.equal(result.data,null,'a completed write invalidates every earlier admin read');
  assert.equal(result.error,'Reload failed after saving');
});
