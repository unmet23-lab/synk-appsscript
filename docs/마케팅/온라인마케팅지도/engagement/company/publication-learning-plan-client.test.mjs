import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const content=readFileSync(new URL('./public/content.js',import.meta.url),'utf8');
const source=readFileSync(new URL('./public/publication-learning-plan.js',import.meta.url),'utf8');
const entryId='a'.repeat(64),experimentId='repeat-structure';
const plain=value=>JSON.parse(JSON.stringify(value));
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const data=()=>({catalog:{series:[{id:'synkbrief-use',name:'활용'},{id:'lab-expression',name:'표현'}]},drafts:[],references:[]});
const input=()=>({topic:'원래 콘텐츠 제목',editorialNote:'72시간 관측 · 조회 0 · 좋아요 미확인\nhttps://www.youtube.com/shorts/abcDEF12345\n관측 시점과 비교 표본을 확인하세요.',experience:'확인한 성과에서 다음 시도를 고릅니다.',authenticity:{basis:'관측 기록',limits:'실험 후보이며 원인이나 예상 성과는 검증하지 않았습니다.'},channelId:'shared-channel',seriesId:'lab-inferred',unexpected:'ignored'});
function fixture({loaded=true}={}){
  const handlers=new Map(),windowHandlers=new Map(),requests=[],modals=[],timers=new Map(),nodes=new Map(),notifications=[];let timerId=0,auth=1,focus=0,renders=0,closes=0;
  const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const context=vm.createContext({console,URL,JSON,Promise,AbortController,structuredClone,queueMicrotask,
    state:{user:{id:'A',role:'member'},tab:'workroom',modalRequest:0,data:{channels:[]}},wr:{view:'tools'},makerTools:{view:'publication'},pf:{view:'performance',epoch:1},
    document:{addEventListener(type,handler,capture){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push({handler,capture});},querySelector(selector){if(selector==='[data-cp-input][name="topic"]')return {focus(){focus++;}};return nodes.get(selector)||null;},querySelectorAll(){return [];}},
    window:{scrollTo(){},addEventListener(type,handler){windowHandlers.set(type,handler);}},
    setTimeout(handler,delay){const id=++timerId;timers.set(id,{handler,delay});return id;},clearTimeout(id){timers.delete(id);},
    companyAuthSnapshot:()=>({generation:auth,userId:context.state.user?.id||null}),companyAuthCurrent:stamp=>stamp.generation===auth&&stamp.userId===(context.state.user?.id||null),
    api(path,body,method,options={}){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.push({path,body,method,options,resolve,reject});return promise;},
    modal(title,subtitle,html){context.state.modalRequest++;modals.push({title,subtitle,html});for(const name of ['keep','replace']){const node={listener:null,addEventListener(type,listener){this.listener=listener;}};nodes.set('[data-plp-choice="'+name+'"]',node);}},
    closeModal(){closes++;context.state.modalRequest++;nodes.clear();},render(){renders++;},isViewer:()=>context.state.user?.role==='viewer',notify:message=>notifications.push(message),
    bmReset(){},bmSelection:()=>'',cpReviewAxes:()=>'',time:()=>'',cpPersonalizationFields:[['situation'],['choice'],['nextStep']],cpPersonalizationInput:()=>'',canEditChannel:()=>true,channelName:row=>row.id,icon:()=>'',escape,
    FormData:class{constructor(form){this.values=form.values;}[Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();}},
    swLoadExamples:async()=>{},button:()=>'',dateToday:()=> '2026-10-11'
  });
  vm.runInContext(content,context,{filename:'content.js'});vm.runInContext(source,context,{filename:'publication-learning-plan.js'});
  const evaluate=code=>vm.runInContext(code,context),cp=evaluate('cp');cp.userId='A';cp.data=loaded?data():null;
  return {context,cp,requests,modals,timers,notifications,evaluate,windowHandlers,
    open:()=>evaluate('openPublicationLearningPlan("'+entryId+'","'+experimentId+'")'),
    choose(name){const node=nodes.get('[data-plp-choice="'+name+'"]');assert.ok(node,'choice is present');node.listener();},
    tick(){const [id,timer]=timers.entries().next().value||[];if(timer){timers.delete(id);timer.handler();}},
    bumpAuth(){auth++;},
    async emit(type,target){for(const {handler}of [...(handlers.get(type)||[])].sort((a,b)=>Number(Boolean(b.capture))-Number(Boolean(a.capture))))await handler({target,preventDefault(){}});},
    get focus(){return focus;},get renders(){return renders;},get closes(){return closes;}
  };
}
function respond(f,index=0,value=input()){f.requests[index].resolve({input:value,card:{entryId},experiment:{id:experimentId}});}

