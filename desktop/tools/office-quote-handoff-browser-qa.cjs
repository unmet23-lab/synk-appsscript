'use strict';

// Exercises the real office renderer against synthetic mail retained by the offline bridge.
module.exports = async function checkQuoteHandoff({open, boot, signedIn, subsNone, until, wait, click, capture, check, calls}) {
  const w = await open();
  const room = '#portal-entry [data-room="solio-office"]';
  const provider = room + ' [data-task-provider]';
  const mode = room + ' [data-office-mail-mode]';
  const prompt = room + ' [data-task-prompt]';
  const submit = room + ' [data-task-submit]';
  const childId = 'b0000000-0000-4000-8000-000000000010';
  const itemId = 'b0000000-0000-4000-8000-000000000020';
  const duplicateId = 'b0000000-0000-4000-8000-000000000030';
  const item = {id:itemId, subject:'봄 전시 촬영 견적 문의', from:'가람 기획 <team@example.test>', date:'2026-11-18T01:00:00Z',
    snippet:'제품 촬영 12컷의 견적과 가능한 일정을 부탁드립니다.'};
  const evidence = '제품 촬영 12컷을 문의했습니다. <img src="bad-mail-fixture">';
  const draft = '요청하신 제품 촬영 12컷의 용도와 희망 납품일을 알려주시면 견적을 준비하겠습니다.';
  const request = '아직 답 안 한 견적 문의를 찾아 견적 담당에게 넘겨줘.';
  const groups = [{provider:'gmail', address:'quote@example.test', items:[item], more:false},
    {provider:'outlook', address:'office@example.test', items:[], more:false, code:'MAIL_RECONNECT'}];
  const mail = {providers:[{id:'gmail',configured:true,connected:true,address:'quote@example.test'},
    {id:'outlook',configured:true,connected:false,reconnect:true,address:'office@example.test'}]};
  const card = id => room + ' [data-task-id="' + id + '"]';
  const evaluate = (fn, arg) => w.js('(' + String(fn) + ')(' + JSON.stringify(arg ?? null) + ')');
  async function eventually(fn, arg) {
    const end = Date.now() + 7500;
    while (Date.now() < end) {
      if (await evaluate(fn,arg)) return true;
      await wait(70);
    }
    return false;
  }
  const visible = sel => Boolean(document.querySelector(sel)?.getClientRects().length);
  async function change(sel, value) {
    await evaluate(({sel,value})=>{
      const field=document.querySelector(sel);
      if (field) {field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));}
    },{sel,value});
    return eventually(({sel,value})=>document.querySelector(sel)?.value===value,{sel,value});
  }
  async function write(value) {
    await evaluate(s=>{const field=document.querySelector(s);field.focus();field.select();},prompt);
    await w.win.webContents.insertText(value);
  }
  async function mutate(edit) {
    const board = await evaluate(()=>window.__orbFixture.office());
    edit(board);
    await evaluate(b=>window.__orbFixture.setOffice(b),board);
  }
  async function press(sel) {
    return evaluate(s=>{
      const button=document.querySelector(s);
      if (!button || button.disabled || !button.getClientRects().length) return false;
      button.click();
      return true;
    },sel);
  }
  async function shots(name, sel) {
    for (const [width,height] of [[1440,900],[390,844]]) {
      w.win.setContentSize(width,height);
      await eventually(n=>innerWidth===n,width);
      await evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),sel);
      await wait(180);
      await capture(w,'office-quote-'+name+'-'+width);
      const fit = await evaluate(s=>{
        const r=document.querySelector(s);
        return r && r.scrollWidth<=r.clientWidth+1 && document.documentElement.scrollWidth<=innerWidth+1 &&
          ![...r.querySelectorAll('img')].some(img=>img.getClientRects().length&&img.complete&&!img.naturalWidth);
      },room);
      check(name+' at '+width+' fits the office and loads its images',Boolean(fit));
      if (name==='draft' && width===390) {
        const readable = await evaluate(s=>{
          const source=document.querySelector(s);
          const answer=source?.closest('[data-task-id]')?.querySelector('[data-task-answer]');
          const notes=Array.from(source?.querySelectorAll('.off-task-note') || [], n=>n.getBoundingClientRect());
          const open=source?.querySelector('[data-office-quote-source]')?.getBoundingClientRect();
          const body=source?.getBoundingClientRect();
          return notes.length>=5 && open && body && answer &&
            notes[0].top-answer.getBoundingClientRect().bottom<30 &&
            notes.every((rect,i)=>rect.right<=body.right+1 && (!i || rect.top>=notes[i-1].bottom-1)) &&
            open.top>=notes[4].bottom-1 && open.top-notes[4].bottom<30;
        },sel);
        check('at 390 pixels the evidence follows the draft vertically and the original opens on its own row',Boolean(readable));
      }
    }
    w.win.setContentSize(1440,900);
  }
  const requests=async()=>(await calls(w)).filter(s=>s.startsWith('office-task-submit:')).map(s=>JSON.parse(s.slice('office-task-submit:'.length)));
  const waitCount=n=>eventually(n=>window.__orbFixture.calls().filter(s=>s.startsWith('office-task-submit:')).length===n,n);
  try {
    await boot(w,{subs:subsNone,office:{available:true,departments:[],sessions:[],tasking:{tasks:[],mail}}},{restore:signedIn('none'),fold:true});
    await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
    await eventually(visible,'#portal-entry [data-orb-prog="office"]');
    await click(w,'#portal-entry [data-orb-prog="office"]');
    if (!await eventually(visible,provider)) throw Error('Office composer did not load');
    await change(provider,'codex');
    if (!await eventually(visible,mode)) throw Error('Mail mode selector missing');
    const offers = await evaluate(s=>[...document.querySelector(s).options].some(o=>o.value==='quote'&&o.textContent==='미회신 견적 문의 넘기기'),mode);
    check('GPT offers an explicit unanswered-quote handoff in the office',offers);
    if (!offers) return;
    await change(mode,'quote');
    await shots('choice',mode);
    await press(submit);
    if (!await waitCount(1)) throw Error('No explicit handoff reached the offline bridge');
    const first = (await requests())[0];
    check('the explicit choice submits one fresh GPT mail handoff even when the draft is empty',
      first.provider==='codex' && first.quoteHandoff===true && first.mailSearch===true && !first.previousId &&
      !Object.hasOwn(first,'quoteResumeOf') && /견적/.test(first.prompt));
    check('completed submission restores the automatic choice',await eventually(s=>document.querySelector(s)?.value==='auto',mode));
    await write(request);
    await press(submit);
    await waitCount(2);
    const natural = (await requests())[1];
    check('automatic keeps natural Korean available to the backend classifier',natural?.prompt===request && !Object.hasOwn(natural,'quoteHandoff') && !Object.hasOwn(natural,'mailSearch'));
    for (const [choice, flag, count] of [['mail',true,3],['general',false,4]]) {
      await change(mode,choice);
      await write(request);
      await press(submit);
      await waitCount(count);
      const ordinary=(await requests())[count-1];
      check(choice+' mode preserves the explicit non-handoff intent',ordinary?.mailSearch===flag && !Object.hasOwn(ordinary,'quoteHandoff'));
      await eventually(s=>document.querySelector(s)?.value==='auto',mode);
    }
    const now = Date.now();
    const parent = {...first, status:'completed', reason:null, answer:'Gmail에서 미회신 견적 문의 1건을 넘겼습니다. Outlook은 다시 연결해야 합니다.',
      mailResult:{scope:'받은 메일',groups}, handoffs:[{id:childId,parentId:first.id,status:'queued',subject:item.subject}],
      createdAt:now-20000, updatedAt:now};
    const child = {id:childId,provider:'codex',mailSearch:true,departmentId:null,prompt:'문의 근거를 확인하고 견적 답장 초안을 작성해 주세요.',
      status:'queued',reason:null,answer:'',quoteSource:{parentId:first.id,itemId,subject:item.subject,from:item.from,date:item.date,evidence,provider:'gmail'},createdAt:now-10000,updatedAt:now};
    const duplicate = {...parent,id:duplicateId,answer:'이전에 넘긴 견적 업무가 있습니다.',createdAt:now,updatedAt:now};
    await mutate(b=>{b.tasking.tasks=[duplicate,child,parent];});
    const parentCard=card(first.id), childCard=card(childId), duplicateCard=card(duplicateId);
    const section=childCard+' [data-office-quote-child]';
    const source=childCard+' [data-office-quote-source]';
    const linked=duplicateCard+' [data-office-quote-link]';
    if (!await eventually(visible,linked) || !await eventually(visible,section)) throw Error('Handoff cards were not visible');
    check('the partially searched parent keeps its mailbox status and a link to the child',
      await evaluate(s=>{const r=document.querySelector(s);return Boolean(r?.querySelector('[data-office-quote-parent]')&&r.innerText.includes('Outlook')&&r.innerText.includes('다시 연결'));},parentCard));
    await shots('parent',parentCard+' [data-office-quote-parent]');
    const repeat=parentCard+' [data-task-act="task-mail-repeat"]';
    check('a partial handoff offers its own survey continuation and hides a generic session follow-up',
      await evaluate(s=>{const root=document.querySelector(s);const next=root?.querySelector('[data-task-act="task-mail-repeat"]');
        return next?.getClientRects().length&&next.textContent.trim()==='이어서 조사'&&
          !root.querySelector('[data-task-act="task-follow"]')?.getClientRects().length;},parentCard));
    const beforeRescan=(await requests()).length;
    await press(repeat);
    const repeatSent=await waitCount(beforeRescan+1);
    const continued=(await requests()).at(-1);
    check('a survey continuation sends its own origin and a fresh request without opening a conversation',
      repeatSent && continued.id!==first.id && continued.quoteResumeOf===first.id && continued.quoteHandoff===true &&
      continued.mailSearch===true && continued.provider==='codex' && !continued.previousId &&
      !Object.hasOwn(continued,'mailRetry') && continued.prompt===first.prompt);
    await mutate(b=>{const scan=b.tasking.tasks.find(t=>t.id===first.id);
      scan.quoteCanResume=true; scan.mailResult={scope:'받은 메일',groups:[groups[0]]};});
    check('a provider error in a later batch leaves a working continuation on its root survey',
      await eventually(s=>{const b=document.querySelector(s);return b?.getClientRects().length&&!b.disabled&&b.textContent.trim()==='이어서 조사';},repeat));
    check('a queued recipient shows the retained subject and plain text evidence without offering a previous session',
      await evaluate(({s,subject})=>{const r=document.querySelector(s);return r.innerText.includes(subject)&&r.innerText.includes('<img src="bad-mail-fixture">')&&
        !r.querySelector('img[src="bad-mail-fixture"]')&&
        ![...r.querySelectorAll('button')].some(b=>b.getClientRects().length&&/이어서 맡기기|터미널|다시 맡기기/.test(b.textContent));},{s:childCard,subject:item.subject}));
    const beforeLinks=(await requests()).length;
    await evaluate(s=>document.querySelector(s).focus(),linked);
    w.win.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'});
    w.win.webContents.sendInputEvent({type:'char',keyCode:'\r'});
    w.win.webContents.sendInputEvent({type:'keyUp',keyCode:'Return'});
    check('keyboard activation of a reused link focuses its original receiving card',
      await eventually(id=>document.activeElement?.closest('[data-task-id]')?.getAttribute('data-task-id')===id,childId));
    check('opening retained source passes the original task and item IDs only',await press(source)&&
      await eventually(s=>window.__orbFixture.calls().includes(s),'office-mail-open:'+first.id+':'+itemId));
    const secondId='b0000000-0000-4000-8000-000000000011';
    const secondItem='b0000000-0000-4000-8000-000000000021';
    const secondSubject='여름 사진 촬영 견적 문의';
    const sibling=card(secondId)+' [data-office-quote-child]';
    const noteVisible=sel=>document.querySelector(sel)?.innerText.includes('더는 찾지 못해');
    await mutate(b=>{
      b.mailTestCodes={open:'MAIL_NOT_FOUND'};
      const scan=b.tasking.tasks.find(t=>t.id===first.id);
      scan.mailResult.groups[0].items.push({...item,id:secondItem,subject:secondSubject});
      b.tasking.tasks.unshift({...child,id:secondId,quoteSource:{...child.quoteSource,itemId:secondItem,subject:secondSubject}});
    });
    await eventually(visible,sibling);
    await press(source);
    await eventually(noteVisible,section);
    check('one missing original reports an error only on its own receiving card',
      await evaluate(noteVisible,section) && !await evaluate(noteVisible,sibling));
    await shots('source-error',sibling);
    await mutate(b=>{b.mailTestCodes={};});
    await press(card(secondId)+' [data-office-quote-source]');
    await eventually(s=>window.__orbFixture.calls().includes(s),'office-mail-open:'+first.id+':'+secondItem);
    await wait(100);
    check('opening a sibling original successfully preserves the failed original’s own notice',
      await evaluate(noteVisible,section) && !await evaluate(noteVisible,sibling));
    await press(source);
    check('success on the same original removes its own notice',
      await eventually(s=>!document.querySelector(s)?.innerText.includes('더는 찾지 못해'),section));
    await mutate(b=>{
      b.tasking.tasks=b.tasking.tasks.filter(t=>t.id!==secondId);
      const scan=b.tasking.tasks.find(t=>t.id===first.id);
      scan.mailResult.groups[0].items=scan.mailResult.groups[0].items.filter(it=>it.id!==secondItem);
    });
    await mutate(b=>{const t=b.tasking.tasks.find(t=>t.id===childId);Object.assign(t,{status:'completed',quoteOutcome:'draft',answer:draft,updatedAt:now+10});});
    check('a refreshed receiving card displays the actual draft as a draft',await eventually(({s,draft})=>{
      const r=document.querySelector(s);return r?.innerText.includes('견적 답장 초안')&&r.innerText.includes(draft);},{s:childCard,draft}));
    const outcomeMatches=({child,link,label})=>document.querySelector(child+' .off-task-status')?.textContent.trim()===label&&
      document.querySelector(link)?.textContent.endsWith(label);
    check('the receiving badge and its parent link both report that the draft is ready',
      await eventually(outcomeMatches,{child:childCard,link:parentCard+' [data-office-quote-link]',label:'초안 작성 완료'}));
    await shots('draft',section);
    await press(parentCard+' [data-office-quote-link]');
    check('pointer navigation opens the same existing task without resubmitting it',
      await eventually(id=>document.activeElement?.closest('[data-task-id]')?.getAttribute('data-task-id')===id,childId) &&
      (await requests()).length===beforeLinks && await evaluate(s=>document.querySelectorAll(s).length,childCard)===1);
    const held='원문을 다시 확인하니 이미 회신이 있어 견적 답장 작성을 보류했습니다.';
    await mutate(b=>{
      const t=b.tasking.tasks.find(t=>t.id===childId);
      Object.assign(t,{status:'completed',quoteOutcome:'held',answer:held,updatedAt:now+20});
    });
    check('a hold shows the reason from the second check and does not present it as a completed draft',
      await eventually(({s,held,draft})=>{const r=document.querySelector(s);return r?.innerText.includes(held)&&
        !r.innerText.includes(draft)&&![...r.querySelectorAll('strong,b,span,dt,h3,h4,p')].some(el=>el.getClientRects().length&&el.textContent.trim()==='견적 답장 초안');},{s:childCard,held,draft}));
    check('a hold is labelled as a hold in both the receiving badge and the parent link',
      await eventually(outcomeMatches,{child:childCard,link:parentCard+' [data-office-quote-link]',label:'보류'}));
    await shots('held',section);
    for (const [status,reason,label] of [['failed','CANCELLED','취소됨'],['interrupted',null,'중단됨']]) {
      await mutate(b=>{
        const task=b.tasking.tasks.find(t=>t.id===childId);
        delete task.quoteOutcome;
        Object.assign(task,{status,reason,answer:'',canRetry:false,updatedAt:now+25});
      });
      check('the parent and receiving card agree on '+label,
        await eventually(outcomeMatches,{child:childCard,link:parentCard+' [data-office-quote-link]',label}));
    }
    await mutate(b=>{
      const t=b.tasking.tasks.find(t=>t.id===childId);
      delete t.quoteOutcome;
      Object.assign(t,{status:'failed',reason:'MAIL_NETWORK',answer:'',canRetry:true,updatedAt:now+30});
    });
    const retryable=await eventually(s=>[...document.querySelector(s).querySelectorAll('button')].some(b=>b.getClientRects().length&&!b.disabled&&b.textContent.trim()==='다시 작성'),childCard);
    if (retryable) await evaluate(s=>[...document.querySelector(s).querySelectorAll('button')].find(b=>b.getClientRects().length&&b.textContent.trim()==='다시 작성').click(),childCard);
    check('retrying a recoverable failed quote resumes its own stored task without a new submit',retryable&&
      await eventually(call=>window.__orbFixture.calls().includes(call),'office-task-action:'+childId+':resume') &&
      (await requests()).length===beforeLinks);
    await mutate(b=>{
      const t=b.tasking.tasks.find(t=>t.id===childId);
      Object.assign(t,{status:'failed',reason:'MAIL_CHANGED',answer:'',canRetry:false,updatedAt:now+40});
    });
    check('a failed quote without the retry capability cannot resume',await eventually(s=>
      ![...document.querySelector(s).querySelectorAll('button')].some(b=>b.getClientRects().length&&!b.disabled&&b.textContent.trim()==='다시 작성'),childCard));
    await mutate(b=>{
      const t=b.tasking.tasks.find(t=>t.id===duplicateId);
      Object.assign(t,{handoffs:[],answer:'연결된 받은편지함에서 미회신 견적 문의가 없었습니다.',
        mailResult:{scope:'받은 메일',groups:[{provider:'gmail',address:'quote@example.test',items:[],more:false}]}});
    });
    check('a completed empty scan removes its stale handoff link',await eventually(s=>{
      const r=document.querySelector(s);return r?.innerText.includes('미회신 견적 문의가 없었습니다.')&&!r.querySelector('[data-office-quote-link]');},duplicateCard));
    await mutate(b=>{b.tasking.tasks=b.tasking.tasks.filter(t=>t.id!==childId);});
    check('a missing receiving card cannot be activated from a stale parent receipt',await eventually(s=>{
      const r=document.querySelector(s);const link=r?.querySelector('[data-office-quote-link]');
      return !link||link.disabled||link.getAttribute('aria-disabled')==='true'||!link.getClientRects().length;
    },parentCard));
    await mutate(b=>{b.tasking.tasks.push({...child});});
    await eventually(visible,section);
    await mutate(b=>{b.tasking.tasks=b.tasking.tasks.filter(t=>t.id!==first.id);});
    check('when the original item is absent the recipient cannot open an arbitrary message',
      await eventually(s=>{const b=document.querySelector(s);return !b || b.disabled || !b.getClientRects().length;},source));
    await mutate(b=>Object.assign(b.tasking.tasks.find(t=>t.id===childId),{status:'completed',reason:null,quoteOutcome:'draft',answer:draft}));
    check('the retained draft is present in the signed-in session before sign-out',await eventually(({s,t})=>document.querySelector(s)?.innerText.includes(t),{s:childCard,t:draft}));
    await mutate(b=>{delete b.tasking.mail;});
    check('removing private mailbox access clears the sender, retained evidence, and completed draft from the card',
      await eventually(({s,e,t})=>{const r=document.querySelector(s);return !r||!r.innerText.includes(e)&&!r.innerText.includes(t)&&!r.innerText.includes('team@example.test');},{s:childCard,e:evidence,t:draft}));
    check('without private mailbox access the receiving card does not disclose the quote outcome',
      await eventually(s=>{const label=document.querySelector(s+' .off-task-status')?.textContent||'';
        return !/보류|초안 작성 완료/.test(label);},childCard));
    await mutate(b=>{b.tasking.mail=mail;});
    check('restoring the owner mailbox capability makes the retained draft available again',
      await eventually(({s,t})=>document.querySelector(s)?.innerText.includes(t),{s:childCard,t:draft}));
    const ownerBoard=await evaluate(()=>window.__orbFixture.office());
    await click(w,'.here-orb');
    await until(w,s=>s.fan);
    await click(w,'.fan [data-foot="logout"]');
    const loggedOut=await until(w,s=>s.phase==='auth'&&s.ui==='ask',{timeout:12000});
    check('sign-out clears estimate evidence and draft from the office including hidden markup',loggedOut.ok&&(await calls(w)).includes('signOut')&&
      await eventually(({sel,draft,evidence})=>{const saved=document.querySelector(sel)?.textContent||'';
        return !saved.includes(draft)&&!saved.includes(evidence)&&!saved.includes('team@example.test');},{sel:room,draft,evidence}));
    const owner=signedIn('none',5);
    await evaluate(({auth,board})=>{
      window.__orbFixture.configure({office:board}); window.__orbFixture.restore(auth);
    },{auth:owner,board:ownerBoard});
    await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
    await click(w,'#portal-entry [data-orb-prog="office"]');
    const hadPrivateQuote=await eventually(({s,draft,evidence})=>{
      const content=document.querySelector(s)?.innerText||'';
      return content.includes(draft)&&content.includes(evidence)&&content.includes('team@example.test');
    },{s:childCard,draft,evidence});
    const nextOwner={...signedIn('none',7),accountGeneration:'10000000-0000-4000-8000-000000000091',
      account:{synk_user_id:'20000000-0000-4000-8000-000000000091',display_name:'다음 합성 회원'}};
    await evaluate(({next,sel,draft,evidence})=>{
      const portal=document.querySelector('#portal-entry');
      const read=()=>{
        if(document.documentElement.dataset.orbClient!=='portal'||portal.dataset.portalAuthStatus!=='signed-in')return;
        const raw=document.querySelector(sel)?.textContent||'';
        window.__quoteMemberChangeSample={draft:raw.includes(draft),evidence:raw.includes(evidence),sender:raw.includes('team@example.test')};
        observer.disconnect();
      };
      window.__quoteMemberChangeSample=null;
      const observer=new MutationObserver(read);
      observer.observe(portal,{attributes:true,childList:true,subtree:true});
      window.__orbFixture.holdAuth();
      window.__orbFixture.configure({office:{available:false,departments:[],sessions:[]}});
      window.__orbFixture.setAuth(next);
      queueMicrotask(read);
    },{next:nextOwner,sel:room,draft,evidence});
    await eventually(()=>Boolean(window.__quoteMemberChangeSample));
    const atBoundary=await evaluate(()=>window.__quoteMemberChangeSample);
    check('a direct change between signed-in members clears the previous original, sender, and draft even from hidden markup',
      hadPrivateQuote&&atBoundary&&!atBoundary.draft&&!atBoundary.evidence&&!atBoundary.sender,{hadPrivateQuote,atBoundary});
  } finally {w.win.destroy();}
};
