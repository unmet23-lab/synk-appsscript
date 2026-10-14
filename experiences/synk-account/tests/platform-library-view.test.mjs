import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPlatformLibrary } from '../src/platform-library-view.mjs';
import { emptyPlatformLibrary, validatePlatformLibrary } from '../src/platform-library-data.mjs';

// Small DOM fixture for authored HTML and native events. No view, notebook or sync
// behavior is stubbed: requests cross their real adapter and CAS/outbox code.
const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({ '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'" }[entity]));
const dataKey = value => value.replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase());
class Element {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = new Map(); this.listeners = new Map(); this.hidden = false; this.disabled = false; this.inert = false; this.value = ''; this.checked = false; this._text = ''; this._html = ''; this.className = ''; this.classList = { add: name => { this.className += ' ' + name; } }; }
  set innerHTML(html) {
    this._html = html; this.children = []; this._text = ''; const stack = [this];
    for (const token of html.match(/<[^>]+>|[^<]+/g) || []) {
      if (token.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      if (token.startsWith('<')) {
        const tag = /^<([\w-]+)/.exec(token)?.[1]; if (!tag) continue;
        const node = new Element(tag), attributes = token.slice(tag.length + 1, -1);
        for (const [, key, double, single, bare] of attributes.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) node.setAttribute(key, decode(double ?? single ?? bare ?? ''));
        stack.at(-1).append(node); if (!['input','br','img','link','meta'].includes(tag)) stack.push(node);
      } else stack.at(-1)._text += decode(token);
    }
    for (const select of this.querySelectorAll('select')) select.value = select.querySelector('option[selected]')?.value ?? select.querySelector('option')?.value ?? '';
  }
  get innerHTML() { return this._html; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); if (key.startsWith('data-')) this.dataset[dataKey(key.slice(5))] = String(value); else if (key === 'class') this.className = value; else if (key === 'value') this.value = value; else if (['hidden','disabled','checked'].includes(key)) this[key] = true; }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  addEventListener(name, callback, options) {
    if(name!=='click'){this.listeners.set(name,callback);return;}
    this.clickListeners??=[];this.clickListeners.push({callback,capture:options===true||options?.capture===true});
    this.listeners.set(name,event=>{let stopped=false;event.stopImmediatePropagation=()=>{stopped=true;};event.preventDefault??=()=>{};
      for(const listener of [...this.clickListeners].sort((a,b)=>Number(b.capture)-Number(a.capture))){listener.callback(event);if(stopped)break;}
    });
  }
  matches(selector) {
    const tag = /^[a-z]+/i.exec(selector)?.[0]; if (tag && this.tagName !== tag.toUpperCase()) return false;
    const klass = /\.([\w-]+)/.exec(selector)?.[1]; if (klass && !this.className.split(/\s+/).includes(klass)) return false;
    for (const [, key, double, bare] of selector.matchAll(/\[([^=\]]+)(?:=(?:"([^"]*)"|([^\]]*)))?\]/g)) {
      const value = key.startsWith('data-') ? this.dataset[dataKey(key.slice(5))] : this.attributes.get(key);
      if (value === undefined || ((double ?? bare) !== undefined && value !== (double ?? bare))) return false;
    }
    return true;
  }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  querySelectorAll(selector) {
    const selectors = selector.split(','), descendants = node => node.children.flatMap(child => [child, ...descendants(child)]);
    return descendants(this).filter(node => selectors.some(part => { const segments = part.trim().split(/\s+/); if (!node.matches(segments.pop())) return false; let parent = node.parentElement; while (segments.length) { const previous = segments.pop(); while (parent && !parent.matches(previous)) parent = parent.parentElement; if (!parent) return false; parent = parent.parentElement; } return true; }));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const until = async predicate => { for (let i = 0; i < 150; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); } assert.fail('Expected local async state did not settle'); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const signed = (owner = 'A', sessionGeneration = 1) => ({ configured: true, status: 'signed-in', signedIn: true, account: { synk_user_id: owner }, sessionGeneration });
const state = (favorites = []) => ({ ...emptyPlatformLibrary(), consent: true, favorites });
const memo = (id,done=false) => ({id,appId:'world',title:'메모 '+id,done,createdAt:1});
const clickCloud = (f,action,id) => { const target=f.content.querySelector(`[data-cloud="${action}"]${id?`[data-id="${id}"]`:''}`);assert.ok(target,action);f.content.listeners.get('click')({target}); };
const memoryStorage = () => { const data = new Map(); return { data, getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value), removeItem: key => data.delete(key), key: i => [...data.keys()][i] ?? null, get length() { return data.size; } }; };
let activeFixtures=0,originalGlobals;

async function fixture(t, { records = new Map(), storage = memoryStorage(), device = {}, initial = signed(), onChange = () => {}, native=true, ensureReady=async()=>{},getAppIds,recoveryHost={} } = {}) {
  if(activeFixtures++===0)originalGlobals=['document','addEventListener','removeEventListener','confirm'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]);
  const lifecycle = new Map(), lifecycleListeners = new Map(), confirms = [], calls = [], holds = new Map(); let current = initial, listener, failSave = false;
  Object.assign(globalThis, { document: { createElement: tag => new Element(tag) }, addEventListener: (name, fn) => { if(!lifecycleListeners.has(name))lifecycleListeners.set(name,new Set());const listeners=lifecycleListeners.get(name);listeners.add(fn);lifecycle.set(name,event=>{for(const callback of listeners)callback(event);}); }, removeEventListener: (name,fn) => {const listeners=lifecycleListeners.get(name);listeners?.delete(fn);if(!listeners?.size){lifecycle.delete(name);lifecycleListeners.delete(name);}}, confirm: text => { confirms.push(text); return true; } });
  const host = {
    onAuthChanged: fn => { listener = fn; return () => { listener = null; }; }, authStatus: async () => current,
    authSignIn: async () => current, authSignOut: async () => { current = { configured:true, status:'signed-out', signedIn:false, sessionGeneration: current.sessionGeneration + 1 }; listener?.(current); return { ok:true }; },
    accountRequest: async (operation, params = {}) => {
      const owner = current.account?.synk_user_id; calls.push({ operation, owner, params: structuredClone(params) });
      if (holds.has(operation)) { const gate = holds.get(operation); holds.delete(operation); await gate.promise; }
      let row = records.get(owner) ?? { revision:0, state:null };
      if (operation === 'platformSave' || operation === 'platformDelete') {
        if (failSave) return { ok:false, error:{ code:'NETWORK', message:'합성 저장 실패' } };
        if (params.expected_revision !== row.revision) return { ok:false, revision:row.revision, error:{ code:'REVISION_CONFLICT' } };
        row = { revision:row.revision + 1, state:operation === 'platformDelete' ? null : validatePlatformLibrary(params.state) }; records.set(owner,row);
      } else assert.equal(operation, 'platformLoad');
      return { ok:true, scope:'synk-personal', resource:'platform-library', accountId:owner, updatedAt:null, ...structuredClone(row) };
    },
  };
  host.identity=()=>({...current,accountId:current.account?.synk_user_id});host.refresh=async()=>host.identity();host.request=host.accountRequest;
  Object.assign(host,recoveryHost);
  host.subscribe=fn=>host.onAuthChanged(value=>fn({...value,accountId:value.account?.synk_user_id}));
  const opened=[],root = new Element(), view = mountPlatformLibrary(root, { native, ensureReady, getHost:() => host, getDevice:() => device,...(getAppIds?{getAppIds}:{}), storage, onChange, onOpen:id=>opened.push(id) });
  const content = root.querySelector('[data-cloud-content]'), mount = root.querySelector('[data-notebook-mount]');
  t.after(() => { view.dispose(); if(--activeFixtures===0)for (const [key,descriptor] of originalGlobals) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key]; } });
  return { view, root, content, mount, records, storage, confirms, calls, lifecycle, opened, host,
    connect: async () => { await root.querySelector('[data-connect-button]').onclick(); await settle(); },
    auth: async value => { current = value; listener?.(value); await settle(); },
    setFail: value => { failSave = value; }, hold: operation => { const gate = deferred(); holds.set(operation,gate); return gate; },
    status: () => mount.querySelector('[data-notebook-status]')?.textContent, detail: () => mount.querySelector('[data-notebook-detail]')?.textContent,
    button: action => mount.querySelector(`[data-notebook="${action}"]`),
    cloud: action => { const target = content.querySelector(`[data-cloud="${action}"]`); assert.ok(target, action); content.listeners.get('click')({ target }); },
    click: async action => { const target = mount.querySelector(`[data-notebook="${action}"]`); assert.ok(target,action); mount.listeners.get('click')({ target }); await settle(); },
    input: text => { const target = content.querySelector('[name=title]'); assert.ok(target,'note form exists'); target.value = text; content.listeners.get('input')({ target }); },
    submit: () => content.listeners.get('submit')({ target:content.querySelector('[data-note-form]'), preventDefault() {} }),
    writes: () => calls.filter(call => call.operation === 'platformSave'),
  };
}

