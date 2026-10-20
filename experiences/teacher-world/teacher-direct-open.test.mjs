import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as Overview from './workspace-overview.mjs';
import {applySharingFence} from './sharing-fence.mjs';

// 교사 앱 주소(/teacher-world/)를 workspace.synk.im에서 직접 열면 회사 서버의 /api/workspace(업무 자료, 로그인 필요)를
// 수업 자료로 읽어 「처리하지 못했어요. (401)」이 보였다. 이 파일은 그 안내 화면이 오류 대신 나오는지 본다.
const source=fs.readFileSync(new URL('./app.mjs',import.meta.url),'utf8').replace("import {applySharingFence} from './sharing-fence.mjs';",'').replace("import {createPersonalizationUI} from './personalization-ui.mjs';",'').replace("import {mountHomeworkReview} from './homework-review.mjs';",'').replace(/^import \{[^\n]*\} from '\.\/workspace-overview\.mjs';\r?\n/m,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const reply=(body,status=200)=>({ok:status<400,status,json:async()=>body});
const COMPANY_HEALTH={ok:true,app:'synk-company',version:1,workspaceIntegration:true,ready:true};

function open({health,search=''}={}){
  const nodes=new Map(),requests=[];
  const element=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',textContent:'',innerHTML:'',hidden:false,dataset:{},listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);},replaceChildren(){this.innerHTML='';this.textContent='';},close(){this.open=false;},querySelector(){return element(id+'-child');}});return nodes.get(id);};
  const context={...Overview,applySharingFence,URL,URLSearchParams,Date,Error,FormData:class{},crypto:{randomUUID:()=>'test-key'},setTimeout:()=>0,clearTimeout(){},setInterval:()=>1,clearInterval(){},
    location:{href:'https://workspace.synk.im/teacher-world/'+search,origin:'https://workspace.synk.im'},history:{replaceState(){}},
    sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},window:{addEventListener(){}},
    document:{getElementById:element,documentElement:element('html'),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},
    mountHomeworkReview:()=>({show(){},peek(){},reset(){},hasDraft:()=>false,refresh(){}}),createPersonalizationUI:()=>({set(){},invalidate(){}}),
    fetch:url=>{requests.push(url);if(url==='/api/health')return Promise.resolve(reply(health));return new Promise(()=>{});}
  };
  vm.createContext(context);vm.runInContext(source,context,{filename:'app.mjs'});
  return {element,requests};
}

test('opened directly on the workspace host it guides to 내 수업 instead of showing a 401',async()=>{
  const f=open({health:COMPANY_HEALTH});await tick();
  assert.equal(f.element('html').dataset.ready,'workspace-entry');
  assert.deepEqual(f.requests,['/api/health'],'the company /api/workspace is never read as classroom data');
  const loading=f.element('loading');assert.equal(loading.hidden,false);
  assert.match(loading.innerHTML,/내 수업 열기/);assert.match(loading.innerHTML,/href="\/\?tab=teaching"/);assert.match(loading.innerHTML,/target="_top"/);
  assert.doesNotMatch(loading.innerHTML,/처리하지 못했어요|401/);
});

test('the guide hides every classroom control and the demo or connection labels',async()=>{
  const f=open({health:COMPANY_HEALTH});await tick();
  for(const id of ['summary','view-students','view-assignments','view-review','world-connections','teacher-session','teacher-logout','personalization-button','mode-note','mode-badge','refresh'])assert.equal(f.element(id).hidden,true,id);
  assert.equal(f.element('mode-badge').textContent,'','the 예시 데이터 · 로컬 MVP badge is never written');
});

test('the guide link only goes to the same-origin 내 수업 tab',async()=>{
  const f=open({health:COMPANY_HEALTH});await tick();
  const links=[...f.element('loading').innerHTML.matchAll(/href="([^"]*)"/g)].map(m=>m[1]);
  assert.deepEqual(links,['/?tab=teaching']);
});

test('the local classroom server and the SYNK ID classroom frame keep their own flows',async()=>{
  const local=open({health:{mode:'preview'}});await tick();
  assert.deepEqual(local.requests,['/api/health','/api/workspace']);assert.notEqual(local.element('html').dataset.ready,'workspace-entry');
  assert.equal(local.element('mode-badge').textContent,'예시 데이터 · 로컬 MVP');
  // ?account=1 is the real classroom frame: it never reads /api/health and never shows the guide.
  const frame=open({health:COMPANY_HEALTH,search:'?account=1'});await tick();
  assert.equal(frame.requests.includes('/api/health'),false);assert.notEqual(frame.element('html').dataset.ready,'workspace-entry');
});

test('the guide CSS hides the empty class picker and menu only in the guide state',()=>{
  const css=fs.readFileSync(new URL('./signal.css',import.meta.url),'utf8');
  const rule=css.split('\n').find(line=>line.includes('[data-ready="workspace-entry"]'));
  assert.ok(rule,'guide rule exists');assert.match(rule,/#class-select/);assert.match(rule,/\.sidebar nav/);assert.match(rule,/display:none/);
});
