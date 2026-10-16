'use strict';
// The same synthetic UI contract runs through browser and hidden Electron hosts.
module.exports=async function understandingScenarios({run,until,click,inspect,setMode,replace,setLearning,refresh,reenter,capture,launch,check,prefix,refreshResetsDraft=false}){
  const button=(action,extra='')=>'[data-insight-action="understanding-'+action+'"]'+extra;
  const edit=facet=>button('edit','[data-insight-facet="'+facet+'"]');
  const row=facet=>'[data-insight-facet-row="'+facet+'"]';
  const literal=JSON.stringify;
  const content=selector=>run('document.querySelector('+literal(selector)+')?.innerText||""');
  const choose=async values=>run('(()=>{for(const input of document.querySelectorAll("[name=insight-choice]")){input.checked='+literal(values)+'.includes(input.value);input.dispatchEvent(new Event("change",{bubbles:true}));}})()');
  const note=async value=>run('(()=>{const input=document.querySelector("[data-insight-field=note]");input.value='+literal(value)+';input.dispatchEvent(new Event("input",{bubbles:true}));})()');
  const saved=async()=>until('!document.querySelector("[data-insight-editor]")&&document.querySelector('+literal(edit('topics')+':not([disabled])')+')!==null');
  const history=async()=>run('document.querySelector(".mi-understanding-history").open=true');
  await until('document.querySelector('+literal(edit('topics'))+')!==null');
  check('understanding has grounded topic and repeated learning evidence',(await content(row('learning-topic:cafe-order'))).includes('카페에서 주문하기')&&(await content(row('practice-mode'))).includes('듣기'));
  const initial=await inspect();await click(edit('topics'));await choose(['travel-food']);await note('저장하지 않을 입력');await click(button('cancel'));
  check('draft cancellation performs no feedback write',(await inspect()).revision===initial.revision);
  await click(edit('topics'));await choose(['travel-food','ai-tools']);await note('합성 개인 확인 메모');
  for(const [width,theme] of [[1440,'night'],[390,'day'],[320,'night'],[390,'night']]){
    const name=prefix+'-understanding-editor-'+width+(width===390?'-'+theme:'');
    await capture(name,width,theme,'.mi-understanding-editor');
    const styles=await run(`(()=>{
      const contrast=element=>{const style=getComputedStyle(element),luminance=value=>{const rgb=value.match(/[0-9.]+/g).slice(0,3).map(Number).map(channel=>{channel/=255;return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const fore=luminance(style.color),back=luminance(style.backgroundColor);return (Math.max(fore,back)+.05)/(Math.min(fore,back)+.05);};
      return {save:contrast(document.querySelector('[data-insight-action="understanding-save"]')),note:contrast(document.querySelector('[data-insight-field="note"]')),choices:[...document.querySelectorAll('[name="insight-choice"]')].every(input=>{const style=getComputedStyle(input),rect=input.getBoundingClientRect(),label=input.nextElementSibling.getBoundingClientRect();return style.appearance==='auto'&&getComputedStyle(input,'::before').content==='none'&&getComputedStyle(input,'::after').content==='none'&&label.left>=rect.right;})};
    })()`);
    check(name+' save and note contrast meets 4.5:1',styles.save>=4.5&&styles.note>=4.5,styles);
    check(name+' choices have no switch overlay or label overlap',styles.choices);
  }
  await click(button('save'));await saved();
  check('explicit topic save affects generated explanation',(await inspect()).overrides===1&&(await content('.mi-summary')).includes('AI 도구 활용'));
  check('user note is presented as the user’s literal explanation',(await content('.mi-summary')).includes('직접 남긴 설명')&&(await content('.mi-summary')).includes('합성 개인 확인 메모'));
  for(const theme of ['night','day'])await capture(prefix+'-understanding-summary-390-'+theme,390,theme,'.mi-summary');
  await reenter();await until('document.querySelector('+literal(edit('topics'))+')!==null');
  check('saved topic survives leaving and returning',(await content('.mi-summary')).includes('여행지 음식·주문'));
  const beforeDisconnectedDraft=await inspect();
  await click(button('review','[data-insight-facet="learning-topic:cafe-order"][data-insight-verdict="agree"]'));await note('연결 변경 전 미저장 입력');
  await setLearning('disabled');await refresh();
  if(refreshResetsDraft){
    await until('document.querySelector(".mi-consent")!==null');
    check('account revalidation discards the RAM draft and disconnected observation',await run('!document.querySelector("[data-insight-editor]")&&!document.querySelector(".mi-interrupted-editor")&&!document.querySelector("[data-insight-facet-row=\\"learning-topic:cafe-order\\"]")&&!document.querySelector(".member-insight").innerText.includes("연결 변경 전 미저장 입력")'));
    check('account revalidation never writes the discarded draft',(await inspect()).revision===beforeDisconnectedDraft.revision);
  }else{
    await until('document.querySelector(".mi-interrupted-editor")!==null');
    check('disappearing observed facet retains only unsaved words and cancellation',await run('(()=>{const panel=document.querySelector(".mi-interrupted-editor");return panel.querySelector("textarea[readonly]")?.value==="연결 변경 전 미저장 입력"&&!panel.querySelector("[data-insight-action=understanding-save]")&&!panel.innerText.includes("카페에서 주문하기");})()'));
    await click(button('cancel'));await until('!document.querySelector(".mi-interrupted-editor")');
    check('disconnected draft cancellation leaves stored feedback unchanged',(await inspect()).revision===beforeDisconnectedDraft.revision);
  }
  await setLearning('enabled');await refresh();await until('document.querySelector('+literal(edit('topics'))+')!==null');
  for(const [facet,value,label] of [['support','independent','먼저 혼자 시도'],['explanation','detailed','자세히']]){
    await click(edit(facet));await choose([value]);await click(button('save'));await saved();
    check(facet+' explicit correction appears in its description',(await content(row(facet))).includes(label));
  }
  const observed=await content(row('practice-mode')+' .mi-facet-line');
  for(const verdict of ['agree','disagree','contextual']){
    await click(button('review','[data-insight-facet="practice-mode"][data-insight-verdict="'+verdict+'"]'));
    await note('선택 '+verdict);await click(button('save'));await saved();
    const state=await inspect();
    check(verdict+' stores exact review and changes interpretation',state.state.reviews.find(item=>item.facetId==='practice-mode')?.verdict===verdict&&(await content(row('practice-mode')+' .mi-facet-line'))!==observed);
  }
  await history();check('persistent history exposes saved notes and individual reversal',(await content('.mi-understanding-history')).includes('선택 contextual'));
  for(const [width,theme] of [[1440,'day'],[390,'night'],[320,'day'],[390,'day']])await capture(prefix+'-understanding-history-'+width+(width===390?'-'+theme:''),width,theme,'.mi-understanding-history');
  const observationsBefore=await content('.mi-counters');
  await click(button('remove','[data-insight-kind="review"][data-insight-facet="practice-mode"]'));
  await until('!document.querySelector('+literal(button('remove','[data-insight-kind="review"][data-insight-facet="practice-mode"]'))+')');
  check('reversal restores observation interpretation without changing counts',(await inspect()).reviews===0&&(await content(row('practice-mode')+' .mi-facet-line'))===observed&&(await content('.mi-counters'))===observationsBefore);
  await click(edit('topics'));await choose(['content-video']);await note('실패 뒤에도 남을 입력');await setMode('load-error');await click(button('save'));
  await until('document.querySelector(".mi-interrupted-editor")!==null');
  check('fresh-read failure retains editable draft without stale confirmed summary',await run('document.querySelector("[data-insight-field=note]")?.value==="실패 뒤에도 남을 입력"&&!document.querySelector(".mi-understanding-history")'));
  await setMode('ready');await click(button('save'));await saved();
  check('retry applies retained correction',(await content('.mi-summary')).includes('영상 제작'));
  await click(edit('topics'));await choose(['content-design']);const remote=await inspect();
  remote.state.overrides=remote.state.overrides.map(item=>item.facetId==='topics'?{...item,id:'00000000-0000-4000-8000-000000000099',values:['career-planning'],at:new Date().toISOString()}:item);
  await replace(remote.state);await click(button('save'));await until('document.querySelector(".mi-understanding-notice")?.innerText.includes("다른 곳")');
  check('concurrent correction is preserved instead of overwritten',(await inspect()).state.overrides.find(item=>item.facetId==='topics').values[0]==='career-planning');
  await click(button('cancel'));await refresh();await until('document.querySelector('+literal(edit('topics'))+')!==null');
  check('conflict can be cancelled and refreshed',(await content(row('topics'))).includes('진로 탐색'));
  await setLearning('disabled');await refresh();await until('document.querySelector(".mi-consent")!==null');
  check('learning opt-out removes review actions while explicit choices stay',!await run('!!document.querySelector('+literal(button('review','[data-insight-facet="practice-mode"]'))+')')&&(await content('.mi-summary')).includes('진로 탐색'));
  await setLearning('enabled');await refresh();await until('document.querySelector('+literal(button('review','[data-insight-facet="practice-mode"]'))+')!==null');
  await history();await click(button('clear'));await until('document.querySelector(".mi-history-empty")!==null');
  check('clear removes all explicit feedback and retains source observations',(await inspect()).reviews===0&&(await inspect()).overrides===0&&(await content('.mi-counters'))===observationsBefore);
  for(const mode of ['malformed','error']){
    await setMode(mode);await refresh();await until('document.querySelector(".mi-understanding-notice")?.innerText.includes("불러오지 못")');
    check(mode+' feedback fails closed without hiding learning',!await run('!!document.querySelector(".mi-understanding-facets")')&&(await content('.mi-counters'))===observationsBefore);
  }
  await setMode('ready');await refresh();await until('document.querySelector('+literal(edit('topics'))+')!==null');
  check('feedback read retry recovers all review controls',await run('!!document.querySelector('+literal(button('review','[data-insight-facet="practice-mode"]'))+')'));
  await click(button('review','[data-insight-facet="learning-topic:cafe-order"][data-insight-verdict="agree"]'));await click(button('save'));await saved();
  check('confirmed learning topic produces a reasoned WORLD action',(await content('.mi-understanding-next')).includes('카페에서 주문하기'));
  await launch('.mi-understanding-next [data-insight-action="activity"][data-insight-target="world"]');
  await history();await click(button('clear'));await until('document.querySelector(".mi-history-empty")!==null');
  check('removing confirmation also removes its suggested activity',!await run('!!document.querySelector(".mi-understanding-next")'));

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
  await answer('support');
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
  check('explicit final confirmation stores the source and exact four answers under v7',clarified.state.version===9&&clarified.state.statements[0].text===clarificationWords&&clarified.state.statements[0].clarifications.length===4&&clarified.state.statements[0].meanings[0].value==='example'&&clarified.state.statements[0].meanings[0].condition==='first-try');
  await reenter();await until('!!document.querySelector('+literal(button('describe'))+')');
  check('clarified meaning survives the next analysis',(await content('.mi-summary')).includes('처음 시도할 때')&&(await content('.mi-summary')).includes('예시'));
  await history();await run('document.querySelector(".mi-statement-history-row .mi-clarification-history").open=true');
  check('saved statement history exposes the exact question and answer labels',(await content('.mi-understanding-history')).includes('뜻을 보완한 답변 4개')&&(await content('.mi-understanding-history')).includes('원하거나 선호해요'));
  await click(button('remove-statement','[data-insight-id="'+clarifiedId+'"]'));await until('!document.querySelector('+literal(button('remove-statement','[data-insight-id="'+clarifiedId+'"]'))+')');
  check('reversing a clarified statement removes its derived meaning',(await inspect()).statements===0&&!await run('!!document.querySelector(".mi-statement-history-row")'));
  const uncertainBefore=await inspect();
  await click(button('describe'));await statement('나는 자세한 설명이 좋을 수도 있어요');await click(button('preview'));
  check('a recognized but uncertain preference asks before proposing it',await run('!!document.querySelector('+literal(button('answer-statement','[data-insight-option="confirm"]'))+')&&!document.querySelector("[data-insight-proposal]")')&&(await inspect()).revision===uncertainBefore.revision);
  await answer('confirm');
  check('answering yes still requires selecting and explicitly saving the interpretation',await run('document.querySelectorAll("[data-insight-proposal]").length===1&&!document.querySelector("[data-insight-proposal]").checked&&document.querySelector('+literal(button('confirm-statement'))+').disabled')&&(await inspect()).revision===uncertainBefore.revision);
  await resetAnswers();await answer('unsure');
  check('not knowing a preference leaves it unapplied without another required question',await run('!document.querySelector('+literal(button('answer-statement'))+')&&!document.querySelector("[data-insight-proposal]")&&!document.querySelector('+literal(button('confirm-statement'))+')')&&(await inspect()).revision===uncertainBefore.revision);
  await click(button('cancel'));
  const currentCounts=await content('.mi-counters'),beforeStatement=await inspect();
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
    check(name+' checkbox has no switch overlay or label overlap',await run('[...document.querySelectorAll("[data-insight-proposal]")].every(input=>{const style=getComputedStyle(input),rect=input.getBoundingClientRect(),label=input.nextElementSibling.getBoundingClientRect();return style.appearance==="auto"&&getComputedStyle(input,"::before").content==="none"&&getComputedStyle(input,"::after").content==="none"&&label.left>=rect.right;})'));
  }
  await proposals(['p0','p1']);
  check('selected interpretation count updates immediately',(await content(button('confirm-statement'))).includes('2개'));
  await click(button('edit-text'));
  check('editing original discards preview and accepted selections',await run('!document.querySelector("[data-insight-proposal]")&&document.querySelector("[data-insight-field=statement]")?.value==='+literal(ownWords)));
  await click(button('preview'));await skipUncertain();await proposals(['p0','p1']);await click(button('confirm-statement'));await statementSaved();
  const confirmed=await inspect(),statementId=confirmed.state.statements[0].id;
  check('explicit confirmation stores only accepted meanings under v9',confirmed.state.version===9&&confirmed.statements===1&&confirmed.state.statements[0].meanings.length===2&&confirmed.state.statements[0].text===ownWords);
  check('conditional relationship appears once with linked evidence and unchanged observations',(await content('.mi-summary')).includes('처음 시도할 때')&&await run('document.querySelectorAll(".mi-summary .mi-relation-evidence").length>0&&!document.querySelector(".mi-relations")')&&(await content('.mi-counters'))===currentCounts);
  for(const theme of ['night','day'])await capture(prefix+'-statement-summary-390-'+theme,390,theme,'.mi-summary');
  await reenter();await until('!!document.querySelector(".mi-relation-evidence")');
  check('confirmed interpretation survives a new screen and controller',(await content('.mi-summary')).includes('예시를 먼저 보기'));
  await setLearning('empty');await refresh();await until('document.querySelector(".member-insight")?.innerText.includes("첫 연습 기록을 기다리고 있어요.")');
  check('confirmed statement prevents contradictory personal empty state when legacy profile is empty',(await content('.mi-summary')).includes('처음 시도할 때')&&!await run('document.querySelector(".member-insight").innerText.includes("아직 나를 소개할 정보가 없어요")'));
  await setLearning('enabled');await refresh();await until('!!document.querySelector(".mi-counters")');
  await history();
  await run('document.querySelector(".mi-statement-history-row .mi-statement-source").open=true');
  check('statement history retains original, conditions and individual undo',(await content('.mi-understanding-history')).includes(ownWords)&&await run('!!document.querySelector('+literal(button('remove-statement','[data-insight-id="'+statementId+'"]'))+')'));
  await capture(prefix+'-statement-history-390-day',390,'day','.mi-understanding-history');
  await setLearning('disabled');await refresh();await until('!!document.querySelector(".mi-consent")');
  check('directly confirmed conditional preference survives observation opt-out',(await content('.mi-summary')).includes('처음 시도할 때')&&!await run('!!document.querySelector('+literal(button('review','[data-insight-facet="practice-mode"]'))+')'));
  await setLearning('enabled');await refresh();await until('!!document.querySelector('+literal(button('describe'))+')');
  await click(button('describe'));await statement('짧은 설명이 좋아요. 자세한 설명이 좋아요.');await click(button('preview'));
  const conflictBefore=await inspect();await run('document.querySelector('+literal(button('confirm-statement'))+').click()');
  check('incompatible meanings require a question answer and cannot be saved together',(await inspect()).revision===conflictBefore.revision&&await run('document.querySelectorAll("[data-insight-proposal]:disabled").length===2&&document.querySelector('+literal(button('confirm-statement'))+').disabled'));
  await answer('p0');
  check('choosing one conflicting meaning leaves only that unselected interpretation',await run('!document.querySelector('+literal(button('answer-statement'))+')&&document.querySelectorAll("[data-insight-proposal]").length===1&&!document.querySelector("[data-insight-proposal]").checked')&&(await content('.mi-statement-proposals')).includes('원하는 내용: 짧은 설명'));
  await resetAnswers();await answer('skip');
  check('skipping a conflict applies neither side and performs no write',await run('!document.querySelector("[data-insight-proposal]")&&!document.querySelector('+literal(button('confirm-statement'))+')')&&(await inspect()).revision===conflictBefore.revision);
  await click(button('cancel'));
  await click(button('describe'));await statement('혼자 하는 게 싫어요.');await click(button('preview'));await proposals(['p0']);await click(button('confirm-statement'));await statementSaved();
  check('negating the baseline also defers its old conditional preference',(await content('.mi-summary')).includes('조건을 지금도 적용할지는 아직 확인하지 않았어요'));
  await history();const baselineNegationId=(await inspect()).state.statements.at(-1).id;
  const priorCondition=await run('[...document.querySelectorAll(".mi-statement-meanings>div")].find(row=>row.innerText.includes("처음 시도할 때"))?.innerText');
  check('superseded condition is marked currently inactive in reversible history',priorCondition.includes('현재 미반영'));
  await click(button('remove-statement','[data-insight-id="'+baselineNegationId+'"]'));await until('!document.querySelector('+literal(button('remove-statement','[data-insight-id="'+baselineNegationId+'"]'))+')');
  await click(button('describe'));await statement('읽기 연습을 선호하지 않아요.');await click(button('preview'));await proposals(['p0']);await click(button('confirm-statement'));await statementSaved();
  check('negative wording is retained without inventing the opposite preference',(await content('.mi-summary')).includes('선호하지 않')&&(await inspect()).state.statements.at(-1).meanings[0].polarity==='avoid');
  await click(button('describe'));await statement('짧은 설명이 좋아요.');await click(button('preview'));await proposals(['p0']);
  const remoteStatement=await inspect();remoteStatement.state.statements[0].id='00000000-0000-4000-8000-000000000098';await replace(remoteStatement.state);await click(button('confirm-statement'));await until('document.querySelector(".mi-understanding-notice")?.innerText.includes("다른 곳")');
  check('concurrent statement is preserved rather than silently superseded',(await inspect()).state.statements[0].id==='00000000-0000-4000-8000-000000000098'&&(await inspect()).statements===2);
  await click(button('cancel'));await refresh();await until('!!document.querySelector('+literal(button('describe'))+')');
  await click(button('describe'));await statement('짧은 설명이 좋아요.');await click(button('preview'));await proposals(['p0']);await setMode('save-error');await click(button('confirm-statement'));await until('document.querySelector(".mi-understanding-notice")?.innerText.includes("저장하지 못")');
  check('failed explicit statement save retains selected interpretation',await run('document.querySelector("[data-insight-proposal=p0]")?.checked'));
  await setMode('ready');await click(button('confirm-statement'));await statementSaved();
  check('retry stores one statement without duplicating the failed submission',(await inspect()).statements===3);
  await history();const current=await inspect(),negativeId=current.state.statements.find(item=>item.meanings[0].polarity==='avoid').id;
  await click(button('remove-statement','[data-insight-id="'+negativeId+'"]'));await until('!document.querySelector('+literal(button('remove-statement','[data-insight-id="'+negativeId+'"]'))+')');
  check('individual statement reversal updates analysis and retains the other declarations',(await inspect()).statements===2&&!await run('document.querySelector(".mi-summary").innerText.includes("선호하지 않는 내용: 읽기")')&&(await content('.mi-counters'))===currentCounts);
  await history();await click(button('clear'));await until('!!document.querySelector(".mi-history-empty")');
  check('clear also removes natural statements and derived relations',(await inspect()).statements===0&&!await run('!!document.querySelector(".mi-relation-evidence")'));

  const expandedWords='회의에서 다른 사람의 의견을 듣고 정리하는 편이에요. 글로 소통하는 게 좋아요. 책 읽기를 좋아해요.';
  const expandedBefore=await inspect(),expandedCounts=await content('.mi-counters');
  await click(button('describe'));await statement(expandedWords);await click(button('preview'));
  check('expanded communication and everyday topics are separate unchecked meanings',await run('document.querySelectorAll("[data-insight-proposal]").length===3&&document.querySelectorAll("[data-insight-proposal]:checked").length===0&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await inspect()).revision===expandedBefore.revision);
  for(const [width,theme] of [[320,'night'],[390,'day']])await capture(prefix+'-expanded-preview-'+width+'-'+theme,width,theme,'.mi-statement-editor');
  await proposals(['p0','p1','p2']);await click(button('confirm-statement'));await statementSaved();
  const expandedSaved=await inspect();
  check('confirmed expansion persists v9 with exact source and three meanings',expandedSaved.state.version===9&&expandedSaved.state.statements[0].text===expandedWords&&expandedSaved.state.statements[0].meanings.length===3);
  await reenter();await until('!!document.querySelector('+literal(button('describe'))+')');
  check('next analysis combines two communication preferences without inventing practice', (await content('.mi-summary')).includes('듣고 정리')&&(await content('.mi-summary')).includes('글로 소통')&&(await content('.mi-summary')).includes('독서')&&(await content('.mi-counters'))===expandedCounts);
  await history();await capture(prefix+'-expanded-saved-390-day',390,'day','.mi-understanding-history');
  await click(button('remove-statement','[data-insight-id="'+expandedSaved.state.statements[0].id+'"]'));await until('!document.querySelector(".mi-statement-history-row")');
  check('expanded statement reversal removes only its derived declarations',(await inspect()).statements===0&&(await inspect()).state.version===9&&!(await content('.mi-summary')).includes('글로 소통'));

  const contrastWords='말로 소통하는 건 싫지만 글로 소통하는 건 좋아해요.';
  const contrastBefore=await inspect();
  await click(button('describe'));await statement(contrastWords);await click(button('preview'));
  check('natural contrast proposes both directions without an unnecessary question',await run('document.querySelectorAll("[data-insight-proposal]").length===2&&document.querySelectorAll("[data-insight-proposal]:checked").length===0&&!document.querySelector('+literal(button('answer-statement'))+')')&&(await inspect()).revision===contrastBefore.revision);
  await capture(prefix+'-contrast-preview-390-day',390,'day','.mi-statement-editor');
  await proposals(['p0','p1']);await click(button('confirm-statement'));await statementSaved();
  const contrastSaved=await inspect(),contrastRow=contrastSaved.state.statements[0];
  check('confirmed contrast preserves positive and negative meaning with original evidence',contrastSaved.state.version===9&&contrastRow.parserVersion==='member-statement-ko-8'&&contrastRow.text===contrastWords&&contrastRow.meanings.some(m=>m.value==='spoken'&&m.polarity==='avoid')&&contrastRow.meanings.some(m=>m.value==='written'&&m.polarity==='prefer'));
  await reenter();await until('!!document.querySelector('+literal(button('describe'))+')');
  check('fresh analysis replays the exact confirmed contrast without changing learning facts',JSON.stringify((await inspect()).state.statements[0])===JSON.stringify(contrastRow)&&(await content('.mi-counters'))===expandedCounts);
  await history();await click(button('remove-statement','[data-insight-id="'+contrastRow.id+'"]'));await until('!document.querySelector(".mi-statement-history-row")');
  check('contrast reversal preserves the v9 fence and baseline observations',(await inspect()).statements===0&&(await inspect()).state.version===9&&(await content('.mi-counters'))===expandedCounts);

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
  check('v9 preserves condition and polarity on both clauses',compoundSaved.state.version===9&&compoundRow.parserVersion==='member-statement-ko-8'&&compoundRow.text===compoundWords&&compoundRow.meanings.length===2&&compoundRow.meanings.every(m=>m.condition==='meeting')&&compoundRow.meanings.some(m=>m.field==='communication'&&m.value==='written'&&m.polarity==='avoid')&&compoundRow.meanings.some(m=>m.field==='decision'&&m.value==='compare-options'&&m.polarity==='prefer'));
  await reenter();await until('!!document.querySelector('+literal(button('describe'))+')');
  check('fresh analysis keeps exact compound meanings and the original observations',JSON.stringify((await inspect()).state.statements[0])===JSON.stringify(compoundRow)&&(await content('.mi-counters'))===expandedCounts);
  await history();await click(button('remove-statement','[data-insight-id="'+compoundRow.id+'"]'));await until('!document.querySelector(".mi-statement-history-row")');
  check('compound undo removes only the synthetic declaration while retaining v9',(await inspect()).statements===0&&(await inspect()).state.version===9&&(await content('.mi-counters'))===expandedCounts);
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
  check('fresh analysis retains the exact parenthetical condition',(JSON.stringify((await inspect()).state.statements[0])===JSON.stringify(pendingRow))&&(await content('.mi-counters'))===expandedCounts);
  await history();await click(button('remove-statement','[data-insight-id="'+pendingRow.id+'"]'));await until('!document.querySelector(".mi-statement-history-row")');
  check('parenthetical verification restores the synthetic account baseline',(await inspect()).statements===0&&(await inspect()).state.version===9&&(await content('.mi-counters'))===expandedCounts);
};

// Run before any feedback or activity writes in either host. Keep observations
// distinct from confirmed preferences, including overlapping grammar labels.
module.exports.sparseSummaryScenario=async function({run,until,inspect,inspectActivity,writeCount,setLearning,refresh,capture,check,prefix}){
  const before=await inspect(),writesBefore=await writeCount();
  check('sparse summary fixture starts with no confirmed preference and activity consent off',before.reviews===0&&before.overrides===0&&before.statements===0&&!(await inspectActivity()).consent);
  await setLearning('sparse-quality');await refresh();
  await until('document.querySelector(".mi-summary")?.innerText.includes("응답 6건")&&document.querySelector(".mi-history-empty")!==null');
  const actual=await run(`(()=>{
    const paragraphs=[...document.querySelectorAll('.mi-summary-paragraph>p')].map(node=>node.innerText);
    const facets=[...document.querySelectorAll('[data-insight-facet-row^="learning-topic:"]')].map(node=>({id:node.dataset.insightFacetRow,title:node.querySelector('h3').innerText,line:node.querySelector('.mi-facet-line').innerText,evidence:node.querySelector('.mi-facet-evidence p').textContent}));
    return {paragraphs,facets,counters:[...document.querySelectorAll('.mi-counters dd')].map(node=>node.innerText.replace(/\\s/g,'')),history:document.querySelector('.mi-understanding-history summary')?.innerText,actions:document.querySelectorAll('.mi-understanding-next [data-insight-action="activity"]').length,activityObserved:!!document.querySelector('.mi-member-activity .mi-interest-list')};
  })()`);
  const overview=actual.paragraphs.join(' '),labels=['-(으)세요','-지 말다','-지 않다','-아/어도 되다'];
  check('sparse summary explains missing self-confirmation instead of inventing a preference',actual.paragraphs.length===3&&overview.includes('직접 확인한 내용이 없어요')&&overview.includes('하루의 기록만으로 반복되는 경향이나 선호를 정하지 않아요'),{paragraphs:actual.paragraphs});
  check('sparse summary anchors source date and states six answers on one day',overview.includes('2026년 10월 16일 기준 최근 30일 중 1일, 응답 6건')&&overview.includes('도움 없이 답한 응답은 0건')&&overview.includes('도움을 받은 응답은 6건')&&!overview.includes('응답 10건'));
  check('sparse summary keeps four overlapping grammar observations out of overview',labels.every(label=>!overview.includes(label))&&actual.facets.length===4,{facets:actual.facets});
  check('sparse summary preserves exact dated grammar evidence in details',labels.every((label,index)=>{const facet=actual.facets.find(row=>row.id==='learning-topic:synthetic-grammar-'+index);return facet?.title===label&&facet.evidence.includes('2026년 10월 16일 기준 최근 30일')&&facet.evidence.includes((index?2:4)+'건');}));
  check('sparse summary counters remain six total zero independent six assisted',JSON.stringify(actual.counters)===JSON.stringify(['6회','0회','6회']),{counters:actual.counters});
  check('sparse summary states excluded app source and creates no inferred recommendation',overview.includes('앱 이용 기록 연결이 꺼져 있어 이번 설명에 사용하지 않았어요')&&!actual.activityObserved&&actual.actions===0&&actual.history.includes('0건'));
  const after=await inspect();check('sparse summary refresh changes no feedback consent or account settings',JSON.stringify(after)===JSON.stringify(before)&&(await writeCount())===writesBefore&&!(await inspectActivity()).consent);
  for(const [width,theme]of [[390,'night'],[320,'day']])await capture(prefix+'-sparse-summary-'+width+'-'+theme,width,theme,'.mi-summary');
  await setLearning('enabled');await refresh();
  await until('document.querySelector("[data-insight-facet-row=\\"learning-topic:cafe-order\\"]")!==null&&document.querySelector(".mi-counters")?.innerText.includes("18")');
};