test('note search and status filtering retain the live editor and make no account writes', async t => {
  const notes=[{...memo('a'),title:'다음 PATH 계획',appId:'path'},{...memo('b',true),title:'검토한 계획',appId:'path'},memo('c')];
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:{...state(),notes}}]])});await f.connect();f.input('계속 작성할 초안');
  const input=f.content.querySelector('[name=title]'),search=f.content.querySelector('[data-note-search]'),filter=f.content.querySelector('[data-note-filter]');
  search.value='미완성';f.content.listeners.get('input')({target:search,isComposing:true});assert.equal(search.value,'미완성');assert.equal(f.content.querySelector('[data-note-search]'),search);assert.ok(f.content.querySelector('[data-completed-notes]'));
  search.value='path 계획';f.content.listeners.get('input')({target:search});
  assert.deepEqual(f.content.querySelectorAll('article').map(row=>row.dataset.noteId),['a','b']);
  filter.value='done';f.content.listeners.get('change')({target:filter});
  assert.deepEqual(f.content.querySelectorAll('article').map(row=>row.dataset.noteId),['b']);assert.equal(f.content.querySelector('[name=title]'),input);assert.equal(input.value,'계속 작성할 초안');assert.equal(f.writes().length,0);
  assert.deepEqual(f.view.searchNotes('path').map(row=>row.id),['a','b']);assert.equal(f.view.openNote('b'),true);assert.equal(f.content.querySelector('[data-completed-notes]').hidden,false);assert.equal(search.value,'');assert.equal(filter.value,'all');assert.equal(f.view.openNote('missing'),false);
  f.lifecycle.get('pagehide')();assert.deepEqual(f.view.searchNotes(''),[]);assert.equal(f.view.openNote('a'),false);
});

test('favorite up and down controls persist actual display order without replacing note input', async t=>{
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state(['world','care','pulse'])}]])});await f.connect();f.input('그대로 둘 메모');
  assert.equal(f.content.querySelector('[data-cloud="favorite-up"][data-id="world"]').disabled,true);
  clickCloud(f,'favorite-up','pulse');await until(()=>!f.view.hasPending());
  assert.deepEqual(f.records.get('A').state.favorites,['world','pulse','care']);assert.equal(f.content.querySelector('[name=title]').value,'그대로 둘 메모');
  assert.equal(f.content.querySelector('[data-cloud="favorite-down"][data-id="care"]').disabled,true);
});

test('native opted-in unsaved input is offered explicitly, restored and cleared after account save', async t=>{
  let stored={draft:{appId:'world',title:'다시 이어 쓸 초안'},editing:null,parkedDraft:null},changes;
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]]),recoveryHost:{draftRecoveryStatus:async()=>({ok:true,enabled:true,available:true}),draftRecoveryLoad:async()=>({ok:true,draft:stored}),draftRecoverySave:async(_slot,payload)=>(stored=structuredClone(payload),{ok:true}),draftRecoveryClear:async()=>(stored=null,{ok:true}),onDraftRecoveryChanged:fn=>(changes=fn,()=>{})}});await f.connect();await settle();
  assert.equal(f.content.querySelector('[data-note-recovery]').hidden,false);assert.equal(f.content.querySelector('[name=title]').value,'');assert.equal(f.writes().length,0);
  clickCloud(f,'recover-draft');assert.equal(f.content.querySelector('[name=title]').value,'다시 이어 쓸 초안');assert.equal(f.content.querySelector('[data-note-recovery]').hidden,true);assert.equal(f.writes().length,0);
  f.submit();await until(()=>!f.view.hasPending()&&f.records.get('A').state.notes.length===1);await until(()=>stored===null);
  f.input('A 계정의 다음 초안');await until(()=>stored?.draft.title==='A 계정의 다음 초안');
  changes({enabled:false});await settle();assert.equal(f.content.querySelector('[name=title]').value,'A 계정의 다음 초안');
});

test('a recovered edit whose remote original changed opens as a new note and retains its parked input',async t=>{
  const original={...memo('original'),title:'기존 제목'},remote={...original,title:'다른 기기 수정'};
  const payload={draft:{appId:'world',title:'중단된 수정'},editing:original,parkedDraft:{appId:'care',title:'먼저 쓰던 새 메모'}};
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:{...state(),notes:[remote]}}]]),recoveryHost:{draftRecoveryStatus:async()=>({ok:true,enabled:true,available:true}),draftRecoveryLoad:async()=>({ok:true,draft:payload}),draftRecoverySave:async()=>({ok:true}),draftRecoveryClear:async()=>({ok:true})}});await f.connect();await settle();clickCloud(f,'recover-draft');
  assert.equal(f.content.querySelector('[data-note-submit]').textContent,'계정에 메모 남기기');f.submit();await until(()=>!f.view.hasPending()&&f.records.get('A').state.notes.length===2);
  assert.deepEqual(f.records.get('A').state.notes.find(row=>row.id==='original'),remote);assert.equal(f.content.querySelector('[name=title]').value,'먼저 쓰던 새 메모');assert.equal(f.content.querySelector('[name=appId]').value,'care');
});

test('discard clears the visible input immediately and resolves only after encrypted removal',async t=>{
  const gate=deferred();let clearing=false,settled=false;
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]]),recoveryHost:{draftRecoveryStatus:async()=>({ok:true,enabled:true,available:true}),draftRecoveryLoad:async()=>({ok:true,draft:null}),draftRecoverySave:async()=>({ok:true}),draftRecoveryClear:async()=>{clearing=true;await gate.promise;return {ok:true};}}});await f.connect();f.input('버릴 입력');
  const discarded=f.view.discardDraft().then(()=>{settled=true;});assert.equal(f.view.hasUnsavedDraft(),false);assert.equal(f.content.querySelector('[name=title]').value,'');await settle();assert.equal(clearing,true);assert.equal(settled,false);gate.resolve();await discarded;assert.equal(settled,true);
});

test('failed encrypted removal restores the input exit guard and offers deletion retry',async t=>{
  let fail=true;
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]]),recoveryHost:{draftRecoveryStatus:async()=>({ok:true,enabled:true,available:true}),draftRecoveryLoad:async()=>({ok:true,draft:null}),draftRecoverySave:async()=>({ok:true}),draftRecoveryClear:async()=>({ok:!fail})}});await f.connect();f.input('삭제에 실패하면 남겨 둘 입력');
  assert.equal(await f.view.discardDraft(),false);assert.equal(f.view.hasUnsavedDraft(),true);assert.equal(f.content.querySelector('[name=title]').value,'삭제에 실패하면 남겨 둘 입력');assert.equal(f.content.querySelector('[data-cloud="discard-recovery"]').hidden,false);
  fail=false;assert.equal(await f.view.discardDraft(),true);assert.equal(f.view.hasUnsavedDraft(),false);assert.equal(f.content.querySelector('[name=title]').value,'');
});

test('connecting reads only; explicit enable does not implicitly import existing device selections', async t => {
  const f = await fixture(t,{ device:{ favorites:['world'], recent:[{id:'world',at:1,mode:'client'}] } });
  assert.equal(f.calls.length,0); await f.connect();
  assert.equal(f.calls.length,1); assert.equal(f.calls[0].operation,'platformLoad'); assert.equal(f.writes().length,0); assert.equal(f.view.projection(),null);
  f.cloud('enable'); await until(() => f.writes().length === 1 && !f.view.hasPending());
  assert.deepEqual(f.records.get('A').state, state()); assert.deepEqual(f.view.projection(),state());
});

