import * as THREE from './scene-assets/three.module.js';

// A small, fixed contact-lighting atlas replaces dozens of transparent shadow
// planes. It is generated once and follows the existing courtyard's local frame.
export function createEnvironmentFinish(materials){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,512,512);
 const pixel=(x,z)=>[(x+5)/10*512,(z+4)/8*512];
 function ellipse(x,z,w,d,opacity){const[p,q]=pixel(x,z);c.save();c.translate(p,q);c.scale(w*512/20,d*512/16);const g=c.createRadialGradient(0,0,.03,0,0,1);g.addColorStop(0,`rgba(0,0,0,${opacity})`);g.addColorStop(.35,`rgba(0,0,0,${opacity*.72})`);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();}
 for(const item of [[0,.45,2.5,1.9,.42],[-1.68,.57,1.15,1.0,.50],[1.98,.35,1.0,.95,.48],[-3.9,1.47,1.0,.90,.43],[3.8,1.55,1.1,1.0,.38],[-3.06,-1.5,2.4,1.3,.48],[2.83,-2.15,2.9,1.65,.42],[-.5,-2.23,2.1,1.2,.28],[-3.05,-2.4,3.1,1.2,.40],[-4.21,-.03,.60,.6,.34],[-1.88,-.03,.60,.6,.34]])ellipse(...item);
 const atlas=new THREE.CanvasTexture(canvas);atlas.flipY=false;atlas.colorSpace=THREE.NoColorSpace;atlas.minFilter=THREE.LinearFilter;atlas.generateMipmaps=false;
 const yaw={value:new THREE.Vector2(1,0)};
 // Deterministic material variation stays in the surface instead of adding more
 // geometry, while indirect contact darkening separates stone/wood from props.
 const noise=`float finishNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec2 k=vec2(127.1,311.7);return mix(mix(fract(sin(dot(i,k))*43758.5453),fract(sin(dot(i+vec2(1,0),k))*43758.5453),f.x),mix(fract(sin(dot(i+vec2(0,1),k))*43758.5453),fract(sin(dot(i+vec2(1,1),k))*43758.5453),f.x),f.y);}`;
 const configs=new Map([[materials.paving,{grain:.15,roughness:.82,ao:1}],[materials.stone,{grain:.13,roughness:.88,ao:.35}],[materials.stoneLight,{grain:.11,roughness:.75,ao:.3}],[materials.plaster,{grain:.10,roughness:.95,ao:.35}],[materials.terra,{grain:.08,roughness:.86,ao:.18}],[materials.wood,{grain:.07,roughness:.66,ao:.75}],[materials.darkWood,{grain:.08,roughness:.77,ao:.65}],[materials.ceramic,{grain:.025,roughness:.18,ao:0}]]);
 for(const[m,config]of configs){
  m.onBeforeCompile=shader=>{
   shader.uniforms.uContactAtlas={value:atlas};shader.uniforms.uCourtyardYaw=yaw;
   shader.vertexShader='varying vec3 vFinishPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>\nvec4 finishPos=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nfinishPos=instanceMatrix*finishPos;\n#endif\nvFinishPosition=(modelMatrix*finishPos).xyz;`);
   shader.fragmentShader=`varying vec3 vFinishPosition;uniform sampler2D uContactAtlas;uniform vec2 uCourtyardYaw;${noise}\n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nvec2 finishXZ=mat2(uCourtyardYaw.x,uCourtyardYaw.y,-uCourtyardYaw.y,uCourtyardYaw.x)*vFinishPosition.xz;float finishGrain=finishNoise(finishXZ*7.8+vFinishPosition.y*2.3)*.62+finishNoise(finishXZ*31.0+vFinishPosition.y*9.7)*.38;diffuseColor.rgb*=1.0+(finishGrain-.5)*${config.grain.toFixed(3)};`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(finishGrain-.5)*.15,.06,1.0);`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>\nfloat groundContact=texture2D(uContactAtlas,(finishXZ+vec2(5.,4.))/vec2(10.,8.)).r;float contactFade=1.0-smoothstep(.23,.68,vFinishPosition.y);float finishAO=mix(1.0,groundContact,contactFade*${config.ao.toFixed(3)});reflectedLight.indirectDiffuse*=finishAO;reflectedLight.directDiffuse*=mix(.78,1.0,finishAO);`);
  };
  m.customProgramCacheKey=()=>`synk-finish-v4-${config.grain}-${config.ao}`;m.needsUpdate=true;
 }
 return{texture:atlas,setYaw:value=>yaw.value.set(Math.cos(value),Math.sin(value)),dispose:()=>atlas.dispose()};
}
