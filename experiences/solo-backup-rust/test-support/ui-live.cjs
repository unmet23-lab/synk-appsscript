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
   *  'stopdone'(같은 PC, 누르는 사이 되살리기가 끝나 cancelRestore가 stopping: false로 답한다) */
  async function scenario(start) {
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 820 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    await ctx.addInitScript(({ handedHome, readState, signinState, restoring, stopping, stopped, handed, ended, result, bigResult, list, checklist, start }) => {
      const calls = []; window.__calls = calls; window.__args = [];
      let cur = start === 'stop' || start === 'stopdone' ? restoring : start === 'limit' ? signinState : start === 'read' || start === 'old' ? readState : handedHome, failOnce = start === 'flaky', stateN = 0, rootN = 0;
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
        if (method === 'signInGoogle') return { ok: false, error: 'x', code: 'LIMIT_DEVICES', details: { devices: [
          { id: 'a'.repeat(12), name: '작업 노트북', role: 'write', state: 'active', sameInstall: true },
          { id: 'd'.repeat(12), name: '거실 PC', role: 'read', state: 'active', sameInstall: false },
          { id: 'e'.repeat(12), name: '옛 노트북', role: 'read', state: 'active', sameInstall: false }] } };
        // 도는 되살리기 그만두기 — 그만두는 중(job.cancelled)으로 바꾸고, 그다음 상태 읽기에서 그만둔 뒤가 된다
        if (method === 'cancelRestore' && start === 'stopdone') { cur = { ...restoring, job: null, protection: { level: 'protected', reason: null, nextAction: 'none' } }; return { ok: true, value: { stopping: false } }; }
        if (method === 'cancelRestore') { const was = cur; cur = stopping; window.__finishStop = () => { if (cur === stopping) { cur = { ...stopped, lastRestoreError: { ...stopped.lastRestoreError, at: new Date().toISOString() } }; window.__push?.(); } }; return { ok: true, value: { stopping: was === restoring } }; }
        if (method === 'revokeDevice') return args?.[0] === 'e'.repeat(12) ? { ok: false, error: 'x', code: 'NOT_FOUND' } : { ok: true, value: { suggestReadKeyRotation: true } };
        if (method === 'setFileSelection') return { ok: true, value: { profile: 'b2', token: 'tk', selection: { revision: 2, count: 1, bytes: 10 } } };
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
      } }, event: { listen: async (n, fn) => { if (n === 'backup:state') window.__push = () => fn({ payload: { ...cur } }); return () => {}; } } };
    }, { handedHome, readState, signinState: STATES['start-signin'], restoring: STATES['home-restoring'], stopping: STATES['home-restore-stopping'], stopped: STATES['home-restore-stopped'], handed: MOVE_MV.handed.state, ended: MOVE_MV.result.state, result: MOVE_MV.result.result, bigResult: MOVE_MV.toobigResult.result, list: MOVE_APPS.list, checklist: MOVE_APPS.checklist, start });
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
  await browser.close(); server.close();
  const bad = results.filter((r) => !r.ok).length;
  console.log(bad ? `걸림 ${bad}건` : `통과 ${results.length}항목`);
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error(e.stack || e.message); process.exitCode = 2; });