test('account favorites group teaching into Messenger while teacher-only still opens its own classroom target',async t=>{
  const doc={...state(['teacher','messenger']),recent:[{id:'teacher',at:20,mode:'client'},{id:'messenger',at:10,mode:'client'}]};
  const both=await fixture(t,{records:new Map([['A',{revision:1,state:doc}]]),getAppIds:()=>['messenger','teacher']});await both.connect();
  assert.equal(both.content.querySelectorAll('[data-cloud="favorite"]').length,1);assert.equal(both.content.querySelector('[data-cloud="favorite"][data-id="teacher"]'),null);
  both.root.querySelector('[data-resume]').onclick();assert.deepEqual(both.opened,['teacher']);assert.equal(both.writes().length,0);
  const teacher=await fixture(t,{records:new Map([['A',{revision:1,state:state(['teacher'])}]]),getAppIds:()=>['teacher']});await teacher.connect();
  assert.equal(teacher.content.querySelectorAll('[data-cloud="favorite"]').length,1);assert.match(teacher.content.querySelector('[data-cloud="favorite"][data-id="teacher"]').textContent,/워크스페이스 · 내 수업/);assert.equal(teacher.content.querySelector('[data-cloud="favorite"][data-id="messenger"]'),null);
});

test('merged account choices show one PULSE shortcut and preserve previous Partners notes on open and edit',async t=>{
  const legacy={...memo('legacy'),appId:'partners',title:'파트너 작업 이어가기'},record={...state(['partners','pulse']),recent:[{id:'partners',at:20,mode:'web'},{id:'pulse',at:10,mode:'client'}],notes:[legacy]},f=await fixture(t,{records:new Map([['A',{revision:4,state:record}]])});await f.connect();
  assert.equal(f.writes().length,0);assert.deepEqual(f.records.get('A').state,record);
  assert.equal(f.content.querySelectorAll('[data-cloud="favorite"]').length,8);assert.equal(f.content.querySelector('[data-cloud="favorite"][data-id="partners"]'),null);
  assert.equal(f.content.querySelector('[data-cloud="favorite"][data-id="pulse"]').getAttribute('aria-pressed'),'true');
  assert.equal(f.content.querySelectorAll('[name=appId] option').length,8);assert.equal(f.content.querySelector('option[value="partners"]'),null);
  assert.match(f.content.querySelector('[data-note-id="legacy"]').textContent,/PULSE · 이전 Partners 기록/);
  assert.deepEqual(f.view.projection().favorites,['pulse']);assert.deepEqual(f.view.projection().recent,[{id:'pulse',at:20,mode:'web'}]);assert.deepEqual(f.view.projection().notes,[legacy]);
  f.root.querySelector('[data-resume]').onclick();clickCloud(f,'open','partners');assert.deepEqual(f.opened,['pulse','pulse']);assert.equal(f.writes().length,0);
  clickCloud(f,'edit-note','legacy');assert.equal(f.content.querySelector('[name=appId]').value,'partners');assert.equal(f.content.querySelectorAll('[name=appId] option').length,9);
  f.input('작품 검토 이어가기');f.submit();await until(()=>!f.view.hasPending()&&f.records.get('A').state.notes[0].title==='작품 검토 이어가기');
  assert.deepEqual(f.records.get('A').state.notes,[{...legacy,title:'작품 검토 이어가기'}]);assert.deepEqual(f.records.get('A').state.favorites,record.favorites);assert.deepEqual(f.records.get('A').state.recent,record.recent);
  assert.equal(f.content.querySelectorAll('[name=appId] option').length,8);assert.equal(f.content.querySelector('option[value="partners"]'),null);
});

test('the displayed PULSE favorite explicitly clears both previous catalog selections without deleting legacy notes',async t=>{
  const legacy={...memo('legacy'),appId:'partners'},record={...state(['partners','pulse','world']),notes:[legacy]},f=await fixture(t,{records:new Map([['A',{revision:1,state:record}]])});await f.connect();
  clickCloud(f,'favorite','pulse');await until(()=>f.writes().length===1&&!f.view.hasPending());
  assert.deepEqual(f.records.get('A').state.favorites,['world']);assert.deepEqual(f.records.get('A').state.notes,[legacy]);
  assert.equal(f.content.querySelector('[data-cloud="favorite"][data-id="pulse"]').getAttribute('aria-pressed'),'false');
});

test('unfinished notes lead the list and completed notes expand without saving or replacing the editor', async t => {
  const record={...state(),notes:[memo('done',true),memo('next')]},f=await fixture(t,{records:new Map([['A',{revision:1,state:record}]])});await f.connect();
  const form=f.content.querySelector('[data-note-form]'),input=f.content.querySelector('[name=title]');f.input('새 초안');
  assert.equal(f.content.querySelector('article').dataset.noteId,'next');assert.equal(f.content.querySelector('[data-completed-notes]').hidden,true);
  clickCloud(f,'show-completed');assert.equal(f.content.querySelector('[data-completed-notes]').hidden,false);assert.equal(f.content.querySelector('[data-cloud="show-completed"]').getAttribute('aria-expanded'),'true');
  f.cloud('favorite');await until(()=>!f.view.hasPending());assert.equal(f.content.querySelector('[data-completed-notes]').hidden,false);
  assert.equal(f.content.querySelector('[data-note-form]'),form);assert.equal(f.content.querySelector('[name=title]'),input);assert.equal(input.value,'새 초안');
  assert.equal(f.writes().length,1);clickCloud(f,'show-completed');assert.equal(f.content.querySelector('[data-completed-notes]').hidden,true);assert.equal(f.writes().length,1);
});

test('editing preserves the original note identity and restores a parked new draft after save or cancel', async t => {
  const row=memo('keep',true),f=await fixture(t,{records:new Map([['A',{revision:1,state:{...state(),notes:[row]}}]])});await f.connect();
  f.input('먼저 작성하던 새 메모');const input=f.content.querySelector('[name=title]');clickCloud(f,'edit-note','keep');
  assert.equal(input.value,row.title);assert.equal(f.content.querySelector('[data-note-submit]').textContent,'수정 저장');assert.equal(f.view.hasUnsavedDraft(),true);
  f.input('고친 제목');f.content.querySelector('[name=appId]').value='rehearsal';f.submit();await until(()=>f.records.get('A').state.notes[0].title==='고친 제목'&&!f.view.hasPending());
  assert.deepEqual(f.records.get('A').state.notes,[{...row,title:'고친 제목',appId:'rehearsal'}]);assert.equal(f.content.querySelector('[name=title]'),input);assert.equal(input.value,'먼저 작성하던 새 메모');
  clickCloud(f,'edit-note','keep');f.input('취소할 수정');clickCloud(f,'cancel-edit');assert.equal(input.value,'먼저 작성하던 새 메모');assert.equal(f.writes().length,1);assert.equal(f.view.hasUnsavedDraft(),true);
});

test('consecutive deletions undo exact rows in reverse order, including after a failed save', async t => {
  const notes=[memo('a'),memo('b',true),memo('c')],f=await fixture(t,{records:new Map([['A',{revision:1,state:{...state(),notes}}]])});await f.connect();f.setFail(true);
  clickCloud(f,'remove-note','b');await until(()=>f.status()==='연결을 기다리고 있어요');
  assert.deepEqual(f.view.projection().notes.map(row=>row.id),['a','c']);assert.equal(f.content.querySelector('[data-note-undo]').hidden,false);
  clickCloud(f,'remove-note','a');assert.deepEqual(f.view.projection().notes.map(row=>row.id),['c']);assert.match(f.content.querySelector('[data-note-undo-message]').textContent,/2개/);
  clickCloud(f,'undo-note');assert.deepEqual(f.view.projection().notes.map(row=>row.id),['a','c']);
  f.setFail(false);clickCloud(f,'undo-note');await until(()=>f.records.get('A').state.notes.length===3&&!f.view.hasPending());
  assert.deepEqual(f.records.get('A').state.notes,notes);assert.equal(f.content.querySelector('[data-note-undo]').hidden,true);assert.equal(f.content.querySelector('[data-completed-notes]').hidden,false);
});

test('account changes clear editing, parked drafts and deletion undo without writing them to the next account', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:{...state(),notes:[memo('a'),memo('b')]}}],['B',{revision:1,state:{...state(),notes:[memo('other')]}}]])});await f.connect();
  clickCloud(f,'remove-note','a');await until(()=>!f.view.hasPending());f.input('A의 새 초안');clickCloud(f,'edit-note','b');f.input('A의 수정 초안');
  await f.auth(signed('B',2));assert.equal(f.content.querySelector('[data-note-undo]').hidden,true);assert.equal(f.content.querySelector('[name=title]').value,'');assert.equal(f.content.querySelector('[data-cloud="cancel-edit"]').hidden,true);assert.equal(f.view.hasUnsavedDraft(),false);
  clickCloud(f,'undo-note');assert.equal(f.calls.filter(row=>row.owner==='B'&&row.operation==='platformSave').length,0);assert.deepEqual(f.view.projection().notes,[memo('other')]);
});

