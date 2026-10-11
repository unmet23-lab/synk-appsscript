import * as THREE from './scene-assets/three.module.js';
import {createMongleAvatar} from './avatar-v3.mjs';
import {slotsForOutfit} from './wardrobe-catalog.mjs';
import {createContactLight} from './contact-light-v6.mjs';
import {wardrobeDyeDefaults} from './avatar-wardrobe.mjs';
import {STAGE_DEFAULT_VIEW,STAGE_POSES,STAGE_BACKGROUNDS,normalizeStageView,stagePointerDistance} from './wardrobe-stage-state.mjs';

const LIGHTS={
  daylight:{background:'#eef2f1',key:'#fff4e1',fill:'#d9e9f3',intensity:2.85,exposure:1.09},
  sunset:{background:'#ece5e4',key:'#ffd1ad',fill:'#c1cbed',intensity:3.05,exposure:1.05},
  studio:{background:'#edf0f2',key:'#ffffff',fill:'#edf1f7',intensity:2.8,exposure:1.03},
};
function mesh(parent,geometry,material,position=[0,0,0]){const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function woodMap(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(512,256);
  for(let y=0;y<256;y++)for(let x=0;x<512;x++){const p=(y*512+x)*4,grain=Math.sin(y*.7+Math.sin(x*.013)*3)*3+Math.sin(y*.16+x*.008)*4;pixels.data[p]=173+grain;pixels.data[p+1]=143+grain;pixels.data[p+2]=106+grain;pixels.data[p+3]=255;}
  ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function contactMap(){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(128,128,32,128,128,120);g.addColorStop(0,'rgba(25,37,40,.18)');g.addColorStop(.45,'rgba(25,37,40,.11)');g.addColorStop(1,'rgba(25,37,40,0)');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);return new THREE.CanvasTexture(c);
}

/** One owned WebGL context, demand rendering, deterministic capture and bounded DPR. */
export async function mountWardrobeStage(host,{slots={},dyes={},reducedMotion=false,onError=()=>{},onAngle=()=>{},onView=()=>{},signal}={}){
  const canvas=document.createElement('canvas');canvas.className='atelier-canvas';canvas.tabIndex=0;canvas.style.touchAction='none';canvas.setAttribute('aria-label','3D 몽글 피팅룸. 좌우 화살표나 드래그로 회전, 위아래 화살표·휠·두 손가락으로 확대, Home으로 정면을 볼 수 있어요.');host.replaceChildren(canvas);
  const mobile=matchMedia('(max-width:799px)').matches;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.05,35),target=new THREE.Vector3(0,.91,0);
  camera.position.set(0,1.33,4.03);camera.lookAt(target);
  const hemi=new THREE.HemisphereLight('#e3edf5','#9a8d7c',1.15);scene.add(hemi);
  const key=new THREE.DirectionalLight('#fff6e5',2.85);key.position.set(-3.4,4.8,4.6);key.castShadow=true;key.shadow.mapSize.set(mobile?512:1024,mobile?512:1024);key.shadow.camera.left=-2.6;key.shadow.camera.right=2.6;key.shadow.camera.top=2.6;key.shadow.camera.bottom=-2.6;key.shadow.camera.near=.5;key.shadow.camera.far=14;key.shadow.bias=-.0002;key.shadow.normalBias=.012;key.shadow.radius=mobile?5:8;key.shadow.blurSamples=mobile?4:6;key.shadow.intensity=.78;scene.add(key);
  const fill=new THREE.DirectionalLight('#d8e8f4',.65);fill.position.set(3,2.6,1);scene.add(fill);
  const rim=new THREE.DirectionalLight('#ffffff',.88);rim.position.set(1.1,3,-3);scene.add(rim);
  // A curved continuous studio sweep, rather than a flat image behind the avatar.
  const sweepPoints=[[-5,0],[1.2,0],[1.9,.08],[2.4,.34],[2.7,.8],[2.82,1.5],[2.84,4.8]];
  const curve=new THREE.CatmullRomCurve3(sweepPoints.map(([z,y])=>new THREE.Vector3(0,y,-z)));
  const positions=[],indices=[];for(let j=0;j<=48;j++){const p=curve.getPoint(j/48);positions.push(-7,p.y,p.z,7,p.y,p.z);if(j<48){const a=j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const sweepGeometry=new THREE.BufferGeometry();sweepGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));sweepGeometry.setIndex(indices);sweepGeometry.computeVertexNormals();
  const plaster=new THREE.MeshStandardMaterial({color:'#f2f3f0',roughness:.96,side:THREE.DoubleSide});mesh(scene,sweepGeometry,plaster).castShadow=false;
  const oakTexture=woodMap(),oak=new THREE.MeshStandardMaterial({map:oakTexture,color:'#e8dbca',roughness:.72});
  const plinthProfile=[[0,0],[1.09,0],[1.113,.014],[1.121,.035],[1.115,.067],[1.099,.082],[0,.082]].map(([r,y])=>new THREE.Vector2(r,y));
  const plinth=mesh(scene,new THREE.LatheGeometry(plinthProfile,96),oak);
  const trim=new THREE.MeshStandardMaterial({color:'#c5b6a0',roughness:.72});mesh(scene,new THREE.CylinderGeometry(1.125,1.125,.023,80),trim,[0,.017,0]);
  const contactTexture=contactMap(),contactMaterial=new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,toneMapped:false});const contact=mesh(scene,new THREE.PlaneGeometry(2.42,2.42),contactMaterial,[0,.085,0]);contact.rotation.x=-Math.PI/2;contact.castShadow=false;
  // A quiet oak stool and brushed-metal rail anchor the fitting room in real space.
  const props=new THREE.Group();scene.add(props);const metal=new THREE.MeshStandardMaterial({color:'#aaa79e',metalness:.55,roughness:.48});
  mesh(props,new THREE.CylinderGeometry(.29,.30,.065,40),oak,[-1.53,.61,-1.03]);
  for(const [x,z]of [[-.18,-.14],[.18,-.14],[0,.19]]){const leg=mesh(props,new THREE.CylinderGeometry(.035,.046,.58,10),oak,[-1.53+x,.31,-1.03+z]);leg.rotation.z=x*.35;}
  for(const x of [1.72,2.72])mesh(props,new THREE.CylinderGeometry(.018,.018,2.45,12),metal,[x,1.225,-1.72]);
  const rail=mesh(props,new THREE.CylinderGeometry(.018,.018,1.03,12),metal,[2.22,2.46,-1.72]);rail.rotation.z=Math.PI/2;
  // Backdrops are real, lazy-built 3D props sharing the existing material/light path.
  const backgrounds=new Map();
  function backdrop(name){
    if(backgrounds.has(name))return backgrounds.get(name);
    const g=new THREE.Group();g.name='atelier-background-'+name;scene.add(g);backgrounds.set(name,g);
    if(name==='warm'){
      mesh(g,new THREE.BoxGeometry(.95,.075,.46),oak,[-1.67,.47,-1.22]);
      for(const x of [-1.99,-1.35])mesh(g,new THREE.CylinderGeometry(.032,.04,.43,8),oak,[x,.24,-1.22]);
      const ceramic=new THREE.MeshStandardMaterial({color:'#dfc8a6',roughness:.84});
      mesh(g,new THREE.CylinderGeometry(.15,.22,.27,24),ceramic,[-1.67,.64,-1.22]);
      const lamp=new THREE.MeshStandardMaterial({color:'#faf0d6',roughness:.78,emissive:'#e7bb68',emissiveIntensity:.20});
      mesh(g,new THREE.ConeGeometry(.37,.43,24,1,true),lamp,[1.76,1.60,-1.45]);
      mesh(g,new THREE.CylinderGeometry(.018,.018,1.40,10),metal,[1.76,.72,-1.45]);
      mesh(g,new THREE.CylinderGeometry(.21,.23,.045,24),metal,[1.76,.06,-1.45]);
      for(let i=0;i<6;i++)mesh(g,new THREE.BoxGeometry(.026,2.4,.026),oak,[2.12+i*.14,1.24,-2.03]);
    }else if(name==='garden'){
      const clay=new THREE.MeshStandardMaterial({color:'#b88167',roughness:.93}),leaf=new THREE.MeshStandardMaterial({color:'#6f9276',roughness:.94}),stone=new THREE.MeshStandardMaterial({color:'#dadbd0',roughness:.95});
      mesh(g,new THREE.BoxGeometry(2.6,.10,.36),stone,[0,.44,-2.17]);
      for(const x of [-1,1])mesh(g,new THREE.BoxGeometry(.13,.42,.29),stone,[x,.21,-2.17]);
      for(const [i,x]of [-1.66,1.62].entries()){
        mesh(g,new THREE.CylinderGeometry(.28,.22,.43,24),clay,[x,.22,-1.18]);
        for(let j=0;j<(mobile?5:7);j++){const a=j*2.399+i*.7,l=mesh(g,new THREE.SphereGeometry(1,14,10),leaf,[x+Math.sin(a)*.20,.72+(j%3)*.11,-1.18+Math.cos(a)*.16]);l.scale.set(.13,.36,.065);l.rotation.set(.35*Math.cos(a),a,.45*Math.sin(a));}
      }
    }
    g.visible=false;return g;
  }
  const envScene=new THREE.Scene();envScene.background=new THREE.Color('#dfe7e7');const envWhite=new THREE.MeshBasicMaterial({color:'#ffffff'});
  mesh(envScene,new THREE.PlaneGeometry(5,4),envWhite,[-3,3,4]).lookAt(0,1,0);mesh(envScene,new THREE.PlaneGeometry(4,3),envWhite,[3,2,-3]).lookAt(0,1,0);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(envScene,.08);scene.environment=environment.texture;scene.environmentIntensity=.42;pmrem.dispose();envScene.traverse(o=>o.geometry?.dispose());envWhite.dispose();
  const contactLight=createContactLight({renderer,scene,camera,quality:'balanced',mobile});
  let cancelled=Boolean(signal?.aborted),disposeReady=null,backdropDisposed=false;
  function releaseBackdrop(){
    if(backdropDisposed)return;backdropDisposed=true;contactLight.dispose();const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());oakTexture.dispose();contactTexture.dispose();environment.dispose();key.shadow.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
  }
  const abort=()=>{cancelled=true;if(disposeReady)disposeReady();else releaseBackdrop();};
  signal?.addEventListener('abort',abort,{once:true});
  if(cancelled){signal?.removeEventListener('abort',abort);releaseBackdrop();throw new DOMException('Wardrobe closed','AbortError');}
  let avatar;
  try{avatar=await createMongleAvatar({mobile,anisotropy:Math.min(8,renderer.capabilities.getMaxAnisotropy()),wardrobeDetail:true});}
  catch(error){signal?.removeEventListener('abort',abort);releaseBackdrop();throw error;}
  if(cancelled){avatar.dispose();signal?.removeEventListener('abort',abort);throw new DOMException('Wardrobe closed','AbortError');}
  scene.add(avatar.group);avatar.group.position.y=.083;avatar.setEquipment(slots);avatar.setDyes(dyes);
  let disposed=false,lost=false,active=true,inView=true,frame=0,frameCount=0,lastFrame=0;
  let light='daylight',angle=-.17,targetAngle=-.17,detail=false,zoom=0,pose='neutral',background='room',drag=null,pinch=null,currentSlots=slotsForOutfit(slots),size={width:1,height:1},renderMs=0;
  const pointers=new Map();
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  renderer.debug.onShaderError=()=>{lost=true;cancelAnimationFrame(frame);frame=0;onError('3D 표현을 준비하지 못했어요. 다시 열어 주세요.');};
  function fit(width=size.width,height=size.height){camera.aspect=width/height;camera.fov=36;const scale=1/(1+zoom*.75);target.set(0,detail?.73:.91,0);camera.position.set(0,target.y+(detail?.27:.42)*scale,(detail?2.33:4.03)*scale);if(camera.aspect<.8)camera.position.z*=.8/camera.aspect;camera.lookAt(target);camera.updateProjectionMatrix();}
  function render(){if(disposed||lost||!active||!inView||document.hidden)return;avatar.group.rotation.y=angle;const before=performance.now();contactLight.render();renderMs=performance.now()-before;frameCount++;}
  function schedule(){if(!frame&&!disposed&&!lost&&active&&inView&&!document.hidden)frame=requestAnimationFrame(tick);}
  function tick(now){frame=0;if(disposed||lost||!active||!inView||document.hidden)return;const dt=Math.min(.05,lastFrame?(now-lastFrame)/1000:.016);lastFrame=now;const reduced=reducedMotion||motionQuery.matches;angle=reduced?targetAngle:angle+(targetAngle-angle)*(1-Math.exp(-dt*16));if(Math.abs(targetAngle-angle)<.0005)angle=targetAngle;render();if(angle!==targetAngle)schedule();}
  function resize(){if(disposed)return;const phone=matchMedia('(max-width:799px)').matches,shadowSize=phone?512:1024,rect=host.getBoundingClientRect();size={width:Math.max(1,Math.round(rect.width)),height:Math.max(1,Math.round(rect.height))};renderer.setPixelRatio(Math.min(devicePixelRatio||1,phone?1.5:1.75,Math.sqrt(1200000/(size.width*size.height))));renderer.setSize(size.width,size.height,false);if(key.shadow.mapSize.x!==shadowSize){key.shadow.mapSize.set(shadowSize,shadowSize);key.shadow.map?.dispose();key.shadow.mapPass?.dispose();key.shadow.map=null;key.shadow.mapPass=null;key.shadow.needsUpdate=true;}contactLight.setQuality('balanced',{mobile:phone});fit();schedule();}
  function getView(){return {angle:targetAngle,zoom,detail};}
  function notifyView(){onView(getView());}
  function setAngle(value){if(!Number.isFinite(value))return;targetAngle=value;onAngle(value);notifyView();schedule();}
  function setZoom(value){zoom=normalizeStageView({zoom:value},getView()).zoom;fit();notifyView();schedule();return zoom;}
  function setView(value={}){const v=normalizeStageView(value,getView());angle=targetAngle=v.angle;zoom=v.zoom;detail=v.detail;fit();onAngle(angle);notifyView();schedule();return getView();}
  function resetView(){return setView(STAGE_DEFAULT_VIEW);}
  function down(e){if(e.button!==0||disposed||lost)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture?.(e.pointerId);if(pointers.size===2){drag=null;pinch={distance:stagePointerDistance(pointers),zoom};}else if(pointers.size===1){drag={pointerId:e.pointerId,x:e.clientX,angle:targetAngle};}canvas.classList.add('is-dragging');}
  function move(e){if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinch&&pointers.size>=2){const distance=stagePointerDistance(pointers);if(distance>0&&pinch.distance>0)setZoom(pinch.zoom+Math.log(distance/pinch.distance));return;}if(!drag||drag.pointerId!==e.pointerId)return;targetAngle=drag.angle+(e.clientX-drag.x)*.012;angle=targetAngle;onAngle(angle);notifyView();schedule();}
  function up(e){pointers.delete(e.pointerId);pinch=null;drag=null;if(pointers.size===1){const [pointerId,p]=[...pointers][0];drag={pointerId,x:p.x,angle:targetAngle};}else canvas.classList.remove('is-dragging');notifyView();}
  function wheel(e){if(disposed||lost)return;e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?size.height:1);setZoom(zoom-delta*.0012);}
  function keys(e){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','+','=','-'].includes(e.key))return;e.preventDefault();if(['ArrowUp','ArrowDown','+','=','-'].includes(e.key))setZoom(zoom+(['ArrowDown','-'].includes(e.key)?-.07:.07));else setAngle(e.key==='Home'?0:targetAngle+(e.key==='ArrowLeft'?-.24:.24));}
  function visibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();}
  function contextLost(e){e.preventDefault();if(disposed)return;lost=true;cancelAnimationFrame(frame);frame=0;onError('3D 화면이 잠시 쉬고 있어요. 고른 옷은 남아 있어요. 다시 열어 주세요.');}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
  const intersection=new IntersectionObserver(entries=>{inView=entries.at(-1)?.isIntersecting!==false;if(!inView){cancelAnimationFrame(frame);frame=0;}else schedule();},{rootMargin:'100px'});intersection.observe(host);
  const events=[['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['lostpointercapture',up],['keydown',keys],['webglcontextlost',contextLost]];
  for(const [event,handler]of events)canvas.addEventListener(event,handler);
  canvas.addEventListener('wheel',wheel,{passive:false});
  document.addEventListener('visibilitychange',visibility);resize();
  function setLight(value){light=LIGHTS[value]?value:'daylight';const preset=LIGHTS[light];scene.background=new THREE.Color(preset.background).lerp(new THREE.Color(background==='warm'?'#f0e6da':background==='garden'?'#e0ebe2':preset.background),.50);key.color.set(preset.key);key.intensity=preset.intensity;fill.color.set(preset.fill);const neutral=light==='studio';key.position.set(...(neutral?[-3.8,3.6,3.3]:[-3.4,4.8,4.6]));fill.intensity=neutral?.42:.65;hemi.intensity=neutral?.88:1.15;scene.environmentIntensity=neutral?.48:.42;renderer.toneMappingExposure=preset.exposure;schedule();}
  function setPose(value){pose=STAGE_POSES.includes(value)?value:'neutral';avatar.setPose(pose);schedule();return pose;}
  function setBackground(value){background=STAGE_BACKGROUNDS.includes(value)?value:'room';props.visible=background==='room';for(const g of backgrounds.values())g.visible=false;if(background!=='room')backdrop(background).visible=true;plaster.color.set(background==='warm'?'#efe6d9':background==='garden'?'#edf1e8':'#f2f3f0');setLight(light);schedule();return background;}
  function setDyes(value={}){const normalized=avatar.setDyes(value);schedule();return normalized;}
  function getState(){return {slots:{...currentSlots},dyes:avatar.getDyes(),view:getView(),light,pose,background};}
  setLight(light);
  function capture({width=1200,height=1500,slots:photoSlots,dyes:photoDyes,thumbnail=false}={}){
    if(disposed||lost||renderer.getContext().isContextLost())throw Error('STAGE_UNAVAILABLE');
    width=Math.max(1,Math.min(2400,Math.round(Number(width)||1200)));height=Math.max(1,Math.min(2400,Math.round(Number(height)||1500)));
    const dpr=renderer.getPixelRatio(),previous=getState(),previousAngle=angle,previousTargetAngle=targetAngle;
    try{
      renderer.setPixelRatio(1);renderer.setSize(width,height,false);
      if(thumbnail){angle=-.11;detail=false;zoom=0;setPose('neutral');setBackground('room');setLight('studio');}
      fit(width,height);if(photoSlots)avatar.setEquipment(slotsForOutfit(photoSlots));if(photoDyes!==undefined)avatar.setDyes(photoDyes);avatar.group.rotation.y=thumbnail?angle:targetAngle;contactLight.render();
      return canvas.toDataURL('image/png');
    }finally{angle=previousAngle;targetAngle=previousTargetAngle;detail=previous.view.detail;zoom=previous.view.zoom;avatar.setEquipment(previous.slots);avatar.setDyes(previous.dyes);avatar.group.rotation.y=angle;setPose(previous.pose);setBackground(previous.background);setLight(previous.light);renderer.setPixelRatio(dpr);renderer.setSize(size.width,size.height,false);fit();render();schedule();}
  }
  function dispose(){
    if(disposed)return;disposed=true;cancelAnimationFrame(frame);resizeObserver.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);
    for(const [event,handler]of events)canvas.removeEventListener(event,handler);canvas.removeEventListener('wheel',wheel);pointers.clear();drag=pinch=null;
    signal?.removeEventListener('abort',abort);avatar.dispose();releaseBackdrop();
  }
  disposeReady=dispose;
  return {
    canvas,setAngle,setLight,setZoom,getView,setView,resetView,setDyes,getDyes:()=>avatar.getDyes(),getDyeDefaults:(slots=currentSlots)=>wardrobeDyeDefaults(slots),setPose,setBackground,getState,capture,dispose,
    setSlots(value){currentSlots=slotsForOutfit(value);avatar.setEquipment(currentSlots);schedule();},
    setDetail(value){detail=Boolean(value);fit();notifyView();schedule();},
    setActive(value){active=Boolean(value);if(!active){cancelAnimationFrame(frame);frame=0;}else schedule();},
    metrics:()=>({stageRevision:3,avatar:avatar.metrics(),contactLight:contactLight.metrics(),shadowMapSize:key.shadow.mapSize.x,shadowTechnique:'VSM',slots:{...currentSlots},dyes:avatar.getDyes(),view:getView(),angle,targetAngle,detail,zoom,light,pose,background,disposed,lost,active,inView,paused:!active||!inView||document.hidden||lost,frames:frameCount,dpr:renderer.getPixelRatio(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,renderSubmissionMs:renderMs,drawingBuffer:{width:canvas.width,height:canvas.height}}),
  };
}
