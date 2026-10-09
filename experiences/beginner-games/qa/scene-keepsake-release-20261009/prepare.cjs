'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../../../..'),qa=__dirname,publicRepo='C:/Users/q1212/Documents/synk-policy';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),git=args=>cp.execFileSync('git',args,{cwd:publicRepo,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},windowsHide:true,maxBuffer:32*1024*1024});
const source=(dir,rel)=>path.join(root,'experiences',dir,rel),archive=p=>path.join(root,'experiences',p);
const specs=[];
for(const rel of ['app.mjs','core.mjs','index.html','style.css'])specs.push({dir:'word-magic',rel,before:`word-magic/qa/return-memory-20261009/source/${rel}.before`});
specs.push({dir:'word-magic',rel:'shop.mjs',before:'beginner-games/qa/return-finish-20261009/source/magic-shop.before.mjs'});
for(const rel of ['recall.mjs','keepsakes.mjs','keepsake-view.mjs'])specs.push({dir:'word-magic',rel,new:true});
for(const rel of ['beginner.mjs','beginner-core.mjs','beginner-shop.mjs','beginner.css'])specs.push({dir:'order-rush',rel,before:`order-rush/qa/return-loop-20261009/source/${rel.replace(/(\.[^.]+)$/,' .before$1').replace(' ','')}`});
specs.push({dir:'order-rush',rel:'beginner-return.mjs',new:true});
for(const rel of ['app.mjs','starbook.mjs','shop.mjs','style.css','shop.css'])specs.push({dir:'spaceship-coop',rel,before:`spaceship-coop/qa/return-recall-20261009/${rel}.before`});
specs.push({dir:'learning-hub',rel:'collection-page.js',before:'beginner-games/qa/return-finish-20261009/source/collection-page.before.js'});
specs.push({dir:'learning-hub',rel:'beginner-cards.css',reconstructed:'remove-owned-shop-next-rule'});
const games=['korean-racing','korean-rhythm','korean-runner','blank-slice','entry-check','story-classroom','talk-rally','order-rush','word-magic','spaceship-coop','learning-hub'];
for(const dir of games)specs.push({dir,rel:'collection.js',reconstructed:'canonical-prefix-and-preserved-adapter'});
function beforeBytes(spec){
 if(spec.before)return fs.readFileSync(archive(spec.before));
 const current=fs.readFileSync(source(spec.dir,spec.rel),'utf8');
 if(spec.reconstructed==='remove-owned-shop-next-rule'){const lines=current.split(/(?<=\n)/),removed=lines.filter(l=>l.startsWith('.shop-next{'));assert.equal(removed.length,1);return Buffer.from(lines.filter(l=>!l.startsWith('.shop-next{')).join(''));}
 if(spec.reconstructed==='canonical-prefix-and-preserved-adapter'){const original=fs.readFileSync(path.join(qa,'collection.before-read-record.js'),'utf8'),marker=original.indexOf('/* Shared collection adapter.');assert(marker>0);return Buffer.from(original.slice(0,marker)+fs.readFileSync(archive('beginner-games/qa/return-finish-20261009/source/collection-adapter.before.js'),'utf8'));}
 throw Error('missing before source');
}
(async()=>{
 const helper=path.join(qa,'public-transform-source.mjs'),{publicText,outputRelative,inspectLinks}=await import(pathToFileURL(helper).href);
 git(['fetch','origin','main']);const parent=git(['rev-parse','origin/main']).toString().trim(),baseline=new Set(git(['ls-tree','-r','--name-only',parent]).toString().trim().split(/\r?\n/));
 const preflight=[];
 for(const spec of specs){const target=outputRelative(spec.dir,spec.rel);if(spec.new){preflight.push({path:target,new:true,pass:!baseline.has(target)});continue;}const raw=beforeBytes(spec),publicBefore=git(['show',parent+':'+target]),reproduced=Buffer.from(publicText(raw.toString('utf8'),spec));preflight.push({path:target,beforeSource:spec.before||null,reconstructed:spec.reconstructed||null,actualSHA256:sha(publicBefore),reproducedSHA256:sha(reproduced),pass:publicBefore.equals(reproduced)});}
 const preflightResult={at:new Date().toISOString(),parent,files:preflight,passed:preflight.every(f=>f.pass),readsOnly:true};fs.writeFileSync(path.join(qa,'baseline-preflight.json'),JSON.stringify(preflightResult,null,2)+'\n');
 if(process.argv.includes('--preflight')){console.log(JSON.stringify(preflightResult));if(!preflightResult.passed)process.exitCode=1;return;}
 assert(preflightResult.passed,'Prior source must exactly reproduce the current public files before an overlay is created');
 const files=[],payload=new Map();
 for(const spec of specs){const file=source(spec.dir,spec.rel),raw=fs.readFileSync(file),target=outputRelative(spec.dir,spec.rel),bytes=Buffer.from(publicText(raw.toString('utf8'),spec)),before=spec.new?null:git(['show',parent+':'+target]);
  if(before)assert.notEqual(sha(bytes),sha(before),'Expected owned delta: '+target);
  for(const [kind,data] of [['payload',bytes],['source-after',raw],...spec.new?[]:[['source-before',beforeBytes(spec)],['before-public',before]]]){const dest=path.join(qa,kind,target);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);}
  if(/\.(?:mjs|js)$/.test(spec.rel)){cp.execFileSync(process.execPath,['--check',file],{windowsHide:true});cp.execFileSync(process.execPath,['--check',path.join(qa,'payload',target)],{windowsHide:true});}
  files.push({path:target,target,change:spec.new?'A':'M',sourcePath:path.relative(root,file).replaceAll('\\','/'),sourceSHA256:sha(raw),beforeSHA256:before?sha(before):null,sha256:sha(bytes),bytes:bytes.length});payload.set(target,bytes);
 }
 const links=inspectLinks(payload,baseline);assert.deepEqual(links.missing,[]);const dependencies=links.baselineDependencies.map(p=>({path:p,sha256:sha(git(['show',parent+':'+p]))}));
 for(const f of files)assert.equal(sha(fs.readFileSync(path.join(root,f.sourcePath))),f.sourceSHA256,'Source changed during preparation');
 const candidate={at:new Date().toISOString(),baselineRoot:publicRepo,baselineRevision:parent,baselineCommit:parent,files,dependencies,linkChecks:links.checks.length,transform:{source:'C:/Users/q1212/Documents/SYNK-website/prepare-play-candidate.mjs',snapshot:'public-transform-source.mjs',sha256:sha(fs.readFileSync(helper)),exports:['publicText','outputRelative','inspectLinks'],fullPackageRun:false},scope:'Beginner revisit, optional named scene storage, cooperative stopped-entry recall and canonical reward routing only.',accountBuildRun:false,accountSchemaChanged:false,serverChanged:false,narrationGenerated:0};
 fs.writeFileSync(path.join(qa,'candidate.json'),JSON.stringify(candidate,null,2)+'\n');fs.writeFileSync(path.join(qa,'manifest.json'),JSON.stringify(candidate,null,2)+'\n');fs.writeFileSync(path.join(qa,'link-checks.json'),JSON.stringify(links,null,2)+'\n');console.log(JSON.stringify({baselineCommit:parent,files:files.length,added:files.filter(f=>f.change==='A').length,linkChecks:links.checks.length,dependencies:dependencies.length}));
})().catch(error=>{fs.writeFileSync(path.join(qa,'preparation-failure-'+Date.now()+'.json'),JSON.stringify({at:new Date().toISOString(),error:error.message},null,2)+'\n');console.error(error.message);process.exitCode=1;});
