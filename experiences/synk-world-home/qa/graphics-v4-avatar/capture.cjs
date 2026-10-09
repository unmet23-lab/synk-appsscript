const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];try{
 for(const [name,width,height,dpr] of [['desktop',900,850,1],['mobile',390,500,2]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__avatar-v4-review',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'preview.html'),'utf8')}));
  await page.goto('http://127.0.0.1:4296/__avatar-v4-review');await page.waitForFunction(()=>window.ready,null,{timeout:45000});
  for(const time of ['day','sunset'])for(const outfit of ['none','scarf','apron','scarf-apron']){
   await page.evaluate(({time,outfit})=>{avatarStudy.setTime(time);avatarStudy.setOutfit(outfit);},{time,outfit});
   await page.screenshot({path:path.join(__dirname,`${name}-${time}-${outfit}.png`)});
   results.push({name,time,outfit,metrics:await page.evaluate(()=>avatarStudy.metrics())});
  }
  await page.evaluate(()=>{avatarStudy.setTime('day');avatarStudy.turn(.9);avatarStudy.setOutfit('scarf-apron');});
  await page.screenshot({path:path.join(__dirname,`${name}-side.png`)});
  const contract=await page.evaluate(()=>{
   const a=avatarStudy.avatar;let finite=true; a.group.traverse(o=>{if(o.geometry?.attributes.position)for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))finite=false;});
   const before=a.metrics().bodyBounds; a.update(4,{reducedMotion:true,greeting:.3});
   return {finiteVertices:finite,bodyBounds:before,reducedMotion:a.group.rotation.z===0&&a.group.scale.y===1,allOutfits:['none','scarf','apron','scarf-apron'].every(value=>a.setOutfit(value)===value)};
  });
  results.push({name,errors,contract});await context.close();
 }
}finally{await browser.close();}
fs.writeFileSync(path.join(__dirname,'capture.json'),JSON.stringify({checkedAtUtc:new Date().toISOString(),results},null,2));
console.log(JSON.stringify(results.filter(x=>x.errors),null,2));if(results.some(x=>x.errors?.length||x.contract&&!Object.values(x.contract).every(Boolean)))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
