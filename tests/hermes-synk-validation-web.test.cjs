'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {validateWeb,validateChecks,htmlSyntax,cssSyntax,cssChanges,candidateReader,serverFor,runtime,VIEWPORTS,LIMITS}=require('../tools/hermes-synk/validation-web.cjs');
function fixture(t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-validation-web-')),candidateRoot=path.join(directory,'candidate'),sourceRoot=path.join(directory,'source'),evidenceDir=path.join(directory,'evidence');
  fs.mkdirSync(candidateRoot);fs.mkdirSync(sourceRoot);
  t.after(()=>{const checked=fs.realpathSync(directory),temp=fs.realpathSync(os.tmpdir());assert.ok(checked.startsWith(temp+path.sep)&&path.basename(checked).startsWith('synk-validation-web-'));fs.rmSync(checked,{recursive:true,force:true});});
  const write=(rel,text)=>{const target=path.join(candidateRoot,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);};
  const html=extra=>'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>후보 검증</title><link rel="icon" href="data:,"><link rel="stylesheet" href="style.css"></head><body><main class="panel"><h1>작업 확인</h1><input id="name" aria-label="이름"><button id="run" type="button">확인</button><output id="out">준비</output></main><script src="app.js"></script>'+(extra||'')+'</body></html>';
  write('page.html',html());
  const css='*{box-sizing:border-box}body{margin:0}.panel{padding:12px;max-width:100%;background-color:rgb(10,20,30);color:white}input{max-width:100%}';
  write('style.css',css);
  const baselineCSS=text=>fs.writeFileSync(path.join(sourceRoot,'style.css'),text);
  baselineCSS(css.replace('rgb(10,20,30)','rgb(1,1,1)'));
  write('app.js',"document.querySelector('#run').addEventListener('click',()=>{document.querySelector('#out').textContent=document.querySelector('#name').value+' 완료';});");
  const checks=[{kind:'browser',path:'page.html',steps:[{action:'assert_visible',selector:'.panel'},{action:'assert_style',selector:'.panel',property:'background-color',value:'rgb(10, 20, 30)'},{action:'fill',selector:'#name',value:'테스트'},{action:'click',selector:'#run'},{action:'assert_text',selector:'#out',text:'테스트 완료'}]}];
  return {directory,candidateRoot,sourceRoot,evidenceDir,write,html,checks,baselineCSS,options:{candidateRoot,sourceRoot,evidenceDir,checks,changes:[{path:'page.html',kind:'modify'},{path:'style.css',kind:'modify'}]}};
}
test('browser check accepts only declarative bounded selectors/actions with an assertion per viewport',()=>{
  assert.throws(()=>validateChecks([]),{code:'WEB_BROWSER_CHECK_REQUIRED'});
  for(const steps of [[{action:'evaluate',selector:'body',source:'process.env'}],[{action:'click',selector:'button'}],[{action:'assert_visible',selector:'../private'} ,{action:'eval',selector:'body'}],[{action:'assert_visible',selector:'body',viewport:'desktop'}]]){
    assert.throws(()=>validateChecks([{kind:'browser',path:'page.html',steps}]),error=>/^WEB_/.test(error.code));
  }
  assert.throws(()=>validateChecks([{kind:'browser',path:'../outside.html',steps:[{action:'assert_visible',selector:'body'}]}]),{code:'WEB_CHECK_INVALID'});
});
test('existing parse5/postcss detect HTML, CSS and inline script syntax without installing packages',async()=>{
  const rt=await runtime();
  assert.throws(()=>htmlSyntax('<!doctype html><html><body><div a="1" a="2"></div></body></html>','bad.html',rt.parse5,rt.postcss),{code:'WEB_HTML_SYNTAX_FAILED'});
  assert.throws(()=>htmlSyntax('<!doctype html><html><head></head><body><div><span>누락</body></html>','bad.html',rt.parse5,rt.postcss),{code:'WEB_HTML_SYNTAX_FAILED'});
  assert.throws(()=>cssSyntax('.a{color:red','bad.css',rt.postcss),{code:'WEB_CSS_SYNTAX_FAILED'});
  assert.throws(()=>htmlSyntax('<!doctype html><html><head></head><body><script>const = ;</script></body></html>','bad.html',rt.parse5,rt.postcss),{code:'WEB_INLINE_SCRIPT_SYNTAX_FAILED'});
  assert.throws(()=>htmlSyntax('<!doctype html><html><head></head><body><button onclick="let = ;">확인</button></body></html>','bad.html',rt.parse5,rt.postcss),{code:'WEB_INLINE_SCRIPT_SYNTAX_FAILED'});
});
test('actual Chrome loads changed HTML/CSS, proves an effective style and executes interactions at PC and mobile sizes',async t=>{
  const f=fixture(t),result=await validateWeb(f.options);
  assert.deepEqual(result.exercisedFiles,['page.html','style.css']);
  assert.deepEqual(result.viewports,VIEWPORTS);
  assert.equal(result.checks.length,2);
  assert.equal(result.checks.every(check=>check.passed&&check.appliedStyles.includes('style.css')),true);
  assert.equal(result.artifacts.filter(file=>file.endsWith('.png')).length,2);
  for(const file of result.artifacts)assert.ok(fs.statSync(file).size>0);
  const dom=JSON.parse(fs.readFileSync(result.artifacts.find(file=>file.endsWith('.dom.json')),'utf8'));
  assert.equal(dom.steps.at(-1).action,'assert_text');
  assert.ok(dom.files.every(file=>/^[a-f0-9]{64}$/.test(file.sha256)));
  assert.ok(dom.steps.some(step=>step.sources?.some(source=>source.path==='style.css'&&source.effective)));
  assert.match(dom.dom.html,/테스트 완료/);
  assert.equal(result.transport.candidate,'playwright_route_fulfill');
  assert.equal(result.transport.httpCandidateRequests,0);
  assert.ok(result.transport.fulfilledRequests>=6);
});

