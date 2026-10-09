import * as THREE from '/scene-assets/three.module.js';
import {GLTFLoader} from '/__avatar-gltf/GLTFLoader.js';
import {createMongleAvatar} from '/avatar-v3.mjs';
import {exportAvatar} from './export-avatar.mjs';

export async function run(){
 const exported=await exportAvatar(),parsed=await new GLTFLoader().parseAsync(exported.buffer,''),source=await createMongleAvatar({mobile:false});source.setOutfit('scarf-apron');
 source.group.traverse(object=>{if(object.isLine)object.visible=false;});
 const checks=[],check=(name,value)=>{if(!value)throw new Error(name);checks.push(name);};
 const actualMaterials=[];
 for(let i=0;i<exported.gltf.materials.length;i++){
  const expected=exported.gltf.materials[i],actual=await parsed.parser.getDependency('material',i);actualMaterials.push(actual);
  check('material '+i+' retains base colour',actual.color.toArray().every((value,c)=>Math.abs(value-expected.pbrMetallicRoughness.baseColorFactor[c])<1e-6));
  if(expected.normalTexture)check('material '+i+' retains tangent normal scale',actual.normalMap&&Math.abs(actual.normalScale.x-expected.normalTexture.scale)<1e-6&&Math.abs(actual.normalScale.y-expected.normalTexture.scale)<1e-6);
  if(expected.pbrMetallicRoughness.metallicRoughnessTexture)check('material '+i+' retains roughness texture',!!actual.roughnessMap);
  if(expected.occlusionTexture)check('material '+i+' retains occlusion strength',actual.aoMap&&Math.abs(actual.aoMapIntensity-expected.occlusionTexture.strength)<1e-6);
  if(expected.extensions.KHR_materials_specular)check('material '+i+' retains eye specular intensity',Math.abs(actual.specularIntensity-expected.extensions.KHR_materials_specular.specularFactor)<1e-6);
  if(expected.extensions.KHR_materials_sheen){const sheen=expected.extensions.KHR_materials_sheen;check('material '+i+' retains sheen',actual.sheenColor.toArray().every((value,c)=>Math.abs(value-sheen.sheenColorFactor[c])<1e-6)&&Math.abs(actual.sheenRoughness-sheen.sheenRoughnessFactor)<1e-6);}
  if(expected.extensions.KHR_materials_clearcoat){const coat=expected.extensions.KHR_materials_clearcoat;check('material '+i+' retains clearcoat',Math.abs(actual.clearcoat-coat.clearcoatFactor)<1e-6&&Math.abs(actual.clearcoatRoughness-coat.clearcoatRoughnessFactor)<1e-6);}
  if(expected.occlusionTexture&&expected.pbrMetallicRoughness.metallicRoughnessTexture)check('material '+i+' shares AO-R and roughness-G image',actual.aoMap.image===actual.roughnessMap.image);
  for(const [key,info] of [['map',expected.pbrMetallicRoughness.baseColorTexture],['normalMap',expected.normalTexture],['roughnessMap',expected.pbrMetallicRoughness.metallicRoughnessTexture],['aoMap',expected.occlusionTexture]])if(info){const t=actual[key],transform=info.extensions.KHR_texture_transform;check('material '+i+' '+key+' retains texture transform',t.repeat.toArray().every((value,c)=>Math.abs(value-transform.scale[c])<1e-6)&&t.offset.toArray().every((value,c)=>Math.abs(value-transform.offset[c])<1e-6)&&t.flipY===false);}
 }
 let vertices=0,colouredVertices=0;parsed.scene.traverse(object=>{if(!object.isMesh)return;const g=object.geometry;check(object.name+' retains POSITION/NORMAL/TEXCOORD_0/COLOR_0',g.attributes.position&&g.attributes.normal&&g.attributes.uv&&g.attributes.color);vertices+=g.attributes.position.count;for(let i=0;i<g.attributes.color.count;i++)if(g.attributes.color.getX(i)<.999)colouredVertices++;});
 check('combined outfit retains contact shading vertices',colouredVertices>0);
 check('body and neck remain independently addressable nodes',parsed.scene.getObjectByName('mongle-scarf-first-steps')?.userData.slot==='neck'&&parsed.scene.getObjectByName('mongle-apron-starter')?.userData.slot==='body');
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,600);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e0e5e5');const camera=new THREE.PerspectiveCamera(35,480/600,.05,30);camera.position.set(.6,1.5,4.6);camera.lookAt(0,.96,0);
 scene.add(new THREE.HemisphereLight('#e0edff','#706b5e',1.5));const key=new THREE.DirectionalLight('#fff1dc',3.0);key.position.set(-3,4,4);scene.add(key);const fill=new THREE.DirectionalLight('#c7ddec',.55);fill.position.set(3,2,-1);scene.add(fill);
 const pixels=()=>{const canvas=document.createElement('canvas');canvas.width=480;canvas.height=600;const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);return ctx.getImageData(0,0,480,600).data;};
 const frames=[];for(const [label,group] of [['Runtime source',source.group],['GLB round trip',parsed.scene]]){scene.add(group);renderer.render(scene,camera);frames.push({label,pixels:pixels(),url:renderer.domElement.toDataURL('image/png')});scene.remove(group);}
 let sum=0,different=0,max=0;for(let i=0;i<frames[0].pixels.length;i+=4){let delta=0;for(let c=0;c<3;c++){const d=Math.abs(frames[0].pixels[i+c]-frames[1].pixels[i+c]);sum+=d;delta+=d;max=Math.max(max,d);}if(delta>15)different++;}
 const imageDifference={meanAbsoluteRgbError:sum/(480*600*3),pixelsAboveMean5:different,totalPixels:480*600,maxChannelDifference:max};
 check('same-light render is close to the runtime material result',imageDifference.meanAbsoluteRgbError<3&&different/(480*600)<.04);
 const container=document.createElement('main');container.style='display:flex;gap:20px;padding:20px;background:#e0e5e5';for(const frame of frames){const figure=document.createElement('figure');figure.style='margin:0';const image=new Image();image.src=frame.url;image.width=480;image.height=600;const caption=document.createElement('figcaption');caption.textContent=frame.label;caption.style='font:18px sans-serif;padding:10px';figure.append(image,caption);container.append(figure);}document.body.style='margin:0';document.body.replaceChildren(container);await Promise.all([...document.images].map(image=>image.decode()));
 const base64=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob([exported.buffer]));});
 renderer.dispose();renderer.forceContextLoss();source.dispose();parsed.scene.traverse(object=>{object.geometry?.dispose();});for(const m of new Set(actualMaterials)){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}
 return{base64,metadata:exported.metadata,checks,vertices,colouredVertices,imageDifference,gltf:exported.gltf};
}
