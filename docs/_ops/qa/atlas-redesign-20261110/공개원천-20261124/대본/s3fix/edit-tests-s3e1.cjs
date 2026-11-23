'use strict';
// 검수 s3e1 지적 고침(GB1~GB5 · GC1 · GC2)의 시험과, 고침에 따라 바뀐 시험 맞춤.  node edit-tests-s3e1.cjs <qa 폴더>
const fs = require('node:fs'), path = require('node:path');
const dir = process.argv[2];
const io = name => {
  const file = path.join(dir, name);
  let s = fs.readFileSync(file, 'utf8');
  const crlf = s.includes('\r\n'), eol = x => (crlf ? x.replace(/\r?\n/g, '\r\n') : x);
  const rep = (find, repl, count = 1) => {
    const f = eol(find);
    const n = s.split(f).length - 1;
    if (n !== count) throw Error(`${name}: ${n}번(${count}이어야) — ${find.slice(0, 80)}`);
    s = s.split(f).join(eol(repl));
  };
  return { rep, re: (pattern, repl) => { s = s.replace(pattern, repl); }, count: pattern => (s.match(pattern) || []).length, add: text => { s += eol(text); }, save: () => fs.writeFileSync(file, s) };
};

// ── 학습일 답 · 근거 상자 ──
const m = io('atlas-next-month-answer.test.mjs');
// 적기는 물을 때처럼 표지를 둔 물음의 표지로 한다(검수 s3e1 GC1 — 표지가 없는 물음의 답은 적지 않는다).
const before = m.count(/\.stamp\((?:'acct'|A_ID)\)/g);
m.re(/\.stamp\(('acct'|A_ID)\)/g, '.stamp($1, { ensure: true })');
if (before < 10) throw Error(`stamp 자리 ${before}`);
// GA1(검수 s3e2): 동의 바꾸기는 누른 때의 계정(owner)의 열쇠를 지운다.
m.rep(`  assert.match(consent, /\\.then\\(\\(\\)=>\\{clearMonthAnswer\\(localStorage,client\\.snapshot\\?\\.accountId\\);/, '동의를 바꾼 뒤 지운다');
  assert.match(
    consent,
    /\\.catch\\(error=>\\{control\\.checked=!enabled;clearMonthAnswer\\(localStorage,client\\.snapshot\\?\\.accountId\\);/,
    '바꾸기가 실패해도 지운다(서버는 바뀌었는데 뒤 확인만 실패한 갈래)',
  );`,
 `  assert.match(consent, /const enabled=control\\.checked,owner=client\\.snapshot\\?\\.accountId;/, '누른 때의 계정을 잡는다(검수 s3e2 GA1)');
  assert.match(consent, /\\.then\\(\\(\\)=>\\{clearMonthAnswer\\(localStorage,owner\\);/, '동의를 바꾼 뒤 지운다');
  assert.match(
    consent,
    /\\.catch\\(error=>\\{control\\.checked=!enabled;clearMonthAnswer\\(localStorage,owner\\);/,
    '바꾸기가 실패해도 지운다(서버는 바뀌었는데 뒤 확인만 실패한 갈래)',
  );`);
