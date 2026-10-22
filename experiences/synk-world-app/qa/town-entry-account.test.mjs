import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldAccount} from '../world-account.mjs';
import {WorldClient} from '../world-client.mjs';
import {createTownWorldHost} from '../world-town-client.mjs';
import {createPositionView} from '../world-position-ui.mjs';
import {t,hasString,formatDate} from '../../brand-opening/world-lang.mjs';
import * as town from '../world-town-check.mjs';

// 싱크타운 입장 확인 경로(town/check · town/placement)의 계정 연결·타운 호스트·끝 화면 — 학습·개인화 다리 설계 §4·§5.
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',CLASS='33333333-3333-4333-8333-333333333333';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/portal/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const storage=()=>{const data=new Map();return {data,get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const reply=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const snapshot=(id=A)=>({ok:true,accountId:id,revision:1,avatar:{slots:{}},inventory:[]});
function web(answer){
 const tab=storage(),calls=[];tab.setItem('synk.oauth.session.world',JSON.stringify({access_token:'token-a',refresh_token:'refresh-a',expires_at:Date.now()+3600000}));
 const account=createWorldAccount({config,storage:tab,getUrl:()=>'https://world.example.test/world/',replaceUrl:()=>{},navigate:()=>{},
  accountFactory:()=>({load:async()=>({ok:true,account:{synk_user_id:A,status:'active'},sessions:[]}),revokeSession:async()=>({refreshRevoked:true})}),
  fetcher:async(url,init)=>{calls.push({url,init});return answer?.(url,init)??reply(snapshot());}});
 const client=new WorldClient({account,storage:storage(),tabStorage:tab,broadcastAppearance:false});
 return {account,client,calls};
}

test('웹: 입장 확인·배치는 synk-town 함수로 몸통과 함께 가고, 반 연결(classId)을 붙이지 않으며, 다른 계정의 응답은 받지 않는다',async()=>{
 const f=web(url=>url.includes('/synk-town/state')?reply({ok:true,accountId:A,state:{revision:1},binding:{kind:'academy',classId:CLASS,townId:CLASS,learnerId:CLASS,membershipRevision:1,sharing:{enabled:false,revision:1}}})
  :url.includes('/synk-town/check')?reply({ok:true,accountId:A,allowed:false,reason:'learning-check',outcome:'not-yet',missing:['reading']})
  :url.includes('/synk-town/placement')?reply({ok:true,accountId:A,allowed:true,placement:{reading:'L2',listening:'L1'}}):undefined);
 await f.client.restore();assert.equal(f.account.supportsTownCheck,true);
 await f.client.request('town/state');// 반이 연결된 마을을 한 번 열었다(classId가 생긴다).
 const body={bankHash:null,sound:true,answers:[]},result=await f.client.request('town/check',{method:'POST',body});
 assert.equal(result.outcome,'not-yet');assert.deepEqual(result.missing,['reading']);
 const check=f.calls.find(c=>c.url.includes('/synk-town/check'));
 assert.equal(check.url,'https://identity.example.test/functions/v1/synk-town/check');assert.equal(check.init.method,'POST');assert.deepEqual(JSON.parse(check.init.body),body);
 await f.client.request('town/placement',{method:'POST',body:{reading:'L2',listening:'L1'}});
 assert.equal(f.calls.find(c=>c.url.includes('/synk-town/placement')).url,'https://identity.example.test/functions/v1/synk-town/placement');
 await assert.rejects(f.account.request('town/check',{method:'GET'}),TypeError,'only POST reaches the check route');
 const other=web(url=>url.includes('/synk-town/check')?reply({ok:true,accountId:B,allowed:true}):undefined);await other.client.restore();
 await assert.rejects(other.client.request('town/check',{method:'POST',body:{}}),{code:'ACCOUNT_MISMATCH'});
});

