import * as THREE from '/scene-assets/three.module.js';
import {createMongleAvatar} from '/avatar-v3.mjs';

// Static, deliberately narrow exporter for the shared procedural avatar.
// Keep geometry UVs unchanged. Bake Texture.flipY into PNG rows exactly once;
// GLTFLoader sets flipY=false, so normal vectors need no extra Y sign change.
export async function exportAvatar(){
 const avatar=await createMongleAvatar({mobile:false});if(avatar.metrics().assetFailures?.length){avatar.dispose();throw new Error('Required source appearance used a fallback during export');}avatar.setOutfit('scarf-apron');avatar.group.updateMatrixWorld(true);
 const gltf={asset:{version:'2.0',generator:'SYNK shared avatar v4 static material export'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'mongle-v4',children:[],extras:{front:'+Z',up:'+Y',origin:'feet',rigged:false,productionApproved:false}}],meshes:[],materials:[],textures:[],images:[],samplers:[],bufferViews:[],accessors:[],buffers:[{byteLength:0}],extensionsUsed:['KHR_texture_transform','KHR_materials_sheen','KHR_materials_clearcoat','KHR_materials_unlit','KHR_materials_specular']};
 const chunks=[],materials=new Map(),textures=new Map(),images=new Map(),samplers=new Map(),textureReport=[],materialReport=[];let offset=0,omittedHairLines=0;
 function bufferView(array,target){const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength),padding=(4-bytes.byteLength%4)%4,index=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,...(target?{target}:{})});chunks.push(bytes,new Uint8Array(padding));offset+=bytes.length+padding;return index;}
 function accessor(array,type,target,bounds=false){const itemSize={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type],entry={bufferView:bufferView(array,target),componentType:array instanceof Uint32Array?5125:5126,count:array.length/itemSize,type};if(bounds){entry.min=Array(itemSize).fill(Infinity);entry.max=Array(itemSize).fill(-Infinity);for(let i=0;i<array.length;i++){entry.min[i%itemSize]=Math.min(entry.min[i%itemSize],array[i]);entry.max[i%itemSize]=Math.max(entry.max[i%itemSize],array[i]);}}const index=gltf.accessors.length;gltf.accessors.push(entry);return index;}
 function sampler(texture){const wrapping=value=>value===THREE.ClampToEdgeWrapping?33071:value===THREE.MirroredRepeatWrapping?33648:10497,entry={magFilter:texture.magFilter===THREE.NearestFilter?9728:9729,minFilter:9987,wrapS:wrapping(texture.wrapS),wrapT:wrapping(texture.wrapT)},key=JSON.stringify(entry);if(!samplers.has(key)){samplers.set(key,gltf.samplers.length);gltf.samplers.push(entry);}return samplers.get(key);}
 async function textureId(texture,kind='direct'){
  if(texture.channel!==0)throw new Error('Exporter requires TEXCOORD_0; unsupported texture channel '+texture.channel);
  const imageKey=texture.source.uuid+':'+texture.flipY+':'+kind;
  if(!images.has(imageKey)){
   const image=texture.image,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');
   if(texture.flipY){ctx.translate(0,canvas.height);ctx.scale(1,-1);}ctx.drawImage(image,0,0);ctx.setTransform(1,0,0,1,0,0);
   if(kind==='roughness-green'){const data=ctx.getImageData(0,0,canvas.width,canvas.height);for(let i=0;i<data.data.length;i+=4){data.data[i]=255;data.data[i+2]=255;data.data[i+3]=255;}ctx.putImageData(data,0,0);}
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Texture PNG encoding failed')),'image/png'));
   const index=gltf.images.length;gltf.images.push({name:texture.name||kind,bufferView:bufferView(new Uint8Array(await blob.arrayBuffer())),mimeType:'image/png'});images.set(imageKey,index);
   textureReport.push({image:index,name:texture.name,width:canvas.width,height:canvas.height,kind,flipYBaked:!!texture.flipY,colorSpace:texture.colorSpace});
  }
  const s=sampler(texture),key=images.get(imageKey)+':'+s;if(!textures.has(key)){textures.set(key,gltf.textures.length);gltf.textures.push({sampler:s,source:images.get(imageKey)});}return textures.get(key);
 }
 async function textureInfo(texture,kind='direct'){
  if(texture.center.x!==0||texture.center.y!==0)throw new Error('Nonzero texture centers must be baked explicitly');
  return{index:await textureId(texture,kind),texCoord:0,extensions:{KHR_texture_transform:{offset:texture.offset.toArray(),scale:texture.repeat.toArray(),...(texture.rotation?{rotation:texture.rotation}:{})}}};
 }
 async function material(m){
  if(materials.has(m.uuid))return materials.get(m.uuid);
  if(m.metalnessMap||m.bumpMap||m.displacementMap)throw new Error('Untransported material feature on '+m.uuid);
  const info={name:m.name||`surface-${gltf.materials.length}`,pbrMetallicRoughness:{baseColorFactor:[...m.color.toArray(),m.opacity],metallicFactor:m.metalness??0,roughnessFactor:m.roughness??1},doubleSided:m.side===THREE.DoubleSide,extensions:{}};
  if(m.transparent){info.alphaMode='BLEND';}else if(m.alphaTest){info.alphaMode='MASK';info.alphaCutoff=m.alphaTest;}
  if(m.map)info.pbrMetallicRoughness.baseColorTexture=await textureInfo(m.map);
  if(m.normalMap){if(m.normalMapType!==THREE.TangentSpaceNormalMap)throw new Error('Only tangent-space normals are supported');if(Math.abs(m.normalScale.x-m.normalScale.y)>1e-8)throw new Error('Unequal normalScale components require normal-vector baking');info.normalTexture={...await textureInfo(m.normalMap),scale:m.normalScale.x};}
  if(m.roughnessMap)info.pbrMetallicRoughness.metallicRoughnessTexture=await textureInfo(m.roughnessMap);
  if(m.aoMap)info.occlusionTexture={...await textureInfo(m.aoMap),strength:m.aoMapIntensity};
  if(m.isMeshBasicMaterial)info.extensions.KHR_materials_unlit={};
  if(m.sheen)info.extensions.KHR_materials_sheen={sheenColorFactor:m.sheenColor.toArray().map(value=>value*m.sheen),sheenRoughnessFactor:m.sheenRoughness};
  if(m.clearcoat)info.extensions.KHR_materials_clearcoat={clearcoatFactor:m.clearcoat,clearcoatRoughnessFactor:m.clearcoatRoughness};
  if(m.isMeshPhysicalMaterial&&m.specularIntensity!==1)info.extensions.KHR_materials_specular={specularFactor:m.specularIntensity,specularColorFactor:m.specularColor.toArray()};
  const index=gltf.materials.length;gltf.materials.push(info);materials.set(m.uuid,index);materialReport.push({index,uuid:m.uuid,name:info.name,baseColor:info.pbrMetallicRoughness.baseColorFactor,normalScale:m.normalMap?m.normalScale.toArray():null,roughness:m.roughness,aoStrength:m.aoMap?m.aoMapIntensity:null,vertexColors:!!m.vertexColors,mapRepeats:Object.fromEntries(['map','normalMap','roughnessMap','aoMap'].filter(key=>m[key]).map(key=>[key,m[key].repeat.toArray()]))});return index;
 }
 const batches=new Map();
 function append(object,transform,instanceColor){
  if(Array.isArray(object.material))throw new Error('Multiple material groups require separate export primitives');
  let part=object;while(part.parent&&part.parent!==avatar.group)part=part.parent;
  const slot=part.name==='mongle-scarf-first-steps'?'neck':part.name==='mongle-apron-starter'?'body':'base',key=slot+':'+object.material.uuid;
  let b=batches.get(key);if(!b){b={slot,material:object.material,p:[],n:[],uv:[],c:[],indices:[]};batches.set(key,b);}
  const g=object.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,color=g.attributes.color,base=b.p.length/3,normalMatrix=new THREE.Matrix3().getNormalMatrix(transform),v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(transform);b.p.push(...v.toArray());if(n)v.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();else v.set(0,1,0);b.n.push(...v.toArray());b.uv.push(uv?.getX(i)||0,uv?.getY(i)||0);for(let channel=0;channel<3;channel++){const component=color&&object.material.vertexColors?color.getComponent(i,channel):1;b.c.push(component*(instanceColor?instanceColor.getComponent(channel):1));}}
  const indices=g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i);if(transform.determinant()<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];b.indices.push(...indices.map(i=>i+base));
 }
 try{
  avatar.group.traverse(object=>{if(object.isLine){omittedHairLines+=object.geometry.attributes.position.count/2;return;}if(!object.isMesh)return;if(object.isInstancedMesh){const instance=new THREE.Matrix4(),color=new THREE.Color();for(let i=0;i<object.count;i++){object.getMatrixAt(i,instance);if(object.instanceColor)object.getColorAt(i,color);append(object,object.matrixWorld.clone().multiply(instance),object.instanceColor?new THREE.Vector3(color.r,color.g,color.b):null);}}else append(object,object.matrixWorld);});
  const slotNodes=new Map();for(const slot of ['base','neck','body']){const index=gltf.nodes.length;gltf.nodes.push({name:slot==='base'?'mongle-body':slot==='neck'?'mongle-scarf-first-steps':'mongle-apron-starter',children:[],extras:{slot,itemId:slot==='neck'?'mongle-scarf-first-steps':slot==='body'?'mongle-apron-starter':null}});gltf.nodes[0].children.push(index);slotNodes.set(slot,index);}
  for(const b of batches.values()){const attributes={POSITION:accessor(new Float32Array(b.p),'VEC3',34962,true),NORMAL:accessor(new Float32Array(b.n),'VEC3',34962),TEXCOORD_0:accessor(new Float32Array(b.uv),'VEC2',34962),COLOR_0:accessor(new Float32Array(b.c),'VEC3',34962)},indices=accessor(new Uint32Array(b.indices),'SCALAR',34963),mesh=gltf.meshes.length;gltf.meshes.push({primitives:[{attributes,indices,material:await material(b.material)}]});const node=gltf.nodes.length;gltf.nodes.push({name:b.slot+'-surface-'+mesh,mesh});gltf.nodes[slotNodes.get(b.slot)].children.push(node);}
  gltf.buffers[0].byteLength=offset;const json=new TextEncoder().encode(JSON.stringify(gltf)),jsonLength=Math.ceil(json.length/4)*4,buffer=new ArrayBuffer(12+8+jsonLength+8+offset),view=new DataView(buffer),bytes=new Uint8Array(buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);view.setUint32(12,jsonLength,true);view.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+jsonLength);bytes.set(json,20);view.setUint32(20+jsonLength,offset,true);view.setUint32(24+jsonLength,0x004e4942,true);let position=28+jsonLength;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.length;}
  const metadata={bytes:bytes.length,meshes:gltf.meshes.length,materials:gltf.materials.length,images:gltf.images.length,triangles:Array.from(batches.values()).reduce((sum,b)=>sum+b.indices.length/3,0),bodyBounds:avatar.metrics().bodyBounds,textureReport,materialReport,omittedHairLines,uvConvention:'Geometry UV unchanged; texture.flipY baked into image rows; no additional normal Y inversion',packedProperties:'Occlusion from R and roughness from G share the original image; metallic factor remains zero',limitations:['Static candidate with no bones or animations','Runtime subpixel short nap line segments are omitted','Body COLOR_0 contains contact tint for the combined scarf-apron outfit; runtime recomputes this when equipment changes','Runtime per-material envMapIntensity has no standard glTF equivalent and requires native lighting tuning','Blender/GLTFLoader import does not verify Unity URP rendering']};
  return{buffer,metadata,gltf};
 }finally{avatar.dispose();}
}
