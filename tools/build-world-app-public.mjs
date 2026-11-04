import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {publicWorldConfig} from '../experiences/synk-world-app/operating-mode.mjs';
import {renderWorldDocument} from '../experiences/synk-world-app/document.mjs';
import {DIAG_RACING_WORDS,racingWordAudio} from '../experiences/synk-world-app/world-diagnostic-racing.mjs';
import {publicBank} from './build-world-writing-items.mjs';
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
const browserExtensions=new Set(['.mjs','.js','.cjs','.html','.css','.json','.svg','.png','.webp','.jpg','.jpeg','.gif','.woff','.woff2','.ttf','.mp3','.wav','.mp4','.glb','.gltf','.bin','.txt','.wasm']);
const forbiddenPart=part=>part.startsWith('.')||/^(?:qa|tests?|node_modules|coverage|captures|source-before|raw|scripts|art-source|audio-source)$/i.test(part);
const forbiddenName=name=>/^(?:server|prepare-assets|asset-sources|README|package(?:-lock)?|AGENTS|CLAUDE|config|build|verify|generate|capture)(?:[.-]|$)/i.test(name)||/\.test\./i.test(name)||/voice-check\.html$|\.candidate\.json$/i.test(name);
function write(relative,bytes,source=null){
 if(path.isAbsolute(relative)||relative.split('/').some(p=>p==='..'||forbiddenPart(p)))throw Error('Unsafe payload path: '+relative);
 const target=path.join(payload,relative);if(fs.existsSync(target))throw Error('Duplicate payload file: '+relative);fs.mkdirSync(path.dirname(target),{recursive:true});const previous=reusedFiles.get(relative),oldFile=reuse&&path.join(reuse,relative);if(previous?.sha256===sha(bytes)&&fs.existsSync(oldFile)&&sha(fs.readFileSync(oldFile))===previous.sha256){fs.linkSync(oldFile,target);hardlinked++;}else fs.writeFileSync(target,bytes);
 entries.push({path:relative,bytes:bytes.length,sha256:sha(bytes),...(source?{source:path.relative(root,source).replaceAll('\\','/'),sourceSha256:sourceHashes.get(source)}:{generated:true})});
}
function rewrite(text,relative=''){
 text=text.replaceAll('../synk-world-home/',relative.startsWith('brand-opening/')?'../':'./').replaceAll('href=\"../learning-hub/\"','href=\"'+config.account.learningUrl+'\"');
 if(!relative.includes('/'))text=text.replaceAll('../brand-opening/','./brand-opening/');
 // All mounted standalone games/assets live beneath this public WORLD path.
 text=text.replace(/(["'`])\/(scene-assets|[a-zA-Z0-9_-]+\.mjs|engine|korean-runner|korean-rhythm|hangul-stage|brand-opening|world-town-client\.mjs)(?=[/"'`])/g,(_,quote,folder)=>quote+config.basePath+folder);
 return text;
}
// Keep production records in the source tree; public copies contain runtime data only.
function publicAsset(relative,bytes){
 if(relative==='topik-items/holdout.mjs')bytes=Buffer.from(bytes.toString('utf8').replace('./review/holdout-20261028.json','./holdout.json'));
 if(relative==='korean-rhythm/supplemental.json'){
  const data=JSON.parse(bytes.toString('utf8'));data.items=data.items.filter(row=>row.review?.status==='passed').map(({review,...row})=>({...row,review:{status:'passed'}}));bytes=Buffer.from(JSON.stringify(data)+'\n');
 }
 if(relative==='hangul-stage/assets/provenance.json')return null;
 // 음성 구 사본(orbloom@0.1.0, MIT)의 esbuild 원천 경로 주석(이 PC 임시 폴더 경로)은 공개본에서 뺀다 — 코드와 MIT 고지는 그대로.
 if(relative==='drama/orbloom.mjs')bytes=Buffer.from(bytes.toString('utf8').replace(/^\/\/ (?:\.\.\/)+[^\r\n]*(?:\r?\n)/gm,''));
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
 if(relative==='world-account.bundle.mjs'||relative==='brand-opening/content/life-standalone.mjs')bytes=Buffer.from(bytes.toString('utf8').replaceAll('SUNO_RECORDINGS','RECORDINGS').replaceAll('suno-tracks.mjs','recording-tracks.mjs'));
 if(relative==='korean-rhythm/core.mjs'||relative==='korean-rhythm/suno-tracks.mjs'){
  bytes=Buffer.from(bytes.toString('utf8').replaceAll('SUNO_RECORDINGS','RECORDINGS').replaceAll('./suno-tracks.mjs','./recording-tracks.mjs'));
  if(relative==='korean-rhythm/suno-tracks.mjs')relative='korean-rhythm/recording-tracks.mjs';
 }
 // Writing bank: passed items only, without review records (reviewer models, notes); contentHash stays the source hash.
 if(relative==='world-writing-items.json')bytes=Buffer.from(JSON.stringify(publicBank(JSON.parse(bytes.toString('utf8'))))+'\n');
 // Speaking bank: its clip/scene paths resolve against the bank file (world-speaking-practice.mjs asset()). In the payload brand-opening/
 // sits beside the bank (top level), as rewrite() does for top-level code; contentHash stays the source hash (it covers the source bank).
 if(relative==='world-speaking-items.json')bytes=Buffer.from(bytes.toString('utf8').replaceAll('"../brand-opening/','"./brand-opening/'));
 return {relative,bytes};
}
// Match the public site's producer-name check before declaring a build usable (synk-policy .github/site-check/check.mjs;
// the same lists as tools/공개.js 점검규칙사본, which tests/공개.test.js compares with this function).
function publicToolName(relative,bytes){
 if(/(^|\/)(vendor|node_modules)\//.test(relative)||/(^|\/)knowledge-engine\.js$/.test(relative))return null;
 if(/\.(html|js|mjs|css|json|txt|xml|md|svg|webmanifest)$/i.test(relative)){
  const text=bytes.toString('utf8').replace(/data:[^"')\s]+/g,'').replace(/[A-Za-z0-9+/=]{300,}/g,'');
  return text.match(/suno|higgsfield|nano banana|midjourney|gpt[- ]image|edge[-_ ]tts|elevenlabs|typecast|gemini-[0-9][\w.-]*tts|ko-KR-[A-Za-z]+Neural|made with (suno|udio)|gpt[- ]?이미지|지피티|codex|seedance|\bkling|demucs|타입캐스트|힉스필드|나노 ?바나나|synk-vendor|(?<![\w.-])\.tmp[\\/]|(?<![가-힣])(?:클로드|제미나이|수노|페이블|아르곤|아스트라)|\b(?:fable|argon)\b/i)?.[0]||null;
 }
 if(/\.mp3$/i.test(relative)){
  const head=bytes.subarray(0,8192).toString('latin1');
  return head.startsWith('ID3')?(head.match(/suno|\budio\b|gemini|elevenlabs|typecast|openai|edge[-_ ]?tts/i)?.[0]||null):null;
 }
 return null;
}
function copyFile(source,relative,{transform=true}={}){
 const bytes=fs.readFileSync(source);sourceHashes.set(source,sha(bytes));
 let content=bytes.toString('utf8');
 if(relative==='hangul-stage/index.html')content=content.replace('id="games"','id="games" target="_top"').replace('id="grad-games"','id="grad-games" target="_top"');
 if(relative==='hangul-stage/app.mjs')content=content.replace(/const HUB = [^;]+;/,"const HUB = !hosted ? 'https://synk.im/account/client.html?product=world&play=learning-hub' : null;");
 // 주문 폭주 초보판 입구(LAB 전용)는 WORLD 사본에서 뺀다 — 초보판 파일을 싣지 않으니 링크도 남기지 않는다.
 // 바닷가 레이스 WORLD 사본: 쓰지 않는 입구 그림 · 마스코트 img를 지운다 — 가려져 있어도 받아지므로(LAB 원본 index.html은 그대로). 결과의 몽글 칸은 src만 지운다(results.js가 찾는다).
 if(relative==='korean-racing/index.html'){for(const [shape,to] of [[/<img class="hero-shot"[^>]*>/,''],[/<img class="hero-mongle diecut"[^>]*>/,''],[/<img src="assets\/mascots\/marin-base\.webp"[^>]*>/,''],[/<img src="assets\/mascots\/kkamong-base\.webp"[^>]*>/,''],[/(id="r-mongle") src="kit\/brand\/mongle-cheer\.webp"/,'$1'],...(racingSharedThree?[[/"three":"\.\/vendor\/three\.module\.js"/,'"three":"../scene-assets/three.module.js"']]:[]),...(racingSharedAtlas?[[/src="\.\/atlas-learning\.js/,'src="../korean-runner/atlas-learning.js']]:[])]){if(!shape.test(content))throw Error('Racing index shape changed: '+shape);content=content.replace(shape,to);}content=content.replace(/href="\/play\/(?:runner|rhythm)\/"/g,'href="#"');}
 if(relative==='korean-racing/vehicles.js'&&racingSharedThree){const from="'./vendor/three.module.js'";if(content.split(from).length!==2)throw Error('Racing three.js import changed');content=content.replace(from,"'../scene-assets/three.module.js'");}
 if(relative==='order-rush/index.html'){const entry=/\r?\n[ \t]*<article class="paper beginner-entry">[\s\S]*?<\/article>/;if(!entry.test(content))throw Error('Order rush beginner entry shape changed');content=content.replace(entry,'');}
 // 주문 폭주 3D 작업대는 WORLD 홈이 이미 받은 공용 three.js(scene-assets)를 쓴다 — 두 사본의 바이트가 같을 때만(아래 orderSharedThree).
 if(relative==='order-rush/stage.mjs'&&orderSharedThree){const from="'./vendor/three.module.js'";if(content.split(from).length!==2)throw Error('Order rush three.js import changed');content=content.replace(from,"'../scene-assets/three.module.js'");}
 // 빈칸 베기 입구 · 결과의 펠트 조각 · 몽글 그림은 WORLD 사본 HTML에서 뺀다 — 앱은 그 그림을 쓰지 않으니 받지도 않는다(world-play.mjs도 같은 줄을 걷는다).
 if(relative==='blank-slice/index.html'){for(const line of [/\r?\n[ \t]*<img class="hero-pieces"[^>]*>/,/\r?\n[ \t]*<img class="hero-mongle[^>]*>/,/\r?\n[ \t]*<img class="res-mongle[^>]*>/]){if(!line.test(content))throw Error('Blank slice felt image shape changed');content=content.replace(line,'');}const hub='href="/learning-hub/"';if(content.split(hub).length!==2)throw Error('Blank slice hub link changed');content=content.replace(hub,'href="#"');}   // 「다른 게임 추천」은 LAB 허브로 가는 단추 — 앱에서는 숨는다
 // 빈칸 베기 3D 무대 · 찢기 재질도 공용 three.js를 쓴다 — 두 사본의 바이트가 같을 때만(아래 blankSharedThree).
 if((relative==='blank-slice/stage.mjs'||relative==='blank-slice/world-stage.mjs')&&blankSharedThree){const from="'./vendor/three.module.js'";if(content.split(from).length!==2)throw Error('Blank slice three.js import changed');content=content.replace(from,"'../scene-assets/three.module.js'");}
 // 말 랠리 입구 · 결과의 몽글 그림은 WORLD 사본 HTML에서 뺀다 — 가려져 있어도 받아지므로(LAB 원본 index.html은 그대로).
 if(relative==='talk-rally/index.html'){for(const line of [/\r?\n[ \t]*<img class="hero-mongle[^>]*>/,/\r?\n[ \t]*<img class="res-mongle[^>]*>/]){if(!line.test(content))throw Error('Talk rally mascot image shape changed');content=content.replace(line,'');}const hub='href="/learning-hub/"';if(content.split(hub).length!==2)throw Error('Talk rally hub link changed');content=content.replace(hub,'href="#"');}   // 「다른 게임 추천」은 LAB 허브로 가는 단추 — 앱에서는 숨는다
 // 말 랠리 3D 탁구대도 같다(아래 rallySharedThree).
 if(relative==='talk-rally/stage.mjs'&&rallySharedThree){const from="'./vendor/three.module.js'";if(content.split(from).length!==2)throw Error('Talk rally three.js import changed');content=content.replace(from,"'../scene-assets/three.module.js'");}
 const rendered=transform&&/\.(?:mjs|js|cjs|html|css)$/.test(source)?Buffer.from(rewrite(content,relative)):bytes;
 const prepared=publicAsset(relative,rendered);if(prepared)write(prepared.relative,prepared.bytes,source);
}
function copyTree(source,target='',accept=()=>true){
 for(const dirent of fs.readdirSync(source,{withFileTypes:true})){
  if(forbiddenPart(dirent.name)||forbiddenName(dirent.name))continue;
  const next=path.join(source,dirent.name),relative=target?target+'/'+dirent.name:dirent.name;
  if(dirent.isDirectory())copyTree(next,relative,accept);
  else if(dirent.isFile()&&(browserExtensions.has(path.extname(next))||relative==='assets/wardrobe-environment-v1.bin.gz')&&accept(next,relative))copyFile(next,relative);
 }
}
const home=path.join(root,'experiences/synk-world-home'),town=path.join(root,'experiences/synk-town');
copyTree(home,'',(source,relative)=>!relative.endsWith('.html'));
const indexSource=path.join(root,'experiences/brand-opening/home.html'),indexBytes=fs.readFileSync(indexSource);sourceHashes.set(indexSource,sha(indexBytes));
const html=rewrite(renderWorldDocument(indexBytes.toString('utf8'),config));
for(const name of ['index.html','mobile.html','desktop.html'])write(name,Buffer.from(html),indexSource);
for(const name of ['world-learning-followups.mjs','world-followup-items.json'])copyFile(path.join(root,'experiences/synk-world-app',name),name);
for(const name of ['world-bootstrap.js','app-shell.mjs','world-session.mjs','app-shell.css','world-client.mjs','world-town-client.mjs','world-account.bundle.mjs','life-content.mjs','life-progress.mjs','world-learning-ui.mjs','world-learning-profile.mjs','world-learning-profile-core.mjs','tutor-selection-sync.mjs','display-language-sync.mjs','life-ui.mjs','life-story.mjs','life-content-lang.mjs','life-ui.css','cafe-activity.mjs','cafe-ui.mjs','classroom-lessons.mjs','classroom-homework.mjs','topik4-homework.json','world-writing-practice.mjs','world-writing-check.mjs','world-writing-focus.mjs','world-writing-items.json','world-writing.css','world-reminders.mjs','world-reminder-device.mjs','world-push.mjs','world-push-sw.js','world-icon-192.png','world-speaking-practice.mjs','world-speaking.css','world-speaking-items.json'])copyFile(path.join(root,'experiences/synk-world-app',name),name);
// 말하기 연습(10-21 공개 판부터 app-shell이 기본으로 부른다): 3번 문항 그림 네 칸. 출처 기록(sources.json)은 내보내지 않는다.
for(const name of fs.readdirSync(path.join(root,'experiences/synk-world-app/speaking-assets')).filter(name=>/^[a-z0-9-]+\.webp$/.test(name)).sort())copyFile(path.join(root,'experiences/synk-world-app/speaking-assets',name),'speaking-assets/'+name);
// 「제2의 나」 내 사진으로 만들기(11-04 시범): app-shell이 초대한 계정에서만 동적으로 부른다. 얼굴 찾기 도구는 그때 이 기기에서만 돈다.
for(const name of ['me2-photo.mjs','me2-photo.css','me2-photo-consent.json','vendor/face-api/face-api.esm.js','vendor/face-api/tiny_face_detector_model.bin','vendor/face-api/tiny_face_detector_model-weights_manifest.json','vendor/face-api/LICENSE'])copyFile(path.join(root,'experiences/synk-world-app',name),name);
copyFile(path.join(root,'experiences/synk-account/src/enrollment.mjs'),'enrollment.mjs');
// 바람길·말의 리듬이 ../social-conversion.mjs(SNS로 들어온 방문의 익명 체험 기록, synk.im에서만 동작)를 정적으로 부른다.
copyFile(path.join(root,'experiences/social-conversion.mjs'),'social-conversion.mjs');
write('world-config.json',Buffer.from(JSON.stringify(config,null,2)+'\n'));
const dayFiles=['day-app.mjs','day-style.css','day-scene.mjs','day-character.mjs','day-residents.mjs','day-environment.mjs','day-materials.mjs','day-rendering.mjs','day-district.mjs','day-light.mjs','day-mood.mjs','day-cards.mjs','day-notebook.mjs','day-stay.mjs','day-stay.css','day-ask.mjs','day-ask.css','day-meanwhile.mjs','day-meanwhile.css','day-sound.mjs','day-tea.mjs','day-tea.css','day-gather.mjs','day-gather.css','day-sfx.mjs','day-observation.mjs','walk.mjs','walk-controls.mjs','walk-packets.mjs','town-layout.mjs'];
for(const name of [...dayFiles,'day-language.mjs','dialogue.mjs','new-tea.mjs'])copyFile(path.join(town,name),'town/'+name);
// The town runtime layer (experiences/synk-town/town, vertical slice design §2-5): plain modules only — data sources, tests and tools stay out.
// W8: and its life activities (town/activities — the tea order), one folder down.
for(const folder of ['','activities'])for(const name of fs.readdirSync(path.join(town,'town',folder)).filter(name=>/^[a-z0-9-]+(?:\.gen)?\.mjs$/.test(name)).sort())copyFile(path.join(town,'town',folder,name),['town/town',folder,name].filter(Boolean).join('/'));
// assets/district holds the baked town sets. Only the whole merged town, WORLD's
// default since 10-19 (day-district.mjs WORLD_DEFAULT_DISTRICT), is published; the
// other sets are local comparisons. Its GLBs and list are kept out of Git (storage
// rule): copy them from the warehouse group town-합친판3-20261019 into an export
// before building, and the build stops if any is missing. rendering/basis is the
// Basis transcoder their KTX2 textures need.
const publishedDistrict=/^town\/assets\/district\/townwide-merged(?:-[a-z]+)?(?:-phone)?\.(?:glb|json)$/;
copyTree(path.join(town,'rendering'),'town/rendering');copyTree(path.join(town,'assets'),'town/assets',(_source,relative)=>!relative.startsWith('town/assets/district/')||publishedDistrict.test(relative));
{const manifestPath=path.join(town,'assets/district/townwide-merged.json');if(!fs.existsSync(manifestPath))throw Error('Baked town set missing: experiences/synk-town/assets/district/townwide-merged.json (copy it from the warehouse)');
 const set=JSON.parse(fs.readFileSync(manifestPath,'utf8'));for(const part of set.parts)for(const file of [part.url,part.phone].filter(Boolean))if(!entries.some(entry=>entry.path==='town/assets/district/'+file))throw Error('Baked town set file missing from the payload: '+file);}
const daySource=path.join(town,'day.html'),dayBytes=fs.readFileSync(daySource);sourceHashes.set(daySource,sha(dayBytes));
write('town/day.html',Buffer.from(rewrite(dayBytes.toString('utf8').replace('<head>',`<head><script>window.__SYNK_WORLD_TOWN__=${JSON.stringify({mode:'account',rehearsal:false,accountScoped:true,basePath:config.basePath})};</script>`).replace('<a href="./preview.html">이전 찻집 생활 시제품 열기</a>',''))),daySource);
for(const name of ['three.module.js','three.core.js','THREE-LICENSE.txt'])copyFile(path.join(home,'scene-assets',name),'town/day-assets/'+name);
for(const name of ['azure-sky-v3.jpg','azure-sky-v3-mobile.jpg','terrain-normal.jpg','cliff-normal.jpg'])copyFile(path.join(home,'scene-assets/graphics-v2',name),'town/day-assets/'+name);
copyFile(path.join(home,'assets/felt-coral.webp'),'town/day-assets/felt-coral.webp');
const opening=path.join(root,'experiences/brand-opening');
 for(const name of ['content/life-standalone.mjs','content/life-ui.css'])copyFile(path.join(opening,name),'brand-opening/'+name);
 for(const name of ['world-ui.css','world-sound.mjs','world-motion.mjs','world-motion.css','world-lang.mjs','world-strings.mjs','lang-picker.mjs','opening.mjs','opening.css','home.mjs','home.css','home-scene.mjs','home-scene.css','home-town.mjs','home-town.css','home-memory.mjs','tutor-onboarding.mjs','tutor-onboarding.css','tutor-profiles.mjs','tutor-choice.mjs','game-tutor.mjs','game-tutor.css','game-tutor-lines.mjs','game-tutor-contract.mjs','game-tutor-channel.mjs','tutor-practice.mjs','tutor-practice.css','tutor-practice-core.mjs','tutor-practice-lines.mjs','tutor-review.mjs','tutor-review.css','game-tutor-support.mjs','life-tutor.mjs','life-tutor.css','life-tutor-lines.mjs','home-tutor.mjs','home-tutor-lines.mjs','home-tutor-days.mjs','home-tutor-recap.mjs','first-run.mjs','kit/josa.mjs','tutor-photos.mjs','tutor-photos-data.mjs','story-signs.mjs','play-unlocks.mjs'])copyFile(path.join(opening,name),'brand-opening/'+name);
 copyTree(path.join(opening,'assets/tutors'),'brand-opening/assets/tutors',(_source,relative)=>/\.(?:webp|wav)$/.test(relative)||/\/(?:marin|mongle)-face-mask\.svg$/.test(relative));
 // 마스코트 사진: 자리마다 장면과 함께 구운 튜터·친구 사진(tutor-photos.mjs가 고른다)
 copyTree(path.join(opening,'assets/tutor-photos'),'brand-opening/assets/tutor-photos',(_source,relative)=>/\.webp$/.test(relative));
 // 이야기 사진 속 글자를 누르면 나는 낱말 소리(story-signs.mjs voice)
 copyTree(path.join(opening,'assets/story-voice'),'brand-opening/assets/story-voice',(_source,relative)=>/^[a-z-]+\.mp3$/.test(path.basename(relative)));
 copyTree(path.join(opening,'assets/cafe-voice'),'brand-opening/assets/cafe-voice',(_source,relative)=>/^[a-z0-9-]+\.mp3$/.test(path.basename(relative))||path.basename(relative)==='manifest.json');
 const openingSource=['world-ui.css','opening.mjs','opening.css','home.mjs','home.css','home.html'].map(name=>fs.readFileSync(path.join(opening,name),'utf8')).join('\n');
 const openingAssets=new Set([...fs.readFileSync(path.join(opening,'opening.mjs'),'utf8').matchAll(/[\"']([a-zA-Z0-9_.-]+\.(?:webp|png|jpg|mp4|wav|woff2))[\"']/g)].map(match=>match[1]));
 for(const match of openingSource.matchAll(/url\([\"']?(?:\.\/)?assets\/([^\"')]+)[\"']?\)/g))openingAssets.add(match[1]);
 for(const match of openingSource.matchAll(/[\"']assets\/([a-zA-Z0-9_./-]+\.(?:webp|png|jpg|mp4|wav|woff2))[\"']/g))openingAssets.add(match[1]);
 for(const name of fs.readdirSync(path.join(opening,'assets/home')))if(/\.(?:webp|woff2)$/.test(name)||name==='cafe-drinks-v2.png')openingAssets.add('home/'+name);
 for(const name of fs.readdirSync(path.join(opening,'assets/world-felt')))if(/^[a-z0-9-]+\.webp$/.test(name))openingAssets.add('world-felt/'+name);
 // 「놀이」 목록의 실사 인화지(11-03 주문 폭주 — 캠퍼스 판 그림은 world-felt가 아니라 world-play에 둔다).
 for(const name of fs.readdirSync(path.join(opening,'assets/world-play')))if(/^[a-z0-9-]+\.webp$/.test(name))openingAssets.add('world-play/'+name);
// assets/tutor-photos는 위에서 폴더째 실었다(home.html 기본 계정 사진이 여기 다시 잡혀도 두 번 쓰지 않는다).
for(const name of openingAssets)if(!name.startsWith('tutor-photos/'))copyFile(path.join(opening,'assets',name),'brand-opening/assets/'+name);
for(const game of ['korean-runner','korean-rhythm','hangul-stage'])copyTree(path.join(root,'experiences',game),game,(source,relative)=>!relative.startsWith('hangul-stage/assets/voice/'));
// 주문 폭주(11-03, 캠퍼스 판 겉 — 해금 표로 「놀이」에서 연다): 게임 폴더째 싣되, 쓰지 않는 펠트 카페 원본(cafe-original.png 2.3MB)과
// LAB 전용 초보판 「처음 여는 작은 가게」(beginner* · 그 그림 폴더 셋)는 뺀다 — WORLD는 그 입구를 지운다(app.mjs WORLD 분기 · 위 copyFile).
// three.js가 홈의 scene-assets와 바이트까지 같으면 vendor/는 싣지 않고 stage.mjs가 그 공용 사본을 부른다(다르면 지금처럼 자기 사본).
const orderSharedThree=['three.module.js','three.core.js'].every(name=>fs.readFileSync(path.join(root,'experiences/order-rush/vendor',name)).equals(fs.readFileSync(path.join(home,'scene-assets',name))));
// MT 바닷가 레이스(11-04, 1인칭 자전거 판 — 해금 표로 「놀이」에서 연다): 게임 폴더째 싣되 WORLD가 쓰지 않는 것을 뺀다 — 차 모델 · 안 쓰는 하늘 원본 ·
// 입구 그림 · 마스코트(위 copyFile이 그 img를 지운다) · 운전자 펠트 · 음악 출처표. 펠트 쿠션은 LAB CSS가 가리켜 참조 검사가 찾으므로 싣되 겉은 world-skin.css가 덮어 받지 않는다. 내 위치 진단의 낱말 녹음도 이 폴더째 함께 실린다. 바위 모델(coastal-rocks-v6.glb)은 git 밖이라 내보낸 사본에 없을 수 있다 — 그때는 빌드에서 빠지고 공개본 사본이 그대로 남는다(공개 도구는 --지움 없이 지우지 않는다).
// three.js가 홈의 scene-assets와 바이트까지 같으면 주문 폭주처럼 그 공용 사본을 쓴다(GLTF · Draco 로더는 three를 importmap으로 찾으므로 자기 사본 그대로).
// Atlas 묶음도 바람길 사본과 바이트까지 같으면 그 사본을 부른다(551KB를 두 번 받지 않는다). 다르면 자기 사본. 낭독 목록 JSON · HDR 로더는 실행 중에 읽지 않아 뺀다.
const racingSharedAtlas=fs.readFileSync(path.join(root,'experiences/korean-racing/atlas-learning.js')).equals(fs.readFileSync(path.join(root,'experiences/korean-runner/atlas-learning.js')));
const racingSharedThree=['three.module.js','three.core.js'].every(name=>fs.readFileSync(path.join(root,'experiences/korean-racing/vendor',name)).equals(fs.readFileSync(path.join(home,'scene-assets',name))));
copyTree(path.join(root,'experiences','korean-racing'),'korean-racing',(source,relative)=>!(racingSharedThree&&/^korean-racing\/vendor\/three\.(?:module|core)\.js$/.test(relative))&&!/^korean-racing\/(?:site-package\/|assets\/(?:car\.glb|[^/]+\.hdr|clear-sky-[^/]+|lobby-coast[^/]*|mascots\/|felt\/driver-|music\/sources\.json|narration\/[^/]+\.json)|vendor\/(?:HDR|RGBE)Loader\.js|kit\/brand\/mongle-[^/]+)/.test(relative)&&!(racingSharedAtlas&&relative==='korean-racing/atlas-learning.js'));
copyTree(path.join(root,'experiences','order-rush'),'order-rush',(source,relative)=>relative!=='order-rush/assets/cafe-original.png'&&!/^order-rush\/(?:beginner[^/]*|assets\/(?:beginner|picnic|progress)\/.*)$/.test(relative)&&!(orderSharedThree&&relative.startsWith('order-rush/vendor/')));
// 찰칵 낱말(11-04, 새 게임): 화면 · 그림 · 소리만 싣는다. 설계 · 시험 · qa · 개발 서버는 싣지 않는다.
copyTree(path.join(root,'experiences','snap-words'),'snap-words',(source,relative)=>!/^snap-words\/(?:qa\/|.*\.test\.mjs$|.*\.md$|server\.mjs$)/.test(relative));
// 빈칸 베기(11-04, 캠퍼스 판 겉 — 해금 표로 「놀이」에서 연다): 게임 폴더째 싣되, LAB 소리 시청 페이지 · 펠트 입구 그림 · 몽글 그림과 목소리는 뺀다(앱 사본은 world-host.js가 경로로 늘 WORLD 겉이라 부르지 않는다). 배경음은 위 order-rush의 곡을 함께 쓴다(world-play.mjs).
// three.js는 주문 폭주와 같이 홈의 공용 사본과 바이트까지 같으면 vendor/를 싣지 않고 공용 사본을 부른다(위 copyFile).
const blankSharedThree=['three.module.js','three.core.js'].every(name=>fs.readFileSync(path.join(root,'experiences/blank-slice/vendor',name)).equals(fs.readFileSync(path.join(home,'scene-assets',name))));
copyTree(path.join(root,'experiences','blank-slice'),'blank-slice',(source,relative)=>!/^blank-slice\/(?:sound-lab[^/]*|assets\/hero-pieces\.webp|assets\/sound\/mongle-[^/]+|kit\/brand\/mongle-[^/]+)$/.test(relative)&&!(blankSharedThree&&relative.startsWith('blank-slice/vendor/')));
// 말 랠리(11-04, 캠퍼스 판 겉 — 해금 표로 「놀이」에서 연다): 게임 폴더째 싣되 LAB 전용 몽글 음성 · 안내 음성 · 펠트 벽 · 몽글 소리와 제작 원본은 뺀다 — WORLD는 assets/world만 쓴다(world-play.mjs). three.js는 공용 사본과 바이트까지 같으면 vendor/를 싣지 않는다.
const rallySharedThree=['three.module.js','three.core.js'].every(name=>fs.readFileSync(path.join(root,'experiences/talk-rally/vendor',name)).equals(fs.readFileSync(path.join(home,'scene-assets',name))));
// 움직여 치는 영상은 저장 규칙대로 git 밖이다(드라마 재생 사본과 같다). 있으면 목록의 지문과 대조하고, 없으면 싣지 않는다 — 게임은 표정 판으로 친다. 이 게임을 올리는 공개후보.cjs는 없으면 멈춘다.
{const list=JSON.parse(fs.readFileSync(path.join(root,'experiences/talk-rally/qa/world-clips.json'),'utf8')).clips;for(const [file,item] of Object.entries(list)){const clip=path.join(root,'experiences/talk-rally/assets/world/cast/taeo/clips',file);if(fs.existsSync(clip)&&sha(fs.readFileSync(clip))!==item.sha256)throw Error('Talk rally clip differs from its list: '+file);}}
copyTree(path.join(root,'experiences','talk-rally'),'talk-rally',(source,relative)=>!/^talk-rally\/(?:assets\/(?:voice|narration|scene)\/.*|assets\/sound\/mongle-.*|art-source\/.*|scripts\/.*|sound-lab\..*)$/.test(relative)&&!(rallySharedThree&&relative.startsWith('talk-rally/vendor/')));
// 환승 러시(11-04): 앱 전용이라 LAB 공개 길은 없다. 시험 · 도구 · 설계와 문항 검수 원본은 싣지 않는다.
copyTree(path.join(root,'experiences','subway-rush'),'subway-rush',(source,relative)=>!/^subway-rush\/(?:qa\/|.*\.test\.mjs$|.*\.md$|review-items\.mjs$)/.test(relative));
// 드라마 말하기 1화(11-02, 설계 experiences/drama/qa/WORLD올리기-20261102/설계.md): 화면 · 강의(world-lesson.json) · 기록 묶음 · 재생 사본만 싣는다.
// content.mjs(시범 서버 전용 · 판정 명세)와 README · qa는 싣지 않는다. 재생 사본(media/)은 git 밖(tools/build-drama-pilot-assets.mjs가 승인 원천에서
// 만든다)이라 그 manifest.json의 sha256과 하나씩 대조해 없거나 다르면 멈춘다 — manifest 자체(원천 파일 이름)는 싣지 않는다.
// index.html에는 WORLD 표시(data-drama="world")를 단다: 게임 틀 밖에서 바로 열면 화면이 WORLD로 안내한다.
{const dramaRoot=path.join(root,'experiences/drama/pilot'),indexSource=path.join(dramaRoot,'index.html'),indexBytes=fs.readFileSync(indexSource);sourceHashes.set(indexSource,sha(indexBytes));
 const dramaHtml=indexBytes.toString('utf8');if(!dramaHtml.includes('<html lang="ko">'))throw Error('Drama index.html shape changed: <html lang="ko"> missing');
 // 캐시 토큰(?v=)은 공개본에만 단다 — 이PC 시범 서버는 쿼리 붙은 주소를 받지 않는다. 다음 공개부터는 tools/공개.js가 바뀐 파일의 토큰을 고친다.
 // pilot.mjs가 부르는 하위 모듈에도 토큰을 달고, pilot.mjs의 토큰은 그 치환이 든 공개 본문으로 잰다 — 하위 모듈만 바뀌어도 새 판을 받는다.
 const dramaToken=name=>sha(fs.readFileSync(path.join(dramaRoot,name))).slice(0,12);
 const pilotSource=path.join(dramaRoot,'pilot.mjs'),pilotBytes=fs.readFileSync(pilotSource);sourceHashes.set(pilotSource,sha(pilotBytes));
 let pilotText=rewrite(pilotBytes.toString('utf8'),'drama/pilot.mjs');
 for(const name of ['strings.mjs','takes.mjs','orbloom.mjs']){const from=`'./${name}'`;if(pilotText.split(from).length!==2)throw Error('Drama pilot.mjs import missing: '+from);pilotText=pilotText.replace(from,`'./${name}?v=${dramaToken(name)}'`);}
 write('drama/pilot.mjs',Buffer.from(pilotText),pilotSource);
 const tokens={'pilot.css':dramaToken('pilot.css'),'atlas-learning.js':dramaToken('atlas-learning.js'),'pilot.mjs':sha(Buffer.from(pilotText)).slice(0,12)};
 let dramaPage=dramaHtml.replace('<html lang="ko">','<html lang="ko" data-drama="world">');
 for(const [attr,name] of [['href','pilot.css'],['src','atlas-learning.js'],['src','pilot.mjs']]){const from=`${attr}="${name}"`;if(dramaPage.split(from).length!==2)throw Error('Drama index.html reference missing: '+from);dramaPage=dramaPage.replace(from,`${attr}="${name}?v=${tokens[name]}"`);}
 write('drama/index.html',Buffer.from(dramaPage),indexSource);
 for(const name of ['pilot.css','strings.mjs','takes.mjs','orbloom.mjs','atlas-learning.js','world-lesson.json'])copyFile(path.join(dramaRoot,name),'drama/'+name);
 const mediaManifest=path.join(dramaRoot,'media/manifest.json');if(!fs.existsSync(mediaManifest))throw Error('Drama media missing: run node tools/build-drama-pilot-assets.mjs first');
 for(const item of JSON.parse(fs.readFileSync(mediaManifest,'utf8')).files){
  if(!/^[A-Za-z0-9_.-]+$/.test(item.file))throw Error('Invalid drama media name: '+item.file);
  const source=path.join(dramaRoot,'media',item.file);if(!fs.existsSync(source)||sha(fs.readFileSync(source))!==item.sha256)throw Error('Drama media differs from its manifest: '+item.file);
  copyFile(source,'drama/media/'+item.file);
 }}
// 내 위치 짧은 진단의 낱말 듣기: 진단이 쓰는 낱말 녹음은 위 레이싱 폴더에 함께 실린다(빠졌을 때만 여기서 싣는다). 표는 아무것도 import하지 않는
// world-diagnostic-racing.mjs에서 읽는다(진단 묶음 전체를 부르면 공개 내보내기에 없는 게임 폴더까지 따라 부른다).
for(const [id] of DIAG_RACING_WORDS)if(!fs.existsSync(path.join(payload,racingWordAudio(id))))copyFile(path.join(root,'experiences',racingWordAudio(id)),racingWordAudio(id));
// 공개 TOPIK 은행(검수 통과 문항만 — tools/build-world-topik-items.mjs가 만든 파일 그대로)과 그 듣기 문항의 소리만 싣는다(10-21 ④).
// 화면은 이 은행을 필요할 때 불러온다(world-topik-items.mjs). 초안·보류 문항의 소리는 싣지 않는다. 세트 문항은 대본(소리 파일) 하나를 함께 쓰므로 파일마다 한 번만.
copyFile(path.join(root,'experiences/synk-world-app','world-topik-items.json'),'world-topik-items.json');
copyFile(path.join(root,'experiences/topik-items','holdout.mjs'),'topik-items/holdout.mjs');
copyFile(path.join(root,'experiences/topik-items/review','holdout-20261028.json'),'topik-items/holdout.json');
{const topikAudio=new Set();
for(const row of ['world-topik-items.json','world-followup-items.json'].flatMap(file=>JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app',file),'utf8')).items))
 if(row?.audio?.file&&/^audio\/[a-z0-9-]+\.mp3$/.test(row.audio.file)&&!topikAudio.has(row.audio.file)){topikAudio.add(row.audio.file);copyFile(path.join(root,'experiences/topik-items',row.audio.file),`topik-items/${row.audio.file}`);}}
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