function native(routes){
 const calls=[];
 const bridge={getEnvironment:async()=>({clientId:'world',...(routes===undefined?{}:{worldRoutes:routes})}),
  authStatus:async()=>({configured:true,signedIn:true,status:'signed-in',sessionGeneration:1,account:{synk_user_id:A}}),
  onAuthChanged:()=>()=>{},authSignIn:async()=>({ok:true}),authSignOut:async()=>({ok:true,serverRevoked:true}),
  accountRequest:async(operation,params={})=>{calls.push({operation,params});
   if(operation==='load')return {ok:true,account:{synk_user_id:A,status:'active'},sessions:[]};
   if(operation==='worldRequest'&&params.route==='town/check')return {ok:true,accountId:A,allowed:true,outcome:'passed',missing:[]};
   throw Error('본체에 뜻밖의 요청: '+operation+' '+params.route);}};
 const account=createWorldAccount({config,bridge,storage:storage(),getUrl:()=>'https://world.example.test/world/',onInvalidate:()=>{},
  fetcher:()=>{throw Error('PC 앱은 토큰으로 직접 묻지 않는다');},navigate:()=>{throw Error('PC 앱은 브라우저 로그인을 쓰지 않는다');}});
 return {account,calls:()=>calls.filter(c=>c.operation==='worldRequest')};
}
test('PC 앱: 본체가 두 경로를 알릴 때만 열고, 옛 PC 앱은 본체에 묻지 않고 막는다',async()=>{
 for(const routes of [undefined,['bootstrap','town/entry'],['town/check']]){
  const f=native(routes);assert.equal(await f.account.restore(),true);assert.equal(f.account.supportsTownCheck,false,JSON.stringify(routes));
  await assert.rejects(f.account.request('town/check',{method:'POST',body:'{}'}),{code:'TOWN_CHECK_UNSUPPORTED'});assert.equal(f.calls().length,0);f.account.stop();
 }
 const f=native(['town/entry','town/check','town/placement']);await f.account.restore();assert.equal(f.account.supportsTownCheck,true);
 const response=await f.account.request('town/check',{method:'POST',body:JSON.stringify({sound:false})});
 assert.equal((await response.json()).outcome,'passed');assert.deepEqual(f.calls()[0].params,{route:'town/check',body:{sound:false}});f.account.stop();
});

test('타운 호스트: 첫 장면 배치를 제안·고른 값·물을지로 알려 주고, 고른 값은 town/placement로 남긴다',async()=>{
 const requests=[];
 const client={snapshot:{accountId:A},generation:1,refresh:async()=>({}),request:async(path,options)=>{requests.push({path,options});return {ok:true,accountId:A,placement:{rule:'town-placement-r1',...options.body,at:'2026-10-22T06:00:00.000Z'}};}};
 const material={chosen:null,suggest:()=>({reading:'L3',listening:'L1',basis:'first-answers'}),ask:town.placementAsk,choose:town.placementChoice};
 const host=createTownWorldHost(client,{placement:material});
 assert.deepEqual(host.placement(),{suggested:{reading:'L3',listening:'L1'},chosen:null,ask:true});
 const chosen=await host.choosePlacement('easier');
 assert.deepEqual(requests[0],{path:'town/placement',options:{method:'POST',body:{reading:'L2',listening:'L1',suggested:{reading:'L3',listening:'L1'}}}});
 assert.equal(chosen.reading,'L2');assert.equal(host.placement().ask,false,'a chosen level is not asked again');
 const preview=createTownWorldHost(client);
 assert.deepEqual(preview.placement(),{suggested:{reading:'L1',listening:'L1'},chosen:null,ask:false});
 await assert.rejects(preview.choosePlacement('keep'),TypeError);
 host.dispose();assert.throws(()=>host.placement(),{code:'ACCOUNT_CHANGED'});
});

