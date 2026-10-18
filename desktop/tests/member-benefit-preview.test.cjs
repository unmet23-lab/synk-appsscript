'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {PRODUCT_PREVIEWS,product,productBrowserDestination,productDownload,createProductPreviews}=require('../src/product-preview.cjs');
const {publicAppDestination,createPublicApps}=require('../src/public-apps.cjs');
const {projectLibrary}=require('../src/library-access.cjs');
test('retired free benefits cannot reappear through stale entitlements or launch capabilities',async()=>{
  const retired=['rehearsal','family-album'];
  const account={ok:true,account:{synk_user_id:'synthetic',status:'active'},memberships:[],entitlements:retired.map(id=>({product:'platform',key:'library.'+id}))};
  assert.deepEqual(projectLibrary(account).appIds,[]);
  const previews=createProductPreviews({packaged:false,mode:'development',clientId:'platform',accountStatus:()=>({signedIn:true,status:'signed-in',account:account.account,library:{status:'ready',appIds:retired}}),spawn:()=>assert.fail('retired app must not spawn')});
  const publicApps=createPublicApps({clientId:'platform',mode:'development',openExternal:()=>assert.fail('retired app must not open')});
  for(const id of retired){
    assert.equal(PRODUCT_PREVIEWS[id],undefined);assert.equal(product(id),null);assert.equal(productBrowserDestination(id),null);assert.equal(publicAppDestination(id),null);
    assert.equal((await previews.open(id)).code,'UNKNOWN_PREVIEW');assert.equal((await publicApps.open(id)).code,'UNKNOWN_PUBLIC_APP');
    assert.equal(productDownload({id,url:'blob:http://127.0.0.1:4298/old',sourceUrl:'http://127.0.0.1:4298/',mime:'application/json',filename:'synk-'+id+'.json',size:100}),false);
  }
});
test('remaining member services retain independent previews and personalization',async()=>{
  assert.deepEqual(Object.keys(PRODUCT_PREVIEWS),['path','care','fortune']);
  const {createPlatformPersonalization}=await import('../renderer/personalization.mjs'),engine=require('../../atlas/personalization'),map=new Map();
  const host=createPlatformPersonalization(engine,{getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
  host.save({context:'everyday',goal:'prepare',textSize:'standard',explanation:'standard',motion:'full',consent:true});
  for(const id of ['care','fortune']){const state=host.current({appIds:[id]});assert.equal(state.active,true);assert.equal(state.error,null);assert.deepEqual(state.order,[id]);assert.equal(state.selected,id);}
});
