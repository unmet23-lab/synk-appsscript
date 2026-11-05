'use strict';
// The same synthetic member contract runs through browser and hidden Electron hosts.
// Screen checks read the shipped 「내 성향」 DOM. Sentences the screen no longer prints (the analysis
// paragraphs, relations, per-meaning activity) are checked on the real model, marked layer:'model'.
const path=require('node:path'),{pathToFileURL}=require('node:url');
const {currentSummary}=require('./member-insight-fixture.cjs');
const LegacyParser=require('../../experiences/synk-account/src/member-statement-v9.cjs');
const PARSER='member-statement-ko-13',DOCUMENT_VERSION=14;
const renderer=file=>import(pathToFileURL(path.join(__dirname,'../renderer',file)).href);
const model={layer:'model'};
const literal=JSON.stringify;
async function modelOf(){
  const {buildMemberInsightReport}=await renderer('member-insight-model.mjs');
  return (document,{mode='enabled',owner='A',activity=null,account=null}={})=>buildMemberInsightReport(account||currentSummary(mode,owner),{understanding:document,understandingStatus:'ready',understandingAsOf:new Date().toISOString(),...(activity?{activity,activityStatus:activity.availability}:{})});
}
const textOf=report=>report.understanding.paragraphs.join(' ');
// Effective contrast of an element's own text over its stacked backgrounds, in page context.
const contrastHelper=`const contrast=element=>{const parse=value=>{const channel=value.match(/[0-9.]+/g).map(Number);return {rgb:channel.slice(0,3),alpha:channel[3]??1};};const luminance=rgb=>{const c=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const layers=[];for(let node=element;node;node=node.parentElement){const layer=parse(getComputedStyle(node).backgroundColor);if(layer.alpha>0){layers.push(layer);if(layer.alpha===1)break;}}let back=layers.length&&layers.at(-1).alpha===1?[...layers.at(-1).rgb]:[255,255,255];for(const layer of layers.slice(0,-1).reverse())back=back.map((v,i)=>layer.rgb[i]*layer.alpha+v*(1-layer.alpha));const fore=luminance(parse(getComputedStyle(element).color).rgb),under=luminance(back);return (Math.max(fore,under)+.05)/(Math.min(fore,under)+.05);};`;
const noOverlap=(selector)=>`[...document.querySelectorAll(${literal(selector)})].every(input=>{const style=getComputedStyle(input),rect=input.getBoundingClientRect(),label=input.nextElementSibling.getBoundingClientRect();return style.appearance==='auto'&&getComputedStyle(input,'::before').content==='none'&&getComputedStyle(input,'::after').content==='none'&&label.left>=rect.right;})`;

