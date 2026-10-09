// A scoped, immutable overlay for the WORLD account release. Never touches dist or a published checkout.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const PUBLIC_SLUGS = Object.freeze({'korean-racing':'racing','korean-runner':'runner','korean-rhythm':'rhythm','word-magic':'word-magic','spaceship-coop':'spaceship-coop','learning-hub':'learning-hub','order-rush':'order-rush','entry-check':'entry-check','blank-slice':'blank-slice','talk-rally':'talk-rally','story-classroom':'story-classroom'});
export const SOURCE_SPECS = Object.freeze([
  {dir:'word-magic', files:['index.html','style.css','app.mjs','content.mjs','core.mjs','audio.mjs','stage.mjs','learning.mjs','practice.mjs','recall.mjs','keepsakes.mjs','keepsake-view.mjs','shop.mjs','atlas-learning.js','collection.js','kit/lab.css'], assets:['assets','audio','kit/felt','kit/brand','kit/fonts'], json:['audio/manifest.json']},
  {dir:'spaceship-coop', files:['index.html','style.css','app.mjs','audio.mjs','collection.js','shop.mjs','shop.css','starbook.mjs'], assets:['assets'], json:['assets/audio/manifest.json']},
  {dir:'learning-hub', files:['index.html','style.css','beginner-cards.css','app.js','atlas-learning.js','collection.html','collection.css','collection.js','collection-page.js','progress-ui.js','progress-ui.css','assets/scrapbook.css'], assets:['assets'], json:[]},
  // The beginner mode gets its own dependencies: pending changes in the original cafe/audio are not released.
  {dir:'order-rush', files:['beginner.html','beginner.mjs','beginner-core.mjs','beginner-return.mjs','beginner-voice.mjs','beginner-shop.mjs','beginner-picnic.mjs','beginner.css','beginner-visual.css','beginner-picnic.css','audio.mjs','atlas-learning.js','collection.js','kit/lab.css'], assets:['assets/beginner','assets/picnic','assets/cast','assets/felt','assets/progress','kit/felt','kit/brand','kit/fonts'], extraAssets:['assets/cafe.webp'], json:['assets/beginner/voices.json']},
]);
// Audited account restore/storage changes only. Voices, content banks, scenery and other game modules stay published as-is.
export const ACCOUNT_RUNTIME = Object.freeze([
  ['korean-racing','app.js'],['korean-racing','garage-ui.js'],['korean-racing','garage-core.js'],['korean-racing','play-catalog.js'],['korean-racing','beginner-catalog.js'],['korean-racing','learning.js'],['korean-racing','personalization.js'],['korean-racing','index.html'],['korean-runner','app.mjs'],['korean-rhythm','app.mjs'],['order-rush','app.mjs'],['blank-slice','app.mjs'],['entry-check','app.mjs'],['entry-check','correction.mjs'],['entry-check','kit/josa.mjs'],['talk-rally','app.mjs'],['story-classroom','app.mjs'],['story-classroom','index.html'],
  ...['korean-racing','korean-runner','korean-rhythm','entry-check','blank-slice','talk-rally','story-classroom'].map(dir=>[dir,'collection.js']),
]);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const unix = value => value.replaceAll('\\','/');
const textExtension = /\.(?:html|css|[cm]?js|json|txt)$/i;
const mediaExtension = /\.(?:webp|png|jpe?g|gif|svg|woff2?|mp3|wav|ogg)$/i;
const hidden = rel => rel.split('/').some(n=>n.startsWith('.')||['source','audio-source','art-source','qa','tests','scripts','node_modules'].includes(n));
const privateAsset = rel => hidden(rel)||/(?:-original\.[^.]+|\.source\.json|provenance[^/]*\.json)$/i.test(rel);
const existsFile = p => fs.existsSync(p)&&fs.statSync(p).isFile();
function inside(parent, child){const rel=path.relative(path.resolve(parent),path.resolve(child));return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);}
function git(root,args){return execFileSync('git',['-C',root,...args],{windowsHide:true,maxBuffer:32*1024*1024});}