test('full storage explains the limit and preserves new input while still allowing edits and delete undo', async t => {
  const notes=Array.from({length:60},(_,i)=>memo('n'+i,true)),f=await fixture(t,{records:new Map([['A',{revision:1,state:{...state(),notes}}]])});await f.connect();f.input('한도에서도 유지할 초안');
  assert.match(f.content.querySelector('[data-note-capacity]').textContent,/60\/60개.*가득/);assert.equal(f.content.querySelector('[data-note-submit]').disabled,true);
  f.submit();await settle();assert.match(f.content.querySelector('[data-cloud-message]').textContent,/최대 60개/);assert.equal(f.writes().length,0);assert.equal(f.content.querySelector('[name=title]').value,'한도에서도 유지할 초안');
  clickCloud(f,'edit-note','n0');assert.equal(f.content.querySelector('[data-note-submit]').disabled,false);f.input('한도에서 수정');f.submit();await until(()=>f.records.get('A').state.notes[0].title==='한도에서 수정'&&!f.view.hasPending());assert.equal(f.content.querySelector('[name=title]').value,'한도에서도 유지할 초안');
  clickCloud(f,'remove-note','n1');assert.equal(f.content.querySelector('[data-note-submit]').disabled,false);clickCloud(f,'undo-note');await until(()=>!f.view.hasPending());assert.equal(f.view.projection().notes.length,60);assert.equal(f.content.querySelector('[data-note-submit]').disabled,true);
});

test('explicitly loading a changed account document ends undo and edit state after the draft confirmation', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:{...state(),notes:[memo('a'),memo('b')]}}]])});await f.connect();
  clickCloud(f,'remove-note','a');await until(()=>!f.view.hasPending());f.input('새 입력');clickCloud(f,'edit-note','b');f.input('수정 입력');const saved=f.records.get('A');f.records.set('A',{revision:saved.revision+1,state:{...saved.state,notes:[memo('remote')]}});await f.click('refresh');
  assert.ok(f.confirms.some(text=>text.includes('작성 중인')));assert.equal(f.content.querySelector('[data-note-undo]').hidden,true);assert.equal(f.content.querySelector('[name=title]').value,'');assert.equal(f.content.querySelector('[data-cloud="cancel-edit"]').hidden,true);assert.equal(f.writes().length,1);
});

test('one connection click waits for startup and duplicate clicks do not mount or request twice', async t => {
  const gate=deferred();let preparations=0;
  const f=await fixture(t,{ensureReady:()=>{preparations++;return gate.promise;}}),button=f.root.querySelector('[data-connect-button]');
  const first=button.onclick();await button.onclick();await settle();
  assert.equal(button.disabled,true);assert.equal(button.textContent,'연결 준비 중…');assert.equal(preparations,1);assert.equal(f.calls.length,0);
  gate.resolve();await first;await settle();
  assert.equal(f.calls.filter(row=>row.operation==='platformLoad').length,1);assert.equal(f.root.querySelector('[data-connect]').hidden,true);assert.equal(f.writes().length,0);
});

test('failed startup can retry and a disposed pending connection never starts an account request', async t => {
  let failed=true;const f=await fixture(t,{ensureReady:async()=>{if(failed)throw Error('설정을 불러오지 못했어요.');}});
  await f.connect();assert.equal(f.root.querySelector('[data-connect-button]').disabled,false);assert.equal(f.calls.length,0);assert.match(f.root.querySelector('[data-library-detail]').textContent,/불러오지 못/);
  failed=false;await f.connect();assert.equal(f.calls.length,1);
  const gate=deferred(),other=await fixture(t,{ensureReady:()=>gate.promise}),pending=other.root.querySelector('[data-connect-button]').onclick();other.view.dispose();gate.resolve();await pending;assert.equal(other.calls.length,0);
});

test('leaving during startup defers the first connection until the page actually returns', async t => {
  const gate=deferred(),f=await fixture(t,{ensureReady:()=>gate.promise}),connecting=f.root.querySelector('[data-connect-button]').onclick();
  f.lifecycle.get('pagehide')();gate.resolve();await connecting;await settle();
  assert.equal(f.calls.length,0);assert.equal(f.view.projection(),null);assert.equal(f.content.hidden,true);
  f.lifecycle.get('pageshow')();await settle();assert.equal(f.calls.filter(row=>row.operation==='platformLoad').length,1);assert.equal(f.writes().length,0);
});

test('public connection and a concurrent button click share one verified library read and subscription', async t => {
  const gate=deferred();let preparations=0,subscriptions=0,identityReads=0;
  const f=await fixture(t,{records:new Map([['A',{revision:3,state:state(['care'])}]]),ensureReady:()=>{preparations++;return gate.promise;}});
  const subscribe=f.host.onAuthChanged,identity=f.host.authStatus;
  f.host.onAuthChanged=fn=>{subscriptions++;return subscribe(fn);};f.host.authStatus=()=>{identityReads++;return identity();};
  const first=f.view.connect();await f.view.connect();await f.root.querySelector('[data-connect-button]').onclick();await settle();
  assert.equal(preparations,1);assert.equal(f.calls.length,0);
  gate.resolve();await first;await settle();await f.view.connect();await settle();
  assert.equal(subscriptions,1);assert.equal(identityReads,1);assert.deepEqual(f.calls.map(row=>[row.operation,row.owner]),[['platformLoad','A']]);
  assert.deepEqual(f.view.projection().favorites,['care']);assert.equal(f.writes().length,0);assert.equal(f.confirms.length,0);
});

test('public reconnect after remount reads the account and preserves earlier unsent records without submitting them', async t => {
  const storage=memoryStorage(),records=new Map([['A',{revision:2,state:state(['care'])}]]),first=await fixture(t,{storage,records});
  await first.view.connect();await settle();first.setFail(true);await first.view.dispatch({type:'favorite',id:'world'});
  await until(()=>first.writes().length===1);await settle();assert.equal(first.view.hasPending(),true);first.view.dispose();
  const preserved=new Map(storage.data);assert.ok(preserved.size>0);
  const second=await fixture(t,{storage,records});await second.view.connect();await settle();
  assert.deepEqual(second.calls.map(row=>[row.operation,row.owner]),[['platformLoad','A']]);assert.deepEqual(second.view.projection().favorites,['care']);
  assert.equal(second.view.hasPending(),false);assert.equal(second.writes().length,0);assert.equal(second.confirms.length,0);
  assert.equal(second.mount.querySelector('[data-notebook-drafts]').hidden,false);
  for(const [key,raw] of preserved)assert.equal(storage.getItem(key),raw);
  assert.deepEqual(records.get('A'),{revision:2,state:state(['care'])});
});

test('public connection neither logs guests in nor enables account storage for absent or disabled records', async t => {
  const guest=await fixture(t,{initial:{configured:true,status:'signed-out',signedIn:false,sessionGeneration:1}});let oauth=0,logout=0;
  guest.host.authSignIn=async()=>{oauth++;};guest.host.authSignOut=async()=>{logout++;};
  await guest.view.connect();await settle();await guest.view.connect();
  assert.equal(guest.calls.length,0);assert.equal(oauth,0);assert.equal(logout,0);assert.equal(guest.view.connected(),false);assert.equal(guest.view.projection(),null);
  for(const document of [null,emptyPlatformLibrary()]){
    const records=new Map([['A',{revision:4,state:document}]]),f=await fixture(t,{records,device:{favorites:['world'],recent:[{id:'world',at:1,mode:'client'}]}});
    await f.view.connect();await settle();await f.view.connect();
    assert.deepEqual(f.calls.map(row=>row.operation),['platformLoad']);assert.equal(f.view.connected(),false);assert.equal(f.view.projection(),null);
    assert.equal(f.writes().length,0);assert.equal(f.confirms.length,0);assert.deepEqual(records.get('A'),{revision:4,state:document});
    assert.ok(f.content.querySelector('[data-cloud="enable"]'));
  }
});

