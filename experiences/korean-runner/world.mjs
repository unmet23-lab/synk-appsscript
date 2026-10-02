import * as T from './vendor/three.module.js';
import {LANES} from './core.mjs';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {createCosmeticLayer,normalizeCosmetics,SCENERY_THEMES} from './world-cosmetics.mjs';
import {createSceneryDetails} from './scenery-details.mjs';

const C={coral:0xFD9C87,blue:0x6488B6,green:0x87A98C,yellow:0xF4CF86,wood:0xA38369,roof:0x477185,white:0xFFFFFF};
const lerp=T.MathUtils.lerp;
export async function createWorld(canvas,{quality='experience',reduced=false}={}){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();scene.fog=new T.Fog(0xD2E8EB,145,350);
  const camera=new T.PerspectiveCamera(48,1,.1,550);
  const clock={value:0};let mode=quality,motion=reduced,frame=0,totalFrame=0,last=performance.now(),fps=60;
  const textures=new T.TextureLoader();
  const wool=await textures.loadAsync('./assets/felt.webp');wool.wrapS=wool.wrapT=T.RepeatWrapping;wool.colorSpace=T.SRGBColorSpace;wool.repeat.set(2,2);wool.anisotropy=4;
  const bump=wool.clone();bump.colorSpace=T.NoColorSpace;bump.needsUpdate=true;
  const materials=new Map(),objects=new Map(),labelMaterials=new Map();
  const geometries={ball:new T.SphereGeometry(1,20,14),box:new T.BoxGeometry(1,1,1),cylinder:new T.CylinderGeometry(1,1,1,12),cone:new T.ConeGeometry(1,1,12)};
  function felt(color){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.94,bumpMap:bump,bumpScale:.055,map:wool,side:T.DoubleSide}));return materials.get(color);}
  function plain(color,roughness=.7){return new T.MeshStandardMaterial({color,roughness});}
  const sceneryMaterials=new Map();
  function sceneryFelt(color){if(!sceneryMaterials.has(color))sceneryMaterials.set(color,felt(color).clone());return sceneryMaterials.get(color);}
  const metal=plain(0xE9BF72,.33),dark=plain(0x284555,.36),glass=new T.MeshPhysicalMaterial({color:0x8ABCCB,roughness:.13,metalness:.2,transparent:true,opacity:.8});
  function mesh(g,m,p,s,parent=scene){const a=new T.Mesh(g,m);a.position.set(...p);if(s)a.scale.set(...s);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;}
  const box=(p,s,c,parent=scene)=>mesh(geometries.box,typeof c==='number'?felt(c):c,p,s,parent);
  const ball=(p,s,c,parent=scene)=>mesh(geometries.ball,typeof c==='number'?felt(c):c,p,s,parent);
  const cyl=(p,s,c,parent=scene)=>mesh(geometries.cylinder,typeof c==='number'?felt(c):c,p,s,parent);
  function texture(w,h,paint){const el=document.createElement('canvas');el.width=w;el.height=h;paint(el.getContext('2d'),w,h);const tx=new T.CanvasTexture(el);tx.colorSpace=T.SRGBColorSpace;return tx;}
  function batch(group){
    group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map(),original=[];
    group.traverse(m=>{if(!m.isMesh||Array.isArray(m.material))return;const key=m.material.uuid+':'+m.castShadow;let list=batches.get(key);if(!list){list={material:m.material,cast:m.castShadow,geo:[]};batches.set(key,list);}list.geo.push(m.geometry.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld)));original.push(m);});
    for(const m of original)m.parent.remove(m);
    for(const b of batches.values()){const geo=mergeGeometries(b.geo,false);b.geo.forEach(g=>g.dispose());if(geo){const m=new T.Mesh(geo,b.material);m.castShadow=b.cast;m.receiveShadow=true;group.add(m);}}
  }

  // A broad sky, distant layered mountains, and directional sunlight establish depth.
  const skies=new Map();
  function makeSky(theme){return texture(2048,1024,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,theme.sky[0]);g.addColorStop(.43,theme.sky[1]);g.addColorStop(.66,theme.sky[2]);g.addColorStop(1,theme.sky[3]);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    for(let i=0;i<24;i++){const x=(i*193)%w,y=190+(i*87)%290;ctx.fillStyle='rgba(255,255,255,.20)';ctx.beginPath();ctx.ellipse(x,y,85+i%5*17,11+i%4*5,0,0,Math.PI*2);ctx.fill();}
    if(theme===SCENERY_THEMES.moonlight)for(let i=0;i<65;i++){ctx.fillStyle='rgba(255,242,206,.70)';ctx.beginPath();ctx.arc((i*173.3)%w,70+(i*81.7)%(h*.48),i%7===0?1.8:1.1,0,Math.PI*2);ctx.fill();}
  });}
  const skyTexture=makeSky(SCENERY_THEMES.village);skies.set('village',skyTexture);
  const sky=mesh(new T.SphereGeometry(450,32,18),new T.MeshBasicMaterial({map:skyTexture,side:T.BackSide,toneMapped:false}),[0,0,0],null);sky.castShadow=sky.receiveShadow=false;
  const hemisphere=new T.HemisphereLight(0xE0F1FF,0xA78C77,1.7);scene.add(hemisphere);
  const sun=new T.DirectionalLight(0xFFF0D4,2.9);sun.position.set(-23,33,-35);sun.target.position.set(0,0,-35);scene.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.camera.left=-26;sun.shadow.camera.right=26;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.camera.near=.5;sun.shadow.camera.far=120;sun.shadow.normalBias=.06;sun.shadow.bias=-.0002;
  const sunDisc=mesh(new T.SphereGeometry(11,24,16),new T.MeshBasicMaterial({color:0xFFE9BD,toneMapped:false}),[-65,59,-210]);sunDisc.castShadow=false;
  for(let layer=0;layer<3;layer++){
    const points=[],indices=[],count=37,z=-190-layer*53;
    for(let i=0;i<count;i++){
      const x=-290+i*580/(count-1),height=14+layer*9+Math.sin(i*.72+layer)*8+Math.sin(i*.28+1.8)*12;
      points.push(x,-8,z,x,height,z);
      if(i<count-1){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();
    const mountain=mesh(geo,new T.MeshBasicMaterial({color:[0x91B0B9,0xACC2C9,0xC3D3D4][layer],side:T.DoubleSide}),[0,0,0]);mountain.castShadow=false;
  }
  // Long mirrored river strips are shader-driven; highlights follow one sun direction.
  const waterMat=new T.ShaderMaterial({uniforms:{time:clock},vertexShader:'varying vec3 vP;void main(){vec4 p=modelMatrix*vec4(position,1.);vP=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:`
    uniform float time;varying vec3 vP;
    void main(){vec2 p=vP.xz;vec3 n=normalize(vec3(sin(p.x*.55+p.y*.2+time*.7)*.06,1.,cos(p.x*.2-p.y*.62-time*.5)*.06));vec3 v=normalize(cameraPosition-vP);float fres=pow(1.-max(0.,dot(v,n)),3.);vec3 col=mix(vec3(.26,.57,.59),vec3(.7,.82,.79),fres);float sparkle=pow(max(0.,dot(reflect(normalize(vec3(.4,-.7,.6)),n),v)),48.);col+=vec3(1.,.9,.67)*sparkle*.6;float lines=sin(p.x*.9+p.y*.6+time)*sin(p.x*.3-p.y*1.1);col+=lines*.016;float haze=smoothstep(45.,240.,length(cameraPosition-vP));col=mix(col,vec3(.77,.87,.86),haze);gl_FragColor=vec4(col,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`});
  const water=mesh(new T.PlaneGeometry(700,500),waterMat,[0,-1.1,-190]);water.rotation.x=-Math.PI/2;water.castShadow=false;water.receiveShadow=false;

  const groundMaterial=sceneryFelt(0x91AE95),bankMaterial=sceneryFelt(0x8EAA93);
  const ground=box([0,-.6,-120],[24,1,290],groundMaterial);ground.castShadow=false;
  for(const side of [-1,1]){
    box([side*17,-.26,-120],[10,.05,290],waterMat).castShadow=false;
    box([side*49,-.6,-120],[54,1,290],bankMaterial).castShadow=false;
    box([side*12.15,-.26,-120],[.3,.4,290],0xA8B9A4).castShadow=false;
  }
  const roadMat=felt(0xD4D6CA).clone(),edgeMat=felt(0xA5B6AE),markMat=felt(0xFFFFFF);
  const tiles=[];
  for(let i=0;i<32;i++){
    const group=new T.Group();scene.add(group);group.userData.base=i*8;
    box([0,-.14,0],[8.5,.25,7.93],roadMat,group).castShadow=false;
    for(const side of [-1,1]){
      box([side*4.45,-.03,0],[.45,.35,8],edgeMat,group);
      box([side*1.175,.007,0],[.045,.012,1.7],markMat,group).castShadow=false;
      box([side*4.06,.006,0],[.045,.01,7.8],markMat,group).castShadow=false;
    }
    batch(group);tiles.push(group);
  }
  // Scenery tiles recycle behind the camera: no growing object list during long runs.
  const scenery=[];
  function roof(parent,width=5,depth=4,color=C.roof){
    const geo=new T.BufferGeometry(),p=[],uv=[],idx=[],nx=20;
    for(let j=0;j<=1;j++)for(let i=0;i<=nx;i++){
      const x=(i/nx-.5)*width,y=.95*Math.pow(1-Math.abs(x)/(width/2),.78)+.22*Math.pow(Math.abs(x)/(width/2),10);
      p.push(x,y,(j-.5)*depth);uv.push(i/nx*3,j*2);
    }
    for(let i=0;i<nx;i++){const a=i,b=i+nx+1;idx.push(a,b,a+1,a+1,b,b+1);}
    geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
    const r=mesh(geo,sceneryFelt(color),[0,3.0,0],null,parent);
    for(let i=0;i<11;i++){const x=(i/10-.5)*width,y=.95*Math.pow(1-Math.abs(x)/(width/2),.78)+.22*Math.pow(Math.abs(x)/(width/2),10);const ridge=cyl([x,3.04+y,0],[.034,depth,.034],sceneryFelt(color),parent);ridge.rotation.x=Math.PI/2;}
    return r;
  }
  function hanok(parent,side,i){
    const h=new T.Group();parent.add(h);h.position.set(side*(8.6+(i%3)*1.0),0,-2);h.rotation.y=side*.08;
    box([0,1.35,0],[4.0,2.6,3.3],i%3===0?0xF1D5C7:0xEEECE0,h);
    box([0,.16,0],[4.7,.3,3.9],0xC2B5A2,h);roof(h,5.1,4.3,i%3===0?0x648B99:C.roof);
    for(const x of [-1.76,0,1.76])box([x,1.4,1.69],[.16,2.6,.15],C.wood,h);
    for(const x of [-.85,.85]){box([x,1.32,1.67],[1.18,1.6,.06],0xF9E4B6,h);for(let j=0;j<3;j++)box([x-.36+j*.36,1.32,1.72],[.035,1.5,.04],C.wood,h);for(let j=0;j<4;j++)box([x,.72+j*.39,1.73],[1.14,.035,.04],C.wood,h);}
    box([0,2.92,1.75],[4.2,.15,.2],C.wood,h);
    const sign=label(i%3===0?'꽃집':i%3===1?'책방':'차 한 잔',0x335665);mesh(new T.PlaneGeometry(1.2,.42),sign,[0,2.61,1.78],null,h).castShadow=false;
    for(const x of [-2.3,2.3]){cyl([x,.25,2.05],[.34,.5,.34],0xB79778,h);ball([x,.68,2.05],[.45,.48,.45],C.green,h);}
    return h;
  }
  function tree(parent,x,z,variant){
    const g=new T.Group();parent.add(g);g.position.set(x,0,z);
    const trunk=cyl([0,1.3,0],[.17,2.6,.17],C.wood,g);trunk.rotation.z=x>0?-.08:.08;
    const palette=variant?[0xEBC2BB,0xF4D2C3,0xE5AEA7]:[0x80A98A,0x93B799,0xA3C3A4];
    for(let k=0;k<5;k++)ball([Math.sin(k*2.4)*.72,2.8+Math.cos(k*1.7)*.38,Math.cos(k*2.4)*.65],[1.1,1.05,1.05],sceneryFelt(palette[k%3]),g);
    return g;
  }
  function lamp(parent,x,z){cyl([x,1.5,z],[.055,3,.055],C.wood,parent);const cap=box([x,3.15,z],[.75,.1,.66],C.roof,parent);cap.rotation.z=.02;ball([x,2.84,z],[.32,.36,.28],new T.MeshStandardMaterial({color:0xFFE3AA,emissive:0xE9AB63,emissiveIntensity:.14,roughness:.8}),parent);}
  for(let i=0;i<10;i++){
    const g=new T.Group();scene.add(g);g.userData.base=i*25;
    for(const side of [-1,1]){
      hanok(g,side,i+(side===1?1:0));tree(g,side*7.1,-11,i%3!==2);tree(g,side*(25+(i%2)*3),-5,false);
      lamp(g,side*5.05,-8);
      // Small flower beds and stone paths lead from the course into the village.
      box([side*6.1,-.015,1],[2.7,.15,2.6],0xBDC8B7,g);
      for(let k=0;k<4;k++)ball([side*(5.4+k*.27),.18,3.7],[.17,.2,.17],k%2?C.yellow:0xDCAFAF,g);
      for(let k=0;k<6;k++){
        const stem=cyl([side*(5.3+(k%3)*.27),.23,-4.2-Math.floor(k/3)*.35],[.016,.43,.016],0x78966E,g);stem.castShadow=false;
        ball([stem.position.x,.46,stem.position.z],[.12,.08,.12],k%2?0xF4CF86:0xE0AAB3,g).castShadow=false;
      }
    }
    if(i%3===0){
      const arch=new T.Group();arch.position.z=-16;g.add(arch);
      for(const side of [-1,1]){box([side*4.7,2.65,0],[.2,5.3,.22],C.wood,arch);box([side*4.7,4.5,0],[.6,.12,.55],C.roof,arch);}
      const ropePoints=[];for(let k=0;k<=20;k++)ropePoints.push(new T.Vector3(-4.7+k*.47,5.0-Math.sin(k/20*Math.PI)*.65,0));
      mesh(new T.TubeGeometry(new T.CatmullRomCurve3(ropePoints),32,.021,5,false),felt(C.wood),[0,0,0],null,arch);
      for(let k=0;k<7;k++){const x=-3.5+k*1.16,y=4.98-Math.sin((x+4.7)/9.4*Math.PI)*.65;cyl([x,y-.15,0],[.015,.3,.015],C.wood,arch);ball([x,y-.47,0],[.24,.29,.24],k%2?C.coral:C.yellow,arch);cyl([x,y-.78,0],[.04,.22,.04],C.wood,arch);}
    }
    batch(g);scenery.push(g);
  }
  // Decorative future Korean skyline remains in the far distance.
  const pagoda=new T.Group();pagoda.position.set(23,0,-155);scene.add(pagoda);
  for(let i=0;i<4;i++){box([0,2+i*3.0,0],[3.5-i*.45,2.8,3.5-i*.45],0xE3E0CE,pagoda);const g=new T.Group();g.position.y=2+i*3;pagoda.add(g);roof(g,5.6-i*.55,5.1-i*.55,C.roof);}
  cyl([-29,13,-205],[.6,26,.6],0xD4DEE0);ball([-29,27,-205],[2.8,1.1,2.8],0xB2CACC);cyl([-29,31,-205],[.08,7,.08],0xD4DEE0);

  function label(text,color=0x335C9D){
    const key=text+':'+color;if(labelMaterials.has(key))return labelMaterials.get(key);
    const tx=texture(512,160,(ctx,w,h)=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.font='800 66px SUIT';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.fillText(text,w/2,h/2+3);});
    const material=new T.MeshBasicMaterial({map:tx,transparent:false,side:T.DoubleSide});labelMaterials.set(key,material);return material;
  }
  // Same armless bell geometry as the existing village game, adapted to Three.js.
  const player=new T.Group(),bodyRoot=new T.Group();player.add(bodyRoot);scene.add(player);player.position.z=3;
  const p=[],uv=[],idx=[],rings=28,segments=56,height=1.38;
  for(let j=0;j<=rings;j++){const t=j/rings,y=height*(1-t),radius=.697*Math.pow(Math.sin(t*Math.PI/2),.45)*(1-.035*Math.pow(t,8));for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,lobe=Math.cos(a*7),rim=Math.pow(t,10),r=radius*(1+rim*lobe*.045);p.push(Math.cos(a)*r,y+rim*(.055+.032*lobe),Math.sin(a)*r*.88);uv.push(i/segments*2,t*2);}}
  for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;idx.push(a,a+1,b,a+1,b+1,b);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  mesh(geo,felt(C.coral),[0,0,0],null,bodyRoot);
  for(const side of [-1,1]){ball([side*.231,.911,.409],[.069,.073,.048],plain(0x261D22,.12),bodyRoot);ball([side*.231-.018,.931,.452],[.0125,.0125,.008],plain(0xFFFFFF,.2),bodyRoot);}
  const hemPath=[];for(let i=0;i<=112;i++){const a=i/112*Math.PI*2,lobe=Math.cos(a*7),r=.673*(1+lobe*.045);hemPath.push(new T.Vector3(Math.cos(a)*r,.055+.032*lobe,Math.sin(a)*r*.88));}
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hemPath),112,.012,5,false),felt(0xFBB7A3),[0,0,0],null,bodyRoot);
  const shadowTexture=texture(128,128,(ctx,w,h)=>{const g=ctx.createRadialGradient(w/2,h/2,5,w/2,h/2,62);g.addColorStop(0,'rgba(41,61,53,.34)');g.addColorStop(.5,'rgba(41,61,53,.18)');g.addColorStop(1,'rgba(41,61,53,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);});
  const contact=mesh(new T.PlaneGeometry(2.2,1.8),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}),[0,.02,3]);contact.rotation.x=-Math.PI/2;contact.castShadow=false;
  const shield=mesh(new T.SphereGeometry(1.0,32,20),new T.MeshPhysicalMaterial({color:0xAACFDE,roughness:.04,metalness:.15,transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false}),[0,.65,0],[1,1.1,1],player);shield.visible=false;shield.castShadow=false;
  const cosmetics=createCosmeticLayer({scene,felt,plain,mergeGeometries});
  const sceneryDetails=createSceneryDetails({scene,felt});
  let selection=normalizeCosmetics(),shopPreview=false,previewHeight=null,previewTop=null,previewNeedsFraming=false;
  const petalGeo=new T.SphereGeometry(1,8,6),petalMat=felt(0xFFE1D5).clone();
  const petalMesh=new T.InstancedMesh(petalGeo,petalMat,70),dummy=new T.Object3D();scene.add(petalMesh);
  const petalData=Array.from({length:70},(_,i)=>({x:Math.sin(i*19.7)*20,y:1+(i*1.77)%8,z:-((i*7.83)%100),phase:i*2.17}));
  const particles=[];
  function burst(x,y,z,color=0xF4CF86){const count=motion?3:mode==='experience'?9:5;for(let i=0;i<count&&particles.length<54;i++){const dot=ball([x,y,z],[.05,.05,.05],plain(color));dot.castShadow=false;particles.push({mesh:dot,v:new T.Vector3((Math.random()-.5)*3,1+Math.random()*2,(Math.random()-.5)*3),ttl:.6});}}
  function makeObstacle(e){
    const g=new T.Group();
    if(e.type==='barrier'){
      for(const side of [-1,1])box([side*.69,.47,0],[.14,.94,.24],0xB68E71,g);
      box([0,.78,0],[1.64,.53,.32],0xF4CF86,g);
      for(let k=0;k<3;k++){const s=box([-.48+k*.48,.78,.17],[.17,.56,.018],0xC29357,g);s.rotation.z=-.25;}
      if(!e.mission)mesh(new T.PlaneGeometry(.4,.3),label('↑',0x684922),[0,.82,.19],null,g).castShadow=false;
    }else if(e.type==='arch'){
      for(const side of [-1,1])box([side*.81,1.18,0],[.16,2.36,.26],C.wood,g);
      box([0,1.65,0],[1.95,.7,.48],C.blue,g);
      if(!e.mission)mesh(new T.PlaneGeometry(.55,.34),label('↓'),[0,1.65,.25],null,g).castShadow=false;
      cyl([-.89,2.38,0],[.13,.28,.13],C.yellow,g);cyl([.89,2.38,0],[.13,.28,.13],C.yellow,g);
    }else{
      box([0,1.12,0],[1.65,2.1,2.9],C.green,g);box([0,2.19,0],[1.75,.2,3.02],C.roof,g);
      box([0,1.56,1.46],[1.35,.69,.055],glass,g);box([0,.71,1.49],[1.7,.16,.04],0xE4CFAC,g);
      for(const s of [-1,1]){ball([s*.55,.87,1.51],[.11,.09,.06],C.yellow,g);for(const z of [-.85,.85]){const wheel=cyl([s*.77,.23,z],[.24,.13,.24],dark,g);wheel.rotation.z=Math.PI/2;}}
    }
    return g;
  }
  function makeCoin(){const g=new T.Group();const ring=mesh(new T.TorusGeometry(.24,.062,8,24),metal,[0,.85,0],null,g);const star=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.083:.18;if(i===0)star.moveTo(Math.cos(a)*r,Math.sin(a)*r);else star.lineTo(Math.cos(a)*r,Math.sin(a)*r);}mesh(new T.ExtrudeGeometry(star,{depth:.07,bevelEnabled:true,bevelThickness:.025,bevelSize:.012,bevelSegments:1}),metal,[0,.85,-.035],null,g);return g;}
  function makeMark(e){
    const root=new T.Group();
    const stripe=box([0,.021,0],[7.4,.035,.16],0xEEE4C6,root);stripe.castShadow=false;
    const glow=new T.MeshBasicMaterial({color:0xF4D393,transparent:true,opacity:.3,depthWrite:false});
    for(const x of LANES){
      const ring=mesh(new T.TorusGeometry(.55,.023,5,32),glow,[x,.037,0],null,root);ring.rotation.x=-Math.PI/2;ring.castShadow=false;
      if(e.step.action==='lane'){
        cyl([x,.21,-.4],[.10,.42,.10],C.wood,root);
        const lantern=cosmetics.makeLantern(selection.lantern);lantern.position.set(x,.67,-.4);root.add(lantern);
      }
    }
    for(const side of [-1,1]){cyl([side*4.0,.75,0],[.03,1.5,.03],C.wood,root);const lantern=cosmetics.makeLantern(selection.lantern);lantern.position.set(side*4.0,1.52,0);lantern.scale.setScalar(.56);root.add(lantern);}
    return root;
  }
  let attract=28,shake=0;
  function removeEvent(obj){
    scene.remove(obj);const shared=new Set([...materials.values(),...labelMaterials.values(),metal,dark,glass,...cosmetics.sharedMaterials]),sharedGeometry=new Set([...Object.values(geometries),...cosmetics.sharedGeometries]);
    obj.traverse(a=>{if(!a.isMesh)return;if(!sharedGeometry.has(a.geometry))a.geometry.dispose();if(!shared.has(a.material)){if(a.material.map&&a.material.map!==wool&&a.material.map!==bump)a.material.map.dispose();a.material.dispose();}});
  }
  function syncEvents(model){
    const active=new Set(model.events.filter(e=>e.d-model.distance<170&&e.d-model.distance>-8&&!e.resolved));
    for(const [e,obj] of objects){if(!active.has(e)){removeEvent(obj);objects.delete(e);}}
    for(const e of active){let g=objects.get(e);if(!g){g=e.kind==='coin'?makeCoin():e.kind==='mark'?makeMark(e):makeObstacle(e);scene.add(g);objects.set(e,g);}g.position.set(e.kind==='mark'?0:LANES[e.lane],0,3-(e.d-model.distance));if(e.kind==='coin'){g.rotation.y=clock.value*2.3;g.position.y=Math.sin(clock.value*3+e.d)*.10;}}
  }
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setPixelRatio(Math.min(devicePixelRatio,mode==='experience'?1.65:1));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function setQuality(value){mode=value;sun.shadow.mapSize.set(mode==='experience'?2048:1024,mode==='experience'?2048:1024);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}renderer.shadowMap.needsUpdate=true;resize();}
  function setCosmetics(value){
    const next=normalizeCosmetics(value),theme=SCENERY_THEMES[next.scenery];
    if(next.lantern!==selection.lantern)for(const [e,g]of objects){if(e.kind==='mark'){removeEvent(g);objects.delete(e);}}
    selection=next;cosmetics.setSelection(selection);sceneryDetails.setTheme(selection.scenery);
    if(!skies.has(selection.scenery))skies.set(selection.scenery,makeSky(theme));sky.material.map=skies.get(selection.scenery);sky.material.needsUpdate=true;
    scene.fog.color.setHex(theme.fog);hemisphere.color.setHex(theme.hemi);hemisphere.intensity=theme.ambient;sun.color.setHex(theme.sun);sun.intensity=theme.direct;sunDisc.material.color.setHex(theme.sunDisc);
    groundMaterial.color.setHex(theme.ground);bankMaterial.color.setHex(theme.ground);roadMat.color.setHex(theme.road);
    for(const color of [C.roof,0x648B99])sceneryFelt(color).color.setHex(theme.roof);
    [0x80A98A,0x93B799,0xA3C3A4,0xEBC2BB,0xF4D2C3,0xE5AEA7].forEach((color,i)=>sceneryFelt(color).color.setHex(theme.foliage[i]));
    petalMat.color.setHex(selection.scenery==='snow'?0xF6FCFC:selection.scenery==='moonlight'?0xF0DDA4:0xFFE1D5);
  }
  function setShopPreview(value,{previewHeight:height=null,previewTop:top=null}={}){shopPreview=!!value;previewHeight=height;previewTop=top;previewNeedsFraming=shopPreview;cosmetics.setPreview(shopPreview);if(!shopPreview)camera.clearViewOffset();}
  setQuality(mode);window.addEventListener('resize',resize);
  return {
    setQuality,setMotion:value=>{motion=value;},setCosmetics,setShopPreview,
    previewCosmetics(value){setCosmetics(value);if(!shopPreview)setShopPreview(true);},
    effect(type,model){cosmetics.effect(type,model);if(type==='coin')burst(model.x,.85,3);if(type==='step'||type==='correct')burst(model.x,1.0,3,{paper:0xF4CF86,flower:0xEBAFB8,firefly:0xB5DCC4}[selection.lantern]);if(type==='hit'){shake=.32;burst(model.x,.5,3,0xF96859);}if(type==='shield'||type==='earnedShield')burst(model.x,.8,3,0xAACEDE);if(type==='land')burst(model.x,.035,3,0xD4D6CA);},
    render(dt,model,{running=false,paused=false,shopPreview:previewValue=shopPreview}={}){
      if(previewValue!==shopPreview)setShopPreview(previewValue);
      clock.value+=dt;frame++;totalFrame++;const now=performance.now();if(now-last>1000){fps=Math.round(frame*1000/(now-last));frame=0;last=now;}
      if(!running)attract+=dt*2.0;
      const distance=running?model.distance:attract;
      for(const g of tiles)g.position.z=14-((g.userData.base+distance)%256);
      for(const g of scenery)g.position.z=16-((g.userData.base+distance)%250);
      sceneryDetails.update(distance,{quality:mode,reduced:motion});
      if(running)syncEvents(model);else if(objects.size){for(const [,g]of objects)removeEvent(g);objects.clear();}
      const mobile=canvas.clientWidth<700;
      const shopArea=mobile?{top:previewTop??(canvas.clientHeight<=700?70:80),height:previewHeight??(canvas.clientHeight<=700?155:200)}:null;
      // The mobile caption and reset button occupy the lower 60px of this small window.
      // Fit the whole 3m celebration, lantern and companion into the remaining upper area.
      const shopSafeHeight=shopArea?Math.max(40,shopArea.height-60):0;
      const shopDistance=shopArea?canvas.clientHeight*3.4/(2*Math.tan(43*Math.PI/360)*shopSafeHeight):0;
      const targetCam=shopPreview?mobile?new T.Vector3(0,1.45+shopDistance*.10,-2+shopDistance):new T.Vector3(0,3.5,9):running?new T.Vector3(model.x*.23,5.25,11.8):mobile?new T.Vector3(5.5,6.2,13):new T.Vector3(8.2,7.8,16.3);
      const cameraTarget=shopPreview?new T.Vector3(0,mobile?1.45:.95,-2):running?new T.Vector3(model.x*.14,1.05,-15):mobile?new T.Vector3(0,-1,-8):new T.Vector3(-3.8,1.3,-17);
      if(shopPreview&&mobile&&previewNeedsFraming){camera.position.copy(targetCam);camera.fov=43;}previewNeedsFraming=false;
      camera.position.lerp(targetCam,1-Math.exp(-dt*3.5));
      if(shake>0){shake-=dt;if(!motion){camera.position.x+=Math.sin(clock.value*75)*shake*.3;camera.position.y+=Math.cos(clock.value*64)*shake*.16;}}
      camera.lookAt(cameraTarget);
      const portraitFov=Math.max(48,Math.min(74,2*Math.atan(.29/camera.aspect)*180/Math.PI));
      const fov=shopPreview?mobile?43:42:running?mobile?portraitFov:48:mobile?44:46;camera.fov=lerp(camera.fov,fov,1-Math.exp(-dt*3));
      if(shopPreview){const w=canvas.clientWidth,h=canvas.clientHeight,centerY=mobile?(shopArea.top+shopSafeHeight*.5)/h:.45;camera.setViewOffset(w,h,mobile?0:w*.20,h*(.5-centerY),w,h);}else if(camera.view?.enabled)camera.clearViewOffset();camera.updateProjectionMatrix();
      player.position.x=shopPreview?0:running?model.x:mobile?1.5:2.1;player.position.y=running&&!shopPreview?model.y+.03:.03;player.position.z=shopPreview?-2:running?3:mobile?-8:-3;player.scale.setScalar(shopPreview?mobile?1.0:1.35:!running&&mobile?1.4:1);
      const speed=running?(paused?0:model.speed||14):9;
      const sway=Math.sin(clock.value*speed*1.15)*.058;
      bodyRoot.rotation.z=running?-((LANES[model.lane]-model.x)*.1)+sway:sway;
      // Turning is strongest at the menu, keeping the original face visible without a new design.
      bodyRoot.rotation.y=running?Math.PI+.18+Math.sin(clock.value*2)*.04:.38;
      const squash=running&&model.slide>0?.43:1;
      bodyRoot.scale.set(1+(1-squash)*.38,squash,1+(1-squash)*.20);
      if((!running||model.y===0)&&squash===1)bodyRoot.position.y=Math.abs(Math.sin(clock.value*speed*1.15))*.10;
      else bodyRoot.position.y=0;
      player.visible=!(running&&model.invincible>0&&Math.sin(clock.value*32)<-.25);
      shield.visible=running&&model.shield>0;shield.rotation.y=clock.value*.3;
      contact.position.x=player.position.x;contact.position.z=player.position.z;contact.material.opacity=1-Math.min(.7,player.position.y*.25);contact.scale.setScalar(1+player.position.y*.15);
      const ambientCount=motion?0:mode==='experience'?selection.scenery==='moonlight'?24:70:30;petalMesh.count=ambientCount;
      for(let i=0;i<ambientCount;i++){const a=petalData[i],t=clock.value,x=Math.abs(a.x)<4?(a.x<0?-1:1)*(5+Math.abs(a.x)):a.x;dummy.position.set(x+Math.sin(t*.65+a.phase)*1.0,selection.scenery==='snow'?((a.y+9-t*.32)%9+9)%9:a.y-Math.sin(t*.32+a.phase)*1.8,12-((-a.z+distance*.55+t*1.3)%110));dummy.rotation.set(t*.6+a.phase,t*.3,Math.sin(t+a.phase));dummy.scale.set(selection.scenery==='snow'?.045:.085,selection.scenery==='snow'?.045:.019,selection.scenery==='snow'?.045:.051);dummy.updateMatrix();petalMesh.setMatrixAt(i,dummy.matrix);}petalMesh.instanceMatrix.needsUpdate=true;
      cosmetics.update(dt,model,{running,paused,preview:shopPreview,player,quality:mode,reduced:motion});
      for(let i=particles.length-1;i>=0;i--){const a=particles[i];a.ttl-=dt;a.mesh.position.addScaledVector(a.v,dt);a.v.y-=dt*5;a.mesh.scale.setScalar(Math.max(0,a.ttl)*.09);if(a.ttl<=0){scene.remove(a.mesh);a.mesh.material.dispose();particles.splice(i,1);}}
      renderer.render(scene,camera);
    },
    get info(){return {renderer:'Three.js '+T.REVISION,quality:mode,fps,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,width:canvas.width,height:canvas.height,eventObjects:objects.size,frames:totalFrame,armlessMongle:true,cosmetics:cosmetics.info,sceneryDetails:sceneryDetails.info,shopPreview,ambientParticles:petalMesh.count,particles:particles.length};}
  };
}
