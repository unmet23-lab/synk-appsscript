'use strict';
// Platform update feed signing. Only the publisher's own PC signs: the private
// keys live under ~/SYNK_보안/pc-update-signing (backed up only as ciphertext)
// and never enter synk-policy, its Actions workflow or a frozen release folder.
//   node desktop/tools/update-signing.cjs keys           make the operating and recovery key pair once (stops if any exists)
//   node desktop/tools/update-signing.cjs sign <in> <out> [--key=<private pem>]
//   node desktop/tools/update-signing.cjs verify <feed>   check a feed against the keys pinned in the app
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const updates=require(fs.existsSync(path.join(__dirname,'../src/platform-update.cjs'))?'../src/platform-update.cjs':'../source/src/platform-update.cjs');
const KEY_DIRECTORY=process.env.SYNK_UPDATE_SIGNING_DIR||path.join(os.homedir(),'SYNK_보안','pc-update-signing');
const OPERATING_KEY='operating-private.pem';
// A public KeyObject is used as it is; anything else (PEM, private key) gives its public half.
const publicOf=key=>key instanceof crypto.KeyObject&&key.type==='public'?key:crypto.createPublicKey(key);
const keyId=publicKey=>crypto.createHash('sha256').update(publicOf(publicKey).export({type:'spki',format:'der'})).digest('hex').slice(0,16);
function keyEntry(publicKey){const key=publicOf(publicKey);return {keyId:keyId(key),spki:key.export({type:'spki',format:'der'}).toString('base64')};}
function loadPrivateKey(file=path.join(KEY_DIRECTORY,OPERATING_KEY)){
  const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4096)throw Error('Update signing key is not a regular file');
  const key=crypto.createPrivateKey(fs.readFileSync(file,'utf8'));if(key.asymmetricKeyType!=='ed25519')throw Error('Update signing key must be Ed25519');
  return key;
}
// Re-signing the same manifest gives the same bytes (Ed25519 is deterministic),
// so a resumed publication compares equal to the feed it already staged.
function signManifest(manifest,privateKey){
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw Error('Manifest must be an object');
  const {signature,...unsigned}=manifest,id=keyId(privateKey);
  const value=crypto.sign(null,updates.signedManifestPayload(unsigned),privateKey).toString('base64');
  return {...unsigned,signature:{alg:'ed25519',keyId:id,value}};
}
// The installed app accepts only keys pinned in platform-update.cjs; refuse to publish anything else.
function assertPinned(signed,trustedKeys){updates.verifyManifestSignature(signed,trustedKeys?{trustedKeys}:{});return signed;}
function signForPublication(manifest,{keyFile,trustedKeys}={}){return assertPinned(signManifest(manifest,loadPrivateKey(keyFile||path.join(KEY_DIRECTORY,OPERATING_KEY))),trustedKeys);}
async function makeKeys(directory=KEY_DIRECTORY){
  if(fs.existsSync(directory))throw Error('Signing key folder already exists; keys are made once: '+directory);
  const backup=require('../../tools/복원/암호.js'),backupPublic=fs.readFileSync(backup.PUB(),'utf8');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const operating=crypto.generateKeyPairSync('ed25519'),recovery=crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(path.join(directory,OPERATING_KEY),operating.privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});
  fs.writeFileSync(path.join(directory,'operating-public.pem'),operating.publicKey.export({type:'spki',format:'pem'}),{flag:'wx'});
  // The recovery private key is written only as ciphertext for the owner's backup key
  // (SYNK-ENC-1, opened with the owner's passphrase); its plaintext never touches disk.
  const {Readable}=require('node:stream');
  await backup.encryptStream(backupPublic,Readable.from([Buffer.from(recovery.privateKey.export({type:'pkcs8',format:'pem'}))]),path.join(directory,'recovery-private.pem.enc'),'recovery-private.pem');
  fs.writeFileSync(path.join(directory,'recovery-public.pem'),recovery.publicKey.export({type:'spki',format:'pem'}),{flag:'wx'});
  const keys=[keyEntry(operating.publicKey),keyEntry(recovery.publicKey)];
  fs.writeFileSync(path.join(directory,'pinned-keys.json'),JSON.stringify(keys,null,2)+'\n',{flag:'wx'});
  return keys;
}
async function main(argv){
  const [command,...rest]=argv,option=name=>rest.find(arg=>arg.startsWith('--'+name+'='))?.slice(name.length+3),files=rest.filter(arg=>!arg.startsWith('--'));
  // A mistyped option must stop here, never fall back to the default operating key.
  const unknown=rest.filter(arg=>arg.startsWith('--')&&!(command==='sign'&&/^--key=.+/.test(arg)));if(unknown.length)throw Error('Unknown option: '+unknown.join(' '));
  if(command==='keys'){console.log(JSON.stringify(await makeKeys(),null,2));return;}
  if(command==='sign'&&files.length===2){const signed=signForPublication(JSON.parse(fs.readFileSync(files[0],'utf8')),{keyFile:option('key')});fs.writeFileSync(files[1],JSON.stringify(signed,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({ok:true,keyId:signed.signature.keyId}));return;}
  if(command==='verify'&&files.length===1){console.log(JSON.stringify({ok:true,keyId:updates.verifyManifestSignature(JSON.parse(fs.readFileSync(files[0],'utf8')))}));return;}
  throw Error('Use: keys | sign <in> <out> [--key=<pem>] | verify <feed>');
}
if(require.main===module)main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={KEY_DIRECTORY,keyId,keyEntry,loadPrivateKey,signManifest,signForPublication,makeKeys};
