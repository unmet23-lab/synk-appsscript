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
   *  'slowfail'(넘긴 PC, 첫 moveState는 바로 실패, 둘째는 2.5초 뒤 실패, 셋째부터 성공) */
  async function scenario(start) {
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 820 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' });
    await ctx.addInitScript(({ handedHome, readState, handed, ended, result, list, checklist, start }) => {
      const calls = []; window.__calls = calls;
      let cur = start === 'read' ? readState : handedHome, failOnce = start === 'flaky', stateN = 0;
      window.__TAURI__ = { core: { invoke: async (_n, { method }) => {
        calls.push(method);
        if (method === 'getState') return { ok: true, value: cur };
        // 넘기기 전에는 옮겨 온 결과가 있는 상태, 넘긴 뒤에는 넘긴 PC의 상태(다시 로그인할 곳 7곳 남음)
        if (method === 'moveState' && failOnce) { failOnce = false; return { ok: false, error: 'x', code: 'NETWORK' }; }
        if (method === 'moveState' && start === 'slowfail' && ++stateN <= 2) {
          if (stateN === 2) await new Promise((r) => setTimeout(r, 2500));
          return { ok: false, error: 'x', code: 'NETWORK' };
        }
        if (method === 'moveState') return { ok: true, value: cur === handedHome ? handed : { ...ended, checklistLeft: 7, begun: true, reinstall: null, settings: null } };
        if (method === 'moveResult') return { ok: true, value: result };
        if (method === 'moveReinstallList') return { ok: true, value: list };
        if (method === 'moveChecklist') return { ok: true, value: checklist };
        if (method === 'moveDevices') return { ok: true, value: [{ from: handed.from, lastBackupAt: '2026-11-13T04:00:00Z' }] };
        if (method === 'devicesList') return { ok: true, value: [] };
        if (method === 'moveOpenProgramPage') return { ok: true, value: null };
        if (method === 'takeWriteSeat') { cur = handedHome; return { ok: true, value: { state: cur } }; }
        if (method === 'continueBackup') { cur = handedHome; return { ok: true, value: cur }; }
        return { ok: false, error: 'x', code: 'FIXTURE' };
      } }, event: { listen: async (n, fn) => { if (n === 'backup:state') window.__push = () => fn({ payload: { ...cur } }); return () => {}; } } };
    }, { handedHome, readState, handed: MOVE_MV.handed.state, ended: MOVE_MV.result.state, result: MOVE_MV.result.result, list: MOVE_APPS.list, checklist: MOVE_APPS.checklist, start });
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
  await browser.close(); server.close();
  const bad = results.filter((r) => !r.ok).length;
  console.log(bad ? `걸림 ${bad}건` : `통과 ${results.length}항목`);
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error(e.stack || e.message); process.exitCode = 2; });
