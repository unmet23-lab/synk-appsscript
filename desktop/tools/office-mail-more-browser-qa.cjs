'use strict';

const { summary } = require('../src/office-mail.cjs');

const taskId = 'add00000-0000-4000-8000-000000000001';
const quoteTaskId = 'add00000-0000-4000-8000-000000000002';
const oldOutlookId = 'add00000-0000-4000-8000-000000000003';
const changedAccountId = 'add00000-0000-4000-8000-000000000004';
const initialEmptyId = 'add00000-0000-4000-8000-000000000005';
const addresses = {gmail: 'studio@example.test', outlook: 'print@example.test'};

function items(provider, start, count) {
  return Array.from({length: count}, (_, index) => {
    const number = start + index;
    return {
      id: (provider === 'gmail' ? 'face' : 'beef') + '0000-0000-4000-8000-' + String(number).padStart(12, '0'),
      subject: (provider === 'gmail' ? '촬영' : '인쇄') + ' 견적 문의 ' + number,
      from: '새봄 기획 <quote@example.test>', date: '2026-11-15',
      snippet: '다음 달에 진행하는 작업의 견적과 가능한 일정을 부탁드립니다.',
    };
  });
}

function makeBoard() {
  const providers = Object.entries(addresses).map(([id, address]) => ({id, address, configured: true, connected: true}));
  const groups = providers.map(({id, address}) => ({provider: id, address, page: 0, more: true, items: items(id, 1, 10)}));
  const task = {
    id: taskId, provider: 'codex', status: 'completed', createdAt: 100, updatedAt: 101,
    departmentId: null, canOpenTerminal: false, prompt: '지난주 견적 메일 찾아줘.', mailSearch: true,
    answer: summary({groups}), mailResult: {scope: '받은 메일 · 지난주 · 견적', groups},
  };
  const quote = {...task, id: quoteTaskId, quoteHandoff: true, quoteCanResume: true, createdAt: 98, updatedAt: 99,
    mailResult: {scope: '미회신 견적 문의', groups: [{provider: 'gmail', address: addresses.gmail, items: [], more: true}]}};
  const oldGroups = [{provider: 'outlook', address: addresses.outlook, items: items('outlook', 51, 10), more: true, page: 0}];
  const old = {...task, id: oldOutlookId, createdAt: 75, updatedAt: 77, prompt: '지난달 인쇄 견적 문의를 찾아줘.',
    answer: summary({groups: oldGroups}), mailResult: {scope: '지난달 · 인쇄 견적', groups: oldGroups}};
  const accountGroups = [{...groups[0], items: items('gmail', 101, 10)}];
  const beforeAccountChange = {...task, id: changedAccountId, createdAt: 65, updatedAt: 67, prompt: '지난달 촬영 견적 메일을 찾아줘.',
    mailResult: {scope: '지난달 · 촬영 견적', groups: accountGroups}, answer: summary({groups:accountGroups})};
  const initialGroups = [{provider:'gmail', address:addresses.gmail, items:[], more:true, page:0}];
  const initialEmpty = {...task, id:initialEmptyId, createdAt:60, updatedAt:62, prompt:'이번 달 영상 견적 문의를 찾아줘.',
    mailResult:{scope:'이번 달 · 영상 견적',groups:initialGroups},answer:summary({groups:initialGroups})};
  const mailTestPageSummaries = {};
  for (const count of [20,23,30,33,38]) {
    mailTestPageSummaries[count] = summary({groups: [{items: Array.from({length: count}), more: count !== 38}]});
  }
  return {
    available: true, departments: [], sessions: [], tasking: {tasks: [task,quote,old,beforeAccountChange,initialEmpty], mail: {providers}},
    mailTestCodes: {'more-outlook': 'MAIL_NETWORK'}, mailTestPageSummaries,
    mailTestPageErrors: {[oldOutlookId]: {outlook: 'MAIL_PAGE_RESTART'}},
    mailTestPages: {[taskId]: {gmail: [items('gmail', 11, 10), [], items('gmail', 21, 5)], outlook: [items('outlook', 11, 3)]},
      [oldOutlookId]: {outlook: [[]]}, [changedAccountId]: {gmail: [items('gmail',11,10)]}, [initialEmptyId]: {gmail: [items('gmail',201,2)]}},
  };
}

