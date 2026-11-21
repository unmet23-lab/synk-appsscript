'use strict';

// Runs inside orb-face-browser-qa.cjs with the native Solio page and its isolated synthetic bridge.
module.exports = async function checkOfficeTasks({ open, boot, signedIn, signedOut, subsNone, until, wait, click, capture, check, calls }) {
  const w = await open();
  const room = '#portal-entry [data-room="solio-office"]';
  const prompt = room + ' [data-task-prompt]';
  const submit = room + ' [data-task-submit]';
  const action = room + ' [data-room-act="task-open"]';
  const nativeRequests = [];
  w.ses.webRequest.onErrorOccurred(d => nativeRequests.push({ url: d.url, error: d.error }));
  w.ses.webRequest.onCompleted(d => { if (d.statusCode >= 400) nativeRequests.push({ url: d.url, status: d.statusCode }); });
  const query = (fn, arg) => w.js('(' + String(fn) + ')(' + JSON.stringify(arg ?? null) + ')');
  async function eventually(fn, arg) {
    const end = Date.now() + 7500;
    while (Date.now() < end) {
      if (await query(fn, arg)) return true;
      await wait(70);
    }
    return false;
  }
  const emit = board => query(b => window.__orbFixture.setOffice(b), board);
  const board = () => query(() => window.__orbFixture.office());
  async function mutate(fn) {
    const current = await board();
    fn(current);
    await emit(current);
  }
  const history = () => query(() => window.__orbFixture.office()?.tasking?.tasks || []);
  const sent = async () => (await calls(w)).filter(c => c.startsWith('office-task-submit:'));
  const input = async value => {
    await query(sel => document.querySelector(sel)?.focus(), prompt);
    await query(sel => document.querySelector(sel)?.select(), prompt);
    await w.win.webContents.insertText(value);
  };
  const press = (selector, label) => query(({ selector, label }) => {
    const group = document.querySelector(selector);
    const b = [...(group?.querySelectorAll('button') || [])].find(n => !n.disabled && n.getClientRects().length && n.textContent.trim().includes(label));
    if (b) { b.focus(); b.click(); }
    return !!b;
  }, { selector, label });
  async function captures(name, selector) {
    for (const [width, height] of [[1440,900], [390,844]]) {
      w.win.setContentSize(width, height);
      await eventually(width => innerWidth === width, width);
      if (name === 'new') await query(sel => { document.querySelector(sel).scrollTop = 0; }, room);
      else await query(sel => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), selector);
      await wait(130);
      await capture(w, 'office-task-' + name + '-' + width);
      const safe = await query(sel => {
        const n = document.querySelector(sel);
        const bad = [...document.querySelectorAll('img')].filter(i => i.getClientRects().length && i.complete && !i.naturalWidth);
        return n && n.scrollWidth <= n.clientWidth + 1 && bad.length === 0;
      }, room);
      check(name + ' fits the office horizontally at ' + width + ' with all visible images loaded', safe);
    }
    w.win.setContentSize(1440,900);
    await wait(150);
  }
  try {
    await boot(w, { subs: subsNone, office: { available: true, departments: [], tasks: [], tasking: { tasks: [] } } },
      { restore: signedIn('none'), fold: true });
    const app = await until(w, s => s.mode === 'app' && s.ui === 'app', { timeout: 12000 });
    check('office assignment uses the signed-in Solio launcher', app.ok);
    await eventually(sel => !!document.querySelector(sel) && !document.querySelector(sel).hidden, '#portal-entry [data-orb-prog="office"]');
    await click(w, '#portal-entry [data-orb-prog="office"]');
    const ready = await eventually(sel => !!document.querySelector(sel)?.getClientRects().length, prompt);
    check('a member with no department can type a native multiline assignment', ready);
    if (!ready) throw Error('No native assignment composer in the visible office.');
    await captures('new', prompt);
    const providers = await query(sel => {
      const box = document.querySelector(sel);
      return [...box.querySelectorAll('[data-task-provider]')].flatMap(node => node.options ? Array.from(node.options, o => o.value) : node.value ? [node.value] : [...node.querySelectorAll('input')].map(i => i.value));
    }, room);
    check('only Claude and GPT are offered', providers.includes('claude') && providers.includes('codex') && !providers.includes('gemini'), { providers });
    const selected = await query(sel => {
      const box = document.querySelector(sel);
      const select = box.querySelector('select[data-task-provider]');
      if (select) { select.value = 'codex'; select.dispatchEvent(new Event('change', { bubbles: true })); return true; }
      const radio = box.querySelector('[data-task-provider][value="codex"],[data-task-provider] input[value="codex"]');
      if (radio) radio.click();
      return !!radio;
    }, room);
    check('the member can select GPT from the office', selected);
    const original = '행사 소개를 두 줄로 적어 줘.\n제목은 <b>제목</b>이라고 써 줘.';
    await input(original);
    w.win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
    w.win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
    const tabStays = await eventually(sel => {
      const form = document.querySelector(sel)?.form;
      return !!form && form.contains(document.activeElement) && document.activeElement !== document.querySelector(sel);
    }, prompt);
    check('keyboard Tab advances from the textarea within the native form', tabStays);
    await query(sel => { const b = document.querySelector(sel); b.click(); b.click(); }, submit);
    await eventually(() => window.__orbFixture.office()?.tasking?.tasks?.length > 0);
    const initial = (await history())[0];
    const submissions = await sent();
    check('a double press submits just the chosen worker and keeps literal multiline input', submissions.length === 1 &&
      initial?.provider === 'codex' && initial.departmentId === null && initial.prompt === original &&
      !initial.previousId && /^[0-9a-f-]{36}$/i.test(initial.id));
    if (!initial) throw Error('The synthetic office did not receive the task.');
    const card = room + ' [data-task-id="' + initial.id + '"]';
    await mutate(b => Object.assign(b.tasking.tasks[0], { status: 'running', updatedAt: Date.now() }));
    const running = await eventually(sel => document.querySelector(sel + ' [data-task-status]')?.getAttribute('data-task-status') === 'running', card);
    const noTerminal = await query(sel => !document.querySelector(sel + ' [data-task-act="task-terminal"]')?.getClientRects().length, card);
    check('a running task has its own progress and cannot open an unattached terminal', running && noTerminal);
    await captures('running', card);
    const continuation = require('../src/office-task-codex.cjs').nativePrompt(initial.id);
    await mutate(b => Object.assign(b.tasking.tasks[0], {status: 'terminal', reason: 'PERMISSION', canOpenTerminal: true, continuationPrompt: continuation}));
    const manual = await eventually(({card, value}) => document.querySelector(card + ' [data-task-continuation]')?.textContent === value, {card, value: continuation});
    const statusStep = await query(sel => {
      const text = document.querySelector(sel)?.innerText || '';
      return text.includes('/status') && text.includes('Enter') && /이전 (대화|내용)|앞선 대화/.test(text) && text.includes('계정');
    }, card);
    await captures('manual', card);
    await query(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {
      writeText: async value => { window.__officeQaContinuation = value; },
    }}) && true);
    const copiedManual = await press(card, '이어가기 문구 복사');
    const literalManual = await eventually(value => window.__officeQaContinuation === value, continuation);
    await query(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {
      writeText: async () => { throw Error('Clipboard unavailable in this isolated test'); },
    }}) && true);
    await press(card, '이어가기 문구 복사');
    const selectableManual = await eventually(value => window.getSelection()?.toString() === value, continuation);
    await query(() => { window.getSelection()?.removeAllRanges(); delete navigator.clipboard; });
    check('a Codex approval card shows account verification, optional copy and selectable continuation without launching any action',
      manual && statusStep && copiedManual && literalManual && selectableManual && !(await calls(w)).some(c => c.startsWith('office-task-action:')) && (await sent()).length === 1);
    const externalText = '옛 터미널에서 읽은 문장 <b>공개하지 않을 원문</b>';
    await mutate(b => Object.assign(b.tasking.tasks[0], {
      status: 'interrupted', reason: 'UNCONFIRMED', viaTerminal: true, answer: externalText, canOpenTerminal: false,
    }));
    check('a legacy Codex terminal answer never appears in the card or offers a copy or follow-up', await eventually(({ card, externalText }) => {
      const row = document.querySelector(card);
      return row?.querySelector('[data-task-status]')?.dataset.taskStatus==='interrupted' &&
        !row.textContent.includes(externalText) && !row.querySelector('[data-task-answer]')?.textContent &&
        !row.querySelector('[data-task-act="task-follow"]')?.getClientRects().length &&
        !row.querySelector('[data-task-act="copy-answer"]')?.getClientRects().length;
    }, { card, externalText }));
    const otherId='95d28583-7c10-4254-9819-ae4b8d06848e';
    const otherCard=room+' [data-task-id="'+otherId+'"]';
    const manualInput=' [data-task-manual-answer]';
    const saveControl=' [data-task-act="task-save-answer"]';
    await mutate(b => {
      Object.assign(b.tasking.tasks[0], {status:'terminal',reason:'MANUAL_RESULT',viaTerminal:true,answer:externalText,
        canOpenTerminal:true,continuationPrompt:continuation});
      b.tasking.tasks.push({...b.tasking.tasks[0],id:otherId,status:'interrupted',prompt:'두 번째 업무',answer:'',canOpenTerminal:false,continuationPrompt:null});
    });
    const manualReady=await eventually(({card,otherCard,manualInput,saveControl})=>{
      const row=document.querySelector(card), input=row?.querySelector(manualInput);
      return input?.value==='' && !!document.querySelector(otherCard+manualInput) && row.querySelector(saveControl)?.disabled &&
        !!row.querySelector('[data-task-act="task-terminal"]')?.getClientRects().length &&
        !!row.querySelector('[data-task-act="copy-continuation"]')?.getClientRects().length;
    },{card,otherCard,manualInput,saveControl});
    check('only the eligible GPT cards offer an initially empty manual input and retain official terminal controls',manualReady);
    const transferred=' 행사 소개를 두 줄로 정리했습니다.\n<b>회원이 직접 옮긴 원문</b>  ';
    if(manualReady) {
      const setManual=(selector,value)=>query(({selector,value})=>{
        const n=document.querySelector(selector); n.focus(); n.value=value; n.dispatchEvent(new Event('input',{bubbles:true}));
      },{selector:selector+manualInput,value});
      await captures('transferempty',card);
      await setManual(card,' \n ');
      const blank=await query(sel=>document.querySelector(sel)?.disabled,card+saveControl);
      await query(({card,manualInput})=>{
        const n=document.querySelector(card+manualInput);n.value='가'.repeat(524289);n.dispatchEvent(new Event('input',{bubbles:true}));
      },{card,manualInput});
      const oversized=await query(({card,manualInput,saveControl})=>{
        const n=document.querySelector(card+manualInput);
        return n.value.length===524289 && (n.maxLength<0 || n.maxLength>524288) && document.querySelector(card+saveControl).disabled;
      },{card,manualInput,saveControl});
      check('a blank or oversized paste cannot submit a shortened answer',blank && oversized);
      await setManual(otherCard,'별도 업무의 개인 메모');
      await setManual(card,transferred);
      await query(sel=>{window.__manualNode=document.querySelector(sel);},card+manualInput);
      await mutate(b=>{b.tasking.tasks[0].status='interrupted';b.tasking.tasks[0].canOpenTerminal=false;});
      const intact=await eventually(({card,otherCard,manualInput,transferred})=>{
        const n=document.querySelector(card+manualInput);
        return n===window.__manualNode && n===document.activeElement && n.value===transferred &&
          document.querySelector(otherCard+manualInput)?.value==='별도 업무의 개인 메모' &&
          !document.querySelector(card+' [data-task-act="task-terminal"]')?.getClientRects().length;
      },{card,otherCard,manualInput,transferred});
      check('a poll and terminal closure preserve the focused manual input and keep the other task draft separate',intact);
      await captures('transferpaste',card);
      await mutate(b=>{b.manualAnswerCode='WRITE';});
      await press(card,'답 보관');
      check('a failed save leaves the member-entered text available for an explicit retry',await eventually(({card,manualInput,transferred})=>
        document.querySelector(card+manualInput)?.value===transferred && window.__orbFixture.calls().some(v=>v.endsWith(':saveAnswer')),
        {card,manualInput,transferred}));
      await mutate(b=>{delete b.manualAnswerCode;});
      await press(card,'답 보관');
      const saved=await eventually(({card,otherCard,manualInput,transferred})=>{
        const row=document.querySelector(card),answer=row?.querySelector('[data-task-answer]');
        return row?.innerText.includes('터미널에서 직접 옮긴 답') && answer?.textContent===transferred && !answer.children.length &&
          !row.querySelector(manualInput) && document.querySelector(otherCard+manualInput)?.value==='별도 업무의 개인 메모' &&
          !row.querySelector('[data-task-act="task-follow"]')?.getClientRects().length &&
          !row.querySelector('[data-task-act="task-retry"]')?.getClientRects().length &&
          !!row.querySelector('[data-task-act="copy-answer"]')?.getClientRects().length;
      },{card,otherCard,manualInput,transferred});
      await query(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__manualSavedCopy=text;}}})&&true);
      const copied=await press(card,'답 복사');
      const exactCopy=await eventually(value=>window.__manualSavedCopy===value,transferred);
      await query(()=>{delete navigator.clipboard;});
      check('the member-saved verbatim result has its own attribution and copy only, without another model submission',saved && copied && exactCopy && (await sent()).length===1);
      await captures('transfersaved',card);
      const savedBoard=await board();
      await emit({available:true,departments:[],sessions:[]});
      await eventually(sel=>!document.querySelector(sel),otherCard+manualInput);
      await emit(savedBoard);
      check('after a capability boundary the stored answer returns and another task draft is cleared',await eventually(({card,otherCard,manualInput,transferred})=>
        document.querySelector(card+' [data-task-answer]')?.textContent===transferred && document.querySelector(otherCard+manualInput)?.value==='',
        {card,otherCard,manualInput,transferred}));
    }
    await mutate(b=>{b.tasking.tasks=b.tasking.tasks.filter(t=>t.id!==otherId);});
    await mutate(b => Object.assign(b.tasking.tasks[0], { status: 'failed', reason: 'AUTH_CHANGED', answer: '' }));
    check('an observed Codex account change removes the provisional text and copy action from the card', await eventually(sel => {
      const row = document.querySelector(sel);
      const answer = row?.querySelector('[data-task-answer]');
      return answer?.hidden && !answer.textContent && !row.querySelector('[data-task-act="copy-answer"]')?.getClientRects().length;
    }, card));
    const draft = '다음 업무 내용';
    await input(draft);
    await query(sel => { window.__officeQaComposing = document.querySelector(sel); }, prompt);
    w.win.webContents.debugger.attach('1.3');
    await w.win.webContents.debugger.sendCommand('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
    const answer = '두 사람이 기록한 동네의 하루\n주민이 직접 찍은 사진으로 골목의 봄을 만날 수 있습니다.\n원문 표기 <b>제목</b> & 협업';
    await mutate(b => Object.assign(b.tasking.tasks[0], { status: 'completed', reason: null, canOpenTerminal: false, answer, viaTerminal: false, updatedAt: Date.now() }));
    const answered = await eventually(({ card, answer }) => document.querySelector(card + ' [data-task-answer]')?.textContent === answer, { card, answer });
    const typed = await query(({ prompt, card }) => {
      const e = document.querySelector(prompt), a = document.querySelector(card + ' [data-task-answer]');
      return { same: e === window.__officeQaComposing, focused: e === document.activeElement, value: e.value,
        plain: a?.children.length === 0, whiteSpace: a ? getComputedStyle(a).whiteSpace : '' };
    }, { prompt, card });
    await w.win.webContents.debugger.sendCommand('Input.insertText', {text: '한'});
    w.win.webContents.debugger.detach();
    check('a final answer appears while Korean composition and the unsent draft retain focus', answered && typed.same && typed.focused && typed.value === draft + '한', typed);
    check('the original response is literal text with retained line breaks', typed.plain && ['pre-wrap','break-spaces','pre-line'].includes(typed.whiteSpace), typed);
    check('a confirmed ordinary GPT answer is labelled as the final answer', await query(sel => document.querySelector(sel)?.innerText.includes('최종 답'), card));
    check('finished work removes its continuation instructions and copy action', await query(sel => {
      const c = document.querySelector(sel);
      return !c?.querySelector('[data-task-continuation]')?.textContent && !c?.innerText.includes('이어가기 문구 복사');
    }, card));
    await captures('answer', card);
    await mutate(b => Object.assign(b.tasking.tasks[0], { viaTerminal: true }));
    check('a previously completed external GPT terminal record also suppresses the old body and follow-up', await eventually(sel => {
      const row=document.querySelector(sel);
      return row && !row.querySelector('[data-task-answer]')?.textContent && !row.querySelector('[data-task-act="task-follow"]')?.getClientRects().length;
    },card));
    await mutate(b => Object.assign(b.tasking.tasks[0], { viaTerminal: false }));
    const longText = '긴한국어'.repeat(80);
    await mutate(b => Object.assign(b.tasking.tasks[0], { answer: longText }));
    check('a long unbroken answer remains within its card', await eventually(({ card, longText }) => {
      const text = document.querySelector(card + ' [data-task-answer]');
      return text?.textContent === longText && text.scrollWidth <= text.clientWidth + 1;
    }, { card, longText }));
    await mutate(b => Object.assign(b.tasking.tasks[0], { answer }));
    const followed = await press(card, '이어');
    await eventually(sel => document.activeElement === document.querySelector(sel), prompt);
    await input('같은 대화에서 제목을 줄여 줘.');
    await click(w, submit);
    await eventually(() => window.__orbFixture.office()?.tasking?.tasks?.length === 2);
    const next = (await history()).find(t => t.id !== initial.id);
    check('continue binds the same provider and previous task to a new request', followed && next?.previousId === initial.id && next.provider === 'codex');
    await mutate(b => {
      b.departments = [{ id: 'design', name: '디자인부', folder: 'C:\\qa\\design' }];
      b.sessions = [{ id: 'staff-claude-1', cwd: 'C:\\qa\\design', tool: 'claude', kind: 'work' }];
    });
    const deptRow = room + ' button.row[data-key="d:design"]';
    await eventually(sel => !!document.querySelector(sel), deptRow);
    await click(w, deptRow);
    const fromWorker = await eventually(() => Array.from(document.querySelectorAll('[data-room-act="task-open"]')).some(n => n.dataset.roomArg === 'claude'));
    check('the existing office picture and department list precede a long task history', await query(sel => {
      const box = document.querySelector(sel), floor = box.querySelector('[data-off-floor]'), tasks = box.querySelector('[data-task-id]');
      return !!(floor.compareDocumentPosition(tasks) & Node.DOCUMENT_POSITION_FOLLOWING);
    }, room));
    await click(w, action + '[data-room-arg="claude"]');
    const workerSelected = await eventually(sel => {
      const box = document.querySelector(sel);
      return box?.querySelector('[data-task-provider]')?.value === 'claude' &&
        box.querySelector('[data-task-department]')?.value === 'design' &&
        document.activeElement === box.querySelector('textarea');
    }, room);
    check('the keyboard-accessible employee row preselects its provider and department', fromWorker && workerSelected);
    await query(sel => {
      const select = document.querySelector(sel + ' [data-task-provider]');
      select.value = 'codex';
      select.dispatchEvent(new Event('change', {bubbles: true}));
      document.querySelector(sel + ' [data-off-floor]').scrollIntoView({ block: 'center' });
    }, room);
    const floorSelector = room + ' [data-off-floor]';
    await captures('staff', floorSelector);
    await query(sel => document.querySelector(sel).scrollIntoView({ block: 'center' }), floorSelector);
    const position = await query(sel => {
      const box = document.querySelector(sel);
      const canvas = box.querySelector('[data-off-floor]');
      const floor = canvas.getBoundingClientRect(), bounds = box.getBoundingClientRect();
      for (let y = Math.ceil(Math.max(0, floor.top, bounds.top)) + 2; y < Math.min(floor.bottom, bounds.bottom, innerHeight); y += 5) {
        for (let x = Math.ceil(Math.max(0, floor.left, bounds.left)) + 2; x < Math.min(floor.right, bounds.right, innerWidth); x += 5) {
          canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse' }));
          if (box.querySelector('.staff.hot')?.dataset.staff === 'staff-claude-1') return { x, y };
        }
      }
      return null;
    }, room);
    if (position) {
      const wc = w.win.webContents;
      wc.sendInputEvent({ type: 'mouseMove', ...position });
      wc.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...position });
      wc.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...position });
    }
    const fromFloor = await eventually(sel => {
      const box = document.querySelector(sel);
      return box.querySelector('[data-task-provider]').value === 'claude' &&
        box.querySelector('[data-task-department]').value === 'design' &&
        document.activeElement === box.querySelector('textarea');
    }, room);
    check('clicking the pictured employee with the native pointer focuses the corresponding fresh assignment', !!position && fromFloor, { position });
    if (fromFloor) await captures('selected', room + ' [data-task-provider]');
    if (!fromFloor) await click(w, action + '[data-room-arg="claude"]');
    await input('한 줄로 요약해 줘.');
    await click(w, submit);
    await eventually(() => window.__orbFixture.office()?.tasking?.tasks?.length === 3);
    const claude = (await history()).find(t => t.provider === 'claude');
    check('a visible department worker starts a fresh Claude request in that department', fromFloor && claude?.departmentId === 'design' && !claude.previousId);
    if (!claude) throw Error('No departmental Claude task was received.');
    const claudeCard = room + ' [data-task-id="' + claude.id + '"]';
    await mutate(b => Object.assign(b.tasking.tasks.find(t => t.id === claude.id), { status: 'terminal', canOpenTerminal: true, continuationPrompt: 'Claude에 적용할 수 없는 문구' }));
    const terminal = await eventually(sel => [...(document.querySelector(sel)?.querySelectorAll('button') || [])].some(b => b.getClientRects().length && b.textContent.includes('터미널')), claudeCard);
    await captures('terminal', claudeCard);
    check('Claude never inherits the Codex continuation text or copy control', await query(sel => !document.querySelector(sel).innerText.includes('이어가기 문구 복사'), claudeCard));
    if (terminal) await press(claudeCard, '터미널');
    const called = await eventually(value => window.__orbFixture.calls().includes(value), 'office-task-action:' + claude.id + ':terminal');
    check('the official terminal opens only for the selected eligible request', terminal && called);
    const liveDraft = '행사 소개를 먼저 정리했습니다.\n공식 창에서 작업을 이어가고 있습니다.';
    await mutate(b => Object.assign(b.tasking.tasks.find(t => t.id === claude.id), {
      status: 'terminal', reason: 'UNCONFIRMED', answer: liveDraft, canOpenTerminal: true,
    }));
    const liveVisible = await eventually(({ sel, liveDraft }) => {
      const row = document.querySelector(sel);
      const answer = row?.querySelector('[data-task-answer]');
      const visible = name => !!row?.querySelector('[data-task-act="' + name + '"]')?.getClientRects().length;
      return answer?.textContent === liveDraft && row.innerText.includes('완료 확인 전 답') &&
        row.querySelector('[data-task-status]')?.dataset.taskStatus === 'terminal' &&
        visible('task-terminal') && visible('task-cancel') && visible('copy-answer') && !visible('task-follow') && !visible('task-retry');
    }, { sel: claudeCard, liveDraft });
    await query(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async () => { throw Error('Clipboard unavailable in this isolated test'); },
    } }) && true);
    const copyLive = await press(claudeCard, '답 복사');
    const selectedLive = await eventually(value => window.getSelection()?.toString() === value, liveDraft);
    await query(() => { window.getSelection()?.removeAllRanges(); delete navigator.clipboard; });
    check('an active Claude terminal shows its provisional answer and preserves terminal, cancel and selectable copy', liveVisible && copyLive && selectedLive);
    await captures('claudeprovisional', claudeCard);
    const preview = '  이번 행사에서 확인한 내용입니다.\n<자료>를 살펴보고 있습니다.  ';
    for (const state of [
      {status:'running', reason:null, canOpenTerminal:false, message:'진행 중', capture:'claude-working-preview'},
      {status:'terminal', reason:'PERMISSION', canOpenTerminal:true, message:'권한 승인이 필요', capture:'claude-permission-preview'},
      {status:'terminal', reason:'LOGIN', canOpenTerminal:true, message:'공식 도구에서 로그인'},
    ]) {
      await mutate(b => Object.assign(b.tasking.tasks.find(t => t.id === claude.id), {
        status:state.status, reason:state.reason, canOpenTerminal:state.canOpenTerminal, answer:'', previewAnswer:preview,
      }));
      const visible = await eventually(({sel, state, preview}) => {
        const row = document.querySelector(sel);
        if (!row) return false;
        const action = name => !!row.querySelector('[data-task-act="' + name + '"]')?.getClientRects().length;
        const answer = row.querySelector('[data-task-answer]');
        return row.querySelector('[data-task-status]')?.dataset.taskStatus === state.status &&
          row.innerText.includes(state.message) && row.innerText.includes('완료 확인 전 답') &&
          answer?.textContent === preview && answer.children.length === 0 && action('copy-answer') &&
          action('task-cancel') && action('task-terminal') === state.canOpenTerminal && !action('task-follow') && !action('task-retry');
      }, {sel:claudeCard, state, preview});
      check('the live Claude answer preserves ' + (state.reason || state.status) + ' and shows the matching actions', visible);
      if (state.capture) await captures(state.capture, claudeCard);
    }
    const unfinished = '행사 소개 초안입니다.\n회원이 완료를 확인하기 전에 창을 닫았습니다.';
    await mutate(b => Object.assign(b.tasking.tasks.find(t => t.id === claude.id), {status: 'interrupted', reason: 'UNCONFIRMED', answer: unfinished, canOpenTerminal: false}));
    const held = await eventually(({sel, answer}) => {
      const c = document.querySelector(sel);
      return c?.querySelector('[data-task-answer]')?.textContent === answer &&
        c.innerText.includes('완료 확인 전 답') && c.querySelector('[data-task-status]')?.dataset.taskStatus === 'interrupted' &&
        !c.querySelector('[data-task-act="task-follow"]')?.getClientRects().length &&
        getComputedStyle(c.querySelector('[data-task-answer]')).userSelect !== 'none';
    }, {sel:claudeCard, answer:unfinished});
    check('Claude retains selectable original text before completion confirmation without offering a follow-up', held && (await sent()).length === 3);
    await captures('unconfirmed', claudeCard);
    await mutate(b => Object.assign(b.tasking.tasks.find(t => t.id === claude.id), {status: 'failed', reason: 'HOOKS_OFF', answer: '', canOpenTerminal: false}));
    check('Claude explains a connection blocked before the prompt was sent and keeps the explicit retry', await eventually(sel => {
      const row = document.querySelector(sel);
      return row?.innerText.includes('사무실 연결을 확인할 수 없어 요청을 보류했습니다.') &&
        !!row.querySelector('[data-task-act="task-retry"]')?.getClientRects().length &&
        !row.querySelector('[data-task-act="task-follow"]')?.getClientRects().length &&
        !row.querySelector('[data-task-act="copy-answer"]')?.getClientRects().length &&
        !row.innerText.includes('일부 변경이 이미');
    }, claudeCard) && (await sent()).length === 3);
    await mutate(b => Object.assign(b.tasking.tasks.find(t => t.id === claude.id), { status: 'failed', reason: 'LOGIN', answer: '', canOpenTerminal: false }));
    await eventually(sel => document.querySelector(sel)?.textContent.includes('로그인'), claudeCard);
    check('Claude login is shown as a failure without submitting to GPT or another account', (await sent()).length === 3 && (await history()).length === 3);
    await captures('login', claudeCard);
    const reedit = await press(claudeCard, '다시 맡기');
    const kept = await eventually(sel => document.querySelector(sel)?.value === '한 줄로 요약해 줘.', prompt);
    check('login can be completed later and retry only restores the original request for editing', reedit && kept && (await sent()).length === 3);
    const volatile = '파일을 쓰기 전에 도착한 답\n<b>복사할 원문</b>';
    await mutate(b => {
      b.tasking.code = 'WRITE';
      Object.assign(b.tasking.tasks.find(t => t.id === claude.id), { status: 'failed', reason: 'WRITE', answer: volatile });
    });
    const pendingSave = await eventually(({ sel, value }) => document.querySelector(sel + ' [data-task-answer]')?.textContent === value, { sel: claudeCard, value: volatile });
    const copyable = await query(sel => {
      const n = document.querySelector(sel + ' [data-task-answer]');
      if (!n) return false;
      const s = window.getSelection(), range = document.createRange();
      range.selectNodeContents(n); s.removeAllRanges(); s.addRange(range);
      const matches = s.toString() === n.textContent && getComputedStyle(n).userSelect !== 'none';
      s.removeAllRanges(); return matches;
    }, claudeCard);
    await query(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async value => { window.__officeQaClipboard = value; },
      } });
    });
    const copyPressed = await press(claudeCard, '답 복사');
    const copied = await eventually(value => window.__officeQaClipboard === value, volatile);
    await query(() => { delete navigator.clipboard; });
    check('copy on explicit click receives the full unsaved text', copyPressed && copied);
    await captures('unsaved', claudeCard);
    const readsBefore = (await calls(w)).filter(call => call === 'office-snapshot').length;
    const saveOnly = await press(room, '저장 다시 시도');
    const reread = await eventually(min => window.__orbFixture.calls().filter(call => call === 'office-snapshot').length > min, readsBefore);
    check('an unsaved answer can be read and selected; retrying storage never launches the worker again', pendingSave && copyable && saveOnly && reread && (await sent()).length === 3);
    await mutate(b => { b.tasking.code = 'STORAGE'; });
    const unavailable = await eventually(sel => document.querySelector(sel)?.disabled === true, submit);
    check('storage failures block submission and leave the task history visible', unavailable && await query(sel => !!document.querySelector(sel)?.getClientRects().length, card));
    await emit({ available: true, departments: [], sessions: [] });
    const hidden = await eventually(sel => !document.querySelector(sel)?.getClientRects().length, prompt);
    check('an ordinary viewer sees the monitoring room without assignment controls or another member’s answer',
      hidden && await query(sel => !document.querySelector(sel + ' [data-task-id]'), room));
    await query(s => window.__orbFixture.setAuth(s), signedOut);
    check('no native assets failed during the office task flow', nativeRequests.length === 0, { nativeRequests });
  } finally {
    w.win.destroy();
  }
};