test('a selected experiment opens the existing composer with evidence, private scope and no save or AI call',async()=>{
  const f=fixture();f.cp.input.seriesId='lab-expression';const pending=f.open();assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/api/publication-learning/'+entryId+'/plan');assert.deepEqual(plain(f.requests[0].body),{experimentId});respond(f);
  assert.equal(await pending,true);assert.equal(f.context.state.tab,'content');assert.equal(f.cp.view,'plan');assert.equal(f.cp.input.topic,input().topic);assert.equal(f.cp.input.editorialNote,input().editorialNote);assert.equal(f.cp.input.channelId,'');assert.equal(f.cp.input.seriesId,'lab-expression');assert.equal(f.cp.input.unexpected,undefined);assert.equal(f.cp.draftId,'');assert.equal(f.cp.activeDraft,null);assert.equal(f.cp.pendingDraftId,'');assert.equal(f.cp.ideaId,'');assert.equal(f.cp.results,null);assert.equal(f.focus,1);assert.equal(f.requests.length,1);assert.equal(f.timers.size,0);
});

test('keeping unsaved input makes no request and changes none of the existing composer state',async()=>{
  const f=fixture();f.cp.input.topic='내가 쓰던 기획';f.cp.input.authenticity.limits='남겨 둔 한계';const before=plain(f.cp),pending=f.open();assert.equal(f.requests.length,0);assert.match(f.modals[0].html,/작성 중인 기획 유지/);f.choose('keep');assert.equal(await pending,false);assert.deepEqual(plain(f.cp),before);assert.equal(f.requests.length,0);assert.equal(f.timers.size,0);
});

test('saved or pending drafts require replacement consent before reading fresh server evidence',async()=>{
  for(const state of [{draftId:'draft',activeDraft:{id:'draft',input:{proof:'원본'}}},{pendingDraftId:'pending'},{ideaId:'idea'},{results:{saved:true}}]){
    const f=fixture();Object.assign(f.cp,state);const saved=plain(f.cp.data),pending=f.open();assert.equal(f.requests.length,0);f.choose('replace');await flush();assert.equal(f.requests.length,1);respond(f);assert.equal(await pending,true);assert.deepEqual(plain(f.cp.data),saved);assert.equal(f.cp.draftId,'');assert.equal(f.cp.pendingDraftId,'');assert.equal(f.cp.ideaId,'');assert.equal(f.cp.results,null);
  }
});

test('closing or replacing the choice dialog settles cancellation without mutating or reopening it',async()=>{
  for(const action of ['close','replace']){
    const f=fixture();f.cp.input.topic='보존할 입력';const before=plain(f.cp),pending=f.open();if(action==='close')f.context.closeModal();else f.context.modal('다른 편집 창','','내용');f.tick();assert.equal(await pending,false);assert.deepEqual(plain(f.cp),before);assert.equal(f.requests.length,0);assert.equal(f.modals.length,action==='replace'?2:1);assert.equal(f.timers.size,0);
  }
});

test('missing catalog loads only after source validation and preserves a saved draft until both reads finish',async()=>{
  const f=fixture({loaded:false});f.cp.draftId='original';f.cp.activeDraft={id:'original',input:{topic:'저장된 원문'}};f.cp.input.topic='저장 뒤 더 쓴 내용';const before=plain(f.cp),pending=f.open();f.choose('replace');await flush();respond(f);await flush();assert.equal(f.requests.length,2);assert.equal(f.requests[1].path,'/api/content-workspace');assert.deepEqual(plain(f.cp),before);assert.ok(!f.requests.some(row=>row.path.includes('/api/content-drafts/')));f.requests[1].resolve(data());assert.equal(await pending,true);assert.equal(f.cp.input.editorialNote,input().editorialNote);assert.equal(f.cp.draftId,'');
});

test('catalog errors and revoked source permission preserve the current draft and surface only current errors',async()=>{
  for(const stage of ['source','catalog']){
    const f=fixture({loaded:stage!=='catalog'});f.cp.input.topic='계속 쓸 기획';const before=plain(f.cp),pending=f.open();f.choose('replace');await flush();if(stage==='catalog'){respond(f);await flush();}f.requests.at(-1).reject(new Error('권한이 바뀌었어요.'));await assert.rejects(pending,/권한/);assert.deepEqual(plain(f.cp),before);assert.equal(f.timers.size,0);
  }
});