module.exports = async function checkOfficeMailMore({open, boot, signedIn, subsNone, until, wait, click, key, capture, check, calls}) {
  const view = await open();
  const room = '#portal-entry [data-room="solio-office"]';
  const card = room + ' [data-task-id="' + taskId + '"]';
  const group = provider => card + ' [data-office-mail-group="' + provider + '"]';
  const more = provider => group(provider) + ' [data-office-mail-more="' + provider + '"]';
  const source = (provider, index) => group(provider) + ' [data-office-mail-open="' + items(provider, index, 1)[0].id + '"]';
  const query = (fn,arg) => view.js('(' + String(fn) + ')(' + JSON.stringify(arg ?? null) + ')');
  const visible = sel => !!document.querySelector(sel)?.getClientRects().length;
  const countRows = ({sel, count}) => document.querySelector(sel)?.querySelectorAll('[data-office-mail-open]').length === count;
  const records = async () => (await calls(view)).filter(x => x.startsWith('office-mail-more:')).map(x => JSON.parse(x.slice(17)));
  async function eventually(fn,arg) {
    const end = Date.now() + 6500;
    do {
      if (await query(fn,arg)) return true;
      await wait(60);
    } while (Date.now() < end);
    return false;
  }
  async function snap(name, selector) {
    for (const [width,height] of [[1440,900],[390,844]]) {
      view.win.setContentSize(width,height);
      await eventually(size => innerWidth === size, width);
      await query(sel => document.querySelector(sel)?.scrollIntoView({block: 'center'}), selector);
      await wait(120);
      await capture(view, 'mail-more-' + name + '-' + width);
      const fit = await query(sel => {
        const target = document.querySelector(sel), card = target?.closest('[data-task-id]');
        const rect = target?.getBoundingClientRect();
        return rect?.bottom > 0 && rect.top < innerHeight && card?.clientWidth > 0 && card.scrollWidth <= card.clientWidth + 1
          && ![...card.querySelectorAll('img')].some(img => img.getClientRects().length && img.complete && !img.naturalWidth);
      },selector);
      check('mail paging ' + name + ' fits the viewport at ' + width, fit);
    }
    view.win.setContentSize(1440,900);
  }
  async function setFixtureValue(fn,arg) {
    await view.js('(arg=>{const board=window.__orbFixture.office();(' + String(fn) + ')(board,arg);window.__orbFixture.setOffice(board);})(' + JSON.stringify(arg ?? null) + ')');
    await wait(130);
  }
  const press = sel => query(s => {const button=document.querySelector(s);button?.click();},sel);
  try {
    await boot(view, {subs: subsNone, office: makeBoard()}, {restore: signedIn('none'), fold: true});
    await until(view, state => state.mode === 'app' && state.ui === 'app', {timeout: 12000});
    await click(view, '#portal-entry [data-orb-prog="office"]');
    const ready = await eventually(visible,more('gmail')) && await eventually(visible,more('outlook'));
    check('both saved page-zero groups have independently named controls on the old ordinary card', ready && await query(sel =>
      [...document.querySelector(sel).querySelectorAll('[data-office-mail-more]')].every(button =>
        button.type === 'button' && /더보기|더 보기/.test(button.textContent) && /gmail|outlook/i.test(button.getAttribute('aria-label') || '')),card));
    if (!ready) return;
    check('only a numbered ordinary group offers mail paging', !await query(visible,room+' [data-task-id="'+quoteTaskId+'"] [data-office-mail-more]'));
    check('no mailbox page is fetched when the saved card is displayed', (await records()).length === 0);
    await snap('saved',more('gmail'));
    const initialCard=room+' [data-task-id="'+initialEmptyId+'"]';
    const initialGroup=initialCard+' [data-office-mail-group="gmail"]';
    check('a first page with no matches and unchecked candidates offers paging and states that the search is still open',
      await query(visible,initialGroup+' [data-office-mail-more="gmail"]')
      && await query(countRows,{sel:initialGroup,count:0})
      && await query(sel=>{const text=document.querySelector(sel).innerText;return /확인|구간|후보|아직|계속/.test(text)
        && !/조건에 맞는 메일이 없습니다[.\s]|메일이 더 있습니다/.test(text);},initialCard));
    await snap('initial-empty',initialGroup+' [data-office-mail-more]');
    await query(() => window.__orbFixture.holdOfficeMailReply('more-gmail'));
    await query(sel => {const button=document.querySelector(sel);button.focus();button.click();button.click();},more('gmail'));
    const busy = await eventually(sel => {
      const button = document.querySelector(sel);
      return button && (button.disabled || button.getAttribute('aria-disabled') === 'true');
    }, more('gmail'));
    check('a repeated click fetches only the current Gmail group and leaves the Outlook control available',
      busy && (await records()).length === 1 && await query(sel => {
        const button=document.querySelector(sel); return !!button && !button.disabled && button.getAttribute('aria-disabled')!=='true';
      },more('outlook')));
    await snap('loading',more('gmail'));
    await press(more('outlook'));
    const failed = await eventually(sel => [...document.querySelector(sel).querySelectorAll('[role=status]')].some(el => /네트워크|연결/.test(el.innerText)),group('outlook'));
    check('an Outlook failure is reported beside the same original ten rows and Gmail stays unaffected',
      failed && await query(countRows,{sel:group('outlook'),count:10}) && !(await query(sel=>/네트워크/.test(document.querySelector(sel).innerText),group('gmail'))));
    await snap('retry',more('outlook'));
    await setFixtureValue(board=>{delete board.mailTestCodes['more-outlook'];});
    await press(more('outlook'));
    const outlookDone = await eventually(countRows,{sel:group('outlook'),count:13});
    check('retry appends the final three Outlook rows without a new page control or a new task',
      outlookDone && !await query(visible,more('outlook')) && await query(countRows,{sel:group('gmail'),count:10}));
    await query(({gmail,outlook})=>{
      const first=document.querySelector(gmail);
      const other=document.querySelector(outlook);
      window.__mailPageSaved={first,other};
      other.focus();
      const text=first.closest('li').querySelector('strong').firstChild;
      const range=document.createRange();range.selectNodeContents(text);
      const sel=document.getSelection();sel.removeAllRanges();sel.addRange(range);
    },{gmail:source('gmail',1),outlook:source('outlook',1)});
    await query(()=>window.__orbFixture.releaseOfficeMailReply());
    const gmailSecond = await eventually(countRows,{sel:group('gmail'),count:20});
    const unchanged = await query(({gmail,outlook}) => {
      const saved=window.__mailPageSaved;
      return saved.first===document.querySelector(gmail) && saved.other===document.querySelector(outlook)
        && document.activeElement===saved.other && !!document.getSelection()?.toString().includes('견적 문의 1');
    },{gmail:source('gmail',1),outlook:source('outlook',1)});
    check('Gmail adds ten rows below the original DOM while preserving the other group focus and selected text', gmailSecond && unchanged);
    await snap('twenty',more('gmail'));
    await press(more('gmail'));
    await eventually(()=>window.__orbFixture.office().tasking.tasks.find(t=>t.id==='add00000-0000-4000-8000-000000000001').mailResult.groups[0].page===2);
    check('an empty filtered page advances the revision and remains available without inserting rows',
      await query(countRows,{sel:group('gmail'),count:20}) && await query(visible,more('gmail'))
      && await eventually(sel=>/이번|새로|추가/.test([...document.querySelector(sel).querySelectorAll('[role=status]')].map(el=>el.innerText).join(' ')),group('gmail')));
    await snap('empty',more('gmail'));
    await wait(160);
    await query(sel=>document.querySelector(sel).focus(),more('gmail'));
    await key(view,'Return');
    const done=await eventually(countRows,{sel:group('gmail'),count:25});
    const keyboard=await query(sel=>{const el=document.activeElement;return !!el && !!el.closest(sel) && !!el.getClientRects().length;},group('gmail'));
    check('the final Gmail page adds five and leaves keyboard focus in that mailbox',done && keyboard && !await query(visible,more('gmail')));
    await snap('complete',source('gmail',25));
    await press(source('gmail',25));
    const lastItem=items('gmail',25,1)[0].id;
    check('an appended message can be opened using its stable task and item identifier',(await calls(view)).includes('office-mail-open:'+taskId+':'+lastItem));
    check('page requests preserve the two independent revisions and the original task',JSON.stringify(await records())===JSON.stringify([
      [taskId,'gmail',0],[taskId,'outlook',0],[taskId,'outlook',0],[taskId,'gmail',1],[taskId,'gmail',2],
    ]));
    const oldGroup = room + ' [data-task-id="' + oldOutlookId + '"] [data-office-mail-group="outlook"]';
    await press(oldGroup+' [data-office-mail-more="outlook"]');
    check('an unidentifiable old Outlook page retains its source rows and explains how to search again',
      await eventually(sel=>[...document.querySelector(sel).querySelectorAll('[role=status]')].some(el=>
        /이전 형식|이어서 불러올 위치/.test(el.innerText) && /기존 목록/.test(el.innerText) &&
        /업무 입력란/.test(el.innerText) && /새 메일 검색/.test(el.innerText)),oldGroup)
      && await query(countRows,{sel:oldGroup,count:10})
      && !await query(visible,oldGroup+' [data-office-mail-more]')
      && (await records()).at(-1)?.join('|')===[oldOutlookId,'outlook',0].join('|'));
    await snap('old',oldGroup+' li:last-child');
    const accountGroup = room + ' [data-task-id="' + changedAccountId + '"] [data-office-mail-group="gmail"]';
    await setFixtureValue(board=>{board.tasking.mail.providers[0].address='other@example.test';});
    await press(accountGroup+' [data-office-mail-more="gmail"]');
    check('a different connected address explains the changed connection while preserving every saved message',
      await query(countRows,{sel:accountGroup,count:10})
      && await eventually(sel=>[...document.querySelector(sel).querySelectorAll('[role=status]')].some(el=>
        /메일함이 바뀌/.test(el.innerText) && /기존 목록/.test(el.innerText) && /업무 입력란/.test(el.innerText)),accountGroup)
      && !await query(visible,accountGroup+' [data-office-mail-more]')
      && await query(id=>window.__orbFixture.office().tasking.tasks.find(t=>t.id===id).mailResult.groups[0].page===0,changedAccountId));
    await snap('account',accountGroup+' li:last-child');
  } finally {
    view.win.destroy();
  }
};
