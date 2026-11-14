'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {validateRelease,updateSiteText,releaseDay,updateHomeNews,updateFooterDate,planSite,stageSite}=require('../tools/publish-platform-release.cjs');
const sample=()=>({schemaVersion:1,product:'platform',channel:'preview',version:'0.4.4',releaseId:'platform-preview-0.4.4',buildId:'20261014.1',publishedAt:'2026-10-14T00:00:00.000Z',artifacts:[['win32','x64','win','exe'],['darwin','arm64','mac','dmg'],['darwin','x64','mac','dmg']].map(([platform,arch,os,ext])=>({platform,arch,url:`https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.4/SYNK-Platform-Preview-0.4.4-Signal-${os}-${arch}.${ext}`,bytes:123,sha256:'a'.repeat(64),asarSHA256:'b'.repeat(64)}))});
test('publication requires every platform and never changes bytes under the same version',()=>{
 const release=sample();assert.equal(validateRelease(release).length,3);assert.doesNotThrow(()=>validateRelease(release,structuredClone(release)));
 const partial=sample();partial.artifacts.pop();assert.throws(()=>validateRelease(partial),/three/);
 const altered=sample();altered.artifacts[0].sha256='c'.repeat(64);assert.throws(()=>validateRelease(altered,release),/immutable/);
 const previous=sample();previous.version='0.4.5';assert.throws(()=>validateRelease(release,previous),/immutable/);
});
test('static links and update manifest advance together while unrelated content stays intact',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-release-site-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const release=sample(),old=release.artifacts.map(a=>`<a href="${a.url.replaceAll('0.4.4','0.4.3')}">download</a>`).join('');
 const original=`<html><body>KEEP USER CONTENT ${old} Preview 0.4.3</body></html>`;
 fs.writeFileSync(path.join(directory,'index.html'),original);fs.mkdirSync(path.join(directory,'en'));fs.writeFileSync(path.join(directory,'en/index.html'),original);
 const client=path.join(directory,'input-client.js');fs.writeFileSync(client,'// fixed client\n');
 const changed=stageSite({publicDir:directory,manifest:release,clientFile:client});assert(changed.includes('desktop/releases/preview.json'));
 const page=fs.readFileSync(path.join(directory,'index.html'),'utf8');assert(page.includes('KEEP USER CONTENT'));assert(!page.includes('0.4.3'));assert.equal((page.match(/client\.js/g)||[]).length,1);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory,'desktop/releases/preview.json'))),release);
 assert.equal(stageSite({publicDir:directory,manifest:release,clientFile:client}).length,0);
});
test('unrelated release links remain unchanged',()=>{
 const other='https://github.com/unmet23-lab/synk-policy/releases/download/other/product.exe';assert.equal(updateSiteText(other,sample()),other);
});

