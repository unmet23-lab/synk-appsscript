import * as T from '../vendor/three.module.js';
import {createCoastalBoats} from '../seascape-boats.js';
import {createLandscapeHeight} from '../landscape.js';
const pathX=s=>Math.sin(s/235)*25+Math.sin(s/580)*31,pathY=s=>23+Math.sin(s/280)*2.8+Math.sin(s/100)*1.2;
const angle=s=>Math.atan(Math.cos(s/235)*25/235+Math.cos(s/580)*31/580);
const rp=(s,o=0,y=0)=>new T.Vector3(pathX(s)+Math.cos(angle(s))*o,pathY(s)+y,s-Math.sin(angle(s))*o);
const ground=createLandscapeHeight(pathX,pathY),camera=new T.PerspectiveCamera(55,1920/1080,.12,4900);
camera.position.copy(rp(341,0,3.6));camera.lookAt(rp(374,0,1.55));camera.updateMatrixWorld();
const b=createCoastalBoats(T,{pathX,groundHeight:ground});b.update({time:0,playerS:350,camera,motion:false});b.group.updateMatrixWorld(true);
function ray(p){let min=Infinity,at=null;for(let t=.005;t<.995;t+=.002){const v=camera.position.clone().lerp(p,t),clearance=v.y-ground(v.x,v.z);if(clearance<min){min=clearance;at=v.toArray();}}return {min,at};}
console.log(JSON.stringify({camera:camera.position.toArray(),stats:b.stats}));
for(const boat of b.group.userData.boats){const root=b.group.getObjectByName(`coastal-${boat.kind}-${boat.id+1}`),p=root.position.clone();console.log(JSON.stringify({id:boat.id,kind:boat.kind,base:p.toArray(),visible:root.visible,atHull:ray(p.clone().add(new T.Vector3(0,.5,0))),atMast:ray(p.clone().add(new T.Vector3(0,8,0))),projectHull:p.clone().project(camera).toArray(),projectMast:p.clone().add(new T.Vector3(0,8,0)).project(camera).toArray()}));}
const hull=b.group.getObjectByName('coastal-sail-1').children[0],p=hull.geometry.attributes.position,n=hull.geometry.attributes.normal;let front=0,back=0,clear=0,blocked=0,total=0;
for(let i=0;i<p.count;i+=3){if(p.getY(i)<2||p.getY(i)>8)continue;const v=new T.Vector3().fromBufferAttribute(p,i).add(new T.Vector3().fromBufferAttribute(p,i+1)).add(new T.Vector3().fromBufferAttribute(p,i+2)).divideScalar(3).applyMatrix4(hull.matrixWorld),normal=new T.Vector3().fromBufferAttribute(n,i).transformDirection(hull.matrixWorld);normal.dot(camera.position.clone().sub(v))>0?front++:back++;ray(v).min>0?clear++:blocked++;total++;}console.log(JSON.stringify({sailTriangles:total,front,back,clear,blocked}));
for(const s of [470,500,520,560,600])for(const offset of [95,115,135,155,175]){const p=new T.Vector3(pathX(s)+offset,-1.7,s),v=p.clone().project(camera),mast=p.clone().add(new T.Vector3(0,7.5,0));console.log(JSON.stringify({s,offset,ndc:+v.x.toFixed(2),hullRay:+ray(p).min.toFixed(2),mastRay:+ray(mast).min.toFixed(2)}));}
