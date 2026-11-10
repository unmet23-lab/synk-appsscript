'use strict';
// SYNK ID 공개본(id/dist/app.js · id/index.html)에 이번 포털 고침만 얹은 공개 후보를 만든다.
// 방식은 11-10 PATH 판과 같다: 공개본의 포털 구간(`$ = id => document.getElementById(id)` ~ mountPortal 끝)이
// 바탕 커밋 빌드의 포털 구간과 (알려진 이름 적응 뒤) 바이트까지 같을 때만, 새 빌드의 포털 구간으로 바꿔 끼운다.
// 구간 밖 바이트는 그대로이고, 거꾸로 되돌리면 공개본과 같아야 한다. HTML은 동의 카드 한 줄만 바꾼다.
//   node experiences/synk-account/qa/device-consent-20261111/patch-live.cjs <바탕 커밋> <출력 폴더>
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../../../..'),acorn=require(path.join(repo,'node_modules/acorn'));
const [baseRev,outDir]=process.argv.slice(2);if(!baseRev||!outDir)throw Error('Use: patch-live.cjs <base commit> <output folder>');
const bare=path.join(process.env.USERPROFILE||require('node:os').homedir(),'Documents/synk-vendor/synk-policy-publish.git');
const git=(args,options={})=>execFileSync('git',args,{cwd:repo,maxBuffer:64*1024*1024,...options});
const live=args=>git(['--git-dir='+bare,...args]);
git(['--git-dir='+bare,'fetch','-q','origin','main']);
const pinned=live(['rev-parse','origin/main']).toString().trim();
const app='experiences/synk-account/dist/app.js';
const before=git(['show',baseRev+':'+app]).toString('utf8').replace(/\r\n/g,'\n'),after=fs.readFileSync(path.join(repo,app),'utf8').replace(/\r\n/g,'\n');
const existing=live(['show',pinned+':id/dist/app.js']).toString('utf8');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function portal(code){
  const tree=acorn.parse(code,{ecmaVersion:'latest'}),owners=[];
  (function scan(node){if(!node||typeof node!=='object')return;if(node.type==='BlockStatement'&&node.body.some(item=>item.type==='FunctionDeclaration'&&item.id.name==='mountPortal'))owners.push(node.body);
    for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(scan);else if(value?.type)scan(value);}})(tree);
  if(owners.length!==1)throw Error('Unexpected portal function count');
  const body=owners[0],mount=body.find(item=>item.type==='FunctionDeclaration'&&item.id.name==='mountPortal');
  const labels=body.findIndex(item=>item.type==='VariableDeclaration'&&item.declarations.some(d=>d.id.name==='AUTH_LABELS'));
  if(!mount||labels<1)throw Error('No unique SYNK ID portal region');
  const selector=body.slice(0,labels).findLast(item=>item.type==='VariableDeclaration'&&/=>document\.getElementById\(id\)/.test(code.slice(item.start,item.end)));
  if(!selector||selector.end>mount.start)throw Error('Portal selector boundary not found');
  return {start:selector.start,end:mount.end,chunk:code.slice(selector.start,mount.end)};
}
const old=portal(before),next=portal(after),publicOld=portal(existing);
// The public bundle reads the account client through its deferred wrapper and keeps some
// scoped names unnumbered. Only these adaptations are allowed; the exact preimage check proves it.
function publicBinding(chunk){
  let value=chunk;
  if(value.split('accountFactory=import_account_client.createAccountClient').length===2)value=value.replace('accountFactory=import_account_client.createAccountClient','accountFactory=createAccountClient');
  return value.replace(/\bversion5\b/g,'version');
}
const publicBefore=publicBinding(old.chunk),publicAfter=publicBinding(next.chunk);
const report={pinned,baseRev,beforePortal:sha(old.chunk),publicBeforePortal:sha(publicOld.chunk),sourcePortal:sha(next.chunk),
  buildOutsideRegionUnchanged:before.slice(0,old.start)===after.slice(0,next.start)&&before.slice(old.end)===after.slice(next.end),publicPortalMatchesSourceBefore:publicBefore===publicOld.chunk};
if(!report.buildOutsideRegionUnchanged||!report.publicPortalMatchesSourceBefore){
  const tokens=text=>[...acorn.tokenizer(text,{ecmaVersion:'latest'})].map(token=>[token.type.label,text.slice(token.start,token.end)]);
  const built=tokens(publicBefore),shown=tokens(publicOld.chunk);
  console.log(JSON.stringify({...report,tokenCounts:[built.length,shown.length],differences:built.flatMap((token,index)=>JSON.stringify(token)===JSON.stringify(shown[index])?[]:[{index,built:token,public:shown[index]}]).slice(0,12)},null,2));
  throw Error('Live portal region does not exactly match the build base; no public output.');
}
const newBundle=existing.slice(0,publicOld.start)+publicAfter+existing.slice(publicOld.end);
acorn.parse(newBundle,{ecmaVersion:'latest'});
if(newBundle.slice(0,publicOld.start)+publicBefore+newBundle.slice(publicOld.start+publicAfter.length)!==existing)throw Error('Portal overlay not reversible');
// HTML: only the consent card gains the account line and the device note (the same text as the source index.html).
const oldHtml=live(['show',pinned+':id/index.html']).toString('utf8');
const source=fs.readFileSync(path.join(repo,'experiences/synk-account/index.html'),'utf8');
const anchor='<h2><span id="consent-name"></span>에 연결할까요?</h2>';
const added=source.slice(source.indexOf(anchor)+anchor.length,source.indexOf('<p>아래 정보를 이 앱에 넘겨요.',source.indexOf(anchor)));
if(!added.startsWith('<p id="consent-account" hidden></p><p id="consent-native" class="small" hidden>')||oldHtml.split(anchor).length!==2||oldHtml.includes('consent-native'))throw Error('Public HTML preimage mismatch');
const newHtml=oldHtml.replace(anchor,anchor+added);
if(newHtml.replace(anchor+added,anchor)!==oldHtml)throw Error('HTML overlay not reversible');
fs.mkdirSync(path.join(outDir,'id/dist'),{recursive:true});
for(const [name,body] of [['id/index.html',newHtml],['id/dist/app.js',newBundle]])fs.writeFileSync(path.join(outDir,name),body,{flag:'wx'});
report.files={'id/index.html':{before:sha(oldHtml),after:sha(newHtml)},'id/dist/app.js':{before:sha(existing),after:sha(newBundle)}};report.reversible=true;
fs.writeFileSync(path.join(outDir,'overlay-proof.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report,null,2));
