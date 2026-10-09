const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'scene-assets/graphics-v4'),sources=['avatar-v3.mjs','avatar-textiles.mjs'];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const frozen=sources.map(relative=>({path:relative,sha256:hash(path.join(root,relative))}));
if(!process.argv.includes('--frozen'))throw new Error('Run only after the avatar author confirms the source is frozen; pass --frozen then.');
(async()=>{const server=await chromium.launchServer({channel:'msedge',headless:true}),browser=await chromium.connect(server.wsEndpoint());try{
 const page=await browser.newPage({viewport:{width:1020,height:680}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/__avatar-v4-export',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Avatar static export and round trip</title><script type="importmap">{"imports":{"three":"/scene-assets/three.module.js"}}</script>'}));
 await page.route('**/__avatar-v4-modules/*.mjs',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(__dirname,path.basename(new URL(route.request().url()).pathname)),'utf8')}));
 await page.route('**/__avatar-gltf/*.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.resolve(root,'../korean-racing/vendor',path.basename(new URL(route.request().url()).pathname)),'utf8')}));
 await page.goto('http://127.0.0.1:4396/__avatar-v4-export');const result=await page.evaluate(async()=>{const{run}=await import('/__avatar-v4-modules/roundtrip.mjs');return run();});
 assert.deepEqual(errors,[]);for(const file of frozen)assert.equal(hash(path.join(root,file.path)),file.sha256,'Avatar source changed during export');
 fs.mkdirSync(out,{recursive:true});const buffer=Buffer.from(result.base64,'base64'),file=path.join(out,'mongle-v4.glb');fs.writeFileSync(file,buffer);
 const metadata={...result.metadata,createdAt:new Date().toISOString(),sha256:hash(file),rigged:false,productionApproved:false,source:frozen,roundtrip:{passed:result.checks.length,checks:result.checks,vertices:result.vertices,colouredVertices:result.colouredVertices,imageDifference:result.imageDifference,loader:'Existing experiences/korean-racing/vendor/GLTFLoader.js',loaderSha256:hash(path.resolve(root,'../korean-racing/vendor/GLTFLoader.js'))}};
 fs.writeFileSync(path.join(out,'mongle-v4.export.json'),JSON.stringify(metadata,null,2));fs.writeFileSync(path.join(__dirname,'gltf-structure.json'),JSON.stringify(result.gltf,null,2));await page.screenshot({path:path.join(__dirname,'roundtrip.png')});console.log(JSON.stringify({file,bytes:buffer.length,checks:result.checks.length,imageDifference:result.imageDifference}));
 }finally{let timer;try{await Promise.race([browser.close(),new Promise(resolve=>timer=setTimeout(resolve,5000))]);}finally{clearTimeout(timer);server.process()?.kill();}}})().catch(error=>{fs.writeFileSync(path.join(__dirname,'failure.json'),JSON.stringify({checkedAt:new Date().toISOString(),error:String(error),source:frozen},null,2));console.error(error);process.exit(1);});