m.add(`
// 검수 s3e1 GC1 · GC2: 탭 둘(모듈 사본 둘) · 저장소 하나에서 지우는 길과 늦은 답을 본다(위 GH2 시험과 같은 틀).
async function twoTabs(name) {
  const tabA = await import(\`\${MONTH_URL}?tab=\${name}-a\`);
  const tabB = await import(\`\${MONTH_URL}?tab=\${name}-b\`);
  return { tabA, tabB };
}
function heldAsker(tab, { storage, revision, pos }) {
  const coach = { summary: () => ({ storage: { guest: false, unfoldedRows: 0, sync: { received: pos } } }), pull: () => Promise.resolve(true) };
  let release;
  const pending = new Promise(resolve => (release = resolve));
  let redraws = 0;
  const answers = tab.createMonthAnswers({ storage });
  const asker = tab.createMonthAsker({
    answers,
    account: () => 'acct',
    lineOf: () => ({ revision, ask: () => pending }),
    dayOf: () => 'd',
    offsetOf: () => 540,
    redraw: () => (redraws += 1),
    note() {},
    alive: () => true,
  });
  asker.month(coach);
  return { answers, release: () => release({ complete: true, summaryAt: pos, lookback: { windows: WINDOWS, month: [] } }), redraws: () => redraws };
}

test('연습 기록 비우기(before)가 늦게 끝나도 새 판에서 물은 답은 적고 다시 그린다 — 앞 판에서 물은 늦은 답만 버린다(검수 s3e1 GC2)', async () => {
  const { tabA, tabB } = await twoTabs('gc2');
  const values = new Map();
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const pos = at(5);
  const old = heldAsker(tabB, { storage, revision: 6, pos });
  const fresh = heldAsker(tabB, { storage, revision: 7, pos });
  assert.ok(values.has(\`\${tabB.CLEAR_KIND.prefix}acct\`), '물을 때 지우기 표지를 둔다');
  // 다른 탭이 판 7로 비운 뒤의 정리가 늦게 돈다.
  tabA.clearMonthAnswer(storage, 'acct', { before: 7 });
  assert.ok(values.has(\`\${tabB.CLEAR_KIND.prefix}acct\`), '비우기는 표지를 지우지 않는다(판 바닥만 올린다)');
  fresh.release();
  old.release();
  for (let i = 0; i < 5; i += 1) await tick();
  assert.ok(fresh.answers.read('acct', { revision: 7, day: 'd' }), '새 판(7)에서 물은 답은 적는다');
  assert.equal(fresh.redraws(), 1, '새 판의 답으로 한 번 다시 그린다');
  assert.equal(old.redraws(), 0, '앞 판(6)에서 물은 늦은 답으로는 다시 그리지 않는다');
  assert.equal(old.answers.read('acct', { revision: 6, day: 'd' }), null, '앞 판의 늦은 답은 적지 않는다');
  assert.equal(
    old.answers.write('acct', { revision: 6, day: 'd', askedFrom: pos, at: pos, windows: WINDOWS, month: [], since: old.answers.stamp('acct') }),
    false,
    '판 바닥 아래 판의 답은 적지 않는다',
  );
  // 지우는 길(로그아웃 · 동의 끔)은 표지를 지운다 — 판 바닥도 함께 없어진다.
  tabA.clearMonthAnswer(storage, 'acct');
  assert.equal(values.has(\`\${tabB.CLEAR_KIND.prefix}acct\`), false);
});

test('지우기 표지를 만들지 못한 물음(용량 초과)의 답은 저장소에 적지 않는다 — 다른 탭이 동의를 끄며 공간을 비운 뒤에도 그 앞에 물은 답이 다시 적히지 않는다(검수 s3e1 GC1)', async () => {
  const { tabA, tabB } = await twoTabs('gc1');
  const values = new Map([[\`\${tabB.FIRST_KIND.prefix}acct\`, '{"old":true}']]);
  let full = true;
  const storage = {
    getItem: k => values.get(k) ?? null,
    setItem: (k, v) => {
      if (full) throw new Error('QuotaExceededError');
      values.set(k, String(v));
    },
    removeItem: k => {
      values.delete(k);
      full = false; // 지우면 공간이 생긴다
    },
  };
  const asked = heldAsker(tabB, { storage, revision: 3, pos: at(5) });
  assert.equal(values.has(\`\${tabB.CLEAR_KIND.prefix}acct\`), false, '용량이 차 표지를 만들지 못했다');
  tabA.clearMonthAnswer(storage, 'acct'); // 다른 탭이 동의를 껐다 — 캐시를 지워 공간이 생겼다
  assert.equal(full, false);
  asked.release();
  for (let i = 0; i < 5; i += 1) await tick();
  assert.equal(values.has(\`\${tabB.MONTH_KIND.prefix}acct\`), false, '동의를 끈 뒤 그 앞에 물은 답을 저장소에 다시 적지 않는다');
});

test('늦은 답이 왔을 때 들일 코치가 이제 기기 기록이면(물은 사이 동의를 껐다) 들지도 적지도 다시 그리지도 않는다(검수 s3e1 GC1)', async () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const pos = at(5);
  let guest = false;
  const coach = { summary: () => ({ storage: { guest, unfoldedRows: 0, sync: { received: pos } } }), pull: () => Promise.resolve(true) };
  let release;
  const pending = new Promise(resolve => (release = resolve));
  let redraws = 0;
  const answers = createMonthAnswers({ storage });
  const asker = createMonthAsker({
    answers,
    account: () => 'acct',
    lineOf: () => ({ revision: 3, ask: () => pending }),
    dayOf: () => 'd',
    offsetOf: () => 540,
    redraw: () => (redraws += 1),
    note() {},
    alive: () => true,
  });
  asker.month(coach);
  guest = true;
  release({ complete: true, summaryAt: pos, lookback: { windows: WINDOWS, month: [] } });
  for (let i = 0; i < 5; i += 1) await tick();
  assert.equal(redraws, 0, '다시 그리지 않는다');
  assert.equal(values.has('synk:world:month-answer:acct'), false, '적지 않는다');
});
`);
m.save();

