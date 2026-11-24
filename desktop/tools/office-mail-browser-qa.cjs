'use strict';

const { summary }=require('../src/office-mail.cjs');

// Exercises the real office renderer through its synthetic, offline Electron bridge.
module.exports = async function checkOfficeMail({open,boot,signedIn,signedOut,subsNone,until,wait,click,capture,check,calls}) {
  const w=await open();
  const room='#portal-entry [data-room="solio-office"]';
  const picker=room+' [data-task-provider]', prompt=room+' [data-task-prompt]', mode=room+' [data-office-mail-mode]';
  const primaryId='20000000-0000-4000-8000-000000000007';
  const address='studio@example.test', other='orders@example.test';
  const original='지난주 견적 메일 찾아줘.';
  const scope='11월 9일–15일 · 받은 메일';
  const subject='공연 촬영 견적 문의 <시안>';
  const group={provider:'gmail',address,items:[{id:primaryId,subject,from:'지수 <team@example.test>',date:'2026-11-12T02:35:00Z',
    snippet:'다음 달 공연의 촬영 견적과 일정을 부탁드립니다.'}],more:true};
  const failed={provider:'outlook',address:other,items:[],more:false,code:'MAIL_RECONNECT'};
  const available=[{id:'gmail',configured:true,connected:true,address},{id:'outlook',configured:true,connected:false,reconnect:true,address:other}];
  const query=(fn,arg)=>w.js('('+String(fn)+')('+JSON.stringify(arg??null)+')');
  async function eventually(fn,arg){
    const end=Date.now()+7000;
    while(Date.now()<end){if(await query(fn,arg))return true;await wait(70);}
    return false;
  }
  const visible=sel=>!!document.querySelector(sel)?.getClientRects().length;
  async function mutate(fn){
    const board=await query(()=>window.__orbFixture.office());
    fn(board);
    await query(b=>window.__orbFixture.setOffice(b),board);
  }
  async function choose(provider){
    await query(({sel,provider})=>{const node=document.querySelector(sel);node.value=provider;node.dispatchEvent(new Event('change',{bubbles:true}));},{sel:picker,provider});
    await eventually(({sel,provider})=>document.querySelector(sel)?.value===provider,{sel:picker,provider});
  }
  async function press(sel){
    return query(sel=>{const b=document.querySelector(sel);if(!b||b.disabled||!b.getClientRects().length)return false;b.click();return true;},sel);
  }
  async function writePrompt(value){
    await query(sel=>{const t=document.querySelector(sel);t.focus();t.select();},prompt);
    await w.win.webContents.insertText(value);
  }
  async function revealConnections(){
    await query(sel=>{for(const b of document.querySelectorAll(sel+' form details'))if(!b.open)b.querySelector('summary')?.click();},room);
  }
  async function shots(name,focus,panel=room){
    for(const [width,height] of [[1440,900],[390,844]]){
      w.win.setContentSize(width,height);
      await eventually(width=>innerWidth===width,width);
      await query(sel=>document.querySelector(sel)?.scrollIntoView({block:'start'}),focus);
      await wait(140);
      await capture(w,'office-mail-'+name+'-'+width);
      const fit=await query(sel=>{const r=document.querySelector(sel);return !!r?.getClientRects().length&&r.clientWidth>0&&r.scrollWidth<=r.clientWidth+1&&![...r.querySelectorAll('img')].some(i=>i.getClientRects().length&&i.complete&&!i.naturalWidth);},panel);
      check(name+' at '+width+' stays inside the visible panel and loads its assets',fit);
    }
    w.win.setContentSize(1440,900);
  }
  const sent=async()=>(await calls(w)).filter(c=>c.startsWith('office-task-submit:')).map(c=>JSON.parse(c.slice('office-task-submit:'.length)));
  try{
    await boot(w,{subs:subsNone,office:{available:true,departments:[],sessions:[],tasking:{tasks:[]}}},{restore:signedIn('none'),fold:true});
    await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
    await eventually(visible,'#portal-entry [data-orb-prog="office"]');
    await click(w,'#portal-entry [data-orb-prog="office"]');
    if(!await eventually(visible,picker))throw Error('No office composer in the member session.');
    await choose('codex');
    check('the ordinary app keeps the original GPT form without mailbox controls',!(await query(visible,mode))&&await query(visible,prompt));
    await mutate(b=>{b.tasking.mail={providers:[{id:'gmail',configured:false,connected:false},{id:'outlook',configured:true,connected:false}]};b.mailTestCodes={outlook:'MAIL_CANCELLED'};b.mailTestAddresses={outlook:other};});
    await revealConnections();
    if(!await eventually(visible,mode)){check('a private GPT form offers an explicit mail search',false);return;}
    // 메일 연결 칸이 선 긴 입력칸도 작은 창에서 「맡기기」에 닿는다: 사람이 스크롤할 수 없는 칸(overflow hidden)은 움직이지 않고 단추가 방 안에 온다(Fable 최종 F2)
    for(const [width,height] of [[960,680],[1180,700],[873,618]]){
      w.win.setContentSize(width,height);
      await eventually(([width,height])=>innerWidth===width&&innerHeight===height,[width,height]);
      await wait(150);
      const reach=await query(({room,submit})=>{
        const box=document.querySelector(room),b=document.querySelector(submit);
        if(!box||!b)return {ok:false,why:'missing'};
        // 방이 떠오르는 움직임(10px, 0.55초)이 끝나기 전에 재면 방 상자가 그만큼 넘친다. 실제 창처럼 끝낸 뒤 잰다
        for(const a of box.getAnimations({subtree:true}))try{a.finish();}catch{}
        b.scrollIntoView({block:'nearest'});
        const stuck=[];for(let n=b;n&&n!==box.parentElement;n=n.parentElement){const o=getComputedStyle(n).overflowY;if((o==='hidden'||o==='clip')&&n.scrollTop>0)stuck.push(n.className||n.tagName);}
        const r=box.getBoundingClientRect(),q=b.getBoundingClientRect();
        const ok=stuck.length===0&&q.height>0&&q.top>=r.top-1&&q.bottom<=r.bottom+1;
        for(let n=b;n&&n!==box.parentElement;n=n.parentElement)if(n.scrollTop)n.scrollTop=0;
        const chain=ok?null:[];if(chain)for(let n=b;n&&n!==box.parentElement;n=n.parentElement){const st=getComputedStyle(n);if(n.scrollHeight>n.clientHeight+1||st.overflowY!=='visible')chain.push([(n.className||n.tagName).toString().slice(0,40),st.overflowY,n.clientHeight,n.scrollHeight,n.scrollTop]);}
        return {ok,stuck,submit:[Math.round(q.top),Math.round(q.bottom)],room:Math.round(r.bottom),chain};
      },{room,submit:room+' [data-task-submit]'});
      check('with the mailbox fields open the send button is reachable by scrolling at '+width+'×'+height,reach.ok,reach);
    }
    w.win.setContentSize(1440,900);
    await eventually(width=>innerWidth===width,1440);
    await wait(120);
    check('the visible mailbox setup has no password field or direct external link',await query(sel=>{
      const form=document.querySelector(sel)?.closest('form');
      return !!form&&!form.querySelector('input[type=password],a[href],img[src^="http"],iframe,object');
    },mode));
    check('a private GPT form offers automatic, ordinary work, mail search and the existing quote handoff',await query(s=>{
      const field=document.querySelector(s);
      return field.tagName==='SELECT'&&field.value==='auto'&&[...field.options].map(o=>o.value).sort().join(',')==='auto,general,mail,quote';
    },mode));
    const gmail=room+' [data-office-mail-connect="gmail"]',outlook=room+' [data-office-mail-connect="outlook"]',unlink=room+' [data-office-mail-disconnect="outlook"]';
    check('unconfigured Gmail gives a setup message and cannot start a connection',await query(sel=>document.querySelector(sel).innerText.includes('설정'),room)&&!await press(gmail));
    await writePrompt(original);
    const connected=await press(outlook);
    check('cancelling the official connection keeps the work in progress',connected&&await eventually(sel=>document.querySelector(sel)?.innerText.includes('취소'),room)&&await query(sel=>document.querySelector(sel).value,prompt)===original);
    await mutate(b=>{b.mailTestCodes={outlook:'MAIL_TIMEOUT'};});
    await press(outlook);
    check('a timed-out login can be restarted beside the mailbox while its work draft stays intact',await eventually(sel=>{
      const text=document.querySelector(sel)?.innerText||'';
      return text.includes('시간')&&text.includes('다시')&&!text.includes('MAIL_TIMEOUT');
    },room)&&await query(sel=>document.querySelector(sel).value,prompt)===original);
    await shots('timeout',outlook);
    await mutate(b=>{b.mailTestCodes={};});
    await press(outlook);
    check('the selected mailbox connects and shows its own address',await eventually(({sel,address})=>document.querySelector(sel)?.innerText.includes(address),{sel:room,address:other}));
    await press(unlink);
    check('the office can remove its local mailbox connection',await eventually(()=>!window.__orbFixture.office().tasking.mail.providers.find(p=>p.id==='outlook').connected));
    await mutate(b=>{b.tasking.mail.providers=available;});
    await revealConnections();await eventually(({sel,a})=>document.querySelector(sel)?.innerText.includes(a),{sel:room,a:address});
    check('the saved Outlook address explains when its connection needs to be renewed',await query(({sel,address})=>{
      const control=document.querySelector(sel),block=control?.parentElement?.parentElement;
      return !!block&&block.innerText.includes(address)&&/다시 연결 필요|재연결 필요|다시 연결해야/.test(block.innerText);
    },{sel:outlook,address:other}));
    await shots('connections',mode);
    await choose('claude');
    check('mail account settings and search selection leave the Claude form',!(await query(visible,mode)));
    await choose('codex');
    await press(room+' [data-task-submit]');
    await eventually(()=>window.__orbFixture.office().tasking.tasks.length===1);
    const ordinary=(await sent())[0];
    check('regular submitting preserves the natural-language request for the backend classifier',ordinary?.prompt===original&&ordinary?.provider==='codex'&&!Object.hasOwn(ordinary,'mailSearch'));
    if(!ordinary)throw Error('No ordinary request was recorded.');
    const row=room+' [data-task-id="'+ordinary.id+'"]';
    await mutate(b=>Object.assign(b.tasking.tasks[0],{status:'running',reason:null,mailDecision:'pending'}));
    check('pending automatic classification changes the caption while the work is still running and cancellable',await eventually(sel=>{
      const r=document.querySelector(sel),status=r?.querySelector('[data-task-status]');
      return status?.dataset.taskStatus==='running'&&status.innerText==='업무 범위 확인 중'&&!!r.querySelector('[data-task-act="task-cancel"]')?.getClientRects().length;
    },row));
    await shots('decision-pending',row);
    await mutate(b=>Object.assign(b.tasking.tasks[0],{status:'completed',reason:null,mailDecision:'ordinary',answer:'인증 코드를 처리하는 함수의 오류를 확인했습니다.'}));
    check('an ordinary answer distinguishes its source and offers a fresh mailbox search',await eventually(sel=>{
      const r=document.querySelector(sel);
      return r?.innerText.includes('사서함을 조회하지 않았습니다.')&&r.innerText.includes('함수의 오류')&&!!r.querySelector('[data-task-act="task-mail-find"]')?.getClientRects().length;
    },row));
    await shots('decision-ordinary',row);
    await mutate(b=>{delete b.tasking.tasks[0].mailDecision;});
    const mixedReceipt={scope,groups:[group,failed]};
    await mutate(b=>Object.assign(b.tasking.tasks[0],{status:'completed',answer:summary(mixedReceipt),reason:null,mailSearch:true,mailResult:mixedReceipt}));
    const mailLink=row+' [data-office-mail-open="'+primaryId+'"]';
    const listed=await eventually(({sel,scope,subject})=>{const r=document.querySelector(sel);return r?.innerText.includes(scope)&&r.innerText.includes(subject)&&r.innerText.includes('다시 연결');},{sel:row,scope,subject});
    check('source groups keep the scope, original text, and a distinct partial failure',listed&&await query(sel=>!document.querySelector(sel).querySelector('a[href],img'),row));
    check('a limited list distinguishes the displayed count from all matching mail',await query(sel=>/표시[^\n]*1건|1건[^\n]*표시/.test(document.querySelector(sel)?.innerText||''),row));
    check('the mailbox result shows the sender, preview, and limited coverage',await query(sel=>{
      const text=document.querySelector(sel)?.innerText||'';
      return text.includes('team@example.test')&&text.includes('다음 달 공연의 촬영 견적')&&/더 |추가|일부/.test(text);
    },row));
    await shots('mixed',row);
    await press(mailLink);
    check('source opens only by the retained task and item identifier',await eventually(s=>window.__orbFixture.calls().includes(s),'office-mail-open:'+ordinary.id+':'+primaryId));
    await mutate(b=>{b.mailTestCodes={open:'MAIL_NOT_FOUND'};});
    await press(mailLink);
    const sourceNotice=row+' section[aria-label="메일 검색 결과"] [role="status"]';
    check('a missing original produces a local notice and preserves its saved result',await eventually(({sel,subject})=>{
      const note=document.querySelector(sel);
      return /찾|없/.test(note?.innerText||'')&&!/MAIL_|권한/.test(note.innerText)&&note.closest('[data-task-id]').innerText.includes(subject);
    },{sel:sourceNotice,subject}));
    await shots('missing-source',sourceNotice);
    await mutate(b=>{b.mailTestCodes={};});
    await press(mailLink);
    await press(row+' [data-task-act="task-follow"]');
    check('following saved mail leaves the new prompt on automatic without starting another task',await eventually(s=>document.querySelector(s)?.value==='auto',mode)&&(await sent()).length===1);
    await shots('follow-auto',mode);
    const followPrompt='그중 아직 답장하지 않은 메일만 찾아줘.';
    await writePrompt(followPrompt);
    await press(room+' [data-task-submit]');
    await eventually(()=>window.__orbFixture.office().tasking.tasks.length>=2);
    const following=(await sent()).at(-1);
    check('automatic mail follow-up passes only the member prompt and previous task identifier',following?.previousId===ordinary.id&&following?.prompt===followPrompt&&!Object.hasOwn(following,'mailSearch')&&!Object.hasOwn(following,'mailResult'));
    await mutate(b=>{b.tasking.tasks=b.tasking.tasks.slice(0,1);});
    const repeat=row+' [data-task-act="task-mail-repeat"]';
    await press(repeat);
    await eventually(()=>window.__orbFixture.office().tasking.tasks.length>=2);
    const repeated=(await sent()).at(-1);
    check('partial search can retry failed mailboxes with its original conditions',repeated?.mailSearch===true&&repeated?.mailRetry===true&&repeated?.previousId===ordinary.id&&repeated?.id!==ordinary.id);
    await mutate(b=>{b.tasking.tasks=b.tasking.tasks.slice(0,1);Object.assign(b.tasking.tasks[0],{status:'failed',reason:'MAIL_CONNECT',answer:'',mailResult:null});});
    await eventually(sel=>document.querySelector(sel+' [data-task-status]')?.dataset.taskStatus==='failed',row);
    await shots('connect-error',row);
    await press(row+' [data-task-act="task-retry"]');
    check('member can retry a mail failure with the original request and explicit search',await eventually(({p,m,t})=>document.querySelector(p)?.value===t&&document.querySelector(m)?.value==='mail',{p:prompt,m:mode,t:original}));
    await query(sel=>{const input=document.querySelector(sel);input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));},prompt);
    await mutate(b=>Object.assign(b.tasking.tasks[0],{status:'completed',reason:null,answer:'연결된 메일함에서 조건에 맞는 메일을 찾지 못했습니다.',mailResult:{scope,groups:[{provider:'gmail',address,items:[],more:false}]}}));
    await eventually(({sel,a})=>document.querySelector(sel)?.innerText.includes(a),{sel:row,a:address});
    check('a zero-result mailbox has its own scope and no stale source button',await query(({sel,scope})=>{const r=document.querySelector(sel);return r.innerText.includes(scope)&&!r.querySelector('[data-office-mail-open]')?.getClientRects().length;},{sel:row,scope}));
    await shots('empty',row);
    const limitedEmpty={scope,groups:[{provider:'gmail',address,items:[],more:false},failed]};
    await mutate(b=>Object.assign(b.tasking.tasks[0],{answer:summary(limitedEmpty),mailResult:limitedEmpty}));
    check('an incomplete search with no displayed mail distinguishes the unsearched mailbox',await eventually(sel=>{
      const r=document.querySelector(sel);
      return r?.querySelector('[data-task-act="task-mail-repeat"]')?.getClientRects().length&&/확인|일부|표시/.test(r.querySelector('[data-task-answer]')?.innerText||'')&&!r.querySelector('[data-office-mail-open]');
    },row));
    await shots('partial-empty',row);
    await mutate(b=>{
      const t=b.tasking.tasks[0];
      delete t.mailSearch;
      Object.assign(t,{status:'failed',reason:'MAIL_CHOOSE',answer:'',mailResult:null,mailDecision:'choose',mailDecisionReason:'LOGIN'});
    });
    const find=row+' [data-task-act="task-mail-find"]', general=row+' [data-task-act="task-mail-general"]';
    check('an ambiguous card offers the choice between a mailbox and ordinary GPT work',await eventually(visible,find)&&await eventually(visible,general));
    check('a choice keeps its internal failure state with a selection caption and a GPT login reason',await eventually(sel=>{
      const r=document.querySelector(sel),status=r?.querySelector('[data-task-status]');
      return status?.dataset.taskStatus==='failed'&&status.innerText==='선택 필요'&&r.innerText.includes('로그인')&&r.innerText.includes('GPT');
    },row));
    await shots('choose',row);
    const originalChoice=await query(id=>window.__orbFixture.office().tasking.tasks.find(task=>task.id===id),ordinary.id);
    for(const automatic of [true,false]){
      await mutate(b=>{
        const task=b.tasking.tasks.find(t=>t.id===ordinary.id);
        Object.assign(task,{prompt:'안 읽은 견적 메일 찾아줘.',reason:automatic?'MAIL_CHOOSE':'MAIL_PLAN',mailSearch:automatic?undefined:true,mailDecision:automatic?'choose':undefined,mailDecisionReason:automatic?'MAIL_PLAN':undefined});
      });
      const supported=await eventually(sel=>{
        const note=document.querySelector(sel)?.querySelector('.off-task-note:not([hidden])')?.innerText||'';
        return /보낸 사람|발신자/.test(note)&&note.includes('기간')&&note.includes('검색어')&&note.includes('첨부')&&/안 읽|읽음|읽지 않/.test(note)&&note.includes('별표')&&/이름|파일명/.test(note)&&note.includes('내용')&&/빼|제외|고쳐|수정/.test(note)&&!note.includes('MAIL_PLAN');
      },row);
      check((automatic?'an automatic choice':'an explicit mail failure')+' explains supported and unsupported mail filters and how to change the request',supported);
      await shots(automatic?'plan-choose':'plan-failed',row);
    }
    await mutate(b=>{b.tasking.tasks[b.tasking.tasks.findIndex(t=>t.id===ordinary.id)]=originalChoice;});
    for(const [code,words] of [['LIMIT','한도'],['NO_CLI','도구|설치|실행'],['MAIL_PLAN','범위|조건|판단'],['MAIL_SCOPE','범위|지원'],['MAIL_CHANGED','변경'],['MAIL_STORAGE','저장소']]){
      await mutate(b=>{b.tasking.tasks[0].mailDecisionReason=code;});
      check('the range choice explains '+code+' without an internal code',await eventually(({sel,code,words})=>{
        const r=document.querySelector(sel),notice=r?.querySelector('.off-task-note:not([hidden])')?.innerText||'';
        return new RegExp(words).test(notice)&&!notice.includes(code);
      },{sel:row,code,words}));
    }
    await mutate(b=>{b.tasking.tasks[0].mailDecisionReason='UNRECOGNIZED_REASON';});
    check('a range choice without a recognized cause keeps both buttons and hides the internal identifier',await query(({sel,a,b})=>{
      const r=document.querySelector(sel);
      return r&&!r.innerText.includes('UNRECOGNIZED_REASON')&&!!document.querySelector(a)?.getClientRects().length&&!!document.querySelector(b)?.getClientRects().length;
    },{sel:row,a:find,b:general}));
    await press(general);
    const generalRequest=(await sent()).at(-1);
    check('the general choice reassigns only the original prompt to GPT',generalRequest?.mailSearch===false&&generalRequest?.prompt===original&&!Object.hasOwn(generalRequest,'mailResult')&&!generalRequest.previousId);
    await press(find);
    const clarification=(await sent()).at(-1);
    check('an ambiguous request can be explicitly rerun as a new mail search',clarification?.mailSearch===true&&!clarification?.previousId&&clarification?.prompt===original&&clarification?.id!==ordinary.id);
    await query(s=>{const node=document.querySelector(s);node.value='general';node.dispatchEvent(new Event('change',{bubbles:true}));},mode);
    const developmentPrompt='이메일 인증 코드에서 버그 찾아줘.';
    await writePrompt(developmentPrompt);
    await press(room+' [data-task-submit]');
    const developmentRequest=(await sent()).at(-1);
    check('the composer can explicitly choose ordinary work even for a prompt that mentions mail',developmentRequest?.mailSearch===false&&developmentRequest?.prompt===developmentPrompt);
    await mutate(b=>{
      b.tasking.tasks=b.tasking.tasks.slice(0,1);
      Object.assign(b.tasking.tasks[0],{status:'completed',reason:null,answer:'검색 결과 1건',mailSearch:true,mailResult:{scope,groups:[group]}});
      delete b.tasking.mail;
    });
    check('removing mailbox access clears the prior address and result text',await eventually(({sel,a,subject})=>{const r=document.querySelector(sel);return r&&!r.innerText.includes(a)&&!r.innerText.includes(subject);},{sel:room,a:address,subject}));
    const department='합성 견적부';
    await mutate(b=>{b.tasking.mail={providers:available};b.departments=[{id:'qa-sales',name:department,folder:'C:\\qa\\sales'}];});
    await choose('codex');
    await revealConnections();
    const privateDraft='가상 메일함에서 다음에 찾을 견적 메모';
    await writePrompt(privateDraft);
    await click(w,'#portal-entry [data-orb-prog="subs"]');
    await eventually(s=>!document.querySelector(s)?.getClientRects().length,prompt);
    await click(w,'#portal-entry [data-orb-prog="office"]');
    check('the same member can revisit the office with the original draft and result',await eventually(({p,r,d,s})=>document.querySelector(p)?.value===d&&document.querySelector(r)?.innerText.includes(s),{p:prompt,r:room,d:privateDraft,s:subject}));
    const hadMail=await eventually(({r,m,p,a,subject,draft})=>{
      const page=document.querySelector(r);
      return !!document.querySelector(m)?.getClientRects().length&&page?.innerText.includes(subject)&&page.innerText.includes(a)&&document.querySelector(p)?.value===draft;
    },{r:room,m:mode,p:prompt,a:address,subject,draft:privateDraft});
    await query(state=>window.__orbFixture.setAuth(state),{...signedOut,sessionGeneration:signedIn('none').sessionGeneration+1});
    const loginScreen=await until(w,s=>s.phase==='auth'&&s.ui==='ask',{timeout:12000});
    const hiddenAfterSignout=await eventually(({sel,mode,prompt,subject,address,draft})=>{
      const office=document.querySelector(sel),copy=office?.textContent||'';
      const control=document.querySelector(mode);
      const inactive=!control?.getClientRects().length||!!control.closest('[inert],[hidden],[aria-hidden="true"]');
      return inactive&&!copy.includes(subject)&&!copy.includes(address)&&document.querySelector(prompt)?.value!==draft;
    },{sel:room,mode,prompt,subject,address,draft:privateDraft});
    const signedOutView=await query(({room,mode,prompt,subject,address,draft})=>{
      const office=document.querySelector(room),portal=document.querySelector('#portal-entry');
      const control=document.querySelector(mode);
      return {portal:portal?.dataset.portalState,mailModeHasLayout:!!control?.getClientRects().length,mailModeInert:!!control?.closest('[inert],[hidden],[aria-hidden="true"]'),resultTextRetained:!!office?.textContent.includes(subject),addressRetained:!!office?.textContent.includes(address),draftRetained:document.querySelector(prompt)?.value===draft};
    },{room,mode,prompt,subject,address,draft:privateDraft});
    check('signing out erases the previous mail result from the page, including hidden markup',hadMail&&loginScreen.ok&&hiddenAfterSignout,{hadMail,...signedOutView});
    check('signing out also removes the previous department and its floor',await query(({room,d})=>{
      const r=document.querySelector(room);return !r.querySelector('[data-off-rows]')?.children.length&&!r.textContent.includes(d)&&!r.querySelector('[data-off-slot]')?.dataset.zones;
    },{room,d:department}));
    const askLayer='#portal-entry [data-layer="ask"]';
    await shots('logged-out','#portal-entry [data-orb-act="signin"]',askLayer);
    const ownerBoard=await query(()=>window.__orbFixture.office());
    const checkText=({room,prompt,subject,address,draft,department})=>{
      const r=document.querySelector(room),slot=r?.querySelector('[data-off-slot]');
      return {mode:document.documentElement.dataset.orbClient,auth:document.querySelector('#portal-entry')?.dataset.portalAuthStatus,mail:r?.textContent.includes(subject),address:r?.textContent.includes(address),draft:document.querySelector(prompt)?.value===draft,department:r?.textContent.includes(department),rows:r?.querySelector('[data-off-rows]')?.children.length,zones:slot?.dataset.zones||''};
    };
    const privateFields={room,prompt,subject,address,draft:privateDraft,department};
    for(const [index,stage] of ['unconfigured','member-switch'].entries()){
      const owner=signedIn('none',4+index*2);
      await query(({board,auth})=>{window.__orbFixture.configure({office:board});window.__orbFixture.restore(auth);},{board:ownerBoard,auth:owner});
      const returned=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
      await click(w,'#portal-entry [data-orb-prog="office"]');await choose('codex');
      const restored=await eventually(({r,p,d,s})=>document.querySelector(r)?.innerText.includes(d)&&document.querySelector(r)?.innerText.includes(s)&&document.querySelector(p)?.value==='',{r:room,p:prompt,d:department,s:subject});
      check('the same member restores their stored result with a fresh draft before '+stage,returned.ok&&restored);
      await writePrompt(privateDraft);
      const before=await query(checkText,privateFields);
      const next=stage==='unconfigured'?{...signedOut,configured:false,status:'unconfigured',sessionGeneration:owner.sessionGeneration+1}:{...signedIn('none',7),accountGeneration:'10000000-0000-4000-8000-000000000091',account:{synk_user_id:'20000000-0000-4000-8000-000000000091',display_name:'합성 다음 회원'}};
      await query(({next,fields,stage})=>{
        const read=()=>{
          const root=document.querySelector('#portal-entry'),r=document.querySelector(fields.room);
          const mode=document.documentElement.dataset.orbClient,auth=root?.dataset.portalAuthStatus;
          if(mode!=='portal'||auth!==(stage==='member-switch'?'signed-in':'unconfigured'))return;
          const text=r?.textContent||'';
          window.__officeBoundarySample={mode,auth,mail:text.includes(fields.subject),address:text.includes(fields.address),draft:document.querySelector(fields.prompt)?.value===fields.draft,department:text.includes(fields.department),rows:r?.querySelector('[data-off-rows]')?.children.length,zones:r?.querySelector('[data-off-slot]')?.dataset.zones||''};
          observer.disconnect();
        };
        const observer=new MutationObserver(read);window.__officeBoundarySample=null;
        observer.observe(document.querySelector('#portal-entry'),{attributes:true,childList:true,subtree:true});
        if(stage==='member-switch')window.__orbFixture.holdAuth();
        window.__orbFixture.configure({office:{available:false,departments:[],sessions:[]}});
        window.__orbFixture.setAuth(next);
        queueMicrotask(read);
      },{next,fields:privateFields,stage});
      await eventually(()=>!!window.__officeBoundarySample);
      const after=await query(()=>window.__officeBoundarySample);
      check(stage+' clears the previous task, draft, department rows and floor before another member can enter',before.mail&&before.address&&before.draft&&before.department&&!!after&&!after.mail&&!after.address&&!after.draft&&!after.department&&!after.rows&&!after.zones,{before,after});
      if(stage==='unconfigured'){
        const ready=await until(w,s=>s.phase==='auth'&&s.ui==='ask',{timeout:12000});
        check('the unconfigured portal displays its explanation before both captures',ready.ok&&await eventually(visible,'#portal-entry [data-ask-unconf]'));
        await shots(stage,'#portal-entry [data-ask-unconf]',askLayer);
      }else{
        await shots(stage,'#portal-entry','#portal-entry [data-portal-stage]');
      }
    }
  }finally{w.win.destroy();}
};

