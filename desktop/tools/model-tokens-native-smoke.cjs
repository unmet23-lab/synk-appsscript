'use strict';
// 모델별 토큰(2026-11-15) 화면 점검: 숨은 Electron 런처로 솔리오 → AI 구독 관리를 열고 「모델별 토큰」 칸의 네 상태
// (꺼짐 · 처음 세는 중 · 다 셈(30일 · 줄 펼침) · 끄기 확인)와 실시간 알림(11-16: 부탁 · 칸만 바뀜 · 누르는 동안 기다림 · 떠나면 그만)을 1440 · 1260 · 1100 · 960 · 390 · 320 폭, 낮과 밤으로 찍고 잰다.
// 앱 최소 폭(960~1,260)에서의 겹침도 본다(현장 노트 배포_공개 「PC 판 화면 확인을 1440 · 390만 하면 …」).
// 계정 · 구독 · 토큰 숫자는 모두 합성이다. 합성 다리는 solio-native-smoke.cjs의 것을 그대로 빌려 토큰 다리만 붙인다. 바깥 요청은 막는다.
// 사용: node desktop/tools/model-tokens-native-smoke.cjs  (출력 SYNK_TOKENS_OUT, 기본 .tmp/model-tokens-20261115/pc-shots)
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const root = path.resolve(process.env.SYNK_TOKENS_SOURCE_ROOT || path.join(__dirname, '..'));
const out = process.env.SYNK_TOKENS_OUT || path.resolve(root, '../.tmp/model-tokens-20261115/pc-shots'), prefix = 'SYNK_TOKENS_QA ';

// solio 점검의 미리 올림 다리에 토큰 다리를 붙인다. 모양이 바뀌었으면 분명히 멈춘다.
function bridgeSource() {
  const solio = fs.readFileSync(path.join(__dirname, 'solio-native-smoke.cjs'), 'utf8');
  const m = /function rendererBridge\(\)\{return String\.raw`([\s\S]*?)`;\}/.exec(solio);
  const anchor = "connectKey:denied('subs-key')})";
  if (!m || !m[1].includes(anchor)) throw Error('solio-native-smoke bridge layout changed');
  const tokens = String.raw`connectKey:denied('subs-key'),
      tokens:async()=>tok,tokensScan:async()=>tok,onTokens:cb=>{tokL.add(cb);return ()=>tokL.delete(cb);},
      tokensEnable:async on=>{tok=on?stage('scanning',0):stage('off');setTimeout(()=>{if(tok.enabled){tok=stage('ready');for(const cb of tokL)cb(tok);}},50);return tok;},
      tokensLive:async on=>{liveCalls.push(on===true);if(tok.enabled&&tok.scannedAt)tok={...tok,live:on===true};return tok;}})`;
  const store = String.raw`
  const tokL=new Set(),tday=k=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-k);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  const models=[['claude','claude-opus-5-5',2400000,380],['claude','claude-fable-5-2',610000,90],['claude','claude-sonnet-5-5',180000,140],['claude','claude-haiku-4-5-20251001',42000,300],['gpt','gpt-6-astra',920000,210],['gpt','gpt-6.1-sol',350000,60],['grok','grok-4.7-build',120000,12],['gemini','gemini-3.5-flash',9000,4],['claude','claude-opus-5-5-experimental-long-preview-name-for-width-check',1300,1]];
  const cells=[];for(let k=0;k<30;k++)for(const [s,m,o,n] of models){const w=1+Math.sin(k*1.7+m.length)*.6;if(k%9===5&&s==='grok')continue;cells.push([tday(k),s,m,Math.round(o*.004*w),Math.round(o*w/(k===0?3:1)),Math.round(o*40*w),Math.round(o*.8*w),Math.round(o*.3*w),Math.max(1,Math.round(n*w))]);}
  const tools={claude:8330,gpt:134,grok:238,gemini:2,agy:true};
  const stage=(name,done)=>name==='off'?{ok:true,enabled:false}:name==='scanning'?{ok:true,enabled:true,scanning:true,scannedAt:null,progress:{done:done??4100,total:8330},cells:[],tools}:{ok:true,enabled:true,scanning:false,progress:null,scannedAt:Date.now()-3*60e3,since:tday(29),tools,cells};
  let tok=stage('off');const liveCalls=[];`;
  // live(더할 출력): 실시간으로 지켜보던 본체가 오늘 Opus 5.5 응답 하나를 더해 알린 것처럼 판을 보낸다. calls(): 화면이 본체에 보낸 실시간 부탁(켬 true · 그만 false).
  const control = String.raw`
  contextBridge.exposeInMainWorld('__synkTokens',Object.freeze({set:name=>{tok=stage(name);for(const cb of tokL)cb(tok);},
    live:(add,model)=>{const c=tok.cells.map(r=>r.slice());const i=c.findIndex(r=>r[0]===tday(0)&&r[2]===(model||'claude-opus-5-5'));c[i][4]+=add;c[i][8]+=1;tok={...tok,cells:c,live:true,liveAt:Date.now()};for(const cb of tokL)cb(tok);},
    calls:()=>liveCalls.slice()}));
}`;
  const body = m[1].replace(anchor, tokens).replace("  contextBridge.exposeInMainWorld('synkDesktop'", store + "\n  contextBridge.exposeInMainWorld('synkDesktop'");
  const closeAt = body.lastIndexOf('}');
  if (!body.includes('tokL.add') || !body.includes('const tokL') || closeAt < 0) throw Error('token bridge not injected');
  return body.slice(0, closeAt) + control.trimStart().replace(/^\s*/, '  ') + body.slice(closeAt + 1);
}

