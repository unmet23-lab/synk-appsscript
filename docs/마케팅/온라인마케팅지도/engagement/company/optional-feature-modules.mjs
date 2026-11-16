import {lstatSync,statSync,accessSync,constants} from 'node:fs';

// A release can omit a whole feature that has not shipped yet. A partly
// installed feature or a broken installed module must still stop startup.
export async function loadOptionalFeature(name, modules, base = import.meta.url) {
  const files=modules.map(spec=>({...spec,url:new URL(spec.file,base)}));
  const present=files.map(spec=>{
    try{lstatSync(spec.url);return true;}
    catch(error){if(error.code==='ENOENT')return false;throw error;}
  });
  if(!present.some(Boolean))return null;
  if(!present.every(Boolean))throw new Error('Incomplete optional feature: '+name);
  for(const spec of files){
    if(!statSync(spec.url).isFile())throw new Error('Invalid optional feature file: '+name);
    accessSync(spec.url,constants.R_OK);
  }
  const loaded=await Promise.all(files.map(spec=>spec.kind==='asset'?null:import(spec.url.href)));
  for(let i=0;i<files.length;i++)for(const key of files[i].exports||[]){
    if(typeof loaded[i][key]!=='function')throw new Error('Invalid optional feature export: '+name+'.'+key);
  }
  return loaded;
}