test('public connection waiting for readiness uses the latest owner and cannot read the account after logout', async t => {
  const records=new Map([['A',{revision:1,state:state(['world'])}],['B',{revision:1,state:state(['care'])}]]);
  const changedGate=deferred(),changed=await fixture(t,{records,ensureReady:()=>changedGate.promise}),first=changed.view.connect();
  await changed.auth(signed('B',2));changedGate.resolve();await first;await settle();
  assert.deepEqual(changed.calls.map(row=>[row.operation,row.owner]),[['platformLoad','B']]);assert.deepEqual(changed.view.projection().favorites,['care']);assert.equal(changed.writes().length,0);
  const logoutGate=deferred(),out=await fixture(t,{records,ensureReady:()=>logoutGate.promise}),pending=out.view.connect();let oauth=0;
  out.host.authSignIn=async()=>{oauth++;};await out.auth({configured:true,status:'signed-out',signedIn:false,sessionGeneration:2});
  logoutGate.resolve();await pending;await settle();
  assert.equal(out.calls.length,0);assert.equal(out.view.connected(),false);assert.equal(out.view.projection(),null);assert.equal(oauth,0);assert.equal(out.confirms.length,0);
});

test('repeated public connection after same-account verification preserves the live unsaved note without a fresh document read', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state(['world'])}]])});await f.view.connect();await settle();
  f.input('자동 연결 뒤에도 이어 쓸 입력');const field=f.content.querySelector('[name=title]');
  await f.auth({configured:true,status:'error',signedIn:false,sessionGeneration:2,error:{code:'AUTH_SERVER_UNAVAILABLE',retryable:true}});
  assert.equal(f.content.hidden,true);assert.equal(f.view.hasUnsavedDraft(),true);await f.view.connect();
  f.records.set('A',{revision:2,state:state(['care'])});await f.auth(signed('A',3));await f.view.connect();await settle();
  assert.equal(f.content.hidden,false);assert.equal(f.content.querySelector('[name=title]'),field);assert.equal(field.value,'자동 연결 뒤에도 이어 쓸 입력');
  assert.equal(f.view.hasUnsavedDraft(),true);assert.deepEqual(f.view.projection().favorites,['world']);
  assert.deepEqual(f.calls.map(row=>row.operation),['platformLoad']);assert.equal(f.writes().length,0);assert.equal(f.confirms.length,0);
});

test('public connection retries failed readiness and disposal fences a still-pending automatic connection', async t => {
  let failed=true;const f=await fixture(t,{ensureReady:async()=>{if(failed)throw Error('합성 시작 준비 실패');}});
  await f.view.connect();await settle();assert.equal(f.calls.length,0);assert.match(f.root.querySelector('[data-library-detail]').textContent,/합성 시작 준비 실패/);
  failed=false;await f.view.connect();await settle();assert.deepEqual(f.calls.map(row=>row.operation),['platformLoad']);assert.equal(f.writes().length,0);
  const gate=deferred(),disposed=await fixture(t,{ensureReady:()=>gate.promise}),pending=disposed.view.connect();
  disposed.view.dispose();gate.resolve();await pending;await disposed.view.connect();await settle();
  assert.equal(disposed.calls.length,0);assert.equal(disposed.view.projection(),null);
});

test('ready waits for the remote library before applying a launcher favorite and resolves every waiter', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:7,state:state(['care'])}]])});assert.equal(await f.view.ready(),true);
  const gate=f.hold('platformLoad');let settled=0;const connecting=f.view.connect();
  const first=f.view.ready().then(value=>{settled++;return value;}),second=f.view.ready().then(value=>{settled++;return value;});
  await connecting;await settle();assert.equal(settled,0);assert.equal(f.calls.length,1);assert.equal(f.writes().length,0);
  gate.resolve();assert.deepEqual(await Promise.all([first,second]),[true,true]);
  assert.deepEqual(f.view.projection().favorites,['care']);await f.view.dispatch({type:'favorite',id:'world'});await until(()=>f.writes().length===1&&!f.view.hasPending());
  assert.deepEqual(f.records.get('A').state.favorites,['care','world']);assert.equal(f.writes()[0].params.expected_revision,7);
});

test('ready distinguishes a successfully read absent or disabled library from an unavailable account document', async t => {
  for(const document of [null,emptyPlatformLibrary()]){
    const f=await fixture(t,{records:new Map([['A',{revision:3,state:document}]]),device:{favorites:['world']}}),gate=f.hold('platformLoad');
    await f.view.connect();let settled=false;const pending=f.view.ready().then(value=>{settled=true;return value;});await settle();assert.equal(settled,false);
    gate.resolve();assert.equal(await pending,true);assert.equal(f.view.connected(),false);assert.equal(f.view.projection(),null);
    assert.equal(f.writes().length,0);assert.deepEqual(f.records.get('A'),{revision:3,state:document});
  }
});

test('ready rejects a failed first account read instead of treating the initial device candidate as a loaded library', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:2,state:state(['care'])}]]),device:{favorites:['world']}}),gate=f.hold('platformLoad');
  await f.view.connect();const pending=f.view.ready();gate.reject(Object.assign(Error('합성 계정 읽기 실패'),{code:'NETWORK'}));
  assert.equal(await pending,false);assert.equal(await f.view.ready(),false);assert.equal(f.writes().length,0);assert.deepEqual(f.records.get('A').state.favorites,['care']);
  const retryGate=f.hold('platformLoad');await f.click('retry');let settled=false;const retry=f.view.ready().then(value=>{settled=true;return value;});
  await settle();assert.equal(settled,false);retryGate.resolve();assert.equal(await retry,true);assert.deepEqual(f.view.projection().favorites,['care']);assert.equal(f.writes().length,0);
});

test('ready preserves editing and the outbox after a verified library save goes offline', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:5,state:state(['care'])}]])});await f.view.connect();await settle();assert.equal(await f.view.ready(),true);
  f.input('오프라인에도 남겨 둘 입력');const input=f.content.querySelector('[name=title]');f.setFail(true);
  await f.view.dispatch({type:'favorite',id:'world'});await until(()=>f.writes().length===1);await settle();assert.equal(f.view.hasPending(),true);
  assert.equal(await f.view.ready(),true);await f.view.dispatch({type:'favorite',id:'rehearsal'});await until(()=>f.writes().length===2);await settle();
  assert.equal(await f.view.ready(),true);assert.equal(f.view.hasPending(),true);assert.deepEqual(f.view.projection().favorites,['care','world','rehearsal']);
  assert.equal(f.content.querySelector('[name=title]'),input);assert.equal(input.value,'오프라인에도 남겨 둘 입력');assert.deepEqual(f.records.get('A'),{revision:5,state:state(['care'])});
  assert.ok(f.storage.data.size>0);assert.ok([...f.storage.data.values()].some(raw=>raw.includes('rehearsal')));
});

test('ready remains pending for the new owner when an earlier account read finishes late', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state(['world'])}],['B',{revision:4,state:state(['care'])}]])}),oldRead=f.hold('platformLoad');
  await f.view.connect();let settled=false;const pending=f.view.ready().then(value=>{settled=true;return value;});
  const newRead=f.hold('platformLoad');await f.auth(signed('B',2));oldRead.resolve();await settle();
  assert.equal(settled,false);assert.equal(f.view.projection(),null);newRead.resolve();assert.equal(await pending,true);
  assert.deepEqual(f.view.projection().favorites,['care']);assert.deepEqual(f.calls.map(row=>row.owner),['A','B']);assert.equal(f.writes().length,0);
});

test('logout releases ready waiters to the guest path without accepting a late account read', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state(['care'])}]])}),gate=f.hold('platformLoad');
  await f.view.connect();const pending=f.view.ready();await f.auth({configured:true,status:'signed-out',signedIn:false,sessionGeneration:2});
  assert.equal(await pending,true);assert.equal(f.view.connected(),false);assert.equal(f.view.projection(),null);
  gate.resolve();await settle();assert.equal(await f.view.ready(),true);assert.equal(f.view.projection(),null);assert.equal(f.writes().length,0);
});

test('suspension and disposal release ready waiters with false even while the account read is still pending', async t => {
  for(const action of ['suspend','dispose']){
    const f=await fixture(t,{records:new Map([['A',{revision:1,state:state(['care'])}]])}),gate=f.hold('platformLoad');
    await f.view.connect();const first=f.view.ready(),second=f.view.ready();
    if(action==='suspend')f.lifecycle.get('pagehide')();else f.view.dispose();
    assert.deepEqual(await Promise.all([first,second]),[false,false]);assert.equal(await f.view.ready(),false);
    gate.resolve();await settle();assert.equal(await f.view.ready(),false);assert.equal(f.view.projection(),null);assert.equal(f.writes().length,0);
  }
});

