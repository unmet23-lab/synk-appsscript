// Synthetic clip in a disposable database: verify the actual upload, byte ranges and video player.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createCompanyApp} from './server.mjs';
const run=promisify(execFile),here=dirname(fileURLToPath(import.meta.url));
const {chromium}=await import(pathToFileURL(process.env.SYNK_PLAYWRIGHT_MODULE));
const root=await mkdtemp(join(tmpdir(),'synk-studio-media-browser-')),clip=join(root,'검증용_영상.mp4'),checks=[],errors=[],external=[];
const app=createCompanyApp({dataDir:join(root,'data'),port:43171,schedule:false});let browser;
try{
 await run(process.env.SYNK_FFMPEG_EXE||'ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=480x270:rate=24','-t','3','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',clip]);
 await app.start();const admin=app.store.createUser({name:'미디어 검증 관리자',email:'media-admin@example.test',role:'admin',password:'Media-test-password-2026'});
 browser=await chromium.launch({headless:true,executablePath:process.env.SYNK_BROWSER_EXE});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin===app.origin)return route.continue();external.push(route.request().url());return route.abort();});
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto(app.origin);await page.locator('[name="email"]').fill(admin.email);await page.locator('[name="password"]').fill('Media-test-password-2026');await page.locator('[data-form="auth"] [type="submit"]').click();await page.locator('.sidebar').waitFor();
 await page.locator('.nav-item[data-tab="studio"]').click();await page.locator('.swb-board').waitFor();
 await page.locator('[data-action="sw-new-production"]').first().click();await page.locator('[data-sw-form="production"] [name="title"]').fill('임시 DB · 영상 검토 동작 검증');await page.locator('[data-sw-form="production"] [name="nextAction"]').fill('테스트 패턴 재생과 장면 의견 확인');await page.locator('[data-sw-form="production"] [type="submit"]').click();await page.locator('.swb-production').waitFor();await page.locator('[data-action="sw-open-production"]').first().click();
 await page.locator('[data-action="sw-review-version"]').first().click();await page.locator('[data-swr-form="version"] [name="label"]').fill('검증 영상 1차');await page.locator('[data-swr-form="version"] [name="file"]').setInputFiles(clip);await page.locator('[data-swr-form="version"] [type="submit"]').click();
 const video=page.locator('[data-swr-video][data-swr-slot="current"]');await video.waitFor();await page.waitForFunction(()=>document.querySelector('[data-swr-video]')?.readyState>=1);assert.ok(await video.evaluate(node=>node.duration>=2.9));checks.push('real-mp4-upload-and-metadata');
 await video.evaluate(async node=>{node.muted=true;await node.play();});await page.waitForFunction(()=>document.querySelector('[data-swr-video]')?.currentTime>.4);await video.evaluate(node=>node.pause());checks.push('actual-browser-video-playback');
 await page.locator('[data-action="sw-review-capture"]').click();const at=Number(await page.locator('[data-swr-form="note"] [name="atSeconds"]').inputValue());assert.ok(at>.2);
 await page.locator('[data-swr-form="note"] [name="text"]').fill('검증 메모: 이 시점의 패턴과 글씨를 확인합니다.');await page.locator('[data-swr-form="note"] [name="axis"]').selectOption('usefulness');await page.locator('[data-swr-form="note"] [type="submit"]').click();await page.locator('.swr-note').waitFor();assert.equal(app.store.all('studioProductions')[0].notes[0].atSeconds,at);checks.push('timecode-note-persisted');
 await page.locator('[data-action="sw-review-seek"]').click();await page.waitForFunction(position=>Math.abs(document.querySelector('[data-swr-video]')?.currentTime-position)<.2,at);checks.push('note-click-seeks-player');
 const media=app.store.all('studioMedia')[0],stored=await readFile(join(root,'data','studio-media',media.diskName)),original=await readFile(clip);assert.deepEqual(stored,original);
 const range=await context.request.get(app.origin+'/api/studio-media/'+media.id,{headers:{Range:'bytes=4-19'}});assert.equal(range.status(),206);assert.deepEqual(await range.body(),original.subarray(4,20));assert.equal(range.headers()['content-range'],`bytes 4-19/${original.length}`);checks.push('stored-bytes-and-authenticated-range');
 const stranger=await browser.newContext();const denied=await stranger.request.get(app.origin+'/api/studio-media/'+media.id);assert.equal(denied.status(),401);await stranger.close();checks.push('private-media-requires-session');
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`video layout ${width}`);}
 checks.push('video-review-responsive-four-widths');await mkdir(join(here,'verification'),{recursive:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:join(here,'verification/studio-video-fixture.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);const result={checks,errors,external,fixtureOnly:true};await writeFile(join(here,'verification/studio-media-browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{if(browser)await browser.close();await app.stop();if(!root.startsWith(join(tmpdir(),'synk-studio-media-browser-')))throw new Error('Unexpected cleanup path');await rm(root,{recursive:true,force:true});}
