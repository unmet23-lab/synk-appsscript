import * as THREE from './scene-assets/three.module.js';
import {wardrobeItem} from './wardrobe-catalog.mjs';

const TAU=Math.PI*2;
const radii=[[.2,.90],[.35,.874],[.49,.852],[.83,.820],[1.0,.803],[1.12,.782],[1.43,.690]];
function radius(y){for(let i=1;i<radii.length;i++)if(y<=radii[i][0]){const [a,b]=radii[i-1], [c,d]=radii[i];return b+(d-b)*Math.max(0,(y-a)/(c-a));}return .69;}
const front=(x,y,lift=.055)=>[x,y,Math.sqrt(Math.max(.001,radius(y)**2-x*x))*.91+lift];
const at=(a,y,lift=.035)=>{const r=radius(y)+lift;return[Math.sin(a)*r,y,Math.cos(a)*r*.91];};

export function wardrobeDyeDefaults(slots={}){
  const result={};
  for(const slot of ['body','neck']){
    const item=wardrobeItem(slots[slot]);if(!item||item.slot!==slot)continue;
    const trim=item.key==='knit'?'#cdb074':item.key==='hanbok'?'#ece8dd':item.key==='cape'?'#adc0b8':item.slot==='neck'&&item.key!=='bandana'?item.color:'#'+new THREE.Color(item.color).lerp(new THREE.Color('#eee8da'),.35).getHexString();
    result[slot]=[item.color,trim];
  }
  return result;
}
export function normalizeWardrobeDyes(value={},slots={}){
  const result={};
  for(const slot of ['body','neck'])if(wardrobeItem(slots[slot])?.slot===slot&&Array.isArray(value?.[slot])&&value[slot].length===2&&value[slot].every(c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)))result[slot]=value[slot].map(c=>c.toLowerCase());
  return result;
}
function dyeMaterial(material,channel=0,factor=1){
  material.userData.dyeChannel=channel;material.userData.dyeFactor=factor;
  material.userData.dyeOriginal=material.color.clone();
  if(material.sheenColor)material.userData.dyeOriginalSheen=material.sheenColor.clone();
  return material;
}
function recolorGarment(group,palette){
  const touched=new Set();group.traverse(o=>{for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){
    if(touched.has(material)||!material.userData.dyeOriginal)continue;touched.add(material);
    const color=palette?.[material.userData.dyeChannel];
    if(color){material.color.set(color).multiplyScalar(material.userData.dyeFactor);if(material.sheenColor)material.sheenColor.copy(material.color).lerp(new THREE.Color('#ffffff'),.25);}
    else{material.color.copy(material.userData.dyeOriginal);if(material.sheenColor)material.sheenColor.copy(material.userData.dyeOriginalSheen);}
  }});
}

// Closed inner/outer skins; thickness survives side/back inspection and photo export.
function skin(fn,rows=22,cols=56,thickness=.018){
  const pos=[],uv=[],indices=[];
  for(let side=0;side<2;side++)for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=i/cols,v=j/rows,p=new THREE.Vector3(...fn(u,v));
    const du=new THREE.Vector3(...fn(Math.min(1,u+.001),v)).sub(new THREE.Vector3(...fn(Math.max(0,u-.001),v)));
    const dv=new THREE.Vector3(...fn(u,Math.min(1,v+.001))).sub(new THREE.Vector3(...fn(u,Math.max(0,v-.001))));
    p.addScaledVector(du.cross(dv).normalize(),(side?-.5:.5)*thickness);pos.push(...p.toArray());uv.push(u,v);
  }
  const n=(rows+1)*(cols+1),edge=[];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*(cols+1)+i;indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1,k+n,k+cols+1+n,k+1+n,k+1+n,k+cols+1+n,k+cols+2+n);}
  for(let i=0;i<=cols;i++)edge.push(i);for(let j=1;j<=rows;j++)edge.push(j*(cols+1)+cols);for(let i=cols-1;i>=0;i--)edge.push(rows*(cols+1)+i);for(let j=rows-1;j>0;j--)edge.push(j*(cols+1));
  for(let i=0;i<edge.length;i++){const a=edge[i],b=edge[(i+1)%edge.length];indices.push(a,a+n,b,b,a+n,b+n);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function mesh(parent,geometry,material,name){const m=new THREE.Mesh(geometry,material);m.name=name||'';m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function cord(parent,points,radius,material,closed=false){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'catmullrom',.25),Math.max(12,points.length),radius,6,closed),material);}