test('the compact library chooses an unfinished note and keeps editing controls collapsed until opened', async t => {
  const record=state();record.notes=[{id:'done',appId:'world',title:'이미 끝낸 메모',done:true,createdAt:2},{id:'next',appId:'rehearsal',title:'다음 대화 이어쓰기',done:false,createdAt:1}];
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:record}]])});await f.connect();
  const panel=f.root.querySelector('[data-library-panel]'),toggle=f.root.querySelector('[data-panel-toggle]');
  assert.equal(panel.hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(f.root.querySelector('[data-library-title]').textContent,'다음 대화 이어쓰기');
  f.root.querySelector('[data-resume]').onclick();assert.deepEqual(f.opened,['rehearsal']);
  toggle.onclick();assert.equal(panel.hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');f.input('접어 두어도 남길 초안');toggle.onclick();
  assert.equal(panel.hidden,true);assert.equal(f.view.hasUnsavedDraft(),true);assert.equal(f.root.querySelector('[data-resume]').textContent,'계속 작성');
  assert.equal(f.root.querySelector('[data-library-status]').textContent,'메모는 아직 계정에 저장하지 않았어요');
  const field=f.content.querySelector('[name=title]');let focused=false;field.focus=()=>{focused=true;};f.root.querySelector('[data-resume]').onclick();
  assert.equal(panel.hidden,false);assert.equal(focused,true);assert.equal(field.value,'접어 두어도 남길 초안');assert.deepEqual(f.opened,['rehearsal']);assert.equal(f.writes().length,0);
  f.input('');assert.equal(f.root.querySelector('[data-library-status]').textContent,'계정에 저장했어요');
});

test('an unsubmitted draft does not replace saving or failure status, and stays unsaved after other changes finish', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]])});await f.connect();
  const summaryStatus=()=>f.root.querySelector('[data-library-status]').textContent;
  f.input('아직 제출하지 않은 초안');assert.equal(summaryStatus(),'메모는 아직 계정에 저장하지 않았어요');
  const gate=f.hold('platformSave');t.after(()=>gate.resolve());f.setFail(true);await f.view.dispatch({type:'favorite',id:'world'});
  assert.equal(summaryStatus(),'계정에 저장하고 있어요');await until(()=>f.writes().length===1);assert.equal(summaryStatus(),'계정에 저장하고 있어요');
  gate.resolve();await until(()=>f.status()==='연결을 기다리고 있어요');await settle();
  assert.equal(summaryStatus(),'연결을 기다리고 있어요');assert.equal(f.view.hasUnsavedDraft(),true);
  f.setFail(false);await f.click('retry');await until(()=>!f.view.hasPending());await settle();
  assert.equal(summaryStatus(),'메모는 아직 계정에 저장하지 않았어요');assert.equal(f.content.querySelector('[name=title]').value,'아직 제출하지 않은 초안');
  assert.equal(f.records.get('A').state.notes.length,0);assert.deepEqual(f.records.get('A').state.favorites,['world']);
});

test('compact note and resume action are concealed immediately on pagehide and account uncertainty', async t => {
  const record=state();record.notes=[{id:'private',appId:'world',title:'A의 비공개 할 일',done:false,createdAt:1}];
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:record}],['B',{revision:1,state:state()}]])});await f.connect();
  f.lifecycle.get('pagehide')();assert.doesNotMatch(f.root.querySelector('[data-library-title]').textContent,/비공개/);assert.equal(f.root.querySelector('[data-resume]').hidden,true);
  f.lifecycle.get('pageshow')();await settle();assert.equal(f.root.querySelector('[data-library-title]').textContent,'A의 비공개 할 일');
  await f.auth({configured:true,status:'error',signedIn:false,sessionGeneration:2,error:{retryable:true}});assert.doesNotMatch(f.root.querySelector('[data-library-title]').textContent,/비공개/);assert.equal(f.root.querySelector('[data-resume]').hidden,true);
  await f.auth(signed('B',3));assert.doesNotMatch(f.root.querySelector('[data-library-title]').textContent,/비공개/);assert.equal(f.root.querySelector('[data-resume]').hidden,true);
});

test('background save transitions retain the live editor and unsubmitted text', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]])});await f.connect();
  const field=f.content.querySelector('[name=title]'),select=f.content.querySelector('[name=appId]'),form=f.content.querySelector('[data-note-form]');
  const gate=f.hold('platformSave');t.after(()=>gate.resolve());
  await f.view.dispatch({type:'favorite',id:'world'});f.input('저장 응답 중에도 이어 쓰는 한글');select.value='rehearsal';
  await until(()=>f.writes().length===1);await settle();
  assert.equal(f.content.querySelector('[name=title]'),field);assert.equal(f.content.querySelector('[name=appId]'),select);assert.equal(f.content.querySelector('[data-note-form]'),form);
  gate.resolve();await until(()=>!f.view.hasPending());await settle();
  assert.equal(f.content.querySelector('[name=title]'),field);assert.equal(field.value,'저장 응답 중에도 이어 쓰는 한글');assert.equal(select.value,'rehearsal');
  assert.equal(f.content.querySelector('[data-cloud="favorite"]').getAttribute('aria-pressed'),'true');assert.equal(f.records.get('A').state.notes.length,0);
  assert.equal(f.view.hasUnsavedDraft(),true);
});

test('failure and retry keep editor nodes while note changes still update the saved list', async t => {
  const record=state();record.notes=[{id:'existing',appId:'world',title:'이미 남긴 메모',done:false,createdAt:1}];
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:record}]])});await f.connect();
  const field=f.content.querySelector('[name=title]');f.input('다른 메모를 정리하면서 쓰는 초안');f.setFail(true);
  await f.view.dispatch({type:'toggle-note',noteId:'existing'});await until(()=>f.status()==='연결을 기다리고 있어요');await settle();
  assert.equal(f.content.querySelector('[name=title]'),field);assert.equal(f.content.querySelector('[data-cloud="toggle-note"]').getAttribute('aria-pressed'),'true');
  f.setFail(false);await f.click('retry');await until(()=>!f.view.hasPending());await settle();
  assert.equal(f.content.querySelector('[name=title]'),field);assert.equal(field.value,'다른 메모를 정리하면서 쓰는 초안');assert.equal(f.records.get('A').state.notes[0].done,true);
});

test('web account navigation has an accurate label while native keeps its real logout label', async t => {
  const web=await fixture(t,{native:false});await web.connect();assert.equal(web.button('signout').textContent,'계정 관리로 이동');
  const pc=await fixture(t);await pc.connect();assert.equal(pc.button('signout').textContent,'로그아웃');
});

test('explicit device import replaces only after confirmation and crosses the real notebook adapter and CAS writer', async t => {
  const f = await fixture(t,{ records:new Map([['A',{revision:2,state:state(['care'])}]]), device:{ favorites:['rehearsal'], recent:[{id:'rehearsal',at:12,mode:'client'}] } });
  await f.connect(); assert.deepEqual(f.view.projection().favorites,['care']); assert.equal(f.writes().length,0);
  await f.click('import'); await until(() => f.writes().length === 1 && !f.view.hasPending());
  assert.equal(f.confirms.length,1); assert.equal(f.writes()[0].params.expected_revision,2);
  assert.deepEqual(f.records.get('A').state.favorites,['rehearsal']); assert.equal(f.records.get('A').state.recent[0].at,12);
});

test('refresh re-enables the rendered controls after hydration and retains the new remote document', async t => {
  const f = await fixture(t,{ records:new Map([['A',{revision:1,state:state(['world'])}]]) });await f.connect();
  f.records.set('A',{revision:2,state:state(['care'])});await f.click('refresh');
  assert.equal(f.content.querySelector('[name=title]').disabled,false);
  assert.equal(f.content.querySelector('[data-cloud="favorite"]').disabled,false);
  assert.deepEqual(f.view.projection().favorites,['care']);
  f.input('불러온 뒤 새 메모');f.submit();await until(()=>f.writes().length===1&&!f.view.hasPending());
  assert.equal(f.records.get('A').state.notes[0].title,'불러온 뒤 새 메모');
});

