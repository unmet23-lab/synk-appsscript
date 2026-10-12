import * as THREE from '../vendor/three.module.js';
import {createInterviewActors} from './actors.mjs';
import {INTERVIEWERS} from './content.mjs';
import {HDRLoader} from '../vendor/HDRLoader.js';
import {mergeGeometries} from '../vendor/BufferGeometryUtils.js';

export const SEATS = [{x:0,y:0,z:-1.35},{x:-1.4,y:0,z:-1.35},{x:1.4,y:0,z:-1.35}];

export async function createInterviewRoom(host,{onAction=()=>{},onProgress=()=>{}}={}){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#bbc5cc');
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.xr.enabled=true;
  renderer.xr.setReferenceSpaceType('local');renderer.xr.setFramebufferScaleFactor(1);
  host.replaceChildren(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(55,1,.04,60);camera.position.set(0,0,0);
  // Local reference space starts at the initial headset pose; the rig sets the seated eye height.
  const rig=new THREE.Group();rig.position.set(0,1.23,2.35);rig.add(camera);scene.add(rig);
  const disposables=new Set(),targets=[],raycaster=new THREE.Raycaster(),matrix=new THREE.Matrix4(),worldEye=new THREE.Vector3();
  const mat=(color,roughness=.7,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness,metalness});disposables.add(m);return m;};
  const plaster=mat('#dadbd6',.93),sideWall=mat('#c9ccc5',.92),dark=mat('#30383a',.55),black=mat('#1c2528',.43),steel=mat('#8b9495',.28,.65),paper=mat('#eeeeea',.92),leather=mat('#38413e',.72);
  const warmWood=mat('#a4896c',.65),floorMat=mat('#867463',.81);
  function noiseTexture({wood=false,light='#b6a18a',darkColor='#807260',scale=256}={}){
    const c=document.createElement('canvas');c.width=c.height=scale;const x=c.getContext('2d');x.fillStyle=light;x.fillRect(0,0,scale,scale);
    let seed=821;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    if(wood){for(let i=0;i<500;i++){x.strokeStyle=`rgba(52,35,25,${random()*.08})`;x.lineWidth=random()*2+.2;x.beginPath();const sy=random()*scale;x.moveTo(0,sy);x.bezierCurveTo(scale*.3,sy+random()*8,scale*.7,sy-random()*8,scale,sy);x.stroke();}}
    else{for(let i=0;i<18000;i++){x.fillStyle=random()>.5?'#ffffff08':'#00000008';x.fillRect(random()*scale,random()*scale,1,1);}}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());disposables.add(t);return t;
  }
  warmWood.map=noiseTexture({wood:true});warmWood.map.repeat.set(2,2);
  floorMat.map=noiseTexture({wood:true,light:'#a3917b'});floorMat.map.repeat.set(4,12);
  plaster.map=noiseTexture({light:'#f2f0eb'});plaster.map.repeat.set(6,3);
  // CC0 photographs supply surface detail; all files are served locally.
  const textureLoader=new THREE.TextureLoader();
  async function surface(material,id,repeat){
    const maps=await Promise.all(['diff','nor_gl','rough'].map(k=>textureLoader.loadAsync(`../assets/interview/room/${id}_${k}_1k.jpg`)));
    maps.forEach(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());disposables.add(t);});
    maps[0].colorSpace=THREE.SRGBColorSpace;[material.map,material.normalMap,material.roughnessMap]=maps;material.normalScale.set(.2,.2);material.needsUpdate=true;
  }
  await Promise.all([surface(warmWood,'wood_table_001',[2,1]),surface(plaster,'painted_plaster_wall',[3,2])]);
  warmWood.color.set('#e0d4c6');plaster.color.set('#e9e8e2');
  const hdr=await new HDRLoader().loadAsync('../assets/interview/room/brown_photostudio_02_1k.hdr');
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(hdr);scene.environment=environment.texture;scene.environmentIntensity=.38;hdr.dispose();pmrem.dispose();disposables.add(environment);
  function box(w,h,d,m,x,y,z,parent=scene,shadow=true){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=shadow;o.receiveShadow=true;parent.add(o);return o;}
  function cylinder(r1,r2,h,m,x,y,z,parent=scene,n=16){const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,n),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function label(text,w=.7,h=.16,color='#45514c',background='#e7e9e3',fontSize=54){const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const x=c.getContext('2d');x.fillStyle=background;x.fillRect(0,0,c.width,c.height);x.fillStyle=color;x.font=`600 ${fontSize}px SUIT,sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,512,c.height/2,970);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;disposables.add(t);const m=new THREE.MeshBasicMaterial({map:t});disposables.add(m);return new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);}
  // A compact meeting room with real proportions; no moving camera or artificial dolly.
  box(7,.12,8,floorMat,0,-.08,-.2);box(7,3.2,.15,plaster,0,1.6,-4.2);box(.15,3.2,8,sideWall,3.5,1.6,-.2);box(7,.12,8,plaster,0,3.22,-.2);
  box(.15,.85,8,plaster,-3.5,.425,-.2);box(.15,.37,8,plaster,-3.5,3.01,-.2);
  box(7,.09,.06,dark,0,.07,-4.1);box(.06,.09,8,dark,3.39,.07,-.2);box(.06,.09,8,dark,-3.39,.07,-.2);
  const sky=mat('#cddfea',1);sky.emissive=new THREE.Color('#bfd3dd');sky.emissiveIntensity=.7;
  box(.04,2,7.6,sky,-3.64,1.82,-.2,scene,false);
  const windowFrame=mat('#7a898a',.37,.45);
  for(let i=0;i<5;i++)box(.12,2.08,.065,windowFrame,-3.39,1.83,-3.7+i*1.8);
  box(.2,.07,8,windowFrame,-3.33,.87,-.2);box(.18,.055,8,windowFrame,-3.33,2.84,-.2);
  const building=mat('#9baab0',.95);
  for(let i=0;i<8;i++)box(.2,.4+(i%3)*.16,.6,building,-3.53,1.1+(i%3)*.08,-3.7+i*.9,scene,false);
  const blinds=[mat('#c0c4be',.87),mat('#d2d4cd',.87)];
  for(let i=0;i<18;i++){const blind=box(.24,.02,7.8,blinds[i%2],-3.29,1.06+i*.099,-.2);blind.rotation.z=-.13;}
  // Behind the interviewers: acoustic slats and a discreet brand wall.
  const acoustic=mat('#a49b8c',.95);
  for(let i=0;i<35;i++)box(.048,2.4,.07,acoustic,-2.6+i*.152,1.68,-4.08,scene,false);
  box(2.15,.8,.1,plaster,0,2.04,-3.99);
  const sign=label('S Y N K   P A T H',1.72,.23,'#374a43','#e4e4dd',78);sign.position.set(0,2.13,-3.924);scene.add(sign);
  const subtitle=label('CAREERS · FIRST INTERVIEW',1.4,.10,'#6d7973','#e4e4dd',36);subtitle.position.set(0,1.88,-3.92);scene.add(subtitle);
  // Door on the right and a framed print; both remain visible when turning around.
  const door=box(.06,2.45,1.08,warmWood,3.39,1.225,1.45);box(.09,2.53,.06,dark,3.36,1.27,.87);box(.09,2.53,.06,dark,3.36,1.27,2.03);box(.1,.06,1.23,dark,3.36,2.51,1.45);box(.18,.035,.18,steel,3.22,1.05,1.86);
  const plaque=label('면접 진행 중',.5,.14);plaque.position.set(3.34,1.67,1.45);plaque.rotation.y=-Math.PI/2;scene.add(plaque);
  box(7,3.2,.13,plaster,0,1.6,3.79);const rail=box(1.4,.025,.12,steel,1.6,1.75,3.63);for(const x of [1.1,1.6,2.1])box(.015,.15,.1,steel,x,1.68,3.57);
  // Main desk and seated applicant's desk.
  box(4.85,.07,1.12,warmWood,0,.755,-.35);box(4.72,.024,.96,dark,0,.704,-.35);
  for(const x of [-2.13,2.13]){box(.075,.7,.87,black,x,.35,-.35);box(.47,.045,.88,black,x,.025,-.35);}
  const deskFront=mat('#67726b',.92);box(4.5,.36,.035,deskFront,0,.46,.085);
  box(1.12,.055,.53,warmWood,0,.735,1.48);for(const x of [-.47,.47])box(.045,.7,.4,black,x,.35,1.48);
  function chair(x,z){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);box(.51,.09,.5,leather,0,.45,0,g);const back=box(.5,.57,.055,leather,0,.76,-.25,g);back.rotation.x=-.1;cylinder(.037,.037,.37,steel,0,.22,0,g);for(let i=0;i<5;i++){const foot=box(.43,.028,.04,steel,0,.05,0,g);foot.rotation.y=i*Math.PI*2/5;foot.position.set(Math.sin(foot.rotation.y)*.18,.05,Math.cos(foot.rotation.y)*.18);}for(const xx of [-.31,.31]){box(.035,.27,.035,steel,xx,.58,0,g);box(.065,.035,.35,leather,xx,.73,-.01,g);}}
  SEATS.forEach(s=>chair(s.x,s.z));chair(0,2.80);
  SEATS.forEach((s,i)=>{
    for(let j=0;j<3;j++){const sheet=box(.24,.001,.30,paper,s.x-.13,.791+j*.001,-.76);sheet.rotation.y=.06;}
    const pen=cylinder(.003,.003,.15,black,s.x+.38,.805,-.21);pen.rotation.z=Math.PI/2;pen.rotation.y=-.3;
    const cup=cylinder(.035,.031,.095,mat('#e6e8e1',.34),s.x-.39,.831,-.38);
    cylinder(.028,.028,.003,mat('#463c30',.6),s.x-.39,.88,-.38);
    const card=label(INTERVIEWERS[i].role,.36,.07,'#3f5147','#f0f0e9',59);card.position.set(s.x,.829,.15);card.rotation.x=-.24;scene.add(card);
  });
  const note=box(.25,.002,.32,paper,-.19,.769,1.43);note.rotation.y=-.12;
  // A few restrained indoor plants and light fixtures.
  function plant(x,z){const pot=mat('#787c72',.85),leaf=mat('#3c5745',.78);cylinder(.20,.14,.38,pot,x,.19,z);for(let i=0;i<14;i++){const a=i*2.4,r=.12+(i%3)*.055;const stem=cylinder(.006,.009,.6+(i%4)*.14,mat('#56674a'),x+Math.sin(a)*r,.62+(i%4)*.04,z+Math.cos(a)*r);const l=new THREE.Mesh(new THREE.SphereGeometry(.13,10,6),leaf);l.scale.set(.7,1.7,.2);l.position.set(x+Math.sin(a)*r*1.7,1.0+(i%4)*.13,z+Math.cos(a)*r*1.7);l.rotation.set(.3,a,.2);scene.add(l);}}
  // Keep clear corners; the small prototype prioritizes believable people and desk detail.
  const emitter=mat('#fff6e3',.2);emitter.emissive=new THREE.Color('#fff1d7');emitter.emissiveIntensity=1.1;
  for(const z of [-2.2,.7]){box(2.9,.065,.13,dark,0,2.91,z);box(2.83,.01,.10,emitter,0,2.872,z,scene,false);}
  scene.add(new THREE.HemisphereLight('#edf4ff','#a09b86',1.45));
  const sun=new THREE.DirectionalLight('#fff4df',2.7);sun.position.set(-3.1,3,1.8);sun.target.position.set(.2,.8,-1.1);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-3,near:.1,far:15});sun.shadow.bias=-.0005;sun.shadow.normalBias=.016;scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight('#e4eaf2',.85);fill.position.set(2,2.5,1.3);scene.add(fill);
  // Soft local contact shadows prevent floating feet and furniture without extra shadow lights.
  const sc=document.createElement('canvas');sc.width=sc.height=128;const sx=sc.getContext('2d'),gradient=sx.createRadialGradient(64,64,5,64,64,64);gradient.addColorStop(0,'#0007');gradient.addColorStop(1,'#0000');sx.fillStyle=gradient;sx.fillRect(0,0,128,128);const st=new THREE.CanvasTexture(sc);disposables.add(st);
  for(const s of SEATS){const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.4),new THREE.MeshBasicMaterial({map:st,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(s.x,.003,s.z);scene.add(shadow);}
  // Batch fixed geometry by material to reduce draw calls on standalone headsets.
  scene.updateMatrixWorld(true);const batches=new Map();
  scene.traverse(o=>{if(!o.isMesh||Array.isArray(o.material)||o.material.transparent||o.material.map?.isCanvasTexture)return;const key=`${o.material.uuid}/${o.castShadow}/${o.receiveShadow}`;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);});
  for(const meshes of batches.values()){if(meshes.length<2)continue;const geometries=meshes.map(m=>m.geometry.clone().applyMatrix4(m.matrixWorld)),geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());if(!geometry)continue;const mesh=new THREE.Mesh(geometry,meshes[0].material);mesh.castShadow=meshes[0].castShadow;mesh.receiveShadow=meshes[0].receiveShadow;scene.add(mesh);meshes.forEach(m=>{m.removeFromParent();m.geometry.dispose();});}
  // XR-only tablet: instructions and actions remain inside the immersive session.
  const panelCanvas=document.createElement('canvas');panelCanvas.width=1536;panelCanvas.height=768;const panelCtx=panelCanvas.getContext('2d');const panelTexture=new THREE.CanvasTexture(panelCanvas);panelTexture.colorSpace=THREE.SRGBColorSpace;disposables.add(panelTexture);
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.725),new THREE.MeshBasicMaterial({map:panelTexture,transparent:true,side:THREE.DoubleSide}));panel.position.set(0,.78,1.00);panel.rotation.x=-.60;panel.visible=false;scene.add(panel);
  let panelState={},buttonRects=[];
  function wrap(text,maxWidth,font){panelCtx.font=font;const lines=[];let line='';for(const ch of String(text||'')){if(panelCtx.measureText(line+ch).width>maxWidth&&line){lines.push(line);line=ch;}else line+=ch;}if(line)lines.push(line);return lines;}
  function setPanel(s){panelState={...s};const c=panelCtx;c.clearRect(0,0,1536,768);c.fillStyle='#142429f5';c.beginPath();c.roundRect(0,0,1536,768,35);c.fill();c.strokeStyle='#8fa18f88';c.lineWidth=3;c.stroke();c.fillStyle='#cae2b5';c.font='600 34px SUIT,sans-serif';c.fillText(s.title||'첫 면접실',60,70);c.fillStyle='#f5f7f3';let y=144;for(const l of wrap(s.text,1410,'600 47px SUIT,sans-serif').slice(0,4)){c.fillText(l,60,y);y+=61;}c.fillStyle='#c4d1c4';wrap(s.transcript||s.hint||'',1410,'400 35px SUIT,sans-serif').slice(0,2).forEach((l,i)=>c.fillText(l,60,422+i*45));
    const buttons=(s.buttons||[]).slice(0,4);buttonRects=[];const w=(1416-(buttons.length-1)*16)/Math.max(1,buttons.length);buttons.forEach((b,i)=>{const x=60+i*(w+16),y=580;c.fillStyle=i===0?'#c9e2b6':'#344741';c.beginPath();c.roundRect(x,y,w,110,15);c.fill();c.fillStyle=i===0?'#18312a':'#edf4ec';c.font='600 34px SUIT,sans-serif';c.textAlign='center';c.fillText(b.label,x+w/2,y+68,w-22);c.textAlign='left';buttonRects.push({x,y,w,h:110,action:b.action});});panelTexture.needsUpdate=true;
  }
  function actionAt(uv){const x=uv.x*1536,y=(1-uv.y)*768;return buttonRects.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)?.action;}
  const controllers=[];
  for(let i=0;i<2;i++){const controller=renderer.xr.getController(i);rig.add(controller);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:'#c6e7ac',transparent:true,opacity:.72}));line.scale.z=3;controller.add(line);const select=()=>{matrix.identity().extractRotation(controller.matrixWorld);raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);raycaster.ray.direction.set(0,0,-1).applyMatrix4(matrix);const hit=panel.visible&&raycaster.intersectObject(panel,false)[0];if(hit){const a=actionAt(hit.uv);if(a)onAction(a);}};controller.addEventListener('select',select);controllers.push({controller,select,line});}
  let yaw=0,pitch=0,drag=null;
  const look=()=>{if(!renderer.xr.isPresenting)camera.rotation.set(pitch,yaw,0,'YXZ');};
  const down=e=>{if(renderer.xr.isPresenting)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw,pitch};host.setPointerCapture?.(e.pointerId);};
  const move=e=>{if(!drag||drag.id!==e.pointerId)return;yaw=drag.yaw-(e.clientX-drag.x)*.003;pitch=Math.max(-.9,Math.min(.8,drag.pitch-(e.clientY-drag.y)*.003));look();};
  const up=()=>drag=null;
  const key=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw+=.09;if(e.key==='ArrowRight')yaw-=.09;if(e.key==='ArrowUp')pitch+=.07;if(e.key==='ArrowDown')pitch-=.07;pitch=Math.max(-.9,Math.min(.8,pitch));look();};
  host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move);host.addEventListener('pointerup',up);host.addEventListener('pointercancel',up);host.addEventListener('keydown',key);
  const resize=()=>{const r=host.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(host);resize();
  let state={speaker:0,speaking:false,listening:false,amplitude:0,phase:'idle'},actors=null,disposed=false,lastFrame=0,frameCount=0,frameSum=0;
  renderer.setAnimationLoop(t=>{if(disposed)return;const seconds=t*.001;const activeCamera=renderer.xr.isPresenting?renderer.xr.getCamera(camera):camera;activeCamera.getWorldPosition(worldEye);actors?.update(seconds,state,worldEye);panel.visible=renderer.xr.isPresenting;if(lastFrame){frameSum+=t-lastFrame;frameCount++;}lastFrame=t;renderer.render(scene,camera);});
  const xrStart=()=>{camera.rotation.set(0,0,0);camera.position.set(0,0,0);};const xrEnd=()=>{camera.position.set(0,0,0);yaw=pitch=0;look();};renderer.xr.addEventListener('sessionstart',xrStart);renderer.xr.addEventListener('sessionend',xrEnd);
  try{actors=await createInterviewActors(THREE,scene,{seats:SEATS,onProgress});}catch(e){renderer.setAnimationLoop(null);throw e;}
  onProgress('면접실 준비 완료');
  return {renderer,camera,scene,rig,actors,setPanel,setState:s=>Object.assign(state,s),reset(){yaw=pitch=0;look();},stats:()=>({drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,desktopAverageFrameMs:frameCount?frameSum/frameCount:null,headsetTested:false}),dispose(){disposed=true;observer.disconnect();renderer.setAnimationLoop(null);actors?.dispose();for(const e of controllers)e.controller.removeEventListener('select',e.select);renderer.xr.removeEventListener('sessionstart',xrStart);renderer.xr.removeEventListener('sessionend',xrEnd);host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',up);host.removeEventListener('pointercancel',up);host.removeEventListener('keydown',key);scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});for(const o of disposables)o.dispose();renderer.dispose();}};
}