if (!process.versions.electron) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tokens-'));
  try {
    const base = fs.readFileSync(path.join(__dirname, 'member-insight-fixture.cjs'), 'utf8'), cut = base.indexOf("if(typeof module!=='undefined')");
    if (cut < 0) throw Error('member-insight-fixture layout changed');
    fs.writeFileSync(path.join(profile, 'tokens-preload.cjs'), base.slice(0, cut) + bridgeSource());
    const result = require('node:child_process').spawnSync(require('electron'), [__filename, '--profile=' + profile, '--out=' + out], { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 240000 });
    const line = result.stdout?.split(/\r?\n/).find(value => value.startsWith(prefix));
    const report = line ? JSON.parse(line.slice(prefix.length)) : { ok: false, error: result.error?.message || 'NO_RESULT', stderr: result.stderr?.slice(-1500) };
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'model-tokens-native.json'), JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ ok: report.ok, checks: report.checks?.length, failed: report.checks?.filter(check => !check.ok), error: report.error, consoleErrors: report.consoleErrors, requests: report.requests, out }, null, 2) + '\n'); if (!report.ok) process.exitCode = 1;
  } finally {
    if (path.dirname(path.resolve(profile)) !== path.resolve(os.tmpdir()) || !path.basename(profile).startsWith('synk-tokens-')) throw Error('Unsafe temporary profile');
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 20, retryDelay: 300 });
  }
} else {
  const { app, BrowserWindow, protocol, session, Menu } = require('electron'), { createNativeContent } = require('../src/native-content.cjs'), { preferences } = require('../src/security.cjs');
  const profile = process.argv.find(value => value.startsWith('--profile='))?.slice(10), target = process.argv.find(value => value.startsWith('--out='))?.slice(6);
  if (!profile || path.dirname(profile) !== os.tmpdir() || !path.basename(profile).startsWith('synk-tokens-') || !target || !path.isAbsolute(target)) require('./electron-child-guard.cjs').refuse(__filename, 'Isolated profile required');
  app.enableSandbox(); app.setPath('userData', profile); app.commandLine.appendSwitch('force-device-scale-factor', '1'); protocol.registerSchemesAsPrivileged([{ scheme: 'synk-desktop', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
  app.whenReady().then(async () => {
    let window; const checks = [], errors = [], requests = [], shots = [];
    // 보고서에는 칸 글을 앞 160자만 남긴다(검사는 전체 글로 한다).
    const check = (name, ok, details = {}) => checks.push({ name, ok: !!ok, ...details, ...(typeof details.text === 'string' ? { text: details.text.slice(0, 160) } : {}) });
    try {
      Menu.setApplicationMenu(null); const isolated = session.fromPartition('tokens-synthetic'); isolated.protocol.handle('synk-desktop', createNativeContent({ appRoot: root }));
      isolated.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, callback) => { requests.push(details.url); callback({ cancel: true }); });
      window = new BrowserWindow({ width: 1440, height: 960, useContentSize: true, show: false, frame: false, webPreferences: { ...preferences(path.join(profile, 'tokens-preload.cjs')), session: isolated, backgroundThrottling: false } });
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); window.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
      window.webContents.on('preload-error', (_event, _preload, error) => errors.push('preload: ' + error.message));
      const run = script => window.webContents.executeJavaScript(script), pause = ms => new Promise(resolve => setTimeout(resolve, ms));
      const settle = async () => { await run("document.fonts.ready.then(()=>Promise.all([...document.images].filter(i=>i.getAttribute('src')).map(i=>i.decode().catch(()=>{}))))"); window.webContents.invalidate(); await pause(160); };
      // 칸만 찍는다(칸 위아래 24px 여백). 칸이 화면 밖이면 창 높이를 늘려 담는다.
      const capture = async name => {
        // 찍을 때만 알림 띠를 숨기고, 칸으로 스크롤한 뒤 새 그림이 나올 때까지 기다린다(스크롤 직후에 찍으면 옛 그림이 찍혔다).
        await run("(()=>{const t=document.getElementById('toast');if(t)t.style.visibility='hidden';})()");
        const box = await run("(()=>{const s=document.getElementById('ms-tokens');if(!s)return null;s.scrollIntoView({block:'start'});return true;})()");
        if (!box) return null;
        await settle();
        // 숨은 창은 크기가 바뀌어야 새 그림을 만든다(solio 점검과 같은 길): 첫 캡처는 버리고, 창 높이를 늘 바꾼 뒤 다시 스크롤해 찍는다.
        await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true }); await pause(130);
        const [width, height] = window.getContentSize();
        const first = await run("(()=>{const r=document.getElementById('ms-tokens').getBoundingClientRect();return {y:Math.max(0,Math.floor(r.top-24)),h:Math.ceil(r.height+48)};})()");
        window.setContentSize(width, Math.min(6000, Math.max(height + 1, first.y + first.h + 1))); await settle();
        await run("document.getElementById('ms-tokens').scrollIntoView({block:'start'})"); await settle(); await pause(200);
        const again = await run("(()=>{const r=document.getElementById('ms-tokens').getBoundingClientRect();return {y:Math.max(0,Math.floor(r.top-24)),h:Math.ceil(r.height+48)};})()");
        const [w2, h2] = window.getContentSize();
        const image = await window.webContents.capturePage({ x: 0, y: again.y, width: w2, height: Math.min(again.h, h2 - again.y) }, { stayHidden: true, stayAwake: true });
        fs.mkdirSync(target, { recursive: true }); const file = path.join(target, name + '.png'); fs.writeFileSync(file, image.toPNG());
        window.setContentSize(width, height); await run("(()=>{const t=document.getElementById('toast');if(t)t.style.visibility='';})()"); await settle(); shots.push(path.basename(file)); return path.basename(file);
      };
      // 잴 것: 쪽 · 본문 넘침, 칸 안 넘침, 모델 줄 안 세 칸(이름 · 몫 · 값)이 겹치지 않는지, 모델 이름이 말줄임 안에 있는지, 단추 높이.
      const measure = () => run(`(()=>{const m=document.getElementById('main'),s=document.getElementById('ms-tokens');if(!s)return {section:false};
        const r=s.getBoundingClientRect(),over=[...s.querySelectorAll('*')].filter(n=>{const b=n.getBoundingClientRect();return b.width&&(b.right>r.right+1||b.left<r.left-1)}).map(n=>n.className||n.tagName).slice(0,5);
        let minGap=Infinity,overlap=0;for(const row of s.querySelectorAll('.mt-row-btn')){const parts=[...row.querySelectorAll(':scope>.mt-who,:scope>.mt-share,:scope>.mt-val')].map(n=>n.getBoundingClientRect());for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){const a=parts[i],b=parts[j];const xo=Math.min(a.right,b.right)-Math.max(a.left,b.left),yo=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(xo>0.5&&yo>0.5)overlap++;else if(yo>0.5)minGap=Math.min(minGap,Math.max(b.left-a.right,a.left-b.right));}}
        const names=[...s.querySelectorAll('.mt-model')].filter(n=>n.scrollWidth>n.clientWidth+1&&getComputedStyle(n).textOverflow!=='ellipsis').length;
        const small=[...s.querySelectorAll('button')].filter(b=>b.offsetParent&&b.getBoundingClientRect().height<24).map(b=>b.textContent.trim()).slice(0,5);
        const days=[...s.querySelectorAll('.mt-detail .mt-day em')].map(n=>n.getBoundingClientRect());let dayHit=0;for(let i=1;i<days.length;i++)if(days[i].left<days[i-1].right-0.5)dayHit++;
        return {section:true,text:s.textContent.replace(/\\s+/g,' '),pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainOverflow:Math.max(0,m.scrollWidth-m.clientWidth),over,overlap,minGap:minGap===Infinity?null:Math.round(minGap*10)/10,unclippedNames:names,smallButtons:small,dayLabelHits:dayHit,rows:s.querySelectorAll('.mt-row').length,open:s.querySelectorAll('.mt-detail').length};})()`);
      // 누르기: 못 찾으면 그 선택자를 오류로 알린다(프로그램 클릭은 초점을 옮기지 않으므로 먼저 초점을 둔다).
      const click = async sel => { for (let i = 0; i < 60 && !(await run(`!!document.querySelector(${JSON.stringify(sel)})`)); i++) await pause(50); const ok = await run(`(()=>{const b=document.querySelector(${JSON.stringify(sel)});if(!b)return false;b.focus?.();b.click();return true;})()`); if (!ok) throw Error('missing ' + sel + ' · ' + await run("JSON.stringify({view:document.documentElement.dataset.view,tabs:document.getElementById('solio-tabs')?.textContent,panel:(document.getElementById('solio-panel')?.innerHTML||'').slice(0,120),panelHidden:document.getElementById('solio-panel')?.hidden,subs:(document.getElementById('solio-subscriptions')?.textContent||'').slice(0,80)})")); };
      const member = (id, appIds, generation = 1) => `window.__synkFixture.switchAccount({configured:true,status:'signed-in',signedIn:true,sessionGeneration:${generation},account:{synk_user_id:'synthetic-insight-${id}',display_name:'합성 ${id}'},learningSync:true,library:{status:'ready',appIds:${JSON.stringify(appIds)}}})`;
      await window.loadURL('synk-desktop://platform/index.html');
      for (let attempt = 0; attempt < 200; attempt++) { const state = await run('document.documentElement.dataset.ready'); if (state === 'true') break; if (state === 'error' || attempt === 199) throw Error('Renderer not ready'); await pause(30); }
      // 첫 화면의 환영 포털을 실제 사람처럼 넘긴다: 구 → 둘러보기 → 솔리오(현장 노트 시험_화면확인 「새 포털이 활성화된 PC 설치 검사에서 …」).
      const portalState = () => run("document.getElementById('portal-entry')?.dataset.portalActive==='true'?document.getElementById('portal-entry').dataset.portalState:'off'");
      const until = async (want, ms = 4000) => { for (let i = 0; i < ms / 50; i++) { if ((await portalState()) === want) return true; await pause(50); } return false; };
      const passPortal = async () => {
        if ((await portalState()) === 'off') return false;
        await click('#portal-entry [data-portal-action="orb"]'); await until('auth'); await pause(700);
        await click('#portal-entry [data-portal-action="browse"]'); await until('purpose'); await pause(700);
        await click('#portal-entry [data-portal-purpose="solio"]'); await until('off', 6000);
        await settle(); return true;
      };
      for (let i = 0; i < 40 && !(await run("document.getElementById('portal-entry')?.dataset.portalActive==='true'")); i++) await pause(50);
      const portalBefore = await run("JSON.stringify({p:{...(document.getElementById('portal-entry')?.dataset||{})},hidden:document.getElementById('portal-entry')?.hidden,inert:document.querySelector('.launcher')?.inert,doc:document.documentElement.dataset.portalActive,view:document.documentElement.dataset.view})");
      const passed = await passPortal();
      check('portal-passed', !(await run("document.querySelector('.launcher')?.inert")), { passed, portalBefore, after: await run("JSON.stringify({p:{...(document.getElementById('portal-entry')?.dataset||{})},inert:document.querySelector('.launcher')?.inert,view:document.documentElement.dataset.view})") });
      const clean = info => info.section && !info.pageOverflow && !info.mainOverflow && !info.over.length && !info.overlap && !info.unclippedNames && !info.smallButtons.length && !info.dayLabelHits && (info.minGap === null || info.minGap >= 8);
      for (const theme of ['day', 'night']) {
        await click(`[data-theme-choice=${theme}]`);
        for (const width of theme === 'day' ? [1440, 1260, 1100, 960, 390, 320] : [1440, 960, 390]) {
          window.setContentSize(width, 960); const tag = `${theme}-${width}`, shoot = [1440, 960, 390].includes(width);
          await run(member('A', ['messenger'], width));
          for (let i = 0; i < 60 && !(await run("document.getElementById('account-button')?.dataset.signedIn==='true'")); i++) await pause(50);
          await pause(400); await settle();
          // 로그인 뒤 앱이 홈을 다시 그리는 사이에 누르면 솔리오가 안 열린다 — 열릴 때까지 다시 누른다.
          await passPortal();
          for (let i = 0; i < 10 && (await run('document.documentElement.dataset.view')) !== 'solio'; i++) { await click('.nav-links [data-view=solio]'); await pause(200); await settle(); }
          await click("#solio-panel .primary[data-solio-section=subscriptions]"); await pause(300); await settle();
          await run("window.__synkTokens.set('off')"); await pause(60); await settle();
          let info = await measure();
          check('tokens-off-' + tag, clean(info) && /모델별 토큰 켜기/.test(info.text), { ...info, shot: shoot ? await capture('tokens-off-' + tag) : null });
          await run("window.__synkTokens.set('scanning')"); await pause(1100); await settle();
          info = await measure();
          check('tokens-scanning-' + tag, clean(info) && /4,100\/8,330/.test(info.text) && await run("document.querySelector('#ms-tokens [role=progressbar]')?.getAttribute('aria-valuenow')==='49'"), { ...info, shot: shoot && theme === 'day' ? await capture('tokens-scanning-' + tag) : null });
          // 켜기 단추 → 다리가 세는 중을 거쳐 다 센 판을 알린다.
          await run("window.__synkTokens.set('off')"); await pause(60); await settle();
          await click("#ms-tokens [data-subs=tokens-on]"); await pause(1300); await settle();
          info = await measure();
          check('tokens-on-button-ready-' + tag, info.section && info.rows === 6 && /7일 출력/.test(info.text), info);
          await click("#ms-tokens [data-subs=tokens-range][data-range=month]"); await settle();
          await click("#ms-tokens [data-subs=tokens-all]"); await settle();
          await click('#ms-tokens .mt-row-btn'); await settle();
          info = await measure();
          check('tokens-ready-month-' + tag, clean(info) && info.rows === 9 && info.open === 1 && /30일 출력/.test(info.text) && await run("document.querySelector('#ms-tokens .mt-row-btn').getAttribute('aria-expanded')==='true'&&document.activeElement?.dataset.subs==='tokens-open'"), { ...info, shot: shoot ? await capture('tokens-ready-' + tag) : null });
          await click("#ms-tokens [data-subs=tokens-range][data-range=week]"); await settle();
          info = await measure();
          check('tokens-ready-week-open-' + tag, clean(info) && info.open === 1, { ...info, shot: shoot && theme === 'day' ? await capture('tokens-week-' + tag) : null });
          // 실시간(11-16): 다 센 칸이 보이면 화면이 본체에 지켜보기를 부탁하고, 본체가 응답 하나를 더해 알리면 칸만 바뀐다 — 펼친 줄과 초점은 그대로, 바닥 줄에 「실시간」.
          const calls = () => run('window.__synkTokens.calls()'), weekTotal = () => run("document.querySelector('#ms-tokens .mt-total .ms-num')?.textContent||''");
          check('tokens-live-asked-' + tag, (await calls()).includes(true), { calls: await calls() });
          const before = await weekTotal();
          await run('window.__synkTokens.live(1000000)'); await pause(250); await settle();
          info = await measure();
          check('tokens-live-update-' + tag, clean(info) && info.open === 1 && /실시간/.test(info.text) && (await weekTotal()) !== before && await run("document.activeElement?.dataset.id==='range-week'"), { ...info, before, after: await weekTotal(), shot: shoot && theme === 'day' ? await capture('tokens-live-' + tag) : null });
          // 누르는 동안(눌렀다 떼기 전)에는 칸을 갈아 끼우지 않고, 떼면 그린다(그 사이 누름이 사라지지 않게).
          await run("(()=>{const s=document.getElementById('ms-tokens');s.dataset.mark='pressed';s.querySelector('.mt-row-btn').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));})()");
          const held = await weekTotal();
          await run('window.__synkTokens.live(1000000)'); await pause(250);
          const kept = await run("document.getElementById('ms-tokens')?.dataset.mark==='pressed'");
          await run("window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))"); await pause(150); await settle();
          check('tokens-live-waits-for-release-' + tag, kept && await run("document.getElementById('ms-tokens')?.dataset.mark!=='pressed'") && (await weekTotal()) !== held, { kept, held, after: await weekTotal() });
          // 숫자만 바뀐 판은 칸을 갈아 끼우지 않고(초점 단추가 그대로 남는다), 두 모델의 순위가 엇갈린 판은 갈아 끼우고 같은 모델에 초점을 돌려준다(Fable 검수).
          // 그 자리에서 바꾸면 칸 요소와 단추가 그대로다 — 속성 표식은 고침이 지우므로 JS 표식(__kept)으로 본다.
          await run("(()=>{const s=document.getElementById('ms-tokens');s.__kept=1;const b=s.querySelector('.mt-row-btn');b.focus();window.__keptBtn=b;window.__keptTotal=s.querySelector('.mt-total .ms-num')?.textContent;})()");
          await run('window.__synkTokens.live(100000)'); await pause(250); await settle();
          const sameNode = await run("(()=>{const s=document.getElementById('ms-tokens');return s?.__kept===1&&document.activeElement===window.__keptBtn&&s.querySelector('.mt-total .ms-num')?.textContent!==window.__keptTotal;})()");
          const topBefore = await run("document.querySelector('#ms-tokens .mt-row-btn').dataset.id");
          await run("window.__synkTokens.live(30000000,'gpt-6-astra')"); await pause(250); await settle();
          const reorder = await run("JSON.stringify({top:document.querySelector('#ms-tokens .mt-row-btn').dataset.id,focus:document.activeElement?.dataset.id})");
          check('tokens-live-in-place-and-reorder-focus-' + tag, sameNode && JSON.parse(reorder).top === 'gpt|gpt-6-astra' && JSON.parse(reorder).focus === topBefore, { sameNode, topBefore, reorder });
          // 초점이 있던 모델이 보이는 여섯 줄 밖으로 밀리면 「모델 N개 모두 보기」에 초점을 둔다(Fable 다시 검수 — 문서로 떨어지거나 첫 줄로 가지 않게).
          await click('#ms-tokens [data-subs=tokens-all]'); await settle();
          const pushedId = await run("(()=>{const rows=[...document.querySelectorAll('#ms-tokens .mt-row-btn')];const b=rows[rows.length-1];b.focus();return b.dataset.id;})()");
          await run("window.__synkTokens.live(1000000,'claude-haiku-4-5-20251001')"); await pause(250); await settle();
          const pushed = JSON.parse(await run(`JSON.stringify({focus:document.activeElement?.dataset.subs||'',stillShown:[...document.querySelectorAll('#ms-tokens .mt-row-btn')].some(b=>b.dataset.id===${JSON.stringify(pushedId)}),rows:document.querySelectorAll('#ms-tokens .mt-row-btn').length})`));
          check('tokens-live-pushed-out-focus-' + tag, pushed.focus === 'tokens-all' && !pushed.stillShown && pushed.rows === 6, { pushedId, pushed });
          await click("#ms-tokens .mt-foot [data-subs=tokens-off]"); await settle();
          info = await measure();
          check('tokens-off-armed-' + tag, clean(info) && /끄고 지우기/.test(info.text), { ...info, shot: shoot && theme === 'day' ? await capture('tokens-off-armed-' + tag) : null });
          // 키보드 초점: 「끄기」를 누르면 「그대로 두기」로, 취소하면 바닥 「끄기」로 옮긴다(Fable 최종 검수 — 잠긴 단추에 남아 문서로 떨어지던 것).
          const focused = () => run('(()=>{const a=document.activeElement;return a?(a.dataset.subs||"")+"|"+(a.dataset.id||""):""})()');
          check('tokens-off-armed-focus-' + tag, (await focused()) === 'tokens-off-cancel|', { focus: await focused() });
          await click("#ms-tokens [data-subs=tokens-off-cancel]"); await settle();
          check('tokens-off-cancel-' + tag, !(await measure()).text.includes('끄고 지우기'));
          check('tokens-off-cancel-focus-' + tag, (await focused()) === 'tokens-off|off-link', { focus: await focused() });
          // 세는 중 알림이 와도: 한눈에 보기는 「모델별 토큰」 칸만 바뀌고(누른 단추의 초점이 남는다), 계정 관리 화면은 그대로다(Fable 설계 검토 3).
          await click('#ms-tokens [data-subs=tokens-range][data-range=today]'); await settle();
          // 1분 타이머의 계정판 전체 다시 그리기와 겹치면 표식이 지워진다(이 점검과 상관없음) — 겹쳤으면 한 번 더 잰다.
          const sectionOnly = async () => { await run("document.querySelector('#solio-subscriptions .ms-stack').dataset.mark='kept'"); await run("window.__synkTokens.set('ready')"); await pause(300); await settle(); return run("document.querySelector('#solio-subscriptions .ms-stack')?.dataset.mark==='kept'&&document.activeElement?.dataset.id==='range-today'"); };
          check('tokens-repaint-section-only-' + tag, (await sectionOnly()) || (await click('#ms-tokens [data-subs=tokens-range][data-range=today]'), await sectionOnly()));
          await click('#solio-subscriptions [data-subs=manage]'); await settle();
          // 화면의 1분 타이머가 계정판 전체를 다시 그리는 때와 겹치면 표식이 지워진다(이 점검과 상관없는 다시 그리기) — 겹쳤으면 한 번 더 잰다(1분에 한 번뿐이다).
          const manageKept = async () => { await run("document.querySelector('#solio-subscriptions .member-subs').dataset.mark='manage'"); await run("window.__synkTokens.set('scanning')"); await pause(1300); await settle(); return run("document.querySelector('#solio-subscriptions .member-subs')?.dataset.mark==='manage'&&!document.getElementById('ms-tokens')"); };
          check('tokens-manage-untouched-' + tag, (await manageKept()) || (await manageKept()));
          await run("window.__synkTokens.set('ready')"); await click('#solio-subscriptions [data-subs=glance]'); await settle();
          check('tokens-back-to-glance-shows-latest-' + tag, (await measure()).rows > 0);
          // 기간은 앱이 켜져 있는 동안 기억한다 — 다음 폭이 「7일」에서 시작하게 되돌린다.
          await click('#ms-tokens [data-subs=tokens-range][data-range=week]'); await settle();
          await click("#solio-subscriptions .ms-back"); await settle();
          // 화면을 떠나면 바로 그만 부탁한다(본체가 지켜보기를 닫는다).
          check('tokens-live-stopped-on-leave-' + tag, (await calls()).at(-1) === false, { calls: (await calls()).slice(-4) });
        }
      }
      check('window-remains-hidden', !window.isVisible());
      const report = { ok: checks.every(item => item.ok) && !errors.length && !requests.length, checkedOn: new Date().toISOString(), scope: 'Hidden Electron launcher, SOLIO → AI 구독 관리 → 모델별 토큰: off, first scan, ready (30 days, all models, row open), week, off confirm. Widths 1440/1260/1100/960/390/320 day, 1440/960/390 night. Synthetic accounts and token numbers only.', checks, shots, consoleErrors: errors, requests };
      process.stdout.write(prefix + JSON.stringify(report) + '\n'); window.destroy(); app.exit(report.ok ? 0 : 1);
    } catch (error) { process.stdout.write(prefix + JSON.stringify({ ok: false, error: error.message, stack: error.stack?.slice(0, 800), checks, shots, consoleErrors: errors, requests }) + '\n'); window?.destroy(); app.exit(1); }
  });
}
