import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {publicWorldConfig} from '../experiences/synk-world-app/operating-mode.mjs';
import {renderWorldDocument} from '../experiences/synk-world-app/document.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
if(!arg('--config'))throw Error('Usage: build-world-app-public.mjs --config public-config.json [--out directory] [--base-path /world/] [--reuse payload-world-dir]');
for(let i=0;i<args.length;i+=2)if(!['--config','--out','--base-path','--reuse'].includes(args[i])||!args[i+1])throw Error('Invalid build argument');
const raw=JSON.parse(fs.readFileSync(path.resolve(arg('--config')),'utf8'));
const config=publicWorldConfig(raw.mode?{...raw,basePath:arg('--base-path')||raw.basePath||'/world/'}:{mode:'account',basePath:arg('--base-path')||'/world/',account:raw},'https://synk.im/world/');
if(config.mode!=='account')throw Error('Public payload requires actual SYNK ID mode');
const out=path.resolve(arg('--out')||path.join(root,'.tmp',`world-app-public-${new Date().toISOString().replace(/[:.]/g,'-')}`));
const workspaceRelative=path.relative(root,out);
if(workspaceRelative.startsWith('..')||path.isAbsolute(workspaceRelative)||!workspaceRelative.startsWith('.tmp'+path.sep))throw Error('Public build output must be an isolated .tmp directory');
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw Error('Refusing to overwrite an existing public build');
fs.mkdirSync(out,{recursive:true});const payload=path.join(out,'world');fs.mkdirSync(payload);
const entries=[],sourceHashes=new Map(),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const reuse=arg('--reuse')?path.resolve(arg('--reuse')):null;if(reuse&&!path.relative(root,reuse).startsWith('.tmp'+path.sep))throw Error('Reuse must be a workspace owned .tmp payload');
const reusedFiles=new Map(reuse?JSON.parse(fs.readFileSync(path.join(reuse,'../manifest.json'),'utf8')).files.map(file=>[file.path,file]):[]);let hardlinked=0;
const browserExtensions=new Set(['.mjs','.js','.cjs','.html','.css','.json','.svg','.png','.webp','.jpg','.jpeg','.gif','.woff','.woff2','.ttf','.mp3','.wav','.mp4','.glb','.gltf','.bin','.txt']);
const forbiddenPart=part=>part.startsWith('.')||/^(?:qa|tests?|node_modules|coverage|captures|source-before|raw|scripts|art-source|audio-source)$/i.test(part);
const forbiddenName=name=>/^(?:server|prepare-assets|asset-sources|README|package(?:-lock)?|AGENTS|CLAUDE|config|build|verify|generate|capture)(?:[.-]|$)/i.test(name)||/\.test\./i.test(name)||/voice-check\.html$|\.candidate\.json$/i.test(name);
function write(relative,bytes,source=null){
 if(path.isAbsolute(relative)||relative.split('/').some(p=>p==='..'||forbiddenPart(p)))throw Error('Unsafe payload path: '+relative);
 const target=path.join(payload,relative);if(fs.existsSync(target))throw Error('Duplicate payload file: '+relative);fs.mkdirSync(path.dirname(target),{recursive:true});const previous=reusedFiles.get(relative),oldFile=reuse&&path.join(reuse,relative);if(previous?.sha256===sha(bytes)&&fs.existsSync(oldFile)&&sha(fs.readFileSync(oldFile))===previous.sha256){fs.linkSync(oldFile,target);hardlinked++;}else fs.writeFileSync(target,bytes);
 entries.push({path:relative,bytes:bytes.length,sha256:sha(bytes),...(source?{source:path.relative(root,source).replaceAll('\\','/'),sourceSha256:sourceHashes.get(source)}:{generated:true})});
}
function rewrite(text){
 text=text.replaceAll('../synk-world-home/','./').replaceAll('href=\"../learning-hub/\"','href=\"'+config.account.learningUrl+'\"');
 // All mounted standalone games/assets live beneath this public WORLD path.
 text=text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g,(_,quote,folder)=>quote+config.basePath+folder);
 return text;
}
// Keep production records in the source tree; public copies contain runtime data only.
function publicAsset(relative,bytes){
 if(relative==='hangul-stage/assets/provenance.json')return null;
 if(/\.mp3$/i.test(relative)&&bytes.subarray(0,3).toString('ascii')==='ID3'){
  if(bytes.length<10||![3,4].includes(bytes[3])||bytes[5]!==0||[...bytes.subarray(6,10)].some(n=>n>127))throw Error('Unsupported public MP3 tag: '+relative);
  const size=(bytes[6]<<21)|(bytes[7]<<14)|(bytes[8]<<7)|bytes[9],end=10+size;
  if(end>=bytes.length)throw Error('Invalid public MP3 tag size: '+relative);
  if(/suno|\budio\b|gemini|elevenlabs|openai|edge[-_ ]?tts/i.test(bytes.subarray(10,end).toString('latin1'))){
   if(bytes[end]!==0xff||(bytes[end+1]&0xe0)!==0xe0)throw Error('Public MP3 audio frame missing: '+relative);
   bytes=bytes.subarray(end); // Byte-identical encoded audio, without its producer tag.
  }
 }
 if(relative==='songs.mjs'||relative==='hangul-stage/songs.mjs')bytes=Buffer.from(bytes.toString('utf8').replace(/^[ \t]*\/\/[^\r\n]*Suno[^\r\n]*(?:\r?\n|$)/gmu,'').replace(/\bsuno(?=\s*:)/g,'sourceId'));
 if(relative==='korean-rhythm/core.mjs'||relative==='korean-rhythm/suno-tracks.mjs'){
  bytes=Buffer.from(bytes.toString('utf8').replaceAll('SUNO_RECORDINGS','RECORDINGS').replaceAll('./suno-tracks.mjs','./recording-tracks.mjs'));
  if(relative==='korean-rhythm/suno-tracks.mjs')relative='korean-rhythm/recording-tracks.mjs';
 }
 return {relative,bytes};
}
// Match the public site's existing producer-name check before declaring a build usable.
function publicToolName(relative,bytes){
 if(/(^|\/)(vendor|node_modules)\//.test(relative)||/(^|\/)knowledge-engine\.js$/.test(relative))return null;
 if(/\.(html|js|mjs|css|json|txt|xml|md|svg|webmanifest)$/i.test(relative)){
  const text=bytes.toString('utf8').replace(/data:[^"')\s]+/g,'').replace(/[A-Za-z0-9+/=]{300,}/g,'');
  return text.match(/suno|higgsfield|nano banana|midjourney|gpt[- ]image|edge[-_ ]tts|elevenlabs|gemini-[0-9][\w.-]*tts|ko-KR-[A-Za-z]+Neural|made with (suno|udio)/i)?.[0]||null;
 }
 if(/\.mp3$/i.test(relative)){
  const head=bytes.subarray(0,8192).toString('latin1');
  return head.startsWith('ID3')?(head.match(/suno|\budio\b|gemini|elevenlabs|openai|edge[-_ ]?tts/i)?.[0]||null):null;
 }
 return null;
}
function copyFile(source,relative,{transform=true}={}){
 const bytes=fs.readFileSync(source);sourceHashes.set(source,sha(bytes));
 let content=bytes.toString('utf8');
 if(relative==='hangul-stage/index.html')content=content.replace('id="games"','id="games" target="_top"').replace('id="grad-games"','id="grad-games" target="_top"');
 if(relative==='hangul-stage/app.mjs')content=content.replace(/const HUB = [^;]+;/,"const HUB = !hosted ? 'https://synk.im/account/client.html?product=world&play=learning-hub' : null;");
 const rendered=transform&&/\.(?:mjs|js|cjs|html|css)$/.test(source)?Buffer.from(rewrite(content)):bytes;
 const prepared=publicAsset(relative,rendered);if(prepared)write(prepared.relative,prepared.bytes,source);
}
function copyTree(source,target='',accept=()=>true){
 for(const dirent of fs.readdirSync(source,{withFileTypes:true})){
  if(forbiddenPart(dirent.name)||forbiddenName(dirent.name))continue;
  const next=path.join(source,dirent.name),relative=target?target+'/'+dirent.name:dirent.name;
  if(dirent.isDirectory())copyTree(next,relative,accept);
  else if(dirent.isFile()&&browserExtensions.has(path.extname(next))&&accept(next,relative))copyFile(next,relative);
 }
}
const home=path.join(root,'experiences/synk-world-home'),town=path.join(root,'experiences/synk-town');
copyTree(home,'',(source,relative)=>!relative.endsWith('.html'));
const indexSource=path.join(root,'experiences/brand-opening/home.html'),indexBytes=fs.readFileSync(indexSource);sourceHashes.set(indexSource,sha(indexBytes));
const html=rewrite(renderWorldDocument(indexBytes.toString('utf8'),config));
for(const name of ['index.html','mobile.html','desktop.html'])write(name,Buffer.from(html),indexSource);
for(const name of ['app-shell.mjs','app-shell.css','world-client.mjs','world-town-client.mjs','world-account.bundle.mjs','life-content.mjs','life-progress.mjs','life-ui.mjs','life-ui.css','cafe-activity.mjs','cafe-ui.mjs'])copyFile(path.join(root,'experiences/synk-world-app',name),name);
copyFile(path.join(root,'experiences/synk-account/src/enrollment.mjs'),'enrollment.mjs');
write('world-config.json',Buffer.from(JSON.stringify(config,null,2)+'\n'));
const dayFiles=['day-app.mjs','day-style.css','day-scene.mjs','day-character.mjs','day-residents.mjs','day-environment.mjs','day-materials.mjs','day-rendering.mjs','walk.mjs','walk-controls.mjs','town-layout.mjs'];
for(const name of dayFiles)copyFile(path.join(town,name),'town/'+name);
copyTree(path.join(town,'rendering'),'town/rendering');copyTree(path.join(town,'assets'),'town/assets');
const daySource=path.join(town,'day.html'),dayBytes=fs.readFileSync(daySource);sourceHashes.set(daySource,sha(dayBytes));
write('town/day.html',Buffer.from(rewrite(dayBytes.toString('utf8').replace('<head>',`<head><script>window.__SYNK_WORLD_TOWN__=${JSON.stringify({mode:'account',rehearsal:false,accountScoped:true,basePath:config.basePath})};</script>`).replace('<a href="./preview.html">이전 찻집 생활 시제품 열기</a>',''))),daySource);
for(const name of ['three.module.js','three.core.js','THREE-LICENSE.txt'])copyFile(path.join(home,'scene-assets',name),'town/day-assets/'+name);
for(const name of ['azure-sky-v3.jpg','azure-sky-v3-mobile.jpg','terrain-normal.jpg','cliff-normal.jpg'])copyFile(path.join(home,'scene-assets/graphics-v2',name),'town/day-assets/'+name);
copyFile(path.join(home,'assets/felt-coral.webp'),'town/day-assets/felt-coral.webp');
const opening=path.join(root,'experiences/brand-opening');
 for(const name of ['content/life-standalone.mjs','content/life-ui.css'])copyFile(path.join(opening,name),'brand-opening/'+name);
 for(const name of ['opening.mjs','opening.css','home.mjs','home.css','tutor-onboarding.mjs','tutor-onboarding.css','tutor-profiles.mjs','tutor-choice.mjs','game-tutor.mjs','game-tutor.css','game-tutor-lines.mjs','game-tutor-contract.mjs','game-tutor-channel.mjs','tutor-practice.mjs','tutor-practice.css','tutor-practice-core.mjs','tutor-practice-lines.mjs','tutor-review.mjs','tutor-review.css','game-tutor-support.mjs','life-tutor.mjs','life-tutor.css','life-tutor-lines.mjs','home-tutor.mjs','home-tutor-lines.mjs','home-tutor-days.mjs','home-tutor-recap.mjs'])copyFile(path.join(opening,name),'brand-opening/'+name);
 copyTree(path.join(opening,'assets/tutors'),'brand-opening/assets/tutors',(_source,relative)=>/\.(?:webp|wav)$/.test(relative)||/\/(?:marin|mongle)-face-mask\.svg$/.test(relative));
 copyTree(path.join(opening,'assets/cafe-voice'),'brand-opening/assets/cafe-voice',(_source,relative)=>/^[a-z0-9-]+\.mp3$/.test(path.basename(relative))||path.basename(relative)==='manifest.json');
 const openingSource=['opening.mjs','opening.css','home.mjs','home.css','home.html'].map(name=>fs.readFileSync(path.join(opening,name),'utf8')).join('\n');
 const openingAssets=new Set([...fs.readFileSync(path.join(opening,'opening.mjs'),'utf8').matchAll(/[\"']([a-zA-Z0-9_.-]+\.(?:webp|png|jpg|mp4|wav|woff2))[\"']/g)].map(match=>match[1]));
 for(const match of openingSource.matchAll(/url\([\"']?(?:\.\/)?assets\/([^\"')]+)[\"']?\)/g))openingAssets.add(match[1]);
 for(const match of openingSource.matchAll(/[\"']assets\/([a-zA-Z0-9_./-]+\.(?:webp|png|jpg|mp4|wav|woff2))[\"']/g))openingAssets.add(match[1]);
 for(const name of fs.readdirSync(path.join(opening,'assets/home')))if(/\.(?:webp|woff2)$/.test(name)||name==='cafe-drinks-v2.png')openingAssets.add('home/'+name);
for(const name of openingAssets)copyFile(path.join(opening,'assets',name),'brand-opening/assets/'+name);
for(const game of ['korean-runner','korean-rhythm','hangul-stage'])copyTree(path.join(root,'experiences',game),game,(source,relative)=>!relative.startsWith('hangul-stage/assets/voice/'));
 // Publish only explicitly approved voice clips, and runtime-only empty fallback metadata otherwise.
 const voiceRoot=path.join(root,'experiences/hangul-stage/assets/voice');
 const readVoice=name=>{try{return JSON.parse(fs.readFileSync(path.join(voiceRoot,name),'utf8'));}catch{return null;}};
 const voice=readVoice('voices.json'),talker=readVoice('talkers.json'),approvedFiles=new Set();
 function approvedClips(value){const result={};for(const [letter,file] of Object.entries(value||{})){if(typeof file!=='string'||!/^([a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:mp3|wav)$/.test(file)||file.includes('..'))throw Error('Invalid approved voice path');approvedFiles.add(file);result[letter]=file;}return result;}
 const publicVoice={approved:voice?.approved===true,clips:voice?.approved===true?approvedClips(voice.clips):{}};
 const publicTalkers={approved:talker?.approved===true,talkers:talker?.approved===true?(talker.talkers||[]).map(item=>({name:String(item.name||''),clips:approvedClips(item.clips)})):[]};
 write('hangul-stage/assets/voice/voices.json',Buffer.from(JSON.stringify(publicVoice)+'\n'));
 write('hangul-stage/assets/voice/talkers.json',Buffer.from(JSON.stringify(publicTalkers)+'\n'));
 for(const file of approvedFiles)copyFile(path.join(voiceRoot,file),'hangul-stage/assets/voice/'+file);
 const privateArtifacts=entries.filter(item=>/voice-check\.html$|\.candidate\.json$|^brand-opening\/index\.html$/.test(item.path));
 if(privateArtifacts.length)throw Error('Private authoring artifacts reached public payload');
// The three games carry their own generated collection.js; do not ship build/private common sources.
for(const engine of ['loom-motion.js','loom-life.js'])copyFile(path.join(root,'tools/lib',engine),'engine/'+engine);
const missing=[],references=[];
function checkReference(from,value){
 if(!value||value.includes('${')||/^(?:https?:|data:|blob:|#|about:|javascript:)/.test(value)||value.startsWith('/api/')||value.startsWith('api/')||value.startsWith('/auth/v1/')||value.startsWith('/try/'))return;
 if(!value.startsWith('.')&&!value.startsWith('/')&&!/\.[a-z0-9]+(?:[?#]|$)/i.test(value))return;
 const pathname=new URL(value,new URL(config.basePath+from,'https://synk.im')).pathname;
 if(!pathname.startsWith(config.basePath)){missing.push({from,reference:value,reason:'outside-world'});return;}
 let rel=decodeURIComponent(pathname.slice(config.basePath.length));if(rel.endsWith('/'))rel+='index.html';
 references.push({from,reference:value,path:rel});if(!fs.existsSync(path.join(payload,rel)))missing.push({from,reference:value,path:rel,reason:'missing'});
}
for(const entry of entries){
 if(!/\.(?:html|mjs|js|css)$/.test(entry.path))continue;
 const text=fs.readFileSync(path.join(payload,entry.path),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
 const patterns=entry.path.endsWith('.html')?[/\b(?:src|href)\s*=\s*["']([^"']+)["']/g]:entry.path.endsWith('.css')?[/url\(\s*["']?([^"')]+)["']?\s*\)/g]:[/\b(?:from|import)\s*["']([^"']+)["']/g,/import\(\s*["']([^"']+)["']\s*\)/g,/new URL\(\s*["']([^"']+)["']/g];
 for(const pattern of patterns)for(const match of text.matchAll(pattern))checkReference(entry.path,match[1]);
}
const sourceChanges=[];for(const [source,hash] of sourceHashes)if(sha(fs.readFileSync(source))!==hash)sourceChanges.push(path.relative(root,source));
const publicToolNames=[];for(const entry of entries){const match=publicToolName(entry.path,fs.readFileSync(path.join(payload,entry.path)));if(match)publicToolNames.push({path:entry.path,match});}
const manifest={version:1,createdAt:new Date().toISOString(),mode:'account',basePath:config.basePath,output:out,payload,entry:config.basePath,configSource:path.resolve(arg('--config')),files:entries.sort((a,b)=>a.path.localeCompare(b.path)),hardlinked,reusedPayload:reuse,publicVoice:{approved:publicVoice.approved,clips:approvedFiles.size},privateArtifacts,oldPayloadUnchanged:reuse?[...reusedFiles].every(([relative,file])=>sha(fs.readFileSync(path.join(reuse,relative)))===file.sha256):null,totalBytes:entries.reduce((sum,e)=>sum+e.bytes,0),referenceCount:references.length,missing,sourceChanges,
 publicToolNames,scope:{published:false,operatingDatabaseWritten:false,localServerIncluded:false,syntheticSessionsIncluded:false},ok:missing.length===0&&sourceChanges.length===0&&publicToolNames.length===0&&(!reuse||[...reusedFiles].every(([relative,file])=>sha(fs.readFileSync(path.join(reuse,relative)))===file.sha256))};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({ok:manifest.ok,output:out,payload,files:entries.length,totalBytes:manifest.totalBytes,missing,sourceChanges,publicToolNames,hardlinked,privateArtifacts,oldPayloadUnchanged:manifest.oldPayloadUnchanged}));
if(!manifest.ok)process.exitCode=1;
