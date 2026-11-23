'use strict';
// 실제 상태 갈래 점검 — 예시 상태를 넣지 않고(window.__wb.show를 쓰지 않는다) 창이 엔진을 부르는 길 그대로 지나는지 본다.
//   node test-support/ui-live.cjs
// dist/를 작은 로컬 서버로 띄우고, 엔진 대신 window.__TAURI__ 흉내가 메서드마다 답을 준다(브리지는 진짜 bridge.js가 돈다).
// 화면 시험과 캡처는 창 기억(mv)을 직접 넣는 예시 갈래만 지나, 창이 엔진 값을 읽는 순서의 결함을 놓쳤다(Fable 화면 검수
// workbackup-ui-move4b-e1624 F1 — 넘긴 PC에서 moveState를 읽지 않아 「프로그램과 설정」이 열리지 않았다). 그 길을 여기서 지난다.
// 먼저 node scripts/stage-ui.cjs 로 dist/를 만든다. Playwright가 이 작업본에 없으면 공용 작업본의 것을 쓴다.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const APP = path.resolve(__dirname, '..');
const DIST = path.join(APP, 'dist');
const REPO = path.resolve(APP, '..', '..');
function playwright() {
  try { return require('playwright'); } catch {
    const { 공용작업본 } = require(path.join(REPO, 'tools/lib/공용작업본.js'));
    return require('node:module').createRequire(path.join(공용작업본(REPO), 'package.json'))('playwright');
  }
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/가 없습니다. 먼저 node scripts/stage-ui.cjs 를 돌리세요.');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html', file = path.join(DIST, rel);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const { STATES, MOVE_MV, MOVE_APPS } = await import(pathToFileURL(path.join(APP, 'ui/engine-fixtures.js')).href);
  // 넘긴 PC: 이 PC가 계정의 백업을 한다(mode backup · 계정 이음 · 쓰는 기기)
  const handedHome = { ...STATES.home, account: { ...(STATES['home-move-read'].account || {}), connected: true, role: 'write' } };
  const readState = STATES['home-move-read'];
  const browser = await playwright().chromium.launch({ channel: 'chrome' });
  const results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); };

  /** 한 갈래 — start: 'handed'(넘긴 PC를 다시 켬) · 'read'(복구 전용 PC에서 옮겨 온 결과가 있음) · 'flaky'(넘긴 PC, 첫 moveState만 실패) ·
   *  'slowfail'(넘긴 PC, 첫 moveState는 바로 실패, 둘째는 2.5초 뒤 실패, 셋째부터 성공) · 'old'(복구 전용 PC, 사진 폴더가 너무 커서 옮기지 않은 결과 —
   *  옛 PC 백업에서 꺼내기, 조율 세션 793e0d6dc. 「2023」 층은 1.5초 늦게 「늦은폴더」를 답하고, 둘째 맨 위 층 읽기도 1.5초 걸린다 —
   *  그 사이에 늦은 답이 화면에 올라오지 않는지 본다) · 'limit'(계정에 잇지 않은 PC, Google로 시작이 LIMIT_DEVICES로 막힘 — 화면 요청 9 · 15) ·
   *  'stop'(전체 되살리기가 도는 PC — cancelRestore가 그만두는 중으로 바꾸고, 다음 상태 읽기에서 그만둔 뒤가 된다, 요청 16) ·
   *  'stopdone'(같은 PC, 누르는 사이 되살리기가 끝나 cancelRestore가 stopping: false로 답한다) ·
   *  'denied'(계정에 잇지 않은 PC, Google 화면의 Drive 칸을 켜지 않아 「Google로 시작」이 DENIED로 끝남) ·
   *  'solio'(솔리오의 「보호 시작」으로 온 창 — state.solio.setup, 로그인은 __finishSignIn까지 기다리다 REAUTH) ·
   *  'solio-move'(솔리오의 「이 PC로 옮겨 오기」로 온 창 — 로그인하면 다른 PC가 백업하는 계정) · 'settings'(넘긴 PC, 설정 서랍의 쉬는 Wi-Fi · AI 도구) ·
   *  'mass'(한꺼번에 지워짐 멈춤이 있는 PC — 설계 4.4, 엔진 massHold 9ddcbeb40) ·
   *  'leftout'(이름 끝이 점이나 빈칸이라 담지 못한 파일과 쓰는 중인 파일이 함께 있는 PC — 설계 4.2, 엔진 leftOutNames) */
  async function scenario(start) {
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 820 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    await ctx.addInitScript(({ solioStart, solioMoveStart, readConn, handedHome, readState, signinState, restoring, stopping, stopped, handed, ended, result, bigResult, list, checklist, massState, leftState, start }) => {
      const calls = []; window.__calls = calls; window.__args = [];
      let cur = start === 'leftout' ? leftState : start === 'mass' ? massState : start === 'solio-restore' ? { ...readState, solio: { ...readState.solio, setup: { mode: 'protect', hint: null, at: '2026-11-17T04:00:00.000Z' } } } : start === 'solio' ? solioStart : start === 'solio-move' ? solioMoveStart : start === 'stop' || start === 'stopdone' ? restoring : start === 'limit' || start === 'denied' ? signinState : start === 'read' || start === 'old' ? readState : handedHome, failOnce = start === 'flaky', stateN = 0, rootN = 0;
      // 솔리오 잇기 — 같은(또는 새) 요청이 다시 실린 상태를 보낸다
      window.__handover = () => { cur = { ...handedHome, solio: cur.solio }; window.__push?.(); };
      window.__setRest = (names) => { cur = { ...cur, solio: { ...cur.solio, restNetworks: names } }; window.__push?.(); };
      window.__setSpace = (sf) => { cur = { ...cur, solio: { ...cur.solio, spaceFree: sf } }; window.__push?.(); };
      // 한꺼번에 지워짐 — 되살리기가 끝남 · 다른 길로 멈춤이 풀림
      const calm = { level: 'active', reason: 'active', nextAction: 'backup' };
      window.__massDone = () => { cur = { ...cur, job: null, lastRestore: { path: 'C:\\Users\\studio\\Downloads\\되살린 파일 (11월 20일)', at: new Date().toISOString(), fromEarlier: 0, inNone: 0, mass: { beforeId: cur.massHold.beforeId, beforeAt: cur.massHold.beforeAt } } }; window.__push?.(); };
      window.__massLift = () => { cur = { ...cur, massHold: null, protection: calm }; window.__push?.(); };
      window.__massBack = () => { cur = { ...cur, massHold: massState.massHold, protection: massState.protection }; window.__push?.(); };
      // 담지 못한 이름 — 이름을 바꿔 다음 백업에 담김
      window.__leftClear = () => { cur = { ...cur, leftOutNames: null }; window.__push?.(); };
      window.__massJob = (on) => { cur = { ...cur, job: on ? { kind: 'backup', stage: '백업 중', percent: 10, scheduled: true } : null }; window.__push?.(); };
      window.__resetup = (at) => { cur = { ...cur, solio: { ...cur.solio, setup: { mode: 'protect', hint: 'studio@example.com', at: at || '2026-11-17T04:00:00.000Z' } } }; window.__push?.(); };
      window.__TAURI__ = { core: { invoke: async (_n, { method, args }) => {
        calls.push(method); window.__args.push({ method, input: args?.[0] ?? null });
        // 옛 PC 판 — 한 층 읽기와 범위 목록
        if (method === 'browseBackupFolder') {
          const sub = args?.[0]?.sub || '';
          if (sub === '2023' || (sub === '' && ++rootN === 2)) await new Promise((r) => setTimeout(r, 1500));
          const folders = sub === '' ? ['2023', '2024'] : sub === '2024' ? ['여행'] : sub === '2023' ? ['늦은폴더'] : [];
          return { ok: true, value: { profile: 'b2', from: args?.[0]?.from ?? null, folder: args?.[0]?.folder, sub, snapshotAt: '2026-11-13T05:02:00Z', folders, files: sub ? 0 : 1 } };
        }
        if (method === 'openFileCatalog') return { ok: true, value: { profile: 'b2', token: 'tk', from: args?.[0]?.from ?? null, snapshotAt: '2026-11-13T05:02:00Z', fileCount: 1, totalBytes: 10, scope: args?.[0]?.folder ? [{ source: '03-Pictures', folder: args[0].folder, sub: args[0].sub || '' }] : null, selection: { revision: 1, count: 0, bytes: 0 } } };
        if (method === 'queryFileCatalog') return { ok: true, value: { profile: 'b2', token: 'tk', query: '', offset: 0, total: 1, pageSize: 100, selection: { revision: 1, count: 0, bytes: 0 }, rows: [{ id: '1', source: '03-Pictures', path: '/2024/여행/a.jpg', name: 'a.jpg', size: 10, mtime: '2024-07-01T00:00:00Z', selected: false }] } };
        if (method === 'closeFileCatalog') return { ok: true, value: null };
        // 범위를 통째로 받기(E27)는 뒤에서 도는 되살리기라 곧 상태를 돌려준다 · 만들다 만 폴더 열기(E29)
        if (method === 'restoreScope') return { ok: true, value: cur };
        if (method === 'openRestoreFolder' || method === 'openSelectedRestoreFolder') return { ok: true, value: null };
        // 기기가 다 참 — 다시 깐 PC의 옛 연결(백업하는 기기, sameInstall)과 되살리기 기기 둘
        // 솔리오 잇기 — signInGoogle을 부르면 엔진이 setup을 지운다(handlers.cjs)
        if (method === 'signInGoogle' && start === 'solio') { cur = { ...cur, solio: { ...cur.solio, setup: null } }; return new Promise((r) => { window.__finishSignIn = () => r({ ok: false, error: 'x', code: 'REAUTH' }); }); }
        if (method === 'signInGoogle' && start === 'solio-move') { cur = { ...readConn, solio: { ...cur.solio, setup: null } }; return { ok: true, value: cur }; }
        if (method === 'openAccountBackup') { cur = { ...readState, solio: cur.solio }; return { ok: true, value: cur }; }
        if (method === 'setRestNetworks') { cur = { ...cur, solio: { ...cur.solio, restNetworks: args[0] } }; return { ok: true, value: cur }; }
        if (method === 'setAiTools') { const i = args?.[0] || {}, t = cur.solio.aiTools; cur = { ...cur, solio: { ...cur.solio, aiTools: { ...t, tools: { ...t.tools, ...(i.tools || {}) }, masks: i.masks ?? t.masks } } }; return { ok: true, value: cur }; }
        if (method === 'wifiName') return { ok: true, value: '집 Wi-Fi' };
        // 공간 비우기 2판 — 엔진 창에서만 켜고 정한 선을 바꾼다
        if (method === 'spaceFreeState') return { ok: true, value: cur.solio.spaceFree || { open: false } };
        if (method === 'setPressFree') { cur = { ...cur, solio: { ...cur.solio, spaceFree: { ...cur.solio.spaceFree, on: args[0] === true, since: args[0] === true ? new Date().toISOString() : null } } }; return { ok: true, value: cur }; }
        if (method === 'setStartLine') { const i = args?.[0] || {}; cur = { ...cur, solio: { ...cur.solio, spaceFree: { ...cur.solio.spaceFree, lines: cur.solio.spaceFree.lines.map((l) => (l.drive === i.drive ? { ...l, gb: i.gb, set: true } : l)) } } }; return { ok: true, value: cur }; }
        if (method === 'aiToolsState') return { ok: true, value: { ...cur.solio.aiTools, clients: [{ name: 'claude-code', version: '2.1.0', exe: 'C:\\Tools\\claude.exe', firstSeen: '2026-11-15T01:00:00Z', lastSeen: '2026-11-17T04:40:00Z' }] } };
        if (method === 'signInGoogle' && start === 'denied') {
          if (calls.filter((c) => c === 'signInGoogle').length < 2) return { ok: false, error: 'x', code: 'DENIED' };
          return new Promise((r) => { window.__finishSignIn = () => r({ ok: false, error: 'x', code: 'REAUTH' }); });
        }
        if (method === 'signInGoogle') return { ok: false, error: 'x', code: 'LIMIT_DEVICES', details: { devices: [
          { id: 'a'.repeat(12), name: '작업 노트북', role: 'write', state: 'active', sameInstall: true },
          { id: 'd'.repeat(12), name: '거실 PC', role: 'read', state: 'active', sameInstall: false },
          { id: 'e'.repeat(12), name: '옛 노트북', role: 'read', state: 'active', sameInstall: false }] } };
        // 도는 되살리기 그만두기 — 그만두는 중(job.cancelled)으로 바꾸고, 그다음 상태 읽기에서 그만둔 뒤가 된다
        if (method === 'cancelRestore' && start === 'stopdone') { cur = { ...restoring, job: null, protection: { level: 'protected', reason: null, nextAction: 'none' } }; return { ok: true, value: { stopping: false } }; }
        if (method === 'cancelRestore') { const was = cur; cur = stopping; window.__finishStop = () => { if (cur === stopping) { cur = { ...stopped, lastRestoreError: { ...stopped.lastRestoreError, at: new Date().toISOString() } }; window.__push?.(); } }; return { ok: true, value: { stopping: was === restoring } }; }
        if (method === 'revokeDevice') return args?.[0] === 'e'.repeat(12) ? { ok: false, error: 'x', code: 'NOT_FOUND' } : { ok: true, value: { suggestReadKeyRotation: true } };
        if (method === 'setFileSelection') return { ok: true, value: { profile: 'b2', token: 'tk', selection: { revision: 2, count: 1, bytes: 10 } } };
        // 한꺼번에 지워짐(설계 4.4) — 지워지기 전 판에서 받기는 뒤에서 도는 되살리기다. __massGone: 그사이 확인을 마침 · __massUnsafe: 다운로드가 지키는 폴더와 겹침
        if (method === 'restoreMassBefore') {
          if (window.__massGone) { cur = { ...cur, massHold: null, protection: calm }; return { ok: false, error: 'x', code: 'NOT_FOUND' }; }
          if (window.__massUnsafe && args?.[0]?.place === 'default') return { ok: false, error: 'x', code: 'OUTPUT_UNSAFE' };
          cur = { ...cur, job: { kind: 'restore', stage: '복구 중', percent: 5 } }; return { ok: true, value: cur };
        }
        if (method === 'massConfirm') { cur = { ...cur, massHold: null, protection: calm }; return { ok: true, value: cur }; }
        if (method === 'getState') return { ok: true, value: cur };
        // 넘기기 전에는 옮겨 온 결과가 있는 상태, 넘긴 뒤에는 넘긴 PC의 상태(다시 로그인할 곳 7곳 남음)
        if (method === 'moveState' && failOnce) { failOnce = false; return { ok: false, error: 'x', code: 'NETWORK' }; }
        if (method === 'moveState' && start === 'slowfail' && ++stateN <= 2) {
          if (stateN === 2) await new Promise((r) => setTimeout(r, 2500));
          return { ok: false, error: 'x', code: 'NETWORK' };
        }
        if (method === 'moveState') return { ok: true, value: cur === handedHome ? handed : { ...ended, checklistLeft: 7, begun: true, reinstall: null, settings: null } };
        if (method === 'moveResult') return { ok: true, value: start === 'old' ? bigResult : result };
        if (method === 'moveReinstallList') return { ok: true, value: list };
        if (method === 'moveChecklist') return { ok: true, value: checklist };
        if (method === 'moveDevices') return { ok: true, value: [{ from: handed.from, lastBackupAt: '2026-11-13T04:00:00Z' }] };
        if (method === 'devicesList') return { ok: true, value: [] };
        if (method === 'moveOpenProgramPage') return { ok: true, value: null };
        if (method === 'takeWriteSeat') { cur = handedHome; return { ok: true, value: { state: cur } }; }
        if (method === 'continueBackup') { cur = handedHome; return { ok: true, value: cur }; }
        return { ok: false, error: 'x', code: 'FIXTURE' };
      } }, event: { listen: async (n, fn) => { if (n === 'backup:state') window.__push = () => fn({ payload: { ...cur } }); if (n === 'backup:open') window.__open = (topic) => fn({ payload: { topic } }); return () => {}; } } };
    }, { solioStart: STATES['start-solio'], solioMoveStart: STATES['start-solio-move'], readConn: STATES['start-read'], handedHome, readState, signinState: STATES['start-signin'], restoring: STATES['home-restoring'], stopping: STATES['home-restore-stopping'], stopped: STATES['home-restore-stopped'], handed: MOVE_MV.handed.state, ended: MOVE_MV.result.state, result: MOVE_MV.result.result, bigResult: MOVE_MV.toobigResult.result, list: MOVE_APPS.list, checklist: MOVE_APPS.checklist, massState: STATES['home-mass'], leftState: STATES['home-leftout-partial'], start });
    const pg = await ctx.newPage(), errors = [];
    pg.on('pageerror', (e) => errors.push(e.message));
    await pg.goto(base);
    await pg.waitForFunction(() => window.__wb);
    await pg.waitForTimeout(1200);
    return { pg, ctx, errors };
  }
  const seen = (pg) => pg.evaluate(() => ({ screen: document.getElementById('stage').dataset.screen, home: !!document.querySelector('#room [data-act="move-apps-home"]'),
    drawer: !!document.querySelector('#drawer-panel [data-act="move-apps"]'), note: document.getElementById('note')?.textContent || '', calls: window.__calls.slice() }));
  const click = async (pg, sel) => { await pg.click(sel); await pg.waitForTimeout(900); };

  // 1. 넘긴 PC에서 앱을 다시 켬 — 기본 화면 줄 · 서랍 줄 · 화면이 열리고 목록과 체크 목록을 읽는다
  {
    const { pg, ctx, errors } = await scenario('handed');
    let x = await seen(pg);
    check('넘긴 PC를 다시 켜면 moveState를 읽는다', x.calls.includes('moveState'), x.calls.join(','));
    check('넘긴 PC의 기본 화면에 「프로그램과 설정」 줄이 있다', x.home);
    await click(pg, '[data-act="drawer"]'); x = await seen(pg);
    check('넘긴 PC의 설정 서랍에 「프로그램과 설정」 줄이 있다', x.drawer);
    await click(pg, '#drawer-panel [data-act="move-apps"]'); await pg.waitForTimeout(600); x = await seen(pg);
    check('서랍 줄을 누르면 「프로그램과 설정」이 열린다(준비 중 글 없이)', x.screen === 'move-apps' && !/준비 중/.test(x.note), `${x.screen} · ${x.note}`);
    check('그 화면이 옛 PC의 프로그램 목록과 다시 로그인할 곳을 읽는다', x.calls.includes('moveReinstallList') && x.calls.includes('moveChecklist'), x.calls.join(','));
    // 페이지 단추에 둔 포커스는 상태 알림이 와도 그 단추에 남는다(Fable F2)
    await click(pg, '#room [data-act="app-cmds"]');
    // 포커스를 둔 채 다른 줄의 고르는 단추를 스크립트로 눌러(포커스는 옮기지 않는다) 화면을 실제로 다시 그리게 한다(Fable FA2 — 같은 상태를
    // 다시 보내면 그린 글이 같아 화면을 갈지 않아 focusKey를 지나지 않았다)
    const f = await pg.evaluate(async () => {
      const room = document.getElementById('room'), b = room.querySelector('[data-act="app-page"][data-app="Git.Git"][data-kind="license"]');
      const other = room.querySelector('[data-act="app-pick"][data-app="OpenJS.NodeJS.LTS"]');
      if (!b || !other) return { found: false };
      b.focus(); const before = room.innerHTML; other.click(); await new Promise((r) => setTimeout(r, 400));
      const a = document.activeElement;
      return { found: true, redrawn: room.innerHTML !== before && !document.body.contains(b), act: a?.dataset?.act || '', app: a?.dataset?.app || '', kind: a?.dataset?.kind || '' };
    });
    check('화면을 다시 그려도 페이지 단추의 포커스가 그 단추에 남는다', f.found && f.redrawn && f.act === 'app-page' && f.app === 'Git.Git' && f.kind === 'license', JSON.stringify(f));
    check('쪽 오류 없음(넘긴 PC)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 2. 복구 전용 PC에서 넘김 — 같은 창에서 넘긴 뒤에도 기본 화면 줄과 서랍 줄이 생긴다
  {
    const { pg, ctx, errors } = await scenario('read');
    await click(pg, '#room [data-act="move-next"]'); await pg.waitForTimeout(600);
    let x = await seen(pg);
    check('복구 전용 PC의 「이 PC로 이어서 백업」이 넘기기 화면을 연다', x.screen === 'move-4', x.screen);
    await click(pg, '#room [data-act="move-take"]'); await pg.waitForTimeout(800); x = await seen(pg);
    check('넘긴 뒤 기본 화면으로 오고 moveState를 다시 읽는다', x.screen === 'home' && x.calls.filter((c) => c === 'moveState').length >= 2, `${x.screen} · ${x.calls.join(',')}`);
    check('같은 창에서 넘긴 뒤 기본 화면에 「프로그램과 설정」 줄이 있다', x.home);
    await click(pg, '[data-act="drawer"]'); x = await seen(pg);
    check('같은 창에서 넘긴 뒤 설정 서랍에 「프로그램과 설정」 줄이 있다', x.drawer);
    check('쪽 오류 없음(넘김)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 3. 넘긴 PC에서 첫 moveState가 실패함 — 서랍을 열면 한 번 더 읽어 줄이 생긴다(서랍 줄이 하나뿐인 입구다, Fable FA3)
  {
    const { pg, ctx, errors } = await scenario('flaky');
    let x = await seen(pg);
    check('첫 moveState가 실패하면 기본 화면 줄은 없다', !x.home && x.calls.filter((c) => c === 'moveState').length === 1, x.calls.join(','));
    await click(pg, '[data-act="drawer"]'); await pg.waitForTimeout(400); x = await seen(pg);
    check('서랍을 열면 moveState를 한 번 더 읽어 서랍 줄이 생긴다', x.drawer && x.calls.filter((c) => c === 'moveState').length === 2, x.calls.join(','));
    check('쪽 오류 없음(첫 읽기 실패)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 4. 같은 실패 뒤 서랍을 열지 않고 다른 화면에 갔다가 기본 화면으로 오면 한 번 더 읽어 기본 화면 줄이 생긴다(Fable -c FA1)
  {
    const { pg, ctx, errors } = await scenario('flaky');
    await click(pg, '#room [data-act="restore"]');
    let x = await seen(pg);
    check('다른 화면(파일 되살리기)으로 간다', x.screen === 'restore', x.screen);
    await click(pg, '#orb-btn'); await pg.waitForTimeout(400); x = await seen(pg);
    check('기본 화면으로 오면 moveState를 한 번 더 읽어 기본 화면 줄이 생긴다', x.screen === 'home' && x.home && x.calls.filter((c) => c === 'moveState').length === 2, `${x.screen} · ${x.calls.join(',')}`);
    check('쪽 오류 없음(돌아옴)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 5. 다시 읽는 사이에 서랍을 닫았다 다시 열어도 읽기가 겹치지 않고, 늦게 온 실패가 보이던 줄을 지우지 않는다(Fable -d FA1)
  {
    const { pg, ctx, errors } = await scenario('slowfail');
    await click(pg, '[data-act="drawer"]');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
    await click(pg, '[data-act="drawer"]');
    let x = await seen(pg);
    check('다시 읽는 중에 서랍을 다시 열어도 moveState를 겹쳐 부르지 않는다', x.calls.filter((c) => c === 'moveState').length === 2, x.calls.join(','));
    await pg.waitForTimeout(2800); x = await seen(pg);
    check('늦게 온 실패 뒤에도 읽기는 두 번뿐이다(다음 열기에서 다시 읽는다)', x.calls.filter((c) => c === 'moveState').length === 2 && !x.drawer, x.calls.join(','));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
    await click(pg, '[data-act="drawer"]'); await pg.waitForTimeout(400); x = await seen(pg);
    check('그다음 서랍을 열면 다시 읽어 서랍 줄이 생긴다', x.drawer && x.calls.filter((c) => c === 'moveState').length === 3, x.calls.join(','));
    check('쪽 오류 없음(겹친 읽기)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 6. 옛 PC 백업에서 꺼내기 — 확인서의 단추로 들어와 한 층씩 고르고, 고른 범위로 목록을 연다. 다른 길로 「파일 되살리기」에 오면 이 PC의 판을 연다
  {
    const { pg, ctx, errors } = await scenario('old');
    const lastArgs = (pg, m) => pg.evaluate((m) => window.__args.filter((a) => a.method === m).map((a) => a.input), m);
    await click(pg, '#room [data-act="move-result"]'); await pg.waitForTimeout(400);
    let x = await seen(pg);
    check('확인서에 「옛 PC 백업에서 꺼내기」가 있다', x.screen === 'move-3' && await pg.$('#room [data-act="old-start"]') !== null, x.screen);
    await click(pg, '#room [data-act="old-start"]'); x = await seen(pg);
    let b = await lastArgs(pg, 'browseBackupFolder');
    check('너무 큰 폴더가 하나면 그 폴더의 바로 아래를 읽는다', x.screen === 'restore-old' && b.length === 1 && b[0].from === 'f'.repeat(12) && /Pictures$/.test(b[0].folder) && b[0].sub === undefined, JSON.stringify(b));
    // 늦게 오는 층(2023)을 누른 뒤 곧바로 위로 가면, 2023 답(「늦은폴더」)이 온 뒤에도 맨 위 층을 읽는 동안 화면에 올라오지 않는다
    await pg.click('#room [data-act="old-in"][data-name="2023"]'); await pg.waitForTimeout(150);
    await click(pg, '#room [data-act="old-up"]'); await pg.waitForTimeout(900);
    const mid = await pg.evaluate(() => ({ late: !!document.querySelector('#room [data-name="늦은폴더"]'), h1: document.querySelector('#room h1')?.textContent || '', calls: window.__calls.filter((c) => c === 'browseBackupFolder').length }));
    check('늦게 온 앞 층의 답은 화면에 올라오지 않는다(맨 위 층을 읽는 중)', !mid.late && /「사진」/.test(mid.h1) && mid.calls === 3, JSON.stringify(mid));
    await click(pg, '#room [data-act="old-in"][data-name="2024"]'); await pg.waitForTimeout(600);
    const h1 = await pg.evaluate(() => document.querySelector('#room h1')?.textContent || '');
    b = await lastArgs(pg, 'browseBackupFolder');
    check('안쪽 폴더를 고르면 sub를 붙여 읽고, 늦게 온 앞 층의 답은 버린다', b.at(-1).sub === '2024' && /사진 › 2024」/.test(h1) && await pg.$('#room [data-act="old-in"][data-name="여행"]') !== null, `${h1} · ${JSON.stringify(b.map((a) => a.sub ?? ''))}`);
    await click(pg, '#room [data-act="old-open"]'); x = await seen(pg);
    let o = await lastArgs(pg, 'openFileCatalog');
    check('「이 폴더 열기」는 그 범위로 목록을 연다', x.screen === 'restore' && o.length === 1 && o[0].from === 'f'.repeat(12) && o[0].sub === '2024' && /Pictures$/.test(o[0].folder), JSON.stringify(o));
    const scoped = await pg.evaluate(() => ({ all: !!document.querySelector('#room [data-act="restore-all"]'), say: document.querySelector('#room h1')?.textContent || '' }));
    check('범위 목록에는 「전체 되살리기」가 없다', !scoped.all && /무엇을 꺼낼까요/.test(scoped.say), JSON.stringify(scoped));
    // 찾은 것 모두 고르기 — 엔진의 action all에 찾기 낱말을 함께 보내고, 고른 표시를 맞추려 목록을 다시 읽는다
    const q0 = (await seen(pg)).calls.filter((c) => c === 'queryFileCatalog').length;
    await click(pg, '#room [data-act="old-all"]');
    const sel = await lastArgs(pg, 'setFileSelection'), q1 = (await seen(pg)).calls.filter((c) => c === 'queryFileCatalog').length;
    check('「찾은 것 모두 고르기」는 action all과 찾기 낱말을 보내고 목록을 다시 읽는다', sel.length === 1 && sel[0].action === 'all' && sel[0].query === '' && sel[0].ids === undefined && q1 === q0 + 1, JSON.stringify({ sel, q0, q1 }));
    await click(pg, '#room [data-act="old-back"]'); x = await seen(pg);
    check('「다른 폴더 고르기」는 고르던 층으로 돌아가고 목록을 닫는다', x.screen === 'restore-old' && x.calls.includes('closeFileCatalog') && await pg.$('#room [data-act="old-in"][data-name="여행"]') !== null, x.calls.slice(-4).join(','));
    // E27 — 「이 폴더 통째로 꺼내기」는 고른 층을 restoreScope로 받고(놓을 자리는 기본 자리), 기본 화면으로 가서 진행을 본다
    await click(pg, '#room [data-act="old-whole"]'); x = await seen(pg);
    const sc = await lastArgs(pg, 'restoreScope');
    check('「이 폴더 통째로 꺼내기」는 그 층을 restoreScope로 받고 기본 화면으로 간다', x.screen === 'home' && sc.length === 1 && sc[0].from === 'f'.repeat(12) && /Pictures$/.test(sc[0].folder) && sc[0].sub === '2024' && sc[0].place === 'default' && typeof sc[0].profile === 'string', JSON.stringify(sc));
    await click(pg, '#orb-btn'); await click(pg, '#room [data-act="restore"]'); x = await seen(pg);
    o = await lastArgs(pg, 'openFileCatalog');
    check('다른 길로 「파일 되살리기」에 오면 이 PC의 판을 연다(범위 없이)', x.screen === 'restore' && o.length === 2 && o[1].from === undefined && o[1].folder === undefined, JSON.stringify(o));
    check('쪽 오류 없음(옛 PC 백업에서 꺼내기)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 7. 기기가 다 참 — 되살리기만 하는 기기를 Google 확인만으로 끊고, 다시 「Google로 시작」을 누르게 한다(화면 요청 9 · 15)
  {
    const { pg, ctx, errors } = await scenario('limit');
    await click(pg, '#room [data-act="google"]');
    let x = await pg.evaluate(() => ({ text: document.getElementById('room').innerText, btns: [...document.querySelectorAll('#room [data-act="limit-revoke"]')].map((b) => b.dataset.device) }));
    check('기기가 다 차면 목록을 보이고 되살리기만 하는 기기에만 「끊기」를 둔다', x.btns.length === 2 && x.btns.every((d) => /^[de]{12}$/.test(d)) && /작업 노트북\(이 PC · 앞서 깐 것\)/.test(x.text), JSON.stringify(x.btns));
    await click(pg, '#room [data-act="limit-revoke"][data-device="eeeeeeeeeeee"]');
    x = await pg.evaluate(() => ({ note: document.getElementById('note')?.textContent || '', box: document.querySelector('#room .box')?.innerText || '', left: [...document.querySelectorAll('#room [data-act="limit-revoke"]')].map((b) => b.dataset.device), focus: document.activeElement?.dataset?.device || document.activeElement?.dataset?.act || '' }));
    check('다른 Google 계정이라 그 기기가 없으면(NOT_FOUND) 알림과 상자에 계정을 확인하라고 쓰고, 목록과 포커스는 그 줄에 둔다', /이 Google 계정에서 「옛 노트북」을 찾지 못했습니다/.test(x.note) && /「옛 노트북」 연결을 끊지 못했습니다/.test(x.box) && x.left.length === 2 && x.focus === 'e'.repeat(12), JSON.stringify(x));
    await click(pg, '#room [data-act="limit-revoke"][data-device="dddddddddddd"]');
    const rv = await pg.evaluate(() => window.__args.filter((a) => a.method === 'revokeDevice').map((a) => a.input));
    x = await pg.evaluate(() => ({ text: document.getElementById('room').innerText, left: [...document.querySelectorAll('#room [data-act="limit-revoke"]')].map((b) => b.dataset.device), focus: document.activeElement?.dataset?.act || '' }));
    check('「끊기」는 그 기기 번호로 revokeDevice를 부르고, 끊은 기기를 목록에서 빼며 남은 줄의 「끊기」를 거두고 다시 시작하라고 쓴다(포커스는 「다시 시작」)', rv.join() === ['e'.repeat(12), 'd'.repeat(12)].join() && !x.left.length && /옛 노트북/.test(x.text) && /「거실 PC」 연결을 끊었습니다/.test(x.text) && /「다시 시작」을 누르면/.test(x.text) && !/끊지 못했습니다/.test(x.text) && x.focus === 'google', JSON.stringify({ rv, left: x.left, focus: x.focus }));
    check('쪽 오류 없음(기기가 다 참)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 9. Google 동의 화면의 Drive 칸을 켜지 않아 DENIED — 알림과 상자로 그 칸을 켜라고 쓰고, 다시 누르면 상자를 비운다
  {
    const { pg, ctx, errors } = await scenario('denied');
    await click(pg, '#room [data-act="google"]');
    let x = await pg.evaluate(() => ({ box: document.querySelector('#room .box')?.innerText || '', note: document.getElementById('note')?.textContent || '' }));
    check('DENIED 뒤 알림과 상자가 Google Drive가 적힌 칸을 켜라고 쓴다', /Google Drive가 적힌 칸은 꺼진 채로 나옵니다\. 그 칸을 켜지 않고 넘어가면/.test(x.box) && /「계속」까지 눌러 주세요\. Google Drive가 적힌 칸이 나오면 켜 주세요/.test(x.note), JSON.stringify(x));
    await click(pg, '#room [data-act="google"]');
    x = await pg.evaluate(() => ({ n: window.__calls.filter((c) => c === 'signInGoogle').length, box: document.querySelector('#room .box')?.innerText || '', on: document.getElementById('note').classList.contains('on'), note: document.getElementById('note')?.textContent || '' }));
    check('다시 누르면 signInGoogle을 다시 부르고, 기다리는 동안 거절 상자와 거절 알림을 걷는다(카본 A1)', x.n === 2 && !/허락을 받지 못했습니다/.test(x.box) && !(x.on && /허락을 받지 못/.test(x.note)), JSON.stringify(x));
    await pg.evaluate(() => window.__finishSignIn?.()); await pg.waitForTimeout(150);
    x = await pg.evaluate(() => ({ box: document.querySelector('#room .box')?.innerText || '', note: document.getElementById('note')?.textContent || '' }));
    check('두 번째가 DENIED가 아니면(REAUTH) 거절 상자가 다시 나오지 않는다(카본 A4)', !/허락을 받지 못했습니다/.test(x.box) && /Google 로그인을 마치지 않았습니다/.test(x.note), JSON.stringify(x));
    check('쪽 오류 없음(Drive 칸)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 10. 솔리오 잇기 — 설정 서랍의 쉬는 Wi-Fi · AI 도구
  {
    const { pg, ctx, errors } = await scenario('settings');
    await click(pg, '[data-act="drawer"]');
    let x = await pg.evaluate(() => ({ rest: !!document.querySelector('#drawer-panel [data-act="rest-net"]'), ai: !!document.querySelector('#drawer-panel [data-act="ai-tools"]') }));
    check('설정 서랍에 「쉬는 Wi-Fi」와 「AI 도구」 줄이 있다', x.rest && x.ai, JSON.stringify(x));
    await click(pg, '#drawer-panel [data-act="rest-net"]');
    x = await pg.evaluate(() => ({ screen: document.getElementById('stage').dataset.screen, text: document.getElementById('room').innerText, calls: window.__calls.slice() }));
    check('「고르기」로 쉬는 Wi-Fi 화면이 열리면 wifiName(E30)을 한 번 불러 지금 Wi-Fi를 보인다', x.screen === 'rest-net' && x.calls.filter((c) => c === 'wifiName').length === 1 && /지금 이어진 Wi-Fi는 「집 Wi-Fi」입니다/.test(x.text) && /아직 고른 Wi-Fi가 없습니다/.test(x.text), JSON.stringify(x).slice(0, 300));
    await pg.fill('#rest-in', '  휴대폰 핫스팟 '); await pg.press('#rest-in', 'Enter'); await pg.waitForTimeout(600);
    x = await pg.evaluate(() => ({ args: window.__args.filter((a) => a.method === 'setRestNetworks').map((a) => a.input), val: document.getElementById('rest-in')?.value, text: document.getElementById('room').innerText, note: document.getElementById('note').textContent, focus: document.activeElement?.id }));
    check('Enter로 더하면 앞뒤 빈칸을 뗀 이름으로 setRestNetworks를 부르고, 칸을 비우고 포커스를 칸에 둔다', JSON.stringify(x.args) === JSON.stringify([['휴대폰 핫스팟']]) && x.val === '' && /휴대폰 핫스팟/.test(x.text) && /에 이어져 있는 동안 매시간 백업을 쉽니다/.test(x.note) && x.focus === 'rest-in', JSON.stringify(x));
    await pg.fill('#rest-in', '가'.repeat(11)); await click(pg, '#room [data-act="rest-add"]');
    x = await pg.evaluate(() => ({ n: window.__args.filter((a) => a.method === 'setRestNetworks').length, note: document.getElementById('note').textContent, val: document.getElementById('rest-in')?.value }));
    check('UTF-8로 32바이트가 넘는 이름은 보내지 않고 까닭을 쓰며, 적은 글은 남긴다', x.n === 1 && /너무 깁니다/.test(x.note) && x.val === '가'.repeat(11), JSON.stringify(x));
    // Opus 대체 검수 F4 — 지금 Wi-Fi와 대소문자만 다른 이름은 읽은 이름으로 더한다
    await pg.fill('#rest-in', '집 wi-fi'); await pg.press('#rest-in', 'Enter'); await pg.waitForTimeout(600);
    x = await pg.evaluate(() => ({ args: window.__args.filter((a) => a.method === 'setRestNetworks').map((a) => a.input), note: document.getElementById('note').textContent }));
    check('지금 Wi-Fi와 대소문자만 다르게 적은 이름은 읽은 이름 그대로 더하고 그렇다고 알린다', JSON.stringify(x.args[1]) === JSON.stringify(['휴대폰 핫스팟', '집 Wi-Fi']) && /대소문자를 지금 이어진 Wi-Fi 이름에 맞춰 「집 Wi-Fi」 그대로 더했습니다/.test(x.note), JSON.stringify(x));
    // Opus 대체 검수 F5 — 키보드로 누른 「빼기」가 사라지면 포커스를 남은 줄의 「빼기」로 옮긴다
    await pg.focus('#room [data-act="rest-drop"][data-name="집 Wi-Fi"]'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(700);
    x = await pg.evaluate(() => ({ args: window.__args.filter((a) => a.method === 'setRestNetworks').map((a) => a.input), focus: document.activeElement?.dataset?.name || document.activeElement?.id || document.activeElement?.tagName }));
    check('「빼기」는 그 이름을 뺀 목록으로 부르고, 포커스를 남은 줄의 「빼기」로 옮긴다', JSON.stringify(x.args[2]) === JSON.stringify(['휴대폰 핫스팟']) && x.focus === '휴대폰 핫스팟', JSON.stringify(x));
    await pg.focus('#room [data-act="rest-here"]'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(700);
    x = await pg.evaluate(() => ({ args: window.__args.filter((a) => a.method === 'setRestNetworks').map((a) => a.input), text: document.getElementById('room').innerText, focus: document.activeElement?.id || '' }));
    check('「이 Wi-Fi에서 쉬기」는 지금 Wi-Fi 이름을 그대로 더하고 「이미 고른 Wi-Fi」로 바뀌며, 포커스를 이름 칸으로 옮긴다', JSON.stringify(x.args[3]) === JSON.stringify(['휴대폰 핫스팟', '집 Wi-Fi']) && /「집 Wi-Fi」에서는 매시간 백업을 쉽니다\. 이미 고른 Wi-Fi입니다/.test(x.text) && x.focus === 'rest-in', JSON.stringify(x).slice(0, 300));
    // Opus 대체 검수 F3 — 한글을 조합하는 동안 상태가 바뀌어도 칸을 갈아 끼우지 않고, 조합이 끝나면 다시 그리며 적던 글과 포커스를 지킨다
    x = await pg.evaluate(async () => {
      const el = document.getElementById('rest-in'); el.focus(); el.__mark = 1;
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      el.value = '하'; el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
      window.__setRest(['휴대폰 핫스팟', '집 Wi-Fi', '새 망']);
      await new Promise((r) => setTimeout(r, 300));
      const during = { same: document.getElementById('rest-in')?.__mark === 1, listed: /새 망/.test(document.getElementById('room').innerText) };
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '하' }));
      await new Promise((r) => setTimeout(r, 300));
      return { during, listed: /새 망/.test(document.getElementById('room').innerText), value: document.getElementById('rest-in')?.value, focus: document.activeElement?.id || '' };
    });
    check('한글을 조합하는 동안에는 칸을 갈아 끼우지 않고, 조합이 끝나면 다시 그리며 적던 글과 포커스를 지킨다', x.during.same && !x.during.listed && x.listed && x.value === '하' && x.focus === 'rest-in', JSON.stringify(x));
    await click(pg, '#room [data-act="drawer"]'); await click(pg, '#drawer-panel [data-act="ai-tools"]');
    x = await pg.evaluate(() => ({ screen: document.getElementById('stage').dataset.screen, text: document.getElementById('room').innerText, calls: window.__calls.slice() }));
    check('「AI 도구」 화면이 열리면 aiToolsState로 이어 온 도구를 다시 읽어 이름과 띄운 프로그램을 보인다', x.screen === 'ai-tools' && x.calls.includes('aiToolsState') && /claude-code/.test(x.text) && /claude\.exe/.test(x.text), JSON.stringify(x).slice(0, 300));
    await click(pg, '#room [data-act="ai-tool"][data-tool="find_restorable"]');
    x = await pg.evaluate(() => ({ args: window.__args.filter((a) => a.method === 'setAiTools').map((a) => a.input), label: document.querySelector('#room [data-tool="find_restorable"]')?.textContent, focus: document.activeElement?.dataset?.tool || '' }));
    check('「켜기」는 그 도구 하나만 setAiTools로 켜고, 단추가 「끄기」가 되며 포커스가 그 단추에 남는다', JSON.stringify(x.args) === JSON.stringify([{ tools: { find_restorable: true } }]) && x.label === '끄기' && x.focus === 'find_restorable', JSON.stringify(x));
    await pg.fill('#mask-in', '건강'); await pg.press('#mask-in', 'Enter'); await pg.waitForTimeout(600);
    x = await pg.evaluate(() => ({ args: window.__args.filter((a) => a.method === 'setAiTools').map((a) => a.input), text: document.getElementById('room').innerText, val: document.getElementById('mask-in')?.value }));
    check('가리는 낱말은 도구를 바꾸지 않고(tools 빈 칸) masks에 더하고 칸을 비운다', JSON.stringify(x.args[1]) === JSON.stringify({ tools: {}, masks: ['건강'] }) && /건강/.test(x.text) && x.val === '', JSON.stringify(x.args));
    check('쪽 오류 없음(쉬는 Wi-Fi · AI 도구)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 10b. 공간 비우기 2판(SPACE_DESIGN.md 12.5) — 시험 표식이 있는 PC에서만 열린다. 켜기와 정한 선은 이 창에서만
  {
    const { pg, ctx, errors } = await scenario('settings');
    const { STATES: S } = await import(pathToFileURL(path.join(APP, 'ui/engine-fixtures.js')).href);
    const look = () => pg.evaluate(() => ({ screen: document.getElementById('stage').dataset.screen, text: document.getElementById('room').innerText, calls: window.__calls.slice(), note: document.getElementById('note').textContent,
      drawerRow: !!document.querySelector('#drawer-panel [data-act="space-free"]') }));
    await click(pg, '[data-act="drawer"]');
    let x = await look();
    check('시험 표식이 없는 PC에는 설정 서랍에 「공간 비우기」 줄이 없다', !x.drawerRow, JSON.stringify(x.drawerRow));
    await pg.evaluate(() => window.__open('space')); await pg.waitForTimeout(500);
    x = await look();
    check('표식이 없으면 알림 주제 space는 기본 화면으로 온다', x.screen === 'home', x.screen);
    await pg.evaluate((sf) => window.__setSpace(sf), S['home-solio'].solio.spaceFree); await pg.waitForTimeout(400);
    await click(pg, '[data-act="drawer"]');
    x = await look();
    check('표식이 있으면 설정 서랍에 「공간 비우기」 줄이 생긴다', x.drawerRow, '');
    await click(pg, '#drawer-panel [data-act="space-free"]');
    x = await look();
    check('「열기」로 공간 비우기 화면이 열리면 spaceFreeState로 지난 누름을 다시 읽고, 켜기 전이라 「켜면 비울 것」과 경로를 보인다',
      x.screen === 'space-free' && x.calls.includes('spaceFreeState') && /켜면 비울 것/.test(x.text) && /landing-2025/.test(x.text) && /Windows 임시 파일/.test(x.text) && /비우지 않는 것/.test(x.text), JSON.stringify(x).slice(0, 400));
    await click(pg, '#room [data-act="press-on"]');
    x = await pg.evaluate(() => ({ args: window.__args.filter((a) => a.method === 'setPressFree').map((a) => a.input), text: document.getElementById('room').innerText, note: document.getElementById('note').textContent, off: !!document.querySelector('#room [data-act="press-off"]') }));
    check('「누를 때 비우기 켜기」는 setPressFree(true)를 부르고, 화면이 「원클릭을 누르면」과 「끄기」로 바뀐다', JSON.stringify(x.args) === JSON.stringify([true]) && /원클릭을 누르면/.test(x.text) && x.off && /켰습니다/.test(x.note), JSON.stringify(x).slice(0, 300));
    await pg.fill('#line-C', '450'); await click(pg, '#room [data-act="line-save"][data-drive="C"]');
    x = await pg.evaluate(() => ({ args: window.__args.filter((a) => a.method === 'setStartLine').map((a) => a.input), note: document.getElementById('note').textContent }));
    check('정한 선 「바꾸기」는 그 드라이브와 GB 숫자로 setStartLine을 부른다', JSON.stringify(x.args) === JSON.stringify([{ drive: 'C', gb: 450 }]) && /450GB로 바꿨습니다/.test(x.note), JSON.stringify(x));
    await pg.fill('#line-D', '12.5'); await click(pg, '#room [data-act="line-save"][data-drive="D"]');
    x = await pg.evaluate(() => ({ n: window.__args.filter((a) => a.method === 'setStartLine').length, note: document.getElementById('note').textContent }));
    check('정수가 아닌 선은 보내지 않고 까닭을 쓴다', x.n === 1 && /1 이상의 GB 숫자/.test(x.note), JSON.stringify(x));
    await click(pg, '#room [data-act="press-off"]');
    x = await pg.evaluate(() => ({ args: window.__args.filter((a) => a.method === 'setPressFree').map((a) => a.input), on: !!document.querySelector('#room [data-act="press-on"]') }));
    check('「끄기」는 setPressFree(false)를 부르고 켜기 단추로 돌아간다', JSON.stringify(x.args) === JSON.stringify([true, false]) && x.on, JSON.stringify(x));
    await click(pg, '#room [data-act="home"]').catch(() => {});
    await pg.evaluate(() => window.__open('space')); await pg.waitForTimeout(500);
    x = await look();
    check('표식이 있으면 알림 주제 space(솔리오의 「엔진 창에서 켜기」)는 이 화면으로 온다', x.screen === 'space-free', x.screen);
    check('쪽 오류 없음(공간 비우기)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 11. 솔리오가 넘긴 처음 시작(state.solio.setup) — 「Google로 시작」을 누르지 않아도 hint를 실어 로그인을 연다. 같은 요청은 한 번만
  {
    const { pg, ctx, errors } = await scenario('solio');
    let x = await pg.evaluate(() => ({ args: window.__args.filter((a) => a.method === 'signInGoogle').map((a) => a.input), text: document.getElementById('room').innerText }));
    check('솔리오의 「보호 시작」으로 온 창은 누르지 않아도 hint를 실어 signInGoogle을 부르고, 브라우저가 열린 까닭을 쓴다', JSON.stringify(x.args) === JSON.stringify([{ hint: 'studio@example.com' }]) && /솔리오에서 「보호 시작」을 눌러 Google 로그인을 바로 열었습니다/.test(x.text), JSON.stringify(x).slice(0, 400));
    await pg.evaluate(() => window.__resetup()); await pg.waitForTimeout(300);
    await pg.evaluate(() => window.__finishSignIn?.()); await pg.waitForTimeout(300);
    await pg.evaluate(() => window.__resetup()); await pg.waitForTimeout(300);
    x = await pg.evaluate(() => ({ n: window.__calls.filter((c) => c === 'signInGoogle').length, text: document.getElementById('room').innerText }));
    check('같은 요청(at)이 다시 와도 로그인을 다시 열지 않고, 마치지 않으면 「Google로 시작」으로 남는다', x.n === 1 && /Google로 시작/.test(x.text) && !/솔리오에서/.test(x.text), JSON.stringify(x).slice(0, 300));
    await pg.evaluate(() => window.__resetup('2026-11-17T04:10:00.000Z')); await pg.waitForTimeout(300);
    x = await pg.evaluate(() => ({ n: window.__calls.filter((c) => c === 'signInGoogle').length }));
    check('새 요청(다른 at)은 다시 연다', x.n === 2, JSON.stringify(x));
    await pg.evaluate(() => window.__finishSignIn?.()); await pg.waitForTimeout(200);
    check('쪽 오류 없음(솔리오 처음 시작)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  {
    const { pg, ctx, errors } = await scenario('solio-move');
    const x = await pg.evaluate(() => ({ calls: window.__calls.slice(), args: window.__args.filter((a) => a.method === 'signInGoogle').map((a) => a.input) }));
    const i = x.calls.indexOf('signInGoogle'), j = x.calls.indexOf('openAccountBackup');
    check('솔리오의 「이 PC로 옮겨 오기」로 온 창은 로그인 뒤, 다른 PC가 백업하는 계정이면 계정의 백업을 열어 옮겨 오기로 간다(hint가 없으면 빈 입력)', i >= 0 && j > i && JSON.stringify(x.args) === '[{}]', JSON.stringify(x));
    check('쪽 오류 없음(솔리오 옮겨 오기)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 12. 옮겨 온 백업을 되살리기만 하는 PC로 온 솔리오의 「보호 시작」 — 말없이 버리지 않고 까닭을 상자로(Opus 대체 검수 F2)
  {
    const { pg, ctx, errors } = await scenario('solio-restore');
    const x = await pg.evaluate(() => ({ n: window.__calls.filter((c) => c === 'signInGoogle').length, box: [...document.querySelectorAll('#room .box')].map((b) => b.innerText).join(' | '), screen: document.getElementById('stage').dataset.screen,
      buttons: [...document.querySelectorAll('#room [data-act]')].map((b) => b.textContent.trim()) }));
    // 상자가 누르라는 단추는 그 화면에 실제로 있는 단추다(옮겨 오기 상태를 읽으면 「옮겨 오기 끝」 화면의 단추가 된다)
    const named = (x.box.match(/아래 「([^」]+)」/) || [])[1];
    check('되살리기만 하는 PC로 온 「보호 시작」은 로그인을 열지 않고 기본 화면에 까닭과 다음 걸음을 상자로 쓴다', x.n === 0 && x.screen === 'home' && /솔리오의 「보호 시작」을 여기서 바로 잇지 못했습니다/.test(x.box) && !!named && x.buttons.some((b) => b.startsWith(named)), JSON.stringify(x));
    await pg.evaluate(() => window.__handover()); await pg.waitForTimeout(500);
    const y = await pg.evaluate(() => ({ box: [...document.querySelectorAll('#room .box')].map((b) => b.innerText).join(' | ') }));
    check('이어서 백업해 백업하는 PC가 되면 그 상자를 걷는다(Opus 대체 다시 검수 -b)', !/여기서 바로 잇지 못했습니다/.test(y.box), JSON.stringify(y));
    check('쪽 오류 없음(솔리오 · 되살리기만 하는 PC)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 8. 도는 되살리기 그만두기(요청 16) — 「되살리기 그만두기」 → cancelRestore → 그만두는 중 → 그만둔 뒤의 한 줄
  {
    const { pg, ctx, errors } = await scenario('stop');
    let x = await pg.evaluate(() => ({ text: document.getElementById('room').innerText, stop: !!document.querySelector('#room [data-act="restore-stop"]') }));
    check('도는 되살리기에는 「되살리기 그만두기」가 있다', x.stop && /파일을 되살리고 있습니다/.test(x.text), x.text.slice(0, 120));
    await click(pg, '#room [data-act="restore-stop"]');
    await pg.waitForFunction(() => /되살리기를 그만두는 중입니다/.test(document.getElementById('room').innerText), null, { timeout: 5000 }).catch(() => {});
    x = await pg.evaluate(() => ({ text: document.getElementById('room').innerText, note: document.getElementById('note')?.textContent || '', stop: !!document.querySelector('#room [data-act="restore-stop"]'), n: window.__calls.filter((c) => c === 'cancelRestore').length }));
    check('「되살리기 그만두기」는 cancelRestore를 한 번 부르고, 그만두는 중으로 바뀌며 단추를 거둔다', x.n === 1 && /그만두는 중입니다/.test(x.note) && /되살리기를 그만두는 중입니다/.test(x.text) && !x.stop, JSON.stringify({ n: x.n, note: x.note }));
    await pg.evaluate(() => window.__finishStop?.());
    await pg.waitForFunction(() => /전체 되살리기를 그만두었습니다/.test(document.getElementById('room').innerText), null, { timeout: 5000 }).catch(() => {});
    x = await pg.evaluate(() => ({ text: document.getElementById('room').innerText }));
    check('그만둔 뒤 기본 화면에 그만두었다는 한 줄과 만들다 만 폴더 이름이 남는다', /전체 되살리기를 그만두었습니다/.test(x.text) && /「되살린 파일 \(11월 13일\)」은 그대로 두었습니다/.test(x.text), x.text.slice(0, 200));
    // E29 — 그 줄의 「만들다 만 폴더 열기」는 openRestoreFolder({ unfinished: true })
    await click(pg, '#room [data-act="open-left"]');
    const ol = await pg.evaluate(() => window.__args.filter((a) => a.method === 'openRestoreFolder').map((a) => a.input));
    check('「만들다 만 폴더 열기」는 openRestoreFolder에 unfinished를 실어 부른다', ol.length === 1 && ol[0] && ol[0].unfinished === true, JSON.stringify(ol));
    check('쪽 오류 없음(되살리기 그만두기)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  {
    const { pg, ctx, errors } = await scenario('stopdone');
    await click(pg, '#room [data-act="restore-stop"]');
    await pg.waitForFunction(() => /이미 끝났습니다/.test(document.getElementById('note')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    const x = await pg.evaluate(() => ({ note: document.getElementById('note')?.textContent || '', stop: !!document.querySelector('#room [data-act="restore-stop"]') }));
    check('그 사이 끝난 되살리기는(stopping: false) 상태를 다시 읽어 「이미 끝났습니다」로 쓰고 단추를 거둔다', /되살리기가 이미 끝났습니다/.test(x.note) && !x.stop, JSON.stringify(x));
    check('쪽 오류 없음(그 사이 끝난 되살리기)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  // 13. 한꺼번에 지워짐(설계 4.4 — 엔진 massHold, 조율 세션 9ddcbeb40) — 기본 자리로 되살리기와 「확인을 마침」은 상자로 한 번 더 묻는다
  {
    const { pg, ctx, errors } = await scenario('mass');
    const lastArgs = (m) => pg.evaluate((m) => window.__args.filter((a) => a.method === m).map((a) => a.input), m);
    const look = () => pg.evaluate(() => ({ screen: document.getElementById('stage').dataset.screen, text: document.getElementById('room').innerText, note: document.getElementById('note')?.textContent || '',
      box: [...document.querySelectorAll('#room .box')].map((b) => b.innerText).join(' | '), focus: document.activeElement?.dataset?.act || '', live: document.getElementById('live').textContent,
      acts: [...document.querySelectorAll('#room [data-act]')].map((b) => b.dataset.act) }));
    let x = await look();
    check('멈춤이 있으면 기본 화면이 「많은 파일이 한꺼번에 지워졌습니다」와 두 단추, 목록 보기, 놓을 자리 바꾸기를 보인다', /많은 파일이 한꺼번에 지워졌습니다/.test(x.text) && ['mass-restore', 'mass-ok', 'mass-list', 'place-pick'].every((a) => x.acts.includes(a)), JSON.stringify(x.acts));
    await click(pg, '#room [data-act="mass-restore"]');
    x = await look();
    check('「지워지기 전으로 되살리기」는 기본 자리면 부르지 않고 범위와 자리를 상자로 묻는다(포커스는 「되살리기 시작」, 읽어 주는 칸에 상자 글)', !(await lastArgs('restoreMassBefore')).length && /바뀐 폴더 2곳을 지워지기 전 판으로 되살릴까요\?/.test(x.box) && x.focus === 'mass-restore-go' && /되살릴까요/.test(x.live), JSON.stringify({ box: x.box, focus: x.focus, live: x.live }));
    await click(pg, '#room [data-act="mass-no"]');
    x = await look();
    check('「그만두기」는 상자를 닫고 포커스를 「지워지기 전으로 되살리기」로 돌린다', !x.box && x.focus === 'mass-restore', JSON.stringify({ box: x.box, focus: x.focus }));
    await click(pg, '#room [data-act="mass-restore"]'); await click(pg, '#room [data-act="mass-restore-go"]');
    let a = await lastArgs('restoreMassBefore'); x = await look();
    check('「되살리기 시작」은 restoreMassBefore({ place: default })를 한 번 부르고 기본 화면에서 진행을 본다', a.length === 1 && JSON.stringify(a[0]) === '{"place":"default"}' && x.screen === 'home' && /파일을 되살리고 있습니다/.test(x.text), JSON.stringify(a));
    await pg.evaluate(() => window.__massDone()); await pg.waitForTimeout(600);
    x = await look();
    check('되살린 뒤에는 그 판에서 되살렸다는 줄과 「되살린 폴더 열기」, 주 단추 「확인을 마침」을 보인다', /판에서 바뀐 폴더를 「되살린 파일 \(\d+월 \d+일\)」에 통째로 되살렸습니다/.test(x.text) && x.acts.includes('open-full') && x.acts.includes('mass-done') && !x.acts.includes('mass-ok'), JSON.stringify(x.acts));
    await click(pg, '#room [data-act="mass-done"]');
    x = await look();
    check('「확인을 마침」도 상자로 한 번 더 묻는다(이전 판을 다시 정리한다는 글, 포커스는 「확인을 마침」)', /확인을 마치면 이전 판을 다시 정리합니다/.test(x.box) && x.focus === 'mass-ok-go' && !(await pg.evaluate(() => window.__calls.includes('massConfirm'))), JSON.stringify({ box: x.box, focus: x.focus }));
    await click(pg, '#room [data-act="mass-ok-go"]');
    x = await look();
    const n = await pg.evaluate(() => window.__calls.filter((c) => c === 'massConfirm').length);
    check('상자의 「확인을 마침」은 massConfirm을 한 번 부르고, 알림을 남긴 뒤 멈춤이 없는 기본 화면이 된다', n === 1 && /확인을 마쳤습니다/.test(x.note) && !/한꺼번에/.test(x.text) && x.screen === 'home', JSON.stringify({ n, note: x.note }));
    check('쪽 오류 없음(한꺼번에 지워짐 · 되살린 뒤 확인을 마침)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  {
    const { pg, ctx, errors } = await scenario('mass');
    const look = () => pg.evaluate(() => ({ screen: document.getElementById('stage').dataset.screen, box: [...document.querySelectorAll('#room .box')].map((b) => b.innerText).join(' | '), focus: document.activeElement,
      items: document.querySelectorAll('#room .files .fl').length, ones: [...document.querySelectorAll('#room [data-act="mass-one"]')].map((b) => b.dataset.path) }));
    await click(pg, '#room [data-act="mass-list"]');
    let x = await look();
    check('「지워지거나 바뀐 파일 … 보기」는 목록 화면을 열고 이름 500개와 바뀐 폴더마다의 「이 폴더만 되살리기」를 보인다', x.screen === 'mass-list' && x.items === 500 && x.ones.length === 2, JSON.stringify({ screen: x.screen, items: x.items, ones: x.ones }));
    const pics = '#room [data-act="mass-one"][data-path$="Pictures"]';
    await click(pg, pics);
    x = await pg.evaluate(() => ({ box: [...document.querySelectorAll('#room .box')].map((b) => b.innerText).join(' | '), focus: document.activeElement?.dataset?.act || '' }));
    check('「이 폴더만 되살리기」는 그 폴더 이름으로 한 번 더 묻는다', /「사진」 폴더를 지워지기 전 판으로 되살릴까요\?/.test(x.box) && x.focus === 'mass-restore-go', JSON.stringify(x));
    await click(pg, '#room [data-act="mass-no"]');
    x = await pg.evaluate(() => ({ act: document.activeElement?.dataset?.act || '', path: document.activeElement?.dataset?.path || '' }));
    check('그만두면 포커스가 그 폴더의 단추로 돌아온다', x.act === 'mass-one' && /Pictures$/.test(x.path), JSON.stringify(x));
    await click(pg, pics); await click(pg, '#room [data-act="mass-restore-go"]');
    const a = await pg.evaluate(() => window.__args.filter((c) => c.method === 'restoreMassBefore').map((c) => c.input));
    const s = await pg.evaluate(() => document.getElementById('stage').dataset.screen);
    check('그 폴더만 restoreMassBefore({ place, folder })로 받고 기본 화면으로 간다', a.length === 1 && a[0].place === 'default' && /Pictures$/.test(a[0].folder) && Object.keys(a[0]).length === 2 && s === 'home', JSON.stringify(a));
    // Opus 대체 검수 FA1 — 엔진 결과에 범위가 없어도 이 창이 보낸 한 폴더로 가려, 「확인을 마침」을 앞세우지 않는다
    await pg.evaluate(() => window.__massDone()); await pg.waitForTimeout(600);
    const y = await pg.evaluate(() => ({ text: document.getElementById('room').innerText, main: document.querySelector('#room .pill.main')?.dataset.act || '' }));
    check('한 폴더만 받은 뒤에는 받은 폴더와 남은 폴더를 말하고 「지워지기 전으로 되살리기」를 주 단추로 둔다', y.main === 'mass-restore' && /아직 「문서」 폴더는 되살리지 않았습니다/.test(y.text) && /「사진」 폴더를 「되살린 파일/.test(y.text), JSON.stringify({ main: y.main }));
    // 다시 검수 -b 2 — 남은 「문서」도 받으면 바뀐 폴더를 다 받은 것이라 「확인을 마침」이 주 단추가 된다
    await click(pg, '#room [data-act="mass-list"]'); await click(pg, '#room [data-act="mass-one"][data-path$="Documents"]'); await click(pg, '#room [data-act="mass-restore-go"]');
    await pg.evaluate(() => window.__massDone()); await pg.waitForTimeout(600);
    const y2 = await pg.evaluate(() => ({ main: document.querySelector('#room .pill.main')?.dataset.act || '', n: window.__args.filter((c) => c.method === 'restoreMassBefore').length }));
    check('바뀐 폴더를 하나씩 다 받으면 「확인을 마침」이 주 단추가 된다', y2.main === 'mass-done' && y2.n === 2, JSON.stringify(y2));
    check('쪽 오류 없음(지워진 파일 목록)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  {
    const { pg, ctx, errors } = await scenario('mass');
    // 놓을 자리를 고르기로 바꾸면 상자 없이 바로 부른다(고르는 창이 묻는다)
    await click(pg, '#room [data-act="place-pick"]');
    let x = await pg.evaluate(() => ({ text: document.getElementById('room').innerText, acts: [...document.querySelectorAll('#room [data-act]')].map((b) => b.dataset.act) }));
    check('「자리 바꾸기」 뒤에는 고르는 창이 뜬다고 쓰고 「다운로드에 놓기」를 둔다', /누르면 놓을 폴더를 고르는 창이 뜹니다/.test(x.text) && x.acts.includes('place-default'), JSON.stringify(x.acts));
    await click(pg, '#room [data-act="mass-restore"]');
    let a = await pg.evaluate(() => window.__args.filter((c) => c.method === 'restoreMassBefore').map((c) => c.input));
    check('고르는 자리면 「지워지기 전으로 되살리기」가 상자 없이 restoreMassBefore({ place: pick })를 부른다', a.length === 1 && JSON.stringify(a[0]) === '{"place":"pick"}', JSON.stringify(a));
    await ctx.close();
    const two = await scenario('mass');
    // 다운로드가 지키는 폴더와 겹치면(OUTPUT_UNSAFE) 고르기로 바꾸고 상자를 닫는다. 그사이 멈춤이 풀렸으면(NOT_FOUND) 알리고 기본 화면을 다시 읽는다
    await two.pg.evaluate(() => { window.__massUnsafe = true; });
    await click(two.pg, '#room [data-act="mass-restore"]'); await click(two.pg, '#room [data-act="mass-restore-go"]');
    x = await two.pg.evaluate(() => ({ note: document.getElementById('note')?.textContent || '', box: document.querySelectorAll('#room .box').length, text: document.getElementById('room').innerText }));
    check('기본 자리가 거절되면(OUTPUT_UNSAFE) 고르기로 바꾸고 상자를 닫는다', /놓을 자리를 고르도록 바꿨으니/.test(x.note) && !x.box && /누르면 놓을 폴더를 고르는 창이 뜹니다/.test(x.text), JSON.stringify({ note: x.note, box: x.box }));
    await two.pg.evaluate(() => { window.__massGone = true; });
    await click(two.pg, '#room [data-act="mass-restore"]');
    x = await two.pg.evaluate(() => ({ note: document.getElementById('note')?.textContent || '', text: document.getElementById('room').innerText }));
    check('그사이 멈춤이 풀렸으면(NOT_FOUND) 그렇다고 알리고 기본 화면을 다시 읽는다', /붙들어 둔 판이 이제 없습니다/.test(x.note) && !/한꺼번에/.test(x.text), JSON.stringify({ note: x.note }));
    check('쪽 오류 없음(놓을 자리 · 거절)', !errors.length && !two.errors.length, [...errors, ...two.errors].join(' | '));
    await two.ctx.close();
    const three = await scenario('mass');
    await click(three.pg, '#room [data-act="mass-list"]');
    await three.pg.evaluate(() => window.__massLift()); await three.pg.waitForTimeout(600);
    const sc = await three.pg.evaluate(() => document.getElementById('stage').dataset.screen);
    check('목록 화면에 있는 동안 멈춤이 풀리면 기본 화면으로 돌아간다', sc === 'home', sc);
    // 카본 A5 — 그 뒤 새 멈춤이 생겨도 목록 화면이 저절로 열리지 않는다
    await three.pg.evaluate(() => window.__massBack()); await three.pg.waitForTimeout(600);
    const sc2 = await three.pg.evaluate(() => ({ screen: document.getElementById('stage').dataset.screen, mass: /한꺼번에/.test(document.getElementById('room').innerText) }));
    check('그 뒤 새 멈춤이 생기면 기본 화면에 멈춤을 그리고, 목록 화면으로 저절로 가지 않는다', sc2.screen === 'home' && sc2.mass, JSON.stringify(sc2));
    await three.ctx.close();
    const four = await scenario('mass');
    await click(four.pg, '#room [data-act="mass-ok"]');
    const open = await four.pg.evaluate(() => document.querySelectorAll('#room .box').length);
    await four.pg.evaluate(() => window.__massJob(true)); await four.pg.waitForTimeout(500);
    await four.pg.evaluate(() => window.__massJob(false)); await four.pg.waitForTimeout(500);
    const after = await four.pg.evaluate(() => document.querySelectorAll('#room .box').length);
    check('한 번 더 묻던 상자는 백업이 도는 사이 닫히고, 끝난 뒤 저절로 다시 뜨지 않는다', open === 1 && after === 0, JSON.stringify({ open, after }));
    check('쪽 오류 없음(목록 · 묵은 물음)', !three.errors.length && !four.errors.length, [...three.errors, ...four.errors].join(' | '));
    await four.ctx.close();
    // Opus 대체 검수 FA2 — 목록 화면에 있는 동안 백업이 돌면 멈춤 단추를 막고 까닭을 쓴다
    const five = await scenario('mass');
    await click(five.pg, '#room [data-act="mass-list"]');
    await five.pg.evaluate(() => window.__massJob(true)); await five.pg.waitForTimeout(500);
    await five.pg.click('#room [data-act="mass-restore"]', { force: true }).catch(() => {}); await five.pg.waitForTimeout(400);
    const z = await five.pg.evaluate(() => ({ text: document.getElementById('room').innerText, off: document.querySelectorAll('#room [data-act^="mass-"][aria-disabled="true"]').length, box: document.querySelectorAll('#room .box').length, n: window.__calls.filter((c) => c === 'restoreMassBefore').length }));
    check('목록 화면에 있는 동안 백업이 돌면 멈춤 단추를 막고 「지금 다른 일이 도는 중입니다」를 쓴다', /지금 다른 일이 도는 중입니다/.test(z.text) && z.off >= 4 && !z.box && z.n === 0, JSON.stringify({ off: z.off, box: z.box, n: z.n }));
    check('쪽 오류 없음(목록 · 도는 백업)', !five.errors.length, five.errors.join(' | '));
    await five.ctx.close();
  }
  // 14. 이 백업에 담지 못하는 이름(설계 4.2 — 엔진 leftOutNames, 조율 세션 부탁 · GPT 검수 workbackup-oddnames-20261120 GA1)
  {
    const { pg, ctx, errors } = await scenario('leftout');
    const look = () => pg.evaluate(() => ({ screen: document.getElementById('stage').dataset.screen, text: document.getElementById('room').innerText,
      acts: [...document.querySelectorAll('#room [data-act]')].map((b) => b.dataset.act), items: [...document.querySelectorAll('#room .files .fl .nm')].map((n) => n.textContent) }));
    let x = await look();
    check('담지 못한 이름이 있으면 기본 화면이 「안전합니다」 대신 주의와 이름 둘, 「외 1개」, 쓰는 중인 파일 줄과 고리 둘을 보인다',
      /이름 때문에 담지 못한 파일이 있습니다/.test(x.text) && !/안전합니다/.test(x.text) && /「회의록 」/.test(x.text) && /외 1개/.test(x.text) && /Outlook이 쓰는 중인 파일 2개/.test(x.text) && x.acts.includes('left-out') && x.acts.includes('partial'), JSON.stringify(x.acts));
    await click(pg, '#room [data-act="left-out"]');
    x = await look();
    check('「어떤 파일인지 보기」는 목록 화면을 열고 이름 셋을 끝의 점과 빈칸이 보이게 「」로 보인다', x.screen === 'left-out' && x.items.length === 3 && x.items.includes('「회의록 」') && x.items.includes('「2026 견적서.」'), JSON.stringify({ screen: x.screen, items: x.items }));
    await click(pg, '#room [data-act="home"]');
    x = await look();
    check('「돌아가기」는 기본 화면으로 간다', x.screen === 'home', x.screen);
    // 회차 실행기의 하루 한 번 알림(주제 status)을 누르면 다른 화면에 있어도 이름이 보이는 기본 화면으로 온다
    await click(pg, '#room [data-act="restore"]');
    await pg.evaluate(() => window.__open('status')); await pg.waitForTimeout(600);
    x = await look();
    check('알림(주제 status)을 누르면 다른 화면에 있어도 이름과 고리가 보이는 기본 화면으로 온다', x.screen === 'home' && /「2026 견적서\.」/.test(x.text) && x.acts.includes('left-out'), JSON.stringify({ screen: x.screen }));
    // 목록을 보는 사이 이름을 바꿔 다음 백업에 담기면 기본 화면으로 돌아가고 「안전합니다」를 쓴다
    await click(pg, '#room [data-act="left-out"]');
    await pg.evaluate(() => window.__leftClear()); await pg.waitForTimeout(600);
    x = await look();
    check('목록을 보는 사이 담지 못한 이름이 없어지면 기본 화면으로 돌아가 주의를 거둔다', x.screen === 'home' && !/이름 때문에/.test(x.text) && !x.acts.includes('left-out'), JSON.stringify({ screen: x.screen }));
    check('쪽 오류 없음(담지 못한 이름)', !errors.length, errors.join(' | '));
    await ctx.close();
  }
  await browser.close(); server.close();
  const bad = results.filter((r) => !r.ok).length;
  console.log(bad ? `걸림 ${bad}건` : `통과 ${results.length}항목`);
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error(e.stack || e.message); process.exitCode = 2; });
