import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Execute the actual home controller functions with local ports. No browser,
// account, IndexedDB, capture, or network operation is performed by this test.
const source=readFileSync(new URL('../home.mjs',import.meta.url),'utf8');
function functionSource(start,end){
  const from=source.indexOf(start),to=end?source.indexOf(end,from+start.length):source.length;
  assert.ok(from>=0&&to>from,`home controller contains ${start}`);
  return source.slice(from,to);
}
const controller=[
  functionSource('function closePanel(){','function openPanel('),
  functionSource('function openPanel(','function callHost('),
  functionSource('async function photo(){')
].join('\n');
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function harness(){
  const save=deferred(),saving=deferred(),capture=deferred(),capturing=deferred();
  const state={panel:'home',saved:[],albumOwners:[],closedAlbums:0,memoryRefreshes:0,memoryOpens:0,notices:[],disposedPanels:[]};
  const panel={open:false,classList:{add(){}},close(){this.open=false;},showModal(){this.open=true;}};
  const nodes=new Map(),getNode=selector=>{if(!nodes.has(selector))nodes.set(selector,{textContent:'',focus(){}});return nodes.get(selector);};
  const ports={panel,content:{innerHTML:''},document:{activeElement:null,body:{}},$:getNode,
    living:{capture:async()=>{capturing.resolve();return capture.promise;},metrics:()=>({scene:{drawingBuffer:{width:900,height:600}}})},
    createWardrobeAlbum:({accountId})=>{state.albumOwners.push(accountId);return {
      add:async(blob,metadata)=>{saving.resolve();await save.promise;state.saved.push({accountId,blob,metadata});return {ok:true,mode:'device'};},
      close(){state.closedAlbums++;}
    };},
    fetch:async()=>({blob:async()=>new Blob(['synthetic-photo'],{type:'image/png'})}),
    memory:{refresh:async()=>{state.memoryRefreshes++;}},
    showMemory(){state.memoryOpens++;state.panel='memory';},
    toast:message=>state.notices.push(message),showMe(){state.panel='profile';},
    disposePanelContent(){state.disposedPanels.push(state.panel);},
    setNav(value){if(value==='home'&&!panel.open)state.panel='home';},syncScene(){}
  };
  const api=new Function('ports',`
    const {panel,content,document,$,living,createWardrobeAlbum,fetch,memory,showMemory,toast,showMe,disposePanelContent,setNav,syncScene}=ports;
    let photoBusy=false,accountOwner='photo-test-a',panelEpoch=0,equipment={slots:{body:'synthetic-outfit'},dyes:{}},lastFocus=null,panelKind='',education=null;
    ${controller}
    return {photo,closePanel,openPanel,setOwner(value){accountOwner=value;},isBusy:()=>photoBusy};
  `)(ports);
  return {...api,state,save,capture,capturing,saving,
    navigate(type){api.openPanel(type,'',{type});state.panel=type;},
    completeCapture(){capture.resolve('data:image/png;base64,c3ludGhldGlj');}
  };
}

test('a completed photo opens the memory panel when the user remains on the home',{timeout:2000},async()=>{
  const h=harness(),pending=h.photo();h.completeCapture();await h.saving.promise;
  assert.equal(h.isBusy(),true);h.save.resolve();await pending;
  assert.equal(h.state.saved.length,1);assert.equal(h.state.saved[0].accountId,'photo-test-a');
  assert.equal(h.state.panel,'memory');assert.equal(h.state.memoryOpens,1);assert.equal(h.state.memoryRefreshes,1);
  assert.equal(h.state.notices.length,1);assert.equal(h.state.closedAlbums,1);assert.equal(h.isBusy(),false);
});

test('opening learning during a delayed photo save keeps learning open and still saves the photo',{timeout:2000},async()=>{
  const h=harness(),pending=h.photo();h.completeCapture();await h.saving.promise;
  h.navigate('learning');h.save.resolve();await pending;
  assert.equal(h.state.saved.length,1);assert.equal(h.state.panel,'learning');assert.equal(h.state.memoryOpens,0);
  assert.equal(h.state.memoryRefreshes,1);assert.equal(h.state.notices.length,1);assert.equal(h.state.closedAlbums,1);
});

test('opening and then closing another panel does not reopen the photo result',{timeout:2000},async()=>{
  const h=harness(),pending=h.photo();h.completeCapture();await h.saving.promise;
  h.navigate('wardrobe');h.closePanel();h.save.resolve();await pending;
  assert.equal(h.state.saved.length,1);assert.equal(h.state.panel,'home');assert.equal(h.state.memoryOpens,0);
  assert.equal(h.state.closedAlbums,1);assert.equal(h.isBusy(),false);
});

test('switching account during a committed photo write never updates the new account UI',{timeout:2000},async()=>{
  const h=harness(),pending=h.photo();h.completeCapture();await h.saving.promise;
  h.setOwner('photo-test-b');h.navigate('learning');h.save.resolve();await pending;
  assert.equal(h.state.saved.length,1);assert.equal(h.state.saved[0].accountId,'photo-test-a');
  assert.deepEqual(h.state.albumOwners,['photo-test-a']);assert.equal(h.state.panel,'learning');
  assert.equal(h.state.memoryOpens,0);assert.equal(h.state.memoryRefreshes,0);assert.equal(h.state.notices.length,0);
  assert.equal(h.state.closedAlbums,1);assert.equal(h.isBusy(),false);
});

test('switching account before capture finishes prevents an album write',{timeout:2000},async()=>{
  const h=harness(),pending=h.photo();await h.capturing.promise;
  h.setOwner('photo-test-b');h.completeCapture();await pending;
  assert.equal(h.state.saved.length,0);assert.equal(h.state.memoryOpens,0);assert.equal(h.state.notices.length,0);
  assert.equal(h.state.closedAlbums,1);assert.equal(h.isBusy(),false);
});