test('rapid favorites and recent-setting changes keep their latest combined document without a false failure notice', async t => {
  const f = await fixture(t,{ records:new Map([['A',{revision:1,state:state()}]]) }); await f.connect();
  const changes = [f.view.dispatch({type:'favorite',id:'world'}), f.view.dispatch({type:'favorite',id:'rehearsal'}), f.view.dispatch({type:'launch',id:'world',mode:'client'}), f.view.dispatch({type:'remember',value:false})];
  await Promise.allSettled(changes); await until(() => f.writes().length > 0 && !f.view.hasPending());
  assert.deepEqual(f.records.get('A').state.favorites,['world','rehearsal']); assert.deepEqual(f.records.get('A').state.recent,[]); assert.equal(f.records.get('A').state.rememberRecent,false);
  assert.doesNotMatch(f.content.textContent,/변경을 보관하지 못/);
});

test('switching account clears the old unsaved note instead of recapturing it into the next account form', async t => {
  const f = await fixture(t,{ records:new Map([['A',{revision:1,state:state(['world'])}],['B',{revision:1,state:state(['care'])}]]) }); await f.connect();
  f.input('계정 A에서 아직 제출하지 않은 개인 메모'); await f.auth(signed('B',2));
  assert.deepEqual(f.view.projection().favorites,['care']); assert.equal(f.content.querySelector('[name=title]').value,''); assert.equal(f.writes().length,0);
  f.input('계정 B의 새 메모'); f.submit(); await until(() => f.writes().length === 1 && !f.view.hasPending());
  assert.equal(f.records.get('B').state.notes[0].title,'계정 B의 새 메모'); assert.equal(f.records.get('A').state.notes.length,0);
});

test('an earlier save response cannot reset a new account draft or persist into its document', async t => {
  const f = await fixture(t,{ records:new Map([['A',{revision:1,state:state()}],['B',{revision:1,state:state(['care'])}]]) }); await f.connect();
  const gate = f.hold('platformSave'); f.input('A가 명시 저장한 메모'); f.submit(); await until(() => f.writes().length === 1);
  await f.auth(signed('B',2)); f.input('B가 계속 적는 미저장 메모'); gate.resolve(); await settle();
  assert.equal(f.content.querySelector('[name=title]').value,'B가 계속 적는 미저장 메모'); assert.equal(f.records.get('B').state.notes.length,0); assert.equal(f.records.get('A').state.notes[0].title,'A가 명시 저장한 메모');
  assert.deepEqual(f.view.projection().favorites,['care']); assert.doesNotMatch(f.content.textContent,/변경을 보관하지 못/);
});

test('authentication uncertainty hides the note, blocks new writes and restores the same-account draft after verification', async t => {
  const f = await fixture(t,{ records:new Map([['A',{revision:1,state:state()}]]) }); await f.connect(); f.input('인증 확인 중 보존할 메모');
  await f.auth({configured:true,status:'error',signedIn:false,sessionGeneration:2,error:{message:'합성 인증 실패',retryable:true}});
  assert.equal(f.content.hidden,true); assert.equal(f.view.projection(),null); await assert.rejects(f.view.dispatch({type:'favorite',id:'world'})); assert.equal(f.writes().length,0);
  await f.auth(signed('A',3)); assert.equal(f.content.hidden,false); assert.equal(f.content.querySelector('[name=title]').value,'인증 확인 중 보존할 메모');
  assert.deepEqual(f.view.projection().favorites,[]);
});

test('delete waits for its tombstone then turns account capture off and prevents later launcher writes', async t => {
  const f = await fixture(t,{ records:new Map([['A',{revision:4,state:state(['world'])}]]) }); await f.connect();
  const gate = f.hold('platformDelete'); await f.click('delete');
  assert.match(f.confirms.at(-1),/즐겨찾기·최근 열기·이어쓰기 메모/);assert.doesNotMatch(f.confirms.at(-1),/앨범 전체/);
  assert.equal(f.content.inert,true); await assert.rejects(f.view.dispatch({type:'favorite',id:'care'}));
  gate.resolve(); await settle(); assert.equal(f.records.get('A').state,null); assert.equal(f.view.connected(),false); assert.equal(f.view.projection(),null);
  assert.equal(await f.view.dispatch({type:'launch',id:'world',mode:'client'}),false); assert.equal(f.writes().length,0);
  assert.ok(f.content.querySelector('[data-cloud="enable"]'));
});

test('returning opens the account record directly and keeps earlier unsent records separate from new edits', async t => {
  const storage = memoryStorage(), records = new Map([['A',{revision:1,state:state()}]]), first = await fixture(t,{storage,records}); await first.connect(); first.setFail(true);
  await first.view.dispatch({type:'favorite',id:'world'}); await until(() => first.writes().length === 1); await settle(); assert.equal(first.view.hasPending(),true); first.view.dispose();
  const preserved=new Map(storage.data);assert.ok(preserved.size>0);
  const second = await fixture(t,{storage,records}); await second.connect();
  assert.equal(second.status(),'계정에 저장했어요');assert.equal(second.content.inert,false);assert.deepEqual(second.view.projection(),state());assert.equal(second.writes().length,0);assert.equal(second.confirms.length,0);
  assert.equal(second.mount.querySelector('[data-notebook-drafts]').hidden,false);assert.match(second.mount.querySelector('[data-notebook-local]').textContent,/따로 보관/);
  for(const [key,raw] of preserved)assert.equal(storage.getItem(key),raw);
  await second.view.dispatch({type:'favorite',id:'care'});await until(()=>second.writes().length===1&&!second.view.hasPending());assert.deepEqual(records.get('A').state.favorites,['care']);
  for(const [key,raw] of preserved)assert.equal(storage.getItem(key),raw);assert.equal(second.confirms.length,0);
});

test('a note still in its form blocks page exit before any account save is requested', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]])});await f.connect();
  f.input('아직 제출하지 않은 이어쓰기 메모');
  assert.equal(f.view.hasUnsavedDraft(),true);assert.equal(f.view.hasPending(),false);
  let prevented=false;const event={preventDefault(){prevented=true;}};f.lifecycle.get('beforeunload')(event);
  assert.equal(prevented,true);assert.equal(event.returnValue,'');assert.equal(f.writes().length,0);assert.equal(f.storage.length,0);
  const field=f.content.querySelector('[name=title]');let focused=false;field.focus=()=>{focused=true;};f.view.focusDraft();
  assert.equal(focused,true);assert.equal(field.value,'아직 제출하지 않은 이어쓰기 메모');
});

test('explicitly discarding a form draft removes only the draft and releases its exit guard', async t => {
  const record=state(['world']);record.notes=[{id:'existing-note',appId:'world',title:'이미 계정에 저장한 메모',done:false,createdAt:1}];
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:record}]])});await f.connect();f.input('버리기로 선택할 초안');
  f.view.discardDraft();assert.equal(f.view.hasUnsavedDraft(),false);assert.equal(f.content.querySelector('[name=title]').value,'');
  let prevented=false;f.lifecycle.get('beforeunload')({preventDefault(){prevented=true;}});
  assert.equal(prevented,false);assert.equal(f.writes().length,0);assert.deepEqual(f.records.get('A').state,record);
});

test('account verification preserves the draft exit guard while changing owner clears it', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}],['B',{revision:1,state:state()}]])});await f.connect();f.input('A 계정에서 작성한 초안');
  await f.auth({configured:true,status:'error',signedIn:false,sessionGeneration:2,error:{retryable:true}});
  assert.equal(f.view.hasUnsavedDraft(),true);assert.equal(f.content.hidden,true);
  await f.auth(signed('A',3));assert.equal(f.view.hasUnsavedDraft(),true);
  await f.auth(signed('B',4));assert.equal(f.view.hasUnsavedDraft(),false);assert.equal(f.content.querySelector('[name=title]').value,'');
  assert.equal(f.writes().length,0);
});

test('submitting transfers the exit guard from form input to the pending account save until acknowledgement', async t => {
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]])});await f.connect();
  const gate=f.hold('platformSave');f.input('계정 저장을 기다리는 메모');f.submit();await until(()=>f.writes().length===1);
  assert.equal(f.view.hasUnsavedDraft(),false);assert.equal(f.view.hasPending(),true);
  let prevented=false;f.lifecycle.get('beforeunload')({preventDefault(){prevented=true;}});assert.equal(prevented,true);
  gate.resolve();await until(()=>!f.view.hasPending());prevented=false;
  f.lifecycle.get('beforeunload')({preventDefault(){prevented=true;}});assert.equal(prevented,false);
  assert.equal(f.records.get('A').state.notes[0].title,'계정 저장을 기다리는 메모');
});

