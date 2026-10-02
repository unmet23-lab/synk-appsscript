import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { DRACOLoader } from './vendor/DRACOLoader.js';
import { HDRLoader } from './vendor/HDRLoader.js';
import { WORDS, STAGES, WORD_BY_ID, PROGRESS_KEY, makeQuestions, loadProgress, recordRound, reviewStage } from './learning.js';
import { Narrator } from './narration.js';

const $ = id => document.getElementById(id);
if('scrollRestoration' in history)history.scrollRestoration='manual';
const stage = $('experience');
let mobile = matchMedia('(max-width: 650px)').matches;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ROAD_END = 2250, LANES = [-3.45, 0, 3.45];
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
let seed = 93127;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const hash = (x, z) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123; return v - Math.floor(v); };
function noise(x, z) {
  const a = Math.floor(x), b = Math.floor(z), fx = x - a, fz = z - b;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash(a,b),hash(a+1,b),u),lerp(hash(a,b+1),hash(a+1,b+1),u),v);
}
function fbm(x,z) { return noise(x,z)*.55 + noise(x*2,z*2)*.28 + noise(x*4,z*4)*.12 + noise(x*8,z*8)*.05; }
const pathX = s => Math.sin(s / 235) * 25 + Math.sin(s / 580) * 31;
const pathY = s => 23 + Math.sin(s / 280) * 2.8 + Math.sin(s / 100) * 1.2;
const pathAngle = s => Math.atan(Math.cos(s / 235) * 25 / 235 + Math.cos(s / 580) * 31 / 580);
function roadPoint(s, offset = 0, y = 0) {
  return new THREE.Vector3(pathX(s) + Math.cos(pathAngle(s)) * offset, pathY(s) + y, s - Math.sin(pathAngle(s)) * offset);
}
function groundHeight(x,z) {
  const offset = x - pathX(z), absolute = Math.abs(offset), edge = Math.max(0, absolute - 7.1);
  if (offset > 0) return Math.max(-12, pathY(z) - edge * .78 + fbm(x*.075,z*.065)*Math.min(2,edge*.03));
  return pathY(z) - .1 + Math.pow(edge,1.15)*.105 + fbm(x*.015,z*.015)*Math.min(115,edge*.62) + fbm(x*.065,z*.065)*Math.min(8,edge*.13);
}

let renderer, scene, camera, car, rivals = [], wheels = [], gate = null, gateIndex = 0;
let running = false, paused = false, ready = false, auto = false, finished = false;
let playerS = 75, playerOffset = 0, velocity = 26, elapsed = 0, boost = 0, answers = [], correct = 0;
let inputs = {left:false,right:false}, aimOffset = 0, laneAim = null, attractTime = 0, toastTime = 0;
let renderFrames = 0, renderTotal = 0, adaptiveTime = 0, frameSample = [], warmupFrames = 0;
let soundEnabled = false, soundTouched = false, audio = null, motor = null, motorGain = null, windGain = null;
let light, currentQuality = 'auto', mode = mobile ? 'low' : 'high';
let pineTexture, surfaceTextures = {};
let driverName='marin', mascotTextures={}, driverMood='base', moodTime=0;
let worldTime = {value:0}, carTemplate, ocean, leaves, clouds;
const clock = new THREE.Clock();
const tempMatrix = new THREE.Matrix4(), tempQuat = new THREE.Quaternion(), tempScale = new THREE.Vector3();
const tempObj = new THREE.Object3D();
const sunDirection = new THREE.Vector3(.48,.82,.65).normalize();
let selectedStage=STAGES[0], questionBank=makeQuestions(selectedStage), progress;
try {progress=loadProgress(localStorage);} catch {progress=loadProgress({getItem:()=>null});}
let stagePage=0, roundWasDemo=false, starting=false, narrationUnavailable=false;
const commonClips=['intro','cue-picture','cue-listen','correct','answer','boost','retry','finish'];
const narrator=new Narrator({getContext:()=>audio,onActive:active=>{
  if(audio&&motorGain)motorGain.gain.setTargetAtTime(active?.014:running&&!paused?.055:0,audio.currentTime,.12);
},onUnavailable:()=>{narrationUnavailable=true;displayQuestion();showToast('음성을 재생하지 못해 듣기 자막을 켰어요.',4);}});
const labelStage=s=>s.number?`${String(s.number).padStart(3,'0')} · ${s.title}`:s.title;
function speak(ids,text,kind='comment',interrupt=false){if(soundEnabled)narrator.speak(ids,text,kind,{interrupt});}
function displayQuestion(){
  if(!gate?.announced||gate.judged)return;
  const reveal=gate.q.mode==='picture'||$('subtitles').checked||!soundEnabled||narrationUnavailable;
  $('prompt').textContent=reveal?gate.q.mode==='picture'?gate.q.prompt:`“${gate.q.word}”를 골라줘!`:gate.q.prompt;
  $('question-help').textContent=!soundEnabled||narrationUnavailable?'소리를 켜면 귀로도 문제를 들을 수 있어요.':'보기를 누르거나 좌우로 운전해 길을 골라요.';
}
function narrateQuestion(interrupt=false){if(!gate||gate.judged||!gate.announced)return;displayQuestion();speak([gate.q.mode==='picture'?'cue-picture':'cue-listen',gate.q.answer],gate.q.spoken,'question',interrupt);}
function renderStages(){
  const query=$('stage-search').value.trim(),filter=$('stage-filter').value;
  const list=STAGES.filter(s=>(filter==='all'||s.mode===filter||s.band===filter)&&(!query||`${s.title} ${s.number} ${s.words.map(id=>WORD_BY_ID[id].word).join(' ')}`.includes(query)));
  const pages=Math.max(1,Math.ceil(list.length/12));stagePage=clamp(stagePage,0,pages-1);
  $('stage-count').textContent=`${list.length}개 스테이지`;$('stage-page').textContent=`${stagePage+1} / ${pages}`;
  $('stage-prev').disabled=stagePage===0;$('stage-next').disabled=stagePage>=pages-1;
  $('learned-count').textContent=Object.values(progress.words).filter(p=>p.correct>0).length.toLocaleString('ko-KR');
  $('cleared-count').textContent=Object.values(progress.stages).filter(p=>p.cleared).length;
  $('review-stage').disabled=!reviewStage(progress);$('stage-grid').replaceChildren();
  for(const s of list.slice(stagePage*12,stagePage*12+12)){
    const b=document.createElement('button');b.className='stage-card';b.classList.toggle('selected',s.id===selectedStage.id);b.dataset.stage=s.id;b.setAttribute('aria-pressed',String(s.id===selectedStage.id));
    for(const [tag,css,text] of [['span','stage-card-top',`${String(s.number).padStart(3,'0')} / ${s.mode==='picture'?'그림 + 듣기':'듣고 단어 선택'}`],['strong','',s.title],['span','stage-words',s.words.map(id=>WORD_BY_ID[id].word).join(' · ')],['span','stage-status',progress.stages[s.id]?.cleared?`통과 · 최고 ${progress.stages[s.id].bestScore}/5`:progress.stages[s.id]?`다시 도전 · 최고 ${progress.stages[s.id].bestScore}/5`:'5단어 · 아직 만나지 않았어요']]){
      const e=document.createElement(tag);e.className=css;e.textContent=text;b.appendChild(e);
    }
    b.addEventListener('click',()=>selectStage(s));$('stage-grid').appendChild(b);
  }
  if(!list.length){const p=document.createElement('p');p.className='empty-stages';p.textContent='다른 단어나 주제로 찾아보세요.';$('stage-grid').appendChild(p);}
}
function selectStage(s){
  if(starting)return;selectedStage=s;questionBank=makeQuestions(s);running=false;auto=false;silence();
  const name=document.createElement('span');name.textContent='스테이지 선택 ↓';$('choose-stage').replaceChildren(document.createTextNode(labelStage(s)+' '),name);
  $('start').firstChild.textContent=`${s.words.length}문제 달리기 `;
  if(ready)reset(false);renderStages();stage.scrollIntoView({behavior:'auto',block:'start'});
}

