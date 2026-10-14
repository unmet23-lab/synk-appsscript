import * as THREE from './scene-assets/three.module.js';
import {createMongleAvatar} from './avatar-v3.mjs';
import {slotsForOutfit} from './wardrobe-catalog.mjs';
import {createHomeCompanions} from './home-companion-avatars.mjs';

const IDS=['mongle','kkamong','marin'];
// Room-scale silhouettes: Kkamong's wide, furry body needs less height than Marin.
const HOME_HEIGHTS={mongle:1.8,kkamong:1.90,marin:2.13};
const tutorId=value=>IDS.includes(value)?value:'mongle';
const qualityId=value=>value==='low'?'low':value==='high'||value==='detail'?'high':'balanced';
function mesh(parent,geometry,material,position=[0,0,0],scale=[1,1,1]){const object=new THREE.Mesh(geometry,material);object.position.set(...position);object.scale.set(...scale);object.castShadow=object.receiveShadow=true;parent.add(object);return object;}
function box(parent,size,material,position){return mesh(parent,new THREE.BoxGeometry(...size),material,position);}
function roundedShape(width,height,radius=.12){const x=-width/2,y=-height/2,s=new THREE.Shape();s.moveTo(x+radius,y);s.lineTo(x+width-radius,y);s.quadraticCurveTo(x+width,y,x+width,y+radius);s.lineTo(x+width,y+height-radius);s.quadraticCurveTo(x+width,y+height,x+width-radius,y+height);s.lineTo(x+radius,y+height);s.quadraticCurveTo(x,y+height,x,y+height-radius);s.lineTo(x,y+radius);s.quadraticCurveTo(x,y,x+radius,y);return s;}
function rounded(parent,size,material,position){const [width,height,depth]=size;const geometry=new THREE.ExtrudeGeometry(roundedShape(width,height,Math.min(width,height)*.12),{depth,bevelEnabled:true,bevelThickness:.022,bevelSize:.022,bevelSegments:2,steps:1,curveSegments:8});geometry.translate(0,0,-depth/2);return mesh(parent,geometry,material,position);}
function archShape(width,height){const s=new THREE.Shape(),half=width/2;s.moveTo(-half,0);s.lineTo(-half,height-half);s.quadraticCurveTo(-half,height,0,height);s.quadraticCurveTo(half,height,half,height-half);s.lineTo(half,0);s.closePath();return s;}
function canvasTexture(canvas){const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;}

