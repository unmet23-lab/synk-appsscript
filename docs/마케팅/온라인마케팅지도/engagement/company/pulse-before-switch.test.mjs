// PULSE 스위치를 켜기 전 후속(2026-11-11, 기획 docs/마케팅/PULSE_의뢰흐름_20261104/다국어와_고객전용인물_기획_20261108.md 12-11).
// 판 6 통합 확인이 넘긴 것: 끊긴 채 다시 연 앱의 언어 · 느린 연결의 첫 기다림 글 · 「동작 시안」 용어 · 내 모델 로그아웃 403 · 닫힌 다시 쓰기 방의 「내 모델 열기」 · 실패한 파일의 「다시 올리기」.
// 브라우저 동작(느린 연결 · 오프라인 · 업로드 실패 · 403)은 캡처 도구가 실제 서버로 본다 — 여기서는 갈래와 문장을 잠근다. 저장소 전용 tools/…는 가져오지 않는다(회사 판 격리 QA).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

globalThis.location??=new URL('http://localhost/pulse-app/');
const EN=(await import('./public/pulse-app/i18n/en.mjs')).default;
const {pickLocale,setLocale,locale,htmlLang,DICTIONARY_LOCALES,registerLocale,t}=await import('./public/pulse-app/i18n.mjs');
const {setOfferedLocales}=await import('./public/pulse-app/locale-menu.mjs');
const {emptyAnswers}=await import('./public/pulse-app/request-data.mjs');
const {roomModel}=await import('./public/pulse-app/room-view.mjs');
const {roomView}=await import('./public/pulse-app/film-views.mjs');
const {personaReuseLine}=await import('./public/pulse-app/persona-view.mjs');
const appDir=new URL('./public/pulse-app/',import.meta.url),read=name=>readFileSync(new URL(name,appDir),'utf8');
registerLocale('en',EN);

// ── 첫 기다림 글(boot-locale.js): 고전 스크립트를 가짜 문서 위에서 돌린다.
const SHELL_KO={loading:'프로젝트를 확인하고 있어요.',skip:'본문으로 건너뛰기',banner:'인터넷 연결이 끊겼어요. 쓰던 내용은 이 화면에 그대로 있어요.',brand:'PULSE 처음으로',title:'SYNK PULSE — 카메라 앞에서 10년, 배우가 AI 모델을 연출합니다'};
const SHELL_EN=Object.fromEntries(Object.entries(SHELL_KO).map(([key,value])=>[key,EN[value]]));
function boot({languages=['en-US'],storage={},search='',blocked=false}={}){
  const text={nodeType:3,nodeValue:SHELL_KO.loading},loading={lastChild:text},skip={textContent:SHELL_KO.skip},banner={textContent:SHELL_KO.banner},brand={label:SHELL_KO.brand,setAttribute(name,value){if(name==='aria-label')this.label=value;}};
  const html={lang:'ko'},document={documentElement:html,title:SHELL_KO.title,querySelector:selector=>({'#main .loading':loading,'.skip-link':skip,'#connection-banner':banner,'.app-header .brand':brand})[selector]||null};
  const localStorage={getItem(key){if(blocked)throw new Error('blocked');return Object.hasOwn(storage,key)?storage[key]:null;}};
  vm.runInNewContext(read('boot-locale.js'),{window:{localStorage},document,navigator:{languages,language:languages[0]||''},location:{search},URLSearchParams,JSON,Array,String});
  return {lang:html.lang,loading:text.nodeValue,skip:skip.textContent,banner:banner.textContent,brand:brand.label,title:document.title};
}
const ko={lang:'ko',...SHELL_KO},en={lang:'en',...SHELL_EN};
const last=(loc,allowed)=>({'pulse-locale-last':JSON.stringify({locale:loc,allowed})});