test('끝 화면: 숫자 없이 열렸는지·다시 볼 수 있는지와 연습 추천 하나, 이번에 푼 문항 줄은 진단과 같다 — 이용권만 없으면 미통과로 보이지 않는다',()=>{
 const view=createPositionView({t,has:hasString,formatDate});
 const map={skills:[{id:'ko.reading.detail',label:'세부 내용'},{id:'ko.listening.main',label:'중심 내용'}]};
 const results=[{skillId:'ko.reading.detail',itemId:'x',verdict:'incorrect',skipped:false},{skillId:'ko.listening.main',itemId:'y',verdict:'correct',skipped:false}];
 const practice=id=>id==='ko.reading.detail'?{route:'practice',skillId:id}:null;
 const passed=view.renderTownCheckDone({outcome:'passed',results,map,practice});
 assert.match(passed,/마을이 열렸어요/);assert.match(passed,/data-town-open/);assert.doesNotMatch(passed,/data-town-recheck|data-town-recommend/);
 const notYet=view.renderTownCheckDone({outcome:'not-yet',results,map,recommend:{skillId:'ko.reading.detail'},practice});
 assert.match(notYet,/조금 더 연습한 뒤에 다시 열어 볼 수 있어요/);assert.match(notYet,/data-town-recommend/);assert.match(notYet,/data-town-recheck/);assert.match(notYet,/data-town-position/);
 assert.equal((notYet.match(/data-position-practice=/g)||[]).length,1,'one practice recommendation, not one per row');
 assert.equal((notYet.match(/<li /g)||[]).length,2);
 const later=view.renderTownCheckDone({outcome:'later',results:[],recommend:null});assert.match(later,/지금은 확인을 마치지 못했어요/);assert.doesNotMatch(later,/data-town-recommend/);
 const short=view.renderTownCheckDone({outcome:'short',results:[]});assert.match(short,/새 확인 문제가 모자라요/);
 // 확인은 마쳤는데 체험·이용권이 없으면(아르곤 A1): 「마쳤어요」와 이용권 범위, 다시 확인·연습 권유 없음.
 const access=view.renderTownCheckDone({outcome:'access',results,map,recommend:{skillId:'ko.reading.detail'},practice});
 assert.match(access,/마을 준비 확인은 마쳤어요/);assert.match(access,/체험이나 이용권으로 열리는 곳이에요/);
 assert.doesNotMatch(access,/data-town-recheck|data-town-recommend|조금 더 연습/);assert.match(access,/data-town-position/);
 // 학습자는 싱크타운 시트에서 왔다 — 시트로 돌아가는 길과 「내 위치 보기」(Fable F3).
 for(const html of [access,notYet,later,short])assert.match(html,/data-town-open[^>]*>싱크타운으로 돌아가기/),assert.match(html,/내 위치 보기/),assert.doesNotMatch(html,/내 위치로 돌아가기/);
 // 운영에서 회수한 통과(held)는 다시 확인을 권하지 않고, 판을 맞추는 중(deferred)은 때를 약속하지 않는다(Fable F4).
 const held=view.renderTownCheckDone({outcome:'held',results:[]});assert.match(held,/지금은 마을이 닫혀 있어요/);assert.doesNotMatch(held,/data-town-recheck/);
 const deferred=view.renderTownCheckDone({outcome:'deferred',results:[]});assert.match(deferred,/새 판으로 맞추고 있어요/);assert.match(deferred,/data-town-recheck/);
 // 끝 화면 줄에는 내 위치 판의 「확인 중」을 달지 않는다(Fable F2).
 for(const html of [passed,notYet,access])assert.doesNotMatch(html,/확인 중/);
 for(const html of [passed,notYet,later,short,access,held,deferred])assert.doesNotMatch(html.replace(/<[^>]+>/g,' '),/\d\s*\/\s*\d|\d+\s*(점|급|개 중|문제 중)/,'no score, grade or count');
 // 기다림 화면은 패널 제목(마을 준비 확인)을 되풀이하지 않는다(아르곤 B2). 문항을 다 푼 뒤에는 방금 푼 답까지 모은다고 말한다.
 for(const after of [false,true]){const wait=view.renderTownCheckWait({after});assert.match(wait,/aria-busy="true"/);assert.doesNotMatch(wait,/마을 준비 확인/);}
 assert.match(view.renderTownCheckWait({after:true}),/방금 푼 답까지/);assert.match(view.renderTownCheckWait(),/이미 푼 TOPIK 연습 답/);
});
