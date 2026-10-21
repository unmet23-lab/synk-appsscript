// Disposable loopback QA: actual account view + learning engine, synthetic memory only.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const account = path.join(root, 'experiences/synk-account');
const { build } = createRequire(path.join(account, 'package.json'))('esbuild');
const source = `
import { createAccountView } from './src/account-view.mjs';
import Browser from '../../atlas/game-browser.js';
const stored = new Map(), events = [];
const storage = { getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key) };
Object.defineProperty(window,'localStorage',{value:storage});
window.SynkLearning = {engine:{...Browser.engine,createLearningSync:options=>Browser.engine.createLearningSync({...options,maxAttempts:1,auto:false})}};
let online=false, sequence=0, accountUpdated=false;
const client = {
  setLearning:async()=>{throw new Error('합성 연결 중단: 학습 연결 변경 결과를 확인하지 못했어요.');},
  revokeSession:async()=>{accountUpdated=true;return {ok:true};},
  load:async()=>({ok:true,account:{synk_user_id:'synthetic-qa-records',status:'active',profile:{display_name:accountUpdated?'새 표시 이름':'검수 예시'}},learning:{enabled:true,revision:1},capabilities:{learningSync:true},memberships:accountUpdated?[{role:'student',student_code:'CLASS-02'}]:[],entitlements:accountUpdated?[{key:'WORLD 체험',product:'world',status:'active'}]:[],sessions:[{id:'qa-phone',label:'검수 휴대폰',revoked:accountUpdated}]}),
  learning:{get:async({after})=>({ok:true,revision:1,cursor:events.length,hasMore:false,events:events.slice(after)}),post:async({events:sent})=>{if(!online)throw new Error('synthetic offline');for(const event of sent)if(!events.some(row=>row.id===event.id))events.push(event);return {ok:true,revision:1,accepted:sent.map(row=>row.id)};}}
};
const view=createAccountView({client,product:'world',guard(){},notice:text=>{document.getElementById('notice').textContent=text;},logout:async()=>view.stop()});
await view.load();
if(location.pathname==='/account-refresh')document.getElementById('world-games').before(document.getElementById('account'));
document.getElementById('qa-account')?.addEventListener('click',async()=>{accountUpdated=true;view.applyAccount(await client.load());document.getElementById('notice').textContent='합성 계정의 최신 이름·소속·이용권·로그인 기기 상태를 반영했어요.';});
const game=window.SYNKLearningHost.createGame({gameId:'qa'},Browser.engine.createGame,Browser.engine.createLearningSync);
document.getElementById('qa-record').onclick=()=>{const id='qa-'+(++sequence);game.answer(game.present({id,itemKey:id,skillId:'ko.reading.detail',modality:'reading',difficulty:1,responseFormat:'single-choice'}),{correct:true,assessable:true});};
document.getElementById('qa-online').onclick=()=>{online=true;document.getElementById('qa-state').textContent='합성 연결 복구됨 · 아래 학습 기록 다시 연결을 누르세요.';};
window.addEventListener('pagehide',()=>view.stop());
`;
const built = await build({ stdin: { contents: source, resolveDir: account, sourcefile: 'qa-round2.mjs' }, bundle: true, write: false, format: 'esm', platform: 'browser' });
const callbackSource = `
import { createAccountNotebook } from './src/account-notebook.mjs';
import { createProductAccount } from './src/product-account.mjs';
import * as core from './src/core.mjs';
const values = new Map(), storage = { get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k) };
const config={version:1,supabaseUrl:'https://auth.example.test',accountApiUrl:'https://api.example.test',supabasePublishableKey:'sb_publishable_fixture',portalUrl:'https://portal.example.test',clients:{'family-album':{clientId:'fixture-family',redirectUri:location.origin+'/callback-retry'}}};
const auth=new URL(await core.beginOAuth({config:core.readConfig(config,location.href),product:'family-album',storage}));
let callback=location.origin+'/callback-retry?code=synthetic-code&state='+auth.searchParams.get('state'),attempts=0;
const empty=()=>({format:'synk-family-album-manifest',version:1,pages:[]});
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const notebook=createAccountNotebook({resource:'family-album',mount:document.getElementById('notebook'),content:document.getElementById('record'),description:'계정에서 가족의 기록을 다시 불러옵니다.',getState:empty,emptyDocument:empty,storage,
applyState:()=>{},onMode:mode=>{document.getElementById('record-message').textContent=mode?'합성 가족 앨범을 같은 계정으로 다시 연결했어요.':'합성 계정 연결을 확인하고 있어요.';},
accountFactory:options=>createProductAccount({...options,storage,getUrl:()=>callback,replaceUrl:value=>{callback=value;},navigate:()=>{throw Error('Unexpected OAuth redirect');},loadCore:async()=>core,
fetcher:async(input,init={})=>{const url=String(input);if(url.endsWith('/api/account-config'))return response(config);if(url.endsWith('/oauth/token')){attempts++;document.getElementById('attempts').textContent='로그인 연결 시도 '+attempts+'회';return attempts===1?response({},503):response({access_token:'synthetic-only',refresh_token:'synthetic-only-refresh',expires_in:3600});}if(url.includes('/functions/v1/synk-personal'))return response({ok:true,scope:'synk-personal',resource:'family-album',accountId:'synthetic-family',revision:0,state:empty()});throw Error('Unexpected fixture request');}})});
await notebook.start();window.addEventListener('pagehide',event=>{if(event.persisted)notebook.suspend();else notebook.dispose();});
window.addEventListener('pageshow',event=>{if(event.persisted){document.getElementById('lifecycle').textContent='브라우저 뒤로가기 복원 · 같은 계정 확인 중';void notebook.resume().then(ok=>{document.getElementById('lifecycle').textContent=ok?'브라우저 뒤로가기 복원 · 같은 계정 확인 완료':'브라우저 뒤로가기 복원 · 연결 확인 필요';});}});
document.getElementById('qa-suspend').onclick=()=>{notebook.suspend();document.getElementById('lifecycle').textContent='합성 보존 상태 · 계정 자료 숨김';};
document.getElementById('qa-resume').onclick=async()=>{const ok=await notebook.resume();document.getElementById('lifecycle').textContent=ok?'합성 복원 완료 · 같은 계정 확인, 초안 유지':'합성 복원 · 연결 확인 필요';};
`;
const callbackBuilt=await build({stdin:{contents:callbackSource,resolveDir:account,sourcefile:'qa-callback.mjs'},bundle:true,write:false,format:'esm',platform:'browser'});
const clientBuilt = await build({ entryPoints: [path.join(account,'src/client.mjs')], bundle: true, write: false, format: 'esm', platform: 'browser' });
const clientHtml = (await fs.readFile(path.join(account,'client.html'),'utf8')).replace('<script src="../learning-hub/atlas-learning.js"></script>','').replace('./dist/client.js','/client-runtime.js');
let configReads = 0;
const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK 기록 연결 · 합성 검수</title><link rel="stylesheet" href="/assets/scrapbook.css"><link rel="stylesheet" href="/style.css"></head><body class="sb-page"><main><header><span class="brand">synk</span><strong>합성 검수 화면</strong></header><h1>내 학습 기록 이어가기</h1><p class="small">실제 로그인·회원 자료·서버 저장 없이 현재 화면과 기록 연결 모듈을 검사합니다.</p><details><summary>검수 조작</summary><div class="actions"><button id="qa-record">검수: 새 연습 기록</button><button id="qa-online">검수: 연결 복구</button></div><p id="qa-state">합성 저장 통신 실패 상태</p></details><p id="notice" class="small" role="status"></p><section id="world-games"></section><section id="account"></section></main><script type="module" src="/fixture.js"></script></body></html>';
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/') { res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return; }
  if (url.pathname === '/account-refresh') { res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html.replace('내 학습 기록 이어가기','내 계정 정보 이어보기').replace('<button id="qa-record">','<button id="qa-account">검수: 다른 기기 정보 반영</button><button id="qa-record">').replace('합성 저장 통신 실패 상태','합성 계정 정보 변경 검수'));return; }
  if (url.pathname === '/fixture.js') { res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(built.outputFiles[0].text);return; }
  if (url.pathname === '/callback-retry') { res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK 로그인 연결 복구 · 합성 검수</title><link rel="stylesheet" href="/assets/scrapbook.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/src/account-notebook.css"></head><body class="sb-page"><main><header><span class="brand">synk</span><strong>합성 검수 화면</strong></header><h1>로그인 뒤 기록 이어가기</h1><p>실제 회원·운영 서버 없이 첫 로그인 연결만 실패시킨 검수입니다.</p><p id="attempts"></p><section id="notebook"></section><section id="record"><p id="record-message"></p><label>작성 중인 합성 초안<textarea id="qa-draft"></textarea></label></section><p id="lifecycle"></p><div class="actions"><button id="qa-suspend">검수: 화면 보존</button><button id="qa-resume">검수: 화면 복원</button></div><a href="/account-refresh">검수: 다른 화면으로 이동</a></main><script type="module" src="/callback-fixture.js"></script></body></html>');return; }
  if (url.pathname === '/callback-fixture.js') { res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(callbackBuilt.outputFiles[0].text);return; }
  if (url.pathname === '/client.html') { res.setHeader('Content-Type','text/html; charset=utf-8');res.end(clientHtml);return; }
  if (url.pathname === '/client-runtime.js') { res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(clientBuilt.outputFiles[0].text);return; }
  if (url.pathname === '/config.json') { res.setHeader('Content-Type','application/json');res.statusCode=++configReads === 1?503:200;res.end(JSON.stringify({version:1}));return; }
  const name = decodeURIComponent(url.pathname).slice(1);
  if (name.includes('..') || name.includes('\\') || !(['style.css','src/account-notebook.css','world-classroom.css','platform.webmanifest','world.webmanifest'].includes(name) || name.startsWith('assets/'))) { res.writeHead(404);res.end();return; }
  try { const body = await fs.readFile(path.join(account,name));const types={'.css':'text/css','.woff2':'font/woff2','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png'};res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.end(body); }
  catch { res.writeHead(404);res.end(); }
});
server.listen(4328,'127.0.0.1',()=>console.log('Synthetic account QA: http://127.0.0.1:4328/'));