for(const stage of ['source','catalog'])test(stage+' response cannot apply after account, view, modal or composer changes',async()=>{
  for(const change of ['logout','switch-user','same-user-new-session','leave','tool','performance-tab','source-reset','modal','input','draft','generation','workspace-request']){
    const f=fixture({loaded:stage!=='catalog'}),pending=f.open();if(stage==='catalog'){respond(f);await flush();}
    if(change==='logout')f.context.state.user=null;
    if(change==='switch-user')f.context.state.user={id:'B',role:'member'};
    if(change==='same-user-new-session')f.bumpAuth();
    if(change==='leave')f.context.state.tab='home';
    if(change==='tool')f.context.makerTools.view='subtitles';
    if(change==='performance-tab')f.context.pf.view='prepare';
    if(change==='source-reset')f.context.pf.epoch++;
    if(change==='modal')f.context.modal('다른 창','','');
    if(change==='input')f.cp.input.proof='사용자가 고친 근거';
    if(change==='draft')f.cp.draftId='another';
    if(change==='generation')f.cp.generationRequest++;
    if(change==='workspace-request')f.cp.request++;
    const preserved=plain(f.cp);f.requests.at(-1).resolve(stage==='catalog'?data():{input:input()});assert.equal(await pending,false,change);assert.deepEqual(plain(f.cp),preserved,change);assert.equal(f.focus,0,change);assert.equal(f.timers.size,0,change);
  }
});

test('navigation and input events invalidate immediately, even when a user returns before the response',async()=>{
  for(const type of ['click','input','change','popstate','hashchange']){
    const f=fixture(),pending=f.open();if(f.windowHandlers.has(type))f.windowHandlers.get(type)();else await f.emit(type,{name:'proof',value:f.cp.input.proof,matches:selector=>selector==='[data-cp-input]',closest:selector=>selector.includes('[data-action]')?{}:null});assert.equal(await pending,false,type);assert.equal(f.requests[0].options.signal.aborted,true,type);respond(f);await flush();assert.equal(f.cp.input.topic,'',type);assert.equal(f.context.state.tab,'workroom',type);
  }
});

test('duplicate selections abort the older read and only the latest current response is applied',async()=>{
  const f=fixture(),first=f.open(),second=f.open();assert.equal(await first,false);assert.equal(f.requests[0].options.signal.aborted,true);respond(f,1,{...input(),topic:'최근 선택'});assert.equal(await second,true);respond(f,0,{...input(),topic:'이전 선택'});await flush();assert.equal(f.cp.input.topic,'최근 선택');assert.equal(f.focus,1);assert.equal(f.timers.size,0);
});

test('navigation completion cannot focus or announce success for a replaced account',async()=>{
  const f=fixture();let finish;f.context.delayedNavigation=new Promise(resolve=>{finish=resolve;});f.evaluate('cpNavigate=async()=>{state.tab="content";cp.view="plan";await delayedNavigation;}');const pending=f.open();respond(f);await flush();f.bumpAuth();finish();assert.equal(await pending,false);assert.equal(f.focus,0);
});

test('a newer selection closes only its older confirmation and still waits for fresh consent',async()=>{
  const f=fixture();f.cp.input.topic='기존 입력';const first=f.open(),second=f.open();assert.equal(await first,false);assert.equal(f.modals.length,2);assert.equal(f.closes,1);assert.equal(f.requests.length,0);f.choose('replace');await flush();respond(f);assert.equal(await second,true);
});

test('a caller cannot interrupt an in-progress generation, content read, or save',async()=>{
  for(const key of ['busy','generating','loading']){const f=fixture();f.cp[key]=true;const before=plain(f.cp);await assert.rejects(f.open(),/진행 중/);assert.deepEqual(plain(f.cp),before);assert.equal(f.requests.length,0);assert.equal(f.modals.length,0);}
});

test('viewers and signed-out users cannot prepare a plan, and identifiers are checked before a request',async()=>{
  for(const user of [null,{id:'A',role:'viewer'}]){const f=fixture();f.context.state.user=user;assert.equal(await f.open(),false);assert.equal(f.requests.length,0);}
  const f=fixture();for(const code of ['openPublicationLearningPlan("../other","repeat")','openPublicationLearningPlan("'+entryId+'","../other")'])await assert.rejects(f.evaluate(code),/다시 확인/);assert.equal(f.requests.length,0);
});

test('current valid series stays selectable and no series or sharing scope is inferred from performance',async()=>{
  for(const series of ['lab-expression','obsolete']){const f=fixture();f.cp.input.seriesId=series;const pending=f.open();respond(f);assert.equal(await pending,true);assert.equal(f.cp.input.seriesId,series==='lab-expression'?series:'synkbrief-use');assert.equal(f.cp.input.channelId,'');const html=f.evaluate('cpComposer()');assert.match(html,/name="seriesId" data-cp-input/);assert.match(html,/name="channelId"/);assert.match(html,/value="" selected>채널 없이 개인 기획/);}
});

test('another user catalog and series are never reused in the current personal plan',async()=>{
  const f=fixture();f.cp.userId='B';f.cp.input.topic='다른 사용자 입력';f.cp.input.seriesId='lab-expression';const pending=f.open();assert.equal(f.modals.length,0);respond(f);await flush();assert.equal(f.requests[1].path,'/api/content-workspace');f.requests[1].resolve(data());assert.equal(await pending,true);assert.equal(f.cp.userId,'A');assert.equal(f.cp.input.seriesId,'synkbrief-use');assert.equal(f.cp.input.channelId,'');
});

