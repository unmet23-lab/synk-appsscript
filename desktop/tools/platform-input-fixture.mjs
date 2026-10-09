import { mountPlatformLibrary } from '/entry.mjs';

// Test-only host: no credentials, disk storage, installed profile or network.
const clone=value=>structuredClone(value),calls=[],holds=new Map(),pending=new Map(),storageData=new Map();
const emptyPlatformLibrary=()=>({version:1,consent:false,favorites:[],recent:[],rememberRecent:true,notes:[]});
const storage={getItem:key=>storageData.get(key)??null,setItem:(key,value)=>storageData.set(key,value),removeItem:key=>storageData.delete(key),key:index=>[...storageData.keys()][index]??null,get length(){return storageData.size;}};
const identity={configured:true,signedIn:true,status:'signed-in',sessionGeneration:1,account:{synk_user_id:'synthetic-input'}};
let row={revision:1,state:{...emptyPlatformLibrary(),consent:true}},failSave=false,failLoad=false,probe=null;
const host={
  authStatus:async()=>clone(identity),onAuthChanged:()=>()=>{},
  accountRequest:async(operation,params={})=>{
    calls.push({operation,params:clone(params)});
    if(holds.has(operation)){const gate=holds.get(operation);holds.delete(operation);pending.set(operation,gate);await gate.promise;pending.delete(operation);}
    if(operation==='platformSave'){
      if(failSave)return {ok:false,error:{code:'NETWORK',message:'합성 저장 실패'}};
      if(params.expected_revision!==row.revision)return {ok:false,revision:row.revision,error:{code:'REVISION_CONFLICT'}};
      row={revision:row.revision+1,state:clone(params.state)};
    }else if(operation==='platformLoad'){
      if(failLoad)return {ok:false,error:{code:'NETWORK',message:'합성 조회 실패'}};
    }else throw Error('Unexpected synthetic operation: '+operation);
    return {ok:true,scope:'synk-personal',resource:'platform-library',accountId:'synthetic-input',updatedAt:null,...clone(row)};
  },
};
const root=document.getElementById('fixture'),view=mountPlatformLibrary(root,{native:true,getHost:()=>host,storage});
const field=()=>root.querySelector('[data-note-form] [name=title]'),select=()=>root.querySelector('[data-note-form] [name=appId]'),content=()=>root.querySelector('[data-cloud-content]');
const input=(value,isComposing=false)=>{const node=field();node.value=value;node.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:isComposing?'insertCompositionText':'insertText',data:value,isComposing}));};
const confirmMessages=[];
globalThis.confirm=message=>{confirmMessages.push(message);return true;};
globalThis.__platformInputQA={
  connect:()=>root.querySelector('[data-connect-button]').onclick(),
  expand:()=>{if(root.querySelector('[data-library-panel]').hidden)root.querySelector('[data-panel-toggle]').click();},
  ready:()=>!!field()&&!field().disabled,
  input,
  beginProbe(value){
    input(value);const node=field();node.focus();node.setSelectionRange(3,7,'backward');
    probe={node,form:node.form,select:select(),events:[],composing:false};
    for(const type of ['compositionstart','compositionupdate','compositionend','input','blur'])node.addEventListener(type,event=>{
      probe.events.push({type:event.type,isTrusted:event.isTrusted,isComposing:event.isComposing??null,data:event.data??null});
      if(type==='compositionstart')probe.composing=true;if(type==='compositionend')probe.composing=false;
    });
    node.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'한'}));
    node.dispatchEvent(new CompositionEvent('compositionupdate',{bubbles:true,data:'한글'}));
    return this.probe();
  },
  endComposition(){probe.node.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'한글'}));return this.probe();},
  probe:()=>({sameInput:field()===probe?.node,sameForm:field()?.form===probe?.form,sameSelect:select()===probe?.select,connected:!!probe?.node.isConnected,focused:document.activeElement===probe?.node,value:field()?.value,selectionStart:field()?.selectionStart,selectionEnd:field()?.selectionEnd,selectionDirection:field()?.selectionDirection,composing:probe?.composing,events:clone(probe?.events||[])}),
  hold(operation){if(holds.has(operation)||pending.has(operation))throw Error('Operation already held');let resolve;const promise=new Promise(done=>resolve=done);holds.set(operation,{promise,resolve});},
  held:operation=>pending.has(operation),
  release(operation){const gate=pending.get(operation)||holds.get(operation);if(!gate)throw Error('No held operation');holds.delete(operation);gate.resolve();},
  failSave:value=>{failSave=value;},failLoad:value=>{failLoad=value;},
  change:id=>view.dispatch({type:'favorite',id}),
  click:action=>root.querySelector('[data-notebook="'+action+'"]').click(),
  status:()=>root.querySelector('[data-notebook-status]').textContent,
  detail:()=>root.querySelector('[data-notebook-detail]').textContent,
  pending:()=>view.hasPending(),record:()=>clone(row),projection:()=>view.projection(),
  bumpRemote(title){row={revision:row.revision+1,state:{...clone(row.state),notes:[{id:'remote-'+row.revision,appId:'world',title,createdAt:1,done:false}]}};},
  calls:()=>clone(calls),
  lock:()=>({inert:content().inert,busy:content().getAttribute('aria-busy'),fieldDisabled:field()?.disabled,selectDisabled:select()?.disabled,allControlsDisabled:[...content().querySelectorAll('button,input,select')].every(node=>node.disabled),refreshDisabled:root.querySelector('[data-notebook=refresh]').disabled,importDisabled:root.querySelector('[data-notebook=import]').disabled,value:field()?.value,notes:content().querySelector('.continuity-notes')?.textContent}),
  async blockedEdit(){try{await view.dispatch({type:'favorite',id:'teacher'});return false;}catch{return true;}},
  dispose:()=>view.dispose(),confirmMessages:()=>[...confirmMessages],
};
document.documentElement.dataset.ready='true';