function sew(parent,points,material,thickness=.002){
  const pairs=[];for(let i=0;i+1<points.length;i+=2)pairs.push([points[i],points[i+1]]);
  if(!pairs.length)return;const m=new THREE.InstancedMesh(new THREE.CylinderGeometry(thickness,thickness,1,5),material,pairs.length),dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
  pairs.forEach(([aa,bb],i)=>{const a=new THREE.Vector3(...aa),b=new THREE.Vector3(...bb),d=b.clone().sub(a);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.scale.set(1,d.length(),1);dummy.quaternion.setFromUnitVectors(up,d.normalize());dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});parent.add(m);m.name='individual-garment-stitches';
}
function button(parent,p,mat,r=.015){const b=mesh(parent,new THREE.CylinderGeometry(r,r,.008,18),mat,'fastening');b.rotation.x=Math.PI/2;b.position.set(...p);return b;}

// Construct only garments actually visited. The original avatar and its two clothes
// remain unchanged; all added resources are owned by the avatar's normal disposal.
export function createAvatarWardrobe({parent,textile,footOffset=0,bodyProfile=radii,mobile=false,detail=false}={}){
  const root=new THREE.Group();root.name='mongle-wardrobe-v6';root.position.y=-footOffset;parent.add(root);
  const built=new Map(),profile=bodyProfile.length>2?bodyProfile:radii;let microKnitInstances=0,currentSlots={},currentDyes={};
  function radius(y){let lo=0,hi=profile.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(profile[mid][0]<y)lo=mid;else hi=mid;}const [a,b]=profile[lo],[c,d]=profile[hi];return b+(d-b)*Math.max(0,Math.min(1,(y-a)/Math.max(.00001,c-a)));}
  const front=(x,y,lift=.045)=>[x,y,Math.sqrt(Math.max(.001,radius(y)**2-x*x))*.91+lift];
  const at=(a,y,lift=.035)=>{const r=radius(y)+lift;return[Math.sin(a)*r,y,Math.cos(a)*r*.91];};
  const curvePoints=(fn,count=64)=>Array.from({length:count+1},(_,i)=>fn(i/count));
  const radialFold=(a,v,amount=.017)=>amount*(Math.cos(a*7+.8)+.33*Math.sin(a*13-v*3))*Math.sin(v*Math.PI*.94);
  function fabric(kind,color,repeat=[2.2,1.4],extra={}){
    const knit=kind==='knit-detail';
    return dyeMaterial(new THREE.MeshPhysicalMaterial({color,...textile.fabric(kind,repeat),normalScale:new THREE.Vector2(knit?.28:.38,knit?.28:.38),roughness:knit?.96:kind==='denim-detail'?.92:.98,sheen:knit?.76:.35,sheenRoughness:.88,sheenColor:new THREE.Color(color).lerp(new THREE.Color('#ffffff'),.25),aoMapIntensity:.58,side:THREE.DoubleSide,...extra}));
  }
  function band(parent,fn,width,mat,thickness=.026){
    return mesh(parent,skin((u,v)=>{const p=fn(u),a=u*TAU-Math.PI,roll=.007*Math.sin(v*Math.PI)+.0018*Math.cos(u*TAU*128)*Math.sin(v*Math.PI);p[1]+=(v-.5)*width;p[0]+=Math.sin(a)*roll;p[2]+=Math.cos(a)*roll*.91;return p;},10,128,Math.min(thickness,.022)),mat,'rounded-ribbed-garment-edge');
  }
  function stitching(parent,fn,mat,count=80,thickness=.0021){const points=[];for(let i=0;i<count;i++){points.push(fn((i+.25)/count),fn((i+.72)/count));}sew(parent,points,mat,thickness);}
  function knitLoops(parent,fn,color){
    const cols=mobile?64:96,rows=mobile?20:28,placements=[],curve=new THREE.CatmullRomCurve3([[-.43,.48,0],[-.36,.17,.06],[-.11,-.31,.015],[0,-.46,-.045],[.11,-.31,.015],[.36,.17,.06],[.43,.48,0]].map(p=>new THREE.Vector3(...p)),false,'centripetal');
    const geometry=new THREE.TubeGeometry(curve,12,.075,5,false),material=dyeMaterial(new THREE.MeshPhysicalMaterial({color,...textile.fabric('wool',[8,1.8]),normalScale:new THREE.Vector2(.22,.22),roughness:1,sheen:.80,sheenRoughness:.90,sheenColor:new THREE.Color(color).lerp(new THREE.Color('#fff6dc'),.24)}));
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const u=(i+.5+(j%2)*.035)/cols,v=.09+(j+.5)/rows*.80,p=new THREE.Vector3(...fn(u,v));
      if(p.z>.45&&p.y>.455&&p.y<1.02&&[-.305,0,.305].some(x=>Math.abs(p.x-x)<.034))continue;
      const du=new THREE.Vector3(...fn(u+1/cols/2,v)).sub(new THREE.Vector3(...fn(u-1/cols/2,v))),dv=new THREE.Vector3(...fn(u,v+.80/rows/2)).sub(new THREE.Vector3(...fn(u,v-.80/rows/2)));
      const normal=dv.clone().cross(du).normalize(),right=du.clone().normalize(),up=normal.clone().cross(right).normalize(),matrix=new THREE.Matrix4().makeBasis(right,up,normal);
      matrix.scale(new THREE.Vector3(du.length()*.98,dv.length()*.93,.044));matrix.setPosition(p.addScaledVector(normal,.018));placements.push(matrix);
    }
    const yarn=new THREE.InstancedMesh(geometry,material,placements.length);microKnitInstances=placements.length;yarn.name='actual-three-dimensional-knit-loops';yarn.castShadow=yarn.receiveShadow=true;placements.forEach((m,i)=>yarn.setMatrixAt(i,m));yarn.computeBoundingBox();yarn.computeBoundingSphere();parent.add(yarn);
    let seed=9176;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),positions=[];
    for(let i=0;i<(mobile?1400:3200);i++){const u=random(),v=.09+random()*.82,p=new THREE.Vector3(...fn(u,v)),du=new THREE.Vector3(...fn(u+.001,v)).sub(new THREE.Vector3(...fn(u-.001,v))),dv=new THREE.Vector3(...fn(u,v+.001)).sub(new THREE.Vector3(...fn(u,v-.001))),normal=dv.cross(du).normalize(),tangent=du.normalize();p.addScaledVector(normal,.023);const q=p.clone().addScaledVector(tangent,(random()-.5)*.0034).addScaledVector(normal,.0009+random()*.0019);positions.push(...p.toArray(),...q.toArray());}
    const napGeometry=new THREE.BufferGeometry();napGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const nap=new THREE.LineSegments(napGeometry,dyeMaterial(new THREE.LineBasicMaterial({color:new THREE.Color(color).lerp(new THREE.Color('#fff5df'),.2),transparent:true,opacity:.12,depthWrite:false})));nap.name='short-wool-yarn-fibres';parent.add(nap);
  }
  function pocket(parent,fn,mat,edge,liner){
    mesh(parent,skin(fn,18,24,.019),mat,'open-rounded-pocket');
    mesh(parent,skin((u,v)=>{const p=fn(u,v*.06);p[1]-=.009;p[2]-=.014;return p;},3,24,.004),liner,'actual-pocket-opening');
    mesh(parent,skin((u,v)=>{const p=fn(u,.015+v*.095);p[2]+=.003;return p;},4,24,.011),mat,'turned-pocket-lip');
    for(const u of [.022,.978])stitching(parent,t=>fn(u,.11+t*.85),edge,22,.0018);
    stitching(parent,t=>fn(t,.96),edge,26,.0018);stitching(parent,t=>fn(t,.115),edge,25,.0018);
  }
  function build(id){
    if(built.has(id))return built.get(id);const item=wardrobeItem(id);if(!item)return null;
    const group=new THREE.Group();group.name=id;root.add(group);built.set(id,group);
    const edge=dyeMaterial(new THREE.MeshStandardMaterial({color:new THREE.Color(item.color).lerp(new THREE.Color('#eee8da'),.35),roughness:.96}),1);
    const brass=new THREE.MeshPhysicalMaterial({color:'#997049',metalness:.72,roughness:.36,clearcoat:.12});
    const lining=dyeMaterial(new THREE.MeshStandardMaterial({color:new THREE.Color(item.color).multiplyScalar(.57),roughness:1}),0,.57);
    if(item.key==='knit'){
      const mat=fabric('knit-detail',item.color,[6.8,1.5]),ribMat=dyeMaterial(fabric('knit-detail','#cdb074',[6.5,.65]),1);
      const neck=a=>1.115-.123*Math.exp(-Math.pow(a/.63,2))+.007*Math.sin(a*2),hem=a=>.365+.012*Math.cos(a*3+.5);
      const body=(u,v)=>{const a=u*TAU-Math.PI,y=neck(a)*(1-v)+hem(a)*v;return at(a,y,.047+radialFold(a,v,.018)+.013*Math.sin(v*Math.PI));};
      mesh(group,skin(body,38,112,.032),mat,'shaped-cable-knit-vest');
      if(detail)knitLoops(group,body,item.color);
      band(group,t=>{const a=t*TAU-Math.PI;return at(a,neck(a)-.018,.060);},.052,ribMat,.033);
      band(group,t=>{const a=t*TAU-Math.PI;return at(a,hem(a)+.027,.060);},.069,ribMat,.031);
      const ribs=[];for(let i=0;i<130;i++){const a=i/130*TAU-Math.PI;ribs.push(at(a,hem(a)+.003,.077),at(a,hem(a)+.051,.077));}sew(group,ribs,edge,.0022);
      for(const x of [-.305,0,.305])for(const side of [-1,1]){
        const top=x===0?.932:1.00;
        cord(group,curvePoints(t=>{const y=top-t*(top-.468),phase=t*Math.PI*8;return front(x+Math.sin(phase+side*Math.PI/2)*.021,y,.066+Math.cos(phase+side*Math.PI/2)*.006);},72),.0105,mat);
      }
      for(const side of [-1,1])stitching(group,t=>{const y=1.074-t*.63;return at(side*1.34,y,.060);},edge,50,.0018);
    }else if(item.key==='apron'||item.key==='denim'){
      const denim=item.key==='denim',mat=fabric(denim?'denim-detail':'cotton-detail',item.color,denim?[2.8,2.5]:[2.1,1.8]);
      const bib=(u,v)=>{const width=.237+.29*Math.sin(v*1.42),x=(u*2-1)*width,y=1.074-v*.734+.027*Math.pow(Math.abs(u-.5)*2,3)*v*v,fold=(.006+.015*v)*Math.sin(u*16+v*2)*Math.sin(v*Math.PI);return front(x,y,.038+fold+.011*Math.sin(v*4));};
      mesh(group,skin(bib,38,48,.023),mat,denim?'draped-denim-pinafore':'draped-cotton-apron');
      for(const u of [.015,.985]){cord(group,curvePoints(t=>bib(u,t),45),.0028,edge);stitching(group,t=>bib(u+(u<.5?.012:-.012),t),edge,53,.0017);}
      for(const v of [.955,.979])stitching(group,t=>bib(t,v),edge,58,.0018);
      mesh(group,skin((u,v)=>{const p=bib(u,.006+v*.065);p[2]+=.006;return p;},4,48,.008),mat,'turned-bib-edge');
      for(const side of [-1,1]){
        const strap=(u,v)=>{const a=side*(.270+v*(Math.PI-.54)),y=1.102+.036*Math.sin(v*Math.PI)+(u-.5)*.046;return at(a,y,.041);};
        mesh(group,skin(strap,48,6,.019),mat,'fitted-shoulder-strap');
        stitching(group,t=>strap(.2,t),edge,48,.0016);stitching(group,t=>strap(.8,t),edge,48,.0016);
        if(denim)button(group,front(side*.205,1.027,.061),brass,.016);
      }
      const bibAt=(x,y,lift)=>{const v=(1.074-y)/.734,w=.237+.29*Math.sin(v*1.42),p=bib((x/w+1)/2,v);p[2]+=lift;return p;};
      for(const side of denim?[-1,1]:[0]){
        const fn=(u,v)=>{const x=side*.174+(u-.5)*(denim?.268:.326),y=.730-v*.246+Math.pow(Math.abs(u-.5)*2,4)*v*v*.024;return bibAt(x,y,.019+.020*Math.sin(u*Math.PI)*Math.sin(v*Math.PI));};
        pocket(group,fn,mat,edge,lining);
        if(denim)for(const u of [.045,.955])button(group,fn(u,.095),brass,.010);
      }
      const waist=(u,v)=>at(Math.PI+(u-.5)*2.5,.826-v*.039,.037);mesh(group,skin(waist,5,56,.014),mat,'waist-tie-around-body');
      for(const side of [-1,1]){const tail=(u,v)=>{const a=Math.PI+side*(.02+v*.10);return at(a,.795-v*.165+(u-.5)*.043,.054+.024*Math.sin(v*3.1));};mesh(group,skin(tail,16,7,.012),mat,'soft-back-tie');}
    }else if(item.key==='cape'){
      const mat=fabric('wax-detail',item.color,[2.8,2.5],{roughness:.82,clearcoat:.08,clearcoatRoughness:.75,sheen:.22});
      const top=a=>1.117-.047*Math.cos(a),hem=a=>.408+.049*Math.cos(a*2+.25)+.012*Math.sin(a*3);
      const cape=(u,v)=>{const a=.085+u*(TAU-.17),y=top(a)*(1-v)+hem(a)*v;return at(a,y,.038+.088*Math.pow(v,1.8)+radialFold(a,v,.026));};
      mesh(group,skin(cape,42,112,.023),mat,'weighted-rain-cape');
      cord(group,curvePoints(t=>cape(t,.985),110),.0036,edge);
      stitching(group,t=>cape(t,.969),edge,140,.0019);
      const collar=(u,v)=>{const a=.075+u*(TAU-.15),y=top(a)-.018+v*.049,lip=.048+v*.048+Math.sin(v*Math.PI)*.007;return at(a,y,lip);};
      mesh(group,skin(collar,10,92,.022),mat,'rolled-rain-cape-collar');
      const facing=dyeMaterial(fabric('cotton-detail','#adc0b8',[3,.25]),1);mesh(group,skin((u,v)=>{const p=collar(u,v);p[2]-=.010;return p;},10,92,.007),facing,'collar-facing');
      for(const v of [.13,.37,.61]){const p=cape(.007,v);p[2]+=.014;button(group,p,brass,.014);}
      for(const u of [.01,.99]){mesh(group,skin((s,v)=>cape(u+(s-.5)*.012,v),30,4,.011),mat,'folded-front-cape-placket');stitching(group,t=>cape(u,t),edge,48,.0016);}
    }else if(item.key==='hanbok'){
      const mat=fabric('silk-detail',item.color,[3.2,2.4],{sheen:.58,roughness:.88});
      const neck=a=>1.112-.246*Math.max(0,1-Math.abs(a)/.58),hem=a=>.401+.018*Math.cos(a*3+.4);
      const wrap=(u,v)=>{const a=u*TAU-Math.PI,y=neck(a)*(1-v)+hem(a)*v;return at(a,y,.041+radialFold(a,v,.014));};
      mesh(group,skin(wrap,38,104,.026),mat,'V-neck-shaped-baeja');
      const overlap=(u,v)=>{const a=-.025+u*.53,y=neck(a)*(1-v)+(.398+.02*Math.cos(a*4))*v;return at(a,y,.068+.01*Math.sin(u*Math.PI)*Math.sin(v*Math.PI));};
      mesh(group,skin(overlap,30,22,.020),mat,'real-overlapping-front-seop');
      const white=dyeMaterial(fabric('cotton-detail','#ece8dd',[.35,2.2]),1);
      for(const side of [-1,1]){
        const lapel=(u,v)=>{const a=side*(.625-v*.625),y=neck(a)+(u-.5)*.052;return at(a,y,.064+.009*Math.sin(u*Math.PI));};
        mesh(group,skin(lapel,44,7,.018),white,'turned-hanbok-dongjeong');
        stitching(group,t=>lapel(.87,t),edge,52,.0015);
      }
      const diagonal=(u,v)=>{const a=.02+v*.325,y=.86-v*.194+(u-.5)*.050;return at(a,y,.081);};
      mesh(group,skin(diagonal,24,6,.016),white,'asymmetric-overlap-facing');
      const tie=fabric('silk-detail','#b66d76',[.4,.8],{sheen:.52,roughness:.89});
      delete tie.userData.dyeOriginal;delete tie.userData.dyeOriginalSheen;
      for(const sign of [-1,1]){
        const loop=(u,v)=>{const a=u*TAU,x=.128+sign*(.061+Math.sin(a)*.079),y=.710+Math.cos(a)*.028+(v-.5)*.031;return front(x,y,.089+Math.sin(a)*.023);};
        mesh(group,skin(loop,7,48,.010),tie,'folded-fabric-goreum-loop');
        const tail=(u,v)=>front(.14+sign*(.043+(u-.5)*.047)+Math.sin(v*2.6)*.014,.688-v*(sign<0?.198:.230),.094+.016*Math.sin(v*4.4));
        mesh(group,skin(tail,25,8,.010),tie,'weighted-goreum-tail');
      }
      cord(group,curvePoints(t=>wrap(t,.983),104),.003,edge,true);
    }else if(item.key==='scarf'||item.key==='lapis-scarf'){
      const ivory=item.key==='scarf',mat=fabric('knit-detail',item.color,[7.8,.8]),endMat=dyeMaterial(fabric('knit-detail',item.color,[.54,1.6]),1);
      const band=(u,v)=>{const a=u*TAU,y=1.113-v*.136-.027*Math.cos(a)+.008*Math.sin(a*2.5),lift=.060+.018*Math.sin(v*Math.PI)+.005*Math.cos(a*6);return at(a,y,lift);};
      mesh(group,skin(band,16,108,.034),mat,'soft-folded-knitted-neck-wrap');
      for(const v of [.04,.965])cord(group,curvePoints(t=>band(t,v),108),.0045,mat,true);
      for(const side of [-1,1]){
        const tail=(u,v)=>{const x=.428+side*.081+(u-.5)*(.173-.017*v)+Math.sin(v*3.2)*side*.015-v*.056,y=1.009-v*(side<0?.367:ivory?.542:.453);return front(x,y,.099+.026*Math.sin(v*3.5)+.011*Math.sin(u*TAU+v*2));};
        mesh(group,skin(tail,32,18,.024),endMat,'draped-knitted-scarf-tail');
        stitching(group,t=>tail(t,.905),edge,20,.0022);
        const rib=[];for(let i=0;i<17;i++){const u=(i+.5)/17;rib.push(tail(u,.926),tail(u,.978));}sew(group,rib,edge,.0019);
        if(ivory)for(let i=0;i<13;i++){const p=tail((i+.5)/13,1);cord(group,[p,[p[0]+.002,p[1]-.028,p[2]+.006],[p[0]+.005,p[1]-.047,p[2]+.010]],.0022,endMat);}
        if(ivory&&side>0){const noteMat=new THREE.MeshStandardMaterial({color:'#c97878',roughness:.96}),p=tail(.47,.78);p[2]+=.017;cord(group,[p,[p[0],p[1]+.044,p[2]],[p[0]+.030,p[1]+.052,p[2]]],.0037,noteMat);const note=mesh(group,new THREE.SphereGeometry(.009,12,8),noteMat,'same-scarf-music-note');note.position.set(p[0]-.008,p[1],p[2]);note.scale.set(1.2,.75,.42);}
      }
    }else if(item.key==='bandana'){
      const mat=fabric('cotton-detail',item.color,[1.3,1.2]);
      const band=(u,v)=>{const a=u*TAU,y=1.108-v*.047-.020*Math.cos(a);return at(a,y,.043+Math.sin(v*Math.PI)*.007);};mesh(group,skin(band,7,96,.014),mat,'folded-cotton-neck-band');
      const triangle=(u,v)=>{const x=(u-.5)*(.62*(1-v)),y=1.071-v*.404;return front(x,y,.068+.032*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)+.006*Math.sin(u*15)*Math.sin(v*Math.PI));};
      mesh(group,skin(triangle,34,30,.012),mat,'weighted-cotton-triangle');
      for(const u of [0,1]){cord(group,curvePoints(t=>triangle(u,t),34),.0024,edge);stitching(group,t=>triangle(u===0?.018:.982,t),edge,43,.0015);}
      const knot=mesh(group,new THREE.SphereGeometry(.031,20,14),mat,'folded-bandana-back-knot');knot.position.set(...at(Math.PI,1.067,.055));knot.scale.set(1.35,.66,.92);
      for(const side of [-1,1])mesh(group,skin((u,v)=>at(Math.PI+side*(.025+v*.11),1.052-v*.12+(u-.5)*.036,.05+.02*Math.sin(v*3)),14,6,.012),mat,'bandana-tied-ends');
    }
    group.visible=false;return group;
  }
  return {
    set(slots){currentDyes=Object.fromEntries(Object.entries(currentDyes).filter(([slot])=>slots[slot]===currentSlots[slot]));currentSlots={...slots};for(const g of built.values())g.visible=false;for(const id of [slots.body,slots.neck])if(id){const g=build(id);if(g){g.visible=true;const layer=wardrobeItem(id)?.slot==='neck'&&slots.body?slots.body==='mongle-rain-cape'?1.055:slots.body==='mongle-knit-butter'||slots.body==='mongle-hanbok-vest'?1.04:1.025:1;g.scale.set(layer,1,layer);recolorGarment(g,currentDyes[wardrobeItem(id).slot]);}}},
    setDyes(value={}){currentDyes=normalizeWardrobeDyes(value,currentSlots);for(const [id,g]of built)if(g.visible)recolorGarment(g,currentDyes[wardrobeItem(id).slot]);return JSON.parse(JSON.stringify(currentDyes));},
    getDyes:()=>JSON.parse(JSON.stringify(currentDyes)),
    metrics:()=>({builtGarments:[...built.keys()],visibleGarments:[...built].filter(([,g])=>g.visible).map(([id])=>id),revision:6,dyeRevision:1,dyes:JSON.parse(JSON.stringify(currentDyes)),fitting:'derived-from-existing-body-profile',microGeometry:detail,microKnitInstances,detailTextureSize:mobile?512:1024}),
  };
}
