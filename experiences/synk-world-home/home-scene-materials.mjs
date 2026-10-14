import * as THREE from './scene-assets/three.module.js';
import {createAvatarTextiles} from './avatar-textiles.mjs';

/** Existing WORLD textile owner, with the wardrobe-stage oak grain recipe.
 * Kept inside the WORLD package so no render-lab route is required at runtime.
 */
export function createHomeMaterials(){
  const textile=createAvatarTextiles({anisotropy:4,detailSize:512});
  const wool=textile.fabric('wool',[4,4]),cotton=textile.fabric('cotton',[3,3]);
  const materials=[],textures=textile.textures;
  function felt(color){const m=new THREE.MeshPhysicalMaterial({color,...wool,normalScale:new THREE.Vector2(.50,.50),roughness:1,sheen:.4,sheenColor:new THREE.Color('#c3b5a1'),sheenRoughness:.94});materials.push(m);return m;}
  const grain=new Uint8Array(256*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,g=Math.sin(y*1.4+Math.sin(x*.026)*3)*3+Math.sin(y*.32+x*.016)*4;grain[i]=173+g;grain[i+1]=143+g;grain[i+2]=106+g;grain[i+3]=255;}
  const map=new THREE.DataTexture(grain,256,128);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.generateMipmaps=true;map.minFilter=THREE.LinearMipmapLinearFilter;map.needsUpdate=true;textures.push(map);
  const wood=new THREE.MeshStandardMaterial({map,color:'#e8dbca',roughness:.72});materials.push(wood);
  const ceramic=new THREE.MeshPhysicalMaterial({color:'#e4e8df',roughness:.27,clearcoat:.5,clearcoatRoughness:.26});materials.push(ceramic);
  const cottonCream=new THREE.MeshPhysicalMaterial({color:'#e8ddc9',...cotton,roughness:.97,sheen:.2});materials.push(cottonCream);
  const result={feltBrown:felt('#403330'),innerEar:felt('#65514b'),tailCoral:felt('#cf605b'),tailDark:felt('#342c2a'),cottonStitch:felt('#f7eddd'),cottonCream,wood,ceramic};
  let disposed=false;
  return {...result,dispose(){if(disposed)return;disposed=true;materials.forEach(m=>m.dispose());new Set(textures).forEach(t=>t.dispose());}};
}