/** One WebGL renderer for the entire home; all 2D controls belong to the host. */
export async function mountLivingHomeScene(container,{selectedTutor='mongle',onInteract=()=>{},reducedMotion=false,quality='balanced',slots={},dyes={},onReady=()=>{},onError=()=>{},signal}={}){
  if(!container?.appendChild)throw new TypeError('LIVING_HOME_CONTAINER_REQUIRED');
  if(signal?.aborted)throw new DOMException('Home closed','AbortError');
  const canvas=document.createElement('canvas');canvas.className='living-home-canvas';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='display:block;width:100%;height:100%;touch-action:pan-y';container.appendChild(canvas);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});}
  catch(error){canvas.remove();onError(error);throw error;}
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.09;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eee9df');
  const camera=new THREE.PerspectiveCamera(36,1,.1,40),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const motionQuery=matchMedia('(prefers-reduced-motion:reduce)');
  let disposed=false,lost=false,active=true,inView=true,reduced=Boolean(reducedMotion),level=qualityId(quality),selected=tutorId(selectedTutor),frame=0,frames=0,lastDraw=0,clock=0,renderMs=0,photoGeneration=0;
  let width=1,height=1,mongle=null,companions=null,environment=null,resizeObserver=null,intersection=null,api=null,lifecycle=null;
  const extraTextures=new Set(),extraMaterials=new Set(),wrappers=new Map(),anchors=new Map(),interactables=[],greetings=new Map();
  const currentSlots=()=>mongle?.metrics().equipment||slotsForOutfit(slots);
  const stopped=()=>disposed||lost||!active||!inView||document.hidden;
  const still=()=>reduced||motionQuery.matches;
  const stop=()=>{cancelAnimationFrame(frame);frame=0;lastDraw=0;};
  const material=(color,props={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.9,...props});extraMaterials.add(m);return m;};
  function interactive(root,id,anchor=[0,1,0]){root.userData.homeTarget=id;interactables.push(root);const point=new THREE.Object3D();point.position.set(...anchor);root.add(point);anchors.set(id,point);return root;}
  const hemi=new THREE.HemisphereLight('#e9f0f4','#a19481',1.15);scene.add(hemi);
  const key=new THREE.DirectionalLight('#fff3dc',2.8);key.position.set(-3.8,6.5,4.8);key.castShadow=true;key.shadow.camera.left=-4.8;key.shadow.camera.right=4.8;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.camera.near=.5;key.shadow.camera.far=18;key.shadow.bias=-.0002;key.shadow.normalBias=.016;key.shadow.radius=3;scene.add(key);
  const fill=new THREE.DirectionalLight('#dce8f4',.62);fill.position.set(4,3,3);scene.add(fill);
  const rim=new THREE.DirectionalLight('#fffaf0',.65);rim.position.set(0,4,-3);scene.add(rim);
  function dispose(){
    if(disposed)return;disposed=true;photoGeneration++;stop();resizeObserver?.disconnect();intersection?.disconnect();document.removeEventListener('visibilitychange',visibility);motionQuery.removeEventListener('change',motionChange);signal?.removeEventListener('abort',abort);
    canvas.removeEventListener('pointerup',handlePointerUp);canvas.removeEventListener('webglcontextlost',contextLost);
    mongle?.dispose();companions?.dispose();const geometries=new Set(),materials=new Set(extraMaterials);scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());extraTextures.forEach(t=>t.dispose());environment?.dispose();key.shadow.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
  }
  function abort(){dispose();}
  function fail(error){if(disposed)return;lost=true;dispose();onError(error instanceof Error?error:new Error(String(error)));}
  function contextLost(event){event.preventDefault();fail(new Error('LIVING_HOME_CONTEXT_LOST'));}
  function visibility(){if(document.hidden)stop();else schedule();}
  function motionChange(){resetMotion();stop();schedule();}
  signal?.addEventListener('abort',abort,{once:true});canvas.addEventListener('webglcontextlost',contextLost);
  renderer.debug.onShaderError=()=>fail(new Error('LIVING_HOME_SHADER_ERROR'));
  try{
    companions=createHomeCompanions({low:level==='low',grounded:true,onInvalidate:()=>lifecycle?.schedule()});
    mongle=await createMongleAvatar({mobile:matchMedia('(max-width:799px)').matches,anisotropy:Math.min(4,renderer.capabilities.getMaxAnisotropy()),wardrobeDetail:level!=='low'});
    if(disposed||signal?.aborted){mongle.dispose();throw new DOMException('Home closed','AbortError');}
    mongle.setEquipment(slotsForOutfit(slots));mongle.setDyes(dyes);
    const controllers={mongle,kkamong:companions.kkamong,marin:companions.marin};
    // Compare actual body heights, not arbitrary scales of unrelated model units.
    // Keep Kkamong close to Mongle's height rather than enlarging its broad body.
    const bodyScales=new Map();
    for(const id of IDS){
      const model=controllers[id].group,bounds=new THREE.Box3().setFromObject(model);
      const h=id==='mongle'?mongle.metrics().bodyBounds.height:bounds.getSize(new THREE.Vector3()).y;
      bodyScales.set(id,HOME_HEIGHTS[id]/h);
      // A stray filament must never suspend the solid body above the floor.
      // Kkamong's floor pose compresses its low fibres to this contact height.
      if(id!=='mongle')model.position.y=-(id==='kkamong'?companions.kkamong.metrics().bodyBounds.groundY:bounds.min.y);
      // Decorative fibers must not capture rays up to a world unit away from
      // the actual body and block the frame/doors behind the characters.
      model.traverse(object=>{if(object.isLine||object.userData.decorativeFur||object.name==='kkamong-dense-short-underfur')object.raycast=()=>{};});
    }
    for(const id of IDS){const wrapper=new THREE.Group();wrapper.name=`home-tutor-${id}`;wrapper.add(controllers[id].group);scene.add(wrapper);wrappers.set(id,wrapper);interactive(wrapper,`tutor:${id}`,[0,.05,.62]);}

    const kit=companions.materials,oak=kit.wood,plaster=material('#e7e6de'),sage=material('#96a69c'),lapis=material('#5f7890'),brass=material('#b89561',{metalness:.65,roughness:.38}),paper=material('#fff4df'),ink=material('#4c615c');
    // Real wood planks and a plaster wall retain the wardrobe room's materials.
    const floor=new THREE.Group();scene.add(floor);for(let i=0;i<40;i++)box(floor,[8,.09,.39],oak,[0,-.055,-3.05+i*.40]); // full-screen home: planks run under the glass dock to the camera
    const wall=box(scene,[8,3.9,.14],plaster,[0,1.85,-2.85]);wall.castShadow=false;
    box(scene,[8,.16,.18],oak,[0,.08,-2.73]);
    const rugMat=kit.cottonCream.clone();rugMat.color.set('#d8d2bd');extraMaterials.add(rugMat);
    const rug=mesh(scene,new THREE.CircleGeometry(2.45,72),rugMat,[0,.005,.18],[1,.72,1]);rug.rotation.x=-Math.PI/2; rug.castShadow=false;
    const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;const cc=contactCanvas.getContext('2d'),gradient=cc.createRadialGradient(64,64,9,64,64,62);gradient.addColorStop(0,'rgba(40,36,28,.25)');gradient.addColorStop(.55,'rgba(40,36,28,.12)');gradient.addColorStop(1,'rgba(40,36,28,0)');cc.fillStyle=gradient;cc.fillRect(0,0,128,128);const contactTexture=canvasTexture(contactCanvas);extraTextures.add(contactTexture);
    const contactMaterial=new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false,toneMapped:false});extraMaterials.add(contactMaterial);
    for(const id of IDS){const shadow=mesh(wrappers.get(id),new THREE.PlaneGeometry(2.25,1.8),contactMaterial,[0,.009,0]);shadow.rotation.x=-Math.PI/2;shadow.castShadow=shadow.receiveShadow=false;}

    const backProps=new THREE.Group();scene.add(backProps);
    function doorway(id,color){
      const group=new THREE.Group();backProps.add(group);interactive(group,id,[0,1.92,.12]);
      mesh(group,new THREE.ExtrudeGeometry(archShape(1.14,2.18),{depth:.15,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,curveSegments:18}),oak);
      mesh(group,new THREE.ShapeGeometry(archShape(.91,1.97),20),color,[0,.065,.182]);
      box(group,[.045,1.67,.06],paper,[0,.91,.204]);box(group,[.91,.045,.06],paper,[0,1.2,.204]);
      mesh(group,new THREE.SphereGeometry(.044,12,8),brass,[.29,.88,.245]);return group;
    }
    const cafe=doorway('cafe',sage),town=doorway('town',lapis);cafe.rotation.y=.025;town.rotation.y=-.025;
    // A small ceramic cup distinguishes the cafe; leaves mark the town door.
    const cup=mesh(cafe,new THREE.CylinderGeometry(.09,.074,.14,24),kit.ceramic,[-.21,1.55,.25]);cup.rotation.x=.22;
    const handle=mesh(cafe,new THREE.TorusGeometry(.062,.018,8,20),kit.ceramic,[-.107,1.57,.26]);handle.scale.x=.85;
    const leafMat=material('#718b6e');for(let i=0;i<3;i++){const leaf=mesh(town,new THREE.SphereGeometry(1,16,10),leafMat,[.05+(i-1)*.085,1.54+(i%2)*.07,.24],[.044,.12,.015]);leaf.rotation.z=(i-1)*.5;}

    const memoryCanvas=document.createElement('canvas');memoryCanvas.width=768;memoryCanvas.height=512;const memoryTexture=canvasTexture(memoryCanvas);extraTextures.add(memoryTexture);
    const memoryMaterial=new THREE.MeshBasicMaterial({map:memoryTexture,toneMapped:false});extraMaterials.add(memoryMaterial);
    const memory=new THREE.Group();scene.add(memory);interactive(memory,'memory',[0,-.33,.15]);rounded(memory,[1.72,1.18,.13],oak,[0,0,0]);mesh(memory,new THREE.PlaneGeometry(1.50,.97),memoryMaterial,[0,0,.12]);
    let memoryData={text:'오늘의 작은 장면이\n여기에 쌓여요.',photoUrl:null},memoryImage=null;
    function drawMemory(){
      const ctx=memoryCanvas.getContext('2d');ctx.fillStyle='#faf7ee';ctx.fillRect(0,0,768,512);ctx.fillStyle='#708272';ctx.font='600 40px "Noto Sans KR",sans-serif';ctx.fillText('우리의 기억',38,59);
      let textX=38,textWidth=690;if(memoryImage){const x=34,y=87,w=333,h=355;ctx.fillStyle='#e7e2d5';ctx.fillRect(x,y,w,h);const scale=Math.min(w/memoryImage.width,h/memoryImage.height),iw=memoryImage.width*scale,ih=memoryImage.height*scale;ctx.drawImage(memoryImage,x+(w-iw)/2,y+(h-ih)/2,iw,ih);textX=399;textWidth=327;}
      ctx.fillStyle='#354942';ctx.font=`500 ${memoryImage?60:66}px "Noto Sans KR",sans-serif`;let line='',y=memoryImage?216:235,row=0;const chars=Array.from(String(memoryData.text||(memoryImage?'함께한 순간':'첫 표현을 기다려요.')).slice(0,180));
      for(let i=0;i<chars.length;i++){const char=chars[i];if(char==='\n'||ctx.measureText(line+char).width>textWidth){if(row===1){while(line&&ctx.measureText(line+'…').width>textWidth)line=line.slice(0,-1);line+='…';break;}ctx.fillText(line,textX,y);line=char==='\n'?'':char;y+=88;row++;}else line+=char;}ctx.fillText(line,textX,y);memoryTexture.needsUpdate=true;schedule();
    }
    function setMemory(value={}){
      const generation=++photoGeneration;memoryData={text:typeof value.text==='string'?value.text:memoryData.text,photoUrl:typeof value.photoUrl==='string'?value.photoUrl:null};memoryImage=null;drawMemory();
      if(!memoryData.photoUrl)return Promise.resolve(false);
      let url;try{url=new URL(memoryData.photoUrl,location.href);}catch{return Promise.resolve(false);}
      if(!['blob:','data:'].includes(url.protocol)&&url.origin!==location.origin)return Promise.resolve(false);
      return new Promise(resolve=>{const image=new Image();image.onload=()=>{if(disposed||generation!==photoGeneration){resolve(false);return;}memoryImage=image;drawMemory();resolve(true);};image.onerror=()=>resolve(false);image.src=url.href;});
    }

    const book=new THREE.Group();scene.add(book);interactive(book,'book',[0,.03,.38]);
    mesh(book,new THREE.CylinderGeometry(.46,.48,.065,36),oak,[0,.38,0]);for(const x of [-.27,.27])box(book,[.055,.37,.055],oak,[x,.18,0]);
    const cover=rounded(book,[.60,.055,.44],lapis,[0,.435,0]);cover.rotation.z=-.07;
    box(book,[.54,.048,.38],paper,[0,.466,0]);const bookPage=box(book,[.27,.016,.38],paper,[-.138,.50,0]);bookPage.rotation.z=-.10;const bookPage2=box(book,[.27,.016,.38],paper,[.138,.50,0]);bookPage2.rotation.z=.10;
    for(let i=0;i<4;i++){box(book,[.16,.005,.006],ink,[-.14,.517,-.1+i*.055]);box(book,[.16,.005,.006],ink,[.14,.517,-.1+i*.055]);}
    const wardrobe=new THREE.Group();scene.add(wardrobe);interactive(wardrobe,'wardrobe',[0,.88,0]);
    for(const x of [-.39,.39])mesh(wardrobe,new THREE.CylinderGeometry(.027,.038,1.40,10),oak,[x,.7,0]);const bar=mesh(wardrobe,new THREE.CylinderGeometry(.025,.025,.82,12),oak,[0,1.39,0]);bar.rotation.z=Math.PI/2;
    const garment=rounded(wardrobe,[.49,.60,.09],sage,[0,.91,.03]);const collar=mesh(wardrobe,new THREE.TorusGeometry(.085,.02,8,24),paper,[0,1.23,.1]);collar.scale.y=.6;
    const photo=new THREE.Group();scene.add(photo);interactive(photo,'photo',[0,.30,.28]);rounded(photo,[.48,.28,.19],kit.ceramic,[0,.27,0]);const lens=mesh(photo,new THREE.CylinderGeometry(.09,.09,.09,24),ink,[0,.27,.13]);lens.rotation.x=Math.PI/2;mesh(photo,new THREE.CylinderGeometry(.04,.04,.038,12),brass,[-.14,.435,0]);

    const plant=new THREE.Group();scene.add(plant);mesh(plant,new THREE.CylinderGeometry(.20,.16,.34,24),kit.ceramic,[0,.17,0]);for(let i=0;i<7;i++){const a=i*2.399,l=mesh(plant,new THREE.SphereGeometry(1,16,10),leafMat,[Math.sin(a)*.16,.56+(i%3)*.1,Math.cos(a)*.13],[.08,.24,.04]);l.rotation.set(.25,a,Math.sin(a)*.5);}
    const envScene=new THREE.Scene();envScene.background=new THREE.Color('#dfe7e7');const envWhite=new THREE.MeshBasicMaterial({color:'#ffffff'});mesh(envScene,new THREE.PlaneGeometry(5,4),envWhite,[-3,3,4]).lookAt(0,1,0);mesh(envScene,new THREE.PlaneGeometry(4,3),envWhite,[3,2,-3]).lookAt(0,1,0);const pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromScene(envScene,.02);scene.environment=environment.texture;scene.environmentIntensity=.42;pmrem.dispose();envScene.traverse(o=>o.geometry?.dispose());envWhite.dispose();

    function arrange(){
      const portrait=width/height<1,sideIds=IDS.filter(id=>id!==selected);
      for(const id of IDS){
        const wrapper=wrappers.get(id),center=id===selected,index=sideIds.indexOf(id),base=bodyScales.get(id);
        // The front position already emphasizes the selected friend. A smaller
        // focus boost keeps Kkamong's fluffy silhouette balanced beside the others.
        const focus=id==='kkamong'?(portrait?.76:.89):(portrait?.91:.96);
        wrapper.scale.setScalar(base*(center?focus:portrait?.64:.83));
        wrapper.position.set(center?0:(index===0?-1:1)*(portrait?1.30:1.58),.028,center?.33:portrait?-.50:-.29);
        wrapper.rotation.y=center?-.025:(index===0?.14:-.14);
      }
      cafe.position.set(portrait?-1.76:-2.65,.02,-2.60);town.position.set(portrait?1.76:2.65,.02,-2.60);memory.position.set(0,2.61,-2.65);
      book.position.set(portrait?-1.30:-2.10,.01,1.17);wardrobe.position.set(portrait?1.70:2.30,.01,.52);wardrobe.scale.setScalar(portrait?.73:.9);photo.position.set(.61,.03,1.25);plant.position.set(portrait?-2.36:-3.29,.015,-1.32);
    }
    function updateCharacters(){for(const id of IDS){const start=greetings.get(id),greeting=start===undefined?-1:clock-start;controllers[id].update(clock,{reducedMotion:still(),greeting});if(greeting>1.2)greetings.delete(id);}}
    function resetMotion(){if(!mongle)return;greetings.clear();updateCharacters();}
    function render(force=false){if(disposed||lost||!force&&stopped())return;const before=performance.now();updateCharacters();renderer.render(scene,camera);frames++;renderMs=performance.now()-before;}
    function schedule(){if(!frame&&!stopped())frame=requestAnimationFrame(tick);}
    function tick(now){frame=0;if(stopped())return;const interval=level==='low'?1000/20:1000/30;if(!lastDraw||now-lastDraw>=interval-1||still()){const dt=lastDraw?Math.min(.05,(now-lastDraw)/1000):0;lastDraw=now;if(!still())clock+=dt;render();}if(!still())schedule();}
    function resize(){if(disposed)return;const rect=container.getBoundingClientRect();width=Math.max(1,Math.round(rect.width));height=Math.max(1,Math.round(rect.height));const ratio=width/height;renderer.setPixelRatio(Math.min(devicePixelRatio||1,level==='low'?1:level==='high'?1.75:1.5,Math.sqrt((level==='low'?420000:level==='high'?1400000:850000)/(width*height))));renderer.setSize(width,height,false);camera.aspect=ratio;const spanOverride=Number.parseFloat(getComputedStyle(container).getPropertyValue(ratio<1?'--scene-span-portrait':'--scene-span-landscape')),span=spanOverride>0?spanOverride:ratio<1?4.60:7.4,distance=Math.max(6.0,span/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*ratio));camera.position.set(0,2.65,distance);camera.lookAt(0,1.28,0);
     // The home lays glass UI over the lower screen; --scene-lift raises the framed room without changing perspective.
     const style=getComputedStyle(container),lift=Number.parseFloat(style.getPropertyValue('--scene-lift'))||0,shift=Number.parseFloat(style.getPropertyValue('--scene-shift'))||0;if(lift||shift)camera.setViewOffset(width,height,-Math.round(width*shift),Math.round(height*lift),width,height);else camera.clearViewOffset();
     camera.updateProjectionMatrix();arrange();schedule();}
    function setQuality(value){level=qualityId(value);renderer.shadowMap.enabled=level!=='low';const shadowSize=level==='high'?1024:512;if(key.shadow.mapSize.x!==shadowSize){key.shadow.mapSize.set(shadowSize,shadowSize);key.shadow.map?.dispose();key.shadow.map=null;key.shadow.needsUpdate=true;}companions.setQuality(level);resize();return level;}
    function greet(id=selected){id=tutorId(id);if(disposed)return;greetings.set(id,clock);schedule();}
    function pointerUp(event){if(stopped()||event.button!==0)return;const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(interactables,true)[0];if(!hit)return;let target=hit.object;while(target&&!target.userData.homeTarget)target=target.parent;const id=target?.userData.homeTarget;if(id){if(id.startsWith('tutor:'))greet(id.split(':')[1]);onInteract(id);}}
    function getAnchors(){scene.updateMatrixWorld(true);return [...anchors].map(([id,object])=>{const point=object.getWorldPosition(new THREE.Vector3()).project(camera);return {id,x:(point.x+1)/2,y:(1-point.y)/2,visible:point.z>-1&&point.z<1&&Math.abs(point.x)<=1&&Math.abs(point.y)<=1};});}
    function capture(){if(disposed||lost||renderer.getContext().isContextLost())throw new Error('LIVING_HOME_UNAVAILABLE');render(true);return canvas.toDataURL('image/png');}
    function metrics(){return {revision:2,actual3D:true,productionAsset:false,rendererCount:1,selectedTutor:selected,quality:level,reducedMotion:still(),active,inView,paused:stopped()||still(),disposed,lost,frames,clock,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,dpr:renderer.getPixelRatio(),drawingBuffer:{width:canvas.width,height:canvas.height},renderSubmissionMs:renderMs,slots:{...currentSlots()},dyes:mongle.getDyes(),memory:{hasPhoto:Boolean(memoryImage),hasText:Boolean(memoryData.text)},companions:{mongle:mongle.metrics(),kkamong:companions.kkamong.metrics(),marin:companions.marin.metrics()}};}
    // Keep lifecycle functions available to the outer disposal path.
    lifecycle={schedule,resetMotion,pointerUp};
    api={canvas,setTutor(id){selected=tutorId(id);arrange();greet(selected);schedule();return selected;},setEquipment(nextSlots={},nextDyes={}){if(disposed)return;mongle.setEquipment(slotsForOutfit(nextSlots));mongle.setDyes(nextDyes);schedule();},setMemory,setActive(value){active=Boolean(value);if(!active)stop();else schedule();},setReducedMotion(value){reduced=Boolean(value);resetMotion();stop();schedule();},setQuality,greet,capture,getAnchors,metrics,dispose};
    canvas.addEventListener('pointerup',handlePointerUp);document.addEventListener('visibilitychange',visibility);motionQuery.addEventListener('change',motionChange);
    resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);intersection=new IntersectionObserver(entries=>{inView=entries.at(-1)?.isIntersecting!==false;if(!inView)stop();else schedule();},{rootMargin:'0px'});intersection.observe(container);
    drawMemory();setQuality(level);render();if(lost)throw new Error('LIVING_HOME_UNAVAILABLE');onReady(api);return api;
  }catch(error){dispose();if(error?.name!=='AbortError')onError(error);throw error;}

  // Hoisted wrappers let visibility/abort clean up safely during async loading.
  function schedule(){lifecycle?.schedule();}
  function resetMotion(){lifecycle?.resetMotion();}
  function handlePointerUp(event){lifecycle?.pointerUp(event);}
}

export default mountLivingHomeScene;