function canvasTexture(size, paint) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return t;
}
function makeSurfaceTexture(kind) {
  return canvasTexture(512,(ctx,size)=>{
    const img = ctx.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const n = random(), i=(y*size+x)*4;
      const v=kind==='road' ? 47+n*36 : 113+n*34;
      img.data[i]=v;img.data[i+1]=kind==='road'?v+2:v+4;img.data[i+2]=kind==='road'?v+3:v-13;img.data[i+3]=255;
    }
    ctx.putImageData(img,0,0);
    if(kind==='road') {
      for(let j=0;j<14;j++) {
        let x=random()*size,y=random()*size;ctx.strokeStyle='rgba(15,20,21,.32)';ctx.lineWidth=.4+random();ctx.beginPath();ctx.moveTo(x,y);
        for(let k=0;k<12;k++){x+=(random()-.5)*22;y+=random()*9;ctx.lineTo(x,y);}ctx.stroke();
      }
      ctx.fillStyle='rgba(10,13,17,.09)'; for(const x of [110,155,235,280,360,405])ctx.fillRect(x,0,8,size);
    }
  });
}
function ribbon(offset, width, start, end, material, dashed=false, height=.022) {
  const p=[],uv=[],idx=[];
  let vertex=0;
  const step=dashed?7:3;
  for(let s=start;s<end;s+=step) {
    const e=Math.min(end,s+(dashed?3.2:step));
    for(const [t,o,u] of [[s,offset-width/2,0],[s,offset+width/2,1],[e,offset-width/2,0],[e,offset+width/2,1]]){
      const v=roadPoint(t,o,height);p.push(v.x,v.y,v.z);uv.push(u,t/16);
    }
    idx.push(vertex,vertex+2,vertex+1,vertex+1,vertex+2,vertex+3);vertex+=4;
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
function coastalTerrainMaterial() {
  const mat=new THREE.MeshStandardMaterial({map:surfaceTextures.terrain,normalMap:surfaceTextures.cliffNormal,normalScale:new THREE.Vector2(.42,.42),vertexColors:true,roughness:1});
  // Blend grass, pale rock and sand in one draw call instead of tinting grass over every surface.
  mat.onBeforeCompile=shader=>{
    shader.uniforms.coastalRock={value:surfaceTextures.cliff};shader.uniforms.coastalSand={value:surfaceTextures.beach};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float surface;\nvarying float vSurface;\nvarying vec3 vTerrainPosition;\nvarying vec3 vTerrainNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSurface=surface;\nvTerrainPosition=position;\nvTerrainNormal=normal;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vSurface;\nvarying vec3 vTerrainPosition;\nvarying vec3 vTerrainNormal;\nuniform sampler2D coastalRock;\nuniform sampler2D coastalSand;').replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_MAP
        vec3 weights=abs(normalize(vTerrainNormal));
        float rockBlend=weights.x/(weights.x+weights.z+.001);
        vec3 rockColor=mix(texture2D(coastalRock,vTerrainPosition.xy*.08).rgb,texture2D(coastalRock,vTerrainPosition.zy*.08).rgb,rockBlend)*vec3(.46,.39,.32);
        vec3 sandColor=mix(texture2D(coastalSand,vTerrainPosition.xz*.1).rgb,vec3(.52,.40,.25),.35);
        diffuseColor.rgb=mix(diffuseColor.rgb,rockColor,clamp(vSurface,0.,1.));
        diffuseColor.rgb=mix(diffuseColor.rgb,sandColor,clamp(vSurface-1.,0.,1.));
      #endif`);
  };
  mat.customProgramCacheKey=()=> 'coastal-terrain-v2';return mat;
}
function setupTerrain() {
  const asphalt=surfaceTextures.road;asphalt.wrapS=asphalt.wrapT=THREE.RepeatWrapping;
  const asphaltMat=new THREE.MeshStandardMaterial({map:asphalt,normalMap:surfaceTextures.roadNormal,normalScale:new THREE.Vector2(.35,.35),roughness:.89,metalness:.025,color:0xc4c8c4,envMapIntensity:.22});
  ribbon(0,11.6,-65,ROAD_END,asphaltMat,false,0);
  const shoulderTex=makeSurfaceTexture('sand');shoulderTex.wrapS=shoulderTex.wrapT=THREE.RepeatWrapping;
  const shoulder=new THREE.MeshStandardMaterial({map:shoulderTex,color:0xb7b6a8,roughness:1});
  ribbon(-6.2,.8,-65,ROAD_END,shoulder,false,-.025);ribbon(6.2,.8,-65,ROAD_END,shoulder,false,-.025);
  const white=new THREE.MeshStandardMaterial({color:0xe7e5cb,roughness:.9});
  const yellow=new THREE.MeshStandardMaterial({color:0xcfb466,roughness:.9});
  ribbon(-5.45,.13,-60,ROAD_END,white);ribbon(5.45,.13,-60,ROAD_END,white);
  ribbon(-1.725,.1,-60,ROAD_END,white,true);ribbon(1.725,.1,-60,ROAD_END,white,true);
  ribbon(-5.72,.1,-60,ROAD_END,yellow);ribbon(5.72,.1,-60,ROAD_END,yellow);
  // A single continuous terrain surface keeps the course lightweight on phones.
  const p=[],colors=[],idx=[],uv=[],surfaces=[],nx=140,nz=550, color=new THREE.Color();
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
    const s=-150+z/nz*(ROAD_END+500),offset=-350+x/nx*520,wx=pathX(s)+offset,h=groundHeight(wx,s);
    p.push(wx,h-.055,s);uv.push(wx/16,s/16);
    const n=fbm(wx*.08,s*.08),rock=offset<-70&&noise(wx*.035,s*.035)>.60;
    const coast=offset>13, surface=coast?(h<2?2:1):(rock ? .8 : 0);
    surfaces.push(surface);color.set(0xffffff);color.multiplyScalar(.90+n*.20);colors.push(color.r,color.g,color.b);
  }
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=z*(nx+1)+x;idx.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('surface',new THREE.Float32BufferAttribute(surfaces,1));geo.setIndex(idx);geo.computeVertexNormals();
  const terrain=new THREE.Mesh(geo,coastalTerrainMaterial());terrain.receiveShadow=true;scene.add(terrain);
}
function setupSky() {
  // Only distant headlands receive aerial perspective; the coast stays crisp.
  scene.fog=new THREE.Fog(0x91bce0,1800,6500);
}
function setupWater() {
  const mat=new THREE.ShaderMaterial({uniforms:{time:worldTime,sun:{value:sunDirection}},vertexShader:`varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,fragmentShader:`
    varying vec3 vWorld;uniform float time;uniform vec3 sun;
    void main(){
      vec2 p=vWorld.xz;
      float a=sin(p.x*.38+p.y*.14+time*.8),b=cos(p.x*.19-p.y*.31-time*.65);
      vec3 n=normalize(vec3(a*.018+sin(p.y*1.9+time)*.012,1.,b*.028));
      vec3 v=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(0.,dot(n,v)),4.);
      float roadX=sin(p.y/235.)*25.+sin(p.y/580.)*31.;
      float roadY=23.+sin(p.y/280.)*2.8+sin(p.y/100.)*1.2;
      float shore=p.x-roadX-7.1-(roadY+2.2)/.78;
      float depth=smoothstep(0.,130.,shore);
      vec3 col=mix(vec3(.018,.47,.38),vec3(.018,.14,.29),depth);
      float caustic=pow(.5+.5*sin(p.x*.47+p.y*.24+sin(p.y*.17+time)*1.6),10.);
      col+=vec3(.02,.07,.04)*caustic*(1.-depth);
      col=mix(col,vec3(.22,.43,.64),fresnel*.65);
      float sparkle=pow(max(0.,dot(reflect(-sun,n),v)),160.);
      col+=vec3(1.,.94,.78)*sparkle*1.9;
      float foam=(1.-smoothstep(.1,2.5,abs(shore-1.5-sin(time*.7+p.y*.08)*.9)))*(.36+.24*sin(p.y*1.2+time));
      col=mix(col,vec3(.75,.9,.85),foam);
      float distanceToEye=length(vWorld-cameraPosition);
      col=mix(col,vec3(.16,.36,.55),smoothstep(2000.,5500.,distanceToEye)*.35);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  ocean=new THREE.Mesh(new THREE.PlaneGeometry(8000,10000),mat);ocean.rotation.x=-Math.PI/2;ocean.position.set(2500,-2.2,2200);scene.add(ocean);
}
function setupCoastalScenery() {
  const material=coastalTerrainMaterial();
  // Low-poly terrain silhouettes add depth without spending mobile draw calls on foliage.
  const islands=[
    {x:165,z:440,rx:63,rz:110,h:54},
    {x:355,z:790,rx:137,rz:190,h:116},
    {x:690,z:1250,rx:195,rz:290,h:158},
    {x:245,z:1630,rx:110,rz:178,h:92},
    {x:570,z:2240,rx:230,rz:300,h:174},
    {x:1000,z:2900,rx:300,rz:360,h:212}
  ];
  islands.forEach((island,k)=>{
    const positions=[],uv=[],colors=[],surfaces=[],indices=[],segments=72,rings=28,color=new THREE.Color();
    for(let r=0;r<=rings;r++)for(let j=0;j<=segments;j++){
      const t=j/segments*Math.PI*2,rad=r/rings;
      const rim=1+Math.sin(t*3+k)*.10+Math.cos(t*5-k)*.065;
      const x=island.x+Math.cos(t)*island.rx*rad*rim,z=island.z+Math.sin(t)*island.rz*rad*rim;
      const ridge=.76+fbm(x*.018,z*.018)*.46;
      const height=-5+island.h*Math.pow(Math.max(0,1-rad*rad),1.45)*ridge;
      positions.push(x,height,z);uv.push(x/18,z/18);
      const rock=noise(x*.04,z*.04)>.67;
      surfaces.push(height<3?2:Math.max(rock ? .23 : 0,THREE.MathUtils.smoothstep(rad,.60,.78)));
      color.set(0xffffff);color.multiplyScalar(.90+noise(x*.08,z*.08)*.19);colors.push(color.r,color.g,color.b);
    }
    for(let r=0;r<rings;r++)for(let j=0;j<segments;j++){const a=r*(segments+1)+j,b=a+segments+1;indices.push(a,a+1,b,b,a+1,b+1);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('surface',new THREE.Float32BufferAttribute(surfaces,1));geo.setIndex(indices);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;scene.add(mesh);
    if(k===0){
      const lighthouse=new THREE.Group();
      const white=new THREE.MeshStandardMaterial({color:0xf5f0dc,roughness:.78});
      const red=new THREE.MeshStandardMaterial({color:0xa43729,roughness:.65});
      const tower=new THREE.Mesh(new THREE.CylinderGeometry(1.3,2,11,16),white);tower.position.y=5.5;
      const balcony=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.1,.5,16),white);balcony.position.y=10.6;
      const lantern=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,2,12),new THREE.MeshStandardMaterial({color:0x9ac9d9,metalness:.4,roughness:.2}));lantern.position.y=11.8;
      const roof=new THREE.Mesh(new THREE.ConeGeometry(1.75,1.7,16),red);roof.position.y=13.5;
      lighthouse.add(tower,balcony,lantern,roof);lighthouse.position.set(island.x,positions[1]-.15,island.z);scene.add(lighthouse);
    }
  });
  const hullMaterial=new THREE.MeshStandardMaterial({color:0xf2f1e3,roughness:.5});
  const sailMaterial=new THREE.MeshStandardMaterial({color:0xfffae8,side:THREE.DoubleSide,roughness:.85});
  for(const [x,z,angle,size] of [[260,340,.45,1],[470,940,-.4,1.3],[370,1810,.75,1.15]]){
    const boat=new THREE.Group();
    const hull=new THREE.Mesh(new THREE.SphereGeometry(1,12,6),hullMaterial);hull.scale.set(1.15,.48,3.2);hull.position.y=.18;
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,8,6),hullMaterial);mast.position.y=4;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,.8,-2.8,0,.8,.12,0,7.6,.12],3));geo.computeVertexNormals();
    const sail=new THREE.Mesh(geo,sailMaterial);boat.add(hull,mast,sail);boat.position.set(x,-2.1,z);boat.rotation.y=angle;boat.scale.setScalar(size);scene.add(boat);
  }
}
function setupVegetation() {
  // Crossed alpha cards retain needle detail at a fraction of full tree geometry.
  const treeGeo=new THREE.PlaneGeometry(7.2,11.5);treeGeo.translate(0,5.75,0);
  const treeMat=new THREE.MeshBasicMaterial({map:pineTexture,alphaTest:.48,side:THREE.DoubleSide,color:0xcdd6c0});
  leaves=new THREE.InstancedMesh(treeGeo,treeMat,1200);
  const color=new THREE.Color();
  for(let i=0;i<600;i++){
    const s=-50+random()*(ROAD_END+200),offset=-(10+Math.pow(random(),1.55)*230),x=pathX(s)+offset,z=s;
    const size=.55+random()*1.25,y=groundHeight(x,z),angle=random()*Math.PI;
    for(let j=0;j<2;j++){
      tempObj.position.set(x,y-.2,z);tempObj.rotation.set(0,angle+j*Math.PI/2,0);tempObj.scale.set(size*(.85+random()*.25),size,size);tempObj.updateMatrix();leaves.setMatrixAt(i*2+j,tempObj.matrix);color.setRGB(.82+random()*.15,.84+random()*.12,.76+random()*.16);leaves.setColorAt(i*2+j,color);
    }
  }
  leaves.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:pineTexture,alphaTest:.48,side:THREE.DoubleSide});leaves.castShadow=true;scene.add(leaves);
  // Roadside stone, grass and steel rails are instanced rather than thousands of draw calls.
  const rocks=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({map:surfaceTextures.terrain,normalMap:surfaceTextures.terrainNormal,color:0xb8b7a8,roughness:1}),180);
  for(let i=0;i<180;i++){const z=random()*ROAD_END,x=pathX(z)-(8+random()*25),s=.3+random()*1.4;tempObj.position.set(x,groundHeight(x,z)+s*.2,z);tempObj.rotation.set(random()*3,random()*3,random()*3);tempObj.scale.set(s*1.4,s*.65,s);tempObj.updateMatrix();rocks.setMatrixAt(i,tempObj.matrix);}rocks.receiveShadow=true;scene.add(rocks);
  const grassGeometry=new THREE.BufferGeometry();grassGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.045,0,0,.045,0,0,.015,.40,0],3));grassGeometry.computeVertexNormals();const grassMat=new THREE.MeshStandardMaterial({color:0x727b52,side:THREE.DoubleSide,roughness:1});
  const grass=new THREE.InstancedMesh(grassGeometry,grassMat,2800);
  for(let i=0;i<2800;i++){const z=random()*ROAD_END,side=random()>.65?1:-1,off=side*(6.9+random()*6),x=pathX(z)+off;tempObj.position.set(x,groundHeight(x,z)+.3,z);tempObj.rotation.set(0,random()*Math.PI,random()*.25);tempObj.scale.set(.4+random()*.5,.3+random()*.8,1);tempObj.updateMatrix();grass.setMatrixAt(i,tempObj.matrix);}scene.add(grass);
  const railMat=new THREE.MeshStandardMaterial({color:0xa8b5b3,metalness:.68,roughness:.48});
  const rail=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.33,5.1),railMat,440);
  const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.11,.85,.14),railMat,440);
  const reflectors=new THREE.InstancedMesh(new THREE.BoxGeometry(.03,.11,.16),new THREE.MeshStandardMaterial({color:0xe6ae49,roughness:.5}),220);
  for(let i=0;i<440;i++){const s=i*5.1,p=roadPoint(s,6.85,.65);tempObj.position.copy(p);tempObj.rotation.set(0,pathAngle(s),0);tempObj.scale.set(1,1,1);tempObj.updateMatrix();rail.setMatrixAt(i,tempObj.matrix);tempObj.position.copy(roadPoint(s,6.85,.32));tempObj.updateMatrix();posts.setMatrixAt(i,tempObj.matrix);if(i%2===0){tempObj.position.copy(roadPoint(s,6.76,.69));tempObj.updateMatrix();reflectors.setMatrixAt(i/2,tempObj.matrix);}}
  rail.castShadow=posts.castShadow=true;scene.add(rail,posts,reflectors);
  // Survey markers and chevrons along bends.
  const signs=new THREE.Group();
  const arrowTex=canvasTexture(128,(ctx,n)=>{ctx.fillStyle='#cbb96c';ctx.fillRect(0,0,n,n);ctx.fillStyle='#303e38';ctx.beginPath();ctx.moveTo(20,10);ctx.lineTo(62,10);ctx.lineTo(108,64);ctx.lineTo(62,118);ctx.lineTo(20,118);ctx.lineTo(68,64);ctx.closePath();ctx.fill();});
  for(let i=0;i<26;i++){const s=60+i*83,p=roadPoint(s,-7.6,1.5);const post=new THREE.Mesh(new THREE.BoxGeometry(.11,2.4,.11),railMat);post.position.copy(p).add(new THREE.Vector3(0,-.4,0));const panel=new THREE.Mesh(new THREE.BoxGeometry(1.05,.88,.06),new THREE.MeshStandardMaterial({map:arrowTex,roughness:.65}));panel.position.copy(p).add(new THREE.Vector3(0,.5,0));panel.rotation.y=pathAngle(s)+Math.PI;signs.add(post,panel);}scene.add(signs);
}
function textTexture(text) {
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.clearRect(0,0,512,128);ctx.font='800 45px SUIT, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#e5faee';ctx.fillText(text,256,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function fruit(type) {
  const g=new THREE.Group();
  if(type==='apple'){
    const geometry=new THREE.SphereGeometry(.58,24,18);const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){const y=p.getY(i),x=p.getX(i),z=p.getZ(i),theta=Math.atan2(z,x),r=1+.045*Math.cos(theta*5);p.setXYZ(i,x*r,y*.88-.11*Math.exp(-(x*x+z*z)*28)*(y>0?1:-.3),z*r);}geometry.computeVertexNormals();
    const apple=new THREE.Mesh(geometry,new THREE.MeshPhysicalMaterial({color:0xbe2b23,roughness:.34,clearcoat:.65,clearcoatRoughness:.24}));apple.castShadow=true;g.add(apple);
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,.29,7),new THREE.MeshStandardMaterial({color:0x685231,roughness:1}));stem.position.set(.04,.53,0);stem.rotation.z=-.2;g.add(stem);
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(.2,12,6),new THREE.MeshStandardMaterial({color:0x4c7331,roughness:.8}));leaf.scale.set(1,.09,.43);leaf.position.set(.21,.57,0);leaf.rotation.z=.3;g.add(leaf);
  }else if(type==='banana'){
    const mat=new THREE.MeshPhysicalMaterial({color:0xe2c557,roughness:.48,clearcoat:.23});
    for(let i=0;i<3;i++){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.49,-.29,i*.09),new THREE.Vector3(-.27,-.44,i*.09),new THREE.Vector3(.13,-.40,i*.09),new THREE.Vector3(.43,-.10,i*.09),new THREE.Vector3(.47,.27,i*.09)]);const b=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.105,7,false),mat);b.rotation.z=(i-1)*.24;b.position.set(0,.15,0);g.add(b);const tip=new THREE.Mesh(new THREE.SphereGeometry(.10,8,6),new THREE.MeshStandardMaterial({color:0x6d5530,roughness:1}));tip.position.set(.45,.41,i*.09);g.add(tip);}g.rotation.z=-.2;
  }else{
    const mat=new THREE.MeshPhysicalMaterial({color:0x6261a0,roughness:.38,clearcoat:.5});const geo=new THREE.SphereGeometry(.20,12,8);
    for(let y=0;y<4;y++)for(let j=0;j<4-y;j++){const b=new THREE.Mesh(geo,mat);b.position.set((j-(3-y)/2)*.29,.47-y*.27,Math.sin(j*2+y)*.13);g.add(b);}
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.3,6),new THREE.MeshStandardMaterial({color:0x6b7c3a,roughness:1}));stem.position.y=.79;stem.rotation.z=.3;g.add(stem);
  }
  g.scale.setScalar(1.34);return g;
}
function answerVisual(id,mode){
  const word=WORD_BY_ID[id],model={'사과':'apple','바나나':'banana','포도':'grape'}[word.word];
  if(mode==='picture'&&model)return fruit(model);
  const texture=canvasTexture(512,(ctx,n)=>{
    ctx.clearRect(0,0,n,n);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f6fff1';
    if(mode==='picture'){ctx.font='270px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';ctx.fillText(word.icon,n/2,n/2);}
    else{let size=115;ctx.font=`800 ${size}px SUIT, sans-serif`;while(ctx.measureText(word.word).width>470&&size>36){size-=3;ctx.font=`800 ${size}px SUIT, sans-serif`;}ctx.fillText(word.word,n/2,n/2);}
  });
  const m=new THREE.Mesh(new THREE.PlaneGeometry(2.5,2.5),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.rotation.y=Math.PI;m.userData.spinBase=Math.PI;return m;
}
function makeGate(index, s) {
  if(gate) disposeGate();
  const q=questionBank[index%questionBank.length],types=[...q.options];
  const group=new THREE.Group(),fruitObjects=[];
  const frameMat=new THREE.MeshStandardMaterial({color:0xe1ece5,metalness:.3,roughness:.46});
  const darkMat=new THREE.MeshStandardMaterial({color:0x204249,metalness:.18,roughness:.58});
  const glassMat=new THREE.MeshStandardMaterial({color:0x739598,transparent:true,opacity:.18,roughness:.3,metalness:.3,depthWrite:false});
  for(let i=0;i<3;i++){
    const lane=new THREE.Group();lane.position.x=LANES[i];
    for(const x of [-1.55,1.55]){const pole=new THREE.Mesh(new THREE.BoxGeometry(.075,3.7,.075),frameMat);pole.position.set(x,1.85,0);pole.castShadow=true;lane.add(pole);}
    const top=new THREE.Mesh(new THREE.BoxGeometry(3.18,.10,.10),frameMat);top.position.y=3.7;lane.add(top);
    const panel=new THREE.Mesh(new THREE.BoxGeometry(2.8,1.55,.11),darkMat);panel.position.set(0,2.84,0);panel.castShadow=true;lane.add(panel);
    const border=new THREE.Mesh(new THREE.BoxGeometry(2.73,1.46,.12),glassMat);border.position.set(0,2.84,-.085);lane.add(border);
    const f=answerVisual(types[i],q.mode);f.position.set(0,2.85,-.22);lane.add(f);fruitObjects.push(f);
    const base=new THREE.Mesh(new THREE.BoxGeometry(2.97,.026,1.4),new THREE.MeshStandardMaterial({color:0x95b4aa,metalness:.12,roughness:.72}));base.position.set(0,.023,-.1);lane.add(base);
    group.add(lane);
  }
  group.position.copy(roadPoint(s));group.rotation.y=pathAngle(s);scene.add(group);
  gate={group,s,q,types,fruitObjects,announced:false,judged:false};
  $('lane-choices').replaceChildren();$('lane-choices').hidden=true;
  // The chase camera faces +Z, so reverse world-X order for the on-screen choices.
  [...types].reverse().forEach((id,i)=>{
    const w=WORD_BY_ID[id],b=document.createElement('button'),direction=document.createElement('span'),content=document.createElement('strong');
    b.className='lane-choice';b.dataset.word=id;b.setAttribute('aria-label',`${['왼쪽','가운데','오른쪽'][i]} 차선 · ${w.word}`);
    direction.textContent=['왼쪽 길','가운데 길','오른쪽 길'][i];content.textContent=q.mode==='picture'?w.icon:w.word;if(q.mode==='picture')b.classList.add('picture-choice');
    b.append(direction,content);b.addEventListener('click',()=>{if(!running||paused||gate?.judged)return;laneAim=LANES[types.indexOf(id)];inputs.left=inputs.right=false;auto=false;$('demo-indicator').hidden=true;for(const choice of $('lane-choices').children)choice.classList.toggle('chosen',choice===b);});$('lane-choices').appendChild(b);
  });
}
function disposeGate(){
  if(!gate)return;
  scene.remove(gate.group);
  const gs=new Set(),ms=new Set(),ts=new Set();gate.group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);}});
  for(const g of gs)g.dispose();for(const m of ms){if(m.map)ts.add(m.map);m.dispose();}for(const t of ts)t.dispose();gate=null;
}

