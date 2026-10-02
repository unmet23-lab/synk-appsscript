'use strict';
const path=require('node:path');
const {CLIENTS}=require('./catalog.cjs');
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA=/^[a-f0-9]{64}$/;
function compareVersions(a,b) {
  if(!VERSION.test(a)||!VERSION.test(b))throw Error('INVALID_VERSION');
  const left=a.split('.').map(BigInt),right=b.split('.').map(BigInt);
  for(let i=0;i<3;i++)if(left[i]!==right[i])return left[i]>right[i]?1:-1;
  return 0;
}
function validRelease(r,{mode,platform,arch}) {
  return !!r&&['development','release'].includes(mode)&&['win32','darwin'].includes(platform)&&['x64','arm64'].includes(arch)&&Object.hasOwn(CLIENTS,r.id)&&r.mode===mode&&r.platform===platform&&r.arch===arch&&VERSION.test(r.version)&&SHA.test(r.executableSHA256||'')&&SHA.test(r.asarSHA256||'');
}
function installerPath(r,root) {
  const i=r?.installer;
  if(!root||!i||typeof i.relativePath!=='string'||!SHA.test(i.sha256||'')||!Number.isSafeInteger(i.bytes)||i.bytes<1||i.bytes>2147483648)return null;
  // Manifest paths are portable, fixed below a distribution root, and never supplied by a renderer.
  if(i.relativePath.includes('\\')||i.relativePath.includes(':')||i.relativePath.includes('\0')||path.posix.isAbsolute(i.relativePath))return null;
  const parts=i.relativePath.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'))return null;
  if(r.platform==='win32'&&!i.relativePath.endsWith('.exe'))return null;
  if(r.platform==='darwin'&&!i.relativePath.endsWith('.dmg'))return null;
  if(i.relativePath===r.id+(r.platform==='win32'?'.exe':'.dmg'))return path.resolve(root,i.relativePath);
  const prefix=[r.mode==='development'?'preview':'release',r.platform,r.arch,r.id].join('/')+'/';
  if(!i.relativePath.startsWith(prefix)||parts.length!==5)return null;
  return path.resolve(root,...parts);
}
function releasesFor(releases,target) {
  return (Array.isArray(releases)?releases:[]).filter(r=>validRelease(r,target)).sort((a,b)=>compareVersions(b.version,a.version));
}
module.exports={compareVersions,validRelease,installerPath,releasesFor};