test('첫 기다림 글: 글은 영어 사전과 같은 문장이고, index.html에는 인라인 없이 같은 곳의 파일로 붙는다',()=>{
  for(const [key,value] of Object.entries(SHELL_EN))assert.ok(typeof value==='string'&&value&&read('boot-locale.js').includes(`${key}:'${value}'`),`${key} — i18n/en.mjs 「${SHELL_KO[key]}」와 같은 문장`);
  const index=read('index.html');
  const loadingAt=index.indexOf('프로젝트를 확인하고 있어요.</div></main>'),bootAt=index.indexOf('<script src="./boot-locale.js"></script>');
  assert.ok(loadingAt>0&&bootAt>loadingAt,'확인 중 글을 담은 <main>이 닫힌 뒤에 붙는다(그 글을 파싱 시점에 바로 찾는다 — 아르곤 B1)');
  assert.match(read('sw.js'),/FILES\.push\(BASE\+'boot-locale\.js'\);/);
  assert.match(readFileSync(new URL('./server.mjs',import.meta.url),'utf8'),/'brand-desk-view\.mjs','boot-locale\.js'\]\)files\['\/pulse-app\/'\+file\]=\['public\/pulse-app\/'\+file,'text\/javascript; charset=utf-8'\]/);
});

test('첫 기다림 글의 언어: 고른 것 → 마지막으로 정한 언어 → 링크 → 브라우저(한국어가 없으면 영어) → 한국어, 한국어면 손대지 않는다',()=>{
  assert.deepEqual(boot({languages:['en-US']}),en,'첫 방문 · 영어 브라우저');
  assert.deepEqual(boot({languages:['ko-KR','en-US']}),ko,'한국어 브라우저는 index.html 그대로');
  assert.deepEqual(boot({languages:['fr-FR']}),en,'한국어가 없는 브라우저는 영어');
  assert.deepEqual(boot({languages:['en-US'],storage:last('ko',['ko'])}),ko,'지난번 서버가 한국어만 허락했으면(스위치 끔) 영어 브라우저도 한국어');
  assert.deepEqual(boot({languages:['ko-KR'],storage:last('en',['ko','en'])}),en,'지난번에 영어로 정했으면 한국어 브라우저도 영어');
  assert.deepEqual(boot({languages:['en-US'],storage:{...last('en',['ko','en']),'pulse-locale':'ko'}}),ko,'손님이 고른 한국어가 먼저');
  assert.deepEqual(boot({languages:['ko-KR'],search:'?lang=en'}),en,'링크 언어');
  assert.deepEqual(boot({languages:['en-US'],search:'?mode=staff'}),ko,'직원 화면은 한국어');
  assert.deepEqual(boot({languages:['en-US'],search:'?demo=gift'}),ko,'옛 체험은 한국어');
  assert.deepEqual(boot({languages:['en-US'],blocked:true}),en,'저장소를 못 써도 멈추지 않고 브라우저로');
  assert.deepEqual(boot({languages:['en-US'],storage:{'pulse-locale-last':'{깨진'}}),en,'깨진 값은 없는 것으로');
  assert.deepEqual(boot({languages:['ko-KR'],storage:last('en',['ko'])}),ko,'허락 목록 밖의 언어는 없는 것으로');
});

