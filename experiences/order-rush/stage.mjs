import * as THREE from './vendor/three.module.js';

const ink=0x192334, coral=0xbd5147, blue=0x456cb7;
export class CafeStage {
 constructor(canvas,onSelect){
  this.canvas=canvas;this.onSelect=onSelect;this.time=0;this.pourUntil=0;this.cups=[];this.active=0;
  this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.2;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xedf2f9);
  this.camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,40);this.camera.position.set(6,7.8,10);this.camera.lookAt(0,0,0);
  this.scene.add(new THREE.HemisphereLight(0xffffff,0x6d7e9d,2.5));
  const sun=new THREE.DirectionalLight(0xfffaf3,4);sun.position.set(-5,9,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-6;sun.shadow.camera.right=6;sun.shadow.camera.top=5;sun.shadow.camera.bottom=-5;sun.shadow.normalBias=.03;this.scene.add(sun);
  this.materials={white:this.mat(0xf9fbff),ink:this.mat(ink),coral:this.mat(coral),blue:this.mat(blue),metal:this.mat(0xc9d4e2,.25,.7),wood:this.mat(0xb89378),glass:new THREE.MeshPhysicalMaterial({color:0xddecfa,transparent:true,opacity:.25,roughness:.13,metalness:.03,side:THREE.DoubleSide,depthWrite:false}),ice:new THREE.MeshPhysicalMaterial({color:0xdbf5ff,transparent:true,opacity:.68,roughness:.15,metalness:.04}),steam:new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.32,depthWrite:false})};
  const floor=this.box(12,.12,9,this.mat(0xe6edf7),0,-.75,0);floor.receiveShadow=true;
  const table=this.roundBox(6.6,.36,4.1,.24,this.materials.white,0,-.35,0);table.receiveShadow=true;
  for(const x of [-2.7,2.7])for(const z of [-1.4,1.4])this.box(.22,.25,.22,this.materials.ink,x,-.6,z);
  this.roundBox(1.55,1.25,.85,.12,this.materials.coral,-2.1,.46,-1.12);
  this.roundBox(1.25,.14,1.05,.08,this.materials.metal,-2.1,-.04,-1.02);
  this.box(1.25,.14,.16,this.materials.ink,-2.1,.96,-.6);
  for(const x of [-2.5,-1.8]){this.cylinder(.15,.15,.22,this.materials.metal,x,.7,-.6);this.box(.35,.08,.1,this.materials.ink,x+.14,.62,-.48);}
  for(const x of [-2.48,-2.1,-1.72]){this.cylinder(.08,.08,.035,this.materials.white,x,.49,-.665,Math.PI/2);}
  this.roundBox(1.13,1.6,.85,.13,this.materials.blue,2.12,.58,-1.16);
  this.box(.85,.015,.02,this.materials.metal,2.12,.75,-.719);this.box(.06,.48,.06,this.materials.metal,2.49,.28,-.68);
  this.cylinder(.16,.16,.58,this.materials.white,1.05,.18,-1.04);this.cylinder(.09,.09,.17,this.materials.blue,1.05,.56,-1.04);
  this.cylinder(.24,.24,.37,this.mat(0xe0b792),-.8,.08,-1.17);this.cylinder(.25,.25,.05,this.materials.wood,-.8,.29,-1.17);
  this.roundBox(2.8,.075,1.7,.18,this.mat(0xd4deee),0,-.13,.48);
  this.roundBox(2.6,.025,1.5,.16,this.materials.white,0,-.08,.48);
  // A small planter and tangible ingredient containers give the counter depth.
  this.cylinder(.24,.18,.4,this.materials.coral,-3,.14,-1.2);
  for(let i=0;i<6;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),this.mat(i%2?0x4d775b:0x779976));leaf.scale.set(.5,1.7,.65);leaf.position.set(-3+Math.sin(i*2)*.13,.58+Math.cos(i)*.1,-1.2+Math.cos(i*2)*.12);leaf.rotation.z=Math.sin(i)*.5;this.scene.add(leaf);}
  this.pour=new THREE.Mesh(new THREE.CylinderGeometry(.035,.06,1.6,12),this.mat(0x714732));this.pour.visible=false;this.scene.add(this.pour);
  this.cupGroup=new THREE.Group();this.scene.add(this.cupGroup);
  this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();
  this.click=e=>{const r=canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects(this.cupGroup.children,true).find(h=>h.object.userData.cup!==undefined);if(hit)this.onSelect(hit.object.userData.cup);};canvas.addEventListener('pointerdown',this.click);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas.parentElement);this.resize();
 }
 mat(color,roughness=.55,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
 box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;this.scene.add(m);return m;}
 roundBox(w,h,d,r,mat,x,y,z){const s=new THREE.Shape();s.moveTo(-w/2+r,-d/2);s.lineTo(w/2-r,-d/2);s.quadraticCurveTo(w/2,-d/2,w/2,-d/2+r);s.lineTo(w/2,d/2-r);s.quadraticCurveTo(w/2,d/2,w/2-r,d/2);s.lineTo(-w/2+r,d/2);s.quadraticCurveTo(-w/2,d/2,-w/2,d/2-r);s.lineTo(-w/2,-d/2+r);s.quadraticCurveTo(-w/2,-d/2,-w/2+r,-d/2);const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:8});g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,mat);m.position.set(x,y-h/2,z);m.castShadow=true;m.receiveShadow=true;this.scene.add(m);return m;}
 cylinder(top,bottom,h,mat,x,y,z,rx=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,32),mat);m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=true;m.receiveShadow=true;this.scene.add(m);return m;}
 resize(){const {width,height}=this.canvas.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height,false);const aspect=width/height,vertical=aspect<1.4?3.25:2.65;this.camera.left=-vertical*aspect;this.camera.right=vertical*aspect;this.camera.top=vertical;this.camera.bottom=-vertical;this.camera.updateProjectionMatrix();this.render(0);}
 sync(cups,active,animate=false){
  for(const g of [...this.cupGroup.children]){g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.userData.ownMaterial)o.material.dispose();});this.cupGroup.remove(g);}
  this.cups=cups.map(c=>({...c}));this.active=active;
  cups.forEach((c,i)=>{
   const group=new THREE.Group();group.position.set(cups.length===1?0:i===0?-.65:.65,0,.55);this.cupGroup.add(group);
   const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.userData.cup=i;group.add(mesh);return mesh;};
   const ring=add(new THREE.TorusGeometry(.48,.022,8,48),i===active?this.materials.blue:this.materials.metal,0,-.026,0);ring.rotation.x=Math.PI/2;
   add(new THREE.CylinderGeometry(.35,.29,.74,40,1,true),this.materials.glass,0,.34,0);
   add(new THREE.CylinderGeometry(.29,.29,.05,32),this.materials.glass,0,-.004,0);
   const rim=add(new THREE.TorusGeometry(.35,.022,8,48),this.materials.glass,0,.71,0);rim.rotation.x=Math.PI/2;
   const handle=add(new THREE.TorusGeometry(.18,.039,10,28,Math.PI*1.6),this.materials.glass,.38,.38,0);handle.rotation.z=-Math.PI*.8;
   if(c.base){const color=c.base==='tea'?(c.milk?0xcbb382:0x9b651e):c.milk?0xc9a789:0x60372a;const liquidMat=this.mat(color,.25);const liquid=add(new THREE.CylinderGeometry(.324,.29,.53,40),liquidMat,0,.252,0);liquid.userData.ownMaterial=true;liquid.receiveShadow=true;
    if(c.milk){const foam=add(new THREE.CylinderGeometry(.325,.325,.027,40),this.materials.white,0,.53,0);foam.receiveShadow=true;}
    if(c.sugar){for(let k=0;k<2;k++){const cube=add(new THREE.BoxGeometry(.10,.10,.10),this.materials.white,-.1+k*.2,.555,-.13);cube.rotation.y=k+.4;}}
   }
   if(c.ice)for(let k=0;k<4;k++){const cube=add(new THREE.BoxGeometry(.17,.15,.17),this.materials.ice,Math.sin(k*2)*.17,.53+(k%2)*.09,Math.cos(k*2)*.15);cube.rotation.set(.15,k*.7,.12);cube.castShadow=true;cube.userData.ice=k;}
   if(c.temp==='hot'&&c.base&&!this.reduced)for(let k=0;k<4;k++){const steam=add(new THREE.SphereGeometry(.075,10,8),this.materials.steam,0,.8,0);steam.scale.set(.6,1.5,.6);steam.userData.steam=k;}
  });
  if(animate&&!this.reduced&&cups[active]?.base){this.pourUntil=this.time+.36;this.pour.material.color.setHex(cups[active].milk?0xe2c7aa:cups[active].base==='tea'?0xa57635:0x74432c);this.pour.position.set(cups.length===1?0:active===0?-.65:.65,1.45,.55);}
  this.render(0);
 }
 render(dt){this.time+=dt;this.pour.visible=this.time<this.pourUntil;this.cupGroup.traverse(o=>{if(o.userData.steam!==undefined){const t=(this.time*.5+o.userData.steam/4)%1;o.position.y=.8+t*.6;o.position.x=Math.sin(this.time+o.userData.steam)*.10;o.scale.setScalar(.4+t*.7);}});this.renderer.render(this.scene,this.camera);}
 dispose(){this.observer.disconnect();this.canvas.removeEventListener('pointerdown',this.click);this.scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.renderer.dispose();}
}