// ── 내 위치 셸 ──
const p = io('atlas-next-position-shell.test.mjs');
p.add(`
// 검수 s3e1 GB1: 진짜 홈은 판을 닫으면 정리(dispose)를 바로 부르고 판 모습은 흐려지는 동안(160ms) 문서에 남긴다(fade).
test('엔진 판의 짧은 진단 — 끝 화면이 답의 저장을 기다리는 사이 판을 닫으면, 판 조각이 흐려지며 남은 동안 저장이 끝나도 판을 기록 없이 닫고 끝 화면을 그리지 않는다(검수 s3e1 GB1)', async () => {
  let release = () => {};
  const hold = new Promise(resolve => (release = resolve));
  const watch = watchSets(made => ({
    answer(pid, result) {
      const out = made.answer(pid, result);
      return { ...out, evidence: hold.then(() => out.evidence) };
    },
  }));
  const app = shell({ wrap: watch.wrap, panels: true, fade: true });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    const coach = app.coaches[0];
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    assert.ok((await answerItems(app)) > 0);
    await tick(30);
    assert.deepEqual(watch.sets, [], '끝내기가 저장을 기다린다 — 판은 아직 닫지 않았다');
    app.closePanel();
    assert.equal(app.box().isConnected, true, '흐려지는 동안 판 조각은 문서에 남는다');
    release();
    await until(() => watch.sets.length > 0, '판을 닫는다');
    assert.deepEqual(
      watch.sets.map(set => set.record),
      [false],
      '판 기록 없이 닫기만 한다',
    );
    assert.doesNotMatch(app.box().html, /data-position-done/, '닫히는 판에 끝 화면을 그리지 않는다');
    await until(() => coach.summary().storage.unfolded === 0, '그 답이 손님 요약에 접힌다');
    app.endFade();
  } finally {
    release();
    app.dispose();
  }
});

// 검수 s3e1 GB2: 확인 중(홈 코치가 서기 전)에 받은 「짧은 진단 시작」 — 판 감시가 엔진 판으로 다시 그릴 때 한 번 시작한다. 그 사이 다른 학습을
// 열었으면(여기서는 내 위치를 다시 엶) 버린다.
test('확인 중에 받은 「짧은 진단 시작」은 엔진 판으로 다시 그릴 때 한 번 시작하고, 그 사이 다른 학습을 열었으면 버린다(검수 s3e1 GB2)', async () => {
  for (const other of [false, true]) {
    let release = () => {};
    const gate = new Promise(resolve => (release = resolve));
    const app = shell({
      open: async () => {
        await gate;
        return homeCoach();
      },
    });
    try {
      await app.education.position({ start: true });
      await until(() => /data-position-next="checking"/.test(app.last()), '확인 중 판');
      assert.equal(app.box(), null, '확인 중에는 진단을 시작하지 않는다');
      if (other) {
        await app.education.position();
        await until(() => /data-position-next="checking"/.test(app.last()), '다시 연 확인 중 판');
      }
      release();
      await until(() => /data-position-next="engine"/.test(app.last()) || Boolean(app.box()), '엔진 판으로 다시 그린다');
      if (other) {
        await tick(40);
        assert.equal(app.box(), null, '그 사이 다른 학습을 열었으면 남긴 시작을 버린다');
        assert.match(app.last(), /data-position-next="engine"/, '판은 그린다');
      } else await until(() => app.box()?.html.includes('data-position-run'), '엔진 판으로 다시 그리며 진단을 시작한다');
    } finally {
      release();
      app.dispose();
    }
  }
});

test('내 위치 판을 다시 그린 뒤 초점을 되돌리는 단추에 시험 형식(data-position-mock)도 든다(검수 s3e1 GB5)', () => {
  const source = fs.readFileSync(process.env.SYNK_LEARNING_UI_MODULE ?? new URL('../world-learning-ui.mjs', import.meta.url), 'utf8');
  assert.match(source, /const NEXT_FOCUS=\\[[^\\]]*'data-position-mock'[^\\]]*\\];/);
});
`);
p.save();

// ── 시험 형식 셸 ──
const k = io('atlas-next-mock-shell.test.mjs');
k.rep(`    homeCoach: () => coaches[0] ?? null,
    planTimes: area => planLog(true).times(area),`,
 `    homeCoach: () => coaches[0] ?? null,
    planTimes: area => planLog(true).times(area),
    // 판을 닫는다 — 진짜 홈처럼 판 자원을 바로 정리하고 판 조각은 흐려지는 동안(160ms) 문서에 남긴다(검수 s3e1 GB1).
    closeFading() {
      for (const resource of resources.splice(0).reverse())
        try {
          resource?.dispose?.();
        } catch {
          // 닫힌 판의 정리는 다음 정리를 막지 않는다
        }
      state.panel = '';
    },`);