function shadowPlane() {
  const t=canvasTexture(128,(ctx,n)=>{const g=ctx.createRadialGradient(n/2,n/2,12,n/2,n/2,n/2);g.addColorStop(0,'rgba(0,10,15,.85)');g.addColorStop(.45,'rgba(0,10,15,.48)');g.addColorStop(1,'rgba(0,10,15,0)');ctx.fillStyle=g;ctx.fillRect(0,0,n,n);});
  const s=new THREE.Mesh(new THREE.PlaneGeometry(2.7,5.1),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));s.rotation.x=-Math.PI/2;s.position.y=.035;return s;
}
function prepareCar(model,color) {
  const root=new THREE.Group();const object=model.clone(true);object.rotation.y=Math.PI;
  const body=new THREE.MeshPhysicalMaterial({color,metalness:.8,roughness:.25,clearcoat:1,clearcoatRoughness:.09,envMapIntensity:1.8});
  const trim=new THREE.MeshStandardMaterial({color:0x222c2e,metalness:.62,roughness:.33});
  const rim=new THREE.MeshStandardMaterial({color:0xc0c8c7,metalness:1,roughness:.27});
  const glass=new THREE.MeshPhysicalMaterial({color:0x203438,metalness:.4,roughness:.12,clearcoat:1,envMapIntensity:1.9});
  object.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.name==='body')o.material=body;else if(o.name==='glass')o.material=glass;else if(o.name.startsWith('rim_'))o.material=rim;else if(o.name==='trim')o.material=trim;}});
  root.add(object,shadowPlane());root.userData.model=object;root.userData.wheels=['wheel_fl','wheel_fr','wheel_rl','wheel_rr'].map(n=>object.getObjectByName(n)).filter(Boolean);
  // Subtle emissive rear lamps and exhaust give clear acceleration feedback.
  const lampMat=new THREE.MeshStandardMaterial({color:0x962719,emissive:0xf13b23,emissiveIntensity:.7,roughness:.2});
  for(const x of [-.68,.68]){const lamp=new THREE.Mesh(new THREE.TorusGeometry(.105,.025,6,14),lampMat);lamp.position.set(x,.65,-1.99);root.add(lamp);}
  const jets=[];for(const x of [-.26,.26]){const jet=new THREE.Mesh(new THREE.ConeGeometry(.065,.62,8),new THREE.MeshBasicMaterial({color:0xb3f5ff,transparent:true,opacity:.6,depthWrite:false}));jet.rotation.x=-Math.PI/2;jet.position.set(x,.28,-2.2);jet.visible=false;root.add(jet);jets.push(jet);}root.userData.jets=jets;
  scene.add(root);return root;
}
function seatMascot(vehicle,name){
  // Local +Z is the car's travel direction. Separate front/back planes stay
  // attached to the vehicle instead of turning the character toward the camera.
  const mascot=new THREE.Group(),geometry=new THREE.PlaneGeometry(1,1);geometry.translate(0,.38,0);
  const makeSide=map=>new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map,transparent:true,alphaTest:.015,depthTest:true,depthWrite:false,toneMapped:false,side:THREE.FrontSide}));
  const front=makeSide(mascotTextures[name].base),rear=makeSide(mascotTextures[name].rear);
  front.position.z=.012;rear.position.z=-.012;rear.rotation.y=Math.PI;
  mascot.add(front,rear);mascot.userData.front=front;mascot.userData.rear=rear;
  mascot.position.set(.40,.68,-.18);mascot.scale.setScalar(name==='marin'?1.55:1.35);vehicle.add(mascot);vehicle.userData.mascot=mascot;vehicle.userData.character=name;return mascot;
}
function selectDriver(name){
  driverName=name;driverMood='base';moodTime=0;
  for(const character of ['marin','kkamong'])$('driver-'+character).setAttribute('aria-pressed',String(character===name));
  if(car?.userData.mascot){const mascot=car.userData.mascot;car.userData.character=name;mascot.userData.front.material.map=mascotTextures[name].base;mascot.userData.rear.material.map=mascotTextures[name].rear;mascot.scale.setScalar(name==='marin'?1.55:1.35);}
}
function mascotMood(mood,seconds=0){driverMood=mood;moodTime=seconds;}
function updateMascot(dt){
  const mascot=car.userData.mascot;if(!mascot)return;
  if(moodTime>0){moodTime-=dt;if(moodTime<=0)driverMood=gate?.announced&&!gate.judged?'focus':'base';}
  mascot.userData.front.material.map=mascotTextures[driverName][driverMood];mascot.rotation.z=reducedMotion?0:Math.sin(worldTime.value*2.2)*(driverMood==='cheer'?.04:.018);
  mascot.position.y=.68+(reducedMotion?0:Math.sin(worldTime.value*3.5)*(driverMood==='cheer'?.04:.015));
}
function placeCar(c,s,offset,yaw=0) {
  c.position.copy(roadPoint(s,offset,.025));c.rotation.set(0,pathAngle(s)+yaw,0);
}
function setQuality(value) {
  currentQuality=value;mode=value==='auto'?(mobile?'low':'high'):value;
  renderer.setPixelRatio(mode==='low'?Math.min(devicePixelRatio,1.15):Math.min(devicePixelRatio,value==='high'?2:1.65));
  renderer.shadowMap.enabled=mode==='high';
  renderer.shadowMap.needsUpdate=true;resize();adaptiveTime=0;frameSample=[];
}
function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;mobile=w<=650;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}

