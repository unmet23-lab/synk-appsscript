#!/usr/bin/env node
'use strict';
// Existing Chrome helper + native key events. No persistent browser or hook is installed.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const repo = process.env.SYNK_SOURCE_REPO || path.resolve(__dirname,'../../..');
const { 지면열기 } = require(path.join(repo,'tools/lib/크롬조종.js'));
const output = path.join(__dirname,'checks');
fs.mkdirSync(output,{recursive:true});
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const report = { date:new Date().toISOString(), browser:'Chrome headless, native Input key events', checks:[], axe:[], limitations:['사람의 한국어 음성 청취 미확인','화면낭독기 실청취 미확인','장애 당사자·접근성 전문가 검수 미확인'] };
const record = (name,details) => report.checks.push({name,status:'pass',details});
(async () => {
  const page = await 지면열기(path.join(__dirname,'index.html'),{기다림:'Boolean(window.synkGallery)',최대초:30});
  const c = page.c;
  const evaluate = async expression => {
    const result = await c.보냄('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  async function key(name) {
    const keys = {Tab:9,Enter:13,ArrowDown:40,ArrowRight:39,Space:32};
    const key = name === 'Space' ? ' ' : name;
    await c.보냄('Input.dispatchKeyEvent',{type:'keyDown',key,code:name,windowsVirtualKeyCode:keys[name]});
    await c.보냄('Input.dispatchKeyEvent',{type:'keyUp',key,code:name,windowsVirtualKeyCode:keys[name]});
    await pause(60);
  }
  async function screenshot(name) {
    const result = await c.보냄('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(result.data,'base64'));
  }
  async function axe(name) {
    const result = await evaluate(`axe.run(document,{resultTypes:['violations','incomplete']}).then(r=>({violations:r.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:r.incomplete.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))}))`);
    report.axe.push({state:name,...result});
    assert.equal(result.violations.length,0,JSON.stringify(result.violations));
  }
  try {
    await c.보냄('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await evaluate('document.fonts.ready');
    assert.equal(await evaluate('document.querySelector("#city-image").naturalWidth>0'),true);
    assert.equal(await evaluate('document.querySelectorAll("audio,video").length'),0);
    record('source image and no invented audio','City image loaded; no audio/video source or autoplay.');
    await key('Tab');
    assert.equal(await evaluate('document.activeElement.classList.contains("synk-skip-link")'),true);
    const ring = await evaluate('getComputedStyle(document.activeElement).outlineWidth');
    assert.notEqual(ring,'0px');
    await key('Enter');
    assert.equal(await evaluate('document.activeElement.id'),'main');
    record('skip link','Tab exposes skip link; Enter focuses main.');
    await key('Tab');
    assert.equal(await evaluate('document.activeElement.id'),'motion-choice');
    await key('ArrowDown');
    assert.equal(await evaluate('window.synkGallery.accessibility.getMotion().reduced'),true);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".light-effect")).animationName'),'none');
    await key('ArrowDown');
    assert.equal(await evaluate('window.synkGallery.accessibility.getMotion().reduced'),false);
    await key('Tab');
    assert.equal(await evaluate('document.activeElement.id'),'pause-motion');
    await key('Space');
    assert.equal(await evaluate('document.querySelector("#pause-motion").getAttribute("aria-pressed")'),'true');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".light-effect")).animationPlayState'),'paused');
    record('motion choice and pause','Native arrow keys select reduced motion; Space pauses effect.');
    await key('Tab');
    assert.equal(await evaluate('document.activeElement.value'),'tram');
    await key('ArrowRight');
    assert.equal(await evaluate('window.synkGallery.getSelected()'),'square');
    await key('ArrowRight');
    assert.equal(await evaluate('window.synkGallery.getSelected()'),'window');
    assert.equal(await evaluate('document.activeElement.value'),'window');
    assert.equal(await evaluate('document.querySelector("#scene-title").textContent'),'멀리 남은 불빛');
    const selectedRing = await evaluate('getComputedStyle(document.activeElement.nextElementSibling).outlineWidth');
    assert.notEqual(selectedRing,'0px');
    record('scene selection','Native radio ArrowRight selects 02 then 03; title and visible focus update.');
    await key('Tab');
    if (await evaluate('document.activeElement.id === "read-scene"')) {
      const hasKorean = await evaluate('speechSynthesis.getVoices().some(v=>v.lang.toLowerCase().startsWith("ko"))');
      if (!hasKorean) {
        await key('Space');
        assert.equal(await evaluate('document.querySelector("#speech-state").textContent.includes("한국어 읽어주기 음성이 없습니다")'),true);
        record('speech limitation','Read button reports missing Korean voice without claiming playback.');
      } else {
        await key('Space');
        await pause(300);
        const busy = await evaluate('speechSynthesis.speaking || speechSynthesis.pending');
        if (busy) {
          await key('Tab');
          assert.equal(await evaluate('document.activeElement.id'),'stop-reading');
          await key('Space');
          assert.equal(await evaluate('speechSynthesis.speaking || speechSynthesis.pending'),false);
          assert.equal(await evaluate('document.activeElement.id'),'read-scene');
          record('speech start and cancel','Space requested Korean speech; browser reported active speech; Tab/Space cancelled and restored focus. Human listening not verified.');
        } else {
          const runtimeState = await evaluate('({text:document.querySelector("#speech-state").textContent,voices:speechSynthesis.getVoices().map(v=>v.lang)})');
          assert.equal(runtimeState.text.includes('시작하지 못했습니다'),true,JSON.stringify(runtimeState));
          record('speech runtime limitation','Korean voice existed but playback failed; visible failure correctly shown.');
        }
      }
    } else record('speech unavailable','Unsupported read button is disabled; text remains available.');
    await evaluate(fs.readFileSync(path.join(repo,'tools/vendor/axe.min.js'),'utf8'));
    await axe('desktop 1440x1100, scene03');
    await evaluate('window.scrollTo(0,0)');
    await screenshot('desktop');
    // Emulate the OS preference independently of the explicit user preference.
    await evaluate('window.synkGallery.accessibility.setMotion("system")');
    await c.보냄('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await pause(80);
    assert.equal(await evaluate('window.synkGallery.accessibility.getMotion().reduced'),true);
    record('system reduced motion','A live OS preference change stops the effect in system mode.');
    await c.보냄('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await evaluate('window.scrollTo(0,0)');
    await pause(80);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
    await axe('mobile 390x844, reduced motion');
    await screenshot('mobile');
    record('mobile layout','390px viewport has no horizontal overflow.');
    await c.보냄('Emulation.setDeviceMetricsOverride',{width:320,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
    record('narrow reflow','320px viewport has no horizontal overflow.');
    // Exercise fallback with a deliberately broken URL, then restore the actual source.
    await evaluate('document.querySelector("#city-image").src="./missing-test-image.png"');
    await pause(80);
    assert.equal(await evaluate('document.querySelector("#city-image").hidden && !document.querySelector("#asset-fallback").hidden'),true);
    assert.equal(await evaluate('document.querySelector("#scene-description").textContent.startsWith("왼쪽 항구에는 배들이 머물고")'),true);
    await axe('image unavailable, 320px');
    record('missing image fallback','Visible text and scene controls remain; broken image is hidden.');
    await evaluate('document.querySelector("#city-image").src="../pulse/assets/felt-city.png"');
    const downloads = fs.mkdtempSync(path.join(output,'download-'));
    fs.mkdirSync(downloads,{recursive:true});
    await c.보냄('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
    await evaluate('document.querySelector("#download-evidence").focus()');
    await key('Space');
    const downloadPath = path.join(downloads,'SYNK-접근성-감상실-검수.json');
    for(let i=0;i<20 && !fs.existsSync(downloadPath);i++) await pause(100);
    assert.equal(fs.existsSync(downloadPath),true);
    const downloaded = JSON.parse(fs.readFileSync(downloadPath,'utf8'));
    assert.equal(downloaded.artifact,'마지막 불빛 · 접근성 감상실');
    assert.equal(downloaded.certification,'WCAG 전체 준수 인증 아님');
    record('download report','Space downloaded a valid JSON evidence file into the scoped check folder.');
    fs.copyFileSync(downloadPath,path.join(output,'downloaded-evidence.json'));
    fs.unlinkSync(downloadPath);
    fs.rmdirSync(downloads);
    const hashFiles = ['index.html','a11y.js','a11y.css','gallery.js','gallery.css','theme.css'];
    report.sourceSHA256 = Object.fromEntries(hashFiles.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex')]));
    report.status = 'pass';
  } catch (error) {
    report.status = 'fail'; report.error = error.stack;
    process.exitCode = 1;
  } finally {
    page.닫기();
    fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
