// Browser authoring helper. Import only from a local QA page and save returned
// payloads as files; this module is never imported by the WORLD runtime.
import * as THREE from '../scene-assets/three.module.js';
import {createAvatarTextiles} from '../avatar-textiles.mjs';

export const detailKinds=['cotton-detail','knit-detail','denim-detail','wax-detail','silk-detail','linen-detail','corduroy-detail','quilted-detail','velvet-detail','wool-felt-detail'];
const roles=maps=>Object.entries({colour:maps.map,normal:maps.normalMap,properties:maps.roughnessMap,direction:maps.anisotropyMap}).filter(([,t])=>t);
export function bakeTextileMaps(kind,{detailSize=1024}={}){
 const textiles=createAvatarTextiles({detailSize});
 try{return roles(textiles.fabric(kind,[1,1])).map(([role,texture])=>({path:`assets/avatar-textiles-v1/${kind.endsWith('-detail')?detailSize+'/':''}${kind}-${role}.png`,dataUrl:texture.image.toDataURL('image/png')}));}
 finally{textiles.textures.forEach(texture=>texture.dispose());}
}
export function bakeEnvironment(){
 const renderer=new THREE.WebGLRenderer(),scene=new THREE.Scene();scene.background=new THREE.Color('#dfe7e7');
 const material=new THREE.MeshBasicMaterial({color:'#ffffff'}),generator=new THREE.PMREMGenerator(renderer);let target;
 try{
  for(const [w,h,position]of [[5,4,[-3,3,4]],[4,3,[3,2,-3]]]){const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);panel.position.set(...position);panel.lookAt(0,1,0);scene.add(panel);}
  target=generator.fromScene(scene,.08);const values=new Uint16Array(target.width*target.height*4);renderer.readRenderTargetPixels(target,0,0,target.width,target.height,values);
  return {path:'assets/wardrobe-environment-v1.bin.gz',width:target.width,height:target.height,values}; // gzip the returned bytes without conversion.
 }finally{target?.dispose();generator.dispose();scene.traverse(object=>object.geometry?.dispose());material.dispose();renderer.dispose();renderer.forceContextLoss();}
}
