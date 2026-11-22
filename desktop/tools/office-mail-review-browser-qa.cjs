'use strict';

const {searchScope}=require('../src/office-mail-api.cjs');
const {summary,visibleReceipt}=require('../src/office-mail.cjs');

module.exports = async function checkMailReview({open,boot,signedIn,signedOut,subsNone,until,wait,click,key,capture,check,calls}) {
  const w = await open();
  const room = '#portal-entry [data-room="solio-office"]';
  const ownerId = 'a1000000-0000-4000-8000-000000000001';
  const parentId = 'a1000000-0000-4000-8000-000000000002';
  const reviewId = 'a1000000-0000-4000-8000-000000000003';
  const secondId = 'a1000000-0000-4000-8000-000000000004';
  const row = room+' [data-task-id="'+ownerId+'"]';
  const panel = row+' [data-office-mail-review]';
  const field = name => panel+' [data-mail-field="'+name+'"]';
  const action = name => panel+' [data-mail-review-action="'+name+'"]';
  const where = selector => !!document.querySelector(selector)?.getClientRects().length;
  const query = (fn,arg) => w.js('('+String(fn)+')('+JSON.stringify(arg??null)+')');
  const filter = {terms:['예산'],from:'',after:'2028-02-01',before:'2028-03-01',folder:'inbox_sent',provider:'all',attachment:''};
  const prompt = '앞에서 본 2월 예산 메일 중 별표를 단 메일 찾아줘.';
  const review = {reviewId,filter,quotes:['2월 예산'],unmet:['별표를 단'],reason:'unsupported'};
  const previous = {id:parentId,provider:'codex',departmentId:null,departmentName:'사무실',prompt:'예산 메일 찾아줘.',
    status:'completed',previousId:null,reason:null,answer:'메일 한 건을 찾았습니다.',mailSearch:true,createdAt:1,updatedAt:2};
  const original = {...previous,id:ownerId,previousId:parentId,prompt,status:'failed',reason:'MAIL_REVIEW',answer:'',mailSearch:true,mailDecision:'review',mailReview:review,createdAt:3,updatedAt:4};
  const providers = [
    {id:'gmail',configured:true,connected:true,address:'office@example.test'},
    {id:'outlook',configured:true,connected:true,address:'team@example.test'},
  ];
  const editedFilter={terms:['견적','촬영'],from:'studio@example.test',after:'2028-02-07',before:'2028-02-21',
    folder:'sent',provider:'gmail',attachment:'has'};
  const receipt={
    scope:searchScope(editedFilter),
    groups:[{provider:'gmail',address:'office@example.test',more:false,items:[{
      id:secondId,subject:'촬영 견적 확인',from:'촬영팀 <studio@example.test>',
      date:'2028-02-10T12:00:00Z',snippet:'촬영 견적표를 첨부했습니다.',
    }]}],
  };
  function fixture(task=original) {
    const completed={status:'completed',reason:null,answer:summary(receipt),mailSearch:true,mailDecision:'confirmed',mailResult:visibleReceipt(receipt)};
    let resultWithOmissions;
    if(task.mailReview?.reason==='unsupported'&&task.mailReview.unmet?.length) {
      const agreed={...receipt,omittedConditions:task.mailReview.unmet};
      resultWithOmissions={...completed,answer:summary(agreed),mailResult:visibleReceipt(agreed)};
    }
    return {available:true,departments:[],sessions:[],tasking:{tasks:[previous,task],mail:{providers}},
      mailReviewTest:{renew:{...review,reviewId:secondId},result:completed,resultWithOmissions}};
  }
  async function updateBoard(replacement) {
    const count=(await calls(w)).filter(entry=>entry==='office-snapshot').length;
    await query(board=>window.__orbFixture.setOffice(board),replacement);
    const read=await waitFor(previous=>window.__orbFixture.calls().filter(entry=>entry==='office-snapshot').length>previous,count,6000);
    if(!read)throw Error('The updated office snapshot was not received.');
    await query(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  }
  async function waitFor(fn,arg,timeout=3000) {
    const end = Date.now()+timeout;
    do { if(await query(fn,arg))return true; await wait(60); } while(Date.now()<end);
    return false;
  }
  async function press(selector) {
    return query(s=>{const el=document.querySelector(s);if(!el||!el.getClientRects().length||el.disabled)return false;el.click();return true;},selector);
  }
  async function input(selector,value) {
    return query(({selector,value})=>{
      const el=document.querySelector(selector);
      if(!el?.getClientRects().length)return false;
      el.focus();
      el.value=value;
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    },{selector,value});
  }
  async function typePartialDate(selector) {
    await input(selector,'');
    await query(s=>{const n=document.querySelector(s);n.blur();n.focus();},selector);
    const debuggerClient=w.win.webContents.debugger;
    const wasAttached=debuggerClient.isAttached();
    if(!wasAttached)debuggerClient.attach('1.3');
    try {
      const keyEvent={key:'2',code:'Digit2',windowsVirtualKeyCode:50,nativeVirtualKeyCode:50};
      await debuggerClient.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',...keyEvent,text:'2',unmodifiedText:'2'});
      await debuggerClient.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',...keyEvent});
    } finally {if(!wasAttached)debuggerClient.detach();}
    return query(s=>{const n=document.querySelector(s);return {value:n.value,bad:n.validity.badInput,focused:document.activeElement===n};},selector);
  }
  async function confirmFromKeyboard() {
    await query(s=>document.querySelector(s).focus(),field('terms'));
    const client=w.win.webContents.debugger;
    const attached=client.isAttached();
    if(!attached)client.attach('1.3');
    try {
      const control={key:'Control',code:'ControlLeft',windowsVirtualKeyCode:17,nativeVirtualKeyCode:17,modifiers:2};
      const enter={key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,modifiers:2};
      await client.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',...control});
      await client.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',...enter});
      await client.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',...enter});
      await client.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',...control,modifiers:0});
    } finally {if(!attached)client.detach();}
  }
  async function shots(name,focus) {
    for(const [width,height] of [[1440,900],[390,844]]) {
      w.win.setContentSize(width,height);
      const atWidth=await waitFor(n=>innerWidth===n,width);
      await query(({focus,row})=>{
        const control=document.querySelector(focus);
        const box=control?.closest('.off-task-field')||control;
        box?.scrollIntoView({block:focus===row?'start':'center'});
      },{focus,row});
      await wait(220);
      await capture(w,'mail-review-'+name+'-'+width);
      const fit=await query(({row,panel,focus})=>{
        const target=document.querySelector(focus);
        const card=document.querySelector(row);
        if(!target?.getClientRects().length||!card?.getClientRects().length)return false;
        const targetRect=target.getBoundingClientRect(),cardRect=card.getBoundingClientRect();
        if(targetRect.left<cardRect.left-1||targetRect.right>cardRect.right+1)return false;
        const containers=[document.querySelector(row),document.querySelector(panel)].filter(el=>el?.getClientRects().length);
        return containers.length>0&&containers.every(el=>{
          const rect=el.getBoundingClientRect();
          return el.clientWidth>0&&el.scrollWidth<=el.clientWidth+1&&rect.left>=-1&&rect.right<=innerWidth+1&&
            [...el.querySelectorAll('input,select,textarea,button')].filter(n=>n.getClientRects().length).every(n=>{
              const bounds=n.getBoundingClientRect();
              return bounds.left>=rect.left-1&&bounds.right<=rect.right+1;
            });
        });
      },{row,panel,focus});
      check(name+' fits the task card at '+width,atWidth&&fit);
    }
    w.win.setContentSize(1440,900);
    if(!await waitFor(n=>innerWidth===n,1440))throw Error('Desktop width was not restored.');
  }
  const submissions=async()=>(await calls(w)).filter(c=>c.startsWith('office-task-submit:')).map(c=>JSON.parse(c.slice('office-task-submit:'.length)));
  const hold=async(act)=>query(kind=>window.__orbFixture.holdOfficeMailReply(kind),act);
  const release=async()=>query(()=>window.__orbFixture.releaseOfficeMailReply());
  const sentActions = async kind=>(await calls(w)).filter(c=>c==='office-task-action:'+ownerId+':'+kind);
  async function checkRequestedSource() {
    const sentCount=(await sentActions('confirmMail')).length;
    for(const [index,prompt] of ['웹에서 견적 메일 찾아줘','Can you search the web for quote emails'].entries()){
      const sourceReview={...review,reviewId:index?reviewId:secondId,reason:'source',quotes:[prompt],unmet:[]};
      await updateBoard(fixture({...original,prompt,mailReview:sourceReview}));
      const details=await query(({row,area})=>{
        const card=document.querySelector(row),panel=document.querySelector(area);
        return {text:card?.innerText||'',note:card?.querySelector(':scope > p.off-task-note')?.innerText||'',
          mailboxes:[...(panel?.querySelector('[data-mail-field="provider"]')?.options||[])].map(o=>o.textContent)};
      },{row,area:panel});
      const shown=details.text.includes(prompt)&&details.text.includes('이 조건으로 찾기')&&
        details.text.includes('일반 업무로 맡기기')&&/연결(?:된|한) (?:메일함|사서함)/.test(details.note)&&
        /아직|조회하지 않았|검색하지 않았/.test(details.note)&&
        details.mailboxes.some(v=>v.includes('Gmail'))&&details.mailboxes.some(v=>v.includes('Outlook'));
      check((index?'an English':'a Korean')+' web-source request names the connected mailboxes before any search',
        shown&&(await sentActions('confirmMail')).length===sentCount,details);
      if(!index)await shots('source-location',row);
    }
  }
  async function checkRoleChoices() {
    const text='Regarding the negotiations, the ones with shipping costs, give and take in the messages Alice sent me, and revised payment terms, find the emails about the deposit.';
    const base={...filter,terms:['deposit'],from:'Studio',folder:'inbox_sent',provider:'gmail'};
    const from={field:'from',quote:'the messages Alice sent me',value:'Alice'};
    const folder={field:'folder',quote:'Alice sent me',value:'received'};
    const offer={reviewId,filter:base,reason:'sender',quotes:['deposit'],unmet:[],roleChoices:[from,folder]};
    const expected={...base,from:'Carol'};
    const group=which=>panel+' [data-mail-role-group="'+which+'"]';
    const choice=(which,mode)=>group(which)+' input[data-mail-role-decision="'+mode+'"]';
    const makeBoard=(proposal,resolved=expected)=>{
      const board=fixture({...original,prompt:text,mailReview:proposal});
      const result={scope:searchScope(resolved),groups:[{provider:'gmail',address:providers[0].address,more:false,
        items:[{id:secondId,subject:'Deposit quote',from:resolved.from+' <'+resolved.from.toLowerCase()+'@example.test>',date:'2028-02-09T11:00:00Z',snippet:'Requested deposit information.'}]}]};
      result.omittedConditions=proposal.roleChoices.filter(role=>resolved[role.field]!==role.value).map(role=>role.quote);
      board.mailReviewTest.result={status:'completed',reason:null,answer:summary(result),mailSearch:true,
        mailDecision:'confirmed',mailResult:visibleReceipt(result)};
      return board;
    };
    const receipts=async()=>(await calls(w)).filter(c=>c.startsWith('office-mail-confirmed:')).map(c=>JSON.parse(c.slice('office-mail-confirmed:'.length)));
    const current=()=>query(({f,p,confirm})=>{
      const box=document.querySelector(p),active=document.activeElement;
      const groups=[...(box?.querySelectorAll('[data-mail-role-group]')||[])].filter(g=>g.getClientRects().length);
      const values={};
      for(const g of groups) {
        const key=g.dataset.mailRoleGroup;
        values[key]={text:g.innerText,selected:g.querySelector('input:checked')?.dataset.mailRoleDecision||'',focused:g.contains(active)};
      }
      const value=key=>box?.querySelector('[data-mail-field="'+key+'"]')?.value;
      return {groups:values,from:value('from'),folder:value('folder'),terms:value('terms'),note:box?.querySelector('[role="status"]')?.innerText||'',
        confirmDisabled:document.querySelector(confirm)?.disabled,original:document.querySelector(f)?.innerText||''};
    },{f:row,p:panel,confirm:action('confirm')});
    check('an ordinary conditions card has no sender or folder decision controls',
      Object.keys((await current()).groups).length===0);
    const direct={...offer,reviewId:secondId,filter:{...base,from:'',folder:'received'},
      roleChoices:[{field:'from',quote:'Alice',value:'Alice'},{field:'folder',quote:'sent me',value:'sent'}]};
    await updateBoard(makeBoard(direct,{...direct.filter,from:'Alice',folder:'sent'}));
    await waitFor(where,field('from'));
    const originalState=await current(),initialCount=(await receipts()).length;
    await shots('role-first-sender',field('from'));
    await shots('role-first-folder',field('folder'));
    check('the ambiguous contract topic starts with the original source values and both literal role quotes',
      originalState.original.includes(text)&&originalState.from===''&&originalState.folder==='received'&&
      originalState.groups.from?.text.includes('Alice')&&originalState.groups.folder?.text.includes('sent me')&&
      !originalState.groups.from.selected&&!originalState.groups.folder.selected&&originalState.confirmDisabled,originalState);
    if(originalState.groups.from&&originalState.groups.folder){
      await press(choice('from','apply'));await confirmFromKeyboard();
      const pending=await current();
      check('choosing only Alice leaves the sent-folder question pending and performs no search',
        pending.groups.folder.focused&&pending.confirmDisabled&&(await receipts()).length===initialCount,pending);
      await press(choice('folder','apply'));await press(action('confirm'));
      await waitFor(n=>window.__orbFixture.calls().filter(c=>c.startsWith('office-mail-confirmed:')).length===n,initialCount+1);
      const agreed=(await receipts()).at(-1);
      check('the selected Alice sender and sent folder reach one search without changing the deposit topic',
        (await receipts()).length===initialCount+1&&agreed?.filter?.from==='Alice'&&agreed?.filter?.folder==='sent'&&
        agreed?.filter?.terms?.join(' ')==='deposit'&&agreed?.roleDecisions?.from==='apply'&&agreed?.roleDecisions?.folder==='apply',agreed);
      await waitFor(s=>document.querySelector(s)?.innerText?.includes('Deposit quote'),row);
      await shots('role-applied-result',row);
    }
    await updateBoard(makeBoard(offer));
    await waitFor(where,field('from'));
    const initial=await current(),count=(await receipts()).length;
    await shots('role-sender',field('from'));
    await shots('role-folder',field('folder'));
    const ready=initial.groups.from?.text.includes(from.quote)&&initial.groups.folder?.text.includes(folder.quote);
    check('both undecided role quotes and the original question are visible without a default decision',
      ready&&initial.original.includes(text)&&initial.groups.from.selected===''&&initial.groups.folder.selected===''&&
      initial.groups.from.text.includes('Alice')&&initial.groups.from.text.includes('Studio')&&initial.groups.folder.text.includes('받은')&&
      initial.groups.folder.text.includes('보낸편지함')&&initial.confirmDisabled&&initial.terms==='deposit',initial);
    if(!ready)return;
    await press(action('confirm'));await confirmFromKeyboard();
    const blocked=await current();
    check('empty sender and folder choices produce no request and focus the first missing role',
      (await receipts()).length===count&&blocked.groups.from.focused&&/보낸 사람|발신자/.test(blocked.note),blocked);
    await press(choice('from','apply'));await confirmFromKeyboard();
    const onlySender=await current();
    check('an applied sender does not count as a folder choice',
      onlySender.from==='Alice'&&onlySender.groups.folder.focused&&onlySender.note.includes('폴더')&&(await receipts()).length===count,onlySender);
    await press(choice('folder','exclude'));await updateBoard(makeBoard(offer));
    const saved=await current();
    check('polling preserves explicit choices and the inherited folder',
      saved.groups.from.selected==='apply'&&saved.groups.folder.selected==='exclude'&&saved.folder==='inbox_sent'&&!saved.confirmDisabled,saved);
    await updateBoard(makeBoard({...offer,roleChoices:[{...from,quote:'Alice sent me'},folder]}));
    const revised=await current();
    check('a changed sender quotation resets only its own decision',
      revised.confirmDisabled&&!revised.groups.from.selected&&revised.from==='Studio'&&revised.groups.folder.selected==='exclude',revised);
    await updateBoard(makeBoard(offer));await press(choice('from','apply'));
    await input(field('through'),'2028-02-22');
    await press(action('cancel'));await press(action('edit'));
    const reopened=await current();
    const retainedDate=await query(s=>document.querySelector(s).value,field('through'));
    check('reopening an ambiguous role card requires fresh decisions',reopened.confirmDisabled&&
      !reopened.groups.from.selected&&!reopened.groups.folder.selected&&reopened.from==='Studio'&&retainedDate==='2028-02-22',reopened);
    await input(field('through'),'2028-02-29');
    await input(field('from'),' alice ');await press(choice('folder','exclude'));await confirmFromKeyboard();
    const typedCandidate=await current();
    check('typing the suggested sender a different way requires an explicit apply decision',
      typedCandidate.confirmDisabled&&typedCandidate.groups.from.focused&&(await receipts()).length===count,typedCandidate);
    await input(field('from'),'Carol');
    await input(field('from'),'');await confirmFromKeyboard();
    const cleared=await current();
    check('deleting a manually entered sender never drops an inherited sender restriction',
      cleared.from===''&&cleared.confirmDisabled&&cleared.groups.from.focused&&!cleared.groups.from.selected&&(await receipts()).length===count,cleared);
    await input(field('from'),'Carol');
    const edited=await current();
    check('a distinct manually entered sender keeps the inherited folder, topic and dates',
      !edited.confirmDisabled&&edited.from==='Carol'&&edited.folder===base.folder&&edited.terms==='deposit',edited);
    await shots('role-manual',field('from'));
    await hold('confirmMail');await press(action('confirm'));await press(action('confirm'));await release();
    await waitFor(n=>window.__orbFixture.calls().filter(c=>c.startsWith('office-mail-confirmed:')).length===n,count+1);
    const sent=(await receipts()).at(-1);
    check('one confirmation sends only the two chosen roles with the normalized filter outside decision metadata',
      (await receipts()).length===count+1&&sent?.reviewId===reviewId&&sent?.roleDecisions?.from==='edit'&&
      sent?.roleDecisions?.folder==='exclude'&&Object.keys(sent.roleDecisions).length===2&&
      JSON.stringify(sent.filter)===JSON.stringify(expected)&&!Object.hasOwn(sent.filter,'roleDecisions'),sent);
    await waitFor(s=>document.querySelector(s)?.innerText?.includes('Deposit quote'),row);
    const result=await query(s=>document.querySelector(s)?.innerText||'',row);
    check('the result includes the confirmed filter, matching sender and the two original quotations left out',
      result.includes('Carol')&&result.includes('Deposit quote')&&result.includes(from.quote)&&result.includes(folder.quote),result);
    await shots('role-result',row);
    const literal='Alice <b>from the sample</b>';
    const extra=makeBoard({...offer,reviewId:secondId,roleChoices:[{...from,quote:literal}]});
    extra.tasking.tasks[1].prompt=text+' '+literal;
    await updateBoard(extra);
    const textOnly=await query(({s,value})=>{
      const el=document.querySelector(s);
      return !!el&&el.innerText.includes(value)&&el.querySelector('b')===null;
    },{s:group('from'),value:literal});
    check('a quoted fragment is displayed literally as member text',textOnly);
    const mixed=makeBoard({...offer,reviewId:secondId,reason:'unsupported',unmet:['unread'],requiresPeriodChoice:true,
      filter:{...base,after:'',before:''}});
    mixed.tasking.tasks[1].prompt=text+' Only unread mail.';
    await updateBoard(mixed);
    await press(choice('from','exclude'));await press(choice('folder','exclude'));
    const noDate=await current();
    await press(field('omit'));await confirmFromKeyboard();
    const onlyOmit=await current(),countAfterResult=(await receipts()).length;
    await press(field('unboundedPeriod'));
    const allThree=await current();
    check('sender and folder decisions preserve independent date and unread acknowledgements',
      noDate.confirmDisabled&&onlyOmit.confirmDisabled&&!allThree.confirmDisabled&&countAfterResult===count+1,{noDate,onlyOmit,allThree});
    await updateBoard(makeBoard({...offer,reviewId:secondId}));
    await press(choice('from','apply'));await press(choice('folder','apply'));
    await input(field('from'),'Previous member sender');
    const prior=await current();
    await query(auth=>window.__orbFixture.setAuth(auth),{...signedOut,sessionGeneration:30});
    const left=await until(w,s=>s.mode==='portal'&&s.phase==='auth'&&s.ui==='ask',{timeout:7500});
    const leaked=await query(({selector,quote})=>{
      const card=document.querySelector(selector);
      return !!card&&([...card.querySelectorAll('input')].some(n=>n.value==='Previous member sender')||
        [...card.querySelectorAll('[data-mail-role-group]')].some(g=>g.textContent.includes(quote)));
    },{selector:row,quote:from.quote});
    check('the signed-out office DOM removes the prior quotation and typed sender',left.ok&&!leaked,{leaked});
    await query(board=>window.__orbFixture.setOffice(board),makeBoard({...offer,reviewId:secondId}));
    const next={...signedIn('none',32),accountGeneration:'a1000000-0000-4000-8000-000000000091',
      account:{synk_user_id:'synthetic-role-member',display_name:'검색 조건 확인 회원'}};
    await query(auth=>window.__orbFixture.setAuth(auth),next);
    const active=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
    await click(w,'#portal-entry [data-orb-prog="office"]');
    const visible=await waitFor(where,group('from')),fresh=await current();
    check('the next member cannot inherit decisions from an identical task and review number',
      !prior.confirmDisabled&&left.ok&&active.ok&&visible&&fresh.confirmDisabled&&!fresh.groups.from.selected&&!fresh.groups.folder.selected&&fresh.from==='Studio',fresh);
  }
  async function checkPeriodChoice() {
    const unlimited=field('unboundedPeriod');
    const blank={...filter,after:'',before:''};
    const period={...review,reason:'period',filter:blank,unmet:[]};
    const periodBoard=proposal=>{
      const prompt=proposal.unmet.includes('안 읽은')?'한참 전에 받은 안 읽은 예산 메일을 찾아줘.':
        proposal.unmet.includes('Outlook')?'Gmail과 Outlook에서 한참 전에 받은 예산 메일을 찾아줘.':'한참 전에 받은 예산 메일을 찾아줘.';
      return fixture({...original,prompt,previousId:null,mailReview:proposal});
    };
    const state=()=>query(({control,confirm})=>{
      const input=document.querySelector(control);
      return {visible:Boolean(input?.getClientRects().length),checked:input?.checked===true,
        enabled:document.querySelector(confirm)?.disabled===false};
    },{control:unlimited,confirm:action('confirm')});
    const logs=async()=>(await calls(w)).filter(c=>c.startsWith('office-mail-confirmed:')).map(c=>JSON.parse(c.slice('office-mail-confirmed:'.length)));
    await updateBoard(periodBoard(period));
    if(!await waitFor(where,action('confirm')))throw Error('Period review form did not open.');
    await shots('period-empty',action('confirm'));
    const initial=await state(),count=(await logs()).length;
    check('an unresolved period starts with no all-dates consent and cannot search',initial.visible&&!initial.checked&&!initial.enabled,initial);
    if(!initial.visible)return;
    await query(s=>document.querySelector(s).focus(),field('folder'));
    await key(w,'Return');await key(w,'Escape');
    await press(action('confirm'));
    check('initial keyboard and button actions cannot submit a missing period',(await logs()).length===count);
    for(const [width,height] of [[1440,900],[390,844]]) {
      w.win.setContentSize(width,height);
      await waitFor(n=>innerWidth===n,width);
      await press(action('cancel'));await press(action('edit'));
      await confirmFromKeyboard();
      const error=await query(s=>{
        const n=document.querySelector(s),note=document.getElementById(n.getAttribute('aria-describedby'));
        return {focus:n===document.activeElement,invalid:n.getAttribute('aria-invalid'),note:note?.innerText||'',visible:!!note?.getClientRects().length};
      },unlimited);
      check('Ctrl+Enter identifies the missing period before searching at '+width,
        error.focus&&error.invalid==='true'&&error.visible&&error.note.includes('조회 날짜')&&(await logs()).length===count,error);
      await capture(w,'empty-period-ctrl-enter-'+width);
    }
    w.win.setContentSize(1440,900);await waitFor(n=>innerWidth===n,1440);
    await press(action('cancel'));await press(action('edit'));
    await press(unlimited);
    await updateBoard(periodBoard(period));
    check('same-card polling preserves the member choice',(await state()).checked);
    await updateBoard(periodBoard({...period,availableProviders:['gmail']}));
    const narrower=await state();
    check('a mailbox permission change clears all-dates consent on the same review',!narrower.checked&&!narrower.enabled,narrower);
    await updateBoard(periodBoard(period));await press(unlimited);
    await press(action('cancel'));await press(action('edit'));
    const reopened=await state();
    check('reopening the condition editor requires a new all-dates choice',!reopened.checked&&!reopened.enabled,reopened);
    await press(unlimited);
    await updateBoard(periodBoard({...period,reviewId:secondId}));
    const renewed=await state();
    check('a different review cannot inherit the previous all-dates choice',!renewed.checked&&!renewed.enabled,renewed);
    const partial=await typePartialDate(field('after'));
    await press(unlimited);await press(action('confirm'));
    check('a partly typed calendar date cannot start an all-dates search',
      partial.bad&&partial.value===''&&(await logs()).length===count,partial);
    await input(field('after'),'');
    if((await state()).checked)await press(unlimited);
    await press(unlimited);
    await input(field('through'),'2028-02-20');
    const bounded=await state();
    check('a valid last day clears all-dates consent and permits the bounded request',!bounded.checked&&bounded.enabled,bounded);
    await shots('period-bounded',action('confirm'));
    await input(field('through'),'');
    const cleared=await state();
    check('clearing a period after typing a date does not restore earlier consent',!cleared.enabled&&!cleared.checked,cleared);
    await input(field('after'),'2028-02-07');
    await press(action('confirm'));
    const boundedSent=await waitFor(n=>window.__orbFixture.calls().filter(c=>c.startsWith('office-mail-confirmed:')).length===n,count+1);
    const boundedReceipt=(await logs()).at(-1);
    check('the bounded confirmation sends only the selected date and omits the all-dates flag',
      boundedSent&&boundedReceipt?.filter.after==='2028-02-07'&&!Object.hasOwn(boundedReceipt,'allowUnboundedPeriod'),boundedReceipt);
    await updateBoard(periodBoard({...period,unmet:['Outlook'],availableProviders:['gmail']}));
    await waitFor(where,unlimited);
    await press(unlimited);
    check('allowing all dates does not approve removal of an unavailable mailbox',!(await state()).enabled);
    await press(field('omit'));
    await shots('period-unbounded',action('confirm'));
    await hold('confirmMail');await press(action('confirm'));await press(action('confirm'));await release();
    const unboundedSent=await waitFor(n=>window.__orbFixture.calls().filter(c=>c.startsWith('office-mail-confirmed:')).length===n,count+2);
    const unboundedReceipt=(await logs()).at(-1);
    check('two explicit choices send one unbounded request, with the flags outside the filter',
      unboundedSent&&unboundedReceipt?.allowUnboundedPeriod===true&&unboundedReceipt?.omitUnmet===true&&
      !unboundedReceipt.filter.after&&!unboundedReceipt.filter.before&&!Object.hasOwn(unboundedReceipt.filter,'allowUnboundedPeriod')&&
      !Object.hasOwn(unboundedReceipt.filter,'omitUnmet'),unboundedReceipt);
    const mixed={...period,reviewId:secondId,reason:'unsupported',requiresPeriodChoice:true,unmet:['안 읽은']};
    await updateBoard(periodBoard(mixed));
    await waitFor(where,field('omit'));
    await press(field('omit'));await press(action('confirm'));
    const omittedOnly=await state();
    check('dropping an unsupported condition cannot also grant access to all dates',
      omittedOnly.visible&&!omittedOnly.checked&&!omittedOnly.enabled&&(await logs()).length===count+2,omittedOnly);
    await shots('period-mixed',action('confirm'));
    await press(unlimited);
    check('an unresolved date alongside an unsupported condition needs two independent choices',(await state()).enabled);
    await updateBoard(periodBoard({...mixed,requiresPeriodChoice:false}));
    const ordinaryUnsupported=await state();
    await updateBoard(periodBoard(mixed));
    const newlyRequired=await state();
    check('a newly required period never inherits consent from a previous check of that task',
      !ordinaryUnsupported.visible&&newlyRequired.visible&&!newlyRequired.checked&&!newlyRequired.enabled,newlyRequired);
    await updateBoard(periodBoard({...period,reason:'terms'}));
    await waitFor(where,action('confirm'));
    const other=await state();
    check('a different review reason with no dates retains its original behavior',!other.visible&&other.enabled,other);
    await updateBoard(periodBoard({...period,reviewId:secondId}));
    await waitFor(where,unlimited);await press(unlimited);
    const allowedOnThisMember=(await state()).checked;
    await query(auth=>window.__orbFixture.setAuth(auth),{...signedOut,sessionGeneration:signedIn('none',8).sessionGeneration+1});
    const left=await until(w,s=>s.mode==='portal'&&s.phase==='auth'&&s.ui==='ask',{timeout:7500});
    await query(board=>window.__orbFixture.setOffice(board),periodBoard({...period,reviewId:secondId}));
    const next={...signedIn('none',12),accountGeneration:'a1000000-0000-4000-8000-000000000088',account:{synk_user_id:'synthetic-period-member',display_name:'기간 확인 회원'}};
    await query(auth=>window.__orbFixture.setAuth(auth),next);
    const signed=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
    await click(w,'#portal-entry [data-orb-prog="office"]');
    const present=await waitFor(where,unlimited),otherMember=await state();
    check('an identical task and review ID cannot carry all-period consent across members',
      allowedOnThisMember&&left.ok&&signed.ok&&present&&!otherMember.checked&&!otherMember.enabled,
      {allowedOnThisMember,left:left.ok,signed:signed.ok,present,...otherMember});
  }
  try {
    await boot(w,{subs:subsNone,office:fixture()},{restore:signedIn('none'),fold:true});
    await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
    await click(w,'#portal-entry [data-orb-prog="office"]');
    if(!await waitFor(where,row,6000))throw Error('The synthetic member could not open the office task.');
    const ready=await waitFor(where,field('terms'),1000);
    check('only the unresolved search shows an editable filter on its original card',ready&&!(await query(where,room+' [data-task-id="'+parentId+'"] [data-office-mail-review]')));
    await shots('initial',row);
    await shots('conditions',field('folder'));
    if(!ready) {
      await updateBoard(fixture({...original,mailReview:{}}));
      await shots('expired',row);
      return;
    }
    check('stored search terms, folder and inclusive leap day survive presentation',await query(({terms,folder,end})=>
      document.querySelector(terms)?.value==='예산'&&document.querySelector(folder)?.value==='inbox_sent'&&document.querySelector(end)?.value==='2028-02-29',
      {terms:field('terms'),folder:field('folder'),end:field('through')}));
    check('all editable fields are labelled and both account addresses are visible',await query(s=>{
      const p=document.querySelector(s);
      const controls=[...p.querySelectorAll('textarea,input,select')].filter(n=>n.getClientRects().length);
      return controls.length>=7&&controls.every(n=>n.labels?.length||n.getAttribute('aria-label'))&&p.textContent.includes('office@example.test')&&p.textContent.includes('team@example.test');
    },panel));
    check('the card explains that mail has not been read and exposes no machine status',await query(s=>{
      const t=document.querySelector(s)?.innerText||'';
      return t.includes('사서함')&&t.includes('아직')&&!t.includes('문제가 발생')&&!/MAIL_REVIEW|unsupported/.test(t);
    },row));
    check('single-line filter controls stay compact on the desktop',await query(s=>
      [...document.querySelectorAll(s+' select,'+s+' input[type=date]')].filter(n=>n.getClientRects().length)
        .every(n=>n.getBoundingClientRect().height<=68),panel));
    check('an unresolved phrase and its explicit exclusion are shown together',await query(s=>document.querySelector(s)?.innerText.includes('별표를 단'),panel)&&await query(where,field('omit')));
    await press(action('confirm'));
    check('unacknowledged exclusions never submit',!(await sentActions('confirmMail')).length);
    await input(field('terms'),'견적\n촬영');
    await updateBoard(fixture());
    check('a repeated snapshot keeps unsent edits and the focused input',await query(s=>document.querySelector(s)?.value==='견적\n촬영'&&document.activeElement===document.querySelector(s),field('terms')));
    await press(action('cancel'));
    check('close keeps the same card and returns focus without an IPC action',await query(s=>document.querySelector(s)?.getClientRects().length>0&&document.activeElement===document.querySelector(s),action('edit'))&&!(await sentActions('confirmMail')).length&&!(await sentActions('reviewMail')).length);
    await press(action('edit'));
    await input(field('terms'),'견적\n촬영');
    await input(field('provider'),'gmail');
    await input(field('attachment'),'has');
    await press(field('omit'));
    await input(field('from'),'studio@example.test');
    await input(field('folder'),'inbox');
    await input(field('after'),'2028-02-07');
    await input(field('through'),'2028-02-20');
    await query(s=>document.querySelector(s).focus(),field('folder'));
    await key(w,'Down');
    await key(w,'Return');
    await key(w,'Escape');
    const keyboardFolder=await query(s=>document.querySelector(s)?.value,field('folder'));
    check('selecting a different folder with the keyboard cannot start a mailbox search',
      keyboardFolder==='sent'&&!(await sentActions('confirmMail')).length&&!(await submissions()).length,keyboardFolder);
    for(const name of ['from','terms']){
      await query(s=>document.querySelector(s).focus(),field(name));
      await key(w,'Return');
    }
    check('Enter in a text field or search terms cannot start a mailbox search',
      !(await sentActions('confirmMail')).length&&!(await submissions()).length);
    await input(field('terms'),'견적\n촬영');
    for(const [dateField,value] of [['after','2028-02-07'],['through','2028-02-20']]) {
      const observed=await typePartialDate(field(dateField));
      const partial=observed.value===''&&observed.bad;
      check('Chromium has a partially typed '+dateField+' date before checking the guard',partial,observed);
      if(!partial)return;
      await press(action('confirm'));
      const stopped=await query(s=>{const n=document.querySelector(s);return n?.getAttribute('aria-invalid')==='true'&&document.activeElement===n;},field(dateField));
      const count=(await sentActions('confirmMail')).length;
      check('an incomplete '+dateField+' date cannot remove that bound and start a search',stopped&&count===0,{observed,stopped,count});
      if(dateField==='after'){
        await shots('incomplete-date',field(dateField));
        await shots('incomplete-date-note',panel+' [role="status"]');
      }
      if((await sentActions('confirmMail')).length)return;
      await input(field(dateField),value);
    }
    await shots('edited',field('through'));
    await hold('confirmMail');
    await query(s=>document.querySelector(s).focus(),action('confirm'));
    await key(w,'Return');
    check('Enter on the confirm button alone sends the edited criteria', (await sentActions('confirmMail')).length===1);
    const blockedGeneral=await query(s=>document.querySelector(s)?.disabled===true,row+' [data-task-act="task-mail-general"]');
    await press(row+' [data-task-act="task-mail-general"]');
    await press(action('confirm'));
    check('a held confirmation prevents another confirmation and ordinary work on this card',
      blockedGeneral&&(await sentActions('confirmMail')).length===1&&(await submissions()).length===0);
    await shots('confirmation-pending',action('confirm'));
    await release();
    check('confirmation through the keyboard produces one result on the original task',await waitFor(s=>document.querySelector(s)?.innerText.includes('견적 확인'),row)&&(await sentActions('confirmMail')).length===1);
    const submitted=(await calls(w)).filter(c=>c.startsWith('office-mail-confirmed:')).map(c=>JSON.parse(c.slice('office-mail-confirmed:'.length)));
    const actual=submitted[0]?.filter;
    check('the confirmed IPC contains the exact edited criteria and exclusive end date',submitted.length===1&&submitted[0].id===ownerId&&submitted[0].reviewId===reviewId&&
      actual?.before==='2028-02-21'&&actual.after==='2028-02-07'&&actual.from==='studio@example.test'&&actual.folder==='sent'&&actual.provider==='gmail'&&actual.attachment==='has'&&actual.terms?.join('|')==='견적|촬영',submitted[0]||{});
    const displayed=await query(s=>{
      const receipt=document.querySelector(s+' [aria-label="메일 검색 결과"]');
      const item=receipt?.querySelector('li');
      return {text:receipt?.innerText||'',sender:item?.querySelector('p.off-task-note')?.textContent||'',item:item?.innerText||''};
    },row);
    check('the completed card shows the confirmed sender, filter scope and matching result',
      !!actual&&displayed.sender.includes('<'+actual.from+'>')&&displayed.text.includes(searchScope(actual))&&
      actual.terms.every(term=>displayed.item.includes(term)),{approved:actual,displayed});
    const approval=await query(s=>document.querySelector(s)?.textContent||'',row+' [data-task-answer]');
    check('the result quotes the exact omitted condition after explicit selection',
      submitted[0]?.omitUnmet===true&&approval.includes('“별표를 단”')&&approval.includes('회원이 선택한 범위'),approval);
    await shots('result',row);
    await updateBoard(fixture({...original,mailReview:{}}));
    check('a stale review can be renewed on its original card without confirming broad criteria',await waitFor(where,action('renew'))&&!(await query(where,action('confirm'))));
    await shots('expired',row);
    await query(s=>document.querySelector(s).focus(),action('renew'));
    await key(w,'Return');
    check('renew restores the candidate on the same card without searching',await waitFor(where,field('terms'))&&(await sentActions('reviewMail')).length===1&&(await sentActions('confirmMail')).length===1&&(await submissions()).length===0);
    check('keyboard renewal returns focus to the restored search terms on the same card',
      await query(s=>document.activeElement===document.querySelector(s),field('terms')));
    async function inspectMailbox() {
      return query(s=>{
        const select=document.querySelector(s);
        const options=[...select.options].map(o=>({id:o.value,label:o.textContent,disabled:o.disabled}));
        return {selected:select.value,options};
      },field('provider'));
    }
    const scopeId='a1000000-0000-4000-8000-000000000005';
    const blockedScopeId='a1000000-0000-4000-8000-000000000006';
    const scoped={...review,reviewId:scopeId,availableProviders:['gmail','gmail','unknown'],unmet:[]};
    const scopeCard=reviewData=>fixture({...original,mailReview:reviewData});
    await updateBoard(scopeCard(scoped));
    const single=await inspectMailbox();
    const names=single.options.filter(o=>!o.disabled).map(o=>o.id);
    const allLabel=single.options.find(o=>o.id==='all')?.label||'';
    check('a follow-up search lists only its connected permitted mailbox and names it under all',
      JSON.stringify(names)===JSON.stringify(['all','gmail'])&&allLabel.includes('Gmail')&&!allLabel.includes('Outlook')&&
      single.options.some(o=>o.id==='gmail'&&o.label.includes('office@example.test'))&&!single.options.some(o=>o.label.includes('team@example.test')),single);
    await shots('scope',field('provider'));
    await updateBoard(scopeCard({...scoped,unmet:['별표']}));
    await press(field('omit'));
    await updateBoard(scopeCard({...scoped,unmet:['안 읽은 메일']}));
    check('a different unsupported phrase must be excluded explicitly even with the same review id',
      await query(s=>document.querySelector(s)?.checked===false,field('omit'))&&await query(s=>document.querySelector(s)?.disabled===true,action('confirm')));
    await updateBoard(scopeCard(scoped));
    await input(field('terms'),'수정해 둔 조건');
    await updateBoard(scopeCard(scoped));
    check('a repeated mailbox scope update preserves local terms and focus',await query(s=>document.querySelector(s)?.value==='수정해 둔 조건'&&document.activeElement===document.querySelector(s),field('terms')));
    await updateBoard(scopeCard({...scoped,reviewId:blockedScopeId,filter:{...filter,provider:'outlook'}}));
    const blockedChoice=await inspectMailbox();
    check('an ineligible former selection cannot broaden to all or expose a replacement address',
      blockedChoice.selected!=='all'&&await query(s=>document.querySelector(s)?.disabled===true,action('confirm'))&&!blockedChoice.options.some(o=>o.label.includes('team@example.test')),blockedChoice);
    await shots('scope-blocked',field('provider'));
    await updateBoard(scopeCard({...scoped,reviewId:reviewId,availableProviders:[]}));
    const empty=await inspectMailbox();
    check('an empty intersection cannot search a different currently connected account',
      !empty.options.some(o=>!o.disabled)&&await query(s=>document.querySelector(s)?.disabled===true,action('confirm'))&&(await sentActions('confirmMail')).length===1,empty);
    await shots('scope-empty',field('provider'));
    await updateBoard(scopeCard({...scoped,reviewId:secondId,availableProviders:['outlook','gmail']}));
    const both=await inspectMailbox();
    const labels=both.options.find(o=>o.id==='all')?.label||'';
    check('the full inherited folder scope names both actual providers',labels.includes('Gmail')&&labels.includes('Outlook'));
    await updateBoard(scopeCard({...review,reviewId:secondId}));
    const formPrompt=room+' [data-task-prompt]',mode=room+' [data-office-mail-mode]';
    await press(row+' [data-task-act="task-retry"]');
    check('original editing fills and focuses the regular composer without a new mail action',
      await waitFor(({p,m,value})=>document.querySelector(p)?.value===value&&document.querySelector(m)?.value==='mail'&&document.activeElement===document.querySelector(p),
        {p:formPrompt,m:mode,value:prompt})&&(await sentActions('confirmMail')).length===1&&(await sentActions('reviewMail')).length===1&&(await submissions()).length===0);
    await press(field('omit'));
    check('confirmation is available immediately before sending ordinary work',
      await query(s=>document.querySelector(s)?.disabled===false,action('confirm')));
    await hold('submit');
    await press(row+' [data-task-act="task-mail-general"]');
    const blockedReview=await query(s=>document.querySelector(s)?.disabled===true,action('confirm'));
    await press(action('confirm'));
    const ordinary=await submissions();
    check('ordinary work uses the original text, department and parent without a further mailbox action',
      blockedReview&&ordinary.length===1&&ordinary[0].mailSearch===false&&ordinary[0].prompt===prompt&&ordinary[0].previousId===parentId&&ordinary[0].departmentId===null&&
      (await sentActions('confirmMail')).length===1&&(await sentActions('reviewMail')).length===1);
    await release();
    await waitFor(s=>!document.querySelector(s)?.disabled,field('from'));
    const hadPrivateDraft=await input(field('from'),'private-draft@example.test');
    const hadPrivateTerms=await input(field('terms'),'다음 회원에서 숨길 미전송 검색어');
    await query(auth=>window.__orbFixture.setAuth(auth),{...signedOut,sessionGeneration:signedIn('none').sessionGeneration+1});
    const loggedOut=await until(w,s=>s.mode==='portal'&&s.phase==='auth'&&s.ui==='ask',{timeout:7000});
    const privateValues=['private-draft@example.test','다음 회원에서 숨길 미전송 검색어',original.prompt];
    const cleared=await query(({room,panel,privateValues})=>!document.querySelector(panel)&&
      ![...document.querySelectorAll(room+' input,'+room+' textarea')].some(i=>privateValues.includes(i.value)),{room,panel,privateValues});
    check('changing member removes the review and its typed sender and terms from DOM',hadPrivateDraft&&hadPrivateTerms&&loggedOut.ok&&cleared,{hadPrivateDraft,hadPrivateTerms,loggedOut:loggedOut.ok,cleared});
    const nextMemberTask={...previous,id:'a1000000-0000-4000-8000-000000000087',prompt:'두 번째 회원의 업무를 확인해 주세요.',answer:'두 번째 회원의 메모입니다.'};
    const nextBoard=fixture();nextBoard.tasking.tasks=[nextMemberTask];
    await query(board=>window.__orbFixture.setOffice(board),nextBoard);
    const second={...signedIn('none',8),accountGeneration:'a1000000-0000-4000-8000-000000000077',account:{synk_user_id:'synthetic-second-member',display_name:'두 번째 합성 회원'}};
    await query(auth=>window.__orbFixture.setAuth(auth),second);
    const relog=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
    await click(w,'#portal-entry [data-orb-prog="office"]');
    const nextMemberCard=room+' [data-task-id="'+nextMemberTask.id+'"]';
    const readyAtClick=await query(where,nextMemberCard);
    const secondMemberReady=await waitFor(({selector,answer})=>{
      const card=document.querySelector(selector);return card?.getClientRects().length&&card.innerText.includes(answer);
    },{selector:nextMemberCard,answer:nextMemberTask.answer},6000);
    const restoredPrivate=await query(({room,row,privateValues})=>Boolean(document.querySelector(row))||
      [...document.querySelectorAll(room+' input,'+room+' textarea')].some(n=>privateValues.includes(n.value)),{room,row,privateValues});
    check('once the second member task is rendered, the prior card, original prompt and private fields are gone',
      relog.ok&&secondMemberReady&&!restoredPrivate,{readyAtClick,secondMemberReady,restoredPrivate});
    await checkPeriodChoice();
    await checkRequestedSource();
    await checkRoleChoices();
  } finally {
    w.win.destroy();
  }
};