test('CRLF checkout outputs LF before client and knowledge cache hashes, then stages identical bytes',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-release-lf-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const release=sample(),links=release.artifacts.map(a=>`<a href="${a.url}">download</a>`).join('\r\n');
 const home=`<html>\r\n<body data-knowledge="/knowledge.json?v=deadbeef">${links}\r\nPreview 0.4.3\n</body></html>\r\n`;
 for(const [file,value] of Object.entries({'index.html':home,'knowledge.json':'{\r\n "version":"Preview 0.4.3"\r\n}\r\n','llms.txt':'Preview 0.4.3\r\nKEEP\n','docs/platform.md':'Preview 0.4.3\r\n'})){
  fs.mkdirSync(path.dirname(path.join(directory,file)),{recursive:true});fs.writeFileSync(path.join(directory,file),value);
 }
 const client=path.join(directory,'input-client.js');fs.writeFileSync(client,'// client\r\n// two\n');
 const writes=planSite({publicDir:directory,manifest:release,clientFile:client}),values=Object.fromEntries(writes.map(x=>[x.relative,x.value]));
 const hash=value=>require('node:crypto').createHash('sha256').update(value).digest('hex').slice(0,12);
 for(const {relative,value} of writes)assert(!value.includes('\r'),relative);
 assert(values['index.html'].includes('/knowledge.json?v='+hash(values['knowledge.json'])));
 assert(values['index.html'].includes('/desktop/releases/client.js?v='+hash(values['desktop/releases/client.js'])));
 assert.deepEqual(JSON.parse(values['desktop/releases/preview.json']),release);
 stageSite({publicDir:directory,manifest:release,clientFile:client});
 for(const {relative,value} of writes)assert.equal(fs.readFileSync(path.join(directory,relative),'utf8'),value,relative);
 assert.equal(stageSite({publicDir:directory,manifest:release,clientFile:client}).length,0);
});
// 2026-11-08: 홈 소식 줄(#now)은 synk.im 빌드(SYNK-website site-v10/build.mjs)와 같은 모양 — 최신순 셋을 펼치고 나머지는 「지난 소식 N」 접이 안.
const li=(href,date,who,title)=>`<li><a href="${href}"><time datetime="${date}">${date.replace(/-/g,'.')}</time><span class="news-who"><i class="dot dot-synk" aria-hidden="true"></i>${who}</span><span class="news-what"><span class="news-title">${title}</span></span><span class="news-go" aria-hidden="true">→</span></a></li>`;
const pcLine=(date,version)=>`<li><a href="#platform-get"><time datetime="${date}">${date.replace(/-/g,'.')}</time><span class="news-who"><i class="dot dot-synk" aria-hidden="true"></i>플랫폼</span><span class="news-what"><span class="news-title">PC 앱 Preview ${version}</span></span><span class="news-go news-go-pf" aria-hidden="true"></span></a></li>`;
const homeNews=(open,rest)=>`<section class="duo-col duo-now reveal" id="now" aria-labelledby="now-title"><h2 class="h2" id="now-title"><span>최근에 새로 연 것</span></h2>
<ol class="news">${open.join('')}</ol>${rest.length?`
<details class="more news-more"><summary><span>지난 소식 <span class="news-more-n">${rest.length}</span></span></summary><ol class="news">${rest.join('')}</ol></details>`:''}
</section>`;
const footer=date=>`<footer class="foot"><div class="foot-bottom"><span>© 2026 SYNK.</span><span>hello@synk.im · 회사·사업 안내 기준일 <time class="mono" datetime="${date}">${date.replace(/-/g,'.')}</time></span></div></footer>`;
const newsOf=html=>{const s=html.slice(html.indexOf('id="now"'),html.indexOf('</section>',html.indexOf('id="now"')));const open=s.slice(0,s.indexOf('<details')<0?s.length:s.indexOf('<details'));
 const rows=part=>[...part.matchAll(/<li><a href="([^"]+)"><time datetime="([\d-]+)">([\d.]+)<\/time>[\s\S]*?<span class="news-title">([^<]+)<\/span>/g)].map(m=>[m[2],m[4]]);
 return {open:rows(open),rest:rows(s.slice(open.length)),more:s.match(/news-more-n">(\d+)</)?.[1]};};
const footDate=html=>html.match(/<time class="mono" datetime="([\d-]+)">([\d.]+)<\/time>/).slice(1);
test('a Platform release dates its home news line on the Seoul publishing day, moves it to the front and keeps the fold shape',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-release-news-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 // 11-09 15:30 UTC는 서울 11-10 00:30 — 소식 날짜는 서울 날짜다.
 const release={...sample(),publishedAt:'2026-11-09T15:30:00.000Z'},old=release.artifacts.map(a=>`<a href="${a.url.replaceAll('0.4.4','0.4.3')}">download</a>`).join('');
 // 옛 판(10-31)의 PC 앱 줄은 접이 안에 있고, 바닥 기준일은 11-06이다.
 const home=`<html><body>KEEP ${homeNews([li('/lab/#world','2026-11-05','LAB','WORLD 새 놀이'),li('/pulse/casting/','2026-11-03','PULSE','아이돌 두 팀'),li('#drama','2026-11-01','LAB','상황극 1화')],[pcLine('2026-10-31','0.4.3'),li('/pulse/casting/','2026-10-24','PULSE','한결'),li('/mn/','2026-10-22','SYNK','몽골어')])}<section id="platform"><span>Preview 0.4.3</span>${old}</section>${footer('2026-11-06')}</body></html>`;
 for(const page of ['index.html','en/index.html']){fs.mkdirSync(path.dirname(path.join(directory,page)),{recursive:true});fs.writeFileSync(path.join(directory,page),home);}
 for(const page of ['pulse/index.html','en/pulse/index.html','mn/index.html']){fs.mkdirSync(path.dirname(path.join(directory,page)),{recursive:true});fs.writeFileSync(path.join(directory,page),`<html><body>PAGE ${footer('2026-11-06')}</body></html>`);}
 const client=path.join(directory,'input-client.js');fs.writeFileSync(client,'// fixed client\n');
 const changed=stageSite({publicDir:directory,manifest:release,clientFile:client});
 for(const page of ['index.html','en/index.html']){
  const html=fs.readFileSync(path.join(directory,page),'utf8'),news=newsOf(html);
  assert.deepEqual(news.open,[['2026-11-10','PC 앱 Preview 0.4.4'],['2026-11-05','WORLD 새 놀이'],['2026-11-03','아이돌 두 팀']],page+': the new release line opens the list with the publishing day');
  assert.deepEqual(news.rest,[['2026-11-01','상황극 1화'],['2026-10-24','한결'],['2026-10-22','몽골어']],page+': the line it pushed out folds first, the rest keep their order');
  assert.equal(news.more,'3',page+': the fold count stays');
  assert(html.includes('<time datetime="2026-11-10">2026.11.10</time>'),page+': numbers-only label');
  assert(!html.includes('2026-10-31')&&!html.includes('2026.10.31'),page+': the old release date is gone');
  assert(html.includes('KEEP'));assert.deepEqual(footDate(html),['2026-11-10','2026.11.10'],page+': the footer date is not earlier than the newest news');
 }
 for(const page of ['pulse/index.html','en/pulse/index.html','mn/index.html']){assert(changed.includes(page),page);assert.deepEqual(footDate(fs.readFileSync(path.join(directory,page),'utf8')),['2026-11-10','2026.11.10'],page+': every page carries the same footer date');}
 assert.equal(stageSite({publicDir:directory,manifest:release,clientFile:client}).length,0,'a second run changes nothing');
 assert.equal(releaseDay(release),'2026-11-10');
});
test('home news keeps newest first: a line dated after the release stays ahead, and a later footer date never moves back',()=>{
 const release={...sample(),publishedAt:'2026-11-04T01:00:00.000Z'};
 const html=`${homeNews([li('/lab/#world','2026-11-05','LAB','WORLD 새 놀이'),pcLine('2026-11-01','0.4.3'),li('/pulse/casting/','2026-11-03','PULSE','아이돌 두 팀')],[])}${footer('2026-11-12')}`;
 const value=updateFooterDate(updateHomeNews(html,release),release);
 assert.deepEqual(newsOf(value).open.map(r=>r[0]),['2026-11-05','2026-11-04','2026-11-03']);
 assert.equal(newsOf(value).more,undefined,'no fold appears');
 assert.deepEqual(footDate(value),['2026-11-12','2026.11.12']);
 // 소식 구역이 숨었거나(90일 · 3개 규칙) PC 앱 줄이 없으면 그대로, 빌드와 다른 모양이면 공개 전에 멈춘다.
 const hidden='<html><body><section id="platform">Preview 0.4.3</section></body></html>';assert.equal(updateHomeNews(hidden,release),hidden);
 const without=homeNews([li('/lab/#world','2026-11-05','LAB','a'),li('#drama','2026-11-01','LAB','b'),li('/mn/','2026-10-22','SYNK','c')],[]);assert.equal(updateHomeNews(without,release),without);
 assert.throws(()=>updateHomeNews(homeNews([pcLine('2026-11-01','0.4.3')+'\n<!-- x -->'],[]),release),/Unexpected home news markup/);
});