async function init() {
  try{
    await document.fonts.ready;
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0xc9dedb);
    $('world').appendChild(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(running&&!paused)pause();$('error').hidden=false;});
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(53,1,.12,4900);
    const ambient=new THREE.HemisphereLight(0xc8e5ff,0x69634a,1.25);scene.add(ambient);
    light=new THREE.DirectionalLight(0xfff3dc,3.35);light.castShadow=true;light.shadow.mapSize.set(1536,1536);light.shadow.camera.left=-40;light.shadow.camera.right=40;light.shadow.camera.top=58;light.shadow.camera.bottom=-32;light.shadow.camera.near=1;light.shadow.camera.far=310;light.shadow.bias=-.0003;light.shadow.normalBias=.02;scene.add(light,light.target);
    const textures=new THREE.TextureLoader();
    const skyFile=mobile?'clear-sky-2k.jpg':'clear-sky-4k.jpg';
    const [pine,road,roadNormal,terrain,terrainNormal,clearSky,cliff,cliffNormal,beach]=await Promise.all(['pine.webp','road.jpg','road-normal.jpg','terrain.jpg','terrain-normal.jpg',skyFile,'cliff.jpg','cliff-normal.jpg','beach.jpg'].map(name=>textures.loadAsync('./assets/'+name)));
    pineTexture=pine;pine.colorSpace=THREE.SRGBColorSpace;pine.anisotropy=4;
    surfaceTextures={road,roadNormal,terrain,terrainNormal,cliff,cliffNormal,beach};
    for(const [name,t] of Object.entries(surfaceTextures)){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(['road','terrain','cliff','beach'].includes(name))t.colorSpace=THREE.SRGBColorSpace;}
    clearSky.colorSpace=THREE.SRGBColorSpace;clearSky.mapping=THREE.EquirectangularReflectionMapping;scene.background=clearSky;scene.backgroundIntensity=1;scene.backgroundRotation.y=1.5;
    setupSky();setupTerrain();setupWater();setupCoastalScenery();setupVegetation();
    const hdrLoader=new HDRLoader();
    const draco=new DRACOLoader();draco.setDecoderPath('./vendor/');draco.setDecoderConfig({type:'wasm'});
    const loader=new GLTFLoader();loader.setDRACOLoader(draco);
    const mascotNames=['marin','kkamong'],mascotMoods=['base','focus','cheer','rear'];
    const [gltf,hdr,mascotImages]=await Promise.all([loader.loadAsync('./assets/car.glb'),hdrLoader.loadAsync('./assets/sky.hdr'),Promise.all(mascotNames.flatMap(name=>mascotMoods.map(mood=>textures.loadAsync(`./assets/mascots/${name}-${mood}.webp`))))]);
    mascotNames.forEach((name,i)=>{mascotTextures[name]={};mascotMoods.forEach((mood,j)=>{const t=mascotImages[i*mascotMoods.length+j];t.colorSpace=THREE.SRGBColorSpace;mascotTextures[name][mood]=t;});});
    const pmrem=new THREE.PMREMGenerator(renderer);const environment=pmrem.fromEquirectangular(hdr);scene.environment=environment.texture;hdr.dispose();pmrem.dispose();draco.dispose();
    carTemplate=gltf.scene.children[0];car=prepareCar(carTemplate,0xaad882);wheels=car.userData.wheels;
    seatMascot(car,driverName);
    rivals=[{mesh:prepareCar(carTemplate,0x809db2),s:103,offset:-3.15,speed:26.1},{mesh:prepareCar(carTemplate,0xcd8d5c),s:124,offset:3.1,speed:25.6}];
    seatMascot(rivals[0].mesh,'kkamong');seatMascot(rivals[1].mesh,'marin');
    setQuality('auto');reset(false);
    ready=true;$('loading').hidden=true;$('start').disabled=$('watch').disabled=false;
    if(!location.hash)window.scrollTo({top:0,behavior:'instant'});
    window.addEventListener('resize',resize);new ResizeObserver(resize).observe(stage);
    renderer.setAnimationLoop(frame);
  }catch(error){console.error(error);$('loading').hidden=true;$('error').hidden=false;window.__racingError=String(error);}
}

