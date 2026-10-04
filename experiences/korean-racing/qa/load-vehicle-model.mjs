// Offline QA helper: decode the shipped GLB with its bundled Draco decoder.
// This does not start a browser, change the asset, or load anything from a CDN.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../vendor/three.module.js';

let loaderModule;
async function bundledGLTFLoader(){
  if(!loaderModule){
    const three=new URL('../vendor/three.module.js',import.meta.url).href;
    const dataModule=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    const utils=(await fs.readFile(new URL('../vendor/BufferGeometryUtils.js',import.meta.url),'utf8')).replaceAll("from 'three'",`from '${three}'`);
    const loader=(await fs.readFile(new URL('../vendor/GLTFLoader.js',import.meta.url),'utf8')).replaceAll("from 'three'",`from '${three}'`).replace("from './BufferGeometryUtils.js'",`from '${dataModule(utils)}'`);
    loaderModule=import(dataModule(loader));
  }
  return loaderModule;
}

export async function loadVehicleModel() {
  const [wrapper,wasmBinary,bytes]=await Promise.all([
    fs.readFile(new URL('../vendor/draco_wasm_wrapper.js',import.meta.url),'utf8'),
    fs.readFile(new URL('../vendor/draco_decoder.wasm',import.meta.url)),
    fs.readFile(new URL('../assets/car.glb',import.meta.url))
  ]);
  const context=vm.createContext({WebAssembly,console,TextDecoder,TextEncoder,setTimeout,clearTimeout});
  vm.runInContext(wrapper,context);
  const draco=await context.DracoDecoderModule({wasmBinary});
  const length=bytes.readUInt32LE(12),document=JSON.parse(bytes.subarray(20,20+length));
  const binary=bytes.subarray(28+length),decoder=new draco.Decoder(),geometries=new Map();
  try {
    for(let i=0;i<document.meshes.length;i++){
      const primitive=document.meshes[i].primitives[0],compressed=primitive.extensions.KHR_draco_mesh_compression;
      const view=document.bufferViews[compressed.bufferView],data=binary.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
      const decoded=new draco.Mesh(),status=decoder.DecodeArrayToMesh(data,data.byteLength,decoded);
      if(!status.ok())throw new Error(status.error_msg());
      const geometry=new THREE.BufferGeometry();
      for(const [name,id] of Object.entries(compressed.attributes)){
        const attribute=decoder.GetAttributeByUniqueId(decoded,id),size=attribute.num_components(),count=decoded.num_points()*size,length=count*4,ptr=draco._malloc(length);
        decoder.GetAttributeDataArrayForAllPoints(decoded,attribute,draco.DT_FLOAT32,length,ptr);
        const values=new Float32Array(draco.HEAPF32.buffer,ptr,count).slice();draco._free(ptr);
        geometry.setAttribute({POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',COLOR_0:'color'}[name]||name,new THREE.BufferAttribute(values,size));
      }
      const count=decoded.num_faces()*3,ptr=draco._malloc(count*4);
      decoder.GetTrianglesUInt32Array(decoded,count*4,ptr);
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(draco.HEAPF32.buffer,ptr,count).slice(),1));draco._free(ptr);
      draco.destroy(decoded);geometries.set(data.toString('base64'),geometry);
    }
  } finally {draco.destroy(decoder);}
  // Use the actual bundled loader for node naming, transforms, material
  // partitions and authored userData.name. Manual GLB graph reconstruction
  // misses GLTFLoader's unique names and can hide browser-only regressions.
  const {GLTFLoader}=await bundledGLTFLoader(),loader=new GLTFLoader();
  loader.setDRACOLoader({preload(){},decodeDracoFile(buffer,onLoad,_attributes,_types,_space,onError){
    const geometry=geometries.get(Buffer.from(buffer).toString('base64'));
    if(!geometry){onError(new Error('Unknown bundled Draco buffer'));return;}
    onLoad(geometry.clone());
  }});
  const asset=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  return asset.scene;
}