test('malformed or overlong evidence cannot silently lose its source in a new composer',async()=>{
  for(const bad of [{topic:'기획'}, {...input(),editorialNote:''},{...input(),editorialNote:'x'.repeat(3001)},{...input(),editorialNote:42}]){const f=fixture(),before=plain(f.cp),pending=f.open();respond(f,0,bad);await assert.rejects(pending,/기획/);assert.deepEqual(plain(f.cp),before);assert.equal(f.context.state.tab,'workroom');}
});

test('editorial notes are separate from audience fields and preserved by the actual form, save and reopen flow',async()=>{
  const f=fixture(),evidence={...input(),editorialNote:input().editorialNote+'\n<img src=x onerror=bad>',proof:'성과 숫자를 시청자 대사에 넣지 않음',experience:'제작자 회고',personalization:{choice:'제작자가 72시간 뒤 측정'},authenticity:{basis:'제작자 실험'}};
  const pending=f.open();respond(f,0,evidence);assert.equal(await pending,true);const html=f.evaluate('cpComposer()');assert.match(html,/이번 편 제작 실험/);assert.match(html,/name="editorialNote" maxlength="3000"/);assert.match(html,/&lt;img src=x onerror=bad&gt;/);assert.ok(!html.includes('<img src=x'));
  for(const key of ['proof','experience','audience','takeaway','entertainment'])assert.equal(f.cp.input[key],'');
  assert.deepEqual(plain(f.cp.input.personalization),{situation:'',choice:'',nextStep:''});assert.deepEqual(plain(f.cp.input.authenticity),{basis:'',ownPerspective:'',limits:'',disclosure:''});
  const decode=value=>value.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&amp;','&'),values={seriesId:f.cp.input.seriesId,channelId:''};
  for(const match of html.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)){const name=match[1].match(/\bname="([^"]+)"/)?.[1];if(name)values[name]=decode(match[2]);}
  assert.equal(values.editorialNote,evidence.editorialNote);assert.equal(values.proof,'');assert.equal(values.experience,'');
  const submit={disabled:false,isConnected:true,setAttribute(){},removeAttribute(){}},errorBox={textContent:'',isConnected:true};const form={dataset:{cpForm:'generate'},values,isConnected:true,closest:()=>form,querySelector:selector=>selector==='[type="submit"]'?submit:errorBox};
  const saving=f.emit('submit',form);await flush();assert.equal(f.requests.length,2);assert.equal(f.requests[1].path,'/api/content-generate');assert.equal(f.requests[1].body.editorialNote,evidence.editorialNote);assert.equal(f.requests[1].body.proof,'');assert.equal(f.requests[1].body.experience,'');assert.deepEqual(plain(f.requests[1].body.authenticity),{basis:'',ownPerspective:'',limits:'',disclosure:''});assert.equal(f.requests[1].body.channelId,'');
  const draft={id:'saved-new',title:'새 기획',status:'draft',input:f.requests[1].body,plan:{seriesId:f.cp.input.seriesId,ideas:[{id:'one',title:'영상 구성',hook:'콘텐츠 도입',storyBeats:[{time:'0~5초',visual:'사용 장면',narration:'시청자에게 들려줄 설명'}]}]}};
  f.requests[1].resolve({draft});await saving;assert.equal(f.cp.activeDraft.input.editorialNote,evidence.editorialNote);assert.equal(f.cp.draftId,'saved-new');assert.equal(errorBox.textContent,'');
  f.cp.draftId='';f.cp.activeDraft=null;const reopened=f.evaluate('cpOpenDraft("saved-new")');f.requests[2].resolve({draft});await reopened;const result=f.evaluate('cpResult()');assert.match(result,/data-cp-editorial-note/);assert.match(result,/이번 편 제작 실험/);assert.match(result,/&lt;img src=x onerror=bad&gt;/);assert.equal((result.match(/72시간 관측/g)||[]).length,1);assert.equal(result.match(/<p class="cp-narration">([^<]*)<\/p>/)?.[1],'시청자에게 들려줄 설명');assert.equal(f.cp.activeDraft.input.editorialNote,evidence.editorialNote);
});

test('ordinary plans do not show an empty experiment section and notes alone count as unsaved work',async()=>{
  const f=fixture();assert.ok(!f.evaluate('cpComposer()').includes('name="editorialNote"'));assert.equal(f.evaluate('cpEditorialNote("")'),'');f.cp.input.editorialNote='다음 편에서 시험할 내용';const pending=f.open();assert.equal(f.modals.length,1);f.choose('keep');assert.equal(await pending,false);assert.equal(f.cp.input.editorialNote,'다음 편에서 시험할 내용');
});