function reset(play) {
  playerS=75;playerOffset=0;aimOffset=0;laneAim=null;elapsed=0;boost=0;correct=0;answers=[];gateIndex=0;velocity=26;finished=false;paused=false;inputs.left=inputs.right=false;
  mascotMood('base');
  rivals.forEach((r,i)=>{r.s=103+i*21;placeCar(r.mesh,r.s,r.offset);});
  makeGate(0,310);placeCar(car,playerS,0);
  $('correct').textContent='0';$('nitro-fill').style.width='0%';$('progress').style.width='0%';
  $('rank').textContent='3';$('speed').textContent='94';
  $('prompt').textContent='바다를 따라, 출발!';$('question-help').textContent='곧 문제를 소리로 들려줄게요.';
  $('course-label').textContent=selectedStage.title;$('question-kicker').textContent=selectedStage.mode==='picture'?'듣고, 그림이 있는 길을 골라요':'듣고, 같은 단어가 있는 길을 골라요';
  $('repeat-question').disabled=true;$('time').textContent='00:00';
  $('results').hidden=true;$('pause-panel').hidden=true;$('toast').classList.remove('show');$('toast').textContent='';toastTime=0;stage.classList.remove('boosting');
  $('left').classList.remove('held');$('right').classList.remove('held');
  running=play;stage.classList.toggle('playing',play);$('demo-indicator').hidden=!auto;
  camera.position.copy(roadPoint(playerS-(mobile?12.5:7.4),mobile?-1.8:5.4,mobile?4.5:3.6));camera.lookAt(roadPoint(playerS+(mobile?14:12),mobile?3.8:1.8,1.2));
}
async function start(demo=false) {
  if(!ready||starting)return;starting=true;running=false;silence();
  $('start').disabled=$('watch').disabled=true;$('start').firstChild.textContent='음성 준비 중 ';
  if(!soundTouched){soundEnabled=true;updateSoundButton();}
  if(soundEnabled){try{await ensureAudio();await narrator.prepare([...commonClips,...selectedStage.words]);}catch{narrationUnavailable=true;}}
  auto=demo;roundWasDemo=demo;questionBank=makeQuestions(selectedStage);starting=false;
  $('start').disabled=$('watch').disabled=false;$('start').firstChild.textContent=`${questionBank.length}문제 달리기 `;
  reset(true);stage.scrollIntoView({behavior:'auto',block:'start'});
  $('start').blur();$('watch').blur();
  speak(['intro'],'출발! 문제를 듣고 길을 골라줘.','intro');
  clock.getDelta();
}
function showToast(message,seconds=2.5){$('toast').textContent=message;$('toast').classList.add('show');toastTime=seconds;}
async function ensureAudio() {
  if(!soundEnabled)return;
  const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
  if(!audio){
    audio=new AudioContext();motor=audio.createOscillator();motor.type='sawtooth';motor.frequency.value=65;
    const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=330;motorGain=audio.createGain();motorGain.gain.value=0;motor.connect(filter);filter.connect(motorGain);motorGain.connect(audio.destination);motor.start();
    const buffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.25;
    const wind=audio.createBufferSource();wind.buffer=buffer;wind.loop=true;const wf=audio.createBiquadFilter();wf.type='lowpass';wf.frequency.value=750;windGain=audio.createGain();windGain.gain.value=0;wind.connect(wf);wf.connect(windGain);windGain.connect(audio.destination);wind.start();
  }
  if(audio.state==='suspended')await audio.resume();
}
function ding(success){
  if(!audio||!soundEnabled)return;
  for(let i=0;i<(success?3:1);i++){
    const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.07;o.type='sine';o.frequency.value=success?[659,830,988][i]:440;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.07,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+.24);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.25);
  }
}
function silence(){narrator.cancel();if(audio){motorGain.gain.setTargetAtTime(0,audio.currentTime,.06);windGain.gain.setTargetAtTime(0,audio.currentTime,.06);}}
function pause(){if(!running||paused)return;paused=true;$('pause-panel').hidden=false;inputs.left=inputs.right=false;silence();$('repeat-question').disabled=true;}
function resume(){paused=false;$('pause-panel').hidden=true;clock.getDelta();if(gate&&gate.announced&&!gate.judged){$('repeat-question').disabled=false;narrateQuestion();}}
function home(){running=false;auto=false;silence();reset(false);stage.scrollIntoView({behavior:'auto',block:'start'});}
function finish(){
  running=false;finished=true;inputs.left=inputs.right=false;stage.classList.remove('boosting');silence();
  const rank=1+rivals.filter(r=>r.s>playerS).length;
  $('result-correct').textContent=`${correct}/${answers.length}`;$('result-boost').textContent=correct;$('result-rank').textContent=rank;
  $('word-list').replaceChildren();
  for(const id of selectedStage.words){const w=WORD_BY_ID[id],b=document.createElement('button');b.textContent=`${w.icon||''} ${w.word} ◖`;b.setAttribute('aria-label',`${w.word} 발음 듣기`);b.addEventListener('click',async()=>{if(!soundEnabled){soundEnabled=true;soundTouched=true;updateSoundButton();}await ensureAudio();speak([id],w.word,'word',true);});$('word-list').appendChild(b);}
  progress=recordRound(progress,selectedStage,answers,{automatic:roundWasDemo});
  let saved=true;if(!roundWasDemo)try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));}catch{saved=false;}
  renderStages();$('result-stage').textContent=labelStage(selectedStage);
  $('result-note').textContent=roundWasDemo?'자동 시연은 학습 기록에 포함하지 않아요. 직접 달려서 단어를 만나보세요.':`${correct>=Math.ceil(questionBank.length*.8)?'스테이지 통과! ':`다음엔 ${questionBank.length}문제 중 ${Math.ceil(questionBank.length*.8)}문제를 맞혀보세요. `}${saved?'직접 고른 단어 기록은 이 브라우저에 저장해요.':'브라우저 저장이 제한되어 이번 화면에서만 기록을 볼 수 있어요.'}`;
  $('next-stage').disabled=selectedStage.number>=STAGES.length;$('results').hidden=false;speak(['finish'],'완주! 오늘 만난 단어를 다시 들어볼까?','finish');
}
function judgeGate(){
  if(!gate||gate.judged)return;
  const lane=clamp(Math.round((playerOffset+3.45)/3.45),0,2),chosen=gate.types[lane],success=chosen===gate.q.answer;
  gate.judged=true;answers.push({prompt:gate.q.prompt,answer:gate.q.answer,chosen,correct:success});$('repeat-question').disabled=true;$('lane-choices').hidden=true;laneAim=null;
  if(success){correct++;boost=2.8;mascotMood('cheer',3);showToast(`정답! ${gate.q.word} · 부스터 발동 ↗`);speak(['correct',gate.q.answer,'boost'],`맞았어! ${gate.q.word}. 부스터!`,'feedback');ding(true);}
  else{showToast(`${gate.q.word} ${WORD_BY_ID[gate.q.answer].icon||''} · 다음에 다시 만나!`,3);speak(['answer',gate.q.answer,'retry'],`정답은 ${gate.q.word}. 기억하고 다음에 다시 만나자.`,'feedback');ding(false);}
  $('correct').textContent=correct;$('prompt').textContent=success?`${gate.q.word}, 정확해!`:`정답은 ${gate.q.word}예요 ${WORD_BY_ID[gate.q.answer].icon||''}`;
  $('question-help').textContent=success?'정답 부스터로 앞차를 따라잡아요.':'소리와 그림을 기억하고, 계속 달려요.';
}
function updateGame(dt) {
  elapsed+=dt;
  if(auto&&gate&&gate.announced&&!gate.judged)aimOffset=LANES[gate.types.indexOf(gate.q.answer)];
  else if(auto)aimOffset=0;
  if(auto)playerOffset=lerp(playerOffset,aimOffset,1-Math.exp(-dt*2.6));
  // The chase camera looks toward +Z, so screen-right is world -X.
  else if(laneAim!==null&&!inputs.left&&!inputs.right)playerOffset=lerp(playerOffset,laneAim,1-Math.exp(-dt*4));
  else playerOffset+=((inputs.left?1:0)-(inputs.right?1:0))*dt*5.8;
  playerOffset=clamp(playerOffset,-5.05,5.05);
  if(boost>0)boost=Math.max(0,boost-dt);
  // Leave time to hear the entire word, including when the player asks to hear it again.
  const hearing=gate?.announced&&!gate.judged&&(narrator.activeKind==='question'||narrator.queue.some(item=>item.kind==='question'));
  const waitingForVoice=hearing&&gate.s-playerS<65;
  const edge=Math.abs(playerOffset)>4.95,desired=waitingForVoice?0:edge?21:boost>0?42:26;
  velocity=lerp(velocity,desired,1-Math.exp(-dt*2.4));playerS+=velocity*dt;
  for(const r of rivals){r.s+=r.speed*dt*(waitingForVoice?0:1);placeCar(r.mesh,r.s,r.offset+Math.sin(elapsed*.2+r.speed)*.2);for(const w of r.mesh.userData.wheels)w.rotation.x-=r.speed*dt*2.2;}
  const steering=(inputs.left?1:0)-(inputs.right?1:0),yaw=(auto?clamp(aimOffset-playerOffset,-1,1):steering)*.045;
  placeCar(car,playerS,playerOffset,yaw);car.rotation.z=-steering*.008;car.position.y+=Math.sin(elapsed*31)*.003;
  for(const w of wheels)w.rotation.x-=velocity*dt*2.3;
  for(const jet of car.userData.jets){jet.visible=boost>0;jet.scale.y=.6+Math.random()*.5;}
  if(gate){
    const distance=gate.s-playerS;
    if(!gate.announced&&distance<220&&elapsed>=3){gate.announced=true;mascotMood('focus');$('repeat-question').disabled=false;$('lane-choices').hidden=false;narrateQuestion();}
    if(distance<0&&!gate.judged)judgeGate();
    if(distance<-15){gateIndex++;if(gateIndex<questionBank.length)makeGate(gateIndex,gate.s+245);else disposeGate();}
  }
  stage.classList.toggle('boosting',boost>0&&!reducedMotion);
  $('speed').textContent=Math.round(velocity*3.6);$('nitro-fill').style.width=`${boost/2.8*100}%`;$('nitro-label').textContent=boost>0?'KOREAN → BOOST':'LISTEN. CHOOSE. BOOST.';
  $('rank').textContent=1+rivals.filter(r=>r.s>playerS).length;
  const seconds=Math.floor(elapsed);$('time').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;$('progress').style.width=`${Math.min(100,(playerS-75)/(310+(questionBank.length-1)*245+85-75)*100)}%`;
  if(soundEnabled&&audio){motor.frequency.setTargetAtTime(45+velocity*1.8,audio.currentTime,.15);motorGain.gain.setTargetAtTime(narrator.playing?.014:.055+(boost>0?.012:0),audio.currentTime,.12);windGain.gain.setTargetAtTime(velocity*(narrator.playing?.0003:.0015),audio.currentTime,.15);}
  if(answers.length===questionBank.length&&playerS>310+(questionBank.length-1)*245+85&&!narrator.playing)finish();
}
function updateCamera(dt) {
  let pos,target,fov;
  if(running||finished){
    pos=roadPoint(playerS-(mobile?10:7.7),playerOffset*(mobile?.92:.62),(mobile?3.75:3.45));target=roadPoint(playerS+24,playerOffset*(mobile?.72:.34),1.55);fov=boost>0&&!reducedMotion?61:mobile?60:53;
  }else{
    const drift=reducedMotion?0:Math.sin(attractTime*.14)*.65;
    pos=roadPoint(playerS-(mobile?12.5:7.4),mobile?-1.8:5.4+drift,mobile?4.5:3.6);target=roadPoint(playerS+(mobile?14:12),mobile?3.8:1.8,1.2);fov=mobile?62:52;
  }
  camera.position.lerp(pos,1-Math.exp(-dt*5));camera.lookAt(target);camera.fov=lerp(camera.fov,fov,1-Math.exp(-dt*3));camera.updateProjectionMatrix();
  light.position.copy(roadPoint(playerS+70,68,125));light.target.position.copy(roadPoint(playerS+18,0,0));
}
function frame() {
  const raw=clock.getDelta(),dt=Math.min(raw,.055);warmupFrames++;
  if(!paused){
    worldTime.value+=dt;attractTime+=dt;
    if(running)updateGame(dt);
    else if(!finished&&!reducedMotion){playerS+=dt*4.5;if(playerS>185){playerS=75;rivals.forEach((r,i)=>r.s=103+i*21);}placeCar(car,playerS,0);for(const w of wheels)w.rotation.x-=dt*10;rivals.forEach((r,i)=>{r.s=playerS+28+i*21;placeCar(r.mesh,r.s,r.offset);});}
    if(gate)gate.fruitObjects.forEach((f,i)=>{f.rotation.y=(f.userData.spinBase||0)+Math.sin(worldTime.value*.9+i)*.11;});
    updateMascot(dt);
    updateCamera(dt);
    if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('show');}
  }
  renderer.render(scene,camera);
  if(warmupFrames>35&&raw<.3){frameSample.push(raw);if(frameSample.length>120)frameSample.shift();renderFrames++;renderTotal+=raw;adaptiveTime+=raw;}
  if(currentQuality==='auto'&&mode==='high'&&adaptiveTime>5&&frameSample.length>60){const average=frameSample.reduce((a,b)=>a+b,0)/frameSample.length;if(average>.038){mode='low';renderer.setPixelRatio(1);renderer.shadowMap.enabled=false;resize();}adaptiveTime=0;}
}