test('pagehide conceals the account without repainting its host and pageshow restores the verified draft', async t => {
  let paints=0;
  const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]]),onChange:()=>paints++});await f.connect();
  f.input('다시 돌아와 이어 쓸 초안');const before=paints;
  f.lifecycle.get('pagehide')();await settle();
  assert.equal(paints,before);assert.equal(f.content.hidden,true);assert.equal(f.view.projection(),null);
  assert.equal(f.view.hasUnsavedDraft(),true);assert.equal(f.writes().length,0);
  f.lifecycle.get('pageshow')();await settle();
  assert.ok(paints>before);assert.equal(f.content.hidden,false);assert.equal(f.content.querySelector('[name=title]').value,'다시 돌아와 이어 쓸 초안');
  assert.equal(f.view.hasUnsavedDraft(),true);assert.equal(f.writes().length,0);
});

const nativeRetryError=generation=>({configured:true,status:'error',signedIn:false,sessionGeneration:generation,error:{code:'AUTH_SERVER_UNAVAILABLE',message:'합성 일시 연결 실패',retryable:true}});
for(const suiteMessage of ['앱 계정 연결을 복구했어요. SYNK ID로 다시 로그인해 주세요.','앱 계정 연결을 저장하지 못했어요. 연결을 다시 확인하고 있어요.'])test('native panel suite failure offers conditional account guidance without losing the draft: '+suiteMessage,async t=>{
 const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]])});await f.connect();f.input('연결 안내 뒤에도 유지할 입력');await f.auth({...nativeRetryError(2),error:{code:'SUITE_UNAVAILABLE',message:suiteMessage,retryable:true}});
 let loads=0,oauth=0;const original=f.host.accountRequest;f.host.authSignIn=async()=>{oauth++;return {ok:true};};f.host.accountRequest=async(op,params)=>{if(op==='load'){loads++;return {ok:false,code:'SUITE_UNAVAILABLE'};}return original(op,params);};
 await f.click('signin');assert.equal(loads,1);assert.equal(oauth,0);assert.equal(f.confirms.length,0);assert.equal(f.writes().length,0);assert.equal(f.view.hasUnsavedDraft(),true);assert.equal(f.content.querySelector('[name=title]').value,'연결 안내 뒤에도 유지할 입력');assert.match(f.root.textContent,/계정 메뉴/);assert.match(f.root.textContent,/기기 저장/);assert.equal(f.button('signin').disabled,false);
});
for(const restored of [signed('A',3),signed('B',4)])test('native suite guidance disappears after verified account recovery: '+restored.account.synk_user_id,async t=>{
 const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}],['B',{revision:1,state:state(['care'])}]])});await f.connect();await f.auth({...nativeRetryError(2),error:{code:'SUITE_UNAVAILABLE',message:'앱 계정 연결을 복구했어요. SYNK ID로 다시 로그인해 주세요.',retryable:true}});
 const original=f.host.accountRequest;let oauth=0;f.host.authSignIn=async()=>{oauth++;return {ok:true};};f.host.accountRequest=async(op,params)=>op==='load'?{ok:false,code:'SUITE_UNAVAILABLE'}:original(op,params);
 await f.click('signin');assert.match(f.root.textContent,/계정 메뉴/);await f.auth(restored);assert.doesNotMatch(f.root.textContent,/계정 메뉴|기기 저장 문제/);assert.equal(oauth,0);
});
test('native panel retry bypasses note discard confirmation and preserves the same-account unfinished note',async t=>{
 const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]])});await f.connect();f.input('확인 뒤 계속 쓸 입력');await f.auth(nativeRetryError(2));
 let loads=0,oauth=0;const original=f.host.accountRequest;f.host.authSignIn=async()=>{oauth++;return {ok:true};};
 f.host.accountRequest=async(op,params)=>{if(op==='load'){loads++;await f.auth(signed('A',3));return {ok:true};}return original(op,params);};
 assert.equal(f.button('signin').textContent,'계정 연결 다시 확인');await f.click('signin');
 assert.equal(loads,1);assert.equal(oauth,0);assert.equal(f.confirms.length,0);assert.equal(f.content.querySelector('[name=title]').value,'확인 뒤 계속 쓸 입력');assert.equal(f.view.hasUnsavedDraft(),true);assert.equal(f.writes().length,0);
});
test('native panel failed verification retains its unfinished note and allows another preserving retry',async t=>{
 const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]])});await f.connect();f.input('실패해도 남겨 둘 입력');await f.auth(nativeRetryError(2));
 let loads=0,oauth=0;const original=f.host.accountRequest;f.host.authSignIn=async()=>{oauth++;return {ok:true};};f.host.accountRequest=async(op,params)=>{if(op==='load'){loads++;return {ok:false,error:{retryable:true}};}return original(op,params);};
 await f.click('signin');await f.click('signin');assert.equal(loads,2);assert.equal(oauth,0);assert.equal(f.confirms.length,0);assert.equal(f.view.hasUnsavedDraft(),true);assert.equal(f.content.querySelector('[name=title]').value,'실패해도 남겨 둘 입력');assert.equal(f.content.hidden,true);assert.equal(f.writes().length,0);
});
test('native panel IPC rejection never requests OAuth or discards the in-memory draft',async t=>{
 const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]])});await f.connect();f.input('IPC 실패 뒤 입력');await f.auth(nativeRetryError(2));let loads=0,oauth=0;
 const original=f.host.accountRequest;f.host.authSignIn=async()=>{oauth++;return {ok:true};};f.host.accountRequest=async(op,params)=>{if(op==='load'){loads++;throw Object.assign(Error('합성 재확인 실패'),{code:'NETWORK',retryable:true});}return original(op,params);};
 await f.click('signin');assert.equal(loads,1);assert.equal(oauth,0);assert.equal(f.confirms.length,0);assert.equal(f.view.hasUnsavedDraft(),true);assert.equal(f.content.querySelector('[name=title]').value,'IPC 실패 뒤 입력');assert.match(f.root.textContent,/합성 재확인 실패/);assert.equal(f.writes().length,0);
});
test('native panel duplicate retry clicks stay within one preserving request',async t=>{
 const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}]])});await f.connect();await f.auth(nativeRetryError(2));const gate=deferred();let loads=0,oauth=0;
 const original=f.host.accountRequest;f.host.authSignIn=async()=>{oauth++;return {ok:true};};f.host.accountRequest=async(op,params)=>{if(op==='load'){loads++;await gate.promise;return {ok:false};}return original(op,params);};
 const first=f.click('signin');await settle();const second=f.click('signin');await settle();assert.equal(loads,1);assert.equal(oauth,0);gate.resolve();await Promise.all([first,second]);assert.equal(f.confirms.length,0);
});
test('native panel late retry failure cannot show the old draft or error in a newer account',async t=>{
 const f=await fixture(t,{records:new Map([['A',{revision:1,state:state()}],['B',{revision:1,state:state(['care'])}]])});await f.connect();f.input('A의 기존 입력');await f.auth(nativeRetryError(2));const gate=deferred();gate.promise.catch(()=>{});let loads=0;
 const original=f.host.accountRequest;f.host.accountRequest=async(op,params)=>{if(op==='load'){loads++;await gate.promise;return {ok:true};}return original(op,params);};
 const retry=f.click('signin');await settle();await f.auth(signed('B',4));f.input('B의 새 입력');gate.reject(Error('A의 늦은 오류'));await retry;await settle();
 assert.equal(loads,1);assert.equal(f.confirms.length,0);assert.equal(f.content.querySelector('[name=title]').value,'B의 새 입력');assert.deepEqual(f.view.projection().favorites,['care']);assert.doesNotMatch(f.root.textContent,/A의 늦은 오류|A의 기존 입력/);assert.equal(f.writes().length,0);
});
test('native panel verified signed-out login retains the original explicit OAuth action',async t=>{
 const f=await fixture(t,{initial:{configured:true,status:'signed-out',signedIn:false,sessionGeneration:1}});await f.connect();let loads=0,oauth=0;
 const original=f.host.accountRequest;f.host.accountRequest=async(op,params)=>{if(op==='load'){loads++;return {ok:true};}return original(op,params);};f.host.authSignIn=async()=>{oauth++;return {ok:true};};
 await f.click('signin');assert.equal(oauth,1);assert.equal(loads,0);
});
