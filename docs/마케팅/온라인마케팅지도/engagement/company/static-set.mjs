import { readFileSync, realpathSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Screen files may live outside the image in a host-mounted "static set":
//   <root>/sets/<id>/manifest.json, with each file at its repository path
//   <root>/current -> sets/<id>      (a relative link, replaced atomically)
// Only paths the manifest lists come from the set. Every other path, and every
// failure to read a valid set, falls back to the image's own copy.
export const STATIC_SET_SCHEMA='synk-company-static-set/v1';
const SET_ID=/^[a-f0-9]{16}$/,SHA256=/^[a-f0-9]{64}$/,CODE=/^STATIC_SET_[A-Z_]+$/;
export const safeStaticPath=value=>typeof value==='string'&&value.length>0&&value.length<=512&&!value.startsWith('/')&&!/[\\\0]/.test(value)&&value.split('/').every(part=>part&&part!=='.'&&part!=='..');

export function validateStaticManifest(value,id){
  if(!value||typeof value!=='object'||value.schema!==STATIC_SET_SCHEMA)throw Error('STATIC_SET_SCHEMA');
  if(!SET_ID.test(value.id||'')||(id!==undefined&&value.id!==id))throw Error('STATIC_SET_ID');
  const files=value.files;if(!files||typeof files!=='object'||Array.isArray(files))throw Error('STATIC_SET_FILES');
  const entries=Object.entries(files);if(!entries.length||entries.length>10000)throw Error('STATIC_SET_FILES');
  for(const [path,row] of entries)if(!safeStaticPath(path)||!row||!SHA256.test(row.sha256||'')||!Number.isSafeInteger(row.size)||row.size<0)throw Error('STATIC_SET_FILE');
  const directories=value.directories??[];
  if(!Array.isArray(directories)||!directories.every(safeStaticPath))throw Error('STATIC_SET_DIRECTORIES');
  // A directory is served as a whole, so every file under it must be listed.
  for(const directory of directories)if(!entries.some(([path])=>path.startsWith(directory+'/')))throw Error('STATIC_SET_DIRECTORIES');
  return {id:value.id,commit:typeof value.commit==='string'&&/^[a-f0-9]{40}$/.test(value.commit)?value.commit:null,files:new Set(entries.map(([path])=>path)),directories:new Set(directories)};
}

export function createStaticSet({root=process.env.SYNK_COMPANY_STATIC_ROOT||'',repository,recheckMs=1000,clock=Date.now,realpath=realpathSync,readText=path=>readFileSync(path,'utf8')}={}){
  if(typeof repository!=='string'||!repository)throw TypeError('repository root required');
  let view={directory:null,manifest:null,error:root?'STATIC_SET_UNREAD':null},checkedAt=-Infinity;
  function current(){
    if(!root)return view;
    const now=clock();if(now-checkedAt<recheckMs)return view;checkedAt=now;
    try{
      const sets=realpath(join(root,'sets')),directory=realpath(join(root,'current'));
      if(!directory.startsWith(sets+sep))throw Error('STATIC_SET_OUTSIDE');
      const id=directory.slice(sets.length+1);if(!SET_ID.test(id))throw Error('STATIC_SET_ID');
      if(view.directory===directory&&view.manifest)return view;
      view={directory,manifest:validateStaticManifest(JSON.parse(readText(join(directory,'manifest.json'))),id),error:null};
    }catch(error){view={directory:null,manifest:null,error:CODE.test(error?.message||'')?error.message:'STATIC_SET_UNREADABLE'};}
    return view;
  }
  const key=absolute=>{const value=relative(repository,absolute).split(sep).join('/');return safeStaticPath(value)?value:null;};
  function located(absolute,kind){
    const value=current(),name=value.manifest&&key(absolute);
    return name&&value.manifest[kind].has(name)?join(value.directory,...name.split('/')):absolute;
  }
  return {
    // `absolute` is the image path the server would otherwise read.
    file:absolute=>located(absolute,'files'),
    directory:absolute=>located(absolute,'directories'),
    status(){const value=current();return root?{mode:value.manifest?'host':'image',set:value.manifest?.id??null,commit:value.manifest?.commit??null,...(value.error?{error:value.error}:{})}:{mode:'image',set:null,commit:null};},
  };
}
