import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldAccount} from '../world-account.mjs';
import {publicWorldConfig} from '../operating-mode.mjs';
import {WorldClient} from '../world-client.mjs';
import {createTownWorldHost} from '../world-town-client.mjs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/portal/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const storage=()=>{const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const reply=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const snapshot=(id=A,revision=1)=>({ok:true,accountId:id,revision,avatar:{slots:{}},inventory:[]});
function fixture(options={}){
 const tab=storage(),cache=storage(),calls=[];tab.setItem('synk.oauth.session.world',JSON.stringify({access_token:'token-a',refresh_token:'refresh-a',expires_at:Date.now()+3600000}));
 let client,invalidations=0;
 const account=createWorldAccount({config,storage:tab,getUrl:()=>options.url||'https://world.example.test/world/',replaceUrl:options.replaceUrl||(()=>{}),navigate:options.navigate||(()=>{}),
  accountFactory:options.accountFactory||(({getAccessToken})=>({load:async()=>({ok:true,account:{synk_user_id:A,status:'active'},sessions:[{id:'session-a',current:true,revoked:false}]}),revokeSession:async()=>{calls.push({revokeToken:getAccessToken()});return {refreshRevoked:true};}})),
  requestToken:options.requestToken,
  onInvalidate:()=>{invalidations++;client?.invalidate();},fetcher:async(url,init)=>{calls.push({url,init});if(options.fetcher)return options.fetcher(url,init);return reply(snapshot());}});
 client=new WorldClient({account,storage:cache,tabStorage:tab,broadcastAppearance:false});
 return {account,client,tab,cache,calls,invalidations:()=>invalidations};
}
test('account mode validates only public settings and a safe static base path',()=>{
 assert.equal(publicWorldConfig({mode:'account',basePath:'/world/',account:config},'https://world.example.test/world/').account.clients.world.clientId,'world-browser');
 assert.throws(()=>publicWorldConfig({mode:'account',account:{...config,supabasePublishableKey:'sb_secret_wrong'}},'https://world.example.test/'));
 assert.throws(()=>publicWorldConfig({mode:'account',basePath:'/../private/',account:config},'https://world.example.test/'));
 assert.throws(()=>publicWorldConfig({mode:'account',account:{...config,clients:{world:{...config.clients.world,clientSecret:'wrong'}}}},'https://world.example.test/'));
});
test('operating WORLD restores verified SYNK ID and never calls synthetic session or cookie routes',async()=>{
 const f=fixture();assert.equal(await f.client.restore(),true);assert.equal(f.client.snapshot.accountId,A);assert.equal(f.client.accessToken,null);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'https://identity.example.test/functions/v1/synk-world-v1/bootstrap');
 assert.equal(f.calls[0].init.credentials,'omit');assert.equal(f.calls[0].init.headers.Authorization,'Bearer token-a');assert.equal(f.calls[0].init.headers['X-Synk-Rehearsal'],undefined);
 assert.equal([...f.cache.data.values()].some(s=>s.includes('token-a')),false);
});
test('same-tab account replacement immediately masks old state and prevents an old account command',async()=>{
 const f=fixture();await f.client.restore();const n=f.calls.length;
 f.tab.setItem('synk.oauth.session.world',JSON.stringify({access_token:'token-b',expires_at:Date.now()+3600000,refresh_token:null}));
 await assert.rejects(f.client.start(),{code:'STALE_RESPONSE'});assert.equal(f.client.snapshot,null);assert.equal(f.calls.length,n);assert.equal(f.account.identity().accountId,null);
});
test('logout beats delayed decoded WORLD replies and uses only captured credentials for server revocation',async()=>{
 const held=deferred();let hold=false;
 const f=fixture({fetcher:async url=>url.includes('/auth/v1/logout')?reply({}):hold?reply(await held.promise):reply(snapshot())});await f.client.restore();hold=true;
 const pending=f.client.refresh();await new Promise(r=>setTimeout(r,0));await f.client.logout();held.resolve(snapshot(A,9));
 await assert.rejects(pending,{code:'STALE_RESPONSE'});assert.equal(f.client.snapshot,null);assert.equal(f.tab.getItem('synk.oauth.session.world'),null);assert.equal(f.calls.find(c=>c.revokeToken).revokeToken,'token-a');
});
test('an API cannot substitute another account under an existing WORLD session',async()=>{
 const f=fixture({fetcher:async()=>reply(snapshot(B))});await assert.rejects(f.client.restore(),{code:'ACCOUNT_MISMATCH'});assert.equal(f.client.snapshot,null);
});
test('offline retains account-scoped outfit outbox and replays the same request against actual API',async()=>{
 let offline=false,revision=1;const commands=[];
 const f=fixture({fetcher:async(url,init)=>{if(offline)throw new TypeError('offline');if(init.body){commands.push(JSON.parse(init.body));revision++;}return reply(snapshot(A,revision));}});
 await f.client.restore();offline=true;await assert.rejects(f.client.equip({body:'mongle-apron-starter'}),{code:'NETWORK_UNAVAILABLE'});
 const id=f.client.pending.requestId;assert.ok(f.cache.getItem(`synk-world-v1-pending:${A}`));offline=false;await f.client.sendPending();assert.equal(commands[0].requestId,id);assert.equal(f.client.pending,null);
});
test('PKCE sign-in navigates to registered existing world-browser with no access token in URL',async()=>{
 let destination;const f=fixture({navigate:url=>destination=url});await f.client.signIn();
 const url=new URL(destination);assert.equal(url.pathname,'/auth/v1/oauth/authorize');assert.equal(url.searchParams.get('client_id'),'world-browser');assert.equal(url.searchParams.get('redirect_uri'),'https://world.example.test/world/');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.has('access_token'),false);assert.ok(f.tab.getItem('synk.oauth.pending.world'));
});
test('Town commands pin actual academy class and reject sharing/membership metadata moving backward',async()=>{
 let revision=3;const binding=()=>({kind:'academy',classId:A,townId:B,learnerId:B,membershipRevision:2,sharing:{enabled:true,revision}});
 const f=fixture({fetcher:async url=>url.includes('synk-town')?reply({...snapshot(),state:{revision:1},binding:binding()}):reply(snapshot())});await f.client.restore();
 await f.client.request('town/state');await f.client.request('town/command',{method:'POST',body:{id:'fixed-id',type:'DAY_MOVE',payload:{location:'cafe'},expectedRevision:1}});
 const command=f.calls.find(c=>c.url.includes('/synk-town/command'));assert.equal(new URL(command.url).searchParams.get('classId'),A);
 revision=2;await assert.rejects(f.client.request('town/state'),{code:'TOWN_SNAPSHOT_CHANGED'});assert.equal(f.client.snapshot.accountId,A);
});
test('Town iframe host exposes methods, never credentials, and rejects a command after logout',async()=>{
 const f=fixture();await f.client.restore();const host=createTownWorldHost(f.client);
 assert.deepEqual(Object.keys(host),['appearance','subscribe','refresh','request','dispose']);assert.equal(JSON.stringify(host).includes('token-a'),false);
 await f.client.logout();const sent=f.calls.length;await assert.rejects(host.request('command',{id:'old'}),{code:'ACCOUNT_CHANGED'});assert.equal(f.calls.length,sent);assert.equal(host.appearance().verified,false);host.dispose();
});
test('enrollment only calls fixed preview/claim route and never treats a token as automatic enrollment',async()=>{
 const f=fixture({fetcher:async url=>url.includes('/enrollment/')?reply({ok:true,invite:{className:'fixture'}}):reply(snapshot())});await f.client.restore();
 const before=f.calls.length;assert.equal(f.calls.some(c=>c.url?.includes('/enrollment/')),false);
 await f.account.enrollmentRequest('preview',{token:'synthetic-invite'});assert.equal(f.calls.length,before+1);assert.ok(f.calls.at(-1).url.endsWith('/synk-classroom/api/enrollment/preview'));
 await assert.rejects(f.account.enrollmentRequest('unsafe',{token:'x'}),TypeError);
});
test('account logout and verified re-login clear the old rehearsal marker without replaying synthetic login',async()=>{
 const f=fixture();await f.client.restore();await f.client.logout();assert.equal(f.tab.getItem('synk-world-v1-signed-out'),null);
 // A previous version may have left the rehearsal marker in this same tab.
 f.tab.setItem('synk-world-v1-signed-out','1');f.tab.setItem('synk.oauth.session.world',JSON.stringify({access_token:'fresh-token-a',refresh_token:null,expires_at:Date.now()+3600000}));
 assert.equal(await f.client.restore(),true);assert.equal(f.tab.getItem('synk-world-v1-signed-out'),null);assert.equal(f.client.snapshot.accountId,A);
 assert.equal(f.calls.some(call=>call.url?.includes('/rehearsal/')),false);
});
