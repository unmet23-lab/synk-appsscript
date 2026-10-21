import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the actual shell handler with a delayed module response. A closed
// panel or switched account must not receive an old fitting room afterwards.
const shell=fs.readFileSync(new URL('../app-shell.mjs',import.meta.url),'utf8');
const handler=shell.slice(shell.indexOf('async function wardrobe(){'),shell.indexOf('\nfunction pending(){'))
  .replace("import('../synk-world-home/wardrobe-studio.mjs')",'loadWardrobe()');
function fixture(){
  let resolve,reject;const loaded=new Promise((yes,no)=>{resolve=yes;reject=no;}),created=[],attached=[];
  const context={gameLaunch:0,screen:'',worldPanel:{open:true},wardrobeStudio:null,
    client:{snapshot:{accountId:'synthetic-a'},generation:1,pending:null,status:'ready',busy:false,refresh:async()=>{}},
    home:{state:{reduced:false},attachPanelResource:studio=>attached.push(studio),toast:()=>{}},
    show(title,html,type){context.gameLaunch++;context.screen=type;},signIn(){context.screen='sign-in';},
    loadWardrobe:()=>loaded,$:()=>({replaceChildren(){}}),play(){},errorText:()=>'',
  };
  const module={createWardrobeStudio(options){created.push(options.snapshot.accountId);return {element:{},update(){}};}};
  vm.createContext(context);vm.runInContext(handler+';this.openWardrobe=wardrobe;',context);
  return {context,created,attached,resolve:()=>resolve(module),reject:()=>reject(Error('offline'))};
}
test('late wardrobe module does not reopen a dismissed panel',async()=>{
  const f=fixture(),opened=f.context.openWardrobe();f.context.gameLaunch++;f.context.worldPanel.open=false;f.context.screen='';f.resolve();await opened;
  assert.deepEqual(f.created,[]);assert.deepEqual(f.attached,[]);
});
test('late wardrobe module cannot mount for a different owner or session',async()=>{
  for(const change of [c=>{c.client.snapshot={accountId:'synthetic-b'};},c=>{c.client.generation++;},c=>{c.client.snapshot=null;}]){
    const f=fixture(),opened=f.context.openWardrobe();change(f.context);f.resolve();await opened;assert.deepEqual(f.created,[]);
  }
});
test('only the most recent wardrobe open mounts after shared module loading',async()=>{
  const f=fixture(),old=f.context.openWardrobe(),current=f.context.openWardrobe();f.resolve();await Promise.all([old,current]);assert.deepEqual(f.created,['synthetic-a']);assert.equal(f.attached.length,1);
});
test('a failed deferred module leaves a retryable wardrobe entrance',async()=>{
  const f=fixture(),opened=f.context.openWardrobe();f.reject();await opened;assert.equal(f.context.screen,'world-wardrobe');assert.deepEqual(f.created,[]);
});
