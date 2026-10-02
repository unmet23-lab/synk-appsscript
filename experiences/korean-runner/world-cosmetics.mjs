import * as T from './vendor/three.module.js';

export const COSMETIC_OPTIONS=Object.freeze({trail:['none','petals','starlight','footprints'],lantern:['paper','flower','firefly'],companion:['none','sparrow','cloud'],scenery:['village','blossom','snow','moonlight'],finish:['simple','flowers','stars','festival']});
export const DEFAULT_COSMETICS=Object.freeze({trail:'none',lantern:'paper',companion:'none',scenery:'village',finish:'simple'});
export function normalizeCosmetics(value={}){return Object.fromEntries(Object.entries(COSMETIC_OPTIONS).map(([key,options])=>[key,options.includes(value?.[key])?value[key]:DEFAULT_COSMETICS[key]]));}
export function cosmeticBudget(quality='experience',reduced=false){return {trail:reduced?6:quality==='experience'?24:12,finish:reduced?8:quality==='experience'?28:14,lantern:reduced?1:2};}
export const SCENERY_THEMES=Object.freeze({
  village:{sky:['#70AFCA','#A7D5E7','#D4E9E7','#F2CFB7'],fog:0xD2E8EB,hemi:0xE0F1FF,ground:0x91AE95,roof:0x477185,road:0xD4D6CA,sun:0xFFF0D4,sunDisc:0xFFE9BD,foliage:[0x80A98A,0x93B799,0xA3C3A4,0xEBC2BB,0xF4D2C3,0xE5AEA7],ambient:1.7,direct:2.9},
  blossom:{sky:['#9CBBCD','#D9DCE4','#EBDDD9','#F3D2BB'],fog:0xECDDDD,hemi:0xFFEFEA,ground:0xA9BA9B,roof:0x688797,road:0xDDD5CD,sun:0xFFF2DE,sunDisc:0xFFEBD3,foliage:[0xE4AFBB,0xF2C4CF,0xF0D3D0,0xE4AFBB,0xF2C4CF,0xF0D3D0],ambient:1.8,direct:2.8},
  snow:{sky:['#8EAFC8','#CFDFEA','#E9EBE6','#ECD5BF'],fog:0xDCE8ED,hemi:0xEBF6FF,ground:0xE1E7E1,roof:0xD4E1E1,road:0xC3D2D1,sun:0xFFF3E2,sunDisc:0xFFF1DA,foliage:[0xC2D9D1,0xE2EAE3,0xE9EDEA,0xDCE7E1,0xECF0E9,0xD0DED7],ambient:1.95,direct:2.6},
  moonlight:{sky:['#253D62','#547797','#95ADBC','#CBD4CC'],fog:0xA5BCC7,hemi:0xD5E9FF,ground:0x849C9A,roof:0x52778F,road:0xBECFD0,sun:0xD7E7FF,sunDisc:0xF4EED9,foliage:[0x789995,0x8EAAA2,0xA2BCAD,0xC5AAA9,0xDCC3BA,0xB799A4],ambient:1.9,direct:2.45}
});

