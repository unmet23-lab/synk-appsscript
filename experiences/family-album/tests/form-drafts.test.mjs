import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createFormDrafts} from '../form-drafts.mjs';
const app=await readFile(new URL('../app.mjs',import.meta.url),'utf8');
const helpers=app.slice(app.indexOf('const detailFormIds='),app.indexOf('async function commit('));
const selectedSave=app.slice(app.indexOf('async function saveSelected('),app.indexOf('async function sample('));
function harness(){
  const forms=new Map();
  const state={formDrafts:createFormDrafts(),draftDirty:false,renderedHash:'#page/a',renderVersion:1,location:{hash:'#page/a',pathname:'/',search:''},forms,document:{getElementById:id=>forms.get(id)},window:{confirm:()=>false},rendered:0,cancelImport(){},render(){state.rendered++;},structuredClone,stamp:()=> '2026-10-06T00:00:00Z',selected:{id:'a'},album:{},upsertPage:(_album,page)=>page,commit:async()=>{}};
  vm.createContext(state);vm.runInContext(helpers+selectedSave,state);return state;
}

test('each form and page keeps its own draft and successful save clears only one',()=>{
  const drafts=createFormDrafts();
  drafts.capture('#page/a','attempt-form',{note:'불이 셌다.'},{note:''});
  drafts.capture('#page/a','question-form',{answer:'중불 5분'},{answer:''});
  drafts.capture('#page/b','attempt-form',{note:'냄비를 바꾸기'},{note:''});
  drafts.clear('#page/a','question-form');
  assert.equal(drafts.read('#page/a','attempt-form').note,'불이 셌다.');
  assert.equal(drafts.read('#page/b','attempt-form').note,'냄비를 바꾸기');
  drafts.capture('#page/a','attempt-form',{note:''},{note:''});
  assert.equal(drafts.has('#page/a'),false);
  assert.equal(drafts.has('#page/b'),true);
  drafts.clearAll();assert.equal(drafts.has('#page/b'),false);
});

test('canceling navigation preserves both story and detail drafts; approving discards the current screen',()=>{
  const state=harness();state.draftDirty=true;
  state.formDrafts.capture('#page/a','attempt-form',{note:'남길 말'},{note:''});
  assert.equal(state.go('#takehome'),false);
  assert.equal(state.location.hash,'#page/a');assert.equal(state.draftDirty,true);assert.equal(state.formDrafts.has('#page/a'),true);
  state.window.confirm=()=>true;
  assert.equal(state.go('#takehome'),true);
  assert.equal(state.location.hash,'#takehome');assert.equal(state.draftDirty,false);assert.equal(state.formDrafts.has('#page/a'),false);
});

test('approving account reverification keeps unsaved flags until a real replacement or navigation',()=>{
  const state=harness();state.draftDirty=true;state.window.confirm=()=>true;
  state.formDrafts.capture('#page/a','attempt-form',{note:'같은 계정에서 계속 쓸 기록'},{note:''});
  const hook=app.match(/beforeNavigate:(\(\)=>confirmDiscard\([^\n]*\)),/)[1];
  assert.equal(vm.runInContext(`(${hook})()`,state),true);
  assert.equal(state.draftDirty,true);assert.equal(state.formDrafts.has('#page/a'),true);
  state.window.confirm=()=>false;assert.equal(state.go('#takehome'),false);
});

test('a page rerender restores all unfinished form values including an intentionally blank date',()=>{
  const state=harness(),fields=[{id:'attempt-date',value:'',defaultValue:'2026-10-06'},{id:'attempt-note',value:'다음에는 덜 넣기',defaultValue:''}];
  const form={id:'attempt-form',querySelectorAll:()=>fields};state.forms.set(form.id,form);
  state.captureFormDraft(form);
  fields[0].value='2026-10-06';fields[1].value='';
  state.restoreFormDrafts();
  assert.equal(fields[0].value,'');assert.equal(fields[1].value,'다음에는 덜 넣기');
});

test('saving one detail form clears it while another unfinished form survives',async()=>{
  const state=harness();
  state.formDrafts.capture('#page/a','attempt-form',{note:'남겨둔 시도'},{note:''});
  state.formDrafts.capture('#page/a','question-form',{answer:'저장할 답'},{answer:''});
  await state.saveSelected(page=>{page.answer='저장할 답';},{formId:'question-form'});
  assert.equal(state.formDrafts.read('#page/a','question-form'),null);
  assert.equal(state.formDrafts.read('#page/a','attempt-form').note,'남겨둔 시도');
  assert.equal(state.rendered,1);
});

test('storage failure keeps the submitted draft and does not rerender',async()=>{
  const state=harness();state.commit=async()=>{throw new Error('quota');};
  state.formDrafts.capture('#page/a','attempt-form',{note:'저장 실패해도 유지'},{note:''});
  await assert.rejects(state.saveSelected(()=>{},{formId:'attempt-form'}),/quota/);
  assert.equal(state.formDrafts.read('#page/a','attempt-form').note,'저장 실패해도 유지');assert.equal(state.rendered,0);
});

test('late save cannot erase a draft on a newly rendered screen, even when returning to the same URL',async()=>{
  const state=harness();let finish;state.commit=()=>new Promise(resolve=>{finish=resolve;});
  state.formDrafts.capture('#page/a','attempt-form',{note:'저장한 내용'},{note:''});
  const pending=state.saveSelected(()=>{},{formId:'attempt-form'});
  state.renderVersion++;
  state.formDrafts.capture('#page/a','attempt-form',{note:'다시 돌아와 새로 적는 내용'},{note:''});
  finish();await pending;
  assert.equal(state.rendered,0);assert.equal(state.formDrafts.read('#page/a','attempt-form').note,'다시 돌아와 새로 적는 내용');
});

test('browser navigation and reload are guarded for pending detail input',()=>{
  const state=harness(),listeners={};state.window.addEventListener=(name,fn)=>{listeners[name]=fn;};
  state.history={replaceState:(_state,_title,url)=>{state.location.hash=url.slice(url.indexOf('#'));}};
  const start=app.indexOf("window.addEventListener('hashchange'"),end=app.indexOf("window.addEventListener('pagehide'",start);
  vm.runInContext(app.slice(start,end),state);
  state.formDrafts.capture('#page/a','attempt-form',{note:'떠나기 전에 저장'},{note:''});
  state.location.hash='#takehome';listeners.hashchange();
  assert.equal(state.location.hash,'#page/a');assert.equal(state.rendered,0);
  const event={prevented:false,preventDefault(){this.prevented=true;}};listeners.beforeunload(event);
  assert.equal(event.prevented,true);assert.equal(event.returnValue,'');
  state.window.confirm=()=>true;state.location.hash='#takehome';listeners.hashchange();
  assert.equal(state.rendered,1);assert.equal(state.formDrafts.has('#page/a'),false);
});
