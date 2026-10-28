import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {verdictsPlugin} from '../tools/lib/world-verdicts.mjs';
import * as canonical from '../experiences/synk-world-app/world-account.mjs';
import * as generated from '../experiences/synk-world-app/world-account.bundle.mjs';
import {WorldClient} from '../experiences/synk-world-app/world-client.mjs';

const A='11111111-1111-4111-8111-111111111111';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const storage=()=>{const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};

test('compact WORLD bundle retains exports, reviewed learning content and recommendation results',async()=>{
  assert.deepEqual(Object.keys(generated),Object.keys(canonical));
  assert.deepEqual(generated.worldPosition.items,canonical.worldPosition.items);
  assert.deepEqual(generated.worldPosition.hangulLayer,canonical.worldPosition.hangulLayer);
  assert.deepEqual(generated.worldLearning.SKILLS,canonical.worldLearning.SKILLS);
  for(const progress of [{},{hangul:{answer:'new'}},{lessons:{'greeting-hello':{completedAt:'2026-10-27T00:00:00.000Z'}}}]){
    const options={now:Date.parse('2026-10-28T00:00:00.000Z'),progress,recommendActivities:canonical.worldLearning.recommendActivities};
    assert.deepEqual(generated.createWorldLearningPlan(options),canonical.createWorldLearningPlan(options));
  }
  assert.deepEqual(generated.publicWorldConfig({mode:'account',basePath:'/world/',account:config},'https://world.example.test/world/'),canonical.publicWorldConfig({mode:'account',basePath:'/world/',account:config},'https://world.example.test/world/'));
  const text=fs.readFileSync(new URL('../experiences/synk-world-app/world-account.bundle.mjs',import.meta.url),'utf8');
  assert.match(text,/from["']\.\/life-content\.mjs["']/);
  assert.doesNotMatch(text,/CONTENT_VERSION\s*=/,'the content module is no longer embedded');
  // Compare the same current source graph so unrelated learning-content growth
  // cannot invalidate a historical absolute byte cap. Count the external module
  // as well, so moving bytes out of the bundle alone cannot satisfy the budget.
  const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url);
  const pairCheck=require('../tools/짝검사.js'),bundle='experiences/synk-world-app/world-account.bundle.mjs';
  const sources=pairCheck.묶인모듈(root,bundle);
  assert.ok(sources.includes('experiences/synk-world-app/world-account.mjs'));
  assert.ok(sources.includes('experiences/topik-items/review/existing-verdicts.json'));
  assert.ok(pairCheck.고르기({root,바뀐:['experiences/topik-items/review/existing-verdicts.json']}).some(x=>x.줄.이름==='WORLD account bundle'),'reviewed content edits still select the compressed account bundle');
  const esbuild=require(require.resolve('esbuild',{paths:[path.join(root,'experiences/synk-account'),root]}));
  const baseline=await esbuild.build({absWorkingDir:root,entryPoints:[path.join(root,'experiences/synk-world-app/world-account.mjs')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',legalComments:'none',plugins:[verdictsPlugin]});
  const combinedBytes=Buffer.byteLength(text)+fs.readFileSync(new URL('../experiences/synk-world-app/life-content.mjs',import.meta.url)).length;
  assert.ok(combinedBytes<baseline.outputFiles[0].contents.length*0.8,'bundle plus shared content retains at least 20% savings against the same unoptimized graph');
});

test('the generated account still rejects a reply decoded after logout and preserves account boundaries',async()=>{
  async function scenario(createWorldAccount){
    const tab=storage(),cache=storage(),calls=[];
    tab.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-token',refresh_token:'synthetic-refresh',expires_at:Date.now()+3600000}));
    let client,hold=false,release;
    const pending=new Promise(resolve=>{release=resolve;});
    const snapshot=()=>({ok:true,accountId:A,revision:1,avatar:{slots:{}},inventory:[]});
    const account=createWorldAccount({config,storage:tab,getUrl:()=> 'https://world.example.test/world/',replaceUrl:()=>{},navigate:()=>{},
      accountFactory:()=>({load:async()=>({ok:true,account:{synk_user_id:A,status:'active'},sessions:[{id:'fixture-session',current:true,revoked:false}]}),revokeSession:async()=>({refreshRevoked:true})}),
      onInvalidate:()=>client?.invalidate(),fetcher:async(url,init)=>{calls.push({path:new URL(url).pathname,method:init?.method||'GET',credentials:init?.credentials});
        return {ok:true,status:200,json:async()=>url.includes('/auth/v1/logout')?{}:hold?pending:snapshot()};}});
    client=new WorldClient({account,storage:cache,tabStorage:tab,broadcastAppearance:false});
    assert.equal(await client.restore(),true);hold=true;
    const late=client.refresh();await new Promise(resolve=>setImmediate(resolve));
    await client.logout();release(snapshot());await assert.rejects(late,{code:'STALE_RESPONSE'});
    assert.equal(client.snapshot,null);assert.equal(account.identity().accountId,null);assert.equal(tab.getItem('synk.oauth.session.world'),null);
    return calls;
  }
  assert.deepEqual(await scenario(generated.createWorldAccount),await scenario(canonical.createWorldAccount));
});
