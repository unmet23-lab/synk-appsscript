import { mountPlatformLibrary } from '/entry.mjs';

// Only synthetic accounts and in-memory documents are used by this fixture.
const clone=value=>structuredClone(value),calls=[],records=new Map(),listeners=new Set(),holds=new Map(),pending=new Map(),cache=new Map();
const storage={getItem:key=>cache.get(key)??null,setItem:(key,value)=>cache.set(key,value),removeItem:key=>cache.delete(key),key:index=>[...cache.keys()][index]??null,get length(){return cache.size;}};
const note=(id,title,done=false)=>({id,appId:'world',title,done,createdAt:100});
const documentFor=notes=>({version:1,consent:true,favorites:[],recent:[],rememberRecent:true,notes});
records.set('A',{revision:1,state:documentFor([note('done-a','완료한 합성 메모',true),note('todo-a','부탁 대화의 첫 문장 다듬기'),note('todo-b','아직 마치지 않은 두 번째 메모')])});
records.set('B',{revision:1,state:documentFor([note('only-b','B 계정만의 합성 메모')])});
records.set('CAP',{revision:1,state:documentFor(Array.from({length:60},(_,i)=>note('cap-'+i,'보관함 경계의 합성 메모 '+(i+1),i>=55)))});
let identity={configured:true,signedIn:true,status:'signed-in',sessionGeneration:1,account:{synk_user_id:'A'}},probe=null;
const root=document.getElementById('fixture');
const host={
  authStatus:async()=>clone(identity),onAuthChanged:fn=>(listeners.add(fn),()=>listeners.delete(fn)),
  accountRequest:async(operation,params={})=>{
    const owner=identity.account?.synk_user_id;calls.push({operation,owner,params:clone(params)});
    if(holds.has(operation)){const gate=holds.get(operation);holds.delete(operation);pending.set(operation,gate);await gate.promise;pending.delete(operation);}
    let row=records.get(owner);
    if(operation==='platformSave'){
      if(params.expected_revision!==row.revision)return {ok:false,revision:row.revision,error:{code:'REVISION_CONFLICT'}};
      row={revision:row.revision+1,state:clone(params.state)};records.set(owner,row);
    }else if(operation!=='platformLoad')throw Error('Unexpected synthetic operation: '+operation);
    return {ok:true,scope:'synk-personal',resource:'platform-library',accountId:owner,updatedAt:null,...clone(row)};
  },
};
const view=mountPlatformLibrary(root,{native:true,getHost:()=>host,storage});
const field=()=>root.querySelector('[data-note-form] [name=title]'),select=()=>root.querySelector('[data-note-form] [name=appId]'),q=selector=>root.querySelector(selector);
const confirmMessages=[];globalThis.confirm=message=>(confirmMessages.push(message),true);
const button=(action,id)=>q('[data-cloud="'+action+'"]'+(id?'[data-id="'+id+'"]':''));
const snapshot=()=>({title:field()?.value,appId:select()?.value,heading:q('[data-editor-heading]')?.textContent,submitDisabled:q('[data-note-submit]')?.disabled,undoHidden:q('[data-note-undo]')?.hidden,undoDisabled:button('undo-note')?.disabled,undoMessage:q('[data-note-undo-message]')?.textContent,capacity:q('[data-note-capacity]')?.textContent,completedHidden:q('[data-completed-notes]')?.hidden,visibleNoteIds:[...root.querySelectorAll('[data-note-id]')].filter(node=>!node.closest('[hidden]')).map(node=>node.dataset.noteId),allNoteIds:[...root.querySelectorAll('[data-note-id]')].map(node=>node.dataset.noteId),pending:view.hasPending(),projection:view.projection()});
globalThis.__platformNotesQA={
  connect:()=>q('[data-connect-button]').onclick(),expand:()=>{if(q('[data-library-panel]').hidden)q('[data-panel-toggle]').click();},
  ready:()=>!!field()&&!field().disabled,
  input(value,appId){field().value=value;if(appId)select().value=appId;field().dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));},
  click(action,id){const target=button(action,id);if(!target)throw Error('Missing button '+action+' '+id);target.click();},
  clickNotebook:action=>q('[data-notebook="'+action+'"]').click(),
  submit:()=>q('[data-note-form]').requestSubmit(),
  toggleCompletedKeyboard(){button('show-completed').focus();},
  snapshot,
  beginProbe(){const node=field();node.focus();node.setSelectionRange(2,6,'backward');probe={node,form:node.form,select:select()};return this.probe();},
  probe:()=>({sameInput:field()===probe?.node,sameForm:field()?.form===probe?.form,sameSelect:select()===probe?.select,connected:!!probe?.node.isConnected,focused:document.activeElement===probe?.node,value:field()?.value,appId:select()?.value,start:field()?.selectionStart,end:field()?.selectionEnd,direction:field()?.selectionDirection}),
  hold(operation){if(holds.has(operation)||pending.has(operation))throw Error('Already held');let resolve;const promise=new Promise(done=>resolve=done);holds.set(operation,{promise,resolve});},
  held:operation=>pending.has(operation),release(operation){const gate=pending.get(operation)||holds.get(operation);if(!gate)throw Error('Not held');holds.delete(operation);gate.resolve();},
  change:action=>view.dispatch(action),
  switchAccount(owner){identity={...identity,sessionGeneration:identity.sessionGeneration+1,account:{synk_user_id:owner}};for(const listener of listeners)listener(clone(identity));},
  record:owner=>clone(records.get(owner)),calls:()=>clone(calls),pending:()=>view.hasPending(),
  replaceRemoteNote(owner,id,title){const row=clone(records.get(owner));row.revision++;row.state.notes.find(note=>note.id===id).title=title;records.set(owner,row);},
  scrollTo(selector){q(selector)?.scrollIntoView({block:'start'});},
  async rejectOverCapacity(){try{await view.dispatch({type:'note',id:'world',title:'61번째 합성 메모'});return null;}catch(error){return {message:error.message,code:error.code};}},
  geometry:()=>({width:innerWidth,height:innerHeight,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...root.querySelectorAll('*')].filter(node=>node.getClientRects().length&&!node.closest('[hidden]')).map(node=>({tag:node.tagName,text:node.textContent.slice(0,50),left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right})).filter(row=>row.left<-.5||row.right>innerWidth+.5)}),
  dispose:()=>view.dispose(),confirmMessages:()=>[...confirmMessages],
};
document.documentElement.dataset.ready='true';
