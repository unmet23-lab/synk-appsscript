'use strict';
// tauri-driver 화면 시험(로드맵 11 「화면 시험은 tauri-driver 자동 시험으로」) — 실제 WorkBackup.exe 창의 웹 화면 안쪽을 WebDriver로 본다.
//   node test-support/ui-driver.cjs <디버그 WorkBackup.exe> <tauri-driver.exe> <msedgedriver.exe> <출력 폴더> [--자원 <resources 폴더>]
// - 앱은 --test-mode로 띄운다: 상태는 출력 폴더 안의 새 폴더(SOLO_BACKUP_TEST_STATE)라 %APPDATA%의 어떤 상태도 읽거나 쓰지 않고, 작업 스케줄러를 건드리지 않는다.
// - 본다: ① 브리지로 실제 엔진 상태가 들어와 첫 화면(설정 전이면 「첫 시작」)이 그려지는가 ② 화면의 모든 이름 × 예시 상태에서 화면 글 검사(T18)
//   ③ 쪽 오류가 없는가 ④ SUIT 글꼴이 실렸는가(Tauri CSP에 font-src가 있어야 한다) ⑤ 구가 WebGL로 그려지는가 ⑥ 단추를 눌러 화면이 바뀌는가.
// - msedgedriver는 이 PC WebView2와 같은 판이어야 한다(HKLM EdgeUpdate Clients {F3017226-…} pv).
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const APP = path.resolve(__dirname, '..');
const [exe, driver, edge, outArg] = process.argv.slice(2);
const flag = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
if (![exe, driver, edge, outArg].every((p) => p && path.isAbsolute(p))) {
  console.error('쓰기: node test-support/ui-driver.cjs <WorkBackup.exe> <tauri-driver.exe> <msedgedriver.exe> <출력 폴더> [--자원 <resources>] (모두 절대 경로)');
  process.exit(2);
}
const out = outArg;
const PORT = 4444 + Math.floor(Math.random() * 400);
const base = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wd(method, url, body) {
  const r = await fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`WebDriver ${method} ${url}: ${r.status} ${JSON.stringify(j).slice(0, 400)}`);
  return j.value;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const state = fs.mkdtempSync(path.join(out, 'state-'));
  const env = { ...process.env, SOLO_BACKUP_TEST_STATE: state };
  const resources = flag('--자원'); if (resources) env.SWB_RESOURCES = resources;
  const log = fs.openSync(path.join(out, 'tauri-driver.log'), 'w');
  const td = spawn(driver, ['--port', String(PORT), '--native-port', String(PORT + 1), '--native-driver', edge], { env, stdio: ['ignore', log, log], windowsHide: true });
  const report = { exe, startedAt: new Date().toISOString(), checks: [], screens: [] };
  const check = (name, ok, detail = '') => { report.checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };
  let session = null;
  try {
    for (let i = 0; i < 60; i++) { try { await fetch(`${base}/status`); break; } catch { await sleep(250); } }
    const s = await wd('POST', '/session', { capabilities: { alwaysMatch: { 'tauri:options': { application: exe, args: ['--test-mode'] } } } });
    session = s.sessionId;
    const run = (script, args = []) => wd('POST', `/session/${session}/execute/sync`, { script, args });
    const runAsync = (script, args = []) => wd('POST', `/session/${session}/execute/async`, { script, args });
    // ① 실제 엔진 상태로 첫 화면
    let live = null;
    for (let i = 0; i < 120 && !live; i++) { live = await run("const s=document.getElementById('stage');return window.__wb&&s&&s.dataset.screen?{screen:s.dataset.screen,tone:s.dataset.tone,title:(document.querySelector('#room .say')||{}).textContent||''}:null").catch(() => null); if (!live) await sleep(500); }
    check('실제 엔진 상태로 첫 화면이 그려진다', live && live.screen, live ? `${live.screen} · 「${live.title}」` : '120번 기다려도 화면 없음');
    const engine = await runAsync('const done=arguments[arguments.length-1];window.backup.getState().then(r=>done({ok:r.ok,configured:r.value&&r.value.configured,version:r.value&&r.value.version}),()=>done(null))');
    check('브리지 getState가 엔진에 닿는다', engine && engine.ok, JSON.stringify(engine));
    // 개통 상태(engine/src/account.cjs state()) — 화면이 읽는 칸이 오고, 열쇠 · 토큰 · 비밀번호 칸은 없다
    const acc = await runAsync('const done=arguments[arguments.length-1];window.backup.getState().then(r=>{const a=r.value&&r.value.account;done(a?{keys:Object.keys(a),available:a.available,connected:a.connected,text:JSON.stringify(a)}:null)},()=>done(null))');
    check('상태에 계정 칸이 온다(account)', acc && typeof acc.available === 'boolean' && typeof acc.connected === 'boolean', acc ? acc.keys.join(',') : '없음');
    // Google 로그인 그만두기(cancelGoogle — 기다리는 로그인이 없으면 아무것도 하지 않는다)가 다리와 계약을 지나 엔진에 닿는다
    const cancel = await runAsync('const done=arguments[arguments.length-1];Promise.resolve(window.backup.cancelGoogle&&window.backup.cancelGoogle()).then(r=>done(r?{ok:r.ok,code:r.code||null}:null),()=>done(null))');
    check('cancelGoogle이 엔진에 닿는다', cancel && cancel.ok === true, JSON.stringify(cancel));
    // Google 계정 페이지(openGoogleAccount)는 엔진이 주소를 정하고, 시험 모드의 호스트는 브라우저를 열지 않는다(조율 세션 616e9dce5).
    // 모르는 종류는 엔진이 BAD_INPUT으로 거절한다 — 브라우저가 뜨지 않는 두 답으로 다리 · 계약 · 엔진을 지나는지 본다
    const pageOf = (kind) => runAsync(`const done=arguments[arguments.length-1];Promise.resolve(window.backup.openGoogleAccount&&window.backup.openGoogleAccount(${JSON.stringify(kind)})).then(r=>done(r?{ok:r.ok,code:r.code||null}:null),()=>done(null))`);
    const pageOk = await pageOf('devices'), pageBad = await pageOf('elsewhere');
    check('openGoogleAccount가 엔진에 닿고 시험 모드에서 브라우저를 열지 않는다', pageOk && pageOk.ok === false && pageOk.code !== 'BAD_INPUT' && pageBad && pageBad.code === 'BAD_INPUT', JSON.stringify({ pageOk, pageBad }));
    // 되살릴 자리(place)가 엔진에 닿는다 — 모르는 자리는 되살리기를 시작하기 전에 BAD_INPUT으로 거절된다(조율 세션 25d66f324)
    const place = await runAsync('const done=arguments[arguments.length-1];Promise.resolve(window.backup.restoreLatest({place:"nowhere"})).then(r=>done(r?{ok:r.ok,code:r.code||null}:null),()=>done(null))');
    check('restoreLatest의 놓을 자리가 엔진에 닿는다', place && place.ok === false && place.code === 'BAD_INPUT', JSON.stringify(place));
    // 끝난 되돌리기를 알렸다고 하는 restoreSeen(조율 세션 57c3d17e6)도 다리와 계약을 지나 엔진에 닿는다 —
    // 끝난 결과가 없는 작업 번호는 아무것도 지우지 않고 상태를 돌려주고, 꼴이 틀린 값은 BAD_INPUT으로 거절된다
    const seenOf = (arg) => runAsync(`const done=arguments[arguments.length-1];Promise.resolve(window.backup.restoreSeen&&window.backup.restoreSeen(${arg})).then(r=>done(r?{ok:r.ok,code:r.code||null,state:!!(r.value&&r.value.account)}:null),()=>done(null))`);
    const seenOk = await seenOf('"job-none"'), seenBad = await seenOf('42');
    check('restoreSeen이 엔진에 닿는다', seenOk && seenOk.ok === true && seenOk.state && seenBad && seenBad.code === 'BAD_INPUT', JSON.stringify({ seenOk, seenBad }));
    // 옮겨 오기의 읽기 둘(조율 세션 d32d25233 · 2c9464397) — 시작한 적 없는 시험 PC는 멈춘 옮겨 오기도 결과도 없다
    const mvOf = (m) => runAsync(`const done=arguments[arguments.length-1];Promise.resolve(window.backup.${m}&&window.backup.${m}()).then(r=>done(r?{ok:r.ok,code:r.code||null,value:r.value===undefined?'undefined':r.value}:null),()=>done(null))`);
    const mvState = await mvOf('moveState'), mvResult = await mvOf('moveResult');
    // 4b의 체크 목록과 c6ae51da6의 새 메서드 둘 — 옮겨 온 적 없는 시험 PC는 늘 보이는 셋만 있고, 결과에 없는 자리는 열거나 적지 않는다
    const callOf = (m, arg) => runAsync(`const done=arguments[arguments.length-1];Promise.resolve(window.backup.${m}&&window.backup.${m}(${arg})).then(r=>done(r?{ok:r.ok,code:r.code||null,err:typeof r.error==='string'&&r.error.length>0,value:r.value===undefined?'undefined':r.value}:null),()=>done(null))`);
    const mvChecks = await callOf('moveChecklist', ''), mvOpen = await callOf('moveOpen', '{path:"C:/nope"}'), mvNext = await callOf('setNextSources', '{sources:["C:/nope"]}');
    // 계정의 백업을 연 PC는 늘 보이는 셋을 받는다. 백업이 없는 이 시험 PC는 꾸러미를 찾을 판 목록이 없어 엔진이 글과 함께 거절한다(다리 · 계약은 지났다)
    check('moveChecklist가 엔진에 닿는다', !!mvChecks && (mvChecks.ok === true ? Array.isArray(mvChecks.value) && ['browser', 'google-2sv', 'certificate'].every((id) => mvChecks.value.some((x) => x.id === id)) : mvChecks.err === true && mvChecks.code !== 'NO_METHOD'), JSON.stringify(mvChecks));
    check('moveOpen · setNextSources가 결과에 없는 자리를 거절한다(BAD_INPUT)', mvOpen?.code === 'BAD_INPUT' && mvNext?.code === 'BAD_INPUT', JSON.stringify({ mvOpen, mvNext }));
    // E16(e244f42e4) — 표의 공식 · 사용권 페이지. 표에 없는 ID는 BAD_INPUT, 표의 ID는 시험 모드의 호스트가 열지 않는다(브라우저를 띄우지 않는다)
    const pgBad = await callOf('moveOpenProgramPage', '{id:"Nope.Nope",kind:"site"}'), pgGit = await callOf('moveOpenProgramPage', '{id:"Git.Git",kind:"site"}');
    check('moveOpenProgramPage가 엔진에 닿고 시험 모드에서 브라우저를 열지 않는다', pgBad?.code === 'BAD_INPUT' && !!pgGit && pgGit.ok === false && pgGit.code !== 'NO_METHOD' && pgGit.code !== 'BAD_INPUT', JSON.stringify({ pgBad, pgGit }));
    // 옛 PC 백업에서 꺼내기(조율 세션 793e0d6dc) — 새 메서드가 다리와 계약을 지나 엔진에 닿는다. folder 없는 한 층 읽기는 거절되고,
    // 판이 없는 이 시험 PC에서 고른 폴더는 엔진의 글로 거절된다(NO_METHOD · BAD_INPUT이 아니다)
    const obNo = await callOf('browseBackupFolder', '{profile:"local"}'), obOne = await callOf('browseBackupFolder', '{profile:"local",from:"ffffffffffff",folder:"C:/nope"}');
    check('browseBackupFolder가 엔진에 닿고 folder 없는 요청을 거절한다', !!obNo && obNo.ok === false && ['INVALID_REQUEST', 'BAD_INPUT'].includes(obNo.code) && !!obOne && obOne.ok === false && !['NO_METHOD', 'BAD_INPUT'].includes(obOne.code), JSON.stringify({ obNo, obOne }));
    // 도는 되살리기 그만두기(요청 16, 조율 세션 60a9de51e) — 새 메서드가 다리와 계약을 지나 엔진에 닿는다. 도는 되살리기가 없으면 그만둘 것이 없다고 답한다
    const cr = await callOf('cancelRestore');
    check('cancelRestore가 엔진에 닿고 도는 되살리기가 없으면 stopping: false로 답한다', !!cr && cr.ok === true && cr.value && cr.value.stopping === false, JSON.stringify(cr));
    // 범위를 통째로 받기 · 만들다 만 폴더 열기(E27 · E29, 조율 세션 ced52da00) — 새 메서드와 입력이 다리와 계약을 지나 엔진에 닿는다.
    // folder 없는 범위 받기는 거절되고(NO_METHOD가 아니다), 만들다 만 폴더가 없는 이 시험 PC에서는 NOT_FOUND다
    const rsNo = await callOf('restoreScope', '{profile:"local"}'), olNo = await callOf('openRestoreFolder', '{unfinished:true}');
    check('restoreScope · openRestoreFolder({unfinished})가 엔진에 닿는다', !!rsNo && rsNo.ok === false && ['INVALID_REQUEST', 'BAD_INPUT'].includes(rsNo.code) && !!olNo && olNo.ok === false && olNo.code === 'NOT_FOUND', JSON.stringify({ rsNo, olNo }));
    // 솔리오 잇기(엔진 305e380fe) — 창 상태의 solio 칸과 새 메서드 셋이 다리와 계약을 지나 엔진에 닿는다. 쓰는 곳은 시험 상태 폴더뿐이다
    const so = await callOf('getState', '');
    const sov = so?.value?.solio || null;
    check('창 상태에 solio 칸(setup · restNetworks · aiTools)이 있다', !!sov && sov.setup === null && Array.isArray(sov.restNetworks) && !!sov.aiTools && typeof sov.aiTools.tools === 'object', JSON.stringify(sov));
    const restSet = await callOf('setRestNetworks', '["시험 Wi-Fi"]'), restBad = await callOf('setRestNetworks', `["${'가'.repeat(11)}"]`), restClear = await callOf('setRestNetworks', '[]');
    check('setRestNetworks가 엔진에 닿아 목록을 쓰고 새 상태를 돌려주며, 32바이트 넘는 이름은 BAD_INPUT으로 거절한다', restSet?.ok === true && JSON.stringify(restSet.value?.solio?.restNetworks) === '["시험 Wi-Fi"]'
      && restBad?.code === 'BAD_INPUT' && restClear?.ok === true && JSON.stringify(restClear.value?.solio?.restNetworks) === '[]', JSON.stringify({ restSet: restSet?.value?.solio?.restNetworks, restBad, restClear: restClear?.value?.solio?.restNetworks }));
    const wifi = await callOf('wifiName', '');
    check('wifiName(E30)이 엔진에 닿고 시험 모드에서는 Wi-Fi 이름을 읽지 않는다(null)', wifi?.ok === true && wifi.value === null, JSON.stringify(wifi));
    const aiNow = await callOf('aiToolsState', ''), aiBad = await callOf('setAiTools', '{tools:{protection_status:true}}'), aiMask = await callOf('setAiTools', '{tools:{},masks:["시험"]}'), aiBack = await callOf('setAiTools', '{tools:{},masks:[]}');
    check('aiToolsState · setAiTools가 엔진에 닿는다(켜고 끄는 칸이 없는 상태 도구는 거절)', aiNow?.ok === true && Array.isArray(aiNow.value?.clients) && aiNow.value?.tools && 'find_restorable' in aiNow.value.tools
      && aiBad?.code === 'BAD_INPUT' && aiMask?.ok === true && JSON.stringify(aiMask.value?.solio?.aiTools?.masks) === '["시험"]' && aiBack?.ok === true, JSON.stringify({ aiNow: aiNow?.value, aiBad, aiMask: aiMask?.value?.solio?.aiTools }));
    // 이 백업에 담지 못하는 이름(설계 4.2 — 엔진 b18e0775b) — 창 상태 맨 위의 leftOutNames 칸(없으면 null, 있으면 화면이 읽는 꼴)
    const loState = await callOf('getState', ''), lo = loState?.value?.leftOutNames;
    check('창 상태에 leftOutNames 칸이 있고 null이거나 { at, count, names, cut } 꼴이다', loState?.ok === true && !!loState.value && 'leftOutNames' in loState.value
      && (lo === null || (typeof lo === 'object' && typeof lo.at === 'string' && Number.isSafeInteger(lo.count) && Array.isArray(lo.names) && typeof lo.cut === 'boolean')), JSON.stringify(lo ?? null).slice(0, 200));
    // 한꺼번에 지워짐(설계 4.4 — 엔진 9ddcbeb40) — 창 상태의 massHold 칸. 멈춤이 없으면 restoreMassBefore는 NOT_FOUND, 모르는 칸은 BAD_INPUT, massConfirm은 상태를 그대로 돌려준다
    const mhState = await callOf('getState', ''), mhNo = await callOf('restoreMassBefore', "{place:'default'}"), mhBad = await callOf('restoreMassBefore', "{place:'default',x:1}"), mhOk = await callOf('massConfirm', '');
    check('창 상태에 massHold 칸이 있고(멈춤이 없으면 null), restoreMassBefore · massConfirm이 엔진에 닿는다', mhState?.ok === true && !!mhState.value && 'massHold' in mhState.value && mhState.value.massHold === null
      && mhNo?.code === 'NOT_FOUND' && mhBad?.code === 'BAD_INPUT' && mhOk?.ok === true && !!mhOk.value && mhOk.value.massHold === null, JSON.stringify({ hold: mhState?.value?.massHold, mhNo, mhBad, mhOk: mhOk?.value?.massHold }));
    // E17 · E24 — moveState에 깔기 · 설정 결과, 다시 로그인할 곳의 남은 수, begun이 실린다(옮겨 온 적 없는 PC는 비었다)
    const mvs = mvState?.value || {};
    check('moveState · moveResult가 엔진에 닿는다', mvState?.ok === true && mvState.value && mvs.unfinished === false && mvs.running === false && mvResult?.ok === true && mvResult.value === null
      && mvs.reinstall === null && mvs.settings === null && mvs.checklistLeft === null && typeof mvs.begun === 'boolean', JSON.stringify({ mvState, mvResult }));
    check('계정 칸에 열쇠 · 토큰 · 비밀번호가 없다', acc && !/token|secret|password|refresh|applicationKey|keyId/i.test(acc.text), acc ? acc.keys.join(',') : '없음');
    const env2 = await run("return {font:document.fonts.check('16px \"SUIT Variable\"'),fonts:[...document.fonts].map(f=>f.family+':'+f.status),webgl:(()=>{const c=document.createElement('canvas');return !!c.getContext('webgl')})(),w:innerWidth,h:innerHeight}");
    check('SUIT 글꼴이 실렸다(Tauri CSP font-src)', env2.font, env2.fonts.join(', '));
    check('WebGL이 켜진다(구)', env2.webgl);
    // ② 모든 화면 × 예시 상태 — 화면 글 검사
    const { STATES, NOW, MOVE_MV, MOVE_ACCT } = await import(pathToFileURL(path.join(APP, 'ui/engine-fixtures.js')).href);
    const { findBanned } = await import(pathToFileURL(path.join(APP, 'ui/banned-words.js')).href);
    const names = await run('return window.__wb.screens');
    const cases = [...Object.keys(STATES).map((k) => ['home', k]), ...names.filter((n) => n !== 'home').map((n) => [n, n.startsWith('partial') ? 'home-partial' : n === 'start-1' ? 'start' : n === 'mass-list' ? 'home-mass' : n === 'left-out' ? 'home-leftout' : 'home'])];
    for (const [screen, st] of cases) {
      const r = await run('const [id,state,now]=arguments;window.__wb.show(id,{state,now,still:true});return {screen:document.getElementById("stage").dataset.screen,text:window.__wb.text()}', [screen, STATES[st], NOW]);
      const banned = findBanned(r.text);
      report.screens.push({ screen, state: st, shown: r.screen, banned });
      if (banned.length) check(`화면 글 검사 ${screen}(${st})`, false, banned.join(', '));
      try { const png = await wd('GET', `/session/${session}/screenshot`); fs.writeFileSync(path.join(out, `${screen === 'home' ? st : screen}.png`), Buffer.from(png, 'base64')); } catch { /* 숨은 창은 찍히지 않을 수 있다 */ }
    }
    // 옮겨 오기 화면 넷은 창의 옮겨 오기 기억(mv)이 있어야 엔진 갈래로 그린다
    for (const [screen, st, key] of [['move-1', 'home-move-read', 'open'], ['move-2', 'home-move-run', 'run'], ['move-3', 'home-move-read', 'result'], ['move-4', 'home-move-read', 'fresh'], ['home', 'home-move-read', 'stopped'],
      ['move-apps', 'home-move-read', 'apps-open'], ['move-apps', 'home-move-apps-elevated', 'apps-running'], ['move-apps', 'home-move-apps-done', 'apps-result'], ['move-apps', 'home-move-read', 'apps-notready'],
      ['move-2', 'home-move-listbig', 'nospace'], ['move-3', 'home-move-read', 'gone']]) {
      const r = await run('const [id,state,now,mv,acct]=arguments;window.__wb.show(id,{state,now,still:true,mv,acct});return {screen:document.getElementById("stage").dataset.screen,text:window.__wb.text()}', [screen, STATES[st], NOW, MOVE_MV[key], MOVE_ACCT]);
      const banned = findBanned(r.text);
      report.screens.push({ screen: `${screen}:${key}`, state: st, shown: r.screen, banned });
      if (banned.length) check(`화면 글 검사 ${screen}:${key}`, false, banned.join(', '));
    }
    check(`화면 글 검사 ${report.screens.length}장`, report.screens.every((x) => !x.banned.length), `걸림 ${report.screens.filter((x) => x.banned.length).length}장`);
    // 목록 화면 둘은 그 상태일 때만 제 화면으로 그린다(아니면 기본 화면) — 글 검사가 실제로 그 화면을 본다
    const own = ['mass-list', 'left-out'].map((n) => report.screens.find((x) => x.screen === n)?.shown);
    check('「지워진 파일 목록」 · 「담지 못한 이름」 화면은 그 예시 상태에서 제 화면으로 그린다', own[0] === 'mass-list' && own[1] === 'left-out', JSON.stringify(own));
    // ⑥ 단추: 예시 상태에서 「파일 되살리기」로 넘어갔다 돌아오기
    await run('const [state,now]=arguments;window.__wb.show("home",{state,now,still:true})', [STATES.home, NOW]);
    await run('document.querySelector(\'#room [data-act="restore"]\').click()');
    const moved = await run('return document.getElementById("stage").dataset.screen');
    check('「파일 되살리기」를 누르면 되살리기 화면으로 간다', moved === 'restore', moved);
    await run('document.querySelector(\'#top-r [data-act="home"]\').click()');
    // ⑦ 실제 상태로 돌아와 설정 서랍 열고 닫기(카본 A15 — 앞 판은 live() 바로 뒤 예시 상태로 덮어 실제 상태를 보지 못했다).
    // 설정 전의 첫 시작 화면에는 「설정」 단추가 없어 열기 낱말 folders로 연다
    await run('window.__wb.live()');
    const liveScreen = await run('return document.getElementById("stage").dataset.screen');
    check('실제 상태로 돌아온다', liveScreen === 'start-1' || liveScreen === 'home', liveScreen);
    await run('window.__wb.open("folders")');
    const drawerOpen = await run('return !document.getElementById("drawer").hidden && document.querySelectorAll(".drawer .dg").length');
    check('실제 상태에서 설정 서랍이 열린다', drawerOpen === 3, String(drawerOpen));
    // 실제 상태에서는 예시 화면(예시 복구 코드)을 열지 않고 「준비 중」 한 줄만 띄운다
    await run('document.querySelector(\'.drawer [data-act="code"]\').click()');
    const after = await run('return {screen:document.getElementById("stage").dataset.screen,note:document.getElementById("note").textContent}');
    check('실제 상태에서 「복구 코드 만들기」는 예시 화면을 열지 않는다', after.screen !== 'code' && /준비 중/.test(after.note), JSON.stringify(after));
    // 계정에 잇지 않은 PC에서는 「사고가 났을 때 되돌리기」도 서버에 묻지 않고 「준비 중」 한 줄만
    await run('document.querySelector(\'.drawer [data-act="undo-1"]\').click()');
    const undoAfter = await run('return {screen:document.getElementById("stage").dataset.screen,note:document.getElementById("note").textContent}');
    check('계정에 잇지 않은 PC에서 되돌리기는 열지 않는다', undoAfter.screen !== 'undo-1' && /Google 계정으로 시작한 PC에서 엽니다/.test(undoAfter.note), JSON.stringify(undoAfter));
    if (liveScreen === 'start-1') check('첫 시작에 「Google로 시작」 단추가 있다', await run('return !!document.querySelector(\'#room [data-act="google"]\')'));
    // 계정의 백업을 열지 않은 PC에서는 옮겨 오기 화면을 열지 않는다(옮겨 오기 메서드는 연 뒤에만 돈다 — Fable 옮겨 오기 검토 F1)
    await run('window.__wb.open("move")');
    const moveAfter = await run('return document.getElementById("stage").dataset.screen');
    check('계정의 백업을 열지 않은 PC에서 옮겨 오기는 첫 화면에 머문다', !/^move-([1-4]|apps)$/.test(moveAfter), moveAfter);
    await run('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))');
    check('Esc로 설정 서랍이 닫힌다', await run('return document.getElementById("drawer").hidden'));
    // ③ 쪽 오류(앱이 남긴 것)
    const errors = await run('return window.__wb.errors()').catch(() => ['오류 목록을 읽지 못함']);
    check('쪽 오류 없음', !errors.length, errors.join(' / '));
  } catch (e) {
    check('시험 진행', false, e.message);
  } finally {
    if (session) await wd('DELETE', `/session/${session}`).catch(() => {});
    td.kill();
    report.endedAt = new Date().toISOString();
    report.ok = report.checks.every((c) => c.ok);
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(report.ok ? `통과 — ${out}` : `실패 — ${out}`);
    process.exitCode = report.ok ? 0 : 1;
  }
})();
