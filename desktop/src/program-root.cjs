'use strict';
const path=require('node:path');
function windowsDirectory(value) {
  if(typeof value!=='string'||!value.trim()||/[\u0000-\u001f]/.test(value))return null;
  // Root-relative and drive-relative paths depend on the launching process. Device
  // namespaces are not per-user folders; keep redirected drive/UNC folders valid.
  if(!/^(?:[a-z]:[\\/]|[\\/]{2}(?![.?][\\/])[^\\/]+[\\/][^\\/]+(?:[\\/]|$))/i.test(value))return null;
  return path.win32.normalize(value);
}
function unavailable(code) {return Object.assign(new Error(code),{code});}
function resolveProgramRoot({platform,env={},getHome}={}) {
  if(platform!=='win32')return '/Applications';
  const provided=env.LOCALAPPDATA;
  if(provided!==undefined&&provided!==null&&!(typeof provided==='string'&&!provided.trim())) {
    const local=windowsDirectory(provided);
    if(!local)throw unavailable('INVALID_LOCAL_APP_DATA');
    return path.win32.join(local,'Programs');
  }
  // LOCALAPPDATA may be absent from a launcher environment. Electron appData is
  // Roaming on Windows, so use the documented per-user Local default, never it.
  let profile=windowsDirectory(env.USERPROFILE);
  if(!profile){try{profile=windowsDirectory(getHome?.());}catch{}}
  if(!profile)throw unavailable('INSTALLATION_ROOT_UNAVAILABLE');
  return path.win32.join(profile,'AppData','Local','Programs');
}
module.exports={resolveProgramRoot};