// Felt geometries reuse the game's approved wool texture. Every decorative pool is fixed.
export function createCosmeticLayer({scene,felt,plain,mergeGeometries=null}){
  const root=new T.Group();root.name='windrun-cosmetics';scene.add(root);
  const ballGeo=new T.SphereGeometry(1,14,10),cylinderGeo=new T.CylinderGeometry(1,1,1,12),petalGeo=new T.SphereGeometry(1,10,7);
  const starShape=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.43:1;if(i===0)starShape.moveTo(Math.cos(a)*r,Math.sin(a)*r);else starShape.lineTo(Math.cos(a)*r,Math.sin(a)*r);}starShape.closePath();
  const starGeo=new T.ExtrudeGeometry(starShape,{depth:.18,bevelEnabled:true,bevelThickness:.06,bevelSize:.07,bevelSegments:1,steps:1});
  const glowMat=new T.MeshStandardMaterial({color:0xFFE2A0,emissive:0xC99A42,emissiveIntensity:.35,roughness:.8,map:felt(0xFFE2A0).map,bumpMap:felt(0xFFE2A0).bumpMap,bumpScale:.035});
  const lanternColors={paper:0xF4CF86,flower:0xEBAFB8,firefly:0xB5DCC4};
  const baseGeometry=new Set([ballGeo,cylinderGeo,petalGeo,starGeo]);
  function batch(group){if(!mergeGeometries)return;group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),buckets=new Map(),original=[];group.traverse(m=>{if(!m.isMesh)return;if(!buckets.has(m.material.uuid))buckets.set(m.material.uuid,{material:m.material,geometry:[]});buckets.get(m.material.uuid).geometry.push(m.geometry.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld)));original.push(m);});for(const m of original){m.parent.remove(m);if(!baseGeometry.has(m.geometry))m.geometry.dispose();}for(const b of buckets.values()){const geo=mergeGeometries(b.geometry,false);b.geometry.forEach(g=>g.dispose());if(geo){const m=new T.Mesh(geo,b.material);m.castShadow=m.receiveShadow=true;group.add(m);}}}
  function mesh(geo,material,position,scale,parent){const m=new T.Mesh(geo,typeof material==='number'?felt(material):material);m.position.set(...position);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  const ball=(position,scale,color,parent)=>mesh(ballGeo,color,position,scale,parent);
  const cyl=(position,scale,color,parent)=>mesh(cylinderGeo,color,position,scale,parent);
  function star(position,scale,color,parent){return mesh(starGeo,color,position,[scale,scale,scale],parent);}
  function flower(position,scale,parent){const g=new T.Group();g.position.set(...position);g.scale.setScalar(scale);parent.add(g);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const p=ball([Math.sin(a)*.58,Math.cos(a)*.58,0],[.39,.47,.19],i%2?0xF4C5CD:0xE9AAB9,g);p.rotation.z=-a;}ball([0,0,.12],[.25,.25,.17],0xF7DFB0,g);batch(g);return g;}
  function makeLantern(style='paper'){
    const g=new T.Group();g.name='lantern-'+style;
    cyl([0,.31,0],[.017,.22,.017],0xA38369,g);
    if(style==='flower'){
      const bloom=flower([0,0,0],.46,g);bloom.rotation.y=.1;
      ball([0,0,0],[.22,.25,.22],glowMat,g);
      flower([0,0,-.13],.46,g).rotation.y=Math.PI;
    }else if(style==='firefly'){
      ball([0,0,0],[.26,.30,.24],0xB9D9C1,g);
      ball([0,.005,.175],[.10,.12,.085],glowMat,g);
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ball([Math.sin(a)*.18,Math.cos(a)*.20,.20],[.026,.026,.022],0xFFF0BC,g);}
      const ring=new T.Mesh(new T.TorusGeometry(.245,.022,5,24),felt(0x729C88));ring.rotation.x=Math.PI/2;g.add(ring);
    }else{
      ball([0,0,0],[.25,.31,.25],0xF4CF86,g);
      for(const y of [-.15,0,.15]){const ring=new T.Mesh(new T.TorusGeometry(y===0?.249:.216,.009,4,24),felt(0xD6B474));ring.position.y=y;ring.rotation.x=Math.PI/2;g.add(ring);}
    }
    for(const y of [-.31,.31])cyl([0,y,0],[.15,.045,.15],0xA38369,g);
    cyl([0,-.41,0],[.022,.16,.022],lanternColors[style]||lanternColors.paper,g);
    batch(g);return g;
  }

  const lanternShowcase=new T.Group();root.add(lanternShowcase);
  cyl([0,.77,0],[.045,1.54,.045],0xA38369,lanternShowcase);
  const showcaseLanterns={};for(const style of COSMETIC_OPTIONS.lantern){const g=makeLantern(style);g.position.set(0,1.65,0);showcaseLanterns[style]=g;lanternShowcase.add(g);}
  const lanternFlashes=Array.from({length:2},()=>{const g=new T.Group();g.visible=false;root.add(g);const variants={};for(const style of COSMETIC_OPTIONS.lantern){const v=makeLantern(style);v.scale.setScalar(.6);g.add(v);variants[style]=v;}return {group:g,variants,age:0,active:false};});

  const companionRoot=new T.Group();root.add(companionRoot);
  const sparrow=new T.Group();companionRoot.add(sparrow);
  ball([0,0,0],[.27,.30,.35],0xA9896A,sparrow);ball([0,-.06,.24],[.21,.21,.19],0xF0D7B9,sparrow);ball([0,.18,.21],[.23,.21,.22],0xC3A07C,sparrow);
  for(const side of [-1,1])ball([side*.105,.245,.394],[.026,.030,.020],plain(0x33262A,.2),sparrow);
  const beak=mesh(new T.ConeGeometry(1,1,6),0xE9BA72,[0,.15,.47],[.055,.14,.045],sparrow);beak.rotation.x=Math.PI/2;
  const wings=[];for(const side of [-1,1]){const wing=ball([side*.27,.04,-.04],[.11,.24,.27],0x896E58,sparrow);wing.rotation.z=side*.25;wings.push(wing);}
  const tail=ball([0,-.05,-.39],[.13,.10,.24],0x846853,sparrow);tail.rotation.x=-.30;
  for(const side of [-1,1])cyl([side*.10,-.30,.10],[.022,.10,.022],0xD6AE72,sparrow);
  const cloud=new T.Group();companionRoot.add(cloud);for(const [x,y,z,s]of [[-.24,0,0,.22],[0,.09,0,.29],[.27,-.01,0,.22],[.04,-.08,.13,.24]])ball([x,y,z],[s,s*.76,s*.79],0xEEF2E7,cloud);
  for(const side of [-1,1])ball([side*.09,.025,.237],[.021,.024,.012],plain(0x475969,.5),cloud);
  for(const side of [-1,1])ball([side*.15,-.023,.224],[.035,.017,.014],0xE7B7AC,cloud);
  const companionContact=new T.Mesh(new T.CircleGeometry(.27,20),new T.MeshBasicMaterial({color:0x496257,transparent:true,opacity:.13,depthWrite:false}));companionContact.rotation.x=-Math.PI/2;root.add(companionContact);

  const trailMeshes={petals:new T.InstancedMesh(petalGeo,felt(0xF4C4CC),24),starlight:new T.InstancedMesh(starGeo,felt(0xF6DDA0),24),footprints:new T.InstancedMesh(ballGeo,felt(0x99ACAC),24)};
  for(const [key,m]of Object.entries(trailMeshes)){m.name='trail-'+key;m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.frustumCulled=false;m.castShadow=false;m.receiveShadow=true;root.add(m);}
  const trail=Array.from({length:24},()=>({age:9,x:0,y:0,z:0,side:1,phase:0}));let trailIndex=0,trailClock=0;
  const finishRoot=new T.Group();root.add(finishRoot);finishRoot.visible=false;
  const finishPieces=Array.from({length:28},(_,i)=>{const g=new T.Group();finishRoot.add(g);const bloom=flower([0,0,0],.11,g),s=star([0,0,0],.11,0xF4D393,g);return {group:g,flower:bloom,star:s,phase:i*2.399};});
  const festivalLanterns=Array.from({length:4},(_,i)=>{const g=makeLantern(i%2?'flower':'paper');g.scale.setScalar(.74);finishRoot.add(g);return g;});
  let selection={...DEFAULT_COSMETICS},preview=false,time=0,previewFinish=0,finishAge=0,wasFinished=false,lastDistance=0,budget=cosmeticBudget(),activeTrail=0;
  const dummy=new T.Object3D();
  function applySelection(value){selection=normalizeCosmetics(value);for(const [style,g]of Object.entries(showcaseLanterns))g.visible=style===selection.lantern;for(const f of lanternFlashes){f.active=false;f.group.visible=false;for(const [style,g]of Object.entries(f.variants))g.visible=style===selection.lantern;}for(const [style,m]of Object.entries(trailMeshes))m.visible=style===selection.trail;sparrow.visible=selection.companion==='sparrow';cloud.visible=selection.companion==='cloud';trail.forEach(t=>t.age=9);trailClock=0;previewFinish=0;finishAge=0;}
  function effect(type,model){if(type!=='step'&&type!=='correct')return;const f=lanternFlashes.find(f=>!f.active);if(!f)return;f.active=true;f.age=0;f.group.position.set(model.x+(lanternFlashes.indexOf(f)%2?-.9:.9),.9,3.15);f.group.visible=true;}
  function update(dt,model,{running=false,paused=false,preview:previewValue=preview,player,quality='experience',reduced=false}={}){
    preview=previewValue;budget=cosmeticBudget(quality,reduced);time+=dt;
    const activeRun=running&&!paused&&!model?.finished,display=preview||running;
    root.visible=display;lanternShowcase.visible=preview;
    if(!display){finishRoot.visible=false;wasFinished=false;return;}
    const px=player.position.x,pz=player.position.z;
    lanternShowcase.position.set(px-1.25,.015,pz-.35);
    companionRoot.visible=selection.companion!=='none';companionRoot.position.set(px+1.18,(selection.companion==='sparrow'?.52:.82)+(reduced?0:Math.sin(time*2.1)*.055),pz+.45);
    companionRoot.rotation.y=running?Math.PI+.18:.35;
    if(selection.companion==='sparrow'&&!reduced)wings.forEach((wing,i)=>wing.rotation.z=(i===0?-1:1)*(.25+Math.sin(time*6)*.08));
    companionContact.visible=companionRoot.visible;companionContact.position.set(companionRoot.position.x,.02,companionRoot.position.z);companionContact.scale.setScalar(selection.companion==='cloud'?1.2:.8);
    if(running&&model.distance<lastDistance)wasFinished=false;lastDistance=model?.distance||0;
    const hasFinished=running&&model?.finished;
    if(hasFinished&&!wasFinished)finishAge=0;wasFinished=hasFinished;
    if(hasFinished)finishAge+=dt;
    if(preview){previewFinish+=dt;if(previewFinish>5.4)previewFinish=0;}
    const celebration=selection.finish!=='simple'&&(hasFinished&&finishAge<4.4||preview&&previewFinish>.65&&previewFinish<4.8),age=preview?Math.max(0,previewFinish-.65):finishAge;
    finishRoot.visible=celebration;
    if(celebration){
      finishRoot.position.set(px,0,pz);const count=budget.finish;
      finishPieces.forEach((piece,i)=>{piece.group.visible=i<count;piece.flower.visible=selection.finish==='flowers'||selection.finish==='festival'&&i%2===0;piece.star.visible=!piece.flower.visible;if(i>=count)return;const spread=reduced?1:Math.min(1,age/.65),angle=piece.phase+(reduced?0:age*.13),radius=1.2+(i%4)*.24;piece.group.position.set(Math.cos(angle)*radius*spread,.95+(i%6)*.22+(reduced?0:Math.sin(age*1.2+piece.phase)*.12),Math.sin(angle)*radius*.5);piece.group.rotation.set(.05,Math.sin(piece.phase)*.45,reduced?0:age*.25+piece.phase);piece.group.scale.setScalar(reduced?.82:Math.min(1,age/.35)*Math.min(1,(4.4-age)/.75));});
      festivalLanterns.forEach((lantern,i)=>{lantern.visible=selection.finish==='festival';if(!lantern.visible)return;lantern.position.set((i-1.5)*.82,2.55+(i%2)*.15+(reduced?0:Math.sin(age+i)*.07),-.35);});
    }
    if(selection.trail!=='none'&&(activeRun||preview)){
      if(reduced){trail.forEach((p,i)=>{p.age=i<budget.trail?.25:9;p.x=px+(i%2?-.20:.20);p.z=pz+.6+Math.floor(i/2)*.38;p.y=.045;p.side=i%2?1:-1;p.phase=i;});}
      else{trailClock+=dt;while(trailClock>.13){trailClock-=.13;const p=trail[trailIndex++%budget.trail];p.age=0;p.x=px+(trailIndex%2?-.19:.19);p.z=pz+.5;p.y=selection.trail==='footprints'?.025:.07;p.side=trailIndex%2?1:-1;p.phase=trailIndex*.73;}}
    }
    activeTrail=0;
    const m=trailMeshes[selection.trail];if(m){for(let i=0;i<trail.length;i++){const p=trail[i];if(!reduced)p.age+=dt;const alive=p.age<1.6&&i<budget.trail;dummy.position.set(p.x,p.y+(selection.trail==='footprints'||reduced?0:Math.sin(p.age*2+p.phase)*.07+p.age*.10),p.z+(reduced?0:p.age*2.2));const fade=alive?Math.min(1,(1.6-p.age)/.4):0;
      if(selection.trail==='petals'){dummy.scale.set(.10*fade,.028*fade,.066*fade);dummy.rotation.set(.3,p.phase+p.age,.25*Math.sin(p.phase));}
      else if(selection.trail==='starlight'){dummy.scale.setScalar(.08*fade);dummy.rotation.set(-Math.PI/2,p.phase+p.age*.4,0);}
      else{dummy.scale.set(.064*fade,.012*fade,.11*fade);dummy.rotation.set(0,p.side*.13,0);}
      dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);if(alive)activeTrail++;}m.instanceMatrix.needsUpdate=true;}
    for(let i=0;i<lanternFlashes.length;i++){const f=lanternFlashes[i];if(!f.active)continue;f.age+=dt;f.group.visible=i<budget.lantern&&f.age<1.2;f.group.position.y=.9+(reduced?0:f.age*.75);f.group.scale.setScalar(Math.min(1,(1.2-f.age)/.30));if(f.age>=1.2){f.active=false;f.group.visible=false;}}
  }
  applySelection(selection);
  return {setSelection:applySelection,setPreview(value){preview=!!value;previewFinish=0;},makeLantern,effect,update,sharedGeometries:[ballGeo,cylinderGeo,petalGeo,starGeo],sharedMaterials:[glowMat],get info(){return {selection:{...selection},preview,activeTrail,trailCapacity:24,finishCapacity:28,budget:{...budget},companionVisible:root.visible&&companionRoot.visible,finishVisible:root.visible&&finishRoot.visible,finishAge,lanternFlashes:lanternFlashes.filter(f=>f.active).length};}};
}
