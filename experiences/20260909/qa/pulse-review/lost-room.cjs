const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createExperienceServer}=require('../../server.cjs');let app,browser;const result={};
const ready=p=>p.waitForFunction(()=>document.querySelector('#experience').dataset.phase==='explore');
(async()=>{
 app=createExperienceServer({root:'C:/Users/q1212/Documents/SYNK-worktrees/pulse-20260909/experiences/20260909'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:'chrome',headless:true});const c=await browser.newContext({viewport:{width:390,height:844}});const p=await c.newPage();
 await p.goto('http://127.0.0.1:'+app.server.address().port+'/pulse/');await p.locator('#dual-start').click();await ready(p);const originalCode=await p.locator('#room-code').textContent();
 await c.route('**/api/rooms/**',route=>route.abort('internetdisconnected'));await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelector('#connection').dataset.status==='offline');
 const temporary={recoveryVisible:await p.locator('#recover-room').isVisible(),credentialsRetained:await p.evaluate(()=>{const data=JSON.parse(sessionStorage.getItem('synk-pulse-last-light-v1'));return !!data&&data.players.length===2;})};assert.equal(temporary.recoveryVisible,false);assert.equal(temporary.credentialsRetained,true);
 await c.unroute('**/api/rooms/**');await p.reload();await ready(p);temporary.sameRoomAfterReconnect=(await p.locator('#room-code').textContent())===originalCode;assert(temporary.sameRoomAfterReconnect);result.temporaryNetwork=temporary;
 app.rooms.clear();await p.reload();await p.locator('#recover-room').waitFor({state:'visible'});result.missingRoom={message:await p.locator('#error-message').textContent()};
 await p.locator('#recover-room').click();await p.locator('#entry-main').waitFor({state:'visible'});await p.locator('#dual-start').click();await ready(p);result.missingRoom.newRoomStarted=true;
 const room=[...app.rooms.values()][0];for(const player of room.players.values())player.token='revoked-for-local-review';
 await p.reload();await p.locator('#recover-room').waitFor({state:'visible'});result.revokedRole={message:await p.locator('#error-message').textContent()};
 await p.locator('#recover-room').click();await p.locator('#entry-main').waitFor({state:'visible'});await p.locator('#dual-start').click();await ready(p);result.revokedRole.newRoomStarted=true;
 result.complete=true;
})().catch(e=>{result.error=e.message;process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(app)app.close();fs.writeFileSync(path.join(__dirname,'lost-room.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));});
