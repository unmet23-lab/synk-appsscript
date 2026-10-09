const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const games=['korean-racing','korean-rhythm','korean-runner','blank-slice','entry-check','story-classroom','talk-rally','order-rush','word-magic','spaceship-coop','learning-hub'];
const sourceFiles=[
 'play-common/collection-adapter.js','play-common/beginner-route.test.mjs','play-common/account-client.mjs','play-common/play-data.mjs','korean-racing/garage-core.js',
 'word-magic/app.mjs','word-magic/core.mjs','word-magic/recall.mjs','word-magic/recall.test.mjs','word-magic/index.html','word-magic/style.css','word-magic/shop.mjs',
 'order-rush/beginner.mjs','order-rush/beginner-core.mjs','order-rush/beginner-return.mjs','order-rush/beginner-return.test.mjs','order-rush/beginner-shop.mjs','order-rush/beginner.css',
 'spaceship-coop/app.mjs','spaceship-coop/starbook.mjs','spaceship-coop/starbook.test.mjs','spaceship-coop/style.css','spaceship-coop/shop.mjs','spaceship-coop/shop.css','spaceship-coop/return-recall.test.mjs','spaceship-coop/recovery.test.mjs',
 'learning-hub/collection-page.js','learning-hub/beginner-cards.css'
];
const sourceSha256=Object.fromEntries(sourceFiles.map(p=>[p,hash(fs.readFileSync(path.join(root,'experiences',p)))]));
const bundle=fs.readFileSync(path.join(root,'experiences/play-common/collection.js'));
for(const game of games)assert(fs.readFileSync(path.join(root,'experiences',game,'collection.js')).equals(bundle),game+' bundle mismatch');
const tap=fs.readFileSync(path.join(__dirname,'combined-tests.tap'),'utf8');assert.match(tap,/# tests 147/);assert.match(tap,/# pass 147/);assert.match(tap,/# fail 0/);
const ui=JSON.parse(fs.readFileSync(path.join(__dirname,'root-browser.json'),'utf8'));assert.equal(ui.errors.length,0);assert(ui.checks.every(c=>c.width===c.scrollWidth));
for(const [from,to] of [['play-common/collection-adapter.js','collection-adapter.after.js'],['word-magic/shop.mjs','magic-shop.after.mjs'],['learning-hub/collection-page.js','collection-page.after.js']])fs.copyFileSync(path.join(root,'experiences',from),path.join(__dirname,'source',to));
const result={at:new Date().toISOString(),status:'local-implementation-and-self-qa-complete',sourceSha256,canonicalBundle:{sha256:hash(bundle),bytes:bundle.length,copies:games,allIdentical:true},nodeTests:{passed:147,total:147},rootBrowser:{widths:ui.checks.map(c=>c.viewport),horizontalOverflow:0,errors:0,origin:ui.guestOrigin},
 qa:['experiences/word-magic/qa/return-memory-20261009','experiences/order-rush/qa/return-loop-20261009','experiences/spaceship-coop/qa/return-recall-20261009'],
 officialReview:'deferred-by-user',publicDeployment:false,realAccountWrites:0,operatingDbWrites:0,realParticipants:0,physicalPhones:0,newVoiceGeneration:0,newImageGeneration:0,voiceRerecordingDeferred:true,preview:'http://127.0.0.1:4340/learning-hub/#beginner-title'};
fs.writeFileSync(path.join(__dirname,'completion.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,sources:sourceFiles.length,nodeTests:147,bundleBytes:bundle.length,bundleCopies:games.length}));
