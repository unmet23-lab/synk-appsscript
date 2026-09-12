'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {pathToFileURL,fileURLToPath}=require('node:url');
const ROOT=path.resolve(__dirname,'../../..');
const BASE='C:/Users/q1212/.codex/visualizations/2026/09/11/01a08f0d-d3c5-7c41-9c85-d69384fa2412/IP_디딤돌_준비/미팅완성본';
const out=path.join(BASE,'등록우선전략_20260912'),packet=path.join(BASE,'현재_미팅본_20260912');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const report={checkedAt:new Date().toISOString(),files:[],sourceChecks:[],pdfCopy:false};
for(const dir of [out,packet]){const manifest=JSON.parse(fs.readFileSync(path.join(dir,'파일지문.json'),'utf8'));for(const f of manifest.files){const actual=path.join(dir,f.path);assert.equal(fs.statSync(actual).size,f.bytes,f.path);assert.equal(hash(actual),f.sha256,f.path);report.files.push({file:path.relative(BASE,actual),valid:true})}}
const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence.json'),'utf8'));
for(const f of evidence.sourceFingerprints){assert.equal(hash(path.join(__dirname,'..',f.name)),f.sha256);report.sourceChecks.push(f.name)}
assert.equal(hash(path.join(packet,'05_등록우선전략.pdf')),hash(path.join(out,'SYNK_등록특허_1건을_위한_전략.pdf')));report.pdfCopy=true;
assert.equal(require('./content.cjs').pages.length,16);
async function verify(){let pw;try{pw=require('playwright')}catch{pw=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')}
const browser=await pw.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(/^https?:/.test(r.request().url())){external.push(r.request().url());return r.abort()}return r.continue()});await page.goto(pathToFileURL(path.join(packet,'00_여기서시작.html')).href);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(out,'검수/entry-desktop.png'),fullPage:true});assert.match(await page.locator('h1').innerText(),/등록특허/);assert.equal(await page.locator('[data-registration-strategy]').count(),1);
const links=await page.locator('a').evaluateAll(as=>as.map(a=>a.href));const localLinks=links.filter(u=>u.startsWith('file:'));for(const link of localLinks)assert.ok(fs.existsSync(fileURLToPath(link)),link);report.localLinks=localLinks.length;
const popupPromise=page.waitForEvent('popup');await page.locator('[data-registration-strategy] a').first().click();const popup=await popupPromise;await popup.waitForLoadState('domcontentloaded');assert.equal(await popup.locator('.page').count(),16);await popup.close();report.primaryLinkOpensStrategy=true;
await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'검수/entry-mobile.png'),fullPage:true});report.mobileOverflow=false;
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);report.errors=errors;report.externalRequests=external;report.complete=true;fs.writeFileSync(path.join(out,'검수/final-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({complete:true,files:report.files.length,sourceChecks:report.sourceChecks.length,localLinks:report.localLinks,pages:16}));
}finally{await browser.close()}}
verify().catch(e=>{console.error(e);process.exitCode=1});
