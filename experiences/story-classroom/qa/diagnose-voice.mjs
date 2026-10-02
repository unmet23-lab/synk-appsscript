import {createRequire} from 'node:module';import {homedir} from 'node:os';import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const p=await b.newPage();p.on('pageerror',e=>console.log('error',e.message));p.on('console',m=>console.log('console',m.text()));p.on('response',r=>{if(r.url().includes('/voice/'))console.log(r.status(),r.url().split('/').at(-1));});
await p.goto('http://127.0.0.1:5213/');await p.locator('#start').click();await p.waitForTimeout(3000);console.log(await p.evaluate(()=>({voice:window.__storyVoice,status:document.querySelector('#voice-status').textContent,state:window.__storyState,learning:window.__storyLearning})));await b.close();
