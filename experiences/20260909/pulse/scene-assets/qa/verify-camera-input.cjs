const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4439/pulse/scene-assets/qa/world.html');await page.waitForFunction(()=>window.worldReady,null,{timeout:60000});
  await page.locator('canvas').focus();await page.keyboard.down('w');
  await page.evaluate(()=>{const field=document.createElement('div');field.id='plain-editor';field.contentEditable='plaintext-only';field.style='position:absolute;top:20px;left:20px;z-index:20;background:white;color:black';document.body.append(field);field.focus();});
  const before=await page.evaluate(()=>world.getNavigationState().position);await page.keyboard.type('wasd');await page.keyboard.up('w');await page.waitForTimeout(180);
  assert.deepEqual(await page.evaluate(()=>world.getNavigationState().position),before);assert.equal(await page.locator('#plain-editor').innerText(),'wasd');
  await page.evaluate(()=>document.getElementById('plain-editor').remove());
  await page.locator('canvas').focus();await page.mouse.move(500,450);await page.mouse.wheel(0,-1200);await page.waitForTimeout(120);await page.mouse.wheel(0,2400);await page.waitForTimeout(120);
  await page.evaluate(()=>world.setCameraMode('overview'));await page.waitForTimeout(120);await page.screenshot({path:path.join(__dirname,'world-overview-v2.png')});
  await page.evaluate(()=>world.focus('street'));await page.setViewportSize({width:390,height:844});await page.waitForTimeout(180);await page.screenshot({path:path.join(__dirname,'world-mobile-v2.png')});
  assert.deepEqual(errors,[]);
  const report={date:new Date().toISOString(),checks:['Plaintext contenteditable clears held W and retains wasd text','FOV min/max and overview camera keep rendering without runtime errors','390x844 resize renders; screenshot inspected separately'],errors};
  await fs.writeFile(path.join(__dirname,'camera-input-v2.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})();