function updateSoundButton(){
  $('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'소리 끄기':'소리 켜기');
  $('sound-waves').setAttribute('d',soundEnabled?'M16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14':'m16 9 5 6m0-6-5 6');
}
async function toggleSound(){
  soundTouched=true;soundEnabled=!soundEnabled;updateSoundButton();
  if(soundEnabled){await ensureAudio();if(running&&!paused&&gate?.announced&&!gate.judged)narrateQuestion();}else{silence();displayQuestion();}
}
$('start').addEventListener('click',()=>start(false));$('watch').addEventListener('click',()=>start(true));$('replay').addEventListener('click',()=>start(auto));$('home').addEventListener('click',home);$('exit').addEventListener('click',home);$('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);$('sound').addEventListener('click',toggleSound);$('quality').addEventListener('change',e=>setQuality(e.target.value));$('card-play').addEventListener('click',()=>start(false));
$('repeat-question').addEventListener('click',async()=>{if(!running||paused||gate?.judged)return;if(!soundEnabled){soundEnabled=true;soundTouched=true;updateSoundButton();}await ensureAudio();narrateQuestion(true);});
$('subtitles').addEventListener('change',displayQuestion);
for(const id of ['stage-filter','stage-search'])$(id).addEventListener(id==='stage-filter'?'change':'input',()=>{stagePage=0;renderStages();});
$('stage-prev').addEventListener('click',()=>{stagePage--;renderStages();});$('stage-next').addEventListener('click',()=>{stagePage++;renderStages();});
$('review-stage').addEventListener('click',()=>{const s=reviewStage(progress);if(s)selectStage(s);});
$('next-stage').addEventListener('click',()=>{const next=STAGES[selectedStage.number||0];if(next){const demo=roundWasDemo;selectStage(next);start(demo);}});
for(const name of ['marin','kkamong'])$('driver-'+name).addEventListener('click',()=>selectDriver(name));
for(const direction of ['left','right']){
  const b=$(direction);b.addEventListener('pointerdown',e=>{if(!running||paused)return;e.preventDefault();laneAim=null;auto=false;$('demo-indicator').hidden=true;inputs[direction]=true;b.classList.add('held');b.setPointerCapture(e.pointerId);});
  const release=()=>{inputs[direction]=false;b.classList.remove('held');};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
}
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLSelectElement||e.target instanceof HTMLInputElement)return;
  if(e.code==='Escape'){if(running)paused?resume():pause();return;}
  const direction=['ArrowLeft','KeyA'].includes(e.code)?'left':['ArrowRight','KeyD'].includes(e.code)?'right':null;
  if(direction&&running&&!paused){e.preventDefault();laneAim=null;auto=false;$('demo-indicator').hidden=true;inputs[direction]=true;}
});
window.addEventListener('keyup',e=>{if(['ArrowLeft','KeyA'].includes(e.code))inputs.left=false;if(['ArrowRight','KeyD'].includes(e.code))inputs.right=false;});
window.addEventListener('blur',()=>{inputs.left=inputs.right=false;if(running&&!paused)pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused)pause();});
// Read-only telemetry makes verification reproducible without a hidden game bypass.
window.__racing={snapshot:()=>({ready,running,paused,auto,roundWasDemo,elapsed,playerS,playerOffset,screenX:car?+car.position.clone().project(camera).x.toFixed(4):null,driver:{name:driverName,mood:driverMood,seated:!!car?.userData.mascot},velocity,boost,correct,answers:answers.map(a=>({...a})),stage:{id:selectedStage.id,title:selectedStage.title,mode:selectedStage.mode,words:selectedStage.words},gate:gate?{s:gate.s,prompt:gate.q.prompt,spoken:gate.q.spoken,types:[...gate.types],announced:gate.announced}:null,quality:mode,narration:narrator.snapshot(),audioState:audio?.state,narrationUnavailable,learning:{words:Object.keys(progress.words).length,correctWords:Object.values(progress.words).filter(p=>p.correct>0).length,rounds:progress.rounds,cleared:Object.values(progress.stages).filter(p=>p.cleared).length},render:{calls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,geometries:renderer?.info.memory.geometries,textures:renderer?.info.memory.textures,averageFps:frameSample.length?+(frameSample.length/frameSample.reduce((a,b)=>a+b,0)).toFixed(1):0},viewport:{width:stage.clientWidth,height:stage.clientHeight}})};
renderStages();
init();