module.exports=async function understandingScenarios({run,until,click,inspect,setMode,replace,setLearning,refresh,reenter,capture,launch,check,prefix,refreshResetsDraft=false,inspectMemory,setMemoryMode}){
  const reportFor=await modelOf();
  const button=(action,extra='')=>'[data-insight-action="understanding-'+action+'"]'+extra;
  const edit=facet=>button('edit','[data-insight-facet="'+facet+'"]');
  const row=facet=>'[data-insight-facet-row="'+facet+'"]';
  const told=key=>'[data-insight-row="'+key+'"]';
  const chip=(facet,key,value)=>button('answer','[data-insight-facet="'+facet+'"][data-insight-'+key+'="'+value+'"]');
  const anyAnswer=facet=>button('answer','[data-insight-facet="'+facet+'"]');
  const undoStatement=id=>'.mi2-history '+button('remove-statement','[data-insight-id="'+id+'"]');
  const anyUndoStatement=button('remove-statement');
  const has=selector=>run('!!document.querySelector('+literal(selector)+')');
  const content=selector=>run('document.querySelector('+literal(selector)+')?.innerText||""');
  const text=()=>content('.member-insight');
  const choose=async values=>run('(()=>{for(const input of document.querySelectorAll("[name=insight-choice]")){input.checked='+literal(values)+'.includes(input.value);input.dispatchEvent(new Event("change",{bubbles:true}));}})()');
  const note=async value=>run('(()=>{const input=document.querySelector("[data-insight-field=note]");input.value='+literal(value)+';input.dispatchEvent(new Event("input",{bubbles:true}));})()');
  const saved=async()=>until('!document.querySelector("[data-insight-editor]")&&!document.querySelector(".mi-interrupted-editor")&&document.querySelector('+literal(edit('topics')+':not([disabled])')+')!==null');
  const numbers=()=>content('.mi2-numbers');
  const history=async()=>{await until('!!document.querySelector(".mi2-history")');await run('document.querySelector(".mi2-history").open=true');};
  const noHistory=()=>until('!document.querySelector(".mi2-history")');
  // One tap opens the row's 「답하기/바꾸기」 fold first, as a member has to.
  const tap=async(facet,key,value,label)=>{
    const selector=chip(facet,key,value);
    await until('!!document.querySelector('+literal(selector+':not([disabled])')+')');
    await run('document.querySelector('+literal(selector)+').closest("details").open=true');await click(selector);
    await until('document.querySelector('+literal(row(facet)+' .mi2-answer')+')?.innerText.includes('+literal(label)+')');
  };
  await until('document.querySelector('+literal(edit('topics'))+')!==null');
  check('understanding has grounded topic and repeated learning evidence',(await content(row('learning-topic:cafe-order'))).includes('카페에서 주문하기')&&(await content(row('learning-topic:cafe-order'))).includes('3일 동안 5번')&&(await content(row('practice-mode'))).includes('듣기')&&(await content(row('practice-mode'))).includes('3일 동안 8번'));
  check('a topic already listed for another look is not asked again',!await has(row('learning-topic:location-words'))&&(await content('.mi2-seen-block')).includes('위치와 방향 표현'));
  const initial=await inspect();await click(edit('topics'));await choose(['travel-food']);await note('저장하지 않을 입력');await click(button('cancel'));
  check('draft cancellation performs no feedback write',(await inspect()).revision===initial.revision&&!await has('[data-insight-editor]'));
  await click(edit('topics'));await choose(['travel-food','ai-tools']);await note('합성 개인 확인 메모');
  for(const [width,theme] of [[1440,'night'],[390,'day'],[320,'night'],[390,'night']]){
    const name=prefix+'-understanding-editor-'+width+(width===390?'-'+theme:'');
    await capture(name,width,theme,'.mi-understanding-editor');
    const styles=await run(`(()=>{${contrastHelper}return {save:contrast(document.querySelector('[data-insight-action="understanding-save"]')),note:contrast(document.querySelector('[data-insight-field="note"]')),choices:${noOverlap('[name="insight-choice"]')}};})()`);
    check(name+' save and note contrast meets 4.5:1',styles.save>=4.5&&styles.note>=4.5,styles);
    check(name+' choices have no switch overlay or label overlap',styles.choices);
  }
  await click(button('save'));await saved();
  const afterTopics=await inspect();
  check('explicit topic save affects generated explanation',afterTopics.overrides===1&&(await content(told('topics'))).includes('AI 도구 활용')&&(await content(told('topics'))).includes('내가 고름'));
  check('explicit topic save reaches the analysis model',textOf(reportFor(afterTopics.state)).includes('AI 도구 활용'),model);
  await history();
  check('user note is presented as the user’s literal explanation',(await content('.mi2-history .mi-history-note')).includes('덧붙인 말: 합성 개인 확인 메모')&&textOf(reportFor(afterTopics.state)).includes('덧붙인 말: “합성 개인 확인 메모”'));
  for(const theme of ['night','day'])await capture(prefix+'-understanding-summary-390-'+theme,390,theme,'#mi2-told');
  await reenter();await until('document.querySelector('+literal(edit('topics'))+')!==null');
  check('saved topic survives leaving and returning',(await content(told('topics'))).includes('여행지 음식·주문'));
  const beforeDisconnectedDraft=await inspect();
  await click(edit('topics'));await note('연결 변경 전 미저장 입력');
  await setLearning('disabled');await refresh();await until('!!document.querySelector("[data-mi2-kind=disconnected]")');
  check('learning connection off removes every observed row from the screen',!await has(row('learning-topic:cafe-order'))&&!await has(row('practice-mode')));
  if(refreshResetsDraft){
    check('account revalidation discards the RAM draft and disconnected observation',!await has('[data-insight-editor]')&&!await has('.mi-interrupted-editor')&&!(await text()).includes('연결 변경 전 미저장 입력'));
    check('account revalidation never writes the discarded draft',(await inspect()).revision===beforeDisconnectedDraft.revision);
  }else{
    check('a declared topic draft survives the connection change unsaved',await run('document.querySelector("[data-insight-field=note]")?.value==="연결 변경 전 미저장 입력"')&&(await inspect()).revision===beforeDisconnectedDraft.revision);
    await click(button('cancel'));await until('!document.querySelector("[data-insight-editor]")');
    check('disconnected draft cancellation leaves stored feedback unchanged',(await inspect()).revision===beforeDisconnectedDraft.revision);
  }
  // An observed facet's editor no longer opens from the screen, so the screen cannot reach this
  // state. The kept controller path and renderer still hold the contract.
  {
    const [{createMemberUnderstanding},{renderMemberInsight}]=await Promise.all([renderer('member-understanding-controller.mjs'),renderer('member-insight-view.mjs')]);
    const requests=[];
    const controller=createMemberUnderstanding({getIdentity:()=>({status:'signed-in',signedIn:true,accountId:'synthetic-insight-A',sessionGeneration:1}),request:async operation=>{requests.push(operation);return {ok:true,scope:'synk-personal',resource:'member-understanding',accountId:'synthetic-insight-A',revision:0,state:null};}});
    await controller.refresh();
    const facet=reportFor(null).understanding.facets.find(item=>item.id==='learning-topic:cafe-order');
    controller.begin({facetId:facet.id,mode:'review',verdict:'agree',claim:facet.claim,values:[],facet});controller.updateDraft({note:'연결 변경 전 미저장 입력'});
    const panel=renderMemberInsight({status:'ready',report:reportFor(null,{mode:'disabled'}),understandingEditor:controller.read().editor}).split('mi-interrupted-editor')[1]||'';
    check('disappearing observed facet retains only unsaved words and cancellation',panel.includes('readonly>연결 변경 전 미저장 입력')&&panel.includes('understanding-cancel')&&!panel.includes('understanding-save')&&!panel.split('</div></div>')[0].includes('카페에서 주문하기'),model);
    controller.cancel();controller.stop();
    check('disconnected observed draft writes nothing',requests.every(operation=>operation==='understandingLoad'),model);
  }
  await setLearning('enabled');await refresh();await until('document.querySelector('+literal(edit('topics'))+')!==null&&document.querySelector('+literal(row('practice-mode'))+')!==null');

  // Help style and explanation length are account settings now: saved to the learning memory WORLD reads.
  const setting=async(field,value)=>{await click('[data-insight-action="settings-edit"][data-insight-field="'+field+'"]');await until('!!document.querySelector("[data-insight-settings-editor]")');await run('(()=>{const input=document.querySelector("[name=insight-setting][value=\\"'+value+'\\"]");input.checked=true;input.dispatchEvent(new Event("change",{bubbles:true}));})()');await click('[data-insight-action="settings-save"]');};
  for(const [field,value,label] of [['support','independent','혼자 해 볼게요'],['explanation','detailed','자세한 설명']]){
    await setting(field,value);await until('!document.querySelector("[data-insight-settings-editor]")&&document.querySelector('+literal(told(field))+')?.innerText.includes('+literal(label)+')');
    check(field+' explicit correction appears in its description',(await inspectMemory()).presentation[field]===value&&(await content('.mi2-notice')).includes('저장했어요'));
  }
  const memoryBefore=await inspectMemory();
  await setMemoryMode('error');await setting('explanation','brief');await until('document.querySelector(".mi2-notice")?.innerText.includes("저장하지 못")');
  check('failed setting save keeps the choice and writes nothing',await run('document.querySelector("[name=insight-setting][value=brief]")?.checked===true')&&(await inspectMemory()).posts===memoryBefore.posts);
  await setMemoryMode('ready');await click('[data-insight-action="settings-save"]');await until('!document.querySelector("[data-insight-settings-editor]")&&document.querySelector('+literal(told('explanation'))+')?.innerText.includes("짧은 설명")');
  check('setting retry stores the kept choice once',(await inspectMemory()).posts===memoryBefore.posts+1&&(await inspectMemory()).presentation.explanation==='brief');

  const observedAt=await content(row('practice-mode')+' .mi2-count');
  const observedLine=reportFor((await inspect()).state).understanding.facets.find(item=>item.id==='practice-mode').line;
  for(const [verdict,label] of [['agree','맞아요'],['disagree','아니에요'],['contextual','때에 따라 달라요']]){
    await tap('practice-mode','verdict',verdict,label);
    const state=await inspect();
    check(verdict+' stores exact review and changes interpretation',state.reviews===1&&state.state.reviews.find(item=>item.facetId==='practice-mode')?.verdict===verdict&&(await content(row('practice-mode')+' .mi2-count'))===observedAt&&reportFor(state.state).understanding.facets.find(item=>item.id==='practice-mode').line!==observedLine);
  }
  for(const [value,label] of [['practice-only','연습에서 나온 것뿐이에요'],['not-now','지금은 아니에요']]){
    await tap('learning-topic:cafe-order','value',value,label);
    check(value+' topic answer stays the member’s own words on its row',(await inspect()).state.overrides.find(item=>item.facetId==='learning-topic:cafe-order')?.values[0]===value&&(await content(row('learning-topic:cafe-order'))).includes('3일 동안 5번'));
  }
  await history();check('persistent history exposes saved answers and individual reversal',(await content('.mi2-history')).includes('카페에서 주문하기')&&await has(button('remove','[data-insight-kind="review"][data-insight-facet="practice-mode"]')));
  for(const [width,theme] of [[1440,'day'],[390,'night'],[320,'day'],[390,'day']])await capture(prefix+'-understanding-history-'+width+(width===390?'-'+theme:''),width,theme,'.mi2-history');
  const observationsBefore=await numbers();
  await history();await click(button('remove','[data-insight-kind="review"][data-insight-facet="practice-mode"]'));
  await until('!document.querySelector('+literal(button('remove','[data-insight-kind="review"][data-insight-facet="practice-mode"]'))+')');
  const reverted=await inspect();
  check('reversal restores observation interpretation without changing counts',reverted.reviews===0&&!await has(row('practice-mode')+' .mi2-answer')&&(await content(row('practice-mode')+' .mi2-count'))===observedAt&&reportFor(reverted.state).understanding.facets.find(item=>item.id==='practice-mode').line===observedLine&&(await numbers())===observationsBefore);
  await click(told('topics')+' '+button('remove'));await until('!document.querySelector('+literal(told('topics')+' '+button('remove'))+')');
  check('the chosen row undoes its own choice in place',(await inspect()).state.overrides.every(item=>item.facetId!=='topics')&&(await content(told('topics'))).includes('아직 안 골랐어요'));
  await history();await click(button('remove','[data-insight-kind="override"][data-insight-facet="learning-topic:cafe-order"]'));await noHistory();
  check('removing the last answer closes the history and keeps the observation',(await inspect()).overrides===0&&(await content(row('learning-topic:cafe-order'))).includes('3일 동안 5번'));

  // The one-tap answer has no note field; a note saved with an earlier answer still shows and can be undone.
  {
    const claim=reportFor(null).understanding.facets.find(item=>item.id==='practice-mode').claim;
    await replace({...(await inspect()).state,reviews:[{id:'00000000-0000-4000-8000-000000000096',facetId:'practice-mode',verdict:'contextual',claim,note:'예전에 남긴 합성 메모',at:new Date().toISOString()}]});await refresh();await history();
    check('a note saved with an earlier answer stays literal in history',(await content('.mi2-history .mi-history-note')).includes('덧붙인 말: 예전에 남긴 합성 메모')&&(await content(row('practice-mode')+' .mi2-answer')).includes('때에 따라 달라요'));
    await click(button('remove','[data-insight-kind="review"][data-insight-facet="practice-mode"]'));await noHistory();
    check('undoing that answer removes the note and keeps the observation',(await inspect()).reviews===0&&(await content(row('practice-mode')+' .mi2-count'))===observedAt);
  }
  await click(edit('topics'));await choose(['content-video']);await note('실패 뒤에도 남을 입력');await setMode('load-error');await click(button('save'));
  await until('document.querySelector(".mi-interrupted-editor")!==null');
  check('fresh-read failure retains editable draft without stale confirmed summary',await run('document.querySelector("[data-insight-field=note]")?.value==="실패 뒤에도 남을 입력"&&document.querySelector("[name=insight-choice][value=content-video]")?.checked&&!document.querySelector(".mi2-history")')&&(await inspect()).overrides===0);
  await setMode('ready');await click(button('save'));await saved();
  const retried=await inspect();
  check('retry applies retained correction',(await content(told('topics'))).includes('영상 제작')&&retried.overrides===1&&retried.state.overrides[0].note==='실패 뒤에도 남을 입력');
  await click(edit('topics'));await choose(['content-design']);const remote=await inspect();
  remote.state.overrides=remote.state.overrides.map(item=>item.facetId==='topics'?{...item,id:'00000000-0000-4000-8000-000000000099',values:['career-planning'],at:new Date().toISOString()}:item);
  await replace(remote.state);await click(button('save'));await until('document.querySelector(".mi2-notice")?.innerText.includes("다른 곳")');
  check('concurrent correction is preserved instead of overwritten',(await inspect()).state.overrides.find(item=>item.facetId==='topics').values[0]==='career-planning'&&await has('[data-insight-editor]'));
  await click(button('cancel'));await refresh();await until('document.querySelector('+literal(edit('topics'))+')!==null');
  check('conflict can be cancelled and refreshed',(await content(told('topics'))).includes('진로 탐색'));
  await setLearning('disabled');await refresh();await until('!!document.querySelector("[data-mi2-kind=disconnected]")');
  check('learning opt-out removes review actions while explicit choices stay',!await has(anyAnswer('practice-mode'))&&(await content(told('topics'))).includes('진로 탐색'));
  await setLearning('enabled');await refresh();await until('document.querySelector('+literal(anyAnswer('practice-mode'))+')!==null');
  await history();await click(button('clear'));await noHistory();
  check('clear removes all explicit feedback and retains source observations',(await inspect()).reviews===0&&(await inspect()).overrides===0&&(await numbers())===observationsBefore);
  for(const mode of ['malformed','error']){
    await setMode(mode);await refresh();await until('document.querySelector(".mi2-notice")?.innerText.includes("불러오지 못")');
    check(mode+' feedback fails closed without hiding learning',!await has(button('answer'))&&!await has(button('edit'))&&!await has(button('describe'))&&(await numbers())===observationsBefore);
  }
  await setMode('ready');await refresh();await until('document.querySelector('+literal(edit('topics'))+')!==null&&!document.querySelector(".mi2-notice")?.innerText.includes("불러오지 못")');
  check('feedback read retry recovers all review controls',await has(anyAnswer('practice-mode')));
  await tap('learning-topic:cafe-order','value','interested','더 배우고 싶어요');await until('!!document.querySelector(".mi2-apps")');
  check('confirmed learning topic produces a reasoned WORLD action',(await content('.mi2-apps')).includes('카페에서 주문하기'));
  await launch('.mi2-apps [data-insight-action="activity"][data-insight-target="world"]');
  await history();await click(button('clear'));await noHistory();
  check('removing confirmation also removes its suggested activity',!await has('.mi2-apps'));

  const statement=async value=>run('(()=>{const input=document.querySelector("[data-insight-field=statement]");input.focus();input.value='+literal(value)+';input.setSelectionRange(input.value.length,input.value.length);input.dispatchEvent(new Event("input",{bubbles:true}));return document.activeElement?.value;})()');
  // Each change renders a new editor, so reacquire each checkbox after the event.
  const proposals=async ids=>{for(const id of ids)await click('[data-insight-proposal="'+id+'"]');};
  const statementSaved=async()=>until('!document.querySelector("[data-insight-statement-editor]")&&!!document.querySelector('+literal(button('describe')+':not([disabled])')+')');
  const answer=async option=>{
    const selector=button('answer-statement','[data-insight-option="'+option+'"]');
    await until('!!document.querySelector('+literal(selector+':not([disabled])')+')');
    await run('document.querySelector('+literal(selector)+').focus()');await click(selector);
  };
  const clarify=async()=>{for(const option of ['support','example','prefer','first-try'])await answer(option);};
  const skipUncertain=async()=>{await answer('skip');await until('!document.querySelector('+literal(button('answer-statement'))+')');};
  const resetAnswers=async()=>{if(!await run('document.querySelector(".mi-statement-editor .mi-clarification-history").open'))await click('.mi-statement-editor .mi-clarification-history>summary');await click(button('reset-answers'));};
  const clarificationStart=await inspect(),clarificationWords='새 일에서는 설명이 있어야 마음이 놓여요';
  await click(button('describe'));await statement('처음 배우는 일은 예시를 보고 감을 잡은 다음 혼자 해보고 싶어요');await click(button('preview'));
  check('natural sequential wording keeps example-first and independent-after-example separate',await run('document.querySelectorAll("[data-insight-proposal]").length===2&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await content('.mi-statement-proposals')).includes('예시를 본 다음'));
  await click(button('cancel'));
  await click(button('describe'));await statement(clarificationWords);await click(button('preview'));
  check('unsupported wording asks a real question without saving',(await inspect()).revision===clarificationStart.revision&&await run('document.querySelectorAll('+literal(button('answer-statement'))+').length>1'));
  await run('document.querySelector("[data-insight-statement-editor]").dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))');
  check('submitting while a question is open performs no write',(await inspect()).revision===clarificationStart.revision);
  for(const [width,theme]of [[320,'night'],[390,'day'],[1440,'night']]){
    const name=prefix+'-statement-question-'+width+'-'+theme;
    await capture(name,width,theme,'.mi-statement-editor');
    check(name+' options are visible non-submit touch targets',await run('[...document.querySelectorAll('+literal(button('answer-statement'))+')].every(node=>{const r=node.getBoundingClientRect();return node.type==="button"&&r.height>=44&&r.width>0&&r.left>=0&&r.right<=innerWidth;})'));
  }
  await answer('support');await until('!!document.querySelector(".mi-clarification-history")');
  check('answer advances one question, restores focus and records no preference',(await inspect()).revision===clarificationStart.revision&&await run('document.activeElement?.hasAttribute("data-insight-question-title")&&!!document.querySelector(".mi-clarification-history")'));
  await click(button('edit-text'));
  check('editing source clears the answer history and preserves only the written words',await run('!document.querySelector(".mi-clarification-history")&&!document.querySelector('+literal(button('answer-statement'))+')&&document.querySelector("[data-insight-field=statement]")?.value==='+literal(clarificationWords)));
  await click(button('preview'));await clarify();
  check('four clarification steps produce one unselected conditional meaning without a write',(await inspect()).revision===clarificationStart.revision&&await run('!document.querySelector('+literal(button('answer-statement'))+')&&document.querySelectorAll("[data-insight-proposal]").length===1&&document.querySelectorAll("[data-insight-proposal]:checked").length===0')&&(await content('.mi-statement-proposals')).includes('처음 시도할 때'));
  await proposals(['p0']);await resetAnswers();
  check('restarting answers removes selected meaning and returns to the first question',await run('document.querySelectorAll("[data-insight-proposal]:checked").length===0&&!document.querySelector(".mi-clarification-history")&&!!document.querySelector('+literal(button('answer-statement','[data-insight-option="support"]'))+')'));
  await clarify();await run('document.querySelector(".mi-clarification-history").open=true');
  await capture(prefix+'-statement-answers-390-day',390,'day','.mi-statement-editor');
  await proposals(['p0']);await click(button('confirm-statement'));await statementSaved();
  const clarified=await inspect(),clarifiedId=clarified.state.statements[0].id;
  check('explicit final confirmation stores the source and exact four answers under the current parser',clarified.state.version===DOCUMENT_VERSION&&clarified.state.statements[0].parserVersion===PARSER&&clarified.state.statements[0].text===clarificationWords&&clarified.state.statements[0].clarifications.length===4&&clarified.state.statements[0].meanings[0].value==='example'&&clarified.state.statements[0].meanings[0].condition==='first-try');
  await reenter();await until('!!document.querySelector('+literal(button('describe'))+')');
  check('clarified meaning survives the next analysis',(await content(told('statement'))).includes(clarificationWords)&&textOf(reportFor(clarified.state)).includes('처음 시도할 때')&&textOf(reportFor(clarified.state)).includes('예시'));
  await history();await run('document.querySelector(".mi2-history .mi-clarification-history").open=true');
  check('saved statement history exposes the exact question and answer labels',(await content('.mi2-history')).includes('뜻을 보완한 답 4개')&&(await content('.mi2-history')).includes('원하거나 선호해요'));
  await click(undoStatement(clarifiedId));await until('!document.querySelector('+literal(undoStatement(clarifiedId))+')');
  check('reversing a clarified statement removes its derived meaning',(await inspect()).statements===0&&!await has(told('statement'))&&!textOf(reportFor((await inspect()).state)).includes('처음 시도할 때'));
  const uncertainBefore=await inspect();
  await click(button('describe'));await statement('나는 자세한 설명이 좋을 수도 있어요');await click(button('preview'));
  check('a recognized but uncertain preference asks before proposing it',await run('!!document.querySelector('+literal(button('answer-statement','[data-insight-option="confirm"]'))+')&&!document.querySelector("[data-insight-proposal]")')&&(await inspect()).revision===uncertainBefore.revision);
  await answer('confirm');await until('!!document.querySelector("[data-insight-proposal]")');
  check('answering yes still requires selecting and explicitly saving the interpretation',await run('document.querySelectorAll("[data-insight-proposal]").length===1&&!document.querySelector("[data-insight-proposal]").checked&&document.querySelector('+literal(button('confirm-statement'))+').disabled')&&(await inspect()).revision===uncertainBefore.revision);
  await resetAnswers();await answer('unsure');await until('!document.querySelector('+literal(button('answer-statement'))+')');
  check('not knowing a preference leaves it unapplied without another required question',await run('!document.querySelector('+literal(button('answer-statement'))+')&&!document.querySelector("[data-insight-proposal]")&&!document.querySelector('+literal(button('confirm-statement'))+')')&&(await inspect()).revision===uncertainBefore.revision);
  await click(button('cancel'));
  const currentCounts=await numbers(),beforeStatement=await inspect();
  const ownWords='혼자 하는 게 좋아요. 처음에는 예시가 필요해요. 아마 음악을 좋아할 거예요.';
  await click(button('describe'));
  check('blank natural wording cannot request interpretation',await run('document.querySelector('+literal(button('preview'))+').disabled'));
  check('natural text survives a render with caret and focus',await statement(ownWords)===ownWords&&await run('document.activeElement?.selectionStart===document.activeElement?.value.length'));
  await capture(prefix+'-statement-writing-390-night',390,'night','.mi-statement-editor');
  await click(button('preview'));await until('!!document.querySelector("[data-insight-proposal]")');
  check('unsupported uncertain wording asks its scope instead of assuming an interest',await run('!!document.querySelector('+literal(button('answer-statement','[data-insight-option="topic"]'))+')')&&(await inspect()).revision===beforeStatement.revision);
  await skipUncertain();
  check('preview has no automatic checks and performs no remote write',await run('document.querySelectorAll("[data-insight-proposal]:checked").length===0&&document.querySelector('+literal(button('confirm-statement'))+').disabled')&&(await inspect()).revision===beforeStatement.revision);
  check('conditional meaning and unresolved quote are separated',(await content('.mi-statement-proposals')).includes('처음 시도할 때')&&(await content('.mi-unresolved')).includes('아마 음악을 좋아할 거예요')&&await run('document.querySelectorAll("[data-insight-proposal]").length===2'));
  for(const [width,theme]of [[320,'night'],[390,'day'],[1440,'night']]){
    const name=prefix+'-statement-preview-'+width+'-'+theme;
    await capture(name,width,theme,'.mi-statement-editor');
    check(name+' checkbox has no switch overlay or label overlap',await run(noOverlap('[data-insight-proposal]')));
  }
  await proposals(['p0','p1']);
  check('selected interpretation count updates immediately',(await content(button('confirm-statement'))).includes('2개'));
  await click(button('edit-text'));
  check('editing original discards preview and accepted selections',await run('!document.querySelector("[data-insight-proposal]")&&document.querySelector("[data-insight-field=statement]")?.value==='+literal(ownWords)));
  await click(button('preview'));await skipUncertain();await proposals(['p0','p1']);await click(button('confirm-statement'));await statementSaved();
  const confirmed=await inspect(),statementId=confirmed.state.statements[0].id;
  check('explicit confirmation stores only accepted meanings under the current document',confirmed.state.version===DOCUMENT_VERSION&&confirmed.statements===1&&confirmed.state.statements[0].meanings.length===2&&confirmed.state.statements[0].text===ownWords);
  const confirmedReport=reportFor(confirmed.state);
  check('conditional relationship appears once with linked evidence and unchanged observations',textOf(confirmedReport).includes('처음 시도할 때')&&confirmedReport.understanding.relations.some(item=>item.evidence.length>0)&&(await numbers())===currentCounts&&(await content(told('statement'))).includes(ownWords));
  for(const theme of ['night','day'])await capture(prefix+'-statement-summary-390-'+theme,390,theme,'#mi2-told');
  await reenter();await until('!!document.querySelector('+literal(told('statement'))+')');
  check('confirmed interpretation survives a new screen and controller',(await content(told('statement'))).includes(ownWords)&&textOf(reportFor((await inspect()).state)).includes('예시를 먼저 보기'),model);
  await setLearning('empty');await refresh();await until('!document.querySelector(".mi2-numbers")&&!!document.querySelector('+literal(told('statement'))+')');
  check('confirmed statement prevents contradictory personal empty state when legacy profile is empty',(await content(told('statement'))).includes(ownWords)&&await run('document.querySelector("[data-mi2-kind]").dataset.mi2Kind==="declared"')&&!(await text()).includes('아직 나를 설명할 기록이 없어요'));
  await setLearning('enabled');await refresh();await until('!!document.querySelector(".mi2-numbers")');
  await history();
  check('statement history retains original, conditions and individual undo',(await content('.mi2-history')).includes(ownWords)&&(await content('.mi2-history')).includes('지금 쓰고 있어요')&&await has(undoStatement(statementId))&&reportFor((await inspect()).state).understanding.statementHistory[0].meanings.some(item=>item.condition==='first-try'));
  await capture(prefix+'-statement-history-390-day',390,'day','.mi2-history');
  await setLearning('disabled');await refresh();await until('!!document.querySelector("[data-mi2-kind=disconnected]")');
  check('directly confirmed conditional preference survives observation opt-out',(await content(told('statement'))).includes(ownWords)&&textOf(reportFor((await inspect()).state,{mode:'disabled'})).includes('처음 시도할 때')&&!await has(anyAnswer('practice-mode')));
  await setLearning('enabled');await refresh();await until('!!document.querySelector('+literal(button('describe'))+')&&!!document.querySelector(".mi2-numbers")');
  await click(button('describe'));await statement('짧은 설명이 좋아요. 자세한 설명이 좋아요.');await click(button('preview'));
  const conflictBefore=await inspect();await run('document.querySelector('+literal(button('confirm-statement'))+').click()');
  check('incompatible meanings require a question answer and cannot be saved together',(await inspect()).revision===conflictBefore.revision&&await run('document.querySelectorAll("[data-insight-proposal]:disabled").length===2&&document.querySelector('+literal(button('confirm-statement'))+').disabled'));
  await answer('p0');await until('!document.querySelector('+literal(button('answer-statement'))+')');
  check('choosing one conflicting meaning leaves only that unselected interpretation',await run('!document.querySelector('+literal(button('answer-statement'))+')&&document.querySelectorAll("[data-insight-proposal]").length===1&&!document.querySelector("[data-insight-proposal]").checked')&&(await content('.mi-statement-proposals')).includes('원하는 내용: 짧은 설명'));
  await resetAnswers();await answer('skip');await until('!document.querySelector('+literal(button('answer-statement'))+')');
  check('skipping a conflict applies neither side and performs no write',await run('!document.querySelector("[data-insight-proposal]")&&!document.querySelector('+literal(button('confirm-statement'))+')')&&(await inspect()).revision===conflictBefore.revision);
  await click(button('cancel'));
  await click(button('describe'));await statement('혼자 하는 게 싫어요.');await click(button('preview'));await proposals(['p0']);await click(button('confirm-statement'));await statementSaved();
  const negated=await inspect();
  check('negating the baseline also defers its old conditional preference',textOf(reportFor(negated.state)).includes('조건을 지금도 적용할지는 아직 확인하지 않았어요'),model);
  await history();const baselineNegationId=negated.state.statements.at(-1).id;
  const priorMeaning=reportFor(negated.state).understanding.statementHistory.flatMap(item=>item.meanings).find(item=>item.condition==='first-try');
  check('superseded condition is marked currently inactive in reversible history',priorMeaning?.active===false&&(await content('.mi2-history')).includes('지금은 쓰지 않아요'));
  await click(undoStatement(baselineNegationId));await until('!document.querySelector('+literal(undoStatement(baselineNegationId))+')');
  await click(button('describe'));await statement('읽기 연습을 선호하지 않아요.');await click(button('preview'));await proposals(['p0']);await click(button('confirm-statement'));await statementSaved();
  const avoided=await inspect();
  check('negative wording is retained without inventing the opposite preference',textOf(reportFor(avoided.state)).includes('선호하지 않')&&avoided.state.statements.at(-1).meanings[0].polarity==='avoid'&&avoided.state.statements.at(-1).meanings[0].value==='reading');
  await click(button('describe'));await statement('짧은 설명이 좋아요.');await click(button('preview'));await proposals(['p0']);
  const remoteStatement=await inspect();remoteStatement.state.statements[0].id='00000000-0000-4000-8000-000000000098';await replace(remoteStatement.state);await click(button('confirm-statement'));await until('document.querySelector(".mi2-notice")?.innerText.includes("다른 곳")');
  check('concurrent statement is preserved rather than silently superseded',(await inspect()).state.statements[0].id==='00000000-0000-4000-8000-000000000098'&&(await inspect()).statements===2);
  check('the conflicted statement keeps its words and returns to writing',await run('document.querySelector("[data-insight-field=statement]")?.value==="짧은 설명이 좋아요."'));
  await click(button('preview'));await until('!!document.querySelector("[data-insight-proposal=p0]")');
  check('a fresh preview brings back only the same chosen meaning',await run('document.querySelector("[data-insight-proposal=p0]").checked'));
  await click(button('cancel'));await refresh();await until('!!document.querySelector('+literal(button('describe'))+')');
  await click(button('describe'));await statement('짧은 설명이 좋아요.');await click(button('preview'));await proposals(['p0']);await setMode('save-error');await click(button('confirm-statement'));await until('document.querySelector(".mi2-notice")?.innerText.includes("저장하지 못")');
  check('failed explicit statement save retains selected interpretation',await run('document.querySelector("[data-insight-proposal=p0]")?.checked'));
  await setMode('ready');await click(button('confirm-statement'));await statementSaved();
  check('retry stores one statement without duplicating the failed submission',(await inspect()).statements===3);
  await history();const current=await inspect(),negativeId=current.state.statements.find(item=>item.meanings[0].polarity==='avoid').id;
  await click(undoStatement(negativeId));await until('!document.querySelector('+literal(undoStatement(negativeId))+')');
  const afterIndividual=await inspect();
  check('individual statement reversal updates analysis and retains the other declarations',afterIndividual.statements===2&&!textOf(reportFor(afterIndividual.state)).includes('선호하지 않는 내용: 읽기')&&(await numbers())===currentCounts);
  await history();await click(button('clear'));await noHistory();
  check('clear also removes natural statements and derived relations',(await inspect()).statements===0&&!await has(told('statement'))&&reportFor((await inspect()).state).understanding.relations.every(item=>item.kind!=='conditional-preference'));

  const expandedWords='회의에서 다른 사람의 의견을 듣고 정리하는 편이에요. 글로 소통하는 게 좋아요. 책 읽기를 좋아해요.';
  const expandedBefore=await inspect(),expandedCounts=await numbers();
  await click(button('describe'));await statement(expandedWords);await click(button('preview'));
  check('expanded communication and everyday topics are separate unchecked meanings',await run('document.querySelectorAll("[data-insight-proposal]").length===3&&document.querySelectorAll("[data-insight-proposal]:checked").length===0&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await inspect()).revision===expandedBefore.revision);
  for(const [width,theme] of [[320,'night'],[390,'day']])await capture(prefix+'-expanded-preview-'+width+'-'+theme,width,theme,'.mi-statement-editor');
  await proposals(['p0','p1','p2']);await click(button('confirm-statement'));await statementSaved();
  const expandedSaved=await inspect();
  check('confirmed expansion persists the current document with exact source and three meanings',expandedSaved.state.version===DOCUMENT_VERSION&&expandedSaved.state.statements[0].parserVersion===PARSER&&expandedSaved.state.statements[0].text===expandedWords&&expandedSaved.state.statements[0].meanings.length===3);
  await reenter();await until('!!document.querySelector('+literal(button('describe'))+')');
  const expandedText=textOf(reportFor(expandedSaved.state));
  check('next analysis combines two communication preferences without inventing practice',expandedText.includes('정리')&&expandedText.includes('글로 소통')&&expandedText.includes('독서')&&(await content(told('statement'))).includes(expandedWords)&&(await numbers())===expandedCounts);
  await history();await capture(prefix+'-expanded-saved-390-day',390,'day','.mi2-history');
  await history();await click(undoStatement(expandedSaved.state.statements[0].id));await until('!document.querySelector('+literal(anyUndoStatement)+')');
  check('expanded statement reversal removes only its derived declarations',(await inspect()).statements===0&&(await inspect()).state.version===DOCUMENT_VERSION&&!textOf(reportFor((await inspect()).state)).includes('글로 소통'));

  const contrastWords='말로 소통하는 건 싫지만 글로 소통하는 건 좋아해요.';
  const contrastBefore=await inspect();
  await click(button('describe'));await statement(contrastWords);await click(button('preview'));
  check('natural contrast proposes both directions without an unnecessary question',await run('document.querySelectorAll("[data-insight-proposal]").length===2&&document.querySelectorAll("[data-insight-proposal]:checked").length===0&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await inspect()).revision===contrastBefore.revision);
  await capture(prefix+'-contrast-preview-390-day',390,'day','.mi-statement-editor');
  await proposals(['p0','p1']);await click(button('confirm-statement'));await statementSaved();
  const contrastSaved=await inspect(),contrastRow=contrastSaved.state.statements[0];
  check('confirmed contrast preserves positive and negative meaning with original evidence',contrastSaved.state.version===DOCUMENT_VERSION&&contrastRow.parserVersion===PARSER&&contrastRow.text===contrastWords&&contrastRow.meanings.some(m=>m.value==='spoken'&&m.polarity==='avoid')&&contrastRow.meanings.some(m=>m.value==='written'&&m.polarity==='prefer'));
  await reenter();await until('!!document.querySelector('+literal(button('describe'))+')');
  check('fresh analysis replays the exact confirmed contrast without changing learning facts',JSON.stringify((await inspect()).state.statements[0])===JSON.stringify(contrastRow)&&(await numbers())===expandedCounts);
  await history();await click(undoStatement(contrastRow.id));await until('!document.querySelector('+literal(anyUndoStatement)+')');
  check('contrast reversal preserves the document fence and baseline observations',(await inspect()).statements===0&&(await inspect()).state.version===DOCUMENT_VERSION&&(await numbers())===expandedCounts);

  const phrasingBefore=await inspect();
  await click(button('describe'));await statement('글로 의견을 나누는 방식이 말로 설명하는 것보다 저에게 더 편해요.');await click(button('preview'));
  check('nominalized comparison directly proposes only the preferred written communication',await run('document.querySelectorAll("[data-insight-proposal]").length===1&&document.querySelectorAll("[data-insight-proposal]:checked").length===0&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await content('.mi-statement-proposals')).includes('글로 소통')&&!(await content('.mi-statement-proposals')).includes('선호하지 않는 내용')&&(await inspect()).revision===phrasingBefore.revision);
  await capture(prefix+'-nominalized-comparison-390-day',390,'day','.mi-statement-editor');
  await click(button('cancel'));
  await click(button('describe'));await statement('글로만 의견을 주고받는 건 선호하지 않아요.');await click(button('preview'));
  check('exclusive-only dislike asks about scope without asserting rejection of all writing',await run('!!document.querySelector('+literal(button('answer-statement','[data-insight-option="confirm"]'))+')&&!document.querySelector("[data-insight-proposal]")')&&(await inspect()).revision===phrasingBefore.revision);
  await skipUncertain();
  check('skipping the exclusivity question leaves no meaning and no additional question',await run('!document.querySelector("[data-insight-proposal]")&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await inspect()).revision===phrasingBefore.revision);
  await click(button('cancel'));

  const compoundWords='회의를 할 때는 글로 하는 소통을 원치 않고 판단할 대안을 비교하는 것도 좋아요';
  const compoundBefore=await inspect();
  await click(button('describe'));await statement(compoundWords);await click(button('preview'));
  check('conditional parallel preferences need no redundant question or automatic selection',await run('document.querySelectorAll("[data-insight-proposal]").length===2&&document.querySelectorAll("[data-insight-proposal]:checked").length===0&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await inspect()).revision===compoundBefore.revision);
  await capture(prefix+'-compound-no-redundant-question-390-day',390,'day','.mi-statement-editor');
  await proposals(['p0','p1']);await click(button('confirm-statement'));await statementSaved();
  const compoundSaved=await inspect(),compoundRow=compoundSaved.state.statements[0];
  check('the current parser preserves condition and polarity on both clauses',compoundSaved.state.version===DOCUMENT_VERSION&&compoundRow.parserVersion===PARSER&&compoundRow.text===compoundWords&&compoundRow.meanings.length===2&&compoundRow.meanings.every(m=>m.condition==='meeting')&&compoundRow.meanings.some(m=>m.field==='communication'&&m.value==='written'&&m.polarity==='avoid')&&compoundRow.meanings.some(m=>m.field==='decision'&&m.value==='compare-options'&&m.polarity==='prefer'));
  await reenter();await until('!!document.querySelector('+literal(button('describe'))+')');
  check('fresh analysis keeps exact compound meanings and the original observations',JSON.stringify((await inspect()).state.statements[0])===JSON.stringify(compoundRow)&&(await numbers())===expandedCounts);
  await click(told('statement')+' '+button('remove-statement'));await until('!document.querySelector('+literal(anyUndoStatement)+')');
  check('compound undo removes only the synthetic declaration while retaining the fence',(await inspect()).statements===0&&(await inspect()).state.version===DOCUMENT_VERSION&&(await numbers())===expandedCounts);
  const referenceBefore=await inspect();
  await click(button('describe'));await statement('단계별로 도움받는 방식을 원해요. 그렇게 도움받는 게 편하며 보통 길이의 설명이 좋아요');await click(button('preview'));
  check('unambiguous repeated support reference adds no redundant clarification',await run('document.querySelectorAll("[data-insight-proposal]").length===2&&document.querySelectorAll("[data-insight-proposal]:checked").length===0&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await content('.mi-statement-proposals')).includes('단계별')&&(await content('.mi-statement-proposals')).includes('보통')&&(await inspect()).revision===referenceBefore.revision);
  await click(button('cancel'));
  check('cancelling the reference preview leaves the saved account unchanged',JSON.stringify(await inspect())===JSON.stringify(referenceBefore));
  const pendingConditionWords='바쁠 때는, 사소한 누락을 줄일 수 있으니까, 우선순위를 정해 처리하는 게 좋아요.';
  const pendingBefore=await inspect();
  await click(button('describe'));await statement(pendingConditionWords);await click(button('preview'));
  check('open condition crosses the parenthetical without a redundant question',await run('document.querySelectorAll("[data-insight-proposal]").length===1&&document.querySelectorAll("[data-insight-proposal]:checked").length===0&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await content('.mi-statement-proposals')).includes('바쁠 때')&&(await inspect()).revision===pendingBefore.revision);
  await proposals(['p0']);await click(button('confirm-statement'));await statementSaved();
  const pendingRow=(await inspect()).state.statements[0];
  check('saved parenthetical preference retains its condition and the complete source evidence',pendingRow.text===pendingConditionWords&&pendingRow.meanings.length===1&&pendingRow.meanings[0].field==='work-style'&&pendingRow.meanings[0].value==='prioritize'&&pendingRow.meanings[0].condition==='busy'&&pendingRow.meanings[0].evidence.quote.startsWith('바쁠 때는')&&pendingConditionWords.slice(pendingRow.meanings[0].evidence.start,pendingRow.meanings[0].evidence.end)===pendingRow.meanings[0].evidence.quote);
  await reenter();await until('!!document.querySelector('+literal(button('describe'))+')');
  check('fresh analysis retains the exact parenthetical condition',(JSON.stringify((await inspect()).state.statements[0])===JSON.stringify(pendingRow))&&(await numbers())===expandedCounts);
  await history();await click(undoStatement(pendingRow.id));await until('!document.querySelector('+literal(anyUndoStatement)+')');
  check('parenthetical verification restores the synthetic account baseline',(await inspect()).statements===0&&(await inspect()).state.version===DOCUMENT_VERSION&&(await numbers())===expandedCounts);
  const concessiveWords='바쁠 때는, 모든 답을 바로 알 수는 없더라도, 짧은 설명이 좋아요.';
  const concessiveBefore=await inspect();
  await click(button('describe'));await statement(concessiveWords);await click(button('preview'));
  check('concessive explanation preserves the open busy condition without another question',await run('document.querySelectorAll("[data-insight-proposal]").length===1&&document.querySelectorAll("[data-insight-proposal]:checked").length===0&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await content('.mi-statement-proposals')).includes('바쁠 때')&&(await content('.mi-statement-proposals')).includes('짧은 설명')&&(await inspect()).revision===concessiveBefore.revision);
  await capture(prefix+'-concessive-direct-preview-390-day',390,'day','.mi-statement-editor');
  await proposals(['p0']);await click(button('confirm-statement'));await statementSaved();
  const concessiveRow=(await inspect()).state.statements[0];
  check('confirmed concessive meaning keeps exact polarity condition and evidence',(await inspect()).state.version===DOCUMENT_VERSION&&concessiveRow.parserVersion===PARSER&&concessiveRow.text===concessiveWords&&concessiveRow.meanings.length===1&&concessiveRow.meanings[0].field==='explanation'&&concessiveRow.meanings[0].value==='brief'&&concessiveRow.meanings[0].polarity==='prefer'&&concessiveRow.meanings[0].condition==='busy'&&concessiveRow.meanings[0].evidence.quote.startsWith('바쁠 때는')&&concessiveWords.slice(concessiveRow.meanings[0].evidence.start,concessiveRow.meanings[0].evidence.end)===concessiveRow.meanings[0].evidence.quote);
  await reenter();await until('!!document.querySelector('+literal(button('describe'))+')');
  check('fresh analysis replays the confirmed concessive meaning without changing observations',JSON.stringify((await inspect()).state.statements[0])===JSON.stringify(concessiveRow)&&(await numbers())===expandedCounts);
  await history();await click(undoStatement(concessiveRow.id));await until('!document.querySelector('+literal(anyUndoStatement)+')');
  check('concessive synthetic verification restores baseline and keeps the fence',(await inspect()).statements===0&&(await inspect()).state.version===DOCUMENT_VERSION&&(await numbers())===expandedCounts);
  const interruptedPredicateWords='저는 글로 소통하는 게, 내용을 다시 확인할 수 있어서, 더 편해요.';
  const interruptedBefore=await inspect();
  await click(button('describe'));await statement(interruptedPredicateWords);await click(button('preview'));
  check('a causal inset between preference subject and predicate needs no extra question',await run('document.querySelectorAll("[data-insight-proposal]").length===1&&document.querySelectorAll("[data-insight-proposal]:checked").length===0&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await content('.mi-statement-proposals')).includes('글로 소통')&&(await inspect()).revision===interruptedBefore.revision);
  await proposals(['p0']);await click(button('confirm-statement'));await statementSaved();
  const interruptedRow=(await inspect()).state.statements[0];
  check('confirmed interrupted predicate stores one exact written preference with original evidence',interruptedRow.parserVersion===PARSER&&interruptedRow.text===interruptedPredicateWords&&interruptedRow.meanings.length===1&&interruptedRow.meanings[0].field==='communication'&&interruptedRow.meanings[0].value==='written'&&interruptedRow.meanings[0].polarity==='prefer'&&interruptedRow.meanings[0].condition===null&&interruptedPredicateWords.slice(interruptedRow.meanings[0].evidence.start,interruptedRow.meanings[0].evidence.end)===interruptedRow.meanings[0].evidence.quote);
  await reenter();await until('!!document.querySelector('+literal(button('describe'))+')');
  check('fresh analysis replays the interrupted predicate and preserves observed counts',JSON.stringify((await inspect()).state.statements[0])===JSON.stringify(interruptedRow)&&(await numbers())===expandedCounts);
  await history();await click(undoStatement(interruptedRow.id));await until('!document.querySelector('+literal(anyUndoStatement)+')');
  check('interrupted predicate verification restores the synthetic baseline',(await inspect()).statements===0&&(await inspect()).state.version===DOCUMENT_VERSION&&(await numbers())===expandedCounts);

  // A row saved by an earlier parser, built by that frozen parser, stays byte-identical beside new saves.
  const legacyWords='말로 소통하는 건 싫지만 글로 소통하는 건 좋아해요.',legacyParsed=LegacyParser.parseMemberStatement(legacyWords);
  const legacyRow={id:'00000000-0000-4000-8000-000000000097',parserVersion:LegacyParser.PARSER_VERSION,text:legacyWords,at:'2026-10-16T08:00:00.000Z',confirmedAt:'2026-10-16T08:00:00.000Z',meanings:legacyParsed.meanings,clarifications:[]};
  await replace({version:10,reviews:[],overrides:[],statements:[legacyRow]});await refresh();await until('!!document.querySelector('+literal(told('statement'))+')');
  check('a statement saved by the frozen ko-9 parser opens unchanged in the current screen',legacyRow.parserVersion==='member-statement-ko-9'&&(await content(told('statement'))).includes(legacyWords)&&JSON.stringify((await inspect()).state.statements[0])===JSON.stringify(legacyRow));
  await click(button('describe'));await statement('짧은 설명이 좋아요.');await click(button('preview'));await proposals(['p0']);await click(button('confirm-statement'));await statementSaved();
  const mixed=await inspect();
  check('a new save beside it raises only the document fence and keeps the old row byte-identical',mixed.state.version===DOCUMENT_VERSION&&mixed.statements===2&&JSON.stringify(mixed.state.statements.find(row=>row.id===legacyRow.id))===JSON.stringify(legacyRow)&&mixed.state.statements.find(row=>row.id!==legacyRow.id).parserVersion===PARSER);
  await history();await click(button('clear'));await noHistory();
  check('clear returns the mixed-parser account to no statements',(await inspect()).statements===0);
};

// Run before any feedback or activity writes in either host. Keep observations
// distinct from confirmed preferences, including overlapping grammar labels.
module.exports.sparseSummaryScenario=async function({run,until,inspect,inspectActivity,writeCount,setLearning,refresh,capture,check,prefix}){
  const reportFor=await modelOf();
  const before=await inspect(),writesBefore=await writeCount();
  check('sparse summary fixture starts with no confirmed preference and activity consent off',before.reviews===0&&before.overrides===0&&before.statements===0&&!(await inspectActivity()).consent);
  await setLearning('sparse-quality');await refresh();
  await until('document.querySelector("[data-mi2-kind=one-day]")!==null&&document.querySelector(".mi2-tried")!==null');
  const actual=await run(`(()=>{
    const cells=[...document.querySelectorAll('.mi2-numbers>div')].map(node=>[node.querySelector('dt').innerText,node.querySelector('dd').innerText.replace(/\\s/g,'')]);
    const tried=[...document.querySelectorAll('.mi2-tried>li')].map(node=>[...node.children].map(child=>child.innerText));
    return {headline:document.querySelector('#mi2-now-title').innerText,support:[...document.querySelectorAll('.mi2-now .mi2-support')].map(node=>node.innerText),note:document.querySelector('.mi2-note').innerText,cells,tried,asked:document.querySelectorAll('[data-insight-facet-row]').length,told:document.querySelector('#mi2-told').innerText,seen:document.querySelector('.mi2-seen-block').innerText,why:document.querySelector('#mi2-why').textContent,history:!!document.querySelector('.mi2-history'),apps:!!document.querySelector('.mi2-apps'),table:!!document.querySelector('.mi2-compare table'),compare:document.querySelector('.mi2-compare')?.innerText,consent:document.querySelector('.mi2-consent').innerText};
  })()`);
  const model=reportFor(before.state,{mode:'sparse-quality',activity:{version:1,availability:'disabled'}});
  const paragraphs=model.understanding.paragraphs,overview=paragraphs.join(' '),labels=['-(으)세요','-지 말다','-지 않다','-아/어도 되다'];
  check('sparse summary explains missing self-confirmation instead of inventing a preference',actual.told.includes('아직 고른 것이 없어요')&&!actual.told.includes('내가 고름')&&actual.seen.includes('하루치 기록이라 아직 묻지 않아요')&&actual.asked===0&&paragraphs.length===3&&overview.includes('정리할 만큼 알려 준 것이 없어요')&&overview.includes('하루치 기록으로는 늘 그렇다고 정하지 않아요'),{...actual,paragraphs});
  check('sparse summary anchors source date and states six answers on one day',actual.note.includes('10월 16일 기준 최근 30일')&&actual.headline.includes('처음으로 6번 답했어요')&&overview.includes('2026년 10월 16일 기준 최근 30일 동안 1일, 6번 답했어요')&&overview.includes('혼자 답한 건 0번')&&overview.includes('도움 받고 답한 건 6번')&&!overview.includes('10번'));
  check('sparse summary keeps four overlapping grammar observations out of overview',labels.every(label=>!overview.includes(label))&&actual.tried.length===4&&actual.support.every(line=>labels.slice(1).every(label=>!line.includes(label))),{tried:actual.tried});
  check('sparse summary preserves exact grammar evidence in details',labels.every((label,index)=>actual.tried[index]?.[0]===label&&actual.tried[index]?.[1]===(index?2:4)+'번')&&labels.every((label,index)=>{const facet=model.understanding.facets.find(row=>row.id==='learning-topic:synthetic-grammar-'+index);return facet?.title===label&&facet.evidenceLine.includes('2026년 10월 16일 기준 최근 30일')&&facet.evidenceLine.includes((index?2:4)+'번 연습');}));
  check('sparse summary counters remain six total zero independent six assisted',JSON.stringify(actual.cells)===JSON.stringify([['답함','6번'],['연습한 표현','4가지'],['연습한 날','1일']])&&model.learning.answered===6&&model.learning.independent===0&&model.learning.assisted===6&&actual.support.some(line=>line.includes('도움 받으며')),{cells:actual.cells});
  check('sparse summary states excluded app source and creates no inferred recommendation',actual.why.includes('앱 이용 기록: 꺼져 있어요')&&overview.includes('앱 이용 기록 연결이 꺼져 있어 이번 설명에 쓰지 않았어요')&&actual.consent.includes('앱 이용 기록도 볼까요?')&&!actual.apps&&!actual.history&&model.understanding.activities.length===0);
  check('sparse summary does not compare a single day',!actual.table&&actual.compare.includes('아직 비교할 만큼 기록이 쌓이지 않았어요'));
  const after=await inspect();check('sparse summary refresh changes no feedback consent or account settings',JSON.stringify(after)===JSON.stringify(before)&&(await writeCount())===writesBefore&&!(await inspectActivity()).consent);
  for(const [width,theme]of [[390,'night'],[320,'day']])await capture(prefix+'-sparse-summary-'+width+'-'+theme,width,theme,'.mi2-now');
  await setLearning('enabled');await refresh();
  await until('document.querySelector("[data-insight-facet-row=\\"learning-topic:cafe-order\\"]")!==null&&document.querySelector(".mi2-numbers")?.innerText.includes("12")');
};

// The app-use rows the screen no longer lists: the projection the model still holds for it.
module.exports.activityProjection=async function(document){
  const Core=(await renderer('generated/member-activity.mjs')).default;
  return Core.summarizeMemberActivity({document,asOf:new Date().toISOString()});
};
module.exports.modelOf=modelOf;