export class FlatStage {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.cups=[];this.active=0;this.observer=new ResizeObserver(()=>this.render());this.observer.observe(canvas.parentElement);}
 sync(cups,active){this.cups=cups;this.active=active;this.render();}
 render(){const r=this.canvas.getBoundingClientRect();if(!r.width)return;this.canvas.width=r.width;this.canvas.height=r.height;const ctx=this.ctx;if(!ctx)return;ctx.fillStyle='#edf2f9';ctx.fillRect(0,0,r.width,r.height);ctx.fillStyle='#fff';ctx.fillRect(r.width*.1,r.height*.3,r.width*.8,r.height*.6);this.cups.forEach((c,i)=>{const x=r.width*(this.cups.length===1?.5:i===0?.35:.65),y=r.height*.65;ctx.strokeStyle=i===this.active?'#456cb7':'#9fb0c7';ctx.lineWidth=4;ctx.strokeRect(x-32,y-55,64,86);if(c.base){ctx.fillStyle=c.base==='tea'?'#9b651e':c.milk?'#c9a789':'#60372a';ctx.fillRect(x-28,y-20,56,48);}if(c.ice){ctx.fillStyle='#c1e6ff';ctx.fillRect(x-18,y-25,15,15);ctx.fillRect(x+4,y-22,15,15);}ctx.fillStyle='#192334';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText(`컵 ${i+1}`,x,y+57);});}
 dispose(){this.observer.disconnect();}
}