export function validateApi(value){
  if(!value)return null;
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/api/spaceship'||!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)||/(?:localhost|\.local)$/i.test(url.hostname))throw Error('spaceship API must be an explicit public HTTPS /api/spaceship URL');
  return url.href;
}
export function outputRelative(dir,rel){
  let target=rel.replace(/\.mjs$/,'.js');
  if(dir==='order-rush'){
    if(rel==='audio.mjs')target='beginner-effects.js';
    if(rel==='atlas-learning.js')target='beginner-atlas-learning.js';
    if(rel.startsWith('kit/'))target='beginner-kit/'+rel.slice(4);
    if(rel.startsWith('assets/'))target='beginner-assets/'+rel.slice(7);
  }
  return `try/${PUBLIC_SLUGS[dir]}/${target}`;
}
export function publicText(source,{dir,rel,spaceshipApi=null,beginnerDependency=true}={}){
  let result=source.replaceAll('.mjs','.js').replaceAll('http://127.0.0.1:4280/','/');
  // Match a complete local path segment, not a game ID, /try/... or a longer URL.
  for(const [local,slug] of Object.entries(PUBLIC_SLUGS))result=result.replace(new RegExp(`(?<![\\w/.-])/${local}/`,'g'),`/try/${slug}/`);
  for(const [local,slug] of Object.entries(PUBLIC_SLUGS))result=result.replaceAll(`../${local}/`,`/try/${slug}/`);
  result=result.replaceAll('/play/runner/','/try/runner/').replaceAll('/play/rhythm/','/try/rhythm/');
  result=result.replaceAll('/synk-account/client.html','/account/client.html').replaceAll('/synk-account/platform.html','/account/platform.html').replaceAll('http://127.0.0.1:4280/account/','/account/').replaceAll('http://127.0.0.1:4280/try/','/try/');
  result=result.replaceAll('../account/client.html','/account/client.html').replace(/new URL\((["'])(\/account\/[^"']+)\1\)/g,'new URL($1$2$1,location.href)');
  if(dir==='learning-hub')result=result.replaceAll('/synk-account/assets/slab-cream-long.webp','/try/learning-hub/assets/slab-cream-long.webp');
  if(dir==='order-rush'&&beginnerDependency){
    result=result.replace(/(?<![\w/-])kit\//g,'beginner-kit/').replace(/(?<![\w/-])assets\//g,'beginner-assets/');
    if(rel==='beginner.mjs')result=result.replace("from './audio.js'","from './beginner-effects.js'");
    if(rel==='beginner.html')result=result.replace('src="atlas-learning.js"','src="beginner-atlas-learning.js"');
  }
  // Only the beginner mode uses these namespaced order assets from other pages.
  result=result.replaceAll('/try/order-rush/assets/beginner/','/try/order-rush/beginner-assets/beginner/').replaceAll('/try/order-rush/assets/picnic/','/try/order-rush/beginner-assets/picnic/');
  if(dir==='learning-hub'&&rel==='index.html'){
    result=result.replace('<span class="badge">로컬 연결판</span>','<span class="badge">한국어 놀이</span>');
    result=result.replace(/<a\b[^>]*href="\/(?:atlas-lab|hangul-stage)\/"[^>]*>[\s\S]*?<\/a>/g,'');
  }
  if(dir==='learning-hub'&&rel==='collection-page.js'){
    result=`const PUBLIC_GAME_SLUGS=${JSON.stringify(PUBLIC_SLUGS)};\n`+result.replaceAll('/${path}/','/try/${PUBLIC_GAME_SLUGS[path]||path}/');
  }
  if(/\.html$/.test(rel)&&!/<link\b[^>]*rel=["']canonical["']/.test(result)){
    const leaf=rel==='index.html'?'':rel;
    result=result.replace(/<head>/,'<head>\n<link rel="canonical" href="https://synk.im/try/'+PUBLIC_SLUGS[dir]+'/'+leaf+'">');
  }
  if(dir==='spaceship-coop'&&rel==='index.html'&&spaceshipApi)result=result.replace('</head>',`<meta name="spaceship-api" content="${spaceshipApi}"></head>`);
  return result;
}

function selectFiles(sourceRoot){
  const selected=[];
  for(const spec of SOURCE_SPECS){
    const names=new Set([...spec.files,...(spec.extraAssets||[])]);
    for(const base of spec.assets){
      const walk=rel=>{
        const file=path.join(sourceRoot,spec.dir,rel),stat=fs.lstatSync(file);
        if(stat.isSymbolicLink())throw Error('source symlink is not allowed: '+file);
        if(stat.isDirectory()){for(const name of fs.readdirSync(file).sort()){const next=path.posix.join(rel,name);if(!privateAsset(next))walk(next);}return;}
        if(!privateAsset(rel)&&(mediaExtension.test(rel)||spec.json.includes(rel)||/\/[^/]+-OFL\.txt$/.test(rel)))names.add(rel);
      };
      walk(base);
    }
    for(const rel of names)selected.push({dir:spec.dir,rel,target:outputRelative(spec.dir,rel),beginnerDependency:true});
  }
  for(const [dir,rel] of ACCOUNT_RUNTIME)selected.push({dir,rel,target:`try/${PUBLIC_SLUGS[dir]}/${rel.replace(/\.mjs$/,'.js')}`,beginnerDependency:false});
  return selected;
}

export function inspectLinks(files,baselineFiles=new Set()){
  const missing=[],checks=[],baseline=new Set();
  function check(from,reference){
    reference=reference.trim().replaceAll('&amp;','&');
    if(!reference||reference.startsWith('#')||/^(?:[a-z]+:|\/\/)/i.test(reference)||/[${}<>]/.test(reference))return;
    const pathname=new URL(reference,'https://synk.im/'+from).pathname;
    const relative=decodeURIComponent(pathname.slice(1));
    const candidates=pathname.endsWith('/')?[relative+'index.html']:[relative];
    const found=candidates.find(name=>files.has(name)||baselineFiles.has(name));
    checks.push({from,reference,target:candidates[0],source:found?(files.has(found)?'payload':'published-baseline'):'missing'});
    if(!found)missing.push(`${from} -> ${reference}`);else if(!files.has(found))baseline.add(found);
  }
  for(const [file,buffer] of files){
    if(!/\.(?:html|css|js)$/.test(file))continue;
    const value=buffer.toString('utf8');
    if(/\.html$/.test(file))for(const m of value.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g))check(file,m[1]);
    if(/\.css$/.test(file))for(const m of value.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g))check(file,m[1]);
    if(/\.js$/.test(file)){
      for(const pattern of [/\b(?:import|export)\s+(?:[^;'"\n]*?\s+from\s+)?["'](\.[^"']+)["']/g,/\bimport\(\s*["'](\.[^"']+)["']/g,/\bnew URL\(\s*["']([^"']+\.[a-z0-9]+(?:[?#][^"']*)?)["']\s*,\s*import\.meta\.url/g,/\b(?:src|href)\s*=\s*["']([^"']+)["']/g,/["'`]((?:\.\/|\.\.\/|\/try\/|assets\/|kit\/|audio\/|beginner-assets\/|beginner-kit\/)[^"'`\n${}<>]*\.(?:webp|png|jpe?g|svg|woff2?|css|mp3|wav|json)(?:[?#][^"'`\n${}<>]*)?)["'`]/g])for(const m of value.matchAll(pattern))check(file,m[1]);
    }
  }
  return {checks,missing:[...new Set(missing)],baselineDependencies:[...baseline].sort()};
}

function inspectVoices(files){
  const report=[];
  for(const name of ['try/word-magic/audio/manifest.json','try/spaceship-coop/assets/audio/manifest.json','try/order-rush/beginner-assets/beginner/voices.json']){
    const manifest=JSON.parse(files.get(name));
    if(manifest.version!==1||manifest.provider!=='typecast'||manifest.approved!==true)throw Error('unapproved voice manifest: '+name);
    let count=0;
    for(const [id,clip] of Object.entries(manifest.clips||{})){
      const target=path.posix.normalize(path.posix.join(path.posix.dirname(name),clip.file||clip.src||''));
      if(!target.startsWith(path.posix.dirname(name)+'/')||!files.has(target)||!/[a-f0-9]{64}/.test(clip.sha256||'')||sha(files.get(target))!==clip.sha256)throw Error('voice bytes differ from approved manifest: '+name+'#'+id);
      count++;
    }
    if(!count)throw Error('empty voice manifest: '+name);
    report.push({manifest:name,approvedClips:count});
  }
  return report;
}

export function inspectAccountEntryPoints(files,readBaseline){
  const checked=[];
  for(const [name,buffer] of files){
    if(!/(?:^|\/)app\.js$/.test(name)||!buffer.toString('utf8').includes('SynkPlayAccount.ready()'))continue;
    const entry=path.posix.join(path.posix.dirname(name),'index.html');
    const html=(files.get(entry)||readBaseline(entry)).toString('utf8');
    const scripts=[...html.matchAll(/<script\b[^>]*>/g)].map(match=>match[0]);
    const collection=scripts.find(tag=>/\bsrc=["'](?:\.\/)?collection\.js(?:\?[^"']*)?["']/.test(tag));
    if(!collection||/\basync(?:\s|=|>)/.test(collection))throw Error('account restore needs a non-async collection entry script: '+entry);
    checked.push(entry);
  }
  return checked;
}

export function preparePlayCandidate({sourceRoot,outputRoot,baselineRoot,baselineRef='origin/main',spaceshipApi,allowMissingBaseline=false}){
  sourceRoot=path.resolve(sourceRoot);outputRoot=path.resolve(outputRoot);spaceshipApi=validateApi(spaceshipApi);
  const tempRoot=path.resolve(sourceRoot,'..','.tmp');
  if(!inside(tempRoot,outputRoot))throw Error('candidate output must be a new directory inside the canonical workspace .tmp');
  if(fs.existsSync(outputRoot))throw Error('candidate output already exists; use a fresh directory');
  let baselineRevision=null,baselineFiles=new Set();
  if(baselineRoot){baselineRoot=path.resolve(baselineRoot);baselineRevision=git(baselineRoot,['rev-parse',baselineRef]).toString().trim();baselineFiles=new Set(git(baselineRoot,['ls-tree','-r','--name-only',baselineRevision]).toString().trim().split(/\r?\n/));}
  else if(!allowMissingBaseline)throw Error('a committed public baseline is required to verify unchanged game dependencies');
  const files=new Map(),sources=[];
  for(const spec of selectFiles(sourceRoot)){
    const source=path.join(sourceRoot,spec.dir,spec.rel);
    if(!existsFile(source)||fs.lstatSync(source).isSymbolicLink())throw Error('missing or linked runtime source: '+source);
    if(files.has(spec.target))throw Error('duplicate public target: '+spec.target);
    const bytes=fs.readFileSync(source),transformed=textExtension.test(spec.rel)?Buffer.from(publicText(bytes.toString('utf8'),{...spec,spaceshipApi})):bytes;
    files.set(spec.target,transformed);sources.push({source:unix(path.relative(sourceRoot,source)),target:spec.target,sourceSha256:sha(bytes),sha256:sha(transformed),bytes:transformed.length});
  }
  const voices=inspectVoices(files),links=inspectLinks(files,baselineFiles);
  if(links.missing.length)throw Error('candidate has missing links/assets/modules:\n'+links.missing.join('\n'));
  const accountEntries=inspectAccountEntryPoints(files,file=>git(baselineRoot,['show',baselineRevision+':'+file]));
  for(const [name,bytes] of files){
    if(/spaceship-coop\/(?:core|server)\./.test(name)||/\.(?:mjs|map)$/.test(name)||/(?:^|\/)(?:qa|tests|source)\//.test(name))throw Error('private file in payload: '+name);
    if(textExtension.test(name)&&/https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(bytes.toString('utf8')))throw Error('local URL in public runtime: '+name);
  }
  // A source edit during packaging requires another candidate; never mix moments in the same release.
  for(const entry of sources)if(sha(fs.readFileSync(path.join(sourceRoot,entry.source)))!==entry.sourceSha256)throw Error('source changed while packaging: '+entry.source);
  const baselineDependencies=links.baselineDependencies.map(file=>({path:file,sha256:sha(git(baselineRoot,['show',baselineRevision+':'+file]))}));
  const manifest={version:1,createdAt:new Date().toISOString(),deployed:false,sourceRoot:unix(sourceRoot),sourceRevision:git(path.resolve(sourceRoot,'..'),['rev-parse','HEAD']).toString().trim(),baselineRoot:baselineRoot?unix(baselineRoot):null,baselineRevision,spaceshipApi:spaceshipApi||null,files:sources,voices,accountEntries,linkChecks:links.checks.length,baselineDependencies,requirements:['Official final release review','Production SYNK Play migration, Edge function and enabled flag','Published WORLD OAuth callback and account client','Published-baseline revision comparison before overlay',...(spaceshipApi?['Verify the configured cooperative API with two real browser clients']:['A public cooperative API is not configured'])],exclusions:['Existing game voice files and content banks are unchanged','Story checkpoint and device audio calibration storage retain their existing scope','spaceship-coop/core.mjs, server.mjs, tests and production source metadata are private'],payloadSha256:sha(sources.map(row=>row.target+' '+row.sha256).sort().join('\n'))};
  fs.mkdirSync(path.join(outputRoot,'payload'),{recursive:true});
  for(const [name,bytes] of files){const target=path.join(outputRoot,'payload',name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}
  fs.writeFileSync(path.join(outputRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(outputRoot,'link-checks.json'),JSON.stringify(links,null,2)+'\n',{flag:'wx'});
  return manifest;
}

export function runCandidateCli(args){
  const options={};
  for(let i=0;i<args.length;i+=2){if(!['--out','--source','--baseline-root','--baseline-ref','--spaceship-api'].includes(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw Error('usage: --beginner-candidate --out NEW_WORKSPACE_TMP_DIRECTORY --baseline-root PUBLIC_REPO [--baseline-ref COMMIT] [--spaceship-api HTTPS_URL] [--source EXPERIENCES]');options[args[i].slice(2)]=args[i+1];}
  if(!options.out||!options['baseline-root'])throw Error('--out and --baseline-root are required');
  const manifest=preparePlayCandidate({sourceRoot:options.source||path.resolve(process.env.SYNK_CANON_ROOT||'../SYNK-appsscript','experiences'),outputRoot:options.out,baselineRoot:options['baseline-root'],baselineRef:options['baseline-ref'],spaceshipApi:options['spaceship-api']});
  console.log(JSON.stringify({output:options.out,files:manifest.files.length,bytes:manifest.files.reduce((n,row)=>n+row.bytes,0),linkChecks:manifest.linkChecks,voiceClips:manifest.voices.reduce((n,row)=>n+row.approvedClips,0),baselineRevision:manifest.baselineRevision,payloadSha256:manifest.payloadSha256,deployed:false},null,2));
}