k.add(`
test('엔진 문서 — 끝 한 장이 답의 저장을 기다리는 사이 판을 닫으면, 판 조각이 흐려지며 남은 동안 저장이 끝나도 판을 기록 없이 닫고 끝 한 장을 그리지 않는다(검수 s3e1 GB1)', async () => {
  let release = () => {};
  const hold = new Promise(resolve => (release = resolve));
  const sets = [];
  const app = shell({
    mockWrap: made => ({
      ...made,
      answer(pid, result) {
        const out = made.answer(pid, result);
        return { ...out, evidence: hold.then(() => out?.evidence) };
      },
      finishSet(options) {
        sets.push(options);
        return made.finishSet(options);
      },
    }),
  });
  try {
    await until(() => app.homeCoach(), '홈 코치');
    await app.education.mock();
    app.box().tap('[data-mock-start]');
    assert.equal(await runToEnd(app, { submitted: true }), true, '마지막 영역을 냈다');
    await tick(30);
    assert.deepEqual(sets, [], '끝내기가 저장을 기다린다 — 판은 아직 닫지 않았다');
    app.closeFading();
    assert.equal(app.box().isConnected, true, '흐려지는 동안 판 조각은 문서에 남는다');
    release();
    await until(() => sets.length > 0, '판을 닫는다');
    assert.deepEqual(
      sets.map(options => options.record),
      [false],
      '판 기록 없이 닫기만 한다',
    );
    assert.doesNotMatch(app.box().html, /data-mock-done/, '닫히는 판에 끝 한 장을 그리지 않는다');
  } finally {
    release();
    app.dispose();
  }
});
`);
k.save();

// ── 이번 주 계획 셸 ──
const n = io('atlas-next-plan-shell.test.mjs');
n.add(`
test('확인 중에 연 계획 열기는 기다린 사이 학생이 누른 다른 학습(같은 카드의 「짧은 진단 시작하기」)을 덮지 않는다 — 판이 아직 서지 않은 열기는 판 종류로 가릴 수 없다(검수 s3e1 GB4)', async () => {
  let release = null;
  const app = shell({ planner: () => new Promise(resolve => (release = () => resolve(PLANNER))) });
  try {
    const opening = app.education.plan();
    await tick(20);
    const starting = app.education.position({ start: true });
    release();
    assert.equal(await opening, 'skipped', '나중에 누른 학습을 덮지 않는다');
    await starting;
    assert.ok(!app.shown.some(html => /data-plan-board/.test(html)), '계획 판을 그리지 않는다');
    await until(() => app.box()?.html.includes('data-position-run'), '나중에 누른 진단이 시작된다');
  } finally {
    app.dispose();
  }
});
`);
n.save();

// ── 짧은 연습 셸 ──
const r = io('atlas-next-practice-shell.test.mjs');
r.rep(`function world(sessions,{retired=null,toasts=[],homeNext=null}={}){`,
 `function world(sessions,{retired=null,toasts=[],homeNext=null,practiceCoach=null}={}){`);
r.rep(` const atlasNext={practiceCoach:async()=>({}),createPracticeNextSession:`,
 ` const atlasNext={practiceCoach:practiceCoach??(async()=>({})),createPracticeNextSession:`);
r.add(`
test('새 길 연습 코치를 기다리는 사이 판을 닫거나 다른 판을 열면(판 자원의 dispose) 늦게 선 짧은 연습이 그 판을 덮지 않는다(검수 s3e1 GB3)',async()=>{
 const skillId=worldPosition.practice.pool.find(item=>/^ko\\.reading\\./.test(item.skillId)).skillId;
 let release;
 const held=new Promise(resolve=>(release=resolve));
 const w=world([{ending:{kind:'done'}}],{practiceCoach:()=>held});
 const opening=w.education.practice(null,{only:worldPosition.practice.pool.filter(item=>item.skillId===skillId).slice(0,2).map(item=>item.itemKey)});
 await new Promise(resolve=>setTimeout(resolve,20));
 w.close();
 release({});
 await opening;
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(w.opened.length,0,'늦게 선 연습 판을 열지 않는다');
 assert.equal(w.box(),null,'판을 그리지 않는다');
});
`);
r.save();
console.log('시험 고침 · 더함');
