'use strict';
// Static candidate verification only. No personal browser profile, external
// network, project server, agent JavaScript callback or shell command is used.
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {safeSource,rejectSecrets}=require('./workspace.cjs');
const VIEWPORTS=Object.freeze([{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]);
const LIMITS=Object.freeze({pages:4,steps:40,fileBytes:4*1024*1024,requests:2000,totalBytes:64*1024*1024,domBytes:512*1024});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const SHORTHANDS=new Set(('all animation background border border-block border-block-color border-block-style border-block-width border-bottom border-color border-image border-inline border-inline-color border-inline-style border-inline-width border-left border-radius border-right border-style border-top border-width columns column-rule container flex flex-flow font font-synthesis font-variant gap grid grid-area grid-column grid-row grid-template inset inset-block inset-inline list-style margin margin-block margin-inline mask offset outline overflow padding padding-block padding-inline place-content place-items place-self scroll-margin scroll-margin-block scroll-margin-inline scroll-padding scroll-padding-block scroll-padding-inline text-decoration text-emphasis transition').split(' '));
class WebAttention extends Error{constructor(code,artifacts=[]){super(code);this.code=code;this.artifacts=artifacts;}}
let runtimePromise;
async function runtime(){
  if(!runtimePromise)runtimePromise=(async()=>{
    try{
      const bundled=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
      const documents=path.resolve(__dirname,'../../..');
      const playwright=require(require.resolve('playwright',{paths:[bundled]}));
      const parser=await import(pathToFileURL(require.resolve('parse5',{paths:[path.join(documents,'SYNK-website')]})).href);
      const postcss=require(require.resolve('postcss',{paths:[path.join(documents,'SYNK-talk')]}));
      const executablePath=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(file=>fs.existsSync(file));
      if(!executablePath)throw new Error('missing');
      return {chromium:playwright.chromium,parse5:parser,postcss,executablePath};
    }catch{throw new WebAttention('WEB_RUNTIME_UNAVAILABLE');}
  })();
  return runtimePromise;
}
function relative(value){return typeof value==='string'&&safeSource(value)&&value.length<=1024;}
function regular(root,rel){
  if(!relative(rel))throw new WebAttention('WEB_UNSAFE_PATH');
  let file=root;
  for(const part of rel.split('/')){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw new WebAttention('WEB_SYMLINK');}
  const stat=fs.statSync(file);
  if(!stat.isFile()||stat.size>LIMITS.fileBytes)throw new WebAttention('WEB_FILE_LIMIT');
  return file;
}
function textFile(root,rel){
  const bytes=fs.readFileSync(regular(root,rel));let text;
  try{text=new TextDecoder('utf8',{fatal:true}).decode(bytes);}
  catch{throw new WebAttention('WEB_INVALID_ENCODING');}
  try{rejectSecrets(bytes);}catch{throw new WebAttention('WEB_UNSAFE_CONTENT');}
  return {text,sha256:hash(bytes),bytes};
}
function validateChecks(checks){
  if(!Array.isArray(checks)||!checks.length||checks.length>LIMITS.pages)throw new WebAttention('WEB_BROWSER_CHECK_REQUIRED');
  const actions=new Set(['assert_visible','assert_text','assert_style','assert_count','click','fill']);
  return checks.map(check=>{
    if(check?.kind!=='browser'||!relative(check.path)||!['.html','.htm'].includes(path.posix.extname(check.path).toLowerCase())||!Array.isArray(check.steps)||!check.steps.length||check.steps.length>LIMITS.steps)throw new WebAttention('WEB_CHECK_INVALID');
    let assertions=0;
    const steps=check.steps.map(step=>{
      if(!step||!actions.has(step.action)||typeof step.selector!=='string'||!step.selector.trim()||step.selector.length>500||step.selector.includes('>>')||/^(?:xpath|text|role|id|data-testid)=/i.test(step.selector))throw new WebAttention('WEB_CHECK_INVALID');
      const clean={action:step.action,selector:step.selector};
      if(step.viewport!==undefined){if(!VIEWPORTS.some(viewport=>viewport.name===step.viewport))throw new WebAttention('WEB_CHECK_INVALID');clean.viewport=step.viewport;}
      if(step.action.startsWith('assert_'))assertions++;
      if(step.action==='assert_text'){
        if(typeof step.text!=='string'||!step.text||step.text.length>2000)throw new WebAttention('WEB_CHECK_INVALID');clean.text=step.text;
      }
      if(step.action==='assert_style'){
        if(typeof step.property!=='string'||!/^--?[a-z][a-z0-9-]*$|^[a-z][a-z0-9-]*$/.test(step.property)||typeof step.value!=='string'||!step.value||step.value.length>1000)throw new WebAttention('WEB_CHECK_INVALID');
        clean.property=step.property;clean.value=step.value;
      }
      if(step.action==='fill'){
        if(typeof step.value!=='string'||step.value.length>2000)throw new WebAttention('WEB_CHECK_INVALID');clean.value=step.value;
      }
      if(step.action==='assert_count'){
        if(!Number.isInteger(step.count)||step.count<0||step.count>1000)throw new WebAttention('WEB_CHECK_INVALID');clean.count=step.count;
      }
      return clean;
    });
    if(!assertions)throw new WebAttention('WEB_ASSERTION_REQUIRED');
    if(VIEWPORTS.some(viewport=>!steps.some(step=>step.action.startsWith('assert_')&&(!step.viewport||step.viewport===viewport.name))))throw new WebAttention('WEB_ASSERTION_REQUIRED');
    return {kind:'browser',path:check.path,steps};
  });
}
function cssSyntax(text,source,postcss){
  let tree;try{tree=postcss.parse(text,{from:source});}catch{throw new WebAttention('WEB_CSS_SYNTAX_FAILED');}
  const declarations=[];
  tree.walkDecls(decl=>{
    let parent=decl.parent,descriptor=false;
    while(parent){if(parent.type==='atrule'&&['font-face','property','counter-style','font-feature-values','page'].includes(parent.name.toLowerCase()))descriptor=true;parent=parent.parent;}
    if(!descriptor&&!decl.prop.startsWith('--'))declarations.push({property:decl.prop,value:decl.value});
  });
  return declarations;
}
function cssDeclarations(text,source,postcss){
  cssSyntax(text,source,postcss);
  const tree=postcss.parse(text,{from:source}),rows=new Map(),statements=[];
  tree.walkAtRules(rule=>{if(!rule.nodes)statements.push([rule.name,rule.params]);});
  tree.walkDecls(decl=>{
    const conditions=[];let parent=decl.parent;
    while(parent&&parent.type!=='root'){if(parent.type==='atrule')conditions.unshift([parent.name,parent.params]);parent=parent.parent;}
    const selectors=decl.parent.type==='rule'?decl.parent.selectors:[''];
    for(const selector of selectors){
      const key=JSON.stringify([conditions,selector.trim(),decl.prop]);
      const row={key,selector:selector.trim(),property:decl.prop,value:decl.value,important:!!decl.important,conditions,
        start:decl.source.start.offset,end:decl.source.end.offset};
      if(rows.has(key))rows.get(key).duplicates=true;else rows.set(key,row);
    }
  });
  return {rows,statements};
}
function cssChanges(before,after,source,postcss){
  const old=cssDeclarations(before,source,postcss),current=cssDeclarations(after,source,postcss),changed=[];
  if(JSON.stringify(old.statements)!==JSON.stringify(current.statements))throw new WebAttention('WEB_CSS_AT_RULE_REVIEW_REQUIRED');
  for(const [key]of old.rows)if(!current.rows.has(key))throw new WebAttention('WEB_CSS_REMOVAL_REVIEW_REQUIRED');
  for(const [key,row]of current.rows){
    const prior=old.rows.get(key);
    if(prior&&prior.value===row.value&&prior.important===row.important&&!prior.duplicates&&!row.duplicates)continue;
    if(row.duplicates||prior?.duplicates)throw new WebAttention('WEB_CSS_DUPLICATE_REVIEW_REQUIRED');
    if(!row.selector||row.conditions.some(([name])=>!['media','supports','layer','container'].includes(name.toLowerCase())))throw new WebAttention('WEB_CSS_AT_RULE_REVIEW_REQUIRED');
    if(SHORTHANDS.has(row.property))throw new WebAttention('WEB_CSS_SHORTHAND_REVIEW_REQUIRED');
    changed.push({...row,path:source,sourceSha256:hash(after)});
    if(changed.length>100)throw new WebAttention('WEB_CSS_DECLARATION_LIMIT');
  }
  return changed;
}
function htmlSyntax(text,source,parse5,postcss){
  const errors=[];
  const document=parse5.parse(text,{sourceCodeLocationInfo:true,onParseError:error=>errors.push(error.code)});
  if(errors.length)throw new WebAttention('WEB_HTML_SYNTAX_FAILED');
  const css=[];
  const omitted=new Set('html head body li dt dd p rt rp optgroup option colgroup thead tbody tfoot tr td th'.split(' '));
  const voids=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  function visit(node){
    const attrs=Object.fromEntries((node.attrs||[]).map(attr=>[attr.name,attr.value]));
    const location=node.sourceCodeLocation;
    if(location?.startTag&&!location.endTag&&!omitted.has(node.tagName)&&!voids.has(node.tagName)){
      const foreign=node.namespaceURI&&node.namespaceURI!=='http://www.w3.org/1999/xhtml';
      if(!foreign||!text.slice(location.startTag.startOffset,location.startTag.endOffset).endsWith('/>'))throw new WebAttention('WEB_HTML_SYNTAX_FAILED');
    }
    if(node.tagName==='style')css.push(...cssSyntax((node.childNodes||[]).map(child=>child.value||'').join(''),source+'#inline',postcss));
    if(attrs.style)css.push(...cssSyntax('x{'+attrs.style+'}',source+'#style',postcss));
    if(node.tagName==='script'&&!attrs.src){
      const type=(attrs.type||'').toLowerCase(),script=(node.childNodes||[]).map(child=>child.value||'').join('');
      try{
        if(!type||['text/javascript','application/javascript'].includes(type))new vm.Script(script,{filename:'candidate-inline.js'});
        else if(['application/json','application/ld+json'].includes(type))JSON.parse(script);
      }catch{throw new WebAttention('WEB_INLINE_SCRIPT_SYNTAX_FAILED');}
    }
    for(const [name,value]of Object.entries(attrs))if(/^on[a-z]+$/.test(name)){try{new vm.Script('(function(event){'+value+'\n})');}catch{throw new WebAttention('WEB_INLINE_SCRIPT_SYNTAX_FAILED');}}
    for(const child of node.childNodes||[])visit(child);
    if(node.content)visit(node.content);
  }
  visit(document);return css;
}
function evidenceFolder(candidateRoot,evidenceDir){
  if(typeof evidenceDir!=='string'||!path.isAbsolute(evidenceDir))throw new WebAttention('WEB_EVIDENCE_PATH_REQUIRED');
  const target=path.resolve(evidenceDir),rel=path.relative(candidateRoot,target);
  const inside=!rel||rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);
  const preview=/^\.tmp\/synk-validation-preview\/\d{13}-[a-f0-9]{10}\/browser(?:-[a-f0-9]{12})?$/.test(rel.replaceAll('\\','/'));
  if(inside&&!preview)throw new WebAttention('WEB_EVIDENCE_INSIDE_CANDIDATE');
  let ancestor=target;
  while(!fs.existsSync(ancestor)){const parent=path.dirname(ancestor);if(parent===ancestor)throw new WebAttention('WEB_EVIDENCE_PATH_REQUIRED');ancestor=parent;}
  let current=path.parse(ancestor).root;
  for(const part of path.relative(current,ancestor).split(path.sep).filter(Boolean)){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw new WebAttention('WEB_SYMLINK');}
  fs.mkdirSync(target,{recursive:true});return fs.mkdtempSync(path.join(target,'web-'));
}
const MIME={'.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
function candidateReader(root,observed,{limits=LIMITS}={}){
  let count=0,total=0;
  observed.httpCandidateRequests=0;observed.fulfilledCandidateRequests=0;
  return ({url,method='GET',host,expectedHost,transport})=>{
    const fail=(status,code,record=true)=>{if(record){observed.failureCount=(observed.failureCount||0)+1;if(observed.failures.length<100)observed.failures.push(code);}return {status,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'},body:Buffer.from(code)};};
    if(++count>limits.requests)return fail(429,'WEB_REQUEST_LIMIT');
    if(host!==expectedHost)return fail(403,'WEB_ORIGIN_BLOCKED',false);
    if(!['GET','HEAD'].includes(method))return fail(405,'WEB_METHOD_BLOCKED');
    let rel;try{const parsed=new URL(url,'http://'+expectedHost);if(parsed.origin!=='http://'+expectedHost)return fail(403,'WEB_ORIGIN_BLOCKED',false);rel=decodeURIComponent(parsed.pathname).slice(1);}catch{return fail(400,'WEB_UNSAFE_PATH');}
    if(transport==='http')observed.httpCandidateRequests++;else if(transport==='route')observed.fulfilledCandidateRequests++;
    try{
      const file=textFile(root,rel);total+=file.bytes.length;if(total>limits.totalBytes)return fail(413,'WEB_TRANSFER_LIMIT');
      observed.files.set(rel,file.sha256);
      return {status:200,headers:{'Content-Type':MIME[path.posix.extname(rel).toLowerCase()]||'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'none'"},body:method==='HEAD'?Buffer.alloc(0):file.bytes};
    }catch(error){return fail(error.code==='ENOENT'?404:403,error.code==='ENOENT'?'WEB_LOCAL_ASSET_MISSING':'WEB_LOCAL_ASSET_UNSAFE');}
  };
}
async function serverFor(root,observed){
  const read=candidateReader(root,observed);let expectedHost;
  const server=http.createServer((req,res)=>{
    const result=read({url:req.url,method:req.method,host:req.headers.host,expectedHost,transport:'http'});
    res.writeHead(result.status,result.headers);res.end(result.body);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  expectedHost='127.0.0.1:'+server.address().port;
  return {server,origin:'http://'+expectedHost,read:request=>read({...request,expectedHost,transport:'route'})};
}
function localPath(url,origin){try{const parsed=new URL(url);return parsed.origin===origin?decodeURIComponent(parsed.pathname).slice(1):null;}catch{return null;}}
async function styleSources(cdp,rootNode,selector,property,sheets,origin){
  const selected=await cdp.send('DOM.querySelector',{nodeId:rootNode,selector});
  if(!selected.nodeId)return [];
  const styles=await cdp.send('CSS.getMatchedStylesForNode',{nodeId:selected.nodeId});
  const result=[];
  for(const match of styles.matchedCSSRules||[]){
    const rule=match.rule,header=sheets.get(rule.styleSheetId||rule.style?.styleSheetId),rel=localPath(header?.sourceURL||'',origin);
    if(!rel||!rule.style?.cssProperties?.some(decl=>decl.name===property&&!decl.disabled&&decl.parsedOk!==false))continue;
    result.push({path:rel,url:header.sourceURL,selectors:(match.matchingSelectors||[]).map(index=>rule.selectorList?.selectors?.[index]?.text).filter(Boolean)});
  }
  return result;
}
async function proveDeclaration(page,locator,delta,cdp,sheets,origin){
  const matches=[...sheets.values()].filter(header=>localPath(header.sourceURL,origin)===delta.path);
  for(const header of matches){
    const {text}=await cdp.send('CSS.getStyleSheetText',{styleSheetId:header.styleSheetId});
    if(hash(text)!==delta.sourceSha256)throw new WebAttention('WEB_CSS_SOURCE_MISMATCH');
    const before=await locator.evaluate((node,property)=>getComputedStyle(node).getPropertyValue(property).trim(),delta.property);
    const removed=text.slice(0,delta.start)+text.slice(delta.start,delta.end).replace(/[^\r\n]/g,' ')+text.slice(delta.end);
    try{
      await cdp.send('CSS.setStyleSheetText',{styleSheetId:header.styleSheetId,text:removed});
      const without=await locator.evaluate((node,property)=>getComputedStyle(node).getPropertyValue(property).trim(),delta.property);
      if(without!==before)return true;
    }finally{await cdp.send('CSS.setStyleSheetText',{styleSheetId:header.styleSheetId,text});}
  }
  return false;
}
async function executeStep(page,step,cdp,sheets,origin,deltas){
  const locator=page.locator('css='+step.selector);
  let count=await locator.count();
  if(step.action==='assert_count'){
    if(count!==step.count)throw new WebAttention('WEB_ASSERT_COUNT_FAILED');
    return {action:step.action,selector:step.selector,count};
  }
  if(count!==1)throw new WebAttention('WEB_SELECTOR_NOT_UNIQUE');
  if(step.action==='click'){await locator.click({timeout:3000});return {action:'click',selector:step.selector};}
  if(step.action==='fill'){await locator.fill(step.value,{timeout:3000});return {action:'fill',selector:step.selector};}
  if(!await locator.isVisible())throw new WebAttention('WEB_ASSERT_VISIBLE_FAILED');
  const result={action:step.action,selector:step.selector,visible:true};
  if(step.action==='assert_text'){
    const text=(await locator.innerText()).replace(/\s+/g,' ').trim();
    if(!text.includes(step.text))throw new WebAttention('WEB_ASSERT_TEXT_FAILED');
    result.textSha256=hash(text);result.expectedTextSha256=hash(step.text);
  }
  if(step.action==='assert_style'){
    const actual=await locator.evaluate((node,property)=>getComputedStyle(node).getPropertyValue(property).trim(),step.property);
    if(actual!==step.value)throw new WebAttention('WEB_ASSERT_STYLE_FAILED');
    const document=await cdp.send('DOM.getDocument');
    result.property=step.property;result.value=actual;
    result.sources=await styleSources(cdp,document.root.nodeId,step.selector,step.property,sheets,origin);
    const proof=await locator.evaluate((node,input)=>input.sources.map(source=>{
      const sheets=[...document.styleSheets].filter(sheet=>sheet.href===source.url),before=getComputedStyle(node).getPropertyValue(input.property).trim();
      const old=sheets.map(sheet=>sheet.disabled);
      try{sheets.forEach(sheet=>{sheet.disabled=true;});return {path:source.path,effective:sheets.length>0&&getComputedStyle(node).getPropertyValue(input.property).trim()!==before};}
      finally{sheets.forEach((sheet,index)=>{sheet.disabled=old[index];});}
    }),{property:step.property,sources:result.sources});
    result.sources=result.sources.map(source=>({path:source.path,selectors:source.selectors,effective:proof.some(item=>item.path===source.path&&item.effective)}));
    result.declarations=[];
    for(const delta of deltas.filter(item=>item.selector===step.selector&&item.property===step.property)){
      if(await proveDeclaration(page,locator,delta,cdp,sheets,origin))result.declarations.push({path:delta.path,key:delta.key,effective:true});
    }
  }
  const box=await locator.boundingBox();if(box)result.box=Object.fromEntries(Object.entries(box).map(([key,value])=>[key,Math.round(value*100)/100]));
  return result;
}
async function validateWeb({candidateRoot,sourceRoot,changes,checks,evidenceDir,serverFactory=serverFor}={}){
  let folder,browser,server,observed,reason=null;
  const transport=()=>({candidate:'playwright_route_fulfill',fulfilledRequests:observed?.fulfilledCandidateRequests||0,httpCandidateRequests:observed?.httpCandidateRequests||0});
  const artifacts=[],results=[],exercised=new Set(),served=new Map();
  try{
    if(typeof candidateRoot!=='string'||!path.isAbsolute(candidateRoot)||fs.lstatSync(candidateRoot).isSymbolicLink())throw new WebAttention('WEB_UNSAFE_CANDIDATE');
    candidateRoot=fs.realpathSync(candidateRoot);
    const specs=validateChecks(checks);
    if(!Array.isArray(changes)||changes.length>100)throw new WebAttention('WEB_CHANGES_INVALID');
    const changed=changes.map(item=>typeof item==='string'?{path:item}:item).filter(item=>/\.(?:html?|css)$/i.test(item.path||''));
    if(changed.some(item=>!relative(item.path)||['delete','deleted','D'].includes(item.kind)))throw new WebAttention('WEB_CHANGES_INVALID');
    const rt=await runtime(),declarations=new Map(),deltas=[];
    folder=evidenceFolder(candidateRoot,evidenceDir);
    for(const item of changed){
      const file=textFile(candidateRoot,item.path),css=/\.css$/i.test(item.path);
      declarations.set(item.path,css?cssSyntax(file.text,item.path,rt.postcss):htmlSyntax(file.text,item.path,rt.parse5,rt.postcss));
      if(css){
        if(typeof sourceRoot!=='string'||!path.isAbsolute(sourceRoot)||fs.lstatSync(sourceRoot).isSymbolicLink())throw new WebAttention('WEB_CSS_BASELINE_REQUIRED');
        const originalRoot=fs.realpathSync(sourceRoot);
        if(originalRoot.toLowerCase()===candidateRoot.toLowerCase())throw new WebAttention('WEB_CSS_BASELINE_REQUIRED');
        let prior='';try{prior=textFile(originalRoot,item.path).text;}catch(error){if(error.code!=='ENOENT'||item.kind!=='add')throw error;}
        deltas.push(...cssChanges(prior,file.text,item.path,rt.postcss));
      }
    }
    for(const spec of specs){const file=textFile(candidateRoot,spec.path);declarations.set(spec.path,htmlSyntax(file.text,spec.path,rt.parse5,rt.postcss));}
    observed={files:served,failures:[]};const listener=await serverFactory(candidateRoot,observed);server=listener.server;
    const origin=listener.origin;
    // The same non-forwarding candidate server is also the browser-wide proxy.
    // Background requests cannot bypass page routing to reach another host.
    browser=await rt.chromium.launch({headless:true,executablePath:rt.executablePath,proxy:{server:origin},args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-domain-reliability','--force-webrtc-ip-handling-policy=disable_non_proxied_udp','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
    for(let index=0;index<specs.length;index++)for(const viewport of VIEWPORTS){
      const spec=specs[index],errors=[],external=[],sheets=new Map(),pageFiles=new Map(),styleApplied=new Set();
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},isMobile:viewport.name==='mobile',deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false});
      let page;
      try{
        if(typeof context.routeWebSocket==='function')await context.routeWebSocket('**/*',socket=>{external.push('websocket');socket.close();});
        await context.route('**/*',route=>{
          const request=route.request(),url=request.url();
          if(url.startsWith('data:')||url.startsWith('blob:'))return route.continue();
          if(localPath(url,origin)===null||!['GET','HEAD'].includes(request.method())){external.push('request');return route.abort('blockedbyclient');}
          // Fulfill over the existing Playwright pipe: the sandboxed browser
          // never needs a socket connection to the candidate HTTP origin.
          const result=listener.read({url,method:request.method(),host:new URL(url).host});
          return route.fulfill({status:result.status,headers:result.headers,body:result.body});
        });
        page=await context.newPage();page.setDefaultTimeout(3000);page.setDefaultNavigationTimeout(5000);
        context.on('page',other=>{if(other!==page){errors.push('popup');other.close().catch(()=>{});}});
        page.on('console',message=>{if(message.type()==='error')errors.push('console');});
        page.on('pageerror',()=>errors.push('pageerror'));
        page.on('dialog',dialog=>{errors.push('dialog');dialog.dismiss().catch(()=>{});});
        page.on('download',download=>{errors.push('download');download.cancel().catch(()=>{});});
        page.on('requestfailed',()=>errors.push('requestfailed'));
        page.on('response',response=>{const rel=localPath(response.url(),origin);if(response.status()>=400)errors.push('http');if(rel&&response.ok())pageFiles.set(rel,served.get(rel));});
        const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
        cdp.on('CSS.styleSheetAdded',({header})=>sheets.set(header.styleSheetId,header));
        const response=await page.goto(origin+'/'+spec.path.split('/').map(encodeURIComponent).join('/'),{waitUntil:'load'});
        if(!response?.ok()||localPath(page.url(),origin)!==spec.path)throw new WebAttention('WEB_NAVIGATION_FAILED');
        await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);
        const steps=[];
        for(const step of spec.steps){
          if(step.viewport&&step.viewport!==viewport.name)continue;
          const result=await executeStep(page,step,cdp,sheets,origin,deltas);steps.push(result);
          for(const source of result.sources||[])if(source.effective)styleApplied.add(source.path);
        }
        await page.waitForTimeout(80);
        for(const [rel,sha256]of pageFiles){
          if(!declarations.has(rel)&&/\.(?:html?|css)$/i.test(rel)){
            const file=textFile(candidateRoot,rel);declarations.set(rel,/\.css$/i.test(rel)?cssSyntax(file.text,rel,rt.postcss):htmlSyntax(file.text,rel,rt.parse5,rt.postcss));
          }
          if(sha256!==textFile(candidateRoot,rel).sha256)throw new WebAttention('WEB_CANDIDATE_CHANGED');
        }
        const used=[...pageFiles.keys()].flatMap(rel=>declarations.get(rel)||[]);
        const supported=await page.evaluate(decls=>decls.every(decl=>CSS.supports(decl.property,decl.value)),used);
        if(!supported)throw new WebAttention('WEB_CSS_DECLARATION_INVALID');
        const layout=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body?.scrollWidth||0,images:[...document.images].filter(img=>!img.complete||img.naturalWidth===0).length}));
        if(layout.scrollWidth>viewport.width+1||layout.bodyWidth>viewport.width+1)throw new WebAttention('WEB_HORIZONTAL_OVERFLOW');
        if(layout.images)throw new WebAttention('WEB_LOCAL_ASSET_MISSING');
        if(external.length)throw new WebAttention('WEB_EXTERNAL_REQUEST_BLOCKED');
        if(errors.length||observed.failures.length)throw new WebAttention('WEB_BROWSER_ERROR');
        const prefix=index+'-'+viewport.name,screenshot=path.join(folder,prefix+'.png'),domFile=path.join(folder,prefix+'.dom.json');
        await page.screenshot({path:screenshot,fullPage:false,animations:'disabled'});
        const dom=await page.evaluate(limit=>({title:document.title,html:document.documentElement.outerHTML.slice(0,limit),truncated:document.documentElement.outerHTML.length>limit}),LIMITS.domBytes);
        const detail={page:spec.path,viewport,layout,steps,files:[...pageFiles].map(([path,sha256])=>({path,sha256})),appliedStyles:[...styleApplied].sort(),transport:transport(),dom};
        fs.writeFileSync(domFile,JSON.stringify(detail,null,2)+'\n',{flag:'wx',mode:0o600});artifacts.push(screenshot,domFile);
        results.push({kind:'browser',path:spec.path,viewport:viewport.name,passed:true,assertions:steps.filter(step=>step.action.startsWith('assert_')).length,loadedFiles:[...pageFiles.keys()],appliedStyles:[...styleApplied].sort(),exercisedDeclarations:steps.flatMap(step=>step.declarations||[]),transport:transport(),artifacts:[screenshot,domFile]});
      }catch(error){
        if(page){
          const prefix=index+'-'+viewport.name+'.failed',screenshot=path.join(folder,prefix+'.png'),domFile=path.join(folder,prefix+'.dom.json');
          try{await page.screenshot({path:screenshot,fullPage:false,animations:'disabled',timeout:2000});artifacts.push(screenshot);}catch{}
          try{const dom=await page.evaluate(limit=>({html:document.documentElement.outerHTML.slice(0,limit),truncated:document.documentElement.outerHTML.length>limit}),LIMITS.domBytes);fs.writeFileSync(domFile,JSON.stringify({page:spec.path,viewport,reason_code:error.code||'WEB_VALIDATION_UNAVAILABLE',errors:[...new Set(errors)],sourceFailures:[...new Set(observed.failures)],blockedRequests:external.length,dom},null,2)+'\n',{flag:'wx',mode:0o600});artifacts.push(domFile);}catch{}
        }
        throw error;
      }finally{await context.close();}
    }
    for(const item of changed){
      const html=/\.html?$/i.test(item.path);
      for(const viewport of VIEWPORTS){
        const relevant=results.filter(result=>result.viewport===viewport.name&&result.loadedFiles.includes(item.path));
        if(!relevant.length)throw new WebAttention('WEB_CHANGED_FILE_NOT_LOADED');
      }
      if(!html&&deltas.filter(delta=>delta.path===item.path).some(delta=>!results.some(result=>result.exercisedDeclarations.some(proof=>proof.path===delta.path&&proof.key===delta.key))))throw new WebAttention('WEB_CHANGED_CSS_NOT_EXERCISED');
      exercised.add(item.path);
    }
    return {checks:results,exercisedFiles:[...exercised].sort(),artifacts,viewports:VIEWPORTS.map(item=>({...item})),transport:transport(),coverage:'정적 후보의 구문·DOM·지정 상호작용·레이아웃 검증. 미감·학습효과·공개·실기기 결과는 판정하지 않음.'};
  }catch(error){reason=/^WEB_[A-Z_]+$/.test(error.code||'')?error.code:'WEB_VALIDATION_UNAVAILABLE';throw new WebAttention(reason,artifacts);}
  finally{
    if(browser)await browser.close().catch(()=>{});
    if(server?.listening)await new Promise(resolve=>server.close(resolve));
    if(folder){const file=path.join(folder,'result.json');fs.writeFileSync(file,JSON.stringify({version:1,passed:reason===null,reason_code:reason,checks:results,artifacts,sourceFiles:[...served].map(([path,sha256])=>({path,sha256})),viewports:VIEWPORTS,transport:transport()},null,2)+'\n',{flag:'wx',mode:0o600});}
  }
}
module.exports={validateWeb,validateChecks,htmlSyntax,cssSyntax,cssChanges,candidateReader,serverFor,runtime,VIEWPORTS,LIMITS,WebAttention};
