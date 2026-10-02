import * as THREE from './vendor/three.module.js';
import {ZONES} from './model.mjs';
export function createScene(host,{onAction=()=>{}}={}){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xf2f6f3);scene.fog=new THREE.Fog(0xf2f6f3,22,48);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.xr.enabled=true;
  renderer.xr.setReferenceSpaceType('local');host.replaceChildren(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(55,1,.1,80);camera.position.set(0,1.65,0);
  const rig=new THREE.Group();rig.add(camera);scene.add(rig);
  scene.add(new THREE.HemisphereLight(0xffffff,0xc4ceb9,2.4));const sun=new THREE.DirectionalLight(0xfff4de,3);sun.position.set(-9,15,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;scene.add(sun);
  const loader=new THREE.TextureLoader();const felt=loader.load('/assets/wide-cream.webp');felt.colorSpace=THREE.SRGBColorSpace;
  function material(color,texture=false){return new THREE.MeshStandardMaterial({color,roughness:.92,map:texture?felt:null});}
  const cream=material(0xfffdf6,true),wood=material(0xcda774,true),green=material(0x658e74,true),white=material(0xffffff),dark=material(0x465a4d);
  function box(w,h,d,mat,x,y,z,parent=scene){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function cylinder(r,h,mat,x,y,z,parent=scene){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.9,h,24),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
  function label(text,width=3,height=.7,color='#344f40',bg='#ffffff'){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*height/width);const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 64px SUIT, sans-serif';ctx.fillText(text,512,canvas.height/2,970);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));return mesh;
  }
  function plant(x,z,scale=1){const p=new THREE.Group();p.position.set(x,0,z);p.scale.setScalar(scale);scene.add(p);cylinder(.3,.52,cream,0,.26,0,p);cylinder(.06,.9,wood,0,.9,0,p);for(const [dx,dy,dz,s]of [[0,1.65,0,.6],[-.3,1.32,.15,.43],[.35,1.35,-.1,.45]]){const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry(s,2),green);leaf.position.set(dx,dy,dz);leaf.castShadow=true;p.add(leaf);}}
  const floor=box(50,.2,50,material(0xe9eee7,true),0,-.17,0);floor.receiveShadow=true;
  cylinder(8,.12,cream,0,-.03,-1.5);cylinder(2.1,.16,material(0xdbe4d9,true),0,.08,1.3);cylinder(1.15,.58,cream,0,.4,1.3);plant(0,1.3,1.3);
  for(const z of ZONES){const g=new THREE.Group();g.position.set(...z.position);scene.add(g);box(4.4,.16,3.8,cream,0,.05,-1.3,g);box(4.4,3.6,.18,cream,0,1.8,-3.15,g);box(.18,3.6,3.7,cream,-2.2,1.8,-1.3,g);box(.18,3.6,3.7,cream,2.2,1.8,-1.3,g);box(4.7,.23,4,material(z.color,true),0,3.7,-1.35,g);
    const sign=label(z.label,3,.6);sign.position.set(0,2.95,-3.04);g.add(sign);box(1.9,.12,.9,wood,0,1,-1.7,g);for(const x of [-.75,.75])box(.1,.95,.68,dark,x,.5,-1.7,g);const sheet=box(.55,.02,.34,white,.3,1.08,-1.62,g);sheet.rotation.y=.12;box(.3,.28,.03,material(z.color),-.55,1.18,-1.83,g);
    if(z.id==='seminar'){for(const x of [-1,1]){box(.62,.12,.65,material(z.color,true),x,.5,-.35,g);box(.62,.7,.1,material(z.color,true),x,.82,0,g);}}
    if(z.id==='career'){box(1.1,1.8,.26,wood,-1.4,.9,-2.85,g);for(let j=0;j<9;j++)box(.07,.33,.2,material([0x8dafa0,0xe2ba63,0x7594c6][j%3]),-1.82+j*.1,1.3,-2.68,g);}
    plant(z.position[0]-2.65,z.position[2]-.8,.8);
  }
  for(const [x,z,s]of [[-11,-9,2],[10,-9,2.3],[-10,5,1.8],[10,6,1.7],[-3,-12,2],[4,-13,2.4]])plant(x,z,s);
  for(let i=0;i<7;i++)box(1.2,.03,.6,cream,0,.01,3.4+i*.83);
  const welcome=label('SYNK / 첫날의 연습',3.4,.6);welcome.position.set(0,1.1,4.5);welcome.rotation.y=Math.PI;scene.add(welcome);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),tempMatrix=new THREE.Matrix4();const vrPanel=new THREE.Group();scene.add(vrPanel);let targets=[],zone=ZONES[0],yaw=0,pitch=0,drag=null,baseYaw=0;
  function move(id){zone=ZONES.find(z=>z.id===id)||ZONES[0];rig.position.set(zone.position[0],0,zone.position[2]+3.2);rig.rotation.y=0;camera.rotation.set(0,0,0);yaw=baseYaw=0;pitch=0;positionPanel();}
  function look(){if(!renderer.xr.isPresenting)camera.rotation.set(pitch,yaw,0,'YXZ');}
  function positionPanel(){vrPanel.position.set(zone.position[0],1.65,zone.position[2]+.9);vrPanel.rotation.set(0,0,0);}
  function disposeMesh(o){o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m?.map?.dispose();m?.dispose();}}
  function vrCard(lines,width,height,action,color='#ffffff'){
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=Math.round(1200*height/width);const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#172f21';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${action?'650':'700'} 43px SUIT,sans-serif`;
    const wrapped=[];for(const line of lines){let current='';for(const word of line.split(' ')){if(ctx.measureText(current+' '+word).width>1120&&current){wrapped.push(current);current=word;}else current+=(current?' ':'')+word;}wrapped.push(current);}
    wrapped.forEach((line,i)=>ctx.fillText(line,600,canvas.height/2+(i-(wrapped.length-1)/2)*57));
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const o=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:false}));if(action){o.userData.action=action;targets.push(o);}vrPanel.add(o);return o;
  }
  function setPanel({title,prompt,choices=[],footer='',next=false,done=false}){
    vrPanel.children.forEach(disposeMesh);vrPanel.clear();targets=[];
    vrCard([title,prompt],2.6,.75,null).position.y=.52;
    choices.forEach((text,i)=>{vrCard([`${i+1}. ${text}`],2.6,.32,{type:'answer',index:i},'#f7efe0').position.y=-.13-i*.37;});
    if(footer)vrCard([footer],2.6,.4,null,'#e9f0e8').position.y=choices.length? -1.42:-.08;
    if(next||done)vrCard([done?'이 장소 다시 연습':'다음 상황 →'],2.6,.3,{type:done?'retry':'next'},'#fbb7a3').position.y=-.7;
    ZONES.forEach((z,i)=>{const o=vrCard([z.label],.84,.28,{type:'zone',id:z.id},'#e7eee7');o.position.set((i-1)*.88,1.13,0);});
    if(choices.length)vrCard(['생각할 단서'],.8,.3,{type:'hint'},'#e9f0e8').position.set(1.82,.72,0);
    vrCard(['VR 나가기'],.8,.23,{type:'exit'},'#ffffff').position.set(1.82,1.1,0);
    positionPanel();vrPanel.visible=renderer.xr.isPresenting;
  }
  const controllers=[];for(let i=0;i<2;i++){const controller=renderer.xr.getController(i);rig.add(controller);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0x416452}));line.scale.z=5;controller.add(line);controller.addEventListener('select',()=>{tempMatrix.identity().extractRotation(controller.matrixWorld);ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);ray.ray.direction.set(0,0,-1).applyMatrix4(tempMatrix);const hit=ray.intersectObjects(targets,false)[0];if(hit)onAction(hit.object.userData.action);});controllers.push(controller);}
  renderer.xr.addEventListener('sessionstart',()=>{vrPanel.visible=true;camera.rotation.set(0,0,0);positionPanel();});renderer.xr.addEventListener('sessionend',()=>{vrPanel.visible=false;move(zone.id);});
  const down=e=>{if(renderer.xr.isPresenting)return;drag={x:e.clientX,y:e.clientY,yaw,pitch,id:e.pointerId};};
  const dragMove=e=>{if(!drag||drag.id!==e.pointerId)return;yaw=drag.yaw-(e.clientX-drag.x)*.004;pitch=Math.max(-.5,Math.min(.55,drag.pitch-(e.clientY-drag.y)*.002));look();};
  const up=()=>{drag=null;};const key=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')yaw+=.12;if(e.key==='ArrowRight')yaw-=.12;if(e.key==='ArrowUp')pitch=Math.min(.55,pitch+.08);if(e.key==='ArrowDown')pitch=Math.max(-.5,pitch-.08);look();}};
  host.addEventListener('pointerdown',down);host.addEventListener('pointermove',dragMove);host.addEventListener('pointerup',up);host.addEventListener('pointercancel',up);host.addEventListener('pointerleave',up);host.addEventListener('keydown',key);
  const resize=()=>{const {width,height}=host.getBoundingClientRect();camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);};const observer=new ResizeObserver(resize);observer.observe(host);resize();move('welcome');
  renderer.setAnimationLoop(()=>{renderer.render(scene,camera);});
  return {renderer,move,setPanel,reset:()=>{yaw=baseYaw;pitch=0;look();},dispose(){observer.disconnect();renderer.setAnimationLoop(null);host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',dragMove);host.removeEventListener('pointerup',up);host.removeEventListener('pointercancel',up);host.removeEventListener('pointerleave',up);host.removeEventListener('keydown',key);scene.traverse(o=>{o.geometry?.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms)m?.dispose();});felt.dispose();renderer.dispose();},get scene(){return scene;}};
}