// ── app.mjs applyLocale: 서버 답이 없을 때 마지막으로 정한 언어. 그 함수 묶음만 떼어 맥락에서 돌린다(app.mjs 전체 vm 시험과 같은 방식).
function localeRig({languages=['en-US'],chosen='',linkLang=''}={}){
  const app=read('app.mjs'),start=app.indexOf("const LAST_LOCALE='pulse-locale-last';"),end=app.indexOf('// 처음 그리기 전부터 있는 글');
  assert.ok(start>0&&end>start,'applyLocale 묶음을 찾는다');
  const store=new Map(),html={lang:'ko'};let painted=0;
  const localStorage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>{store.set(key,String(value));}};
  const context=vm.createContext({s:{mode:'customer'},linkLang,navigator:{languages},document:{documentElement:html},paintShell:()=>{painted++;},localStorage,pickLocale,setLocale,locale,htmlLang,DICTIONARY_LOCALES,setOfferedLocales,storedLocale:()=>chosen,JSON,Array});
  vm.runInContext(app.slice(start,end)+';this.applyLocale=applyLocale;',context);
  return {apply:features=>context.applyLocale(features),store,html,painted:()=>painted};
}
test('끊긴 채 다시 연 앱: 서버 답으로 정한 언어를 적어 두고, 답이 없으면 그 언어로 — 적어 둔 것이 없으면 지금처럼 한국어',async()=>{
  await setLocale('ko');
  const rig=localeRig({languages:['en-US']});
  await rig.apply({locales:['ko','en'],locale:'en'});
  assert.equal(locale(),'en');assert.equal(rig.html.lang,'en');
  assert.deepEqual(JSON.parse(rig.store.get('pulse-locale-last')),{locale:'en',allowed:['ko','en']});
  await setLocale('ko');
  await rig.apply(null);
  assert.equal(locale(),'en','끊긴 채 다시 열면 영어 그대로(판 6 F)');assert.equal(rig.html.lang,'en');
  assert.deepEqual(rig.store.get('pulse-locale-last'),JSON.stringify({locale:'en',allowed:['ko','en']}),'답 없이 정한 것은 적지 않는다');
  // 서버가 한국어만 허락하면(스위치 끔) 한국어로 정하고 그것을 적는다 — 다음에 끊겨도 한국어.
  await rig.apply({locales:['ko'],locale:'ko'});
  assert.equal(locale(),'ko');await rig.apply(undefined);assert.equal(locale(),'ko');
  // 적어 둔 것이 없으면(처음 끊긴 채 연 기기) 지금처럼 한국어.
  const fresh=localeRig({languages:['en-US']});await setLocale('ko');await fresh.apply(null);
  assert.equal(locale(),'ko');assert.equal(fresh.store.size,0);
  // 손님이 고른 언어가 먼저(명시 선택 > 마지막 판단).
  const picked=localeRig({languages:['en-US'],chosen:'ko'});await picked.apply({locales:['ko','en'],locale:'en'});assert.equal(locale(),'ko');
  picked.store.set('pulse-locale-last',JSON.stringify({locale:'en',allowed:['ko','en']}));await picked.apply(null);assert.equal(locale(),'ko');
  await setLocale('ko');
});
test('저장소를 못 쓰는 기기에서도 applyLocale은 멈추지 않는다',async()=>{
  const app=read('app.mjs'),start=app.indexOf("const LAST_LOCALE='pulse-locale-last';"),end=app.indexOf('// 처음 그리기 전부터 있는 글');
  const broken={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  const context=vm.createContext({s:{mode:'customer'},linkLang:'',navigator:{languages:['en-US']},document:{documentElement:{lang:'ko'}},paintShell(){},localStorage:broken,pickLocale,setLocale,locale,htmlLang,DICTIONARY_LOCALES,setOfferedLocales,storedLocale:()=>'',JSON,Array});
  vm.runInContext(app.slice(start,end)+';this.applyLocale=applyLocale;',context);
  await context.applyLocale({locales:['ko','en'],locale:'en'});assert.equal(locale(),'en');
  await context.applyLocale(null);assert.equal(locale(),'ko');
  await setLocale('ko');
});

// ── 「동작 시안」 한 낱말(판 3 고객 방 · 판 4 보관 동의 · 직원 데스크가 같은 말, 영어는 motion test).
test('용어: 손님 화면에 「움직이는 모습」이 남지 않고, 동작 시안 문장은 모두 motion test로 옮겨진다',()=>{
  for(const name of ['persona-view.mjs','request-flow.mjs','my-models.mjs','room-view.mjs','film-views.mjs','views.mjs','i18n/en.mjs'])assert.doesNotMatch(read(name),/움직이는 모습/,name);
  const keys=Object.keys(EN).filter(key=>key.includes('동작 시안'));
  assert.ok(keys.length>=10,'카드 · 일지 · 알림 · 의뢰서 문장');
  for(const key of keys){const value=EN[key];assert.match(typeof value==='string'?value:value.other,/motion test/i,key);}
});

// ── 닫힌 다시 쓰기 방: 서버가 인물을 싣지 않아도 내 모델로 맡긴 의뢰면 「내 모델 열기」 한 줄.
function reuseProject({persona=null}={}){
  const request={status:'confirmed',number:'P-1111-ABCD',submittedAt:'2026-11-11T00:00:00.000Z',confirmedAt:'2026-11-11T00:30:00.000Z',answers:{...emptyAnswers(),name:'합성 탄산수',kind:'food',channels:['shorts'],package:'s15',modelChoice:'persona'},files:[],asks:[],notes:[],rounds:[]};
  return {id:'p1',title:'합성 탄산수',ownerName:'김하늘',stage:'received',versions:[],messages:[],requestFlow:true,studio:{assets:[],scenes:[],strategy:{revision:1,data:{castingSelection:{}}},request},...(persona?{persona}:{})};
}
test('닫힌 다시 쓰기 방: 인물이 실리지 않아도 내 모델로 맡긴 의뢰면 「내 모델 열기」 한 줄 — 스위치가 꺼져(keep 없음) 있으면 판 4 그대로',()=>{
  const model=roomModel(reuseProject());assert.equal(model.persona,null);
  const off=roomView(model,{bar:false}),on=roomView({...model,keep:{projectId:'p1',state:'reuse'}},{bar:false});
  assert.ok(!off.includes('data-room-do="my-models"'),'keep이 없으면 줄이 없다');
  assert.equal(on.split(personaReuseLine()).length-1,1,'한 줄');
  assert.ok(on.includes('data-room-do="my-models"')&&!on.includes('data-room-do="keep"'));
  assert.equal(on.replace(personaReuseLine(),''),off,'그 줄 말고는 같다');
  for(const state of ['login','ask','member','pending'])assert.ok(!roomView({...model,keep:{projectId:'p1',state}},{bar:false}).includes('data-room-do'),'인물이 없는 방의 다른 회원 상태에는 줄이 없다: '+state);
  assert.ok(EN['내 모델로 맡긴 의뢰인데, 지금은 이 방에서 그 모델을 보여 드릴 수 없어요. 모델 상태는 내 모델에서 확인해 주세요.'],'영어 사전');
  const app=read('app.mjs');
  assert.match(app,/const reuseAsked=\(\)=>s\.project\?\.studio\?\.request\?\.answers\?\.modelChoice==='persona';/);
  assert.match(app,/const reuseRoom=\(\)=>s\.project\?\.persona\?\.mode==='reuse'\|\|!s\.project\?\.persona&&reuseAsked\(\);/,'인물이 없는 다시 쓰기 방은 서버에 묻지 않고 그 한 줄(모아 두기 요청 없음)');
});

// ── 내 모델 로그아웃 · 쓰기의 403: 세션을 다시 읽고 서버 글.
test('내 모델 403(다른 탭에서 다시 로그인): 세션을 다시 읽어 새 보안 값으로 바꾸고 서버 글을 보인다 — 다시 읽은 세션이 나간 상태면 나간 것으로',()=>{
  const mine=read('my-models.mjs');
  assert.match(mine,/async function resync\(\)\{try\{const before=st\.session\?\.csrfToken\|\|'',next=await send\(BASE\+'\/session'\);st\.session=next;if\(next\.authenticated\)\{if\(next\.csrfToken!==before\)\{st\.pick=null;st\.view='list';\}try\{st\.data=await send\(BASE\+'\/models'\);\}catch\{\}\}return !!next\.authenticated;\}catch\{return true;\}\}/,'다시 로그인이면 이름과 상관없이 목록도 다시 읽고, 못 읽으면 앞 목록을 남긴다');
  assert.match(mine,/catch\(err\)\{if\(err\.status===403&&!\(await resync\(\)\)\)err=\{status:401\};/,'보관 동의 · 끄기 · 멈추기 · 삭제 요청도 같은 길');
  assert.match(mine,/const memberCsrf=\(\)=>st\.session\?\.csrfToken\|\|'';/,'다음 쓰기는 다시 읽은 세션의 값');
  assert.equal(t('고객 로그인 상태를 다시 확인해 주세요.'),'고객 로그인 상태를 다시 확인해 주세요.');
  assert.ok(EN['고객 로그인 상태를 다시 확인해 주세요.'],'서버 글의 영어');
});

// ── 실패한 파일 줄의 「다시 올리기」.
test('업로드 실패: 같은 파일을 다시 보내면 될 수 있는 실패(끊김 · 서버 오류 · 시간 초과)만 「다시 올리기」, 답 항목에는 칸을 더하지 않는다',()=>{
  const flow=read('request-flow.mjs');
  assert.match(flow,/const retryable=new WeakMap\(\);/);
  assert.match(flow,/const canRetry=error=>\{const status=Number\(error\?\.status\)\|\|0;return !status\|\|status>=500\|\|status===408\|\|status===429;\};/);
  assert.match(flow,/catch\(error\)\{entry\.uploading=false;entry\.error=error\.message\|\|t\('올리지 못했어요\. 다시 시도해 주세요\.'\);if\(canRetry\(error\)\)retryable\.set\(entry,file\);\}/);
  assert.match(flow,/data-do="retryfile"[^`]*\$\{esc\(t\('다시 올리기'\)\)\}/);
  assert.doesNotMatch(flow,/entry\.retry|file\.retry/,'의뢰서 답(서버 허용 목록)에 새 칸이 없다');
  assert.equal(EN['다시 올리기'],'Retry');assert.equal(EN['{name} 다시 올리기'],'Retry uploading {name}');
  assert.match(read('film.css'),/\.sx-slot-files \.sx-slot-file-act\{display:flex;flex:none;gap:12px;overflow:visible\}/);
});

// ── 판 4 운영 시험이 넘긴 것(11-11, 기획 12-11 「찾은 것」): 0원 · 이름 없는 인물 안내 · 기준 얼굴 확인 뒤 다음 단계 · 직원 화면의 SYNK ID 끝자리.
test('0원은 「0원」이고, 직원 인물 칸은 이름이 없으면 알리고 기준 얼굴 확인 뒤에는 「먼저 올려 주세요」를 두지 않는다 — 연결 요청에 ID 끝 네 자리',async()=>{
  const {personaModel,personaCard}=await import('./public/pulse-app/persona-view.mjs');
  const quote={id:'11111111-1111-4111-8111-111111111111',kind:'virtual',status:'quote_review',step:3,turn:'customer',name:'',why:'',request:{look:'',use:'',keep:''},sources:{identity:0,mood:0,files:[]},canAddSources:false,
    quote:{price:0,days:3,revisions:1,scope:'기준 얼굴 1판',at:'2026-11-11T09:00:00.000Z'},revision:null,usage:null,awaiting:{kind:'scope',revisionId:null,viewedHash:'a'.repeat(64)},events:[],approvals:[]};
  const card=personaCard(personaModel({persona:quote}));
  assert.ok(card.includes('0원')&&!card.includes('0만원'),'손님 견적 0원');
  const desk=read('desk-view.mjs');
  assert.match(desk,/const won=value=>Number\.isSafeInteger\(value\)\?\(value&&value%10000===0\?/,'직원 견적 0원');
  assert.match(desk,/if\(!sendable\.length\)return current\?\.referenceApproved\?'':/,'손님이 기준 얼굴을 확인한 판에는 「기준 얼굴 그림을 판에 먼저 올려 주세요」가 다음 단계로 남지 않는다');
  assert.match(desk,/const unnamed=canEdit&&!p\.displayName&&Number\(p\.step\)>=4&&!\['withdrawn','retired','deleting','deleted'\]\.includes\(p\.status\);/);
  assert.match(desk,/<details class="desk-persona-more"\$\{unnamed\?' open':''\}><summary>이름 · 내부 메모<\/summary>/,'이름 칸을 펼쳐 둔다');
  const brand=read('brand-desk-view.mjs');
  assert.match(brand,/const idTail=x=>x\?\.idHint\?` · ID …\$\{x\.idHint\}`:'';/);
  assert.match(brand,/<div><dt>요청한 SYNK ID<\/dt><dd>\$\{esc\(c\.displayName\|\|'이름 없음'\)\}\$\{c\.idHint\?/);
});

test('보통 방의 「내 모델」 입구(판 4 운영 시험 P3): 스위치가 켜진 손님 방 아래 띠에 한 줄 — 이미 「내 모델 열기」가 있는 방(회원 · 다시 쓰기)은 빼고, 꺼지면 없다',async()=>{
  const {personaModelsLine}=await import('./public/pulse-app/persona-view.mjs');
  const line=personaModelsLine();
  assert.ok(line.includes('data-room-do="my-models"')&&line.includes('브랜드에 모델을 보관해 두면 다음 광고에 다시 쓸 수 있어요.'));
  assert.equal(EN['브랜드에 모델을 보관해 두면 다음 광고에 다시 쓸 수 있어요.'],'Your brand can keep models to reuse in future ads.');
  const views=read('views.mjs');
  // Fable 5.2 F4: 위 인물 칸이 실제로 「내 모델 열기」를 그린 방만 뺀다(인물이 끝난 방 turn end는 personaKeep이 그리지 않는다).
  assert.match(views,/const mine=s\.keep\?\.projectId===p\.id\?s\.keep\.state:'',kept=info\.persona\?info\.persona\.turn!=='end'&&\['member','reuse'\]\.includes\(mine\):mine==='reuse',models=s\.mode==='customer'&&!s\.demo&&s\.myModelsOn===true&&!kept\?personaModelsLine\(\):'';/);
  assert.match(views,/roomView\(info,\{bar:false,top:alertBox\(s\),after,foot:models,/);
  assert.match(read('app.mjs'),/function noteFeatures\(features\)\{if\(s\.mode!=='customer'\|\|!features\)return;projectFeatures=features;s\.myModelsOn=features\.myModels===true;/,'스위치 값은 그 프로젝트 응답의 것');
  // Fable 5.2 F3: 로그인 칸 · 빈 목록 안내는 그 단추가 있는 방(맞춤 인물을 만드는 의뢰)을 밝힌다 — 보통 방에서 들어온 손님이 없는 단추를 찾지 않게.
  const mine=read('my-models.mjs');
  assert.ok(mine.includes("t('브랜드 회원만 볼 수 있어요. 이미 회원이면 위에서 로그인해 주세요. 아직이면 맞춤 인물이 있는 의뢰의 고객 방에서 「내 모델로 모아 두기」를 눌러 주세요 — 담당자가 확인하고 브랜드에 연결해 드려요.')"));
  assert.ok(mine.includes("t('맞춤 인물이 있는 의뢰의 고객 방에서 「내 모델로 모아 두기」를 누르면, 담당자가 확인하고 브랜드에 연결해 드려요. 연결되면 여기에서 그 브랜드의 모델을 볼 수 있어요.')"));
  assert.ok(!mine.includes('진행 중인 의뢰의 고객 방에서'));
  for(const key of ['브랜드 회원만 볼 수 있어요. 이미 회원이면 위에서 로그인해 주세요. 아직이면 맞춤 인물이 있는 의뢰의 고객 방에서 「내 모델로 모아 두기」를 눌러 주세요 — 담당자가 확인하고 브랜드에 연결해 드려요.','맞춤 인물이 있는 의뢰의 고객 방에서 「내 모델로 모아 두기」를 누르면, 담당자가 확인하고 브랜드에 연결해 드려요. 연결되면 여기에서 그 브랜드의 모델을 볼 수 있어요.']){assert.match(EN[key],/Add to My models/,key);assert.match(EN[key],/your room for an order that includes a custom persona/,key);}
});

// Fable 5.2 최종(pulse-before-switch-screen4-20261111) F1 · F2 · F5 · F6.
test('Fable F1 · F2 · F5 · F6: 다시 올리기는 잃은 초점만 되돌리고 칸을 다시 그려도 쓰던 칸을 지키며, 첫 그리기는 boot 글을 지키고, 상태 줄은 올리는 중 → 실패 차례, 다른 계정 403은 목록도 다시 읽는다',()=>{
  const flow=read('request-flow.mjs');
  assert.ok(flow.includes('const box=host.querySelector(`[data-slot="${slot.id}"]`),now=document.activeElement,lost=!now||now===document.body||!!box&&box.contains(now)&&now.dataset?.status===slot.id;'),'F1 · -d P2 — 손님이 둔 초점은 옮기지 않고, 코드가 둔 자리(body · 그 칸의 상태 줄)에 있으면 잃은 것으로 본다');
  assert.match(flow,/if\(lost&&box\)\{if\(retryable\.has\(file\)\)box\.querySelector\(`\[data-do="retryfile"\]/,'Q1 — 실패해 다시 올리기가 남았을 때만 그 단추로');
  assert.match(flow,/else\{const status=box\.querySelector\(`\[data-status="\$\{slot\.id\}"\]`\);if\(status\)\{status\.setAttribute\('tabindex','-1'\);status\.focus/,'Q1 — 성공하면 지우는 단추가 아니라 상태 줄로');
  assert.doesNotMatch(flow,/\[data-do="\$\{retryable\.has\(file\)\?'retryfile':'removefile'\}"\]/,'Q1 — 성공 뒤 「지우기」로 초점을 옮기는 줄이 없다');
  assert.ok(flow.includes('const spot=ds.bind?`[data-bind="${ds.bind}"]`:ds.file?`[data-file="${ds.file}"]`:ds.key?`[data-do="${ds.do}"][data-key="${ds.key}"]`:ds.status!==undefined?`[data-status="${ds.status}"]`:'),'F1 · Q1 · -c P1 — 다시 그린 칸에서 글 칸 · 파일 고르기 · 줄 단추(그 파일의 표로) · 상태 줄의 초점 자리를 지킨다');
  assert.ok(!flow.includes('${ds.at?'),'-c P1 — 줄 번호(data-at)로 초점을 되찾지 않는다(위 줄이 지워지면 다른 파일로 간다)');
  assert.ok(flow.includes('target=again||next.querySelector(`[data-status="${slot.id}"]`)'),'-c P1 — 그 파일이 없어졌으면 지우는 단추가 아니라 상태 줄로');
  assert.ok(flow.includes('data-do="retryfile" data-slot-id="${slot.id}" data-at="${i}" data-key="${fileKey(file)}"'),'-c P1 — 다시 올리기 단추에 그 파일의 표');
  assert.ok(flow.includes('data-do="removefile" data-slot-id="${slot.id}" data-at="${i}" data-key="${fileKey(file)}"'),'-c P1 — 지우기 단추에 그 파일의 표');
  assert.ok(flow.includes('box.querySelector(`[data-do="retryfile"][data-key="${fileKey(file)}"]`)'),'-c P1 — 다시 올리기가 남았을 때도 그 파일의 표로 찾는다');
  assert.match(flow,/const last=files\.find\(file=>file\.uploading\)\|\|\[\.\.\.files\]\.reverse\(\)\.find\(file=>file\.error\)\|\|files\[files\.length-1\];/,'F5');
  const app=read('app.mjs');
  assert.match(app,/const loadingView=\(\)=>'<div class="loading" role="status"><span class="loading-mark"><\/span>'\+esc\(!localeChosen&&bootLoading&&locale\(\)==='ko'\?bootLoading:t\('프로젝트를 확인하고 있어요\.'\)\)\+'<\/div>';/,'F2');
  assert.match(app,/if\(next!==locale\(\)\)await setLocale\(next\);\r?\n\s*localeChosen=true;/,'F2 — 언어를 정한 뒤로는 그 언어');
  assert.match(read('my-models.mjs'),/if\(next\.authenticated\)\{if\(next\.csrfToken!==before\)\{st\.pick=null;st\.view='list';\}try\{st\.data=await send\(BASE\+'\/models'\);\}catch\{\}\}/,'F6');
  assert.equal(EN['내 모델로 맡긴 의뢰인데, 지금은 이 방에서 그 모델을 보여 드릴 수 없어요. 모델 상태는 내 모델에서 확인해 주세요.'],'This order uses a model from My models, but we can’t show that model here right now. Check its status in My models.','영어 001 — Fable 교정');
});

// ── 영어 첫 화면 글꼴 B(11-11, Noto Serif Display Light 300 · OFL — docs/브랜드_폰트/NotoSerifDisplay의 원본과 같은 바이트, 브랜드폰트.js처럼 읽는 자리에서 지문을 문다).
test('영어 제목 글꼴 B: 파일 지문 · 영어 화면에서만 쓰는 규칙 · 서버 정적 목록 · 셸 목록 — 한국어 화면은 이 파일을 쓰지 않는다',async()=>{
  const {createHash}=await import('node:crypto');
  const font=readFileSync(new URL('assets/NotoSerifDisplay-Light-latin.woff2',appDir));
  assert.equal(font.length,15056);assert.equal(font.toString('ascii',0,4),'wOF2');
  assert.equal(createHash('sha256').update(font).digest('hex'),'960dbacc752fb81ec5091c8e7e897f9d09479ecb60d4d6552fb57c386c85348c','Google Fonts 라틴 묶음 그대로(조용히 다른 글꼴이 들어오지 않게)');
  const css=read('film.css');
  assert.match(css,/@font-face\{font-family:'SX Display';src:url\('\.\/assets\/NotoSerifDisplay-Light-latin\.woff2'\) format\('woff2'\);font-weight:300;font-display:swap;unicode-range:U\+0000-00FF,/);
  assert.match(css,/html\[lang="en"\]\{--sx-serif:'SX Display','SX Latin Wide','SX Latin Local','Noto Serif KR','SX Name',serif\}/);
  assert.match(css,/html\[lang="en"\] :is\(\.sx-serif,\.sx-display\)\{letter-spacing:-\.005em\}/);
  assert.equal((css.match(/'SX Display'/g)||[]).length,2,'정의 하나 · 영어 화면 규칙 하나뿐 — 한국어 화면의 글꼴 줄에는 없다');
  assert.ok(!read('index.html').includes('NotoSerifDisplay'),'미리 받지 않는다(영어 화면에서만)');
  assert.match(read('sw.js'),/RUNTIME\.push\(BASE\+'assets\/NotoSerifDisplay-Light-latin\.woff2'\);\r?\nconst ALLOWED = new Set\(\[\.\.\.FILES,\.\.\.RUNTIME\]\);/,'셸이 미리 받지 않고 영어 화면이 받을 때 담는다(첫 방문 무게 v41의 RUNTIME)');
  assert.doesNotMatch(read('sw.js'),/FILES\.push\(BASE\+'assets\/NotoSerifDisplay/);
  assert.match(readFileSync(new URL('./server.mjs',import.meta.url),'utf8'),/files\['\/pulse-app\/assets\/NotoSerifDisplay-Light-latin\.woff2'\]=\['public\/pulse-app\/assets\/NotoSerifDisplay-Light-latin\.woff2','font\/woff2'\];/);
  assert.equal(EN['카메라 앞에서 10년,'],'AI models');assert.equal(EN['배우가 AI 모델을'],'can look real.');assert.equal(EN['연출합니다'],'We make them act.');
});

test('다시 검수 Q1: 상태 줄에 초점이 있을 때 누른 Enter는 다음 단계로 넘기지 않는다',()=>{
  assert.match(read('request-flow.mjs'),/!\['file','checkbox'\]\.includes\(event\.target\.type\)&&event\.target\.dataset\?\.status===undefined&&step\(\)\.id!=='review'\)\{event\.preventDefault\(\);actions\.next\(\);\}/);
});
