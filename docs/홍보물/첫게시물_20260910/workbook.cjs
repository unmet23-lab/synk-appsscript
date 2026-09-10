'use strict';
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..');
const put=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v)};
const template=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>첫 소개 한 문장 · 직접 작성</title><link rel="stylesheet" href="../edition.css"></head><body class="first-edition"><article class="reader proof-view"><img class="web-logo" src="../assets/logo-shift.png" alt="SYNK SHIFT"><p class="eyebrow">FIRST WORK / 가상 교육용 예시</p><h1>내 일이 남기는 것,<br>세 칸으로 써보기.</h1><p>예시의 대상을 자기 상황으로 바꿔보세요. 하는 일과 받는 결과도 그 사람에게 맞는지 함께 확인합니다.</p><label class="worksheet-label" for="person">누구에게</label><textarea class="worksheet-input" id="person" rows="2">첫 강의를 제안하는 독립 강사</textarea><label class="worksheet-label" for="work">어떤 일을</label><textarea class="worksheet-input" id="work" rows="2">강의의 대상과 실습을 정리해</textarea><label class="worksheet-label" for="result">끝에 남길 것</label><textarea class="worksheet-input" id="result" rows="2">강의 제안서 한 장</textarea><div class="live-result" id="sentence" aria-live="polite"></div><p id="check">확인: 실제로 하는 일인가요? 결과물의 이름이 보이나요? 받는 사람이 어디에 쓸지 알 수 있나요?</p><div class="actions"><button type="button" id="save">내 문장 TXT 받기</button><a class="button" href="shift-intro.html">더 많은 예시와 확인법</a></div><p id="status" role="status"></p><p class="eyebrow">입력은 이 화면에만 있습니다. 닫기 전에 내려받아 보관하세요. 회사·고객 정보 대신 가상 상황으로 연습해도 됩니다.</p></article><script>const fields=['person','work','result'].map(id=>document.getElementById(id));function objectWord(v){const c=v.trim().charCodeAt(v.trim().length-1);return v+(c>=44032&&c<=55203&&(c-44032)%28!==0?'을':'를')}function draw(){const [p,w,r]=fields.map(x=>x.value.trim());document.getElementById('sentence').textContent=objectWord(p)+' 위해 '+w+', '+objectWord(r)+' 만듭니다.'}fields.forEach(x=>x.addEventListener('input',draw));draw();document.getElementById('save').addEventListener('click',()=>{const value=document.getElementById('sentence').textContent+'\\n\\n확인할 것\\n1. 실제 하는 일\\n2. 결과물의 이름\\n3. 사용하는 자리\\n';const url=URL.createObjectURL(new Blob([value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='내일_소개문장.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.getElementById('status').textContent='내 문장 파일을 만들었습니다.'})</script></body></html>`;
async function main(){
 const captureOnly=process.argv.includes('--capture-only');
 if(!captureOnly)put(path.join(__dirname,'resources/first-work.html'),template);
 // 먼저 Loom·폰트 지면을 준비. 원고가 아직 없어도 실제 동작 견본을 확인한다.
 const font=require(path.join(root,'tools/lib/브랜드폰트')),loom=require(path.join(root,'tools/lib/loom'));
 const inter=fs.readFileSync(path.join(root,'docs/브랜드_폰트/InterTight/InterTight-Regular.ttf')).toString('base64');
 if(!captureOnly)put(path.join(__dirname,'edition.css'),font.면()+`@font-face{font-family:'Inter Tight';font-weight:400;src:url(data:font/ttf;base64,${inter})}`+loom.첫게시물());
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1100,height:1400},deviceScaleFactor:1});
 await page.goto(pathToFileURL(path.join(__dirname,'resources/first-work.html')).href);await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:path.join(__dirname,'assets/proof-start.png'),fullPage:true});
 await page.locator('#person').fill('첫 메뉴를 소개하는 작은 카페');await page.locator('#work').fill('음료 사진과 설명을 정리해');await page.locator('#result').fill('온라인 메뉴 안내문');
 await page.screenshot({path:path.join(__dirname,'assets/proof-ready.png'),fullPage:true});
 const pending=page.waitForEvent('download');await page.locator('#save').click();const download=await pending;await download.saveAs(path.join(__dirname,'_검토/직접작성_실제다운로드.txt'));
 const txt=fs.readFileSync(path.join(__dirname,'_검토/직접작성_실제다운로드.txt'),'utf8');if(!txt.includes('작은 카페')||!txt.includes('메뉴 안내문'))throw Error('Download did not preserve changed input');
 await page.setViewportSize({width:390,height:844});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('Worksheet mobile overflow');
 await page.screenshot({path:path.join(__dirname,'_검토/직접작성_모바일.png'),fullPage:true});await browser.close();
 const publicDir=path.join(root,'영상/public/firstposts20260910'),mapFile=path.join(publicDir,'assets.json');const map=JSON.parse(fs.readFileSync(mapFile,'utf8'));
 const manifestFile=path.join(__dirname,'_검토/자산과원본.json'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 for(const k of ['proof-start','proof-ready']){fs.copyFileSync(path.join(__dirname,'assets',k+'.png'),path.join(publicDir,k+'.png'));map[k]=k+'.png';if(!manifest.assets.some(a=>a.key===k))manifest.assets.push({key:k,file:k+'.png',source:'new first-work.html actual interaction screenshot',created:true})}
 put(mapFile,JSON.stringify(map));put(manifestFile,JSON.stringify(manifest,null,2));
 put(path.join(__dirname,'_검토/직접작성검증.json'),JSON.stringify({result:'pass',downloadMatchesChangedFields:true,mobileWidth:390,mobileOverflow:false,realBrowserInteraction:true,publicDeployment:false},null,2));console.log('worksheet entered, downloaded, and mobile checked');
}
main().catch(e=>{console.error(e);process.exitCode=1});
