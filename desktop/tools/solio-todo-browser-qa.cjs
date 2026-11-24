'use strict';
// 솔리오 「한 번에 처리」의 실제 Chromium 흐름(docs/디자인/솔리오_한번에처리_20261124/README.md 8절). orb-face-browser-qa.cjs가 합성 다리로 부른다(ORB_QA_ONLY=todo).
// 머리 줄의 단추 하나로 1순위부터 카드를 열고, 자판(Enter)만으로 그 자리에서 끝내며 다음 카드로 넘어가고, 건너뛰기 · 방으로 가기 · 「다음 일로」 · 다 끝났어요까지 간다.
// 자료는 모두 지어낸 것이다(공개 저장소). 넘침 · 콘솔 오류 · 막힌 요청은 부르는 쪽의 capture와 끝 집계가 본다.
module.exports = async function checkSolioTodo({ open, boot, signedIn, until, wait, click, key, capture, check, calls, visits = null, health = null }) {
  const now = Date.now(), H = 3600e3, iso = ms => new Date(now - ms).toISOString();
  const subs = { ok: true, seq: 1, checking: false, check: { at: now - 5 * 60e3 }, usage: { accounts: {} }, prices: null, rows: [
    { id: 'r-open', service: 'claude', source: 'auto', label: 'Claude', kind: 'weekly', state: 'ok', plan: 'max_20x', email: 'work@example.com', live: { readAt: now - 5 * 60e3, weekly: { usedPercent: 30, resetsAt: now + 3 * 24 * H } } },
    { id: 'r-relog', service: 'claude', source: 'auto', label: 'Claude', kind: 'weekly', state: 'needs-login', plan: 'pro', email: 'home@example.com', live: { readAt: now - 9 * H } },
  ] };
  const task = extra => ({ provider: 'codex', status: 'completed', reason: null, answer: '', canOpenTerminal: false, prompt: '일', departmentName: '견적부', createdAt: iso(3 * H), updatedAt: iso(H), ...extra });
  const office = {
    available: true, departments: [{ id: 'qd-quote', name: '견적부', folder: 'C:\\qa\\견적' }], assignments: {},
    sessions: [{ id: 'sess-qa-work-01', cwd: 'C:\\qa\\견적', kind: 'work', ago: 20e3 }],
    tasking: { tasks: [
      task({ id: 'qa-quote', quoteSource: { parentId: 'qa-mail', subject: '12월 행사 촬영 견적', from: '한가람 <gaeram@example.com>', date: iso(26 * H) }, quoteOutcome: 'draft', answer: '안녕하세요. 문의하신 촬영 견적을 보내 드립니다.' }),
      task({ id: 'qa-paused', status: 'paused', prompt: '주간 보고 쓰기', updatedAt: iso(2 * H) }),
      task({ id: 'qa-run', status: 'running', prompt: '랜딩 페이지 고치기' }),
    ] },
  };
  const backup = { ok: true, available: true, view: 'needs-setup', status: { state: 'unknown' }, install: { phase: 'idle' } };
  const w = await open();
  const q = sel => '#portal-entry ' + sel;
  const read = () => w.js(`(()=>{const $=s=>document.querySelector('#portal-entry '+s),vis=el=>!!el&&!el.closest('[hidden]')&&el.getClientRects().length>0;
    const card=$('[data-room="solio-todo"]'),a=document.activeElement;
    return {bar:vis($('[data-todo-bar]')),n:$('[data-todo-n]').textContent,go:vis($('[data-todo-go]'))?$('[data-todo-go]').textContent:null,
      card:vis(card),rank:$('[data-todo-rank]').textContent,why:$('[data-todo-why]').textContent,where:$('[data-todo-where]').textContent,
      say:$('[data-todo-say]').textContent,then:$('[data-todo-then]').textContent,acts:[...$('[data-todo-acts]').children].map(b=>(b.className==='todo-main'?'*':'')+b.textContent),
      note:$('[data-todo-note]').textContent,left:$('[data-todo-left]').textContent,foot:vis($('[data-todo-foot]')),
      focus:a&&card.contains(a)?a.textContent:a?.matches?.('[data-todo-go]')?'bar':a?.tagName||null,
      rooms:[...document.querySelectorAll('#portal-entry .room')].filter(vis).map(r=>r.dataset.room),eyes:document.querySelector('#portal-entry .orb-stage').dataset.eyes||null};})()`);
  try {
    // 프로그램 다섯(구독 · 방문자 분석 · 계정 건강 · 원클릭 · 사무실)을 다 띄운다. 오브제 줄이 가장 길 때 머리 줄 단추와 겹치는지 보려고(Fable F2)
    await boot(w, { subs, office, backup, ...(visits ? { visits } : {}), ...(health ? { health } : {}) }, { restore: signedIn('none'), fold: true });
    await until(w, s => s.mode === 'app' && s.ui === 'app', { timeout: 12000 });
    // 복사는 숨은 시험 창에서 권한이 막혀 실패한다. 그 길은 컨트롤러 시험이 보고, 여기서는 쓰인 글만 받아 둔다
    await w.js("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__qaCopied=t;}}});true");
    let s = null;
    for (let i = 0; i < 60; i++) { s = await read(); if (s.bar && s.n === '할 일 4') break; await wait(100); }
    const progs = await w.js("[...document.querySelectorAll('#portal-entry [data-orb-prog]')].filter(o=>!o.hidden).map(o=>o.dataset.orbProg)");
    check('todo 1 the first screen has one button and the count of the whole line, not per room', s.bar && s.n === '할 일 4' && s.go === '1순위부터 처리' && !s.card && s.rooms.join() === 'solio' && progs.length === (visits && health ? 5 : 3), { ...s, progs });
    // 머리 줄의 단추가 창 단추(맨 위 40px의 오른쪽 144px)와 오브제 줄에 겹치지 않는지 크기마다 잰다
    for (const [W, Hh] of [[1440, 900], [960, 680], [768, 544], [640, 453]]) {
      w.win.setContentSize(W, Hh);
      for (let i = 0; i < 40 && (await w.js('innerWidth')) !== W; i++) await wait(50);
      await wait(200);
      const geo = await w.js(`(()=>{const r=el=>{const b=el?.getBoundingClientRect();return b&&b.width?{l:b.left,t:b.top,r:b.right,b:b.bottom}:null};
        const bar=r(document.querySelector('#portal-entry [data-todo-bar]')),rail=r(document.querySelector('#portal-entry [data-orb-rail]')),here=r(document.querySelector('#portal-entry .here-name')),
          chrome={l:innerWidth-144,t:0,r:innerWidth,b:40},hit=(a,b)=>!!a&&!!b&&a.l<b.r&&b.l<a.r&&a.t<b.b&&b.t<a.b;
        return {bar,hitChrome:hit(bar,chrome),hitRail:hit(bar,rail),hitName:hit(bar,here),inside:!!bar&&bar.l>=0&&bar.r<=innerWidth&&bar.b<=innerHeight};})()`);
      // 다가가면 이름이 펼쳐진다. 펼친 줄과도 겹치지 않아야 한다(Fable F2: 다섯 오브제를 펼치면 960 · 768에서 단추에 닿았다)
      await w.js("document.querySelector('#portal-entry [data-orb-rail]').classList.add('near');true");
      await wait(1000);
      const near = await w.js(`(()=>{const r=el=>{const b=el?.getBoundingClientRect();return b&&b.width?{l:b.left,t:b.top,r:b.right,b:b.bottom}:null};
        const bar=r(document.querySelector('#portal-entry [data-todo-bar]')),rail=r(document.querySelector('#portal-entry [data-orb-rail]'));
        return {rail,low:document.querySelector('#portal-entry [data-todo-bar]').classList.contains('low'),hit:!!bar&&!!rail&&bar.l<rail.r&&rail.l<bar.r&&bar.t<rail.b&&rail.t<bar.b};})()`);
      await w.js("document.querySelector('#portal-entry [data-orb-rail]').classList.remove('near');true");
      await wait(500);
      check('todo 2 the button clears the window buttons, the program rail (folded and opened) and the name at ' + W, geo.inside && !geo.hitChrome && !geo.hitRail && !geo.hitName && !near.hit, { ...geo, near });
      await capture(w, 'todo-first-' + W);
    }
    w.win.setContentSize(1440, 900);
    await wait(300);

    // 3. 단추 한 번: 1순위 카드 한 장. 고객이 26시간 기다린 견적 초안이다. 초점은 그 일을 끝내는 단추에 있다
    await click(w, q('[data-todo-go]'));
    for (let i = 0; i < 30; i++) { s = await read(); if (s.card) break; await wait(60); }
    check('todo 3 one press opens the first item as one card, the rooms step back, and focus sits on the button that finishes it',
      s.card && s.rooms.join() === 'solio-todo' && s.rank === '1순위' && s.why === '고객이 기다립니다' && s.where === '견적부'
      && s.say === '한가람님의 견적 문의에 보낼 답장 초안이 있습니다.' && s.acts.join('|') === '*초안 복사|사무실에서 보기' && s.focus === '초안 복사' && s.left === '남은 일 3개 · AI 직원 둘이 일하고 있습니다.' && !s.bar, s);
    await capture(w, 'todo-card-1440');
    w.win.setContentSize(960, 680); await wait(380); await capture(w, 'todo-card-960');
    w.win.setContentSize(1440, 900); await wait(300);

    // 4. Enter: 복사하고, 같은 자리의 꽉 찬 단추가 「보냈어요」가 된다. Enter: 이 PC에 적고 다음 카드로
    await key(w, 'Return');
    for (let i = 0; i < 30; i++) { s = await read(); if (s.acts[0] === '*보냈어요') break; await wait(60); }
    const copied = await w.js('window.__qaCopied||null');
    check('todo 4 Enter copies the draft and the filled button becomes 보냈어요 with focus kept on it',
      copied === '안녕하세요. 문의하신 촬영 견적을 보내 드립니다.' && s.acts.join('|') === '*보냈어요|초안 복사|사무실에서 보기' && s.focus === '보냈어요' && s.note === '복사했습니다. 메일에서 보낸 뒤 「보냈어요」를 눌러 주세요.', { s, copied });
    await key(w, 'Return');
    for (let i = 0; i < 40; i++) { s = await read(); if (s.say.startsWith('「주간 보고')) break; await wait(60); }
    check('todo 5 finishing moves to the next card by itself, focus on its filled button',
      s.card && s.say === '「주간 보고 쓰기」 일이 멈춰 있습니다.' && s.acts.join('|') === '*다시 시작|사무실에서 보기' && s.focus === '다시 시작', s);
    // 6. Enter: 본체의 맡긴 일 동작(resume)을 부르고, 일이 돌기 시작하면 줄에서 빠져 다음 카드
    await key(w, 'Return');
    for (let i = 0; i < 60; i++) { s = await read(); if (s.say.startsWith('Claude home')) break; await wait(80); }
    const c6 = await calls(w);
    check('todo 6 다시 시작 runs the office task action in place and the line moves on once the task runs',
      c6.includes('office-task-action:qa-paused:resume') && s.say === 'Claude home 계정에 다시 로그인해야 합니다.' && s.acts.join('|') === '*계정 관리 열기' && s.left === '남은 일 1개 · AI 직원 셋이 일하고 있습니다.', { s, calls: c6.filter(c => c.startsWith('office-task')) });
    await capture(w, 'todo-card-relogin-1440');
    // 7. 건너뛰기: 원클릭 카드. Enter로 「보호 시작」을 누르면 엔진 창이 열리고 카드는 기다린다. 엔진 창에서 끝나면(자료를 지키는 중) 원클릭 방을 열지 않아도 다시 읽어 줄에서 빠진다(Fable F1)
    await click(w, q('[data-orb-act="todo-skip"]'));
    for (let i = 0; i < 30; i++) { s = await read(); if (s.where === '원클릭') break; await wait(60); }
    check('todo 7 건너뛰기 shows the next item; the backup card offers the engine start as its filled button', s.where === '원클릭' && s.acts[0] === '*보호 시작', s);
    await w.js("document.querySelector('#portal-entry .todo-main')?.focus();true");
    await key(w, 'Return');
    await wait(600);
    const s7 = await read(), c7a = await calls(w);
    check('todo 7b 보호 시작 opens the engine window and the card waits on it instead of counting it as finished', c7a.includes('backup-start:protect') && s7.card && s7.where === '원클릭', s7);
    await w.js(`window.__orbFixture.setBackup(${JSON.stringify({ ok: true, available: true, view: 'status', status: { state: 'safe', folders: 3, writtenAt: new Date().toISOString() } })})`);
    for (let i = 0; i < 60; i++) { s = await read(); if (s.say === '건너뛴 일 1개만 남았습니다.') break; await wait(100); }
    const c7 = await calls(w);
    check('todo 8 보호 시작 opens the engine from the card, and when nothing but the skipped item is left the card says so, not 다 끝냈습니다',
      c7.includes('backup-start:protect') && s.say === '건너뛴 일 1개만 남았습니다.' && s.then === 'AI 직원 셋이 일하고 있습니다.' && s.acts.join('|') === '*닫기|건너뛴 일 다시 보기' && !s.foot && s.focus === '닫기', s);
    await capture(w, 'todo-end-1440');
    w.win.setContentSize(960, 680); await wait(380); await capture(w, 'todo-end-960');
    w.win.setContentSize(1440, 900); await wait(300);
    // 9. 건너뛴 일을 다시 보고, 그 방(계정 관리)으로 간다. 머리 줄은 「다음 일로」가 되고, 한 번 누르면 같은 일로 돌아온다
    await w.js("[...document.querySelectorAll('#portal-entry [data-todo-acts] button')].find(b=>b.textContent==='건너뛴 일 다시 보기')?.click();true");
    for (let i = 0; i < 30; i++) { s = await read(); if (s.say.startsWith('Claude home')) break; await wait(60); }
    await w.js("document.querySelector('#portal-entry .todo-main')?.click();true");
    for (let i = 0; i < 40; i++) { s = await read(); if (s.rooms.includes('manage')) break; await wait(80); }
    check('todo 9 a card finished in another room opens that room and the bar becomes 다음 일', !s.card && s.rooms.includes('manage') && s.bar && s.go === '다음 일' && s.n === '할 일 1', s);
    await capture(w, 'todo-paused-1440');
    await click(w, q('[data-todo-go]'));
    for (let i = 0; i < 30; i++) { s = await read(); if (s.card) break; await wait(60); }
    check('todo 10 one press on 다음 일 sends the unfinished item to the back and opens the next; here only that one was left', s.card && s.say === '건너뛴 일 1개만 남았습니다.' && s.focus === '닫기', s);
    await key(w, 'Escape');
    for (let i = 0; i < 30; i++) { s = await read(); if (!s.card) break; await wait(60); }
    check('todo 11 Esc stops: the card folds, the room is back and focus returns to the bar', !s.card && s.rooms.join() === 'solio' && s.go === '1순위부터 처리' && s.focus === 'bar', s);
  } finally {
    w.win.destroy();
  }
};
