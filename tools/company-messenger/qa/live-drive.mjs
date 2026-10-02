// Explicit manual check: creates a tiny test file in the configured private Drive folder,
// verifies the actual browser upload/download, then moves only that test file to trash.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {homedir,tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {createDriveStorage} from '../drive-storage.mjs';
import {createMessenger} from '../server.mjs';

assert.ok(process.argv.includes('--confirm-live'),'Live Drive verification requires --confirm-live');
const emailIndex=process.argv.indexOf('--email');
const expectedEmail=process.argv[emailIndex+1];
assert.ok(emailIndex>=0&&expectedEmail?.includes('@'),'Specify --email before live verification');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const drive=createDriveStorage({dataDir:path.join(root,'data')});
const status=await drive.status({fresh:true});
assert.equal(status.status,'connected');
assert.equal(status.account.email,expectedEmail);
const temp=await mkdtemp(path.join(tmpdir(),'synk-drive-live-'));
const app=createMessenger({dataDir:temp,port:0,driveStorage:drive});
const {url}=await app.listen();
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser=await chromium.launch({executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:960}});
const page=await context.newPage();
const issues=[];
page.on('pageerror',e=>issues.push(e.message));
page.on('console',m=>{if(m.type()==='error')issues.push(m.text());});
let complete=false;
try{
  await mkdir(path.join(root,'qa-output'),{recursive:true});
  await page.goto(url);
  await page.locator('#workspace-name').fill('Drive 연결 검수');
  await page.locator('#display-name').fill('연결 검수');
  await page.locator('#username').fill('drivecheck');
  await page.locator('#password').fill(`QA-${randomUUID()}`);
  await page.locator('#auth-submit').click();
  await page.locator('#composer-input').waitFor();
  const content=process.argv.includes('--large')?Buffer.alloc(6*1024*1024,'SYNK Drive validation\n'):Buffer.from(`SYNK 메신저 Drive 연결 확인\n실제 업로드·원본 다운로드 검증용 파일입니다.\n${new Date().toISOString()}\n`,'utf8');
  await page.locator('#file-input').setInputFiles({name:'SYNK_Drive_연결확인.txt',mimeType:'text/plain',buffer:content});
  await page.waitForFunction(()=>!document.querySelector('#send-message').disabled,null,{timeout:60000});
  await page.locator('#composer-input').fill('Google Drive에 저장한 파일을 메신저에서 내려받아 확인합니다.');
  await page.locator('#send-message').click();
  await page.locator('.message .file-card').waitFor();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('.message .file-card').click()]);
  const returned=await readFile(await download.path());
  assert.deepEqual(returned,content);
  const row=app.db.prepare('SELECT id,storage_provider,storage_connection_id,storage_remote_id,md5 FROM files').get();
  assert.equal(row.storage_provider,'google-drive');
  assert.equal(row.storage_connection_id,status.activeConnectionId);
  assert.equal(row.md5,createHash('md5').update(content).digest('hex'));
  await page.screenshot({path:path.join(root,'qa-output/drive-chat.png'),fullPage:true,animations:'disabled'});
  await page.locator('#workspace-settings').click();
  await page.locator('#drive-account-email').waitFor();
  assert.equal((await page.locator('#drive-account-email').innerText()).trim(),expectedEmail);
  assert.match(await page.locator('#drive-quota-value').innerText(),/5(?:\.\d+)?\s*TB/);
  await page.screenshot({path:path.join(root,'qa-output/drive-settings.png'),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(root,'qa-output/drive-settings-mobile.png'),fullPage:true,animations:'disabled'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#close-modal').click();
  await page.setViewportSize({width:1440,height:960});
  await page.locator('.message').hover();
  await page.locator('.message [data-action="delete"]').click();
  await page.locator('#confirm-delete').click();
  await page.locator('.message').waitFor({state:'detached'});
  const state=await (await context.request.get(`${url}/api/storage/drive`)).json();
  assert.equal(state.pendingDeletions,0);
  await assert.rejects(()=>drive.download({connectionId:row.storage_connection_id,remoteId:row.storage_remote_id,fileId:row.id}),error=>error.status===404);
  assert.deepEqual(issues,[]);
  complete=true;
  console.log(JSON.stringify({passed:true,email:status.account.email,limitBytes:status.account.limitBytes,folderUrl:status.connections.find(c=>c.active).folderUrl,uploadBytes:content.length,downloadSha256:createHash('sha256').update(returned).digest('hex'),driveProvider:true,remoteMd5Verified:true,testFileTrashed:true,browserConsoleErrors:issues.length},null,2));
}catch(error){
  await page.screenshot({path:path.join(root,'qa-output/drive-failure.png'),fullPage:true}).catch(()=>{});
  console.error(JSON.stringify({error:error.message,issues,diagnosticDataDir:temp}));
  throw error;
}finally{
  await browser.close();
  await app.close();
  if(complete){
    assert.ok(path.resolve(temp).startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(temp).startsWith('synk-drive-live-'));
    await rm(temp,{recursive:true,force:true});
  }
}