test('real Chrome still verifies DOM/styles/interactions when the proxy HTTP listener is closed before launch',async t=>{
  const f=fixture(t);let closed=false;
  const result=await validateWeb({...f.options,serverFactory:async(root,observed)=>{
    const listener=await serverFor(root,observed);
    await new Promise(resolve=>listener.server.close(resolve));closed=!listener.server.listening;
    return listener;
  }});
  assert.equal(closed,true);
  assert.equal(result.checks.length,2);
  assert.equal(result.checks.every(check=>check.passed&&check.transport.httpCandidateRequests===0),true);
  assert.ok(result.transport.fulfilledRequests>=6);
  const dom=JSON.parse(fs.readFileSync(result.artifacts.find(file=>file.endsWith('.dom.json')),'utf8'));
  assert.match(dom.dom.html,/테스트 완료/);
});

test('virtual and direct HTTP responses share the same bounded reader, hashes and private-path rejection',async t=>{
  const f=fixture(t),observed={files:new Map(),failures:[]},listener=await serverFor(f.candidateRoot,observed);
  t.after(()=>new Promise(resolve=>listener.server.close(resolve)));
  const url=listener.origin+'/style.css',host=new URL(listener.origin).host;
  const virtual=listener.read({url,host});
  const actual=await fetch(url);
  assert.equal(virtual.status,200);assert.equal(actual.status,200);
  assert.equal(await actual.text(),virtual.body.toString('utf8'));
  assert.match(observed.files.get('style.css'),/^[a-f0-9]{64}$/);
  assert.equal(observed.httpCandidateRequests,1);assert.equal(observed.fulfilledCandidateRequests,1);
  const hidden=await fetch(listener.origin+'/.tmp/preview.json');
  assert.equal(hidden.status,403);
  assert.equal(listener.read({url:listener.origin+'/..%2foutside.css',host}).status,403);
  assert.equal(listener.read({url,host,method:'POST'}).status,405);
  assert.equal(listener.read({url:'http://127.0.0.1:1/style.css',host:'127.0.0.1:1'}).status,403);
  const limited={files:new Map(),failures:[]},read=candidateReader(f.candidateRoot,limited,{limits:{...LIMITS,requests:1}});
  assert.equal(read({url,host,expectedHost:host}).status,200);
  assert.equal(read({url,host,expectedHost:host}).status,429);
  const bytes={files:new Map(),failures:[]},small=candidateReader(f.candidateRoot,bytes,{limits:{...LIMITS,totalBytes:1}});
  assert.equal(small({url,host,expectedHost:host}).status,413);
});
test('viewport-specific assertions prove responsive rules without requiring identical PC/mobile styles',async t=>{
  const f=fixture(t);
  f.write('style.css','.panel{background-color:rgb(10,20,30)}@media(max-width:600px){.panel{background-color:rgb(30,20,10)}}');
  f.baselineCSS('.panel{background-color:rgb(1,1,1)}@media(max-width:600px){.panel{background-color:rgb(2,2,2)}}');
  f.checks[0].steps=[{action:'assert_visible',selector:'.panel'},
    {action:'assert_style',selector:'.panel',property:'background-color',value:'rgb(10, 20, 30)',viewport:'desktop'},
    {action:'assert_style',selector:'.panel',property:'background-color',value:'rgb(30, 20, 10)',viewport:'mobile'}];
  const result=await validateWeb(f.options);
  assert.equal(result.checks.every(check=>check.appliedStyles.includes('style.css')),true);
});
test('browser errors fail closed and preserve private failure DOM/screenshot evidence',async t=>{
  const f=fixture(t);f.write('app.js',"throw new Error('fixture page failure');");
  f.checks[0].steps=f.checks[0].steps.slice(0,2);
  await assert.rejects(validateWeb(f.options),error=>error.code==='WEB_BROWSER_ERROR'&&error.artifacts.some(file=>file.endsWith('.failed.dom.json'))&&error.artifacts.some(file=>file.endsWith('.png')));
});
test('missing candidate assets and browser-invalid CSS declarations cannot pass',async t=>{
  const f=fixture(t);f.write('page.html',f.html('<img src="missing.png" alt="자료">'));
  await assert.rejects(validateWeb(f.options),error=>['WEB_LOCAL_ASSET_MISSING','WEB_BROWSER_ERROR'].includes(error.code));
  f.write('page.html',f.html());f.write('style.css','.panel{background-color:rgb(10,20,30);color:never-a-real-color}');
  f.baselineCSS('.panel{background-color:rgb(1,1,1);color:red}');
  await assert.rejects(validateWeb(f.options),{code:'WEB_CSS_DECLARATION_INVALID'});
});
test('other loopback ports are blocked before any request reaches the unrelated service',async t=>{
  const f=fixture(t);let hits=0;
  const other=http.createServer((req,res)=>{hits++;res.end('outside candidate');});
  await new Promise(resolve=>other.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>other.close(resolve)));
  f.write('page.html',f.html('<script>fetch("http://127.0.0.1:'+other.address().port+'/private").catch(()=>{});</script>'));
  f.checks[0].steps=f.checks[0].steps.slice(0,2);
  await assert.rejects(validateWeb(f.options),error=>['WEB_EXTERNAL_REQUEST_BLOCKED','WEB_BROWSER_ERROR'].includes(error.code));
  assert.equal(hits,0);
});
test('horizontal overflow is checked at the fixed mobile viewport',async t=>{
  const f=fixture(t);f.write('style.css','.panel{width:900px;background-color:rgb(10,20,30)}');
  f.baselineCSS('.panel{width:800px;background-color:rgb(1,1,1)}');
  await assert.rejects(validateWeb(f.options),{code:'WEB_HORIZONTAL_OVERFLOW'});
});
test('an unloaded changed CSS file and an overridden matched rule provide no execution evidence',async t=>{
  const f=fixture(t);f.write('unused.css','.unused{color:red}');
  await assert.rejects(validateWeb({...f.options,changes:[{path:'unused.css',kind:'add'}]}),{code:'WEB_CHANGED_FILE_NOT_LOADED'});
  f.write('page.html',f.html('<style>.panel{background-color:rgb(10,20,30)!important}</style>'));
  await assert.rejects(validateWeb(f.options),{code:'WEB_CHANGED_CSS_NOT_EXERCISED'});
});
test('a proven old rule cannot hide a newly added unused selector or another untested changed declaration',async t=>{
  const f=fixture(t);f.write('style.css','.panel{background-color:rgb(10,20,30)}.new-but-unused{color:red}');
  f.baselineCSS('.panel{background-color:rgb(1,1,1)}');
  await assert.rejects(validateWeb(f.options),{code:'WEB_CHANGED_CSS_NOT_EXERCISED'});
  f.write('style.css','.panel{background-color:rgb(10,20,30);color:yellow}');
  f.baselineCSS('.panel{background-color:rgb(1,1,1);color:white}');
  await assert.rejects(validateWeb(f.options),{code:'WEB_CHANGED_CSS_NOT_EXERCISED'});
});
test('CSS removals, duplicate changed declarations, unsupported at-rules and shorthand require review',async()=>{
  const rt=await runtime();
  assert.throws(()=>cssChanges('.a{color:red}','.a{}','x.css',rt.postcss),{code:'WEB_CSS_REMOVAL_REVIEW_REQUIRED'});
  assert.throws(()=>cssChanges('.a{color:red}','.a{color:blue;color:green}','x.css',rt.postcss),{code:'WEB_CSS_DUPLICATE_REVIEW_REQUIRED'});
  assert.throws(()=>cssChanges('.a{padding:0}','.a{padding:10px}','x.css',rt.postcss),{code:'WEB_CSS_SHORTHAND_REVIEW_REQUIRED'});
  assert.throws(()=>cssChanges('','@font-face{font-family:Demo;src:url(demo.woff)}','x.css',rt.postcss),{code:'WEB_CSS_AT_RULE_REVIEW_REQUIRED'});
});
test('evidence cannot be written into the candidate and invalid file encodings fail safely',async t=>{
  const f=fixture(t);
  await assert.rejects(validateWeb({...f.options,evidenceDir:path.join(f.candidateRoot,'evidence')}),{code:'WEB_EVIDENCE_INSIDE_CANDIDATE'});
  f.write('style.css',Buffer.from([255,254,123]));
  await assert.rejects(validateWeb(f.options),{code:'WEB_INVALID_ENCODING'});
});
test('only the fixed native preview evidence prefix is writable inside the candidate and .tmp is never served',async t=>{
  const f=fixture(t),relative='.tmp/synk-validation-preview/1792300000000-0123456789/browser-0123456789ab';
  const evidenceDir=path.join(f.candidateRoot,relative);
  const result=await validateWeb({...f.options,evidenceDir});
  assert.ok(result.artifacts.every(file=>file.startsWith(evidenceDir+path.sep)));
  f.write(relative+'/private.json','{"privatePreview":"must not be served"}');
  f.write('page.html',f.html('<script>fetch("/'+relative+'/private.json").catch(()=>{});</script>'));
  f.checks[0].steps=f.checks[0].steps.slice(0,2);
  await assert.rejects(validateWeb({...f.options,evidenceDir}),error=>{
    if(error.code!=='WEB_BROWSER_ERROR')return false;
    const proof=JSON.parse(fs.readFileSync(error.artifacts.find(file=>file.endsWith('.failed.dom.json')),'utf8'));
    return proof.sourceFailures.includes('WEB_LOCAL_ASSET_UNSAFE');
  });
  await assert.rejects(validateWeb({...f.options,evidenceDir:path.join(f.candidateRoot,'.tmp/arbitrary/browser')}),{code:'WEB_EVIDENCE_INSIDE_CANDIDATE'});
});
