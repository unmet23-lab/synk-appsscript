// Offline asset preparation. The original CC0 scan is preserved in art-source.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MeshoptSimplifier} from '../art-source/asset-tools/node_modules/meshoptimizer/index.js';
const base=new URL('../art-source/coast-rocks-v6/',import.meta.url);
const original=JSON.parse(await fs.readFile(new URL('coast_rocks_01_2k.gltf',base),'utf8'));
const bytes=await fs.readFile(new URL('coast_rocks_01.bin',base));
function accessor(id){const a=original.accessors[id],v=original.bufferViews[a.bufferView];const data=bytes.subarray(v.byteOffset+(a.byteOffset||0),v.byteOffset+v.byteLength);return a.componentType===5125?new Uint32Array(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)):new Float32Array(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));}
const p=accessor(0),uv=accessor(1),n=accessor(2),idx=accessor(3);
await MeshoptSimplifier.ready;
const chunks=[],views=[],accessors=[];let offset=0;
function add(data,target){const b=Buffer.from(data.buffer,data.byteOffset,data.byteLength),id=views.length;views.push({buffer:0,byteOffset:offset,byteLength:b.length,...(target?{target}:{})});chunks.push(b);offset+=b.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return id;}
function attr(data,type,componentType,target,min,max){const id=accessors.length;accessors.push({bufferView:add(data,target),componentType,count:data.length/({VEC3:3,VEC2:2,SCALAR:1}[type]),type,...(min?{min,max}:{})});return id;}
const meshes=[],report=[];
for(const [name,target,error] of [['near',10500,.006],['far',2300,.025]]){
 const [indices,deviation]=MeshoptSimplifier.simplify(idx,p,3,target*3,error,['Prune']);
 const remap=new Map();let count=0;for(const i of indices)if(!remap.has(i))remap.set(i,count++);
 const pos=new Float32Array(count*3),normal=new Float32Array(count*3),tex=new Float32Array(count*2),out=new Uint32Array(indices.length);
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const [old,next] of remap){for(let j=0;j<3;j++){pos[next*3+j]=p[old*3+j];normal[next*3+j]=n[old*3+j];min[j]=Math.min(min[j],p[old*3+j]);max[j]=Math.max(max[j],p[old*3+j]);}tex.set(uv.subarray(old*2,old*2+2),next*2);}
 indices.forEach((i,j)=>out[j]=remap.get(i));
 const primitive={attributes:{POSITION:attr(pos,'VEC3',5126,34962,min,max),NORMAL:attr(normal,'VEC3',5126,34962),TEXCOORD_0:attr(tex,'VEC2',5126,34962)},indices:attr(out,'SCALAR',5125,34963),material:0};
 meshes.push({name:'coastal-rock-'+name,primitives:[primitive]});report.push({name,triangles:indices.length/3,vertices:count,relativeError:deviation});
}
const images=[];
for(const name of ['normal','color','orm']){const b=await fs.readFile(new URL(`coastal-rock-${name}.jpg`,base));images.push({bufferView:add(new Uint8Array(b)),mimeType:'image/jpeg'});}
const gltf={asset:{version:'2.0',generator:'SYNK coastal asset preparation / meshoptimizer 1.3.0',copyright:'Coast Rocks 01 / Rob Tuytel, Rico Cilliers / Poly Haven / CC0'},scene:0,scenes:[{nodes:[0,1]}],nodes:meshes.map((m,i)=>({name:m.name,mesh:i})),meshes,materials:[{name:'scanned-coastal-rock',normalTexture:{index:0,scale:.8},occlusionTexture:{index:2,strength:.65},pbrMetallicRoughness:{baseColorTexture:{index:1},metallicRoughnessTexture:{index:2},metallicFactor:0,roughnessFactor:1}}],textures:images.map((_,source)=>({sampler:0,source})),samplers:[{magFilter:9729,minFilter:9987}],images,accessors,bufferViews:views,buffers:[{byteLength:offset}]};
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);const glb=Buffer.concat([header,jh,json,bh,bin]);
await fs.writeFile(new URL('../assets/coastal-rocks-v6.glb',import.meta.url),glb);
const provenance={source:'https://polyhaven.com/a/coast_rocks_01',license:'https://polyhaven.com/license',authors:['Rob Tuytel','Rico Cilliers'],licenseId:'CC0-1.0',sourceTriangles:idx.length/3,processing:'UV-preserving meshoptimizer simplification; source normal/AO/roughness preserved; 2K color and 1K normal/ORM JPEG encoding; original retained outside runtime.',lods:report,bytes:glb.length,sha256:createHash('sha256').update(glb).digest('hex')};
await fs.writeFile(new URL('../art-source/coastal-rocks-v6-provenance.json',import.meta.url),JSON.stringify(provenance,null,2)+'\n');console.log(provenance);
