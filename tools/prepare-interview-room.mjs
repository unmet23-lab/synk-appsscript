import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../experiences/path-vr/',import.meta.url),dir=new URL('assets/interview/room/',root);
await mkdir(dir,{recursive:true});
const assets=[];
for(const id of ['wood_table_001','painted_plaster_wall','brown_photostudio_02']){
  const data=await(await fetch('https://api.polyhaven.com/files/'+id)).json();
  for(const key of id==='brown_photostudio_02'?['hdri']:['Diffuse','nor_gl','Rough']){
    const a=data[key]['1k'][key==='hdri'?'hdr':'jpg'],b=Buffer.from(await(await fetch(a.url)).arrayBuffer());
    if(createHash('md5').update(b).digest('hex')!==a.md5)throw Error('Asset integrity mismatch');
    const file=a.url.split('/').at(-1);await writeFile(new URL(file,dir),b);
    assets.push({id,file,source:a.url,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});
  }
}
await writeFile(new URL('manifest.json',dir),JSON.stringify({license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',assets},null,2)+'\n');
await writeFile(new URL('LICENSE.txt',dir),'Poly Haven assets: CC0 1.0 Universal.\nhttps://polyhaven.com/license\nhttps://creativecommons.org/publicdomain/zero/1.0/\n');
const loader=await(await fetch('https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/jsm/loaders/HDRLoader.js')).text();
if(!loader.includes('class HDRLoader'))throw Error('Invalid loader');
await writeFile(new URL('vendor/HDRLoader.js',root),loader.replaceAll("from 'three'","from './three.module.js'"));
console.log(JSON.stringify({files:assets.length,bytes:assets.reduce((s,a)=>s+a.bytes,0)}));
