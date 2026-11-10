'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {UPDATE_SIGNING_KEYS,trustedSigningKeys,verifyManifestSignature,validateManifest}=require('../src/platform-update.cjs');
const {keyEntry,signManifest,signForPublication,loadPrivateKey}=require('../tools/update-signing.cjs');
const publisher=fs.readFileSync(path.join(__dirname,'../tools/publish-platform-release.cjs'),'utf8');
const feed={schemaVersion:1,product:'platform',channel:'preview',version:'0.4.87',releaseId:'platform-preview-0.4.87',buildId:'20261111.1',publishedAt:'2026-11-11T00:00:00.000Z',sourceHash:'d'.repeat(64),artifacts:[{platform:'win32',arch:'x64',url:'https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.87/SYNK-Platform-Preview-0.4.87-Signal-win-x64.exe',bytes:10,sha256:'e'.repeat(64),asarSHA256:'f'.repeat(64)}]};
function keyFile(t,pair){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-update-key-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const file=path.join(directory,'operating-private.pem');fs.writeFileSync(file,pair.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});return file;}
test('publication signs with the operating key and refuses a key the app does not pin',t=>{
  const pair=crypto.generateKeyPairSync('ed25519'),file=keyFile(t,pair),pinned=trustedSigningKeys([keyEntry(pair.publicKey)]);
  const signed=signForPublication(feed,{keyFile:file,trustedKeys:pinned});
  assert.equal(signed.signature.keyId,keyEntry(pair.publicKey).keyId);assert.equal(verifyManifestSignature(signed,{trustedKeys:pinned}),signed.signature.keyId);
  assert.equal(validateManifest(signed,{platform:'win32',arch:'x64',currentVersion:'0.4.86',currentBuildId:'20261110.1',now:Date.parse('2026-11-11T01:00:00.000Z')}).version,'0.4.87');
  // Re-signing a staged feed (resumed --apply) yields identical bytes.
  assert.equal(JSON.stringify(signForPublication(signed,{keyFile:file,trustedKeys:pinned})),JSON.stringify(signed));
  const stranger=crypto.generateKeyPairSync('ed25519');
  assert.throws(()=>signForPublication(feed,{keyFile:keyFile(t,stranger),trustedKeys:pinned}),{updateCode:'UPDATE_SIGNATURE_INVALID'});
  if(!UPDATE_SIGNING_KEYS.some(entry=>entry.keyId===keyEntry(pair.publicKey).keyId))assert.throws(()=>signForPublication(feed,{keyFile:file}),{updateCode:'UPDATE_SIGNATURE_INVALID'});
});
test('only an Ed25519 private key file is used for signing',t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-update-key-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const ec=path.join(directory,'ec.pem');fs.writeFileSync(ec,crypto.generateKeyPairSync('ec',{namedCurve:'P-256'}).privateKey.export({type:'pkcs8',format:'pem'}));
  assert.throws(()=>loadPrivateKey(ec),/Ed25519/);assert.throws(()=>loadPrivateKey(path.join(directory,'missing.pem')));
  const big=path.join(directory,'big.pem');fs.writeFileSync(big,'x'.repeat(5000));assert.throws(()=>loadPrivateKey(big),/regular file/);
});
test('the publisher signs before every feed comparison and never ships a signing key into the site',()=>{
  assert.match(publisher,/const manifest=signForPublication\(JSON\.parse\(fs\.readFileSync\(get\('manifest'\),'utf8'\)\),\{keyFile:get\('signing-key'\)\}\)/);
  assert.ok(publisher.indexOf('signForPublication(JSON.parse')<publisher.indexOf('const names=validateRelease(manifest,previous)'));
  // The release wrapper patches these exact boundaries; each must stay unique.
  for(const marker of ['  const changed=[];','async function verifyPublicArtifact(artifact){','function validateRelease(','  return changed;','if(require.main===module)main()'])assert.equal(publisher.split(marker).length,2,marker);
  const signer=fs.readFileSync(path.join(__dirname,'../tools/update-signing.cjs'),'utf8');assert.doesNotMatch(signer,/BEGIN [A-Z ]*PRIVATE KEY/);
  const signedFeed=signManifest(feed,crypto.generateKeyPairSync('ed25519').privateKey);assert.doesNotMatch(JSON.stringify(signedFeed),/PRIVATE/);
});
